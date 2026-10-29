// Per-tutor live sessions (#337, docs: HSC Hub Research "Per-tutor sessions design").
//
// Every Realtime Database node for a live class (sessions/{key}, liveInk/{key}, carryInbox/{key},
// peerHelp*/{key}, sessionArchive/{key}, sharedWorkspacePayloads/{key}) is keyed by the session
// key. Lesson content (Firestore lessons/{lessonId}, reports, feedback, URLs, localStorage) stays
// keyed by the real lesson id.
//
//   no tutor handle -> the key is the lesson id (every link posted before this existed)
//   a tutor handle  -> `${lessonId}~${handle}`
//
// `~` is allowed in Realtime Database keys (not `. $ # [ ] /`) and never appears in a lesson id.

export const SESSION_KEY_SEPARATOR = '~'

const HANDLE_PATTERN = /^[a-z0-9]{2,20}$/

/** A tutor handle as typed or read from a link: trimmed, lower case, or '' when not a handle. */
export function normaliseHandle(value) {
  const handle = String(value ?? '')
    .trim()
    .toLowerCase()
  return HANDLE_PATTERN.test(handle) ? handle : ''
}

/** The Realtime Database key of a live class: the lesson id, plus `~handle` for a tutor's own. */
export function sessionKeyOf(lessonId, handle) {
  const clean = normaliseHandle(handle)
  return clean && lessonId ? `${lessonId}${SESSION_KEY_SEPARATOR}${clean}` : lessonId
}

/** The real lesson id inside a session key. */
export function lessonIdOfKey(key) {
  const text = String(key ?? '')
  const at = text.indexOf(SESSION_KEY_SEPARATOR)
  return at < 0 ? text : text.slice(0, at)
}

/** The tutor handle inside a session key, or '' for a legacy key. */
export function handleOfKey(key) {
  const text = String(key ?? '')
  const at = text.indexOf(SESSION_KEY_SEPARATOR)
  return at < 0 ? '' : text.slice(at + 1)
}
