// Who needs the tutor (Hub #224, research note 25 Oct: show the few students who need the tutor,
// quiet for everyone else). The compact student list (studentList.js, StudentGrid) uses these
// rules for its Needs help and Stuck rows; the old "Needs you" strip was folded into it (8 Nov
// 2026). Built only from what the tutor's screen already receives, so nothing new is written to
// Firebase:
// - help: the student pressed "I need help" (`needsHelp`);
// - error: the latest runs crashed with the same error ERROR_LOOP_RUNS times in a row (counted
//   on the tutor's screen from `lastRunAt` / `lastRunStatus` / `lastRunError`);
// - stuck: failed the current task's check STUCK_FAILS times in a row (`studentHint.failStreak`).
// Finished is not here: the list reads it from studentCheckStatus.js.
//
// Pure and Node-safe.

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
  return null
}
