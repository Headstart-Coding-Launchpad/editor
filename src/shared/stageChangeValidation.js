// Lesson validation for the change view (platform request 134): a code stage's `show` and a
// task's `copyAfter` / `copyBefore`. Shared by the Builder and the CLI through the python, turtle
// and arcade module definitions' validateTask. Messages are in docs/authoring/validation-errors.md.
import { getStageRole, getStarterStage } from './taskStages.js'
import { cleanCodeLines } from './stageChange.js'

export const STAGE_SHOW_VALUES = ['full', 'change']

const COPY_ANCHOR_FIELDS = ['copyAfter', 'copyBefore']

/**
 * `changeView`: whether this module shows a Complete or Support stage's change view (Python). Elsewhere
 * `show: 'change'` is ignored, with a warning.
 */
export function validateStageChange(task, n, errors, warnings, { changeView = false } = {}) {
  ;(Array.isArray(task?.codeStages) ? task.codeStages : []).forEach((stage, index) => {
    if (stage?.show == null) return
    const where = `Task ${n} stage ${index + 1}`
    if (!STAGE_SHOW_VALUES.includes(stage.show)) {
      errors.push(`${where} show must be "full" or "change"`)
      return
    }
    if (stage.show !== 'change') return
    if (!changeView) {
      warnings.push(`${where} show: "change" works in Python lessons only; it is ignored here`)
    } else if (!['complete', 'support'].includes(getStageRole(stage))) {
      warnings.push(
        `${where} show: "change" works on a Complete or Support stage only; this stage shows in full`
      )
    }
  })

  // A blank place line is unset (the Builder holds the chosen mode with no text yet, and the
  // export drops it), so it is neither an error nor a warning.
  const present = COPY_ANCHOR_FIELDS.filter(
    (field) => task?.[field] != null && !(typeof task[field] === 'string' && !task[field].trim())
  )
  if (!present.length) return
  // Without copyCode the export drops every place line, so each is only ignored: a warning per
  // field, and no error about what it holds.
  if (!(typeof task?.copyCode === 'string' && task.copyCode.trim())) {
    for (const field of present) {
      warnings.push(`Task ${n} ${field} has no copyCode to place; it is ignored`)
    }
    return
  }
  for (const field of present) {
    if (typeof task[field] !== 'string') {
      errors.push(`Task ${n} ${field} must be the text of one line of code`)
    }
  }
  if (present.length === 2) {
    errors.push(`Task ${n} has both copyAfter and copyBefore; use one`)
  }
  // The named line should be in the code the student starts from. Carried code can't be read
  // here, so a task that carries is not checked.
  if (task?.carryCodeFrom != null || task?.carryCodeFromLesson != null) return
  const starter = getStarterStage(task)?.stage?.code ?? task?.starterCode
  if (typeof starter !== 'string') return
  const starterLines = new Set(cleanCodeLines(starter).map((line) => line.trim()))
  for (const field of present) {
    const text = typeof task[field] === 'string' ? task[field].trim() : ''
    if (text && !starterLines.has(text)) {
      warnings.push(
        `Task ${n} ${field} "${text}" is not a line of the starter code, so students may not find it`
      )
    }
  }
}
