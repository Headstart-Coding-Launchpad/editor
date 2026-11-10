// Lesson validation for the change view (platform request 134): a code stage's `show` and a
// task's `copyAfter` / `copyBefore`. Shared by the Builder and the CLI through the python, turtle
// and arcade module definitions' validateTask. Messages are in docs/authoring/validation-errors.md.
import { getStageRole, getStarterStage } from './taskStages.js'
import { cleanCodeLines } from './stageChange.js'

export const STAGE_SHOW_VALUES = ['full', 'change']

const COPY_ANCHOR_FIELDS = ['copyAfter', 'copyBefore']

/**
 * `changeView`: whether this module shows a Complete or Support stage's change view (Python).
 * Elsewhere `show: 'change'` is ignored, with a warning.
 */
export function validateStageChange(task, n, errors, warnings, { changeView = false } = {}) {
  const starterLines = starterLineSet(task)
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
        `${where} show: "change" works on a Complete or Support stage only; it is ignored here`
      )
    } else if (getStageRole(stage) === 'support' && starterLines) {
      warnSupportExcerpt(stage, where, starterLines, warnings)
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
  if (!starterLines) return
  for (const field of present) {
    const text = typeof task[field] === 'string' ? task[field].trim() : ''
    if (text && !starterLines.has(text)) {
      warnings.push(
        `Task ${n} ${field} "${text}" is not a line of the starter code, so students may not find it`
      )
    }
  }
}

// The trimmed non-blank lines of the code the student starts from, or null when that can't be
// read here: carried code, or no starter code.
function starterLineSet(task) {
  if (task?.carryCodeFrom != null || task?.carryCodeFromLesson != null) return null
  const starter = getStarterStage(task)?.stage?.code ?? task?.starterCode
  if (typeof starter !== 'string') return null
  const found = new Set(cleanCodeLines(starter).map((line) => line.trim()))
  found.delete('')
  return found
}

// A Support stage's change view reads it as an excerpt (computeStageChange `excerpt`): the lines
// it leaves out never show as removals, and its new lines are placed by lines it shares with the
// student's code. Two ways that goes wrong, both only warnings (the hint still shows).
function warnSupportExcerpt(stage, where, starterLines, warnings) {
  if (typeof stage.code !== 'string' || !starterLines.size) return
  const stageLines = new Set(cleanCodeLines(stage.code).map((line) => line.trim()))
  stageLines.delete('')
  if (!stageLines.size) return
  const shared = [...starterLines].filter((line) => stageLines.has(line)).length
  if (starterLines.size >= 2 && shared === starterLines.size) {
    warnings.push(
      `${where} show: "change" reads a Support stage as a few lines of the program, ` +
        'but this one holds the whole starter code: lines it leaves out never show as lines ' +
        'to remove, so use a Complete stage for a whole program'
    )
  } else if (shared === 0) {
    warnings.push(
      `${where} show: "change" places a Support stage's new lines by lines of the ` +
        "student's code, but none of its lines is in the starter code, so all of it shows " +
        'in green and nothing shows as removed'
    )
  }
}
