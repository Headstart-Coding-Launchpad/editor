import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  gradeTask,
  initialNetworkState,
  normalizeNetworkState,
  startLayersOf,
  validateNetworkPlaygroundTask,
} from '../network_playground.js'

const TASK = { dataset: 'circle', layers: [3], maxNeurons: 6, target: 0.9 }
const errorsOf = (patch) => validateNetworkPlaygroundTask({ ...TASK, ...patch }, 2)

describe('validateNetworkPlaygroundTask', () => {
  it('accepts a good task and the default task', () => {
    expect(errorsOf({})).toEqual([])
    expect(validateNetworkPlaygroundTask({ dataset: 'spiral' }, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask(), { n: 1 }).errors).toEqual([])
  })

  it('needs a known dataset', () => {
    expect(errorsOf({ dataset: undefined })).toEqual([
      'Task 2: dataset must be two_blobs, circle or spiral.',
    ])
    expect(errorsOf({ dataset: 'stripes' })).toHaveLength(1)
  })

  it('checks maxNeurons', () => {
    for (const bad of [0, 9, 2.5, '4']) {
      expect(errorsOf({ maxNeurons: bad })).toContain(
        'Task 2: maxNeurons must be a whole number from 1 to 8.'
      )
    }
  })

  it('checks layers', () => {
    expect(errorsOf({ layers: [] })).toEqual(['Task 2: layers must list 1 or 2 hidden layers.'])
    expect(errorsOf({ layers: [2, 2, 2] })).toHaveLength(1)
    expect(errorsOf({ layers: 'x' })).toHaveLength(1)
    const each = 'Task 2: each layer in layers must be a whole number from 1 to maxNeurons.'
    expect(errorsOf({ layers: [0] })).toEqual([each])
    expect(errorsOf({ layers: [7], maxNeurons: 6 })).toEqual([each])
    expect(errorsOf({ layers: [1.5] })).toEqual([each])
  })

  it('checks target and allowAddLayer', () => {
    for (const bad of [0.5, 1.2, 'high']) {
      expect(errorsOf({ target: bad })).toEqual([
        'Task 2: target must be a number above 0.5 and up to 1.',
      ])
    }
    expect(errorsOf({ allowAddLayer: 'yes' })).toEqual([
      'Task 2: allowAddLayer must be true or false.',
    ])
  })
})

describe('state and grading', () => {
  it('starts with the task layers, untrained', () => {
    const s = initialNetworkState(TASK)
    expect(s).toMatchObject({ layers: [3], acc: 0, epochs: 0, w: null })
    expect(startLayersOf({ layers: [9, 2], maxNeurons: 4 })).toEqual([4, 2])
    expect(startLayersOf({})).toEqual([3])
  })

  it('reads junk safely and drops numbers that do not fit the layers', () => {
    expect(normalizeNetworkState(TASK, 'junk')).toEqual(initialNetworkState(TASK))
    const s = normalizeNetworkState(TASK, { layers: [2], acc: 0.5, w: [1, 2] })
    expect(s.w).toBeNull()
    expect(s.layers).toEqual([2])
  })

  it('passes at the target, with hints that give nothing away', () => {
    const state = (acc, epochs = 10) => ({ ...initialNetworkState(TASK), acc, epochs })
    expect(gradeTask(TASK, state(0.9)).passed).toBe(true)
    expect(gradeTask(TASK, state(0.89)).passed).toBe(false)
    expect(gradeTask(TASK, state(0, 0)).hint).toMatch(/Train/)
    expect(gradeTask(TASK, state(0.5)).hint).toMatch(/longer/)
    expect(gradeTask(TASK, state(0.8)).hint).toMatch(/neurons or another layer/)
  })

  it('the default target is 0.9', () => {
    expect(gradeTask({}, { ...initialNetworkState({}), acc: 0.9 }).passed).toBe(true)
  })
})

describe('definition', () => {
  const state = (patch) => ({ ...definition.initialState(TASK), ...patch })

  it('the solution state passes and the start does not', () => {
    expect(definition.grade(TASK, definition.solutionState(TASK)).passed).toBe(true)
    expect(definition.grade(TASK, definition.initialState(TASK)).passed).toBe(false)
  })

  it('start, stop, new layers, a reset and passing are discrete; training updates are not', () => {
    const base = state({ training: true, acc: 0.6, epochs: 50 })
    const c = (next) => definition.classifyChange(base, next, TASK)
    expect(c({ ...base, acc: 0.7, epochs: 70, w: [] })).toBe('continuous')
    expect(c({ ...base, training: false })).toBe('discrete')
    expect(c({ ...base, layers: [3, 3] })).toBe('discrete')
    expect(c({ ...base, epochs: 0 })).toBe('discrete')
    expect(c({ ...base, acc: 0.95 })).toBe('discrete')
  })

  it('summarises for the tutor card and keeps the network numbers out of the submission', () => {
    expect(definition.summarize(TASK, definition.initialState(TASK)).text).toBe('Not trained yet')
    const s = state({ acc: 0.93, best: 0.95, epochs: 100, layers: [4, 3], maxLayers: 2 })
    expect(definition.summarize(TASK, s)).toEqual({
      text: '93% · 2 layers (4+3) · best 95%',
      tone: 'success',
    })
    expect(definition.summarize(TASK, { ...s, training: true, acc: 0.6 }).text).toMatch(
      /^Training · 60%/
    )
    const sub = definition.buildSubmission(TASK, { ...s, w: [1, 2, 3] })
    expect(sub).not.toHaveProperty('w')
    expect(sub).toMatchObject({ acc: 0.93, layers: [4, 3], maxLayers: 2 })
  })

  it('progress runs 0 to 10', () => {
    expect(definition.getProgress(TASK, definition.initialState(TASK))).toMatchObject({
      filled: 0,
      total: 10,
    })
    expect(definition.getProgress(TASK, state({ acc: 0.89 })).filled).toBe(9)
    expect(definition.getProgress(TASK, state({ acc: 0.9 })).filled).toBe(10)
  })

  it('reports how many reached the target and the layers used', () => {
    const attempt = (acc, maxLayers) => ({
      distinctAttempts: [
        { submission: JSON.stringify({ v: 1, layers: [3], acc, best: acc, maxLayers }) },
      ],
    })
    const out = definition.report.summaryFields(TASK, [attempt(0.9, 2), attempt(0.5, 1), {}])
    expect(out.networkResults).toEqual({
      count: 2,
      passedCount: 1,
      target: 0.9,
      avgAccuracy: 0.7,
      avgBestAccuracy: 0.7,
      avgLayersUsed: 1.5,
    })
  })

  it('never resumes training after a reload', () => {
    const raw = JSON.stringify({ training: true, layers: [3] })
    expect(definition.deserialize(raw, TASK).training).toBe(false)
  })
})
