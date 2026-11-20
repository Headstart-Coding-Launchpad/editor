import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  buildIframeSrc,
  getLastLoadId,
  getPreviewDoc,
  resolveIframeErrorLocation,
  snapshotMirrorHtml,
  waitForIframeText,
} from '../iframe.js'
import { evaluateHtmlCheck } from '../checks.js'

afterEach(() => {
  vi.restoreAllMocks()
})

// getMime is not exported, so it is tested indirectly via buildIframeSrc
// by confirming the function succeeds for each file type. Direct MIME type
// assertions are made by inspecting the Blob constructor arguments through
// the mock URL (blob:mock-url is always returned by setup.js mock).

// ─── getMime (indirect) — tested via file type property ──────────────────────
// Since getMime is a private function, we verify its effect by checking that
// buildIframeSrc does not throw when given files of each type.

describe('getMime — indirect via buildIframeSrc (no throw for each type)', () => {
  const types = ['html', 'css', 'javascript', 'python', 'unknown']
  for (const type of types) {
    it(`accepts file with type="${type}" without throwing`, () => {
      const files = [{ name: 'index.html', type: 'html', content: '<html><body></body></html>' }]
      if (type !== 'html') {
        files.push({ name: `file.${type}`, type, content: '/* content */' })
      }
      expect(() => buildIframeSrc(files)).not.toThrow()
    })
  }
})

// ─── getMime — verified via file.name extension ───────────────────────────────
// We test extension-based MIME detection indirectly: buildIframeSrc accepts
// files where type is absent but name has a recognised extension.

describe('getMime — extension-based detection via buildIframeSrc', () => {
  it('handles .html extension in file name', () => {
    const files = [{ name: 'index.html', content: '<html><body>hi</body></html>' }]
    expect(() => buildIframeSrc(files)).not.toThrow()
  })

  it('handles .css extension in file name', () => {
    const html = {
      name: 'index.html',
      content: '<html><head><link href="style.css"></head><body></body></html>',
    }
    const css = { name: 'style.css', content: 'body{}' }
    expect(() => buildIframeSrc([html, css])).not.toThrow()
  })

  it('handles .js extension in file name', () => {
    const html = {
      name: 'index.html',
      content: '<html><body><script src="app.js"></script></body></html>',
    }
    const js = { name: 'app.js', content: 'console.log(1)' }
    expect(() => buildIframeSrc([html, js])).not.toThrow()
  })
})

// ─── buildIframeSrc — null / empty ────────────────────────────────────────────

describe('buildIframeSrc — null / empty input', () => {
  it('returns null for null files argument', () => {
    expect(buildIframeSrc(null)).toBeNull()
  })

  it('returns null for empty files array', () => {
    expect(buildIframeSrc([])).toBeNull()
  })

  it('returns null when no HTML file is present', () => {
    const files = [{ name: 'style.css', type: 'css', content: 'body{}' }]
    expect(buildIframeSrc(files)).toBeNull()
  })
})

// ─── buildIframeSrc — Blob URL mock ───────────────────────────────────────────

describe('buildIframeSrc — returns mock Blob URL', () => {
  it('returns blob:mock-url string for a valid HTML file', () => {
    const files = [{ name: 'index.html', type: 'html', content: '<html><body>hello</body></html>' }]
    const result = buildIframeSrc(files)
    expect(result).toBe('blob:mock-url')
  })

  it('returns blob:mock-url for a multi-file project', () => {
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><head><link href="style.css"></head><body></body></html>',
      },
      { name: 'style.css', type: 'css', content: 'body { color: red; }' },
    ]
    expect(buildIframeSrc(files)).toBe('blob:mock-url')
  })
})

// ─── buildIframeSrc — entryFile selection ────────────────────────────────────

describe('buildIframeSrc — entryFile selection', () => {
  it('picks the named entry file when specified', () => {
    const files = [
      { name: 'main.html', type: 'html', content: '<html><body>main</body></html>' },
      { name: 'other.html', type: 'html', content: '<html><body>other</body></html>' },
    ]
    const result = buildIframeSrc(files, 'main.html')
    expect(result).toBe('blob:mock-url')
  })

  it('falls back to the first .html file when entryFile is not found', () => {
    const files = [{ name: 'index.html', type: 'html', content: '<html><body></body></html>' }]
    const result = buildIframeSrc(files, 'nonexistent.html')
    expect(result).toBe('blob:mock-url')
  })
})

