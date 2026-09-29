// Lesson answer sealing: OBFUSCATION, NOT SECURITY.
//
// `/lessons/{id}` is public-read (students are login-less), so every task's answers (complete
// code, code stages, completion / feedback checks, tests, quiz answers, code_arrange blanks)
// would otherwise be readable as plain JSON in the browser's Network tab or a raw Firestore
// payload. At the Firestore write boundary each task's answer-bearing fields move into one
// encoded string on the task:
//
//   task._sealed = 'v1:<base64>'   base64( UTF-8 JSON of { field: value } XOR SEAL_KEY )
//
// and the read boundary restores the exact original task shape. The key ships in the app
// bundle, so anyone determined can decode it (and React DevTools shows the decoded lesson):
// this only stops casual snooping. Tasks without `_sealed` pass through unchanged, so lessons
// saved before sealing keep working; they are sealed on their next save.
//
// Group tasks are never sealed themselves; their subtasks are. Activities add their own answer
// fields via `sealedFields` on their definition (src/activities/defineActivity.js).
//
// Pure and Node-safe: imported by the CLI through src/shared/lessonBlocksCodec.js.
import { getTaskActivity } from '../activities/registry.pure.js'

export const SEALED_FIELD = '_sealed'
export const SEAL_VERSION = 'v1'

// Fixed obfuscation key. Changing it breaks every sealed lesson: add a new version instead.
const SEAL_KEY = 'headstart-coding/lesson-seal/v1'

// Answer-bearing fields on any task. codeStages is sealed whole (starter stage included) so
// the stored stage list round-trips exactly; the starter is restored at load like the rest.
export const TASK_SEALED_FIELDS = Object.freeze([
  'codeStages',
  'completeCode',
  'completeFiles',
  'completeEntryFile',
  'completeBlocks',
  'completeFs',
  'completeDesktop',
  'completeCircuit',
  'completeArcadeDesign',
  'check',
  'feedbackChecks',
  'incorrectChecks',
  'tests',
])

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const KEY_BYTES = encoder.encode(SEAL_KEY)

function xorBytes(bytes) {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY_BYTES[i % KEY_BYTES.length]
  return out
}

function bytesToBase64(bytes) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function base64ToBytes(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// { field: value } -> 'v1:<base64>'
export function encodeSealPayload(payload) {
  const bytes = xorBytes(encoder.encode(JSON.stringify(payload)))
  return `${SEAL_VERSION}:${bytesToBase64(bytes)}`
}

// 'v1:<base64>' -> { field: value }, or null when the string is not a payload this build reads.
export function decodeSealPayload(sealed) {
  if (typeof sealed !== 'string') return null
  const prefix = `${SEAL_VERSION}:`
  if (!sealed.startsWith(prefix)) return null
  try {
    const payload = JSON.parse(decoder.decode(xorBytes(base64ToBytes(sealed.slice(prefix.length)))))
    return isPlainObject(payload) ? payload : null
  } catch {
    return null
  }
}

// The fields sealed on this task: the shared list plus the task's activity `sealedFields`.
export function getSealedFieldsForTask(task) {
  const activityFields = getTaskActivity(task)?.sealedFields ?? []
  return [...new Set([...TASK_SEALED_FIELDS, ...activityFields])]
}

function isGroup(task) {
  return task.type === 'group'
}

export function unsealTask(task) {
  if (!isPlainObject(task)) return task
  if (isGroup(task)) {
    return Array.isArray(task.subtasks)
      ? { ...task, subtasks: task.subtasks.map(unsealTask) }
      : task
  }
  if (task[SEALED_FIELD] === undefined) return task
  const payload = decodeSealPayload(task[SEALED_FIELD])
  // Unreadable (corrupt or a newer version): keep the task as stored rather than lose data.
  if (!payload) return task
  const { [SEALED_FIELD]: _sealed, ...rest } = task
  // A plain field set beside the payload (e.g. a hand edit in the console) wins.
  return { ...payload, ...rest }
}

export function sealTask(task) {
  if (!isPlainObject(task)) return task
  if (isGroup(task)) {
    return Array.isArray(task.subtasks) ? { ...task, subtasks: task.subtasks.map(sealTask) } : task
  }
  // Already sealed: open it first so the result holds one payload with every field.
  const open = unsealTask(task)
  if (open[SEALED_FIELD] !== undefined) return task
  const payload = {}
  const rest = { ...open }
  for (const field of getSealedFieldsForTask(open)) {
    if (rest[field] === undefined) continue
    payload[field] = rest[field]
    delete rest[field]
  }
  if (Object.keys(payload).length === 0) return rest
  return { ...rest, [SEALED_FIELD]: encodeSealPayload(payload) }
}

export function sealTasks(tasks) {
  return Array.isArray(tasks) ? tasks.map(sealTask) : tasks
}

export function unsealTasks(tasks) {
  return Array.isArray(tasks) ? tasks.map(unsealTask) : tasks
}

// Call on a lesson (or { tasks } fragment) right before it is written to Firestore.
export function sealLesson(lesson) {
  if (!lesson || !Array.isArray(lesson.tasks)) return lesson
  return { ...lesson, tasks: sealTasks(lesson.tasks) }
}

// Call on a lesson document right after it is read from Firestore.
export function unsealLesson(doc) {
  if (!doc || !Array.isArray(doc.tasks)) return doc
  return { ...doc, tasks: unsealTasks(doc.tasks) }
}

function taskNeedsSealing(task) {
  if (!isPlainObject(task)) return false
  if (isGroup(task)) return Array.isArray(task.subtasks) && task.subtasks.some(taskNeedsSealing)
  return getSealedFieldsForTask(task).some((field) => task[field] !== undefined)
}

// True when a stored (raw, not yet unsealed) lesson document still has answer fields in plain
// text: saved before sealing existed. Save paths rewrite such a lesson even when its content is
// unchanged, so the next save converts it.
export function lessonNeedsSealing(doc) {
  return !!doc && Array.isArray(doc.tasks) && doc.tasks.some(taskNeedsSealing)
}
