// Zip assembly for "Export work": an HTML project's files, a Scratch .sb3 and the "everything"
// download. fflate (approved dependency, 2026-10-14) is loaded with a dynamic import() only when
// a zip is actually built, so it never lands in the main bundle.
import { uniqueFileName } from './naming.js'

/** A file's contents as bytes: strings are UTF-8 encoded, bytes pass through. */
export function toBytes(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  // TextEncoder can hand back another realm's Uint8Array (jsdom; a frame's encoder), which fflate
  // would take for a folder, so re-view its bytes as this realm's Uint8Array.
  const encoded = new TextEncoder().encode(String(data ?? ''))
  if (encoded instanceof Uint8Array) return encoded
  return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength)
}

/**
 * The fflate input for a list of `{ name, data }` files: `{ path: bytes }`. Paths are kept
 * relative (no leading slash, no `..`), and a repeated path gets a " (2)" suffix rather than
 * silently replacing the earlier file.
 */
export function toZipEntries(files) {
  const used = new Set()
  const entries = {}
  for (const file of files ?? []) {
    if (!file?.name) continue
    const clean = String(file.name)
      .replace(/\\/g, '/')
      .split('/')
      .filter((part) => part && part !== '.' && part !== '..')
      .join('/')
    if (!clean) continue
    entries[uniqueFileName(clean, used)] = toBytes(file.data)
  }
  return entries
}

/** Zips `{ name, data }` files into one Uint8Array (deflated unless `store`). */
export async function buildZip(files, { store = false } = {}) {
  const { zipSync } = await import('fflate')
  return zipSync(toZipEntries(files), { level: store ? 0 : 6 })
}
