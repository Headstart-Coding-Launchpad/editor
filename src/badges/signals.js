// Live badge signals: the small, first-occurrence or per-run records a student's own client
// writes to `sessions/{lessonId}/studentSignals/{anonymousId}` (docs/agents/runtime-model.md,
// "Badge data"), plus the helpers the run handlers use to describe a run for the badge timelines
// (`attemptLog.error`, sandbox `runsLog`). Pure and Node-safe: the Firebase writers live in
// src/app/hooks/useSession.js and call these to build their values.
//
// Nothing here stores code. A submission is reduced to `hashSubmission`, which the timeline
// builder also applies to `attemptLog.submission`, so a sandbox run and a task attempt of the
// same code share a hash.
import { stableHash } from '../shared/textUtils.js'
import { encodeFileKey } from '../shared/fileKeys.js'
import { TIMELINE_CONTEXTS } from './timeline.js'

/** Where a signal happened: a lesson task, the teacher's session sandbox, or a personal sandbox. */
export const SIGNAL_CONTEXTS = TIMELINE_CONTEXTS

/** `studentSignals/{id}/sandbox/{kind}`: the teacher's session sandbox, or a personal sandbox. */
export const SANDBOX_SIGNAL_KINDS = Object.freeze(['session', 'personal'])

/** How many recent sandbox runs `runsLog` keeps (enough to order a sandbox fix). */
export const SANDBOX_RUNS_LOG_MAX = 20

/** Sandbox time shorter than this is not worth a write. */
export const SANDBOX_TIME_MIN_MS = 1000

/** How complete code reached the student: Show complete, the read-only preview, a teacher reset. */
export const COMPLETE_SHOWN_VIA = Object.freeze(['show', 'preview', 'teacherReset'])

/** Who opened a topic: the student themselves, or the teacher sending it to them. */
export const TOPIC_OPEN_SOURCES = Object.freeze(['student', 'teacher'])

/** The topic id recorded when the Topic Library button opens the library on no chosen topic. */
export const TOPIC_LIBRARY_OPEN_ID = '_library'

/** The task key a signal outside any task (no current task id) is filed under. */
export const NO_TASK_KEY = 'none'

/** The signal context for the student's current phase. */
export function signalContextFor({ phase, inPersonalSandbox = false } = {}) {
  if (phase === 'sandbox') return 'sandbox'
  if (inPersonalSandbox) return 'personal'
  return 'task'
}

/** The sandbox counter node for a context ('sandbox' → 'session'), or null for a task. */
export function sandboxKindForContext(context) {
  if (context === 'sandbox') return 'session'
  if (context === 'personal') return 'personal'
  return null
}

/** The timeline context a sandbox counter node's runs belong to ('session' → 'sandbox'). */
export function contextForSandboxKind(kind) {
  return kind === 'session' ? 'sandbox' : kind === 'personal' ? 'personal' : null
}

/**
 * A Realtime Database-safe key for a topic or task id: dots become `__dot__` (the shared
 * file-key encoding) and the other characters RTDB forbids in keys become `_`.
 */
