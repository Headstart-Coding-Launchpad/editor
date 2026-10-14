// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  CLEAR_POINTS,
  FALLING_ROUND_ID,
  MISS_POINTS,
  bufferOnTrack,
  createFallingGame,
  fallingResult,
  fallingSolution,
  gradeFallingRound,
  stepFallingGame,
  typeFallingKey,
} from '../fallingWords.js'
import keyboard from '../definition.js'

const key = (k, mods = {}) => ({ key: k, mods })

function typeAll(game, text) {
  for (const char of text) game = typeFallingKey(game, key(char)).game
  return game
}

// A game with tokens placed by hand.
function withTokens(tokens, options = {}) {
  const game = createFallingGame({ words: ['x'], durationMs: 60000, ...options })
  return {
    ...game,
    nextSpawnMs: Infinity,
    tokens: tokens.map((t, i) => ({ id: i + 1, x: 0.1, y: 0, fallMs: 9000, ...t })),
  }
}

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'falling_words',
  durationSeconds: 90,
  words: ['print(', '</p>', 'for i in', 'if x ==', '<h1>', 'input(', '[1, 2]', '"hi"'],
}
const errorsOf = (task) => keyboard.validateTask(task, { n: 1 }).errors

describe('falling_words: matching', () => {
  it('clears a token typed exactly, symbols and spaces included, and scores it', () => {
    let game = withTokens([{ text: 'for i in' }, { text: '</p>' }])
    game = typeAll(game, 'for i in')
    expect(game.tokens.map((t) => t.text)).toEqual(['</p>'])
    expect(game.cleared).toBe(1)
    expect(game.score).toBe(CLEAR_POINTS + 'for i in'.length)
    expect(game.buffer).toBe('')
  })

  it('clears the lowest (most urgent) token when two match', () => {
    let game = withTokens([
      { text: '<h1>', y: 0.2 },
      { text: '<h1>', y: 0.7 },
    ])
    game = typeAll(game, '<h1>')
    expect(game.tokens).toHaveLength(1)
    expect(game.tokens[0].y).toBe(0.2)
  })

  it('shows when the typed buffer no longer leads to any token, and Backspace corrects it', () => {
    let game = withTokens([{ text: 'print(' }])
    game = typeAll(game, 'pz')
    expect(bufferOnTrack(game)).toBe(false)
    game = typeFallingKey(game, key('Backspace')).game
    expect(game.buffer).toBe('p')
    expect(game.corrections).toBe(1)
    expect(bufferOnTrack(game)).toBe(true)
    game = typeAll(game, 'rint(')
    expect(game.cleared).toBe(1)
  })

  it('counts keystroke accuracy and empties the buffer on Enter or Escape', () => {
    let game = withTokens([{ text: 'ab' }, { text: 'cd' }])
    game = typeAll(game, 'ax')
    expect(game.keystrokes).toBe(2)
    expect(game.rightKeystrokes).toBe(1)
    game = typeFallingKey(game, key('Escape')).game
    expect(game.buffer).toBe('')
    expect(typeFallingKey(game, key('c', { mod: true })).handled).toBe(false)
  })
})

describe('falling_words: the round', () => {
  it('tokens that reach the bottom are missed and cost points, never below zero', () => {
    let game = withTokens([{ text: 'ab', y: 0.95 }])
    game = { ...game, score: 3 }
    game = stepFallingGame(game, 1000)
    expect(game.missed).toBe(1)
    expect(game.tokens).toHaveLength(0)
    expect(game.score).toBe(Math.max(0, 3 - MISS_POINTS))
  })

  it('spawns tokens over time and always runs to the end of the time', () => {
    let game = createFallingGame({ words: ['a', 'b', 'c'], durationMs: 20000, seed: 7 })
    game = stepFallingGame(game, 16)
    expect(game.tokens).toHaveLength(1)
    for (let t = 0; t < 30000; t += 100) game = stepFallingGame(game, 100)
    expect(game.over).toBe(true)
    expect(game.elapsedMs).toBe(20000)
    expect(game.missed).toBeGreaterThan(0)
    expect(typeFallingKey(game, key('a')).handled).toBe(false)
  })

  it('falls more slowly with reduced motion', () => {
    const normal = stepFallingGame(createFallingGame({ words: ['a'], durationMs: 60000 }), 16)
    const reduced = stepFallingGame(
      createFallingGame({ words: ['a'], durationMs: 60000, reducedMotion: true }),
      16
    )
    expect(reduced.tokens[0].fallMs).toBeGreaterThan(normal.tokens[0].fallMs)
  })

  it('does not change the game it was given', () => {
    const game = withTokens([{ text: 'ab' }])
    stepFallingGame(game, 500)
    typeAll(game, 'ab')
    expect(game.tokens[0].y).toBe(0)
    expect(game.cleared).toBe(0)
  })
})

