// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { versionJsonPlugin } from '../build-info.mjs'
import { carryAssets } from '../carry-assets.mjs'

const SITE = 'https://example.test/editor/'

let root
let dist
let warnings

function put(file, text) {
  const full = path.join(dist, file)
  mkdirSync(path.dirname(full), { recursive: true })
  writeFileSync(full, text)
}

const read = (file) => readFileSync(path.join(dist, file), 'utf8')
const manifest = () => JSON.parse(read('asset-manifest.json'))

// A fake live site: { 'asset-manifest.json': object, 'assets/x.js': 'text' | Response | Error }.
function site(files) {
  const requested = []
  const fetchImpl = async (url) => {
    const { pathname } = new URL(url)
    const file = pathname.replace('/editor/', '')
    requested.push(file)
    const body = files[file]
    if (body === undefined) return new Response('<html>404</html>', { status: 404 })
    if (body instanceof Error) throw body
    if (body instanceof Response) return body
    return new Response(typeof body === 'string' ? body : JSON.stringify(body))
  }
  return { fetchImpl, requested }
}

const release = (commit, files) => ({ commit, files })

function run(fetchImpl, options = {}) {
  return carryAssets({
    distDir: dist,
    siteUrl: SITE,
    fetchImpl,
    warn: (message) => warnings.push(message),
    ...options,
  })
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'carry-assets-'))
  dist = path.join(root, 'dist')
  warnings = []
  put('version.json', JSON.stringify({ version: '1.0', build: 12, commit: 'new' }))
  put('assets/index-new.js', 'new index')
  put('assets/vendor-same.js', 'new vendor')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('carryAssets', () => {
  it('copies the previous release’s hashed files, workers and wasm included', async () => {
    const files = ['assets/index-old.js', 'assets/py.worker-old.js', 'assets/lib-old.wasm']
    const { fetchImpl } = site({
      'asset-manifest.json': { format: 1, releases: [release('old', files)] },
      'assets/index-old.js': 'old index',
      'assets/py.worker-old.js': 'old worker',
      'assets/lib-old.wasm': 'old wasm',
    })
    await run(fetchImpl)
    expect(read('assets/index-old.js')).toBe('old index')
    expect(read('assets/py.worker-old.js')).toBe('old worker')
    expect(read('assets/lib-old.wasm')).toBe('old wasm')
    expect(manifest().releases).toEqual([
      {
        version: '1.0',
        build: 12,
        commit: 'new',
        files: ['assets/index-new.js', 'assets/vendor-same.js'],
      },
      release('old', files),
    ])
    expect(warnings).toEqual([])
  })

  it('never overwrites a file the new build made', async () => {
    const { fetchImpl, requested } = site({
      'asset-manifest.json': { format: 1, releases: [release('old', ['assets/vendor-same.js'])] },
      'assets/vendor-same.js': 'old vendor',
    })
    await run(fetchImpl)
    expect(read('assets/vendor-same.js')).toBe('new vendor')
    expect(requested).toEqual(['asset-manifest.json'])
  })

  it('keeps two previous releases, so a carried file is not carried for ever', async () => {
    const { fetchImpl, requested } = site({
      'asset-manifest.json': {
        format: 1,
        releases: ['c', 'b', 'a'].map((id) => release(id, [`assets/${id}.js`])),
      },
      'assets/c.js': 'c',
      'assets/b.js': 'b',
      'assets/a.js': 'a',
    })
    await run(fetchImpl)
    expect(manifest().releases.map((r) => r.commit)).toEqual(['new', 'c', 'b'])
    expect(requested).not.toContain('assets/a.js')
    expect(existsSync(path.join(dist, 'assets/a.js'))).toBe(false)
  })

  it('does not spend a history slot on a re-deploy of identical files', async () => {
    const same = release('new', ['assets/vendor-same.js', 'assets/index-new.js'])
    const { fetchImpl } = site({
      'asset-manifest.json': {
        format: 1,
        releases: [same, release('b', ['assets/b.js']), release('a', ['assets/a.js'])],
      },
      'assets/b.js': 'b',
      'assets/a.js': 'a',
    })
    await run(fetchImpl)
    expect(manifest().releases.map((r) => r.commit)).toEqual(['new', 'b', 'a'])
  })

  it.each([
    ['missing (first deploy)', undefined],
    ['unreachable', new Error('ENOTFOUND')],
    ['not JSON', '<html>hello</html>'],
    ['an unknown format', { format: 99, releases: [release('old', ['assets/old.js'])] }],
    ['not a list of releases', { format: 1, releases: 'nope' }],
    ['null', 'null'],
  ])('deploys as before, with a warning, when the live manifest is %s', async (_, body) => {
    const { fetchImpl } = site({ 'asset-manifest.json': body })
    await expect(run(fetchImpl)).resolves.toMatchObject({ carried: 0 })
    expect(warnings).toHaveLength(1)
    expect(manifest().releases.map((r) => r.commit)).toEqual(['new'])
  })

  it('accepts only plain relative paths under assets/', async () => {
    const bad = [
      'index.html',
      'assets/../index.html',
      'assets/..',
      '../outside.js',
      '/assets/abs.js',
      'assets\\win.js',
      'assets/%2e%2e/enc.js',
      'assets/q.js?x=1',
      'https://evil.test/assets/x.js',
      'assets//double.js',
      42,
      null,
    ]
    const { fetchImpl, requested } = site({
      'asset-manifest.json': {
        format: 1,
        releases: [release('old', [...bad, 'assets/ok.js']), null, { commit: 'x' }],
      },
      'assets/ok.js': 'ok',
    })
    await run(fetchImpl)
    expect(requested).toEqual(['asset-manifest.json', 'assets/ok.js'])
    expect(existsSync(path.join(root, 'outside.js'))).toBe(false)
    expect(manifest().releases[1].files).toEqual(['assets/ok.js'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('skips a file it cannot fetch and carries the rest', async () => {
    const files = ['assets/gone.js', 'assets/broken.js', 'assets/page.js', 'assets/ok.js']
    const { fetchImpl } = site({
      'asset-manifest.json': { format: 1, releases: [release('old', files)] },
      'assets/broken.js': new Error('reset'),
      'assets/page.js': new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
      'assets/ok.js': 'ok',
    })
    await expect(run(fetchImpl)).resolves.toMatchObject({ carried: 1 })
    expect(existsSync(path.join(dist, 'assets/page.js'))).toBe(false)
    expect(manifest().releases[1].files).toEqual(['assets/ok.js'])
    expect(warnings).toHaveLength(1)
  })

  it('stops fetching when the time budget is spent', async () => {
    const { fetchImpl, requested } = site({
      'asset-manifest.json': { format: 1, releases: [release('old', ['assets/old.js'])] },
      'assets/old.js': 'old',
    })
    await run(fetchImpl, { budgetMs: -1 })
    expect(requested).toEqual(['asset-manifest.json'])
    expect(warnings).toHaveLength(1)
  })

  it('stops carrying past the size limit', async () => {
    const { fetchImpl } = site({
      'asset-manifest.json': { format: 1, releases: [release('old', ['assets/big.js'])] },
      'assets/big.js': 'far too big',
    })
    await expect(run(fetchImpl, { maxBytes: 3 })).resolves.toMatchObject({ carried: 0 })
    expect(existsSync(path.join(dist, 'assets/big.js'))).toBe(false)
  })

  it('does nothing but warn when there is no build to add to', async () => {
    const { fetchImpl, requested } = site({})
    await run(fetchImpl, { distDir: path.join(root, 'nowhere') })
    expect(requested).toEqual([])
    expect(warnings).toHaveLength(1)
  })
})

describe('versionJsonPlugin', () => {
  it('publishes the same build info the bundle carries as version.json', () => {
    const info = { version: '1.0', build: 3, commit: 'abc', builtAt: 'now' }
    const plugin = versionJsonPlugin(info)
    const emitted = []
    plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) })
    expect(plugin.apply).toBe('build')
    expect(emitted).toEqual([
      { type: 'asset', fileName: 'version.json', source: JSON.stringify(info) },
    ])
  })
})
