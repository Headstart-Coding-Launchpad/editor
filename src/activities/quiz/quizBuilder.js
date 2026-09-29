// Builder task conversions for the legacy quiz activities (moved from TaskEditor with plan step
// 2.4; the results are unchanged). Each quiz_<type>/ui.jsx exposes `builderConvert` built from
// switchQuizType, so the Builder's quiz-type picker needs no per-type code. Pure.

export function makeDefaultQuizOptions() {
  return [
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ]
}

function renumberQuizOptions(options) {
  return options.map((option, index) => ({ ...option, id: String.fromCharCode(97 + index) }))
}

// Choosing the Quiz task format on a code or information task: a multiple-choice quiz (or the
// task's own quiz type when it already is one) that keeps any options and a still-valid answer.
export function toQuizTask(task) {
  const quizType =
    task.taskType === 'quiz' ? (task.quizType ?? 'multiple_choice') : 'multiple_choice'
  const options = task.options?.length
    ? renumberQuizOptions(task.options)
    : makeDefaultQuizOptions()
  const answer = options.some((option) => option.id === task.check?.value) ? task.check.value : ''
  const { copyCode: _copyCode, ...rest } = task
  return {
    ...rest,
    taskType: 'quiz',
    quizType,
    options,
    check: answer ? { type: 'answer_equals', value: answer } : null,
    carryCodeFrom: null,
    carryBlocksFrom: null,
    carryFsFrom: null,
    carryCircuitFrom: null,
  }
}

// Switching an existing quiz to another quiz type. Fields the new type shares are kept; the new
// type's required fields get empty defaults (the author fills them in).
export function switchQuizType(task, quizType) {
  if (quizType === 'multiple_choice') {
    const options = task.options?.length ? task.options : makeDefaultQuizOptions()
    const answer = options.some((o) => o.id === task.check?.value) ? task.check.value : ''
    return {
      ...task,
      quizType: 'multiple_choice',
      options,
      check: answer ? { type: 'answer_equals', value: answer } : null,
    }
  }
  if (quizType === 'match') {
    const defaultPairs = [
      { id: 'p1', prompt: '', answer: '' },
      { id: 'p2', prompt: '', answer: '' },
    ]
    return {
      ...task,
      quizType: 'match',
      pairs: task.pairs?.length ? task.pairs : defaultPairs,
      check: null,
    }
  }
  if (quizType === 'fill_blank') {
    return {
      ...task,
      quizType: 'fill_blank',
      mode: task.mode ?? 'drag',
      text: task.text ?? '',
      blanks: task.blanks ?? [],
      check: null,
    }
  }
  if (quizType === 'short_answer') {
    const existing = task.check?.type?.startsWith('answer_') ? task.check : null
    return { ...task, quizType: 'short_answer', check: existing ?? null }
  }
  if (quizType === 'confidence') {
    return {
      ...task,
      quizType: 'confidence',
      options: undefined,
      pairs: undefined,
      blanks: undefined,
      text: undefined,
      check: null,
    }
  }
  return task
}
