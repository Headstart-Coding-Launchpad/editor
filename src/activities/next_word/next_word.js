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
  DEFAULT_LOOK_BACK,
  DEFAULT_TEMPERATURE,
  MAX_GENERATED_CHARS,
  MAX_LOOK_BACK,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MAX_TEXT_CHARS,
  MAX_WRITE_TEXT_CHARS,
  MIN_TEMPERATURE,
  endsSentence,
  isEndMark,
  joinTokens,
  lastWordOf,
  modelFor,
  normaliseWord,
  pickOption,
  tokeniseWithEnds,
  nextOptions,
  nextOptionsLookBack,
  startingWords,
  tokenise,
} from './ngram.js'

export { DEFAULT_LOOK_BACK, MAX_LOOK_BACK }
export const PANELS = ['stats', 'silly', 'voices', 'lookback']
export const DEFAULT_PANELS = ['stats']
export const DEFAULT_GUESSES = 5
export const MAX_GUESSES = 20
export const MAX_CANDIDATES = 5
// Write mode (Go auto-write): the bot writes a sentence word by word and the student keeps cards.
export const MODES = ['guess', 'write']
export const CARDS = ['headline', 'post', 'commentary']
export const DEFAULT_CARD = 'headline'
export const DEFAULT_MAX_WORDS = 15
export const MIN_MAX_WORDS = 3
export const MAX_MAX_WORDS = 40
export const DEFAULT_PASS_AT = 3
export const MAX_PASS_AT = 10
export const WRITE_LOOK_BACK = 2
export const MAX_CARDS = 10
export const MAX_CARD_CHARS = 200
export const OWN_VOICE = 'own'
export const OWN_LABEL = 'My writing'
export const OWN_EMOJI = '✏️'
export const DEFAULT_TEXT_EMOJI = '📖'
const MAX_EMOJI_CHARS = 12

export const textCapOf = (task) => (task?.mode === 'write' ? MAX_WRITE_TEXT_CHARS : MAX_TEXT_CHARS)
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

// 'write' (Go auto-write) or 'guess' (the guessing round, the default).
export function modeOf(task) {
  return task?.mode === 'write' ? 'write' : 'guess'
}
export const isWriteMode = (task) => modeOf(task) === 'write'

const wholeIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max

export function maxWordsOf(task) {
  return wholeIn(task?.maxWords, MIN_MAX_WORDS, MAX_MAX_WORDS) ? task.maxWords : DEFAULT_MAX_WORDS
}
export function cardOf(task) {
  return CARDS.includes(task?.card) ? task.card : DEFAULT_CARD
}
export function passAtOf(task) {
  return wholeIn(task?.passAt, 1, MAX_PASS_AT) ? task.passAt : DEFAULT_PASS_AT
}

// The most words back the student can look: maxLookBack (1 to 3, default 3).
export function maxLookBackOf(task) {
  const max = task?.maxLookBack
  return Number.isInteger(max) && max >= 1 && max <= MAX_LOOK_BACK ? max : MAX_LOOK_BACK
}

// The look-back a task starts at: lookBack, kept within maxLookBack (default 1).
export function startLookBackOf(task) {
  const start = task?.lookBack
  const ok = Number.isInteger(start) && start >= 1 && start <= MAX_LOOK_BACK
  const fallback = isWriteMode(task) ? WRITE_LOOK_BACK : DEFAULT_LOOK_BACK
  return Math.min(ok ? start : fallback, maxLookBackOf(task))
}

