
export default function injectScriptsWhenModule () {
  if (process.argv.includes('build')) {
    return
  }

  const { nuxt } = this
  const config = this.options
  const { injectScriptsWhen } = config

  if (!injectScriptsWhen) {
    return
  }

  const { parse: parseHTML } = require('node-html-parser')
  const MagicString = require('magic-string')
  const kRenderer = Symbol('renderer')

  const { renderer } = nuxt
  renderer[kRenderer] = renderer.renderRoute.bind(renderer)

  renderer.renderRoute = async (route, context) => {
    const { html: _html, ...result } = await renderer[kRenderer](route, context)
    const markup = new MagicString(_html)
    const deferred = []
    const parsed = parseHTML(_html)
    const scripts = parsed.querySelectorAll('script')
    const links = parsed.querySelectorAll('link')
    for (const link of links) {
      if (!link.attributes.href) {
        continue
      }
      if (link.attributes.rel === 'preload' && link.attributes.as === 'script') {
        deferred.push([link.range, {
          src: link.attributes.href,
        }])
      } else if (link.attributes.rel === 'modulepreload') {
        deferred.push([link.range, {
          type: 'module',
          src: link.attributes.href,
        }])
      }
    }
    for (const script of scripts) {
      if (!script.attributes.src) {
        continue
      }
      deferred.push([script.range, {
        type: script.attributes.type || 'text/javascript',
        src: script.attributes.src,
      }])
    }
    let loader = '<script>\n'
    loader += `${injectScriptsWhen.toString()}\n`
    loader += `${addScript.toString()}\n`
    loader += `${injectScriptsWhen.name}(() => {\n`
    for (const [range, script] of deferred) {
      markup.overwrite(...range, '')
      loader += `  addScript('${script.src}', '${script.type}')\n`
    }
    loader += '})\n</script>\n'
    const html = markup.toString()
    result.html = html.replace(/<\/head>/gsm, `\n${loader}\n</head>`)
    return result
  }
};

function addScript (src, type) {
  const script = document.createElement('script')
  script.setAttribute('src', src)
  if (type) {
    script.setAttribute('type', type)
  }
  document.head.appendChild(script)
}
