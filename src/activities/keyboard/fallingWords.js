// Pure logic for the Keyboard activity's falling_words mode: a timed warm-up where words or
// code tokens ("print(", "</p>", "for i in") fall down the play area and typing one exactly
// clears it. Points only, no lives: a cleared token scores, a missed one costs a little, and
// the round always runs for the full `durationSeconds` and then completes. Node-safe; the
// student view drives the game with stepFallingGame / typeFallingKey and keeps it in memory.
//
// The task has no `items`: the round is stored as one item, FALLING_ROUND_ID, so results read
// like every other keyboard mode:
//   { mode: 'falling_words', cleared, missed, score, accuracy, cpm, wpm, corrections, timeMs,
//     source, done }

export const FALLING_ROUND_ID = 'round'
export const DEFAULT_FALLING_SECONDS = 60
export const MIN_FALLING_SECONDS = 15
export const MAX_FALLING_SECONDS = 300
export const MAX_FALLING_WORDS = 100
export const MAX_TOKEN_LENGTH = 20

export const CLEAR_POINTS = 10
export const MISS_POINTS = 5

// How long a token takes to fall, and the gap between new tokens, at the start and the end of
// the round (the round speeds up a little). Reduced motion: everything 1.5× slower.
const FALL_MS = { start: 9000, end: 6500 }
const SPAWN_MS = { start: 2200, end: 1300 }
const REDUCED_MOTION_SLOWDOWN = 1.5
const MAX_ON_SCREEN = 6

export function fallingDurationMs(task) {
  return (task?.durationSeconds ?? DEFAULT_FALLING_SECONDS) * 1000
}

// Task-level validation messages (`where` is "Task N").
export function validateFallingWordsTask(task, where, isTypeable) {
  const errors = []
  if (task.durationSeconds != null) {
    const seconds = task.durationSeconds
    if (
      !Number.isInteger(seconds) ||
      seconds < MIN_FALLING_SECONDS ||
      seconds > MAX_FALLING_SECONDS
    ) {
      errors.push(
        `${where}: durationSeconds must be a whole number from ${MIN_FALLING_SECONDS} to ${MAX_FALLING_SECONDS}.`
      )
    }
  }
  if (!Array.isArray(task.words) || task.words.length === 0) {
    errors.push(`${where}: falling_words needs a words list with at least one word or token.`)
    return errors
  }
  if (task.words.length > MAX_FALLING_WORDS) {
    errors.push(`${where}: falling_words can have at most ${MAX_FALLING_WORDS} words.`)
  }
  task.words.forEach((word, i) => {
    const label = `${where} word ${i + 1}`
    if (typeof word !== 'string' || word.trim() === '') {
      errors.push(`${label}: must be some text to type.`)
    } else if (word !== word.trim()) {
      errors.push(`${label}: "${word}" starts or ends with a space, which students can't see.`)
    } else if ([...word].length > MAX_TOKEN_LENGTH) {
      errors.push(`${label}: must be at most ${MAX_TOKEN_LENGTH} characters.`)
    } else {
      const untypeable = [
        ...new Set([...word].filter((c) => c === '\n' || c === '\t' || !isTypeable(c))),
      ]
      if (untypeable.length) {
        errors.push(
          `${label}: has characters that can't be typed: ${untypeable.map((c) => JSON.stringify(c).slice(1, -1)).join(' ')}`
        )
      }
    }
  })
  return errors
}

// Small seeded random numbers (mulberry32), so a game can be replayed in tests.
function nextRandom(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next }
}

const lerp = (from, to, share) => from + (to - from) * Math.min(1, Math.max(0, share))

export function createFallingGame({ words, durationMs, seed = 1, reducedMotion = false }) {
  return {
    words: [...(words ?? [])],
    durationMs,
    reducedMotion,
    seed: seed >>> 0,
    elapsedMs: 0,
    nextSpawnMs: 0,
    nextId: 1,
    queue: [],
    tokens: [], // { id, text, x: 0..1 across, y: 0..1 down, fallMs }
    buffer: '',
    cleared: 0,
    missed: 0,
    score: 0,
    keystrokes: 0,
    rightKeystrokes: 0,
    clearedChars: 0,
    corrections: 0,
    lastEvent: null, // { kind: 'cleared' | 'missed', text, at }
    over: false,
  }
}

function random(game) {
  const { value, seed } = nextRandom(game.seed)
  game.seed = seed
  return value
}

function spawn(game) {
  if (game.queue.length === 0) {
    // A shuffled pass through every word before any repeats.
    const bag = [...game.words]
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random(game) * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    game.queue = bag
  }
  const text = game.queue.shift()
  const share = game.elapsedMs / game.durationMs
  const slow = game.reducedMotion ? REDUCED_MOTION_SLOWDOWN : 1
  game.tokens.push({
    id: game.nextId++,
    text,
    x: 0.05 + random(game) * 0.7,
    y: 0,
    fallMs: lerp(FALL_MS.start, FALL_MS.end, share) * slow,
  })
  game.nextSpawnMs = game.elapsedMs + lerp(SPAWN_MS.start, SPAWN_MS.end, share) * slow
}

