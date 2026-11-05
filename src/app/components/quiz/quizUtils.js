import React from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import { baseStyles } from './quizStyles'
export { stableHash } from '../../../shared/textUtils'
export { parseQuizAnswerState } from '../../../shared/quizAnswers'
import { stableHash } from '../../../shared/textUtils'
import { answerTextMatches } from '../../../shared/quizAnswers'
import { optionHasPicture, quizOptionLabel } from '../../../shared/quizPictureOptions'

// Styling lives in quizStyles.js. Re-exported here so the quiz components can keep a
// single import, and so this split stayed a move rather than a rename of 40 call sites.
export {
  CONFIDENCE_COLOURS,
  OPTION_COLOURS,
  OPTION_VERDICT_COLOURS,
  QUIZ_PICTURE_HEIGHT,
  baseStyles,
  interactionStyles,
  confidenceStyles,
} from './quizStyles'

// An option's words for cards and labels. A word option (no picture) is unchanged from before
// picture options: its text as a string ('' when blank or missing). A picture option: its caption,
// else the picture's alt text, else its id. '' when no option has that id.
export function getQuizOptionText(task, answerId) {
  const option = task?.options?.find((candidate) => candidate.id === answerId)
  if (!optionHasPicture(option)) return normalizeQuizAnswerText(option?.text ?? '')
  if (typeof option.text === 'string' && option.text.trim())
    return normalizeQuizAnswerText(option.text)
  return quizOptionLabel(option)
}

export function normalizeQuizAnswerText(value) {
  return String(value ?? '').replace(/\\r\\n|\\n|\\r/g, '\n')
}

export function fitScratchQuizScale({
  preferredScale,
  availableWidth,
  availableHeight,
  contentWidth,
  contentHeight,
  minimumScale = 0.6,
}) {
  const limits = [preferredScale]
  if (availableWidth > 0 && contentWidth > 0)
    limits.push(Math.max(0, (availableWidth - 8) / contentWidth))
  if (availableHeight > 0 && contentHeight > 0)
    limits.push(Math.max(0, (availableHeight - 32) / contentHeight))
  return Math.max(minimumScale, Math.min(...limits))
}

// Picture cards stack in one column when the options frame is under 480px wide, and go back to
// side by side only above 520px: the gap stops a frame whose width follows the layout (a
// shrink-to-fit parent, a scrollbar) flipping back and forth. A width of 0 (not laid out yet,
// or hidden) keeps the current layout.
export const PICTURE_NARROW_BELOW = 480
export const PICTURE_WIDE_ABOVE = 520
export function nextPictureNarrow(wasNarrow, width) {
  if (!(width > 0)) return wasNarrow
  return wasNarrow ? width <= PICTURE_WIDE_ABOVE : width < PICTURE_NARROW_BELOW
}

// A loaded picture's shape, for its card's box (--quiz-picture-aspect, quizStyles pictureBox):
// width over height, from 1.1 (a square Stage picture's card hugs it, with a little room; a tall
// picture keeps a card wide enough to tap) to 3:1. null when the size is unknown (an SVG with no
// width and height), which keeps the 4:3 default the box has until the image loads.
export const PICTURE_ASPECT_MIN = 1.1
export const PICTURE_ASPECT_MAX = 3
export function pictureBoxAspect(naturalWidth, naturalHeight) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return null
  return Math.min(PICTURE_ASPECT_MAX, Math.max(PICTURE_ASPECT_MIN, naturalWidth / naturalHeight))
}

const OPTIONS_MIN_SCALE = 0.65
const OPTIONS_SCALE_STEP = 0.05
const OPTIONS_MAX_SHRINK_STEPS = 8