// The look-back in use: the student's choice with the lookback panel, else the task's own.
export function lookBackOf(task, state) {
  const start = startLookBackOf(task)
  if (!panelsOf(task).includes('lookback')) return start
  const chosen = state?.lookBack
  return Number.isInteger(chosen) && chosen >= 1 ? Math.min(chosen, maxLookBackOf(task)) : start
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
  if (isWriteMode(task)) {
    // The pack is the voice; what the student writes is added to it (see modelBodyOf), so My
    // writing is not a voice of its own here (unless there is no pack at all).
    const packs = textsOf(task).map((text, i) => ({
      id: `text:${i}`,
      label: text.title,
      emoji: text.emoji,
      body: text.body,
    }))
    if (packs.length === 0) return [own]
    return panelsOf(task).includes('voices') ? packs : packs.slice(0, 1)
  }
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
  if (voice.id === OWN_VOICE) return String(state?.own ?? '')
  // Write mode: the student's own sentences are added to the pack.
  return isWriteMode(task) && state?.own ? `${voice.body} ${state.own}` : voice.body
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
// With lookBack above 1 the result also carries { asked, used, fellBack } (see
// ngram.nextOptionsLookBack); with 1 it is exactly as before.
export function candidatesOf(model, sentence, lookBack = DEFAULT_LOOK_BACK) {
  // A finished sentence has nothing to guess: the next press starts a new one.
  if (endsSentence(sentence)) return { word: '', total: 0, options: [] }
  if (lookBack > 1) {
    const longer = nextOptionsLookBack(model, sentence, lookBack)
    return { ...longer, options: longer.options.slice(0, MAX_CANDIDATES) }
  }
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

// ---- Write mode -------------------------------------------------------------------------------

// The training sentences of a text, each as its normalised words joined by spaces.
export function trainingSentencesOf(text) {
  const out = []
  let words = []
  const flush = () => {
    if (words.length) out.push(words.join(' '))
    words = []
  }
  for (const token of tokeniseWithEnds(text)) {
    if (isEndMark(token)) flush()
    else words.push(token)
  }
  flush()
  return out
}

// True when `output` is a training sentence word for word (case and punctuation ignored).
export function isCopiedSentence(text, output) {
  const words = tokenise(output)
  if (words.length < 2) return false
  return trainingSentencesOf(text).includes(words.join(' '))
}

// Words that start sentences in the text, busiest first (for the "Start with" picker).
export function openingWordsOf(model, limit = 8) {
  const count = new Map()
  const add = (word, n) => word && !isEndMark(word) && count.set(word, (count.get(word) ?? 0) + n)
  add(model?.firstWord, 1)
  for (const option of nextOptions(model, '.').options) add(option.word, option.count)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([word]) => word)
}

// Go: writes a whole sentence from the model, as a list of tokens (words, then an end mark if it
// ended). Starts at `start` (a word) or one of the busiest sentence starters. Stops at a sentence
// end, a dead end or `maxWords` words. Pure: the UI reveals the tokens one at a time.
export function writeTokens(
  model,
  {
    start = '',
    lookBack = WRITE_LOOK_BACK,
    temperature = DEFAULT_TEMPERATURE,
    maxWords = DEFAULT_MAX_WORDS,
    random = Math.random,
  } = {}
) {
  const first = normaliseWord(start) || startWordOf(model, random)
  if (!first) return []
  const tokens = [first]
  let words = 1
  while (words < maxWords) {
    const info = nextOptionsLookBack(model, joinTokens(tokens), lookBack)
    const pick = pickOption(info.options, temperature, random)
    if (!pick) break
    tokens.push(pick.word)
    if (isEndMark(pick.word)) break
    words += 1
  }
  return tokens
}

// writeTokens as text; `copied` when `source` (the training text) is given and the output is one
// of its sentences word for word.
export function writeText(model, options = {}) {
  const text = joinTokens(writeTokens(model, options))
  return { text, copied: options.source != null ? isCopiedSentence(options.source, text) : false }
}

// Why the word at `index` of a written text was picked: the context it looked at and the counts.
// { first: true } for the first word. Else { context, used, fellBack, word, count, total } (count
// 0 when the model cannot explain it, for example after the student changed what it reads).
export function whyWord(model, text, index, lookBack = WRITE_LOOK_BACK) {
  const words = String(text ?? '')
    .split(' ')
    .filter(Boolean)
  if (index < 0 || index >= words.length) return null
  const word = normaliseWord(words[index])
  if (index === 0) return { first: true, word }
  const info = nextOptionsLookBack(model, words.slice(0, index).join(' '), lookBack)
  const found = info.options.find((option) => option.word === word)
  return {
    first: false,
    word,
    context: info.word,
    used: info.used,
    fellBack: info.fellBack,
    count: found?.count ?? 0,
    total: info.total,
  }
}

// Kept cards: { text, copied, lookBack }, tolerant of anything.
function cleanCards(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((card) => card && typeof card.text === 'string' && card.text.trim())
    .slice(0, MAX_CARDS)
    .map((card) => ({
      text: card.text.slice(0, MAX_CARD_CHARS),
      copied: card.copied === true,
      lookBack: Number.isInteger(card.lookBack) && card.lookBack >= 1 ? card.lookBack : 1,
    }))
}

// Adds the finished output to the kept cards (once per output). Cap 10 cards.
export function keepCard(task, state) {
  const base = state ?? {}
  const text = String(base.sentence ?? '').trim()
  if (!text || base.kept === true || !base.finished) return base
  const cards = cleanCards(base.cards)
  if (cards.length >= MAX_CARDS) return base
  return {
    ...base,
    kept: true,
    cards: [
      ...cards,
      {
        text: text.slice(0, MAX_CARD_CHARS),
        copied: base.copied === true,
        lookBack: base.usedLookBack || lookBackOf(task, base),
      },
    ],
  }
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
    lookBack: startLookBackOf(task),
    startWord: '',
    cards: [],
    runs: 0,
    copies: 0,
    finished: false,
    copied: false,
    kept: false,
    usedLookBack: 0,
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
    lookBack:
      Number.isInteger(raw.lookBack) && raw.lookBack >= 1
        ? Math.min(raw.lookBack, maxLookBackOf(task))
        : base.lookBack,
    startWord: typeof raw.startWord === 'string' ? raw.startWord.slice(0, 40) : '',
    cards: cleanCards(raw.cards),
    runs: count(raw.runs),
    copies: count(raw.copies),
    finished: raw.finished === true,
    copied: raw.copied === true,
    kept: raw.kept === true,
    usedLookBack: count(raw.usedLookBack, MAX_LOOK_BACK),
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
  if (isWriteMode(task)) {
    const goal = passAtOf(task)
    const kept = cleanCards(state?.cards).length
    return {
      goal,
      guesses: kept,
      right: kept,
      core: Math.min(kept, goal),
      bonus: Math.max(0, kept - goal),
      done: kept >= goal,
    }
  }
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
  if (isWriteMode(task)) {
    const { goal, core } = gradeTask(task, state)
    return { core: goal, tries: core, right: 0, ownWords: ownWordsOf(state), generated: 0 }
  }
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
  if (isWriteMode(task)) {
    const cards = Array.from({ length: passAtOf(task) }, (_, i) => ({
      text: `Card ${i + 1}`,
      copied: false,
      lookBack: startLookBackOf(task),
    }))
    return { ...initialNextWordState(task), cards, finished: true, kept: true, runs: cards.length }
  }
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
    } else if (text.body.length > textCapOf(task)) {
      errors.push(`${label}: body is longer than ${textCapOf(task)} characters.`)
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
    task?.maxLookBack != null &&
    (!Number.isInteger(task.maxLookBack) ||
      task.maxLookBack < 1 ||
      task.maxLookBack > MAX_LOOK_BACK)
  ) {
    errors.push(`${where}: maxLookBack must be a whole number from 1 to ${MAX_LOOK_BACK}.`)
  }
  if (
    task?.lookBack != null &&
    (!Number.isInteger(task.lookBack) || task.lookBack < 1 || task.lookBack > maxLookBackOf(task))
  ) {
    errors.push(`${where}: lookBack must be a whole number from 1 to ${maxLookBackOf(task)}.`)
  }
  if (
    task?.guesses != null &&
    (!Number.isInteger(task.guesses) || task.guesses < 1 || task.guesses > MAX_GUESSES)
  ) {
    errors.push(`${where}: guesses must be a whole number from 1 to ${MAX_GUESSES}.`)
  }
  if (task?.mode != null && !MODES.includes(task.mode)) {
    errors.push(`${where}: mode must be one of ${MODES.join(', ')}.`)
  }
  if (task?.maxWords != null && !wholeIn(task.maxWords, MIN_MAX_WORDS, MAX_MAX_WORDS)) {
    errors.push(
      `${where}: maxWords must be a whole number from ${MIN_MAX_WORDS} to ${MAX_MAX_WORDS}.`
    )
  }
  if (task?.card != null && !CARDS.includes(task.card)) {
    errors.push(`${where}: card must be one of ${CARDS.join(', ')}.`)
  }
  if (task?.passAt != null && !wholeIn(task.passAt, 1, MAX_PASS_AT)) {
    errors.push(`${where}: passAt must be a whole number from 1 to ${MAX_PASS_AT}.`)
  }
  if (isWriteMode(task) && textsOf(task).length === 0) {
    errors.push(`${where}: mode write needs at least one text to write like.`)
  }
  return errors
}
