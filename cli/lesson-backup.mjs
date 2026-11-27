// `lessons backup`: keep a versioned copy of every lesson doc on a local drive (Ryan, 26 Nov).
// Read-only on Firebase. Each night: one field-limited list per collection (ids + update
// times only), then a full read of just the docs whose update time moved. A doc is saved only
// when its content differs from its last saved copy. Nothing saved is ever overwritten or
// deleted. Restore is manual (docs/authoring/lesson-backup-cli.md). Node built-ins only, so
// the module runs from any checkout; the Firestore handle is passed in.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, open, readFile, readdir, rename, stat } from 'node:fs/promises'
import { dirname, join, parse, resolve, win32 } from 'node:path'

export const DEFAULT_BACKUP_DIR = 'D:\\LaunchPad-backups\\lessons'

// Every doc a lesson needs to be put back: the lesson itself (drafts, Solo Challenges and
// class forks are all docs in `lessons`), the level it points at, the topic library its
// topics are checked against, and the lesson-type shared assets / default sprites docs.
export const BACKUP_COLLECTIONS = ['lessons', 'lessonLevels', 'topicLibrary', 'lessonTypeAssets']

const INDEX_FILE = 'index.json'
const FETCH_POOL = 8

export function checkBackupRoot(out, exists = existsSync) {
  // A drive-letter path is read the Windows way on any machine (CI runs on Linux).
  const root = /^[a-z]:[\/]/i.test(out) ? win32.parse(out).root : parse(resolve(out)).root
  if (!exists(root)) {
    throw new Error(`Backup drive ${root} not found: plug it in or pass --out <folder>`)
  }
}