// Steps a font-size scale down (via setScale) until isOverflowing() reports the
// content fits, or the floor/step budget is reached. Used to shrink quiz answer
// options to fit the space left after the question, without shrinking the question.
export function shrinkToFit({
  setScale,
  isOverflowing,
  minScale = OPTIONS_MIN_SCALE,
  step = OPTIONS_SCALE_STEP,
  maxSteps = OPTIONS_MAX_SHRINK_STEPS,
}) {
  let scale = 1
  setScale(scale)
  for (let i = 0; i < maxSteps && scale > minScale && isOverflowing(); i++) {
    scale = Math.max(minScale, scale - step)
    setScale(scale)
  }
  return scale
}

export function fillDragTileMatchesBlank(tile, blank) {
  return tile?.text === blank?.answer
}

export function typedValueMatchesBlank(value, blank) {
  return answerTextMatches(value, blank?.answer)
}

// Parses fill-blank text into tokens:
//   {type:'text'|'code'|'blank', text?, lang?, blankId?}
//   {type:'codeBlock', lang, parts:[{type:'codeText'|'blank', text?, blankId?}]}
// Triple-backtick blocks are detected before single backticks so ``` is never
// misread as a code span. Blanks inside code blocks keep the pre-formatted
// indentation intact because parts render as raw text nodes inside <pre>.
export function parseFillBlankSegments(text, blanks) {
  const tokens = []
  let blankCount = 0
  let i = 0

  while (i < text.length) {
    if (text.startsWith('___', i)) {
      tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
      blankCount++
      i += 3
      continue
    }

    if (text.startsWith('```', i)) {
      const closeIdx = text.indexOf('\n```', i + 3)
      if (closeIdx !== -1) {
        const blockContent = text.slice(i + 3, closeIdx)
        const nlIdx = blockContent.indexOf('\n')
        const lang = nlIdx !== -1 ? blockContent.slice(0, nlIdx).trim() : ''
        const body = nlIdx !== -1 ? blockContent.slice(nlIdx + 1) : blockContent
        const bodyNoTrail = body.replace(/\n$/, '')
        const parts = []
        const bodyParts = bodyNoTrail.split('___')
        bodyParts.forEach((part, j) => {
          if (part) parts.push({ type: 'codeText', text: part })
          if (j < bodyParts.length - 1) {
            parts.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
            blankCount++
          }
        })
        tokens.push({ type: 'codeBlock', lang, parts })
        i = closeIdx + 4
        continue
      }
    }

    const close = text[i] === '`' ? text.indexOf('`', i + 1) : -1
    if (close !== -1) {
      const raw = text.slice(i + 1, close)
      const langMatch = raw.match(/^(python|html|css|js):/)
      const lang = langMatch ? langMatch[1] : null
      const body = lang ? raw.slice(lang.length + 1) : raw
      if (body.includes('___')) {
        const codeParts = body.split('___')
        codeParts.forEach((part, j) => {
          if (part) tokens.push({ type: 'code', lang, text: part })
          if (j < codeParts.length - 1) {
            tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
            blankCount++
          }
        })
      } else {
        tokens.push({ type: 'code', lang, text: body })
      }
      i = close + 1
      continue
    }

    const textStart = i
    i++
    while (
      i < text.length &&
      !text.startsWith('___', i) &&
      !text.startsWith('```', i) &&
      text[i] !== '`'
    )
      i++
    tokens.push({ type: 'text', text: text.slice(textStart, i) })
  }

  return tokens
}

export function QuestionPanel({ task }) {
  if (!task?.explainer) return null
  return React.createElement(
    'div',
    { style: baseStyles.question },
    React.createElement('div', { style: baseStyles.questionLabel }, task.title || 'Question'),
    React.createElement(
      'div',
      // quiz-question-body enlarges Scratch block pictures in the question (index.css).
      { style: baseStyles.questionBody, className: 'quiz-question-body' },
      React.createElement(MarkdownRenderer, {
        title: task.title,
        content: task.explainer,
        textScale: 1.15,
        imageMaxHeight: 'min(240px, 32vh)',
      })
    )
  )
}