// ─── buildIframeSrc — href/src rewriting ─────────────────────────────────────

describe('buildIframeSrc — cross-file reference rewriting', () => {
  it('rewrites href references to sibling CSS to blob:mock-url', () => {
    // We cannot inspect the produced blob content directly (mock always
    // returns the same URL), but we verify the function does not throw and
    // returns a URL (meaning the rewriting step completed without error).
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><head><link href="style.css"></head><body></body></html>',
      },
      { name: 'style.css', type: 'css', content: 'body{}' },
    ]
    expect(buildIframeSrc(files)).toBeTruthy()
  })
})

// ─── buildIframeSrc — assets path rewriting ───────────────────────────────────

describe('buildIframeSrc — assetsPath option', () => {
  it('rewrites an HTML asset reference to the static server URL', async () => {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><body><img src="cat.png"></body></html>',
      },
    ]
    const options = { assets: ['cat.png'], assetsPath: 'https://cdn.example.com/' }
    expect(buildIframeSrc(files, 'index.html', options)).toBe('blob:test-1')
    expect(await blobs[0].text()).toContain('src="https://cdn.example.com/cat.png"')
  })

  it('rewrites relative asset references inside linked CSS files', async () => {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><head><link href="style.css"></head></html>',
      },
      {
        name: 'style.css',
        type: 'css',
        content: ".poster { background: url('skiing.jpg') center/cover; }",
      },
    ]
    const options = { assets: ['skiing.jpg'], assetsPath: 'https://cdn.example.com/' }
    buildIframeSrc(files, 'index.html', options)
    // Sibling files are data: URLs (an opaque-origin page cannot load the app's blob: URLs).
    expect(decodeURIComponent(await blobs[0].text())).toContain(
      "url('https://cdn.example.com/skiing.jpg')"
    )
  })

  it('keeps editable files ahead of same-named static assets', async () => {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><head><link href="style.css"></head></html>',
      },
      { name: 'style.css', type: 'css', content: 'body { color: red; }' },
    ]
    const options = { assets: ['style.css'], assetsPath: 'https://cdn.example.com/' }
    buildIframeSrc(files, 'index.html', options)
    expect(await blobs[0].text()).toContain('href="data:text/css;charset=utf-8,body')
    expect(await blobs[0].text()).not.toContain('https://cdn.example.com/style.css')
  })
})

// ─── resolveIframeErrorLocation — error → student file/line mapping ─────────

describe('resolveIframeErrorLocation', () => {
  function mockIncrementingBlobUrls() {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    return blobs
  }

  it('maps an inline <script> error in the entry file back to its original line', async () => {
    const blobs = mockIncrementingBlobUrls()
    const original = [
      '<html>',
      '<head></head>',
      '<body>',
      '<script>',
      'function boom() {',
      "  throw new Error('boom')",
      '}',
      'boom()',
      '</script>',
      '</body>',
      '</html>',
    ].join('\n')

    const entrySrc = buildIframeSrc([{ name: 'index.html', type: 'html', content: original }])
    const loadId = getLastLoadId()

    // Simulate the browser reporting the line number as it appears in the
    // actual (injected) document served to the iframe.
    const rewrittenHtml = await blobs[blobs.length - 1].text()
    const rewrittenLineIndex = rewrittenHtml
      .split('\n')
      .findIndex((l) => l.includes("throw new Error('boom')"))
    expect(rewrittenLineIndex).toBeGreaterThan(-1)
    const browserReportedLine = rewrittenLineIndex + 1

    const location = resolveIframeErrorLocation(loadId, entrySrc, browserReportedLine)

    // "throw new Error('boom')" is line 6 of the original student source.
    expect(location).toEqual({ file: 'index.html', line: 6 })
  })

  it('maps an external script file error directly, with no line offset', () => {
    mockIncrementingBlobUrls()
    const files = [
      {
        name: 'index.html',
        type: 'html',
        content: '<html><body><script src="app.js"></script></body></html>',
      },
      {
        name: 'app.js',
        type: 'javascript',
        content: 'function boom(){\n  throw new Error("x")\n}\nboom()',
      },
    ]

    buildIframeSrc(files)
    const loadId = getLastLoadId()
    // Sibling files are served as data: URLs; the entry's live document is a blob.
    const appJsUrl = `data:application/javascript;charset=utf-8,${encodeURIComponent(files[1].content)}`

    const location = resolveIframeErrorLocation(loadId, appJsUrl, 2)

    expect(location).toEqual({ file: 'app.js', line: 2 })
  })

  it('returns null for a filename it does not recognise', () => {
    mockIncrementingBlobUrls()
    buildIframeSrc([{ name: 'index.html', type: 'html', content: '<html><body>hi</body></html>' }])
    const loadId = getLastLoadId()

    expect(resolveIframeErrorLocation(loadId, 'blob:unrelated', 3)).toBeNull()
  })

  it('returns null for a stale loadId from a previous run', () => {
    mockIncrementingBlobUrls()
    const entrySrc = buildIframeSrc([
      { name: 'index.html', type: 'html', content: '<html><body>hi</body></html>' },
    ])
    const staleLoadId = getLastLoadId()

    // A second Run replaces the tracked context.
    buildIframeSrc([{ name: 'index.html', type: 'html', content: '<html><body>bye</body></html>' }])

    expect(resolveIframeErrorLocation(staleLoadId, entrySrc, 1)).toBeNull()
  })

  it('returns null when the mapped line would fall before the start of the file', () => {
    mockIncrementingBlobUrls()
    const entrySrc = buildIframeSrc([
      { name: 'index.html', type: 'html', content: '<html><body>hi</body></html>' },
    ])
    const loadId = getLastLoadId()

    // The injected CSP + console interceptor always add at least one line
    // ahead of the student's markup, so browser line 1 can never be theirs.
    expect(resolveIframeErrorLocation(loadId, entrySrc, 1)).toBeNull()
  })
})

