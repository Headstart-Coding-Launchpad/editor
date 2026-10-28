// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  gradeTask,
  initialGame,
  normalizeGame,
  panelsOf,
  passAtOf,
  playRound,
  roundsOf,
  setLookBack,
  solutionFor,
  statsOf,
  validateRpsMindReaderTask,
  brainOf,
} from '../rps_mind_reader.js'
import { counterOf, makeRng, resultOf } from '../mind.js'
import definition from '../definition.js'

// Pure logic tests for the Mind Reader activity. The shared contract (default task validates,
// state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'rps_mind_reader',
  rounds: 30,
  lookBack: 3,
}

function playAll(task, moveAt) {
  let game = initialGame(task)
  for (let r = 0; r < roundsOf(task); r += 1) game = playRound(task, game, moveAt(r))
  return game
}

describe('the fun moment: it reads your mind', () => {
  it('reads a child who repeats rock, rock, paper at least 7 times in the last 10 of 30', () => {
    const pattern = [0, 0, 1]
    const game = playAll(TASK, (r) => pattern[r % 3])
    const s = statsOf(TASK, game)
    expect(s.played).toBe(30)
    expect(s.readRecent).toBeGreaterThanOrEqual(7)
    // It climbs: it reads them more at the end than it did after ten rounds.
    expect(s.series[29]).toBeGreaterThan(s.series[9])
  })

  it('reads other simple patterns too (rock paper scissors in turn)', () => {
    const game = playAll(TASK, (r) => r % 3)
    expect(statsOf(TASK, game).readRecent).toBeGreaterThanOrEqual(7)
  })

  it('cannot read a random player: about a third over many games', () => {
    let read = 0
    let total = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = makeRng(seed * 977)
      const game = playAll(TASK, () => Math.floor(rng() * 3))
      const s = statsOf(TASK, game)
      read += s.reads.filter(Boolean).length
      total += s.played
    }
    expect(read / total).toBeGreaterThan(0.25)
    expect(read / total).toBeLessThan(0.42)
  })
})

describe('rock paper scissors rules', () => {
  it('paper beats rock, scissors beat paper, rock beats scissors', () => {
    expect(counterOf(0)).toBe(1)
    expect(counterOf(1)).toBe(2)
    expect(counterOf(2)).toBe(0)
    expect(resultOf(1, 0)).toBe('win')
    expect(resultOf(0, 1)).toBe('lose')
    expect(resultOf(2, 2)).toBe('tie')
  })

  it('locks in its pick before the child taps, and the same moves give the same pick', () => {
    const game = playRound(TASK, initialGame(TASK), 1)
    const a = brainOf(game).pick
    const b = brainOf(JSON.parse(JSON.stringify(game))).pick
    expect(a).toBe(b)
    const next = playRound(TASK, game, 0)
    expect(next.picks).toBe(game.picks + a)
  })

  it('keeps score: wins for you, wins for it, ties apart', () => {
    // moves 1,1,1 against picks 0,1,2 : win, tie, lose
    const game = { v: 1, lb: 3, moves: '111', picks: '012' }
    const s = statsOf(TASK, game)
    expect([s.you, s.it, s.ties]).toEqual([1, 1, 1])
    expect(s.reads).toEqual([false, false, true])
  })
})

describe('the saved game', () => {
  it('is tiny and cleans up bad data', () => {
    const game = playAll(TASK, (r) => r % 3)
    expect(JSON.stringify(game).length).toBeLessThan(200)
    expect(normalizeGame(TASK, { moves: '0129x', picks: '01', lb: 9 })).toEqual({
      v: 1,
      lb: 3,
      moves: '01',
      picks: '01',
    })
    expect(normalizeGame(TASK, null)).toEqual(initialGame(TASK))
  })

  it('stops at rounds and lets the look-back change keep the score', () => {
    const short = { ...TASK, rounds: 5 }
    const game = playAll(short, () => 0)
    expect(playRound(short, game, 1)).toEqual(game)
    const wider = setLookBack(TASK, game, 5)
    expect(wider.lb).toBe(5)
    expect(wider.moves).toBe(game.moves)
    expect(setLookBack(TASK, game, 9).lb).toBe(game.lb)
  })
})

describe('validateRpsMindReaderTask', () => {
  it('accepts a valid task, the default task and an empty one', () => {
    expect(validateRpsMindReaderTask(TASK, 1)).toEqual([])
    expect(validateRpsMindReaderTask({}, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('reports each authoring mistake', () => {
    expect(validateRpsMindReaderTask({ rounds: 3 }, 2)).toEqual([
      'Task 2: rounds must be a whole number from 5 to 100.',
    ])
    expect(validateRpsMindReaderTask({ lookBack: 6 }, 2)).toEqual([
      'Task 2: lookBack must be a whole number from 1 to 5.',
    ])
    expect(validateRpsMindReaderTask({ panels: ['network', 'cats'] }, 2)).toEqual([
      'Task 2: panels must only list network, history or lookback.',
    ])
    expect(validateRpsMindReaderTask({ passAt: 0 }, 2)).toEqual([
      'Task 2: passAt must be a whole number of 1 or more.',
    ])
    expect(validateRpsMindReaderTask({ rounds: 10, passAt: 20 }, 2)).toEqual([
      'Task 2: passAt cannot be more than rounds.',
    ])
  })

  it('reads defaults', () => {
    expect(roundsOf({})).toBe(30)
    expect(passAtOf({ rounds: 12 })).toBe(12)
    expect(passAtOf({ rounds: 30, passAt: 20 })).toBe(20)
    expect(panelsOf({})).toEqual(['network', 'history'])
    expect(panelsOf({ panels: ['lookback'] })).toEqual(['lookback'])
  })
})

describe('grading', () => {
  const task = { ...TASK, passAt: 20 }

  it('passes after passAt rounds, win or lose', () => {
    const early = playAll({ ...task, rounds: 19 }, () => 0)
    expect(gradeTask(task, early).passed).toBe(false)
    expect(gradeTask(task, early).hint).toBe('Play 1 more rounds.')
    expect(gradeTask(task, solutionFor(task)).passed).toBe(true)
    expect(definition.grade(task, definition.solutionState(task)).passed).toBe(true)
    expect(definition.grade(task, definition.initialState(task)).passed).toBe(false)
  })

  it('summarises for the tutor card', () => {
    expect(definition.summarize(task, definition.initialState(task)).text).toBe('Not started')
    const game = { v: 1, lb: 3, moves: '1111111111', picks: '0120120120' }
    const text = definition.summarize(task, game).text
    expect(text).toMatch(/^round 10 · You \d+–\d+ It · read \d+%$/)
  })

  it('is discrete on every change and survives a stored round trip', () => {
    const game = playRound(task, initialGame(task), 2)
    expect(definition.classifyChange(initialGame(task), game, task)).toBe('discrete')
    expect(definition.deserialize(JSON.stringify(game), task)).toEqual(game)
    expect(definition.deserialize('nonsense', task)).toEqual(initialGame(task))
  })
})
