// Shared Builder + CLI validation for the legacy activity task formats (`taskType: 'quiz'` +
// `quizType`, and `taskType: 'code_arrange'`). Pure and Node-safe. Both validators call these
// through src/shared/lessonValidation.js; plan step 2.2 moves the quiz rules into
// src/activities/quiz_*/definition.js and step 4.9 moves code_arrange onto the activity contract.

export function isLegacyQuizTask(task) {
  return task?.taskType === 'quiz'
}

export function isCodeArrangeTask(task) {
  return task?.taskType === 'code_arrange'
}

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
export function validateCodeArrangeTask(task, { n, moduleType, errors }) {
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
