#!/usr/bin/env node
// Hub P24: copies every Firestore document, subcollections included, from one database to
// another in the same project, with the same ids and the same Timestamps, then checks that
// each collection has the same count and checksum on both sides.
// See docs/architecture/firestore-europe-plan.md (Runbook).
//
//   node scripts/firestore-copy.mjs                          # dry run: counts (default)
//   node scripts/firestore-copy.mjs --to eu                  # compare (default) with eu
//   node scripts/firestore-copy.mjs --to eu --apply          # copy (default) → eu, then compare
//   node scripts/firestore-copy.mjs --from eu --to "(default)" --since 2026-10-27T09:00 --apply
//                                                            # rollback: copy back what changed
//
// It never deletes. Uses the CLI service account (cli/.env).

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '..')
const cliDir = join(repo, 'cli')
const require = createRequire(join(cliDir, 'package.json'))
require('dotenv').config({ path: join(cliDir, '.env') })
const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (creds && !/^[A-Za-z]:|^\//.test(creds))
  process.env.GOOGLE_APPLICATION_CREDENTIALS = join(cliDir, creds)

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, Timestamp, GeoPoint, DocumentReference } = require('firebase-admin/firestore')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}
const FROM = arg('from', '(default)')
const TO = arg('to', null)
const SINCE = arg('since', null)
const apply = process.argv.includes('--apply')
if (apply && !TO) throw new Error('--apply needs --to <database id>')
if (TO === FROM) throw new Error('--from and --to are the same database')

const rc = JSON.parse(readFileSync(join(repo, '.firebaserc'), 'utf8'))
const app = initializeApp({ projectId: rc.projects.default, credential: applicationDefault() })
const src = getFirestore(app, FROM)
const dst = TO ? getFirestore(app, TO) : null

// Stable text for a value, so the same document hashes the same in both databases.
function stable(v) {
  if (v instanceof Timestamp) return `ts:${v.seconds}.${v.nanoseconds}`
  if (v instanceof DocumentReference) return `ref:${v.path}`
  if (v instanceof GeoPoint) return `geo:${v.latitude},${v.longitude}`
  if (Buffer.isBuffer(v)) return `bytes:${v.toString('base64')}`
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

// References point at the source database; rewrite them to the same path in the target.
function retarget(v) {
  if (v instanceof DocumentReference) return dst.doc(v.path)
  if (Array.isArray(v)) return v.map(retarget)
  if (v && typeof v === 'object' && v.constructor === Object)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, retarget(x)]))
  return v
}

// Walks every collection under `parent` (a database or a document), depth first.
// Returns { [collectionPath]: { count, hash } } for the database `db`.
async function summarise(db, parent = db, out = {}) {
  for (const col of await parent.listCollections()) {
    const snap = await col.get()
    const hash = createHash('sha256')
    for (const doc of [...snap.docs].sort((a, b) => a.id.localeCompare(b.id))) {
      hash.update(`${doc.id}=${stable(doc.data())}\n`)
    }
    const key = col.path.replace(/\/[^/]+\/([^/]+)$/, '/*/$1')
    const prev = out[key] ?? { count: 0, parts: [] }
    out[key] = {
      count: prev.count + snap.size,
      parts: [...prev.parts, `${col.path}:${hash.digest('hex')}`],
    }
    // listDocuments() also returns ids with no document but with subcollections under them
    // (for example session reports under a deleted lesson); get() skips those.
    for (const ref of await col.listDocuments()) await summarise(db, ref, out)
  }
  return out
}

function finish(summary) {
  return Object.fromEntries(
    Object.entries(summary)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, { count, parts }]) => [
        k,
        {
          count,
          hash: createHash('sha256').update(parts.sort().join('\n')).digest('hex').slice(0, 12),
        },
      ])
  )
}

// Copies every document under `parent` in src to the same path in dst.
async function copy(parent = src) {
  let written = 0
  const sinceMs = SINCE ? Date.parse(SINCE) : null
  let batch = dst.batch()
  let inBatch = 0
  for (const col of await parent.listCollections()) {
    const snap = await col.get()
    for (const doc of snap.docs) {
      if (sinceMs == null || doc.updateTime.toMillis() >= sinceMs) {
        batch.set(dst.doc(doc.ref.path), retarget(doc.data()))
        written += 1
        inBatch += 1
        if (inBatch === 400) {
          await batch.commit()
          batch = dst.batch()
          inBatch = 0
        }
      }
    }
    await batch.commit()
    batch = dst.batch()
    inBatch = 0
    for (const ref of await col.listDocuments()) written += await copy(ref)
  }
  return written
}

if (apply) {
  const n = await copy()
  console.log(
    `Copied ${n} documents from ${FROM} to ${TO}${SINCE ? ` (changed since ${SINCE})` : ''}.`
  )
}

const a = finish(await summarise(src))
const b = dst ? finish(await summarise(dst)) : null
let mismatches = 0
console.log(
  `\n${'collection'.padEnd(40)} ${FROM.padStart(14)}${b ? ` ${TO.padStart(14)}  match` : ''}`
)
for (const key of [...new Set([...Object.keys(a), ...Object.keys(b ?? {})])].sort()) {
  const x = a[key]
  const y = b?.[key]
  const same = b ? x?.count === y?.count && x?.hash === y?.hash : true
  if (!same) mismatches += 1
  console.log(
    `${key.padEnd(40)} ${String(x?.count ?? 0).padStart(14)}${
      b ? ` ${String(y?.count ?? 0).padStart(14)}  ${same ? 'yes' : 'NO'}` : ''
    }`
  )
}
const total = Object.values(a).reduce((s, { count }) => s + count, 0)
console.log(`\n${total} documents in ${FROM}.`)
if (b) {
  // After a --since rollback copy the target keeps older documents, so counts can differ there.
  console.log(mismatches ? `${mismatches} collection(s) differ.` : 'Every collection matches.')
  process.exitCode = mismatches && !SINCE ? 1 : 0
}
