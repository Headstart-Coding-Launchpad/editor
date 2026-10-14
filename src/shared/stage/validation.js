// Lesson validation for the Python Stage's `stageTarget` task field. Shared by the Builder and
// the CLI (through the python module definition's validateTask). The stage checks validate
// themselves (validateStageCheck in ./checks.js). Messages are documented in
// docs/authoring/validation-errors.md.

export const STAGE_TARGET_TASK_FIELD = Object.freeze({
  name: 'stageTarget',
  type: 'object',
  description:
    'Python Stage target drawing: { code: Python that draws the target with the stage module, ghost: true | false (the faint target starts shown; default true) }. Gives the student a ghost to draw over and, after Run, a diff view; needed by stage_matches_target.',
})

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function validateStageTarget(task, n, errors, warnings = []) {
  const raw = task?.stageTarget
  if (raw == null) return
  if (!isPlainObject(raw)) {
    errors.push(
      `Task ${n} has a stageTarget that is not an object — write the target's Python under code`
    )
    return
  }
  if (typeof raw.code !== 'string' || !raw.code.trim()) {
    errors.push(`Task ${n} has a stageTarget with no code — add the Python that draws the target`)
  } else if (!/\bstage\b/.test(raw.code)) {
    warnings.push(
      `Task ${n} has stageTarget code that never imports stage — it will draw nothing (start it with from stage import *)`
    )
  }
  if (raw.ghost != null && typeof raw.ghost !== 'boolean') {
    errors.push(`Task ${n} has a stageTarget ghost that is not true or false`)
  }
  const extra = Object.keys(raw).filter((key) => key !== 'code' && key !== 'ghost')
  if (extra.length > 0) {
    warnings.push(
      `Task ${n} has stageTarget fields it does not use (${extra.join(', ')}) — they are ignored`
    )
  }
}