// Advances the game by `dtMs`: tokens fall, any reaching the bottom are missed, new ones
// appear, and the round ends at durationMs. Returns a new game (the input is not changed).
export function stepFallingGame(previous, dtMs) {
  if (previous.over || !(dtMs > 0)) return previous
  const game = {
    ...previous,
    tokens: previous.tokens.map((t) => ({ ...t })),
    queue: [...previous.queue],
  }
  game.elapsedMs = Math.min(game.durationMs, game.elapsedMs + dtMs)
  const kept = []
  for (const token of game.tokens) {
    token.y += dtMs / token.fallMs
    if (token.y >= 1) {
      game.missed += 1
      game.score = Math.max(0, game.score - MISS_POINTS)
      game.lastEvent = { kind: 'missed', text: token.text, at: game.elapsedMs }
    } else kept.push(token)
  }
  game.tokens = kept
  if (game.elapsedMs >= game.durationMs) {
    game.over = true
    return game
  }
  if (
    game.words.length &&
    game.elapsedMs >= game.nextSpawnMs &&
    game.tokens.length < MAX_ON_SCREEN
  ) {
    spawn(game)
  }
  return game
}

// Is `buffer` the start of a token on screen?
function isPrefixOfAny(game, buffer) {
  return game.tokens.some((token) => token.text.startsWith(buffer))
}

// Applies one normalised keydown. Printable keys add to the typed buffer, and when the buffer
// matches a token exactly the lowest (most urgent) such token is cleared. Backspace removes one
// character (a correction); Enter or Escape empties the buffer. Returns { game, handled }.
export function typeFallingKey(previous, event) {
  if (previous.over || event.mods?.mod || event.mods?.alt) return { game: previous, handled: false }
  const { key } = event
  const game = { ...previous }
  if (key === 'Backspace') {
    if (game.buffer) {
      game.buffer = game.buffer.slice(0, -1)
      game.corrections += 1
    }
    return { game, handled: true }
  }
  if (key === 'Enter' || key === 'Escape') {
    game.buffer = ''
    return { game, handled: true }
  }
  if (key.length !== 1) return { game: previous, handled: false }
  const buffer = game.buffer + key
  game.keystrokes += 1
  if (isPrefixOfAny(game, buffer)) game.rightKeystrokes += 1
  const match = game.tokens.filter((token) => token.text === buffer).sort((a, b) => b.y - a.y)[0]
  if (match) {
    game.tokens = game.tokens.filter((token) => token.id !== match.id)
    game.cleared += 1
    game.clearedChars += match.text.length
    game.score += CLEAR_POINTS + match.text.length
    game.buffer = ''
    game.lastEvent = { kind: 'cleared', text: match.text, at: game.elapsedMs }
  } else {
    game.buffer = buffer.length > MAX_TOKEN_LENGTH ? buffer.slice(-MAX_TOKEN_LENGTH) : buffer
  }
  return { game, handled: true }
}

// Does the buffer still lead to a token on screen (shown in the typing colour, else red)?
export function bufferOnTrack(game) {
  return !game.buffer || isPrefixOfAny(game, game.buffer)
}

// The stored per-round result.
export function fallingResult(game, source = 'hardware') {
  const minutes = game.elapsedMs / 60000
  const cpm = minutes > 0 ? Math.round(game.clearedChars / minutes) : 0
  return {
    mode: 'falling_words',
    cleared: game.cleared,
    missed: game.missed,
    score: game.score,
    accuracy: game.keystrokes
      ? Math.round((game.rightKeystrokes / game.keystrokes) * 1000) / 1000
      : 1,
    cpm,
    wpm: Math.round((cpm / 5) * 10) / 10,
    corrections: game.corrections,
    timeMs: Math.round(game.elapsedMs),
    source,
    done: !!game.over,
  }
}

// A warm-up: it passes once the round has run to the end.
export function gradeFallingRound(result = {}) {
  return result.done
    ? { correct: true, hint: null }
    : { correct: false, hint: 'Press Start and keep typing until the time runs out.' }
}

export function fallingSolution(task) {
  const words = task?.words ?? []
  const chars = words.reduce((sum, word) => sum + String(word).length, 0)
  const minutes = fallingDurationMs(task) / 60000
  const cpm = minutes > 0 ? Math.round(chars / minutes) : 0
  return {
    mode: 'falling_words',
    cleared: words.length,
    missed: 0,
    score: words.reduce((sum, word) => sum + CLEAR_POINTS + String(word).length, 0),
    accuracy: 1,
    cpm,
    wpm: Math.round((cpm / 5) * 10) / 10,
    corrections: 0,
    timeMs: fallingDurationMs(task),
    source: 'hardware',
    done: true,
  }
}
