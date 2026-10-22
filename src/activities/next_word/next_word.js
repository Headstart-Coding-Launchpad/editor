// Pure logic for the Next Word activity: task validation, the chosen text, grading and hints.
// Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it. The word-pair
// model itself is in ./ngram.js.
//
// Marking rule: the text the STUDENT chose builds the model, and an item is right when the
// student's revealed prediction is the model's most likely next word after the last word of the
// prompt. If two or more words tie for most likely, any of them is right. `answer` is the
// author's expected word for the FIRST text in `texts`; validation checks it really is a most
// likely word of that text, so on the first text marking by the model and marking by `answer`
// agree. On any other text (or a pasted one) only the model decides.
import {
  DEFAULT_TEMPERATURE,
  MAX_PASTE_CHARS,
  MAX_TEXT_CHARS,
  lastWordOf,
  modelFor,
  nextOptions,
  tokenise,
  topWords,
} from './ngram.js'

export const NO_TEXT_LABEL = 'No text yet'
export const PASTED_LABEL = 'Your own text'

const isBlank = (value) => typeof value !== 'string' || !value.trim()

// The texts a task offers, as { title, body } (tolerant of a missing or malformed list).
export function textsOf(task) {
  return (Array.isArray(task?.texts) ? task.texts : []).map((text) => ({
    title: String(text?.title ?? ''),
    body: String(text?.body ?? ''),
  }))
}

// The text the student chose: { label, body, source, index? } or null.
//   state.source 'text'  -> task.texts[state.index]
//   state.source 'paste' -> state.pasted (only when the task has allowPaste)
export function chosenText(task, state) {
  if (state?.source === 'paste' && task?.allowPaste === true) {
    const pasted = String(state.pasted ?? '').slice(0, MAX_PASTE_CHARS)
    return pasted.trim() ? { label: PASTED_LABEL, body: pasted, source: 'paste' } : null
  }
  if (state?.source === 'text') {
    const text = textsOf(task)[state.index]
    if (text) return { label: text.title, body: text.body, source: 'text', index: state.index }
  }
  return null
}

// The blank state of one item. `guess` is what the student typed; `revealed` is set when they
// press Reveal (an item is only marked once revealed).
export function emptyItemState() {
  return { guess: '', revealed: false }
}

// The blank state: no text chosen yet, nothing typed, nothing revealed.
export function initialNextWordState(task) {
  return {
    v: 1,
    source: null,
    index: 0,
    pasted: '',
    probe: '',
    temperature: DEFAULT_TEMPERATURE,
    generated: '',
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, emptyItemState()])),
  }
}

export function itemStateOf(state, item) {
  const stored = state?.items?.[item?.id]
  return { guess: String(stored?.guess ?? ''), revealed: stored?.revealed === true }
}

// The author's answer for one item, in the shape the student produces it.
export function solutionFor(task, item) {
  return { guess: String(item?.answer ?? ''), revealed: true }
}

// The state that answers every item, using the first text.
export function solutionStateFor(task) {
  return {
    v: 1,
    source: 'text',
    index: 0,
    pasted: '',
    probe: '',
    temperature: 1,
    generated: '',
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateNextWordTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const texts = Array.isArray(task?.texts) ? task.texts : []
  if (texts.length === 0) errors.push(`${where}: next_word task needs at least one text in texts.`)
  texts.forEach((text, i) => {
    const label = `${where} text ${i + 1}`
    if (isBlank(text?.title)) errors.push(`${label}: title is required.`)
    if (isBlank(text?.body)) {
      errors.push(`${label}: body is required.`)
    } else if (text.body.length > MAX_TEXT_CHARS) {
      errors.push(`${label}: body is longer than ${MAX_TEXT_CHARS} characters.`)
    } else if (tokenise(text.body).length < 2) {
      errors.push(`${label}: body needs at least 2 words.`)
    }
  })
  for (const field of ['allowPaste', 'showTemperature']) {
    if (task?.[field] != null && typeof task[field] !== 'boolean') {
      errors.push(`${where}: ${field} must be true or false.`)
    }
  }
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: next_word task needs at least one item.`)
  const model = texts.length && !isBlank(texts[0]?.body) ? modelFor(texts[0].body) : null
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    const id = item?.id
    if (id == null || id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(id))) errors.push(`${label}: id "${id}" is used more than once.`)
    seen.add(String(id))
    const promptWord = lastWordOf(item?.prompt)
    if (isBlank(item?.prompt) || !promptWord) errors.push(`${label}: prompt is required.`)
    const answerWords = tokenise(item?.answer)
    if (item?.answer == null || String(item.answer).trim() === '' || answerWords.length === 0) {
      errors.push(`${label}: answer is required.`)
    } else if (answerWords.length > 1) {
      errors.push(`${label}: answer must be one word.`)
    } else if (model && promptWord) {
      const top = topWords(model, promptWord)
      if (top.length === 0) {
        errors.push(`${label}: "${promptWord}" never has a word after it in the first text.`)
      } else if (!top.includes(answerWords[0])) {
        errors.push(
          `${label}: answer "${answerWords[0]}" is not the most likely word after "${promptWord}" in the first text (it is "${top.join('" or "')}").`
        )
      }
    }
  })
  return errors
}

// Grade one item against the whole state (the chosen text belongs to the task, not the item).
// Hints are short, plain words for 8-14 year olds and never give the answer away.
// Returns { correct, hint, top } where `top` are the model's most likely words (only filled
// once the item is revealed, so a caller can't leak them early).
export function gradeItem(task, item, state) {
  const own = itemStateOf(state, item)
  const text = chosenText(task, state)
  if (!text)
    return { correct: false, hint: 'Pick a text first, then make your prediction.', top: [] }
  const guessWords = tokenise(own.guess)
  if (guessWords.length === 0) {
    return { correct: false, hint: 'Type your prediction first.', top: [] }
  }
  if (guessWords.length > 1) return { correct: false, hint: 'Type just one word.', top: [] }
  if (!own.revealed) {
    return { correct: false, hint: 'Press Reveal to see if you were right.', top: [] }
  }
  const promptWord = lastWordOf(item?.prompt)
  const top = topWords(modelFor(text.body), promptWord)
  if (top.length === 0) {
    return {
      correct: false,
      hint: `In this text, nothing comes after "${promptWord}". Pick another text to try this one.`,
      top,
    }
  }
  if (top.includes(guessWords[0])) return { correct: true, hint: null, top }
  return {
    correct: false,
    hint: 'Not quite. The most likely word has the longest bar and the biggest number. Try again.',
    top,
  }
}

// Whole-task progress for the teacher card and completion: { total, correct, revealed, done }.
export function gradeTask(task, state = {}) {
  const items = task?.items ?? []
  const correct = items.filter((item) => gradeItem(task, item, state).correct)
  const revealed = items.filter((item) => itemStateOf(state, item).revealed)
  return {
    total: items.length,
    correct: correct.length,
    revealed: revealed.length,
    done: items.length > 0 && correct.length === items.length,
  }
}

// The bars for one prompt in the chosen text: { word, total, options } (nextOptions).
export function optionsForPrompt(task, state, prompt) {
  const text = chosenText(task, state)
  return text ? nextOptions(modelFor(text.body), lastWordOf(prompt)) : null
}
