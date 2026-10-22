import { describe, expect, it } from 'vitest'
import { coreCountOf, roundSummaryText, roundText, validateCoreItems } from '../round.js'
import binary from '../binary/definition.js'
import keyboard from '../keyboard/definition.js'
import mouse from '../mouse/definition.js'

// An activity task is one round: a core goal of reps, then bonus reps. These cover the pure
// helpers and how the keyboard, binary and mouse definitions use task.coreItems.

describe('round helpers', () => {
  it('uses coreItems when it is a valid whole number, otherwise all items', () => {
    expect(coreCountOf({ coreItems: 3 }, 5)).toBe(3)
    expect(coreCountOf({}, 5)).toBe(5)
    expect(coreCountOf({ coreItems: 9 }, 5)).toBe(5)
    expect(coreCountOf({ coreItems: 0 }, 5)).toBe(5)
    expect(coreCountOf({ coreItems: 2.5 }, 5)).toBe(5)
    expect(coreCountOf(null, 4)).toBe(4)
  })

  it('words progress the same way everywhere', () => {
    expect(roundText(3, 5)).toBe('3 of 5 done')
    expect(roundText(0, 5, 3)).toBe('0 of 3 done')
    expect(roundText(3, 5, 3)).toBe('3 of 3 done')
    expect(roundText(4, 5, 3)).toBe('3 of 3 done · +1 bonus')
    expect(roundText(5, 5)).toBe('5 of 5 done')
    expect(roundSummaryText(2, 5, 5)).toBe('2/5 done')
    expect(roundSummaryText(4, 5, 3)).toBe('3/3 done · +1 bonus')
    expect(roundSummaryText(2, 4, 4, 'correct')).toBe('2/4 correct')
  })

  it('validates coreItems from 1 to the number of items', () => {
    expect(validateCoreItems({}, 'Task 1', 3)).toBeNull()
    expect(validateCoreItems({ coreItems: 3 }, 'Task 1', 3)).toBeNull()
    for (const bad of [0, 4, 1.5, '2', -1]) {
      expect(validateCoreItems({ coreItems: bad }, 'Task 1', 3)).toBe(
        'Task 1: coreItems must be a whole number from 1 to 3 (the number of items).'
      )
    }
  })
})

const BINARY = {
  id: 1,
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [
    { id: 'a', target: 1 },
    { id: 'b', target: 2 },
    { id: 'c', target: 3 },
  ],
}
const KEYBOARD = {
  id: 2,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'find_key',
  items: [
    { id: 'a', key: 'q' },
    { id: 'b', key: 'w' },
    { id: 'c', key: 'e' },
  ],
}
const MOUSE = {
  id: 3,
  taskType: 'activity',
  activityType: 'mouse',
  targets: [{ id: 'star', label: 'star', x: 0.5, y: 0.5 }],
  items: [
    { id: 'a', action: 'click', target: 'star' },
    { id: 'b', action: 'click', target: 'star' },
    { id: 'c', action: 'click', target: 'star' },
  ],
}

const CASES = [
  ['binary', binary, BINARY],
  ['keyboard', keyboard, KEYBOARD],
  ['mouse', mouse, MOUSE],
]

describe.each(CASES)('%s coreItems', (_name, definition, task) => {
  const errorsFor = (patch) => {
    const result = definition.validateTask({ ...task, ...patch }, { n: 4 })
    return Array.isArray(result) ? result : result.errors
  }

  it('declares coreItems in the task fields', () => {
    expect(definition.fields.task.map((field) => field.name)).toContain('coreItems')
  })

  it('is marked as you go', () => {
    expect(definition.completion).toBe('auto')
  })

  it('accepts a valid coreItems and none', () => {
    expect(errorsFor({})).toEqual([])
    expect(errorsFor({ coreItems: 2 })).toEqual([])
    expect(errorsFor({ coreItems: 3 })).toEqual([])
  })

  it('rejects coreItems outside 1 to the number of items', () => {
    for (const bad of [0, 4, 1.5]) {
      expect(errorsFor({ coreItems: bad })).toContain(
        'Task 4: coreItems must be a whole number from 1 to 3 (the number of items).'
      )
    }
  })

  it('passes at the core and counts the rest as bonus', () => {
    const solved = definition.solutionState(task)
    const only = (ids) => ({
      ...definition.initialState(task),
      items: Object.fromEntries(ids.map((id) => [id, solved.items[id]])),
    })
    const withCore = { ...task, coreItems: 2 }
    // Everything required by default.
    expect(definition.grade(task, only(['a', 'b'])).passed).toBe(false)
    expect(definition.grade(task, only(['a', 'b', 'c'])).passed).toBe(true)
    // Two are enough when coreItems is 2, in either order.
    expect(definition.grade(withCore, only(['a'])).passed).toBe(false)
    expect(definition.grade(withCore, only(['a', 'b'])).passed).toBe(true)
    expect(definition.grade(withCore, only(['b', 'c'])).passed).toBe(true)
    // Progress is against the core, with the extra reps reported as bonus.
    expect(definition.getProgress(withCore, only(['a', 'b']))).toMatchObject({
      total: 2,
      correct: 2,
      bonus: 0,
    })
    expect(definition.getProgress(withCore, only(['a', 'b', 'c']))).toMatchObject({
      total: 2,
      correct: 2,
      bonus: 1,
    })
    expect(definition.summarize(withCore, only(['a', 'b', 'c'])).text).toMatch(
      /^2\/2 .*· \+1 bonus/
    )
    expect(definition.summarize(withCore, only(['a', 'b', 'c'])).tone).toBe('success')
  })

  it('a cleared state (Play again) is simply not passed, never a fail result', () => {
    const cleared = definition.initialState(task)
    expect(definition.grade(task, cleared).passed).toBe(false)
  })
})

describe('keyboard falling_words ignores coreItems with a warning', () => {
  it('warns rather than errors', () => {
    const task = {
      id: 5,
      taskType: 'activity',
      activityType: 'keyboard',
      mode: 'falling_words',
      words: ['print('],
      coreItems: 2,
    }
    const result = keyboard.validateTask(task, { n: 5 })
    expect(result.errors).toEqual([])
    expect(result.warnings.join(' ')).toMatch(/coreItems is ignored for falling_words/)
  })
})

describe('typed binary answers that become right are discrete changes', () => {
  it('lets the host auto-submit the change that passes', () => {
    const task = {
      id: 1,
      taskType: 'activity',
      activityType: 'binary',
      mode: 'to_decimal',
      bits: 4,
      items: [{ id: 'a', value: '0110' }],
    }
    const prev = { v: 1, items: { a: { answer: '' } } }
    expect(binary.classifyChange(prev, { v: 1, items: { a: { answer: '5' } } }, task)).toBe(
      'continuous'
    )
    expect(binary.classifyChange(prev, { v: 1, items: { a: { answer: '6' } } }, task)).toBe(
      'discrete'
    )
  })
})
