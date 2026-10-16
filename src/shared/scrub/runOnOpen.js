// A task's `runOnOpen` (P6-23, Python and Turtle): run the starter (or the student's saved code)
// once as a preview when the task opens, so the Stage, the Turtle drawing or the console shows
// straight away ("see it, change it, see the difference"). The opening run is a preview, never
// an attempt: no checks, no attempt logged, no save, not counted as a Run, so opening a task can
// never pass it (useScrubPreview runs it). Programs that call input() are never run on open:
// the run would stop to ask. Pure and Node-safe.
//
//   runOnOpen: true | false   default: on for a task with `scrub` on, off otherwise.
import { getTaskScrub } from './scrubConfig.js'

export const RUN_ON_OPEN_TASK_FIELD = Object.freeze({
  name: 'runOnOpen',
  type: 'boolean',
  description:
    'Run the code once as a preview when the task opens, so the picture or output shows straight away (no checks, no attempt, not counted as a Run; never for programs that call input()). Default: on when scrub is on, off otherwise.',
})

const INPUT_CALL = /(?<![\w.])input\s*\(/

/** Whether Python `code` calls input() (so it can't run on open). */
export function codeCallsInput(code) {
  return INPUT_CALL.test(String(code ?? ''))
}

/** Whether the task runs its code on open: `runOnOpen` when set, else whether scrub is on. */
export function getTaskRunOnOpen(task) {
  if (!task) return false
  if (typeof task.runOnOpen === 'boolean') return task.runOnOpen
  return getTaskScrub(task) != null
}

/**
 * Lesson validation for `runOnOpen` (the python and turtle definitions' validateTask; messages
 * in docs/authoring/validation-errors.md). `starterCode` is the task's starter, to warn when it
 * calls input().
 */
export function validateRunOnOpen(task, n, errors, warnings = [], { starterCode = null } = {}) {
  const raw = task?.runOnOpen
  if (raw == null) return
  if (typeof raw !== 'boolean') {
    errors.push(`Task ${n} has runOnOpen that is not true or false`)
    return
  }
  if (raw && codeCallsInput(starterCode)) {
    warnings.push(
      `Task ${n} has runOnOpen but its starter code calls input() — it can't run on open, so runOnOpen is ignored`
    )
  }
}
