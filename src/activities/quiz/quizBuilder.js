import { quizHasPictureOptions, stripOptionPicture } from '../../shared/quizPictureOptions.js'

// Builder task conversions for the legacy quiz activities (moved from TaskEditor with plan step
// 2.4; the results are unchanged). Each quiz_<type>/ui.jsx exposes `builderConvert` built from
// switchQuizType, so the Builder's quiz-type picker needs no per-type code. Pure.

export function makeDefaultQuizOptions() {
  return [
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ]
}

// Old lesson files can hold quiz options as plain strings ("Yes") rather than {id, text}
// objects, which crashed the Builder. Strings and numbers become {id, text}; an object without
// an id gets the first letter no other option uses; anything else (null, arrays) is skipped. A
// stored answer that was a string option's text moves to that option's new id. Returns the task
// itself when every option is already an object with an id.
export function withQuizOptionObjects(task) {
  const options = task?.options
  if (!Array.isArray(options)) return task
  const fine = options.every(
    (option) => option && typeof option === 'object' && !Array.isArray(option) && option.id
  )
  if (fine) return task
  const kept = options
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return { option: { text: String(option) }, fromText: true }
      }
      if (option && typeof option === 'object' && !Array.isArray(option)) return { option }
      return null
    })
    .filter(Boolean)
  const used = new Set(kept.map(({ option }) => option.id).filter(Boolean))
  let letter = 0
  const nextLetter = () => {
    let id = String.fromCharCode(97 + letter)
    while (used.has(id)) id = String.fromCharCode(97 + ++letter)
    used.add(id)
    return id
  }
  const normalized = kept.map((entry) =>
    entry.option.id ? entry : { ...entry, option: { ...entry.option, id: nextLetter() } }
  )
  const answer = task.check?.value
  const answered =
    answer != null &&
    normalized.find(({ option, fromText }) => fromText && option.text === String(answer))
  return {
    ...task,
    options: normalized.map(({ option }) => option),
    ...(answered ? { check: { ...task.check, value: answered.option.id } } : {}),
  }
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

// Picture options are multiple-choice only. Leaving multiple choice turns each picture into words
// (its caption, else its alt text) so the task saved as a poll (or any other type)
// holds no pictures and validates. This is one-way: the Builder's quiz-type picker asks the
// author first (QuizTypePicker in ActivityPickers.jsx), and switching back gives word options.

// Switching an existing quiz to another quiz type. Fields the new type shares are kept; the new
// type's required fields get empty defaults (the author fills them in).
export function switchQuizType(task, quizType) {
  if (quizType === 'multiple_choice' || !quizHasPictureOptions(task)) {
    return switchQuizTypeInner(task, quizType)
  }
  return switchQuizTypeInner({ ...task, options: task.options.map(stripOptionPicture) }, quizType)
}

function switchQuizTypeInner(task, quizType) {
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
  if (quizType === 'poll') {
    const options = task.options?.length ? task.options : makeDefaultQuizOptions()
    return {
      ...task,
      quizType: 'poll',
      options: options.map(({ feedback: _feedback, hint: _hint, ...option }) => option),
      pairs: undefined,
      blanks: undefined,
      text: undefined,
      feedback: undefined,
      check: null,
    }
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
