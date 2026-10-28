import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  allowInputsOf,
  gradeTask,
  startInputsOf,
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

describe('inputs, zero layers and new dots', () => {
  const MORE = {
    ...TASK,
    inputs: ['x', 'y'],
    allowInputs: ['x', 'y', 'x2', 'y2'],
    allowZeroLayers: true,
    testDots: true,
  }

  it('validates the new fields', () => {
    expect(validateNetworkPlaygroundTask(MORE, 1)).toEqual([])
    expect(errorsOf({ allowInputs: ['x', 'z'] })).toEqual([
      'Task 2: allowInputs must list 1 to 4 different inputs from x, y, x2 and y2.',
    ])
    expect(errorsOf({ allowInputs: [] })).toHaveLength(1)
    expect(errorsOf({ inputs: ['x', 'x'] })).toEqual([
      'Task 2: inputs must list 1 to 4 different inputs from x, y, x2 and y2.',
    ])
    expect(errorsOf({ inputs: ['x2'], allowInputs: ['x', 'y'] })).toEqual([
      'Task 2: every input in inputs must also be in allowInputs.',
    ])
    expect(errorsOf({ allowZeroLayers: 'yes' })).toEqual([
      'Task 2: allowZeroLayers must be true or false.',
    ])
    expect(errorsOf({ testDots: 1 })).toEqual(['Task 2: testDots must be true or false.'])
  })

  it('allows an empty layers list only with allowZeroLayers', () => {
    expect(errorsOf({ layers: [] })).toEqual(['Task 2: layers must list 1 or 2 hidden layers.'])
    expect(errorsOf({ layers: [], allowZeroLayers: true })).toEqual([])
    expect(startLayersOf({ layers: [], allowZeroLayers: true })).toEqual([])
    expect(startLayersOf({ layers: [] })).toEqual([3])
  })

  it('starts with x and y unless the task says otherwise', () => {
    expect(startInputsOf(TASK)).toEqual(['x', 'y'])
    expect(startInputsOf({ inputs: ['x2', 'y2'], allowInputs: ['x', 'y', 'x2', 'y2'] })).toEqual([
      'x2',
      'y2',
    ])
    expect(allowInputsOf(TASK)).toEqual([])
    expect(initialNetworkState(TASK).inputs).toEqual(['x', 'y'])
  })

  it('keeps only inputs the task allows, and zero layers only when allowed', () => {
    const s = normalizeNetworkState(MORE, { layers: [], inputs: ['y2', 'x2', 'q'], test: 0.8 })
    expect(s.layers).toEqual([])
    expect(s.inputs).toEqual(['x2', 'y2'])
    expect(s.test).toBe(0.8)
    expect(normalizeNetworkState(TASK, { layers: [], inputs: ['x2'] }).layers).toEqual([3])
    expect(normalizeNetworkState(TASK, { inputs: ['x2'] }).inputs).toEqual(['x', 'y'])
    expect(normalizeNetworkState(MORE, { test: 9 }).test).toBeNull()
  })

  it('shows the inputs and the new-dots score to the tutor, and reports them', () => {
    const s = {
      ...normalizeNetworkState(MORE, {}),
      layers: [],
      inputs: ['x2', 'y2'],
      acc: 0.95,
      best: 0.95,
      epochs: 40,
      test: 0.9,
      maxLayers: 1,
    }
    expect(definition.summarize(MORE, s).text).toBe(
      '95% · 0 layers (none) · inputs x², y² · new dots 90%'
    )
    expect(
      definition.summarize(TASK, { ...s, layers: [3], inputs: ['x', 'y'], test: null }).text
    ).toBe('95% · 1 layer (3)')
    expect(definition.buildSubmission(MORE, s)).toMatchObject({ inputs: ['x2', 'y2'], test: 0.9 })
    const out = definition.report.summaryFields(MORE, [
      { distinctAttempts: [{ submission: JSON.stringify(s) }] },
    ])
    expect(out.networkResults).toMatchObject({
      inputCounts: { x2: 1, y2: 1 },
      avgNewDots: 0.9,
    })
  })

  it('a new new-dots score is a discrete change', () => {
    const base = normalizeNetworkState(MORE, { layers: [3], acc: 0.6, epochs: 50 })
    expect(definition.classifyChange(base, { ...base, test: 0.7 }, MORE)).toBe('discrete')
    expect(definition.classifyChange(base, { ...base, inputs: ['x2', 'y2'] }, MORE)).toBe(
      'discrete'
    )
  })
})
