// Shared Builder + CLI validation for the legacy activity task formats (`taskType: 'quiz'` +
// `quizType`, and `taskType: 'code_arrange'`). Pure and Node-safe. Both validators call these
// through src/shared/lessonValidation.js (see getLegacyTaskValidation below); the quiz_*
// and code_arrange activity definitions' validateTask wrap the same rules.

import {
  assembleCodeArrangement,
  buildSolutionSlotState,
  getCodeArrangeEntryFile,
} from '../shared/codeArrange.js'
import { evaluateSingleCheck, isCodeCheck, normalizeChecks } from '../modules/checks.js'
import { joinFileContents } from '../modules/moduleContract.js'

// Module types a code-arrange task can run in.
export const CODE_ARRANGE_MODULE_TYPES = Object.freeze(['python', 'html'])

export function validateQuizTask(task, { n, errors }) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'multiple_choice') {
    if (!task.options || task.options.length < 2)
      errors.push(`Task ${n} is a quiz but has fewer than 2 options`)
    if (task.options?.some((option) => !option.text?.trim()))
      errors.push(`Task ${n} is a quiz but has an empty option text`)
    if (task.check?.type !== 'answer_equals' || !task.check.value)
      errors.push(`Task ${n} is a quiz but no correct answer has been selected`)
  } else if (quizType === 'match') {
    if (!task.pairs || task.pairs.length < 2)
      errors.push(`Task ${n} is a match quiz but has fewer than 2 pairs`)
    if (task.pairs?.some((pair) => !pair.prompt?.trim() || !pair.answer?.trim()))
      errors.push(`Task ${n} is a match quiz but has an empty prompt or answer`)
  } else if (quizType === 'fill_blank') {
    if (!task.text?.includes('___'))
      errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blanks in the text`)
    if (!task.blanks || task.blanks.length === 0)
      errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blank answers`)
    if (task.blanks?.some((blank) => !blank.answer?.trim()))
      errors.push(`Task ${n} is a fill-in-the-blank quiz but has an empty answer`)
  } else if (quizType === 'short_answer') {
    if (
      task.check != null &&
      (!task.check.type?.startsWith('answer_') || !task.check.value?.trim())
    ) {
      errors.push(`Task ${n} is a short-answer quiz with a check enabled but no check value`)
    }
  }
}

// Structure of the arrangement itself. The host module's own rules (HTML starter files, check
// fields) run afterwards through its definition's validateTask.
export function validateCodeArrangeTask(task, { n, moduleType, errors, warnings = [] }) {
  const errorCount = errors.length
  if (!CODE_ARRANGE_MODULE_TYPES.includes(moduleType)) {
    errors.push(`Task ${n} is a code-arrange task but must use the Python or HTML module`)
  }
  const lines = Array.isArray(task.lines) ? task.lines : []
  if (lines.length === 0) errors.push(`Task ${n} is a code-arrange task but has no lines`)
  const lineIds = []
  const poolIds = []
  let slotCount = 0
  lines.forEach((line, li) => {
    const ln = li + 1
    if (!line?.id) errors.push(`Task ${n} line ${ln} has no id`)
    else lineIds.push(line.id)
    const parts = Array.isArray(line?.parts) ? line.parts : []
    if (parts.length === 0) errors.push(`Task ${n} line ${ln} has no parts`)
    parts.forEach((part, pi) => {
      const pn = pi + 1
      if (part?.type === 'slot') {
        slotCount++
        if (!part.id) errors.push(`Task ${n} line ${ln} blank ${pn} has no id`)
        else poolIds.push(part.id)
        if (!part.code?.trim()) errors.push(`Task ${n} line ${ln} blank ${pn} has no correct value`)
      } else if (part?.type !== 'text') {
        errors.push(`Task ${n} line ${ln} part ${pn} has an invalid type`)
      }
    })
  })
  if (lines.length > 0 && slotCount === 0)
    errors.push(`Task ${n} is a code-arrange task but has no blanks`)
  if (new Set(lineIds).size !== lineIds.length)
    errors.push(`Task ${n} is a code-arrange task but has duplicate line ids`)
  const distractors = Array.isArray(task.distractors) ? task.distractors : []
  distractors.forEach((d, di) => {
    if (!d?.id) errors.push(`Task ${n} distractor ${di + 1} has no id`)
    else poolIds.push(d.id)
    if (!d?.code?.trim()) errors.push(`Task ${n} distractor ${di + 1} has no code`)
  })
  if (new Set(poolIds).size !== poolIds.length)
    errors.push(`Task ${n} is a code-arrange task but has duplicate blank/distractor ids`)
  if (!task.check) errors.push(`Task ${n} is a code-arrange task but has no completion check`)
  // HTML assembles into the entry file: one that isn't a starter file would never be shown.
  const starterFiles = Array.isArray(task.starterFiles) ? task.starterFiles : []
  if (
    moduleType === 'html' &&
    task.entryFile &&
    starterFiles.length > 0 &&
    !starterFiles.some((file) => file?.name === task.entryFile)
  ) {
    errors.push(`Task ${n} entryFile "${task.entryFile}" is not one of its starter files`)
  }
  // The authored solution is only worth checking once the arrangement itself is well formed.
  if (errors.length === errorCount) validateCodeArrangeSolution(task, { n, moduleType, warnings })
}

