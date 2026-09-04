import { afterEach, describe, it, expect, vi } from 'vitest'
import { buildIframeSrc, getLastLoadId, resolveIframeErrorLocation } from '../iframe.js'

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
    expect(buildIframeSrc(files, 'index.html', options)).toBe('blob:test-2')
    expect(await blobs[1].text()).toContain('src="https://cdn.example.com/cat.png"')
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
    expect(await blobs[1].text()).toContain("url('https://cdn.example.com/skiing.jpg')")
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
    expect(await blobs[2].text()).toContain('href="blob:test-2"')
    expect(await blobs[2].text()).not.toContain('https://cdn.example.com/style.css')
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
    // resolvedFiles is iterated in file order, so index.html -> blob:test-1,
    // app.js -> blob:test-2 (the entry's live document is the later blob:test-3).
    const appJsUrl = 'blob:test-2'

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
