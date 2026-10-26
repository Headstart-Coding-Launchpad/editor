// Pure logic for the Next Word activity: task validation, the voice (which text the model learned
// from), the guessing round and the state shape. Node-safe (no React, JSX or DOM) so the CLI, the
// Builder and print share it. The word-pair model itself is in ./ngram.js.
//
// The round: the student writes (or pastes) their own sentences, the model learns from them as
// they go, and "Next word" adds one word to a sentence. The core is "Guess what it says next"
// `guesses` times (default 5): tap the word you think is MOST LIKELY to come next, then press. A
// guess is right when the tapped word is (one of) the likeliest by count; the word the model then
// picks at random may differ, and still joins the sentence. A guess counts whether it was right
// or wrong; the task passes when the core is done, then free play is bonus. A sentence ends when
// the model picks ".", "!" or "?" (kept as tokens by ./ngram.js).
import {
  DEFAULT_TEMPERATURE,
  MAX_GENERATED_CHARS,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MAX_TEXT_CHARS,
  MIN_TEMPERATURE,
  endsSentence,
  isEndMark,
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
  // A finished sentence has nothing to guess: the next press starts a new one.
  if (endsSentence(sentence)) return { word: '', total: 0, options: [] }
  const info = nextOptions(model, lastWordOf(sentence))
  return { ...info, options: info.options.slice(0, MAX_CANDIDATES) }
}

// The first word of a new sentence: one of the busiest words that starts a sentence in the text
// (the first word, or a word that follows a sentence end), else one of the busiest words overall.
// null if there are none.
export function startWordOf(model, random = Math.random) {
  const openers = new Set(nextOptions(model, '.').options.map((option) => option.word))
  if (model?.firstWord) openers.add(model.firstWord)
  const busiest = startingWords(model, MAX_CANDIDATES * 8)
  const starters = busiest.filter((word) => openers.has(word)).slice(0, MAX_CANDIDATES)
  const pool = starters.length > 0 ? starters : busiest.slice(0, MAX_CANDIDATES)
  if (pool.length === 0) return null
  return pool[Math.floor(random() * pool.length)]
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
    generated: 0,
    sentence: '',
    pending: '',
    guesses: 0,
    right: 0,
    history: '',
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
          best: String(raw.last.best ?? raw.last.picked ?? '').slice(0, 40),
          bestCount: count(raw.last.bestCount),
          total: count(raw.last.total),
          pickedBest: raw.last.pickedBest !== false,
        }
      : null
  return {
    v: 2,
    voice: typeof raw.voice === 'string' ? raw.voice : base.voice,
    own,
    ownWords: own ? tokenise(own).length : count(raw.ownWords),
    generated: count(raw.generated),
    sentence: typeof raw.sentence === 'string' ? raw.sentence.slice(0, MAX_GENERATED_CHARS) : '',
    pending: typeof raw.pending === 'string' ? raw.pending.slice(0, 40) : '',
    guesses,
    right: Math.min(count(raw.right), guesses),
    history:
      typeof raw.history === 'string'
        ? raw.history.replace(/[^rw]/g, '').slice(0, MAX_GUESSES)
        : '',
    last: last && last.picked ? last : null,
    temperature: Number.isFinite(raw.temperature)
      ? Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, raw.temperature))
      : DEFAULT_TEMPERATURE,
  }
}

// What leaves the device (Firebase, the teacher card, the attempt log): the whole state, the
// student's own sentences included (the tutor sees all student work live), plus the word count.
export function sharedState(state) {
  return { ...normalizeNextWordState({}, state), ownWords: ownWordsOf(state) }
}

// How a guess scored against the odds the student was looking at: `info` is candidatesOf's
// { total, options } for the step. Right when the tapped word is one of the likeliest (ties
// count). Returns { ok, best, bestCount, total, pickedBest } or null when there was no guess or
// nothing to compare. `best` is the guess itself when right, else the likeliest word.
export function gradeGuess(info, guess, picked) {
  const options = info?.options ?? []
  if (!guess || options.length === 0) return null
  const top = options[0].count
  const tied = options.filter((option) => option.count === top).map((option) => option.word)
  const ok = tied.includes(guess)
  return {
    ok,
    best: ok ? guess : options[0].word,
    bestCount: top,
    total: info.total,
    pickedBest: tied.includes(picked),
  }
}

// Adds the landed word to the state. `guess` is the word the student tapped ('' for none) and
// `grade` is gradeGuess's result for it; a guess is counted (right or wrong). An end mark joins
// the word before it, and a word that follows a finished sentence starts a new one. A null `word`
// (nothing could be picked) changes nothing.
export function applyStep(state, word, guess = '', grade = null) {
  if (!word) return state
  const base = state ?? {}
  const before = String(base.sentence ?? '')
  const words = endsSentence(before) ? [] : before.split(' ').filter(Boolean)
  if (isEndMark(word)) {
    if (words.length > 0) words[words.length - 1] += word
  } else {
    words.push(word)
  }
  // Words the model has added while it was learning from the student's own writing (at least two
  // words, so it has pairs to pick from): the Storyteller badge. Counted over the whole task, so
  // it survives Start again and a switch of voice.
  const fromOwnWords = base.voice === OWN_VOICE && tokenise(String(base.own ?? '')).length >= 2
  const guessed = typeof guess === 'string' && guess !== ''
  const ok = guessed && (grade ? grade.ok : guess === word)
  const history = String(base.history ?? '')
  return {
    ...base,
    generated: count(base.generated) + (fromOwnWords ? 1 : 0),
    sentence: clipSentence(words),
    pending: '',
    guesses: guessed ? count(base.guesses) + 1 : count(base.guesses),
    right: ok ? count(base.right) + 1 : count(base.right),
    history: guessed ? `${history}${ok ? 'r' : 'w'}`.slice(0, MAX_GUESSES) : history,
    last: guessed
      ? {
          guess,
          picked: word,
          ok,
          best: grade?.best ?? word,
          bestCount: grade?.bestCount ?? 0,
          total: grade?.total ?? 0,
          pickedBest: grade ? grade.pickedBest : ok,
        }
      : null,
  }
}

// One entry per core guess, for the progress dots: 'right', 'wrong' or 'todo'. The history
// string is the truth; an older state without it hands its rights out first.
export function dotsOf(task, state = {}) {
  const { goal, core, right } = gradeTask(task, state)
  const history = typeof state?.history === 'string' ? state.history : ''
  let spare = Math.max(0, right - [...history.slice(0, core)].filter((c) => c === 'r').length)
  return Array.from({ length: goal }, (_, i) => {
    if (i >= core) return 'todo'
    if (history[i] === 'r') return 'right'
    if (history[i] === 'w') return 'wrong'
    if (spare > 0) {
      spare -= 1
      return 'right'
    }
    return 'wrong'
  })
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

// Live badges (the activity's `badgeResult`), from the passing submission (the shared form): the
// round's guesses and how many were right (both capped at the core), how many words the student
// has written of their own, and how many words the model added from them.
export function nextWordBadgeResult(task, state) {
  const { goal, core, right } = gradeTask(task, state)
  return {
    core: goal,
    tries: core,
    right: Math.min(right, core),
    ownWords: ownWordsOf(state),
    generated: count(state?.generated),
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
    history: 'r'.repeat(goal),
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