// The authored solution (every blank holding its own tile) must pass the task's own check. Only
// the static code checks are evaluated here — output and element checks need a real run, which
// neither the Builder's validator nor the CLI can do. Python solutions are also checked for a
// line after a block opener ("...:") that isn't indented, which would fail to run at all.
function validateCodeArrangeSolution(task, { n, moduleType, warnings }) {
  const code = assembleCodeArrangement(task, buildSolutionSlotState(task))
  if (code === null) return
  const codeChecks = normalizeChecks(task.check).filter(isCodeCheck)
  if (codeChecks.length > 0) {
    const checkedCode = moduleType === 'html' ? solutionHtmlSource(task, code) : code
    if (!codeChecks.every((check) => evaluateSingleCheck(check, '', { code: checkedCode }))) {
      warnings.push(`Task ${n} solution arrangement does not pass its own code check`)
    }
  }
  if (moduleType === 'python') {
    const lines = code.split('\n')
    const indentOf = (line) => line.length - line.trimStart().length
    let previous = null
    lines.forEach((line, index) => {
      if (!line.trim() || line.trim().startsWith('#')) return
      if (previous && previous.trimEnd().endsWith(':') && indentOf(line) <= indentOf(previous)) {
        warnings.push(
          `Task ${n} line ${index + 1} follows a line ending in ":" but is not indented`
        )
      }
      previous = line
    })
  }
}

// What an html task's code checks read: every file's content joined (the html module's
// checking context), the entry file holding the assembled solution.
function solutionHtmlSource(task, code) {
  const entryFile = getCodeArrangeEntryFile(task)
  const starterFiles = Array.isArray(task.starterFiles) ? task.starterFiles : []
  const files = starterFiles.some((file) => file?.name === entryFile)
    ? starterFiles.map((file) => (file?.name === entryFile ? { ...file, content: code } : file))
    : [...starterFiles, { name: entryFile, content: code }]
  return joinFileContents(files)
}

export function quizHasStarter(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'multiple_choice') return task.options?.some((option) => option.text?.trim())
  if (quizType === 'match')
    return task.pairs?.some((pair) => pair.prompt?.trim() || pair.answer?.trim())
  if (quizType === 'fill_blank')
    return !!task.text?.trim() || task.blanks?.some((blank) => blank.answer?.trim())
  if (quizType === 'short_answer') return !!task.explainer?.trim()
  if (quizType === 'confidence') return !!task.explainer?.trim()
  return false
}

export function quizHasCheckValue(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'match')
    return (
      task.pairs?.length > 0 &&
      task.pairs.every((pair) => pair.prompt?.trim() && pair.answer?.trim())
    )
  if (quizType === 'fill_blank')
    return task.blanks?.length > 0 && task.blanks.every((blank) => blank.answer?.trim())
  if (quizType === 'confidence') return true
  return !!task.check?.value
}

export function codeArrangeHasStarter(task) {
  return Array.isArray(task.lines) && task.lines.length > 0
}

// How the shared lesson validator (src/shared/lessonValidation.js) handles each legacy
// activity task format, keyed by taskType. `hostModule` means the task runs inside a workspace
// module, whose own validateTask then runs too. `hasCheckValue: null` falls back to the host
// module's rule.
const LEGACY_TASK_VALIDATION = Object.freeze({
  quiz: Object.freeze({
    hostModule: false,
    validateTask: validateQuizTask,
    hasStarter: (task) => !!quizHasStarter(task),
    hasCheckValue: (task) => !!quizHasCheckValue(task),
  }),
  code_arrange: Object.freeze({
    hostModule: true,
    validateTask: validateCodeArrangeTask,
    hasStarter: codeArrangeHasStarter,
    hasCheckValue: null,
  }),
})

export function getLegacyTaskValidation(task) {
  const taskType = task?.taskType
  return typeof taskType === 'string' && Object.hasOwn(LEGACY_TASK_VALIDATION, taskType)
    ? LEGACY_TASK_VALIDATION[taskType]
    : null
}
