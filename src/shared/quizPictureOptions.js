// Picture answer options for multiple-choice quizzes (platform request 128). An option may carry
// a picture: `image` (an https URL, usually a lesson asset from `lessons assets upload`) or
// `emoji`, with required `alt` text and an optional `text` caption. The stored answer is still
// the option id. Pure and Node-safe: used by the quiz component, the tutor card, validation,
// reports and print.
import { hintPlainText } from '../app/studentHints.js'

export const PICTURE_QUIZ_MAX_OPTIONS = 4
export const PICTURE_ALT_MAX_LENGTH = 200
export const PICTURE_FIELDS = Object.freeze(['image', 'emoji', 'alt'])

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== ''

export function optionHasPicture(option) {
  return nonEmpty(option?.image) || nonEmpty(option?.emoji)
}

export function quizHasPictureOptions(task) {
  return Array.isArray(task?.options) && task.options.some(optionHasPicture)
}

export function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\/\S+$/i.test(value.trim())
}

// The picture an option can safely show, whatever was stored (the Builder, a direct Firestore
// write or an import may skip validation): an https image, else the emoji, else null.
export function optionPictureSource(option) {
  if (isHttpsUrl(option?.image)) return { kind: 'image', src: option.image.trim() }
  if (nonEmpty(option?.emoji)) return { kind: 'emoji', emoji: option.emoji.trim() }
  return null
}

// How many emoji (grapheme clusters) a string holds; a family or flag emoji counts as one.
export function countGraphemes(value) {
  const text = String(value ?? '').trim()
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length
  return countGraphemesFallback(text)
}

// The count without Intl.Segmenter, for emoji: a code point after a zero-width joiner, a
// variation selector, a skin-tone modifier, a keycap mark, a tag character or a combining mark
// joins the one before it, and two regional indicators make one flag. Every other code point
// starts a new grapheme, so 'abcdefgh' is 8.
const JOINS_PREVIOUS = /^(?:[\uFE00-\uFE0F\u20E3\u{E0020}-\u{E007F}]|\p{Emoji_Modifier}|\p{M})$/u
const REGIONAL_INDICATOR = /^\p{Regional_Indicator}$/u
export function countGraphemesFallback(value) {
  let count = 0
  let afterJoiner = false
  let openFlag = false
  for (const codePoint of String(value ?? '').trim()) {
    if (codePoint === '\u200D') {
      afterJoiner = true
      continue
    }
    if (afterJoiner || (count > 0 && JOINS_PREVIOUS.test(codePoint))) {
      afterJoiner = false
      continue
    }
    if (REGIONAL_INDICATOR.test(codePoint)) {
      if (openFlag) {
        openFlag = false
        continue
      }
      openFlag = true
    } else openFlag = false
    count += 1
  }
  return count
}

// One emoji, and really an emoji: a pictograph, a flag or a keycap (a letter, digit or '?' is
// not, though digits and '#' are technically emoji code points).
const EMOJI_PICTURE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u
export function isSingleEmoji(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  return text !== '' && EMOJI_PICTURE.test(text) && countGraphemes(text) === 1
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

// What a picture is called where it stands alone (an emoji's name, a broken image's words): the
// alt text, else the caption as plain text, else the option id. Never ''.
export function optionPictureName(option) {
  if (nonEmpty(option?.alt)) return option.alt.trim()
  return hintPlainText(option?.text) || String(option?.id ?? '') || 'Picture'
}

// A screen reader's name for a card, in plain text: "Caption: alt" when both exist (and
// differ), else whichever there is, else the id. Markdown in the caption is flattened.
export function quizOptionAriaLabel(option) {
  const caption = hintPlainText(option?.text)
  const alt = optionHasPicture(option) && nonEmpty(option?.alt) ? option.alt.trim() : ''
  if (caption && alt && caption.toLowerCase() !== alt.toLowerCase()) return `${caption}: ${alt}`
  return caption || alt || String(option?.id ?? '')
}

// An option with its picture fields removed (switching a quiz to a type with no pictures). A
// picture with no caption keeps its alt text as words, so the option never goes blank.
export function stripOptionPicture(option) {
  if (!option || typeof option !== 'object') return option
  const { image: _image, emoji: _emoji, alt: _alt, ...rest } = option
  if (!nonEmpty(rest.text) && optionHasPicture(option) && nonEmpty(option.alt))
    rest.text = option.alt.trim()
  return rest
}
