// The teacher-sandbox archive (docs/architecture/live-badges-plan.md, "Sandboxes"): what the
// class did in each teacher sandbox visit, kept at the top-level RTDB node
// `sessionArchive/{lessonId}` so the session report can show it as a possible lesson gap. The
// writers live in src/app/hooks/useSession.js; this file builds and reads the values. Pure and
// Node-safe.
//
// Stored shape (keys are RTDB-safe; file names go through encodeFileKey):
//   sessionArchive/{lessonId}/visits/{visitId}   visitId = String(enteredAt)
//     { enteredAt, exitedAt, previousTaskId, explainer,
//       pushes: { [pushId]: { at, code } | { at, files } | { at, explainer } },
//       studentSnapshots: { [anonymousId]: { at, code } | { at, files } } }
// Any `code`, file content or explainer over ARCHIVE_ENTRY_MAX_BYTES is cut short and ends with
// ARCHIVE_TRUNCATION_MARKER; the entry then carries `truncated: true`.
import { decodeFileKey, encodeFileKey } from '../shared/fileKeys.js'

/** The size cap for one push or one student snapshot (UTF-8 bytes). */
export const ARCHIVE_ENTRY_MAX_BYTES = 20 * 1024

/** Appended to anything cut short by the size cap. */
export const ARCHIVE_TRUNCATION_MARKER = '\n… [truncated: over 20 KB]'

const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null

/** A string's size in UTF-8 bytes. */
export function utf8Bytes(text) {
  const value = String(text ?? '')
  return encoder ? encoder.encode(value).length : value.length
}

// The longest prefix of `text` that fits in `budget` bytes (binary search on code points, so a
// multi-byte character is never split).
function fitToBytes(text, budget) {
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (utf8Bytes(chars.slice(0, mid).join('')) <= budget) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('')
}

/**
 * `text` within `maxBytes`: unchanged when it fits, else cut short with the truncation marker
 * (the marker counts toward the cap). Returns `{ text, truncated }`.
 */
export function capArchiveText(text, maxBytes = ARCHIVE_ENTRY_MAX_BYTES) {
  const value = String(text ?? '')
  if (utf8Bytes(value) <= maxBytes) return { text: value, truncated: false }
  const budget = Math.max(0, maxBytes - utf8Bytes(ARCHIVE_TRUNCATION_MARKER))
  return { text: fitToBytes(value, budget) + ARCHIVE_TRUNCATION_MARKER, truncated: true }
}

function toFileMap(files) {
  if (Array.isArray(files)) return Object.fromEntries(files.map((f) => [f.name, f.content]))
  return files && typeof files === 'object' ? files : {}
}

/**
 * The work fields one archive entry stores: `{ code }` or `{ files }` (a filename → content map
 * with encoded keys), capped to `maxBytes` in total, plus `truncated: true` when cut. `files`
 * may be a map or an array of `{ name, content }`. Returns {} when there is no work.
 */
export function archiveWorkFields({ code, files } = {}, maxBytes = ARCHIVE_ENTRY_MAX_BYTES) {
  if (files != null) {
    let remaining = maxBytes
    let truncated = false
    const encoded = {}
    for (const [name, content] of Object.entries(toFileMap(files))) {
      const nameBytes = utf8Bytes(name)
      const capped = capArchiveText(content, Math.max(0, remaining - nameBytes))
      encoded[encodeFileKey(name)] = capped.text
      remaining = Math.max(0, remaining - nameBytes - utf8Bytes(capped.text))
      truncated = truncated || capped.truncated
    }
    return { files: encoded, ...(truncated ? { truncated: true } : {}) }
  }
  if (code != null) {
    const capped = capArchiveText(code, maxBytes)
    return { code: capped.text, ...(capped.truncated ? { truncated: true } : {}) }
  }
  return {}
}

/** An explainer as stored in an archive push: capped like code. */
export function archiveExplainerFields(explainer, maxBytes = ARCHIVE_ENTRY_MAX_BYTES) {
  const capped = capArchiveText(explainer ?? '', maxBytes)
  return { explainer: capped.text, ...(capped.truncated ? { truncated: true } : {}) }
}

function decodeWork(entry) {
  if (!entry || typeof entry !== 'object') return entry ?? null
  if (entry.files == null) return { ...entry }
  return {
    ...entry,
    files: Object.fromEntries(
      Object.entries(entry.files).map(([key, content]) => [decodeFileKey(key), content])
    ),
  }
}

const byAt = (a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)

/**
 * The archive as the session report reads it: `{ visits: [...] }`, visits oldest first, each
 * `{ visitId, enteredAt, exitedAt, durationMs, previousTaskId, explainer, pushes: [...],
 * studentSnapshots: { [anonymousId]: {...} } }` with pushes oldest first and file keys decoded.
 * A visit with no `exitedAt` (the session ended from the sandbox, or is still in it) takes
 * `endedAt`. Returns `{ visits: [] }` for an empty archive.
 */
export function normaliseSessionArchive(raw, { endedAt = null } = {}) {
  const visits = Object.entries(raw?.visits ?? {})
    .filter(([, visit]) => visit && typeof visit === 'object')
    .map(([visitId, visit]) => {
      const enteredAt = Number(visit.enteredAt) || Number(visitId) || null
      const exitedAt = visit.exitedAt ?? endedAt ?? null
      return {
        visitId,
        enteredAt,
        exitedAt,
        durationMs:
          enteredAt != null && exitedAt != null ? Math.max(0, exitedAt - enteredAt) : null,
        previousTaskId: visit.previousTaskId ?? null,
        explainer: visit.explainer ?? null,
        pushes: Object.values(visit.pushes ?? {})
          .filter(Boolean)
          .map(decodeWork)
          .sort(byAt),
        studentSnapshots: Object.fromEntries(
          Object.entries(visit.studentSnapshots ?? {}).map(([id, snap]) => [id, decodeWork(snap)])
        ),
      }
    })
    .sort((a, b) => (a.enteredAt ?? 0) - (b.enteredAt ?? 0))
  return { visits }
}
