// The tutor's "Needs you" strip above the student grid (Hub #224, research note 25 Oct: show the
// few students who need the tutor, quiet for everyone else). Built only from what the tutor's
// screen already receives, so nothing new is written to Firebase:
// - help: the student pressed "I need help" (`needsHelp`);
// - error: the latest runs crashed with the same error ERROR_LOOP_RUNS times in a row (counted
//   on the tutor's screen from `lastRunAt` / `lastRunStatus` / `lastRunError`);
// - stuck: failed the current task's check STUCK_FAILS times in a row (`studentHint.failStreak`);
// - finished: passed the current task's check, ready for a stretch.
// "Waiting" times start when this tutor screen first saw the state, so a reload restarts them.
//
// Pure and Node-safe.

export const NEEDS_YOU_KINDS = Object.freeze(['help', 'error', 'stuck', 'finished'])
export const ERROR_LOOP_RUNS = 3
export const STUCK_FAILS = 3

const sameTask = (a, b) => a != null && b != null && String(a) === String(b)

const firstLine = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() ?? ''

// The error-run counter for one student, advanced when a new run lands (a new `lastRunAt`).
// `prev` is the last value this returned for the student (or undefined).
export function nextErrorRuns(prev, student) {
  const at = student?.lastRunAt ?? null
  const error = student?.lastRunStatus === 'error' ? firstLine(student.lastRunError) : null
  if (prev && prev.at === at) return prev
  if (error == null) return { at, error: null, count: 0 }
  const count = prev?.error != null && prev.error === error ? prev.count + 1 : 1
  return { at, error, count }
}

// What one student needs, most urgent first, or null: { kind, reason }.
export function needsYouState(student, { taskId, hasCheck, errorRuns } = {}) {
  if (!student) return null
  if (student.needsHelp) return { kind: 'help', reason: 'Asked for help' }
  if (student.lastRunStatus === 'error' && (errorRuns?.count ?? 0) >= ERROR_LOOP_RUNS) {
    const error = errorRuns.error ? `: ${errorRuns.error}` : ''
    return { kind: 'error', reason: `Same error ${errorRuns.count} runs in a row${error}` }
  }
  const hint = student.studentHint
  if (
    hasCheck &&
    !student.checkPassed &&
    sameTask(hint?.taskId, taskId) &&
    (Number(hint?.failStreak) || 0) >= STUCK_FAILS
  ) {
    return { kind: 'stuck', reason: `Failed the check ${hint.failStreak} times in a row` }
  }
  if (hasCheck && student.checkPassed) return { kind: 'finished', reason: 'Finished' }
  return null
}

// The strip's rows: [{ studentId, kind, reason, since }], help first, then error, stuck and
// finished, and the longest wait first within each. `seenAt` maps `${studentId}:${kind}` to when
// the tutor first saw it; `snoozed` is a Set of `${studentId}:${kind}:${since}` ("I'm on it").
export function needsYouEntries(
  students,
  { taskId, hasCheck, errorRuns = {}, seenAt = {}, snoozed } = {}
) {
  const out = []
  for (const student of Array.isArray(students) ? students : []) {
    const id = student?.anonymousId
    if (!id) continue
    const state = needsYouState(student, { taskId, hasCheck, errorRuns: errorRuns[id] })
    if (!state) continue
    const since = seenAt[`${id}:${state.kind}`] ?? null
    if (snoozed?.has(`${id}:${state.kind}:${since}`)) continue
    out.push({ studentId: id, kind: state.kind, reason: state.reason, since })
  }
  const rank = (kind) => NEEDS_YOU_KINDS.indexOf(kind)
  return out.sort(
    (a, b) =>
      rank(a.kind) - rank(b.kind) ||
      (a.since ?? Infinity) - (b.since ?? Infinity) ||
      a.studentId.localeCompare(b.studentId)
  )
}

// "just now", "2 min", "1 hr 5 min": how long a row has waited.
export function waitWords(since, now) {
  if (since == null || now == null) return ''
  const mins = Math.floor(Math.max(0, now - since) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return mins % 60 ? `${hrs} hr ${mins % 60} min` : `${hrs} hr`
}
