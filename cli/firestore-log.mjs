import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Always-on, one line per Firestore read: time, command, collection path, doc count, approx bytes.
// Never logs document contents; never throws (a log failure must not change CLI behaviour).
const here = dirname(fileURLToPath(import.meta.url))

export function firestoreLogPath() {
  return process.env.HSC_FIRESTORE_LOG || join(here, '..', 'logs', 'firestore-calls.log')
}

export function approxBytes(docs) {
  let total = 0
  for (const doc of docs) {
    try {
      total += JSON.stringify(doc.data() ?? null).length
    } catch {
      // unserialisable data: skip it
    }
  }
  return total
}

export function logFirestoreRead(path, snap) {
  try {
    const docs = Array.isArray(snap?.docs) ? snap.docs : snap?.exists ? [snap] : []
    const command = process.argv.slice(2, 4).join(' ')
    const line = `${new Date().toISOString()}\t${command}\t${path}\t${docs.length}\t${approxBytes(docs)}\n`
    const file = firestoreLogPath()
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, line)
  } catch {
    // swallowed on purpose
  }
}

function wrapGet(proto) {
  const original = proto.get
  proto.get = async function get(...args) {
    const snap = await original.apply(this, args)
    logFirestoreRead(this.path ?? this._queryOptions?.collectionId ?? '?', snap)
    return snap
  }
}

// Patches doc.get() and query/collection.get() for the given firestore instance.
export function installFirestoreLog(db) {
  try {
    wrapGet(Object.getPrototypeOf(db.doc('_log/_log')))
    let proto = Object.getPrototypeOf(db.collection('_log'))
    while (proto && !Object.hasOwn(proto, 'get')) proto = Object.getPrototypeOf(proto)
    if (proto) wrapGet(proto)
  } catch {
    // logging unavailable: CLI carries on unchanged
  }
}
