// Pure logic for the Next Word activity: task validation, the voice (which text the model learned
// from), the guessing round and the state shape. Node-safe (no React, JSX or DOM) so the CLI, the
// Builder and print share it. The word-pair model itself is in ./ngram.js.
//
// The round: the student writes (or pastes) their own sentences, the model learns from them as
// they go, and "Next word" adds one word to a sentence. The core is "Guess what it says next"
// `guesses` times (default 5): tap the word you think it will pick, then press. A guess counts
// whether it was right or wrong; the task passes when the core is done, then free play is bonus.
import {
  DEFAULT_TEMPERATURE,
  MAX_GENERATED_CHARS,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MAX_TEXT_CHARS,
  MIN_TEMPERATURE,
  lastWordOf,
  modelFor,
  nextOptions,
  startingWords,
  tokenise,
} from './ngram.js'

export const PANELS = ['stats', 'silly', 'voices']
export const DEFAULT_PANELS = ['stats']
export const DEFAULT_GUESSES = 5
export const MAX_GUESSES = 20
export const MAX_CANDIDATES = 5
export const OWN_VOICE = 'own'
export const OWN_LABEL = 'My writing'
export const OWN_EMOJI = '✏️'
export const DEFAULT_TEXT_EMOJI = '📖'
const MAX_EMOJI_CHARS = 12

const isBlank = (value) => typeof value !== 'string' || !value.trim()

// The texts a task offers as voices, as { title, body, emoji } (tolerant of a missing list).
export function textsOf(task) {
  return (Array.isArray(task?.texts) ? task.texts : []).map((text) => ({
    title: String(text?.title ?? ''),
    body: String(text?.body ?? ''),
    emoji: typeof text?.emoji === 'string' && text.emoji.trim() ? text.emoji : DEFAULT_TEXT_EMOJI,
  }))
}

// Which extra parts show. Missing -> ['stats']; unknown values are dropped here (validation
// reports them). Order follows PANELS so the screen is always laid out the same way.
export function panelsOf(task) {
  if (!Array.isArray(task?.panels)) return [...DEFAULT_PANELS]
  return PANELS.filter((panel) => task.panels.includes(panel))
}

// How many guesses make the round's core.
export function guessGoalOf(task) {
  const goal = task?.guesses
  return Number.isInteger(goal) && goal >= 1 && goal <= MAX_GUESSES ? goal : DEFAULT_GUESSES
}

// The voices a student can switch between: the lesson's texts, then their own writing. Without
// the `voices` panel there is only their own writing.
export function voicesOf(task) {
  const own = { id: OWN_VOICE, label: OWN_LABEL, emoji: OWN_EMOJI, body: '' }
  if (!panelsOf(task).includes('voices')) return [own]
  return [
    ...textsOf(task).map((text, i) => ({
      id: `text:${i}`,
      label: text.title,
      emoji: text.emoji,
      body: text.body,
    })),
    own,
  ]
}

// The voice in use: state.voice when it is on offer, otherwise the student's own writing.
export function voiceOf(task, state) {
  const voices = voicesOf(task)
  return voices.find((voice) => voice.id === state?.voice) ?? voices[voices.length - 1]
}

// The text the model learns from right now.
export function modelBodyOf(task, state) {
  const voice = voiceOf(task, state)
  return voice.id === OWN_VOICE ? String(state?.own ?? '') : voice.body
}

// The model, or null when there are fewer than two words (no word pairs yet).
export function activeModel(task, state) {
  const body = modelBodyOf(task, state)
  return tokenise(body).length >= 2 ? modelFor(body) : null
}

// How many words of their own the student has written. The shared form carries only this number.
export function ownWordsOf(state) {
  if (typeof state?.own === 'string' && state.own) return tokenise(state.own).length
  return Number.isInteger(state?.ownWords) && state.ownWords > 0 ? state.ownWords : 0
}

// The words the model might pick after the sentence so far, most likely first (up to
// MAX_CANDIDATES): { word, total, options: [{ word, count, share }] }.
export function candidatesOf(model, sentence) {
  const info = nextOptions(model, lastWordOf(sentence))
  return { ...info, options: info.options.slice(0, MAX_CANDIDATES) }
}

// The first word of a new sentence: one of the model's busiest words. null if there are none.
export function startWordOf(model, random = Math.random) {
  const starters = startingWords(model, MAX_CANDIDATES)
  if (starters.length === 0) return null
  return starters[Math.floor(random() * starters.length)]
}

// The sentence kept to MAX_GENERATED_CHARS by dropping words from the front.
function clipSentence(words) {
  const list = [...words]
  while (list.length > 1 && list.join(' ').length > MAX_GENERATED_CHARS) list.shift()
  return list.join(' ')
}