const isPlainObject = (value) => {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// Firestore values JSON cannot hold, tagged so a restore can rebuild them. Plain objects are
// always maps (recursed, never guessed at); only SDK class instances are tagged.
export function toBackupJson(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { __firestore: 'number', value: String(value) }
  }
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toBackupJson)
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toBackupJson(v)]))
  }
  if (typeof value.toDate === 'function' && 'seconds' in value && 'nanoseconds' in value) {
    return { __firestore: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (typeof value.path === 'string' && 'firestore' in value) {
    return { __firestore: 'reference', path: value.path }
  }
  if (value instanceof Uint8Array) {
    return { __firestore: 'bytes', base64: Buffer.from(value).toString('base64') }
  }
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { __firestore: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  throw new Error(`unknown Firestore value type ${value.constructor?.name ?? '?'}`)
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

// A folder name for a doc id that is safe on Windows: anything but A-Z a-z 0-9 . _ - becomes
// %XX, as do a trailing dot and the first letter of a reserved device name.
export function safeFileName(id) {
  let name = String(id).replace(/[^A-Za-z0-9._-]/g, (ch) =>
    [...Buffer.from(ch)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('')
  )
  if (name.endsWith('.')) name = `${name.slice(0, -1)}%2E`
  if (RESERVED.test(name)) name = `%${name.charCodeAt(0).toString(16)}${name.slice(1)}`
  return name
}

// Update time as a sortable ISO string with nanoseconds (null when the SDK gives none).
function updateTimeOf(snap) {
  const t = snap?.updateTime
  if (!t) return null
  if (typeof t.seconds === 'number') {
    const iso = new Date(t.seconds * 1000).toISOString().slice(0, 19)
    return `${iso}.${String(t.nanoseconds ?? 0).padStart(9, '0')}Z`
  }
  return String(t)
}

// Temp file, flushed to disk, then renamed over the target.
async function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(text, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(tmp, file)
}

async function hasContent(path) {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

async function loadIndex(out) {
  const file = join(out, INDEX_FILE)
  if (!existsSync(file)) return { format: 1, docs: {} }
  try {
    const index = JSON.parse(await readFile(file, 'utf8'))
    if (!index || typeof index.docs !== 'object') throw new Error('no docs map')
    return index
  } catch (e) {
    throw new Error(`Cannot read ${file} (${e.message}); fix or move it, nothing was changed`)
  }
}

async function folderBytes(path) {
  try {
    const info = await stat(path)
    if (!info.isDirectory()) return info.size
    let total = 0
    for (const name of await readdir(path)) total += await folderBytes(join(path, name))
    return total
  } catch {
    return 0 // sizing is a report, never a reason to fail
  }
}

// Bytes of the backup's own files only: the collection folders and the index.
async function backupBytes(out) {
  const parts = [...BACKUP_COLLECTIONS, INDEX_FILE, `${INDEX_FILE}.bak`]
  const sizes = await Promise.all(parts.map((p) => folderBytes(join(out, p))))
  return sizes.reduce((a, b) => a + b, 0)
}

async function pool(items, size, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

function prepareVersion({ collection, id, updateTime, data, savedAt }) {
  const json = toBackupJson(data)
  const hash = createHash('sha256').update(stableStringify(json)).digest('hex')
  // Named from the doc's own update time and content hash, so a rerun after an interruption
  // lands on the same name and finds it already there.
  const stamp = (updateTime ?? savedAt).replace(/:/g, '-')
  const file = `${collection}/${safeFileName(id)}/${stamp}_${hash.slice(0, 12)}.json`
  const text = `${JSON.stringify({ collection, id, updateTime, savedAt, hash, data: json }, null, 2)}\n`
  return { file, hash, text }
}

// Writes the version file unless a non-empty one is already there; true when it wrote one.
async function writeVersion(out, { file, text }) {
  const path = join(out, file)
  await mkdir(dirname(path), { recursive: true })
  if (await hasContent(path)) return false
  await writeAtomic(path, text)
  return true
}

/**
 * Copies every changed doc of BACKUP_COLLECTIONS into `out`. Returns a summary with read
 * counts; throws (after saving the index) if any doc could not be read or saved.
 */
export async function runLessonBackup({ db, out = DEFAULT_BACKUP_DIR, log = () => {} }) {
  checkBackupRoot(out)
  await mkdir(out, { recursive: true })
  const index = await loadIndex(out)
  // The previous run's index, kept in case this run's index is ever damaged.
  if (existsSync(join(out, INDEX_FILE))) {
    await copyFile(join(out, INDEX_FILE), join(out, `${INDEX_FILE}.bak`))
  }
  const savedAt = new Date().toISOString()
  const reads = { list: 0, fetch: 0, total: 0 }
  const summary = { saved: 0, unchanged: 0, markedDeleted: 0, collections: {} }
  const errors = []

  for (const collection of BACKUP_COLLECTIONS) {
    const known = (index.docs[collection] ??= {})
    const counts = { docs: 0, fetched: 0, saved: 0, deleted: 0 }
    summary.collections[collection] = counts
    let listing
    try {
      // select() with no fields: ids and update times only, no document bodies.
      listing = await db.collection(collection).select().get()
    } catch (e) {
      errors.push(`${collection}: list failed: ${e.message}`)
      continue
    }
    reads.list += Math.max(1, listing.docs.length) // a query costs at least one read
    counts.docs = listing.docs.length
    const present = new Set()
    const toFetch = []
    for (const doc of listing.docs) {
      present.add(doc.id)
      const entry = known[doc.id]
      const time = updateTimeOf(doc)
      const last = entry?.versions?.at(-1)
      const current = entry && !entry.deletedAt && time != null && entry.updateTime === time && last
      // A matching update time is trusted only while its saved copy is still there.
      if (current && (await hasContent(join(out, last.file)))) summary.unchanged += 1
      else toFetch.push(doc.id)
    }

    await pool(toFetch, FETCH_POOL, async (id) => {
      try {
        reads.fetch += 1
        counts.fetched += 1
        const snap = await db.collection(collection).doc(id).get()
        if (!snap.exists) return // deleted between list and fetch: picked up next night
        const updateTime = updateTimeOf(snap)
        const version = prepareVersion({ collection, id, updateTime, data: snap.data(), savedAt })
        const entry = known[id] ?? { versions: [] }
        const last = entry.versions.at(-1)
        if (last?.hash === version.hash && !(await hasContent(join(out, last.file)))) {
          // Same content as the indexed copy, but that file is gone or empty: write it again.
          await writeVersion(out, { ...version, file: last.file })
          summary.saved += 1
          counts.saved += 1
          log(`re-saved missing copy ${collection}/${id}`)
        } else if (last?.hash !== version.hash) {
          if (await writeVersion(out, version)) {
            summary.saved += 1
            counts.saved += 1
            log(`saved ${collection}/${id}`)
          }
          entry.versions.push({ file: version.file, hash: version.hash, updateTime, savedAt })
          entry.hash = version.hash
        } else {
          summary.unchanged += 1
        }
        entry.updateTime = updateTime
        delete entry.deletedAt
        known[id] = entry
      } catch (e) {
        errors.push(`${collection}/${id}: ${e.message}`)
      }
    })

    for (const [id, entry] of Object.entries(known)) {
      if (!present.has(id) && !entry.deletedAt) {
        entry.deletedAt = savedAt
        summary.markedDeleted += 1
        counts.deleted += 1
        log(`gone from Firestore (copies kept): ${collection}/${id}`)
      }
    }
    // Saved after each collection so an interruption loses at most one collection's index.
    await writeAtomic(join(out, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`)
  }

  reads.total = reads.list + reads.fetch
  index.lastRun = { at: savedAt, reads, ...summary, errors: errors.length }
  await writeAtomic(join(out, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`)
  const result = { out: resolve(out), reads, ...summary, backupBytes: await backupBytes(out) }
  if (errors.length) {
    const error = new Error(
      `Backup incomplete: saved ${summary.saved}, reads ${reads.total} (list ${reads.list}, ` +
        `fetch ${reads.fetch}), ${errors.length} problem(s); saved copies kept:\n  ` +
        errors.join('\n  ')
    )
    error.result = { ...result, errors }
    throw error
  }
  return result
}
