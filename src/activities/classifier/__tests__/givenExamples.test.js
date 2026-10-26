// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addExample,
  classify,
  countsOf,
  givenExamplesOf,
  gradeTask,
  gridFromRows,
  gridToRows,
  initialClassifierState,
  isGridString,
  normalizeClassifierState,
  ownCountsOf,
  predictLive,
  readyOf,
  removeExample,
  sharedState,
  splitExamples,
  validateClassifierTask,
  validateClassifierWarnings,
} from '../classifier.js'
import definition from '../definition.js'

// Pre-loaded ("given") examples: the pad has learned them before the student draws.

const row = (on) => Array.from({ length: 16 }, (_, c) => (on(c) ? '#' : '.')).join('')
// "bar" = ink in the left columns; "dot" = ink in the right columns.
const bar = Array.from({ length: 16 }, () => row((c) => c < 4))
const dot = Array.from({ length: 16 }, () => row((c) => c > 11))
const bar2 = Array.from({ length: 16 }, () => row((c) => c < 5))
const dot2 = Array.from({ length: 16 }, () => row((c) => c > 10))

const TASK = {
  taskType: 'activity',
  activityType: 'classifier',
  mode: 'drawing',
  classes: ['bar', 'dot'],
  minExamplesPerClass: 2,
  examples: [
    { label: 'bar', grid: bar },
    { label: 'bar', grid: bar2 },
    { label: 'dot', grid: dot },
    { label: 'dot', grid: dot2 },
  ],
}
const errorsOf = (task) => validateClassifierTask(task, 1)

describe('validation of examples', () => {
  it('accepts valid examples', () => {
    expect(errorsOf(TASK)).toEqual([])
  })
  it('rejects a label that is not a class, a bad grid and non-lists', () => {
    expect(errorsOf({ ...TASK, examples: [{ label: 'cat', grid: bar }] })[0]).toMatch(
      /example 1: label "cat" is not one of the classes/
    )
    expect(errorsOf({ ...TASK, examples: [{ label: 'bar', grid: ['#'] }] })[0]).toMatch(
      /example 1: grid must be 16 rows/
    )
    expect(errorsOf({ ...TASK, examples: 'x' })[0]).toMatch(/examples must be a list/)
  })
  it('needs classes and at most 40', () => {
    expect(errorsOf({ ...TASK, classes: [] })[0]).toMatch(/examples need classes/)
    const many = Array.from({ length: 41 }, () => TASK.examples[0])
    expect(errorsOf({ ...TASK, examples: many })[0]).toMatch(/at most 40/)
  })
  it('warns about a class without an example, and held_out with too many', () => {
    expect(validateClassifierWarnings({ ...TASK, examples: TASK.examples.slice(0, 2) }, 2)).toEqual(
      ['Task 2: no pre-loaded example for class "dot".']
    )
    const held = { ...TASK, testSet: 'held_out', minExamplesPerClass: 4 }
    expect(validateClassifierWarnings(held, 2)).toEqual([])
    expect(
      validateClassifierWarnings({ ...held, minExamplesPerClass: 2 }, 2).length
    ).toBeGreaterThan(0)
  })
  it('is a public (unsealed) field', () => {
    expect(definition.sealedFields).not.toContain('examples')
  })
})

describe('seeding and counting', () => {
  it('seeds the state with the given grids and no own drawings', () => {
    const state = initialClassifierState(TASK)
    expect(state.given.bar).toHaveLength(2)
    expect(state.given.bar.every(isGridString)).toBe(true)
    expect(state.examples).toEqual({ bar: [], dot: [] })
    expect(countsOf(state)).toEqual({ bar: 2, dot: 2 })
    expect(ownCountsOf(state)).toEqual({ bar: 0, dot: 0 })
  })
  it('leaves tasks without examples unchanged', () => {
    expect('given' in initialClassifierState({ ...TASK, examples: undefined })).toBe(false)
    expect(givenExamplesOf({ ...TASK, classes: [] })).toBeNull()
  })
  it('is ready from the start', () => {
    const state = initialClassifierState(TASK)
    expect(readyOf(state)).toBe(true)
    expect(gradeTask(TASK, state).ready).toBe(true)
  })
  it('is not ready when the given examples fall short of the minimum', () => {
    const task = { ...TASK, minExamplesPerClass: 3 }
    const state = initialClassifierState(task)
    expect(readyOf(state)).toBe(false)
    const more = addExample(state, 'bar', gridFromRows(bar))
    expect(countsOf(more).bar).toBe(3)
    expect(ownCountsOf(more).bar).toBe(1)
  })
})

