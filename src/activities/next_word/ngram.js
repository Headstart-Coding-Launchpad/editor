// Word-pair (bigram) model for the Next Word activity. Pure and Node-safe: no React, DOM or
// network. The model is built from the text itself, so the probabilities are just counts of
// "which word came straight after this word".
//
// Words are normalised before counting (see normaliseWord): lower-case, with punctuation
// stripped from both ends, so "Net." and "net" are the same word. Sentence ends do not break
// the chain: the last word of one sentence counts as followed by the first word of the next.

// Longest text a student can paste. The pasted text is part of the activity state mirrored to
// the teacher, so it is capped; it is written when the student presses "Use my text", never per
// keystroke.
export const MAX_PASTE_CHARS = 1200
// Longest authored text body (validated).
export const MAX_TEXT_CHARS = 4000
// Longest generated text kept in the state.
export const MAX_GENERATED_CHARS = 400

export const MIN_TEMPERATURE = 0
export const MAX_TEMPERATURE = 2
export const DEFAULT_TEMPERATURE = 1
export const GENERATE_WORDS = 20

// Temperatures at or below this always pick the most likely word.
const GREEDY_TEMPERATURE = 0.05

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

// One word, normalised: lower-case, curly apostrophes made straight, punctuation removed from
// both ends (inner apostrophes and hyphens stay: "don't", "well-known"). '' if nothing is left.
export function normaliseWord(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(EDGE_PUNCTUATION, '')
}

// Text -> list of normalised words. Splits on spaces, line breaks, dashes and ellipses.
export function tokenise(text) {
  return String(text ?? '')
    .split(/[\s–—…]+/u)
    .map(normaliseWord)
    .filter(Boolean)
}

// The word a prompt ends on ("the ball goes into the" -> "the"), or ''.
export function lastWordOf(prompt) {
  const tokens = tokenise(prompt)
  return tokens[tokens.length - 1] ?? ''
}

// { tokens, successors: Map<word, Map<nextWord, count>> }
export function buildModel(text) {
  const tokens = tokenise(text)
  const successors = new Map()
  for (let i = 0; i < tokens.length - 1; i++) {
    const word = tokens[i]
    if (!successors.has(word)) successors.set(word, new Map())
    const next = successors.get(word)
    next.set(tokens[i + 1], (next.get(tokens[i + 1]) ?? 0) + 1)
  }
  return { tokens: tokens.length, firstWord: tokens[0] ?? '', successors }
}

const modelCache = new Map()

// buildModel with a small cache, so grading every item on every render doesn't rebuild it.
export function modelFor(text) {
  const key = String(text ?? '')
  const cached = modelCache.get(key)
  if (cached) return cached
  const model = buildModel(key)
  if (modelCache.size >= 8) modelCache.delete(modelCache.keys().next().value)
  modelCache.set(key, model)
  return model
}

// What follows `word`: { word, total, options: [{ word, count, share }] }, most likely first,
// ties in alphabetical order. `total` is 0 when the word is never followed by anything.
export function nextOptions(model, word) {
  const key = normaliseWord(word)
  const counts = model?.successors?.get(key)
  if (!counts) return { word: key, total: 0, options: [] }
  let total = 0
  for (const count of counts.values()) total += count
  const options = [...counts.entries()]
    .map(([next, count]) => ({ word: next, count, share: count / total }))
    .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
  return { word: key, total, options }
}

// Every word tied for the highest count after `word` (empty when nothing follows it).
export function topWords(model, word) {
  const { options } = nextOptions(model, word)
  if (options.length === 0) return []
  return options.filter((option) => option.count === options[0].count).map((o) => o.word)
}

// "net: 3 of 5 times" (always in words, so a bar is never the only way to read it).
export function describeCount(word, count, total) {
  return `${word}: ${count} of ${total} ${total === 1 ? 'time' : 'times'}`
}

// The words worth offering as starting points: those that have a word after them, most
// frequent first.
export function startingWords(model, limit = 12) {
  const rows = []
  for (const [word, counts] of model?.successors ?? []) {
    let total = 0
    for (const count of counts.values()) total += count
    rows.push({ word, total })
  }
  rows.sort((a, b) => b.total - a.total || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
  return rows.slice(0, limit).map((row) => row.word)
}

// Small seedable generator (mulberry32) so tests are deterministic. Returns () => [0, 1).
export function seededRandom(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Pick one option. Temperature 0 (or near it) always takes the most likely word; 1 picks in
// proportion to the counts; above 1 flattens the odds so rarer words come up more.
export function pickOption(options, temperature, random = Math.random) {
  if (!options.length) return null
  if (!(temperature > GREEDY_TEMPERATURE)) return options[0]
  const max = options[0].count
  const weights = options.map((option) => Math.pow(option.count / max, 1 / temperature))
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = random() * sum
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]
    if (r < 0) return options[i]
  }
  return options[options.length - 1]
}

// Make text by walking the model. Starts at `start` (normalised) or, if that is empty or has
// no words after it, at the text's first word with a word after it. When it reaches a word
// with nothing after it, it jumps to a random word that has something after it.
// Returns the words as a string.
export function generateText(
  model,
  {
    start = '',
    length = GENERATE_WORDS,
    temperature = DEFAULT_TEMPERATURE,
    random = Math.random,
  } = {}
) {
  const starters = [...(model?.successors?.keys() ?? [])].sort()
  if (starters.length === 0) return ''
  let word = normaliseWord(start)
  if (!word) word = model.successors.has(model.firstWord) ? model.firstWord : starters[0]
  const out = [word]
  while (out.length < length) {
    const { options } = nextOptions(model, word)
    if (options.length === 0) {
      word = starters[Math.floor(random() * starters.length)]
      out.push(word)
      continue
    }
    word = pickOption(options, temperature, random).word
    out.push(word)
  }
  return out.join(' ')
}

// A friendly name for a temperature, shown beside the slider.
export function temperatureLabel(temperature) {
  if (temperature <= GREEDY_TEMPERATURE) return 'always the most likely word'
  if (temperature < 0.6) return 'careful'
  if (temperature <= 1.2) return 'balanced'
  if (temperature <= 1.7) return 'adventurous'
  return 'wild'
}