export function signalKey(id) {
  const text = id == null || id === '' ? NO_TASK_KEY : String(id)
  return encodeFileKey(text).replace(/[#$[\]/]/g, '_')
}

/**
 * A short, stable hash of a submission (a code string, or any JSON-able value), so rules can
 * tell different code apart without storing it. Strings hash as-is, so hashing
 * `attemptLog.submission` (always the serialised string) matches hashing the code it came from.
 */
export function hashSubmission(submission) {
  if (submission == null) return null
  const text = typeof submission === 'string' ? submission : JSON.stringify(submission)
  return (stableHash(text) >>> 0).toString(36)
}

// "NameError", "ZeroDivisionError", "ReferenceError", "KeyboardInterrupt"… as an error's name
// appears in a traceback's last line ("Line 3: NameError: …") or a browser error
// ("Uncaught ReferenceError: …"): a capitalised word ending in Error / Exception / Interrupt /
// Exit, followed by a colon or the end of the line.
const ERROR_NAME_PATTERN =
  /\b([A-Z][A-Za-z0-9_]*(?:Error|Exception|Interrupt|Exit))\b(?=:|[ \t]*$)/gm

/**
 * The name of the last error in a run's output ("Line 3: NameError: name 'x' is not defined"
 * → 'NameError'), or null when none can be read.
 */
export function runErrorName(output) {
  const text = String(output ?? '')
  let last = null
  for (const match of text.matchAll(ERROR_NAME_PATTERN)) last = match[1]
  return last
}

/**
 * What a run's `error` is for the badge data: false for a clean run, else the error's name when
 * it can be read from the output, else true. `status` is the run status ('error' = a real
 * console error); `output` the run's text output or error message.
 */
export function runErrorFor(status, output) {
  if (status !== 'error') return false
  return runErrorName(output) ?? true
}

/** An `error` value as stored: the name, true, or null for no error (RTDB drops nulls). */
export function storedError(error) {
  if (typeof error === 'string' && error) return error
  return error ? true : null
}

function emptySandboxCounters() {
  return { timeMs: 0, runs: 0, errorRuns: 0, fixes: 0, runsLog: [] }
}

function sandboxCounters(current) {
  const base = emptySandboxCounters()
  if (!current || typeof current !== 'object') return base
  const runsLog = Array.isArray(current.runsLog)
    ? current.runsLog.filter(Boolean)
    : Object.values(current.runsLog ?? {}).filter(Boolean)
  return {
    timeMs: Number(current.timeMs) || 0,
    runs: Number(current.runs) || 0,
    errorRuns: Number(current.errorRuns) || 0,
    fixes: Number(current.fixes) || 0,
    runsLog,
  }
}

/**
 * The sandbox counters after one run (a transaction body: pure, safe to re-run). A run is a
 * fix when it is error-free, the run before it had an error, and the code differs.
 * `entry.at` may be a server-timestamp placeholder.
 */
export function applySandboxRun(current, { at, error = false, submissionHash = null } = {}) {
  const next = sandboxCounters(current)
  const previous = next.runsLog[next.runsLog.length - 1] ?? null
  const hasError = !!error
  const isFix =
    !hasError &&
    !!previous?.error &&
    (submissionHash == null || previous.submissionHash !== submissionHash)
  const entry = {
    at: at ?? null,
    error: hasError ? storedError(error) : false,
    submissionHash: submissionHash ?? null,
    ...(isFix ? { fix: true } : {}),
  }
  return {
    ...next,
    runs: next.runs + 1,
    errorRuns: next.errorRuns + (hasError ? 1 : 0),
    fixes: next.fixes + (isFix ? 1 : 0),
    runsLog: [...next.runsLog, entry].slice(-SANDBOX_RUNS_LOG_MAX),
  }
}

/**
 * The sandbox counters after the latest run turned out to have an error reported late (Arcade's
 * game iframe reports its error after Run). Marks the last `runsLog` entry, counts it as an error
 * run, and takes back a fix it had been counted as. No change when it is already marked.
 */
export function applySandboxRunError(current, error = true) {
  const next = sandboxCounters(current)
  const last = next.runsLog[next.runsLog.length - 1]
  if (!last || last.error) return next
  const marked = { ...last, error: storedError(error) ?? true }
  delete marked.fix
  return {
    ...next,
    errorRuns: next.errorRuns + 1,
    fixes: Math.max(0, next.fixes - (last.fix ? 1 : 0)),
    runsLog: [...next.runsLog.slice(0, -1), marked],
  }
}

/** The sandbox counters with `ms` more time spent in the sandbox. */
export function applySandboxTime(current, ms) {
  const next = sandboxCounters(current)
  const add = Math.max(0, Math.round(Number(ms) || 0))
  return { ...next, timeMs: next.timeMs + add }
}

// Blockly event types (Blockly.Events.BLOCK_CREATE etc.), kept as strings so this stays pure.
const BLOCKLY_EDIT_TYPES = new Set(['create', 'delete', 'move', 'change'])

function sameCoordinate(a, b) {
  if (!a || !b) return !a && !b
  return Math.abs((a.x ?? 0) - (b.x ?? 0)) < 1 && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 1
}

/**
 * Whether a Blockly workspace event is a real edit by the student for Ready to Code: a block
 * created or deleted, moved to a new parent, input or position, or a field value changed. UI
 * events and a block picked up and dropped back in the same place are not. The caller skips
 * events it caused itself (loading work, a teacher push).
 */
export function isBlocklyUserEdit(event) {
  if (!event || event.isUiEvent || !BLOCKLY_EDIT_TYPES.has(event.type)) return false
  if (event.type === 'move') {
    return (
      (event.oldParentId ?? null) !== (event.newParentId ?? null) ||
      (event.oldInputName ?? null) !== (event.newInputName ?? null) ||
      !sameCoordinate(event.oldCoordinate, event.newCoordinate)
    )
  }
  if (event.type === 'change') {
    return event.element === 'field' && event.oldValue !== event.newValue
  }
  return true
}