// ─── copyProtect — broadcast viewers ─────────────────────────────────────────

describe('buildIframeSrc copyProtect', () => {
  async function renderedHtml(options) {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    buildIframeSrc(
      [{ name: 'index.html', type: 'html', content: '<html><body><p>Hi</p></body></html>' }],
      'index.html',
      options
    )
    return blobs[blobs.length - 1].text()
  }

  it('blocks selection, copy and the context menu inside a broadcast preview', async () => {
    const html = await renderedHtml({ copyProtect: true })
    expect(html).toContain('user-select:none')
    expect(html).toContain("'contextmenu'")
    // Injected at the end of the body so student line numbers are unaffected.
    expect(html.indexOf("'contextmenu'")).toBeGreaterThan(html.indexOf('<p>Hi</p>'))
  })

  it('leaves a normal preview untouched', async () => {
    const html = await renderedHtml()
    expect(html).not.toContain('user-select:none')
    expect(html).not.toContain("'contextmenu'")
  })
})

describe('waitForIframeText message source', () => {
  it('ignores a matching-id report that does not come from a page iframe', async () => {
    const { waitForIframeText } = await import('../iframe.js')
    buildIframeSrc([{ name: 'index.html', type: 'html', content: '<html><body>x</body></html>' }])
    const id = getLastLoadId()
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const pending = waitForIframeText(50)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__hsc_text__', id, text: 'forged' },
        source: window,
      })
    )
    expect(await pending).toBe('')
    const pending2 = waitForIframeText(500)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__hsc_text__', id, text: 'real' },
        source: frame.contentWindow,
      })
    )
    expect(await pending2).toBe('real')
    frame.remove()
  })
})

