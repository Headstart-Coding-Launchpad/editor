// A Pages deploy replaces every file, so a tab opened before it would 404 on its lazy chunks,
// workers and wasm. Run after `vite build` (deploy.yml): copies the hashed assets of the last
// releases from the live site into dist/ and records what this release holds in
// dist/asset-manifest.json. Fail-safe: any problem is a warning and the deploy goes ahead.
//
//   node scripts/carry-assets.mjs <live site URL> [dist folder]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MANIFEST = 'asset-manifest.json'
const FORMAT = 1
// Earlier commits whose releases are kept. Each release lists only the files its own build made,
// so a file drops off the site once its release leaves this window.
const KEEP_COMMITS = 2
// Re-deploys of one commit rename chunks without using up a commit, so releases are capped too.
const MAX_PREVIOUS = 5
const ATTEMPTS = 3
const RETRY_MS = 2000
const MAX_FILES_PER_RELEASE = 5000
const MAX_BYTES = 300 * 1024 * 1024
const BUDGET_MS = 120_000
const FILE_TIMEOUT_MS = 20_000
const PARALLEL = 8

// Plain relative paths under assets/: no segment starts with a dot, so no traversal, and no
// backslash, percent escape, query or scheme.
const SAFE_PATH = /^assets(\/[\w@~+-][\w.@~+-]*)+$/
const isSafe = (file) => typeof file === 'string' && SAFE_PATH.test(file)

function listFiles(distDir, folder) {
  return readdirSync(path.join(distDir, folder), { withFileTypes: true }).flatMap((entry) => {
    const file = `${folder}/${entry.name}`
    return entry.isDirectory() ? listFiles(distDir, file) : [file]
  })
}

function describeBuild(source) {
  const { version, build, commit, builtAt } = source ?? {}
  return { version, build, commit, builtAt }
}

function readBuildInfo(distDir) {
  try {
    return describeBuild(JSON.parse(readFileSync(path.join(distDir, 'version.json'), 'utf8')))
  } catch {
    return {}
  }
}

// Retries network errors, server errors and "slow down" replies; a 404 and the like will not change.
async function download(fetchImpl, url, retryMs, deadline = Infinity) {
  for (let attempt = 1; ; attempt += 1) {
    let status
    try {
      const response = await fetchImpl(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
      })
      status = response.status
      if (!response.ok) throw new Error(`HTTP ${status}`)
      const type = response.headers.get('content-type') ?? ''
      return { type, body: Buffer.from(await response.arrayBuffer()) }
    } catch (error) {
      const final = status >= 400 && status < 500 && status !== 408 && status !== 429
      if (final || attempt === ATTEMPTS || Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, retryMs))
    }
  }
}

// Newest first: releases from up to KEEP_COMMITS commits other than the one being built.
function withinWindow(releases, commit) {
  const earlier = new Set()
  return releases
    .filter((release) => {
      if (release.commit !== commit) earlier.add(release.commit)
      return earlier.size <= KEEP_COMMITS
    })
    .slice(0, MAX_PREVIOUS)
}

async function previousReleases(fetchImpl, siteUrl, commit, retryMs, warn) {
  // The query skips the CDN's ten-minute copy of the manifest.
  const url = new URL(`${MANIFEST}?t=${Date.now()}`, siteUrl)
  const live = JSON.parse((await download(fetchImpl, url, retryMs)).body.toString('utf8'))
  if (live?.format !== FORMAT || !Array.isArray(live.releases)) {
    throw new Error('unrecognised format')
  }
  let rejected = 0
  const releases = live.releases.flatMap((release) => {
    const listed = release?.files
    if (!Array.isArray(listed) || listed.length > MAX_FILES_PER_RELEASE) {
      rejected += 1
      return []
    }
    const files = listed.filter(isSafe)
    rejected += listed.length - files.length
    return files.length ? [{ ...describeBuild(release), files }] : []
  })
  if (rejected) warn(`ignored ${rejected} odd entries in the live ${MANIFEST}`)
  return withinWindow(releases, commit)
}

export async function carryAssets({
  distDir,
  siteUrl,
  fetchImpl = fetch,
  warn = (message) => console.log(`::warning::carry-assets: ${message}`),
  budgetMs = BUDGET_MS,
  maxBytes = MAX_BYTES,
  retryMs = RETRY_MS,
}) {
  const result = { carried: 0 }
  let own
  try {
    own = listFiles(distDir, 'assets').filter(isSafe).sort()
  } catch (error) {
    warn(`no build to add to (${error.message})`)
    return result
  }
  const current = { ...readBuildInfo(distDir), files: own }
  const writeManifest = (releases) =>
    writeFileSync(path.join(distDir, MANIFEST), JSON.stringify({ format: FORMAT, releases }))
  // Written before any fetching, so even a run cut short publishes a manifest.
  writeManifest([current])

  let previous
  try {
    previous = await previousReleases(fetchImpl, siteUrl, current.commit, retryMs, warn)
  } catch (error) {
    warn(`no old assets carried: could not read the live ${MANIFEST} (${error.message})`)
    return result
  }

  // Listed before downloading: if the step is killed, the next deploy still knows about them.
  writeManifest([current, ...previous])

  const deadline = Date.now() + budgetMs
  let bytes = 0
  const failed = []
  const carry = async (file) => {
    const target = path.join(distDir, file)
    // Already there: the new build made it, or a newer old release supplied it.
    if (existsSync(target)) return
    try {
      if (Date.now() > deadline) throw new Error('out of time')
      const url = new URL(file, siteUrl)
      const { type, body } = await download(fetchImpl, url, retryMs, deadline)
      if (type.includes('text/html') && !file.endsWith('.html')) throw new Error('got a web page')
      if (bytes + body.length > maxBytes) throw new Error('over the size limit')
      mkdirSync(path.dirname(target), { recursive: true })
      // 'wx' refuses to replace an existing file.
      writeFileSync(target, body, { flag: 'wx' })
      bytes += body.length
      result.carried += 1
    } catch (error) {
      failed.push(`${file} (${error.message})`)
    }
  }

  // Newest release first, so it wins if the time or size budget runs out.
  for (const release of previous) {
    for (let i = 0; i < release.files.length; i += PARALLEL) {
      await Promise.all(release.files.slice(i, i + PARALLEL).map(carry))
    }
  }
  if (failed.length) {
    warn(`${failed.length} old assets not carried, e.g. ${failed.slice(0, 3).join(', ')}`)
  }

  const published = previous
    .map((release) => ({
      ...release,
      files: release.files.filter((file) => existsSync(path.join(distDir, file))),
    }))
    .filter((release) => release.files.length)
  writeManifest([current, ...published])
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [siteUrl, distDir = 'dist'] = process.argv.slice(2)
  try {
    const { carried } = await carryAssets({ distDir, siteUrl: siteUrl?.replace(/\/?$/, '/') })
    console.log(`carry-assets: carried ${carried} files from earlier releases`)
  } catch (error) {
    console.log(`::warning::carry-assets failed, deploying without it (${error.message})`)
  }
}
