import {
  PICTURE_FIELDS,
  optionHasPicture,
  quizHasPictureOptions,
  stripOptionPicture,
} from '../../shared/quizPictureOptions.js'

// Builder task conversions for the legacy quiz activities (moved from TaskEditor with plan step
// 2.4; the results are unchanged). Each quiz_<type>/ui.jsx exposes `builderConvert` built from
// switchQuizType, so the Builder's quiz-type picker needs no per-type code. Pure, except for the
// picture stash below.

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

// Picture options are multiple-choice only. Leaving multiple choice turns each picture into words
// (its caption, else its alt text) so the task saved as a poll (or any other type) holds no
// pictures and validates; the pictures are kept in this in-memory stash, by task id, so switching
// back to multiple choice in the same Builder session (same task id and title) brings them back. The stash is never saved:
// after a reload a poll is just a poll.
const pictureStash = new Map()

// Switching an existing quiz to another quiz type. Fields the new type shares are kept; the new
// type's required fields get empty defaults (the author fills them in).
export function switchQuizType(task, quizType) {
  const stashKey = task?.id ?? null
  if (quizType === 'multiple_choice') {
    const stash = stashKey == null ? null : pictureStash.get(stashKey)
    if (stash) pictureStash.delete(stashKey)
    // Same id and title: the same task (ids repeat across lessons opened in one session).
    const restored =
      stash && stash.title === task.title ? restorePictures(task.options, stash) : task.options
    return switchQuizTypeInner({ ...task, options: restored }, quizType)
  }
  if (!quizHasPictureOptions(task)) return switchQuizTypeInner(task, quizType)
  const next = switchQuizTypeInner(
    { ...task, options: task.options.map(stripOptionPicture) },
    quizType
  )
  if (stashKey != null)
    pictureStash.set(stashKey, { title: task.title, original: task.options, left: next.options })
  return next
}

// The options unchanged since the switch (or gone, as on a confidence check): the original
// options back as they were. Otherwise each option with the same id and no picture of its own
// gets its picture back, and its alt-text words go back to an empty caption if untouched.
function restorePictures(options, { original, left }) {
  if (!Array.isArray(options) || options.length === 0) return original
  if (JSON.stringify(options) === JSON.stringify(left)) return original
  return options.map((option) => {
    const before = original.find((candidate) => candidate?.id === option?.id)
    if (!optionHasPicture(before) || optionHasPicture(option)) return option
    const after = left?.find((candidate) => candidate?.id === option?.id)
    const pictureFields = Object.fromEntries(
      PICTURE_FIELDS.filter((field) => field in before).map((field) => [field, before[field]])
    )
    const untouched = after && option.text === after.text
    const text = untouched ? before.text : option.text
    const { text: _text, ...rest } = option
    return { ...rest, ...pictureFields, ...(text === undefined ? {} : { text }) }
  })
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