describe('falling_words: results, grading and summary', () => {
  it('records the shared typing-result shape', () => {
    let game = withTokens([{ text: 'abcde' }])
    game = typeAll(game, 'abcde')
    game = { ...game, elapsedMs: 30000 }
    expect(fallingResult(game)).toEqual({
      mode: 'falling_words',
      cleared: 1,
      missed: 0,
      score: CLEAR_POINTS + 5,
      accuracy: 1,
      cpm: 10,
      wpm: 2,
      corrections: 0,
      timeMs: 30000,
      source: 'hardware',
      done: false,
    })
  })

  it('passes once the round is over, whatever the score', () => {
    expect(gradeFallingRound({ done: true, cleared: 0, missed: 9 }).correct).toBe(true)
    expect(gradeFallingRound({ cleared: 5 }).correct).toBe(false)
    expect(keyboard.grade(TASK, keyboard.solutionState(TASK)).passed).toBe(true)
    expect(keyboard.grade(TASK, keyboard.initialState(TASK)).passed).toBe(false)
  })

  it('stores the round as one item', () => {
    expect(keyboard.initialState(TASK)).toEqual({ v: 1, items: { [FALLING_ROUND_ID]: {} } })
    expect(fallingSolution(TASK)).toMatchObject({ done: true, cleared: TASK.words.length })
  })

  it('summarises the round for the teacher card', () => {
    expect(keyboard.summarize(TASK, keyboard.initialState(TASK)).text).toBe('falling: not started')
    const playing = { v: 1, items: { round: { cleared: 4, missed: 1, done: false } } }
    expect(keyboard.summarize(TASK, playing).text).toBe('falling: playing · 4 cleared · 1 missed')
    const done = { v: 1, items: { round: { cleared: 23, missed: 4, score: 300, done: true } } }
    expect(keyboard.summarize(TASK, done)).toEqual({
      text: 'falling: 23 cleared · 4 missed · 300 pts',
      tone: 'success',
    })
  })
})

describe('falling_words: validation', () => {
  it('accepts the example task with no items', () => {
    expect(errorsOf(TASK)).toEqual([])
    expect(errorsOf({ ...TASK, durationSeconds: undefined })).toEqual([])
  })

  it('needs words', () => {
    expect(errorsOf({ ...TASK, words: [] })).toEqual([
      'Task 1: falling_words needs a words list with at least one word or token.',
    ])
  })

  it('checks the round length', () => {
    expect(errorsOf({ ...TASK, durationSeconds: 5 })).toEqual([
      'Task 1: durationSeconds must be a whole number from 15 to 300.',
    ])
  })

  it('checks each word', () => {
    expect(errorsOf({ ...TASK, words: ['ok', ''] })).toEqual([
      'Task 1 word 2: must be some text to type.',
    ])
    expect(errorsOf({ ...TASK, words: [' x'] })[0]).toMatch(/starts or ends with a space/)
    expect(errorsOf({ ...TASK, words: ['x'.repeat(21)] })[0]).toMatch(/at most 20 characters/)
    expect(errorsOf({ ...TASK, words: ['“hi”'] })[0]).toMatch(/can't be typed: “ ”/)
  })
})