describe('save and load', () => {
  it('does not duplicate given examples across serialize and deserialize', () => {
    let state = initialClassifierState(TASK)
    state = addExample(state, 'bar', gridFromRows(bar))
    const saved = definition.serialize(state)
    expect(JSON.parse(saved).given).toBeUndefined()
    const loaded = definition.deserialize(saved, TASK)
    expect(loaded.given).toEqual(state.given)
    expect(loaded.examples.bar).toHaveLength(1)
    expect(countsOf(loaded).bar).toBe(3)
    const again = definition.deserialize(definition.serialize(loaded), TASK)
    expect(countsOf(again).bar).toBe(3)
  })
  it('takes a lesson edit to examples on reload', () => {
    const saved = definition.serialize(initialClassifierState(TASK))
    const edited = { ...TASK, examples: TASK.examples.slice(0, 3) }
    expect(countsOf(definition.deserialize(saved, edited))).toEqual({ bar: 2, dot: 1 })
  })
  it('shares totals, not drawings, and the tutor reads given vs own', () => {
    let state = initialClassifierState(TASK)
    state = addExample(state, 'dot', gridFromRows(dot))
    const shared = sharedState(state)
    expect(shared.counts).toEqual({ bar: 2, dot: 3 })
    expect(shared.trained).toBe(true)
    expect(JSON.stringify(shared)).not.toContain('given')
    const tutor = normalizeClassifierState(TASK, shared)
    expect(countsOf(tutor)).toEqual({ bar: 2, dot: 3 })
    expect(ownCountsOf(tutor)).toEqual({ bar: 0, dot: 1 })
  })
})

describe('removing and testing', () => {
  it('only removes the students own drawings', () => {
    let state = initialClassifierState(TASK)
    expect(removeExample(state, 'bar', 0)).toBe(state)
    state = addExample(state, 'bar', gridFromRows(bar))
    state = removeExample(state, 'bar', 0)
    expect(state.examples.bar).toEqual([])
    expect(countsOf(state).bar).toBe(2)
  })
  it('keeps given examples out of the held-out test set', () => {
    const task = { ...TASK, testSet: 'held_out', minExamplesPerClass: 4 }
    let state = initialClassifierState(task)
    for (let i = 0; i < 4; i += 1) state = addExample(state, 'bar', gridFromRows(bar))
    const { train, held } = splitExamples(task, state)
    expect(held).toHaveLength(1)
    expect(held[0].grid).toBe(gridFromRows(bar))
    expect(train.filter((e) => e.label === 'bar')).toHaveLength(5)
  })
})

describe('guessing with only given examples', () => {
  it('classifies at once', () => {
    const state = initialClassifierState(TASK)
    const { train } = splitExamples(TASK, state)
    expect(classify(train, gridFromRows(bar2))).toBe('bar')
    expect(classify(train, gridFromRows(dot))).toBe('dot')
    expect(predictLive(TASK, state, gridFromRows(dot2))).toBe('dot')
  })
})

describe('summary text', () => {
  it('says given and own while teaching and when ready', () => {
    const task = { ...TASK, minExamplesPerClass: 3 }
    let state = initialClassifierState(task)
    state = addExample(state, 'bar', gridFromRows(bar))
    expect(definition.summarize(task, state).text).toBe(
      'Teaching: bar 2 given + 1 own · dot 2 given + 0 own'
    )
    const ready = initialClassifierState(TASK)
    expect(definition.summarize(TASK, ready).text).toBe('Ready: 0/5 tried · 0 own drawings')
  })
  it('round trips grid rows', () => {
    expect(gridToRows(gridFromRows(bar))).toEqual(bar)
  })
})
