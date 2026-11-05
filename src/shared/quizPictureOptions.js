// Picture answer options for multiple-choice quizzes (platform request 128). An option may carry
// a picture: `image` (an https URL, usually a lesson asset from `lessons assets upload`) or
// `emoji`, with required `alt` text and an optional `text` caption. The stored answer is still
// the option id. Pure and Node-safe: used by the quiz component, the tutor card, validation,
// reports and print.

export const PICTURE_QUIZ_MAX_OPTIONS = 4

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== ''

export function optionHasPicture(option) {
  return nonEmpty(option?.image) || nonEmpty(option?.emoji)
}

export function quizHasPictureOptions(task) {
  return Array.isArray(task?.options) && task.options.some(optionHasPicture)
}

// What the option says in words: the caption, else the picture's alt text ('' if neither).
export function quizOptionDescription(option) {
  if (nonEmpty(option?.text)) return option.text.trim()
  if (optionHasPicture(option) && nonEmpty(option?.alt)) return option.alt.trim()
  return ''
}

// The option's label for cards, reports and print: the caption, else the alt text, else the id.
export function quizOptionLabel(option) {
  return quizOptionDescription(option) || String(option?.id ?? '')
}

export function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/\S+$/i.test(value.trim())
}
