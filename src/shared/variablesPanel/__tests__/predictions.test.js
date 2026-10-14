// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildPredictionLogEntry,
  evaluatePredictions,
  evaluateVariablesPredictedCheck,
  formatTargetValue,
  parsePythonLiteral,
  predictionMatches,
  summarizeVariablePredictions,
  targetMatches,
  variablePredictionReportFields,
  variablesCardSummary,
} from '../predictions.js'
import { taskPredictionFields } from '../predictionReport.js'
import { evaluateSingleCheck, getCheckDefinition } from '../../../modules/checks.js'

const str = (v) => ({ t: 'str', v })
const int = (v) => ({ t: 'int', v })
const float = (v, r) => ({ t: 'float', v, r })
const list = (items, t = 'list') => ({ t, items, len: items.length })
const dict = (entries) => ({
  t: 'dict',
  items: entries.map(([k, v]) => ({ k, v })),
  len: entries.length,
})
const snap = (entries) => ({ vars: entries.map(([n, v]) => ({ n, v })), scope: null })

describe('predictionMatches — forgiving, decided by the real type', () => {
  it('text: quotes optional, surrounding spaces ignored, capitals matter', () => {
    expect(predictionMatches('Sam', str('Sam'))).toBe(true)
    expect(predictionMatches(' "Sam" ', str('Sam'))).toBe(true)
    expect(predictionMatches("'Sam'", str('Sam'))).toBe(true)
    expect(predictionMatches('sam', str('Sam'))).toBe(false)
    expect(predictionMatches('"5"', str('5'))).toBe(true)
    expect(predictionMatches('5', str('5'))).toBe(true)
    expect(predictionMatches('"Hi SAM"', str('Hi SAM'))).toBe(true)
    expect(predictionMatches('""', str(''))).toBe(true)
    expect(predictionMatches('', str(''))).toBe(false)
  })

  it('numbers: 5 matches 5.0, quoted numbers are text', () => {
    expect(predictionMatches('5', int(5))).toBe(true)
    expect(predictionMatches('5.0', int(5))).toBe(true)
    expect(predictionMatches(' 5 ', float(5, '5.0'))).toBe(true)
    expect(predictionMatches('0.3', float(0.30000000000000004, '0.30000000000000004'))).toBe(true)
    expect(predictionMatches('"5"', int(5))).toBe(false)
    expect(predictionMatches('five', int(5))).toBe(false)
    expect(predictionMatches('-2', int(-2))).toBe(true)
  })

  it('True / False / None in any capitals', () => {
    expect(predictionMatches('true', { t: 'bool', v: true })).toBe(true)
    expect(predictionMatches('False', { t: 'bool', v: false })).toBe(true)
    expect(predictionMatches('True', { t: 'bool', v: false })).toBe(false)
    expect(predictionMatches('none', { t: 'none' })).toBe(true)
  })

  it('collections written as Python, item by item', () => {
    const bag = list([str('key'), str('map')])
    expect(predictionMatches('["key", "map"]', bag)).toBe(true)
    expect(predictionMatches("['key','map']", bag)).toBe(true)
    expect(predictionMatches('[key, map]', bag)).toBe(false)
    expect(predictionMatches('["map", "key"]', bag)).toBe(false)
    expect(predictionMatches('[1, 2.0]', list([int(1), int(2)]))).toBe(true)
    expect(predictionMatches('(1, 2)', list([int(1), int(2)], 'tuple'))).toBe(true)
    expect(predictionMatches('{2, 1}', list([int(1), int(2)], 'set'))).toBe(true)
    expect(
      predictionMatches(
        '{"a": 1, "b": [True]}',
        dict([
          [str('a'), int(1)],
          [str('b'), list([{ t: 'bool', v: true }])],
        ])
      )
    ).toBe(true)
    expect(predictionMatches('{"a": 2}', dict([[str('a'), int(1)]]))).toBe(false)
    expect(predictionMatches('[]', list([]))).toBe(true)
  })

  it('never matches values whose items were not all read', () => {
    expect(predictionMatches('[1]', { t: 'list', items: [int(1)], len: 60 })).toBe(false)
  })
})

describe('parsePythonLiteral', () => {
  it('reads literals and rejects anything else', () => {
    expect(parsePythonLiteral('[1, "a", None]')).toEqual({
      ok: true,
      value: [1, { str: 'a' }, null],
    })
    expect(parsePythonLiteral('(5)')).toEqual({ ok: true, value: 5 })
    expect(parsePythonLiteral('set()').ok).toBe(true)
    expect(parsePythonLiteral('[1, 2').ok).toBe(false)
    expect(parsePythonLiteral('x + 1').ok).toBe(false)
  })
})

describe('targetMatches', () => {
  it('compares lesson values by type', () => {
    expect(targetMatches(int(10), 10)).toBe(true)
    expect(targetMatches(float(10, '10.0'), 10)).toBe(true)
    expect(targetMatches(str('10'), 10)).toBe(false)
    expect(targetMatches(list([str('key'), str('map')]), ['key', 'map'])).toBe(true)
    expect(targetMatches(dict([[str('a'), int(1)]]), { a: 1 })).toBe(true)
    expect(targetMatches(dict([[int(1), str('x')]]), { 1: 'x' })).toBe(true)
    expect(targetMatches(null, 10)).toBe(false)
    expect(targetMatches({ t: 'none' }, null)).toBe(true)
  })

  it('formats target values as Python', () => {
    expect(formatTargetValue(['key', 'map'])).toBe('["key", "map"]')
    expect(formatTargetValue({ a: true, b: null })).toBe('{"a": True, "b": None}')
  })
})

