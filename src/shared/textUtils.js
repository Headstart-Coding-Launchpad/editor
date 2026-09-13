// Small string helpers shared across modules.

/** Escapes a value for literal use inside a RegExp. */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Cheap deterministic 32-bit hash — used for stable ids and shuffle seeds, not security. */
export function stableHash(str) {
  const text = String(str ?? '')
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return h
}

/** True for plain objects (excludes null and arrays). */
export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** Lowercased extension of a filename, without the dot. '' when there is none. */
export function fileExtension(filename) {
  const name = String(filename ?? '')
  const dot = name.lastIndexOf('.')
  return dot !== -1 ? name.slice(dot + 1).toLowerCase() : ''
}