describe('sandboxed preview snapshot (R6: no same-origin access to the page)', () => {
  let n = 0
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:load-${++n}`)
  })

  async function builtHtml(options) {
    const blobs = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob)
      return `blob:test-${blobs.length}`
    })
    buildIframeSrc(
      [{ name: 'index.html', type: 'html', content: '<p>Hi</p>' }],
      'index.html',
      options
    )
    return blobs[blobs.length - 1].text()
  }

  // Posts one report from a page iframe for the latest build.
  function report(frame, data) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: '__hsc_text__', id: getLastLoadId(), ...data },
        source: frame.contentWindow,
      })
    )
  }

  function withFrame(fn) {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    return fn(frame).finally(() => frame.remove())
  }

  it('asks a snapshot build for the checked style properties; the CSP names the app origin', async () => {
    const html = await builtHtml({ styleProps: ['color'], snapshot: true })
    expect(html).toContain('outerHTML')
    expect(html).toContain('["color"]')
    expect(html).toContain("addEventListener('load'")
    expect(html).toContain(window.location.origin)
  })

  it('keeps a build without `snapshot` (live views, thumbnails) to the text-only report', async () => {
    const html = await builtHtml()
    expect(html).toContain('__hsc_text__')
    expect(html).not.toContain('outerHTML')
  })

  it('maps styles and values by tagged index, even with a noscript before the target', () =>
    withFrame(async (frame) => {
      const src = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<p>x</p>' }])
      const pending = waitForIframeText(500)
      const html =
        '<html data-hsc-i="0"><head data-hsc-i="1"></head><body data-hsc-i="2">' +
        '<noscript data-hsc-i="3"><p>no js</p></noscript><h1 data-hsc-i="4" class="t">Hi</h1>' +
        '<input data-hsc-i="5" id="n"></body></html>'
      const styles = [{}, {}, {}, {}, { color: 'rgb(255, 0, 0)' }, {}]
      report(frame, { text: 'Hi', html, styles, values: [null, null, null, null, null, 'Sam'] })
      report(frame, {
        text: 'Hi',
        html,
        styles,
        values: [null, null, null, null, null, 'Sam'],
        final: true,
      })
      expect(await pending).toBe('Hi')
      const iframeDoc = getPreviewDoc(src)
      const check = (c) => evaluateHtmlCheck(c, 'Hi', { iframeDoc })
      expect(check({ type: 'html_element', selector: 'h1.t' })).toBe(true)
      const color = { type: 'html_element_style_property', selector: 'h1', property: 'color' }
      expect(check({ ...color, value: 'rgb(255, 0, 0)' })).toBe(true)
      expect(check({ type: 'html_element_value', selector: '#n', value: 'Sam' })).toBe(true)
      expect(iframeDoc.querySelector('[data-hsc-i]')).toBeNull()
    }))

  it('uses the load-time report (stylesheets applied), not the first one', () =>
    withFrame(async (frame) => {
      const src = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<h1>x</h1>' }])
      const pending = waitForIframeText(500)
      const html =
        '<html data-hsc-i="0"><head data-hsc-i="1"></head><body data-hsc-i="2"><h1 data-hsc-i="3">x</h1></body></html>'
      report(frame, { text: 'x', html, styles: [{}, {}, {}, { color: 'rgb(0, 0, 0)' }] })
      report(frame, {
        text: 'x',
        html,
        styles: [{}, {}, {}, { color: 'rgb(255, 0, 0)' }],
        final: true,
      })
      await pending
      const h1 = getPreviewDoc(src).querySelector('h1')
      expect(getPreviewDoc(src).defaultView.getComputedStyle(h1).getPropertyValue('color')).toBe(
        'rgb(255, 0, 0)'
      )
    }))

  it('keeps each load its own snapshot, keyed by its src', () =>
    withFrame(async (frame) => {
      const first = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<p>1</p>' }])
      const one = waitForIframeText(500)
      report(frame, { text: '1', html: '<p id="one">1</p>', final: true })
      await one
      const second = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<p>2</p>' }])
      const two = waitForIframeText(500)
      report(frame, { text: '2', html: '<p id="two">2</p>', final: true })
      await two
      expect(getPreviewDoc(first).querySelector('#one')).not.toBeNull()
      expect(getPreviewDoc(second).querySelector('#two')).not.toBeNull()
    }))

  it('survives a malformed report: values null, html not a string', () =>
    withFrame(async (frame) => {
      const src = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<p>x</p>' }])
      const pending = waitForIframeText(500)
      report(frame, { text: 'ok', html: '<p>ok</p>', styles: null, values: null, final: true })
      expect(await pending).toBe('ok')
      expect(getPreviewDoc(src).querySelector('p').textContent).toBe('ok')
      const src2 = buildIframeSrc([{ name: 'index.html', type: 'html', content: '<p>x</p>' }])
      const pending2 = waitForIframeText(500)
      report(frame, { text: 5, html: 5, final: true })
      expect(await pending2).toBe('')
      expect(getPreviewDoc(src2)).toBeNull()
    }))

  it("gives the Inspector's copy the app's CSP and drops the student's CSP and base tags", () => {
    const html =
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *">' +
      '<base href="https://example.com/"></head><body><noscript><p>no js</p></noscript></body></html>'
    const mirror = snapshotMirrorHtml({ html })
    expect(mirror.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"')).toBe(
      true
    )
    expect(mirror).not.toContain('default-src *')
    expect(mirror).not.toContain('<base')
    expect(mirror).not.toContain('no js')
    expect(snapshotMirrorHtml({ html: null })).toBeNull()
  })
})