describe('evaluatePredictions and the variables_predicted check', () => {
  const snapshot = snap([
    ['score', int(10)],
    ['lives', int(2)],
  ])

  it('marks each prediction in order; missing or blank is wrong', () => {
    const result = evaluatePredictions(
      ['score', 'lives', 'bonus'],
      { score: '10', lives: '3' },
      snapshot
    )
    expect(result.entries).toEqual([
      { name: 'score', value: '10', correct: true },
      { name: 'lives', value: '3', correct: false },
      { name: 'bonus', value: '', correct: false },
    ])
    expect(result.results).toEqual({ score: true, lives: false, bonus: false })
    expect(result.allCorrect).toBe(false)
  })

  it('passes only with every listed prediction right, after a run', () => {
    const context = {
      variablePredictions: {
        names: ['score', 'lives'],
        values: { score: '10.0', lives: '2' },
        snapshot,
      },
    }
    expect(evaluateVariablesPredictedCheck({ type: 'variables_predicted' }, '', context)).toBe(true)
    expect(
      evaluateVariablesPredictedCheck({ type: 'variables_predicted', names: ['score'] }, '', {
        variablePredictions: { ...context.variablePredictions, values: { score: '10' } },
      })
    ).toBe(true)
    expect(evaluateVariablesPredictedCheck({ type: 'variables_predicted' }, '', {})).toBe(false)
    expect(evaluateSingleCheck({ type: 'variables_predicted' }, '', context)).toBe(true)
  })

  it('is registered as a run-only check', () => {
    const def = getCheckDefinition('variables_predicted')
    expect(def.requiresRun).toBe(true)
    expect(def.submitAllowed).toBe(false)
    expect(def.appliesTo({ type: 'turtle', taskFields: [{ name: 'showVariables' }] })).toBe(true)
    expect(def.appliesTo({ type: 'html', taskFields: [] })).toBe(false)
  })
})

describe('tutor card summary', () => {
  const predictTask = { id: 4, showVariables: { mode: 'predict', predict: ['a', 'b'] } }

  it('counts predictions typed, then right', () => {
    expect(variablesCardSummary(predictTask, null)).toBeNull()
    expect(
      variablesCardSummary(predictTask, { taskId: 4, ran: false, predictions: { a: '1' } }).label
    ).toBe('Predicted 1/2')
    expect(
      variablesCardSummary(predictTask, {
        taskId: 4,
        ran: true,
        predictions: { a: '1', b: '2' },
        results: { a: true, b: false },
      }).label
    ).toBe('1/2 right')
    expect(
      variablesCardSummary(predictTask, { taskId: 9, ran: false, predictions: { a: '1' } })
    ).toBeNull()
  })

  it('counts targets hit after a run', () => {
    const task = { id: 5, showVariables: { mode: 'target', target: { a: 1, b: 'x' } } }
    const synced = {
      taskId: 5,
      ran: true,
      snapshots: [snap([['a', int(1)]])],
      index: 0,
    }
    expect(variablesCardSummary(task, synced).label).toBe('1/2 on target')
    expect(variablesCardSummary({ id: 6, showVariables: { mode: 'view' } }, synced)).toBeNull()
  })
})

describe('session report fields', () => {
  const task = { id: 13, showVariables: { mode: 'predict', predict: ['score', 'lives'] } }
  const first = buildPredictionLogEntry(
    {
      allCorrect: false,
      entries: [
        { name: 'score', value: '5', correct: false },
        { name: 'lives', value: '2', correct: true },
      ],
    },
    100
  )
  const second = buildPredictionLogEntry(
    {
      allCorrect: true,
      entries: [
        { name: 'score', value: '10', correct: true },
        { name: 'lives', value: '2', correct: true },
      ],
    },
    200
  )

  it('reports the first and latest reveal in predict order', () => {
    const studentNode = { predictionLog: { 13: { p2: second, p1: first } } }
    expect(taskPredictionFields(task, studentNode)).toEqual({
      predictions: {
        reveals: 2,
        first: [
          { name: 'score', value: '5', correct: false },
          { name: 'lives', value: '2', correct: true },
        ],
        last: [
          { name: 'score', value: '10', correct: true },
          { name: 'lives', value: '2', correct: true },
        ],
        firstAllCorrect: false,
        lastAllCorrect: true,
      },
    })
    expect(taskPredictionFields(task, {})).toEqual({})
    expect(taskPredictionFields({ id: 13, showVariables: { mode: 'view' } }, studentNode)).toEqual(
      {}
    )
    expect(variablePredictionReportFields(task, { predictionLog: { 13: { x: 'junk' } } })).toEqual(
      {}
    )
  })

  it('summarises first predictions across students', () => {
    const a = taskPredictionFields(task, { predictionLog: { 13: { p1: first } } })
    const b = taskPredictionFields(task, { predictionLog: { 13: { p1: second } } })
    expect(summarizeVariablePredictions([a, b, {}])).toEqual({
      predictionStudentCount: 2,
      predictionFirstAllCorrectCount: 1,
      predictionFirstByName: [
        { name: 'score', correct: 1, total: 2 },
        { name: 'lives', correct: 2, total: 2 },
      ],
    })
    expect(summarizeVariablePredictions([{}])).toEqual({})
  })
})