// The blank state.
export function initialNextWordState(task) {
  const voices = voicesOf(task)
  return {
    v: 2,
    voice: voices[0].id,
    own: '',
    ownWords: 0,
    sentence: '',
    pending: '',
    guesses: 0,
    right: 0,
    last: null,
    temperature: DEFAULT_TEMPERATURE,
  }
}

const count = (value, max = 9999) =>
  Number.isInteger(value) && value > 0 ? Math.min(value, max) : 0

// Tolerant: reads the device's form, the shared form (no own text) and the old v1 form.
export function normalizeNextWordState(task, raw) {
  const base = initialNextWordState(task)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const own = typeof raw.own === 'string' ? raw.own.slice(0, MAX_PASTE_CHARS) : ''
  const guesses = count(raw.guesses)
  const last =
    raw.last && typeof raw.last === 'object'
      ? {
          guess: String(raw.last.guess ?? '').slice(0, 40),
          picked: String(raw.last.picked ?? '').slice(0, 40),
          ok: raw.last.ok === true,
        }
      : null
  return {
    v: 2,
    voice: typeof raw.voice === 'string' ? raw.voice : base.voice,
    own,
    ownWords: own ? tokenise(own).length : count(raw.ownWords),
    sentence: typeof raw.sentence === 'string' ? raw.sentence.slice(0, MAX_GENERATED_CHARS) : '',
    pending: typeof raw.pending === 'string' ? raw.pending.slice(0, 40) : '',
    guesses,
    right: Math.min(count(raw.right), guesses),
    last: last && last.picked ? last : null,
    temperature: Number.isFinite(raw.temperature)
      ? Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, raw.temperature))
      : DEFAULT_TEMPERATURE,
  }
}

// What leaves the device (Firebase, the teacher card, the attempt log): everything except the
// student's own sentences, which stay on the device. The word count goes instead.
export function sharedState(state) {
  return { ...normalizeNextWordState({}, state), ownWords: ownWordsOf(state) }
}

// Adds the landed word to the state. `guess` is the word the student tapped ('' for none); a
// guess is counted (right or wrong). A null `word` (nothing could be picked) changes nothing.
export function applyStep(state, word, guess = '') {
  if (!word) return state
  const base = state ?? {}
  const words = String(base.sentence ?? '')
    .split(' ')
    .filter(Boolean)
  const guessed = typeof guess === 'string' && guess !== ''
  const ok = guessed && guess === word
  return {
    ...base,
    sentence: clipSentence([...words, word]),
    pending: '',
    guesses: guessed ? count(base.guesses) + 1 : count(base.guesses),
    right: ok ? count(base.right) + 1 : count(base.right),
    last: guessed ? { guess, picked: word, ok } : null,
  }
}

// Whole-task progress: { goal, guesses, right, core, bonus, done }.
export function gradeTask(task, state = {}) {
  const goal = guessGoalOf(task)
  const guesses = count(state?.guesses)
  return {
    goal,
    guesses,
    right: Math.min(count(state?.right), guesses),
    core: Math.min(guesses, goal),
    bonus: Math.max(0, guesses - goal),
    done: guesses >= goal,
  }
}

// The state that completes the round (for Complete / show answers).
export function solutionStateFor(task) {
  const goal = guessGoalOf(task)
  return {
    ...initialNextWordState(task),
    sentence: 'the cat sat on the mat',
    guesses: goal,
    right: goal,
  }
}

// A friendly name for the Sensible <-> Silly slider.
export function sillyLabel(temperature) {
  if (!(temperature > 0.05)) return 'Super sensible'
  if (temperature < 0.6) return 'Sensible'
  if (temperature <= 1.2) return 'A bit silly'
  if (temperature <= 1.7) return 'Silly'
  return 'Super silly'
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateNextWordTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  if (task?.texts != null && !Array.isArray(task.texts)) {
    errors.push(`${where}: texts must be a list.`)
  }
  const texts = Array.isArray(task?.texts) ? task.texts : []
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
    if (
      text?.emoji != null &&
      (typeof text.emoji !== 'string' || !text.emoji.trim() || text.emoji.length > MAX_EMOJI_CHARS)
    ) {
      errors.push(`${label}: emoji must be one short emoji.`)
    }
  })
  if (task?.panels != null) {
    if (!Array.isArray(task.panels)) {
      errors.push(`${where}: panels must be a list.`)
    } else {
      for (const panel of task.panels) {
        if (!PANELS.includes(panel)) {
          errors.push(
            `${where}: panels has "${String(panel)}", which is not one of ${PANELS.join(', ')}.`
          )
        }
      }
    }
  }
  if (
    task?.guesses != null &&
    (!Number.isInteger(task.guesses) || task.guesses < 1 || task.guesses > MAX_GUESSES)
  ) {
    errors.push(`${where}: guesses must be a whole number from 1 to ${MAX_GUESSES}.`)
  }
  return errors
}
