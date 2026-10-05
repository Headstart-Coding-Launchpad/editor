// Firestore's nesting limit, measured the way the SDKs and the server enforce it. Pure and
// Node-safe (used by the shared lesson validator, so both the Builder and the CLI report it).
//
// Firestore documents "Maximum depth of fields in a map or array: 20 — map and array fields
// add one level". The Node Admin SDK (used by the CLI) rejects a write with "Input object is
// deeper than 20 levels" when any value's field path, counted from the document root with
// array indices as segments, has more than 21 segments; the server rejects one whose maps /
// arrays nest more than 20 deep ("Message too deep"). Both reduce to one conservative rule:
// a map or array value may sit at most 20 field-path segments below the root. So `{ a: { b: 1 } }`
// has depth 1 (`a`), and `tasks[0].prebuiltStacks[0].stack` is a map at depth 5.

export const FIRESTORE_MAX_DEPTH = 20

const isContainer = (value) =>
  Array.isArray(value) ||
  (value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))

/**
 * The deepest map/array inside a document: `{ depth, path }`, where `depth` is the number of
 * field-path segments from the document root to that map/array and `path` its segments
 * (strings for map keys, numbers for array indices). `{ depth: 0, path: [] }` for a document
 * whose fields hold no maps or arrays. Iterative, so a pathological input can't overflow the stack.
 */
export function measureFirestoreDepth(doc) {
  let deepest = { depth: 0, path: [] }
  if (!isContainer(doc)) return deepest
  const stack = [{ value: doc, path: [] }]
  while (stack.length > 0) {
    const { value, path } = stack.pop()
    const entries = Array.isArray(value)
      ? value.map((child, index) => [index, child])
      : Object.entries(value)
    for (const [key, child] of entries) {
      if (!isContainer(child)) continue
      const childPath = [...path, key]
      if (childPath.length > deepest.depth) deepest = { depth: childPath.length, path: childPath }
      // Far past the limit is enough to report; stop rather than walk an absurd (or cyclic) tree.
      if (childPath.length <= FIRESTORE_MAX_DEPTH * 10)
        stack.push({ value: child, path: childPath })
    }
  }
  return deepest
}

/**
 * A field path as an author reads it: `tasks[14].prebuiltStacks[0].stack.next.block…`. Runs of
 * a repeated `.next.block` (one stacked Scratch block each) are shortened to `(.next.block ×N)`.
 */
export function formatFirestorePath(path) {
  const text = path
    .map((segment, i) =>
      typeof segment === 'number'
        ? `[${segment}]`
        : /^[A-Za-z_$][\w$]*$/.test(segment)
          ? `${i === 0 ? '' : '.'}${segment}`
          : `[${JSON.stringify(segment)}]`
    )
    .join('')
  return text.replace(/(?:\.next\.block){3,}/g, (run) => `(.next.block ×${run.length / 11})`)
}
