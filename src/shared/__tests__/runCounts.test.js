// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isCountMarkerLine, parseLineHints, stripTaskLineHints } from '../lineHints.js'
import {
  anchorCountMarks,
  buildRunCounts,
  combineRunLocks,
  countPredictionMatches,
  describeRunCount,
  evaluateCountPredictions,
  evaluateLineRunCountCheck,
  evaluateRunsPredictedCheck,
  getRunCountLock,
  getRunCountWidgets,
  getRunCounts,
  getTaskCountMarks,
  ranTimesText,
  runCaptureOptions,
  runCountReportFields,
  summarizeRunCountPredictions,
  taskCountsRuns,
} from '../runCounts.js'
import {
  PREDICT_RUN_LOCK_MESSAGE,
  compactVariablesForSync,
} from '../variablesPanel/variablesPanel.js'
import { buildPredictionLogEntry, variablesCardSummary } from '../variablesPanel/predictions.js'
import { evaluateSingleCheck, getCheckDefinition } from '../../modules/checks.js'

// The request's example: "Hip Hip Hooray" (P6-26).
const AUTHORED = {
  id: 14,
  moduleType: 'python',
  title: 'Hip Hip Hooray',
  runCounts: 'predict',
  codeStages: [
    {
      role: 'starter',
      code: 'for i in range(3):\n    #@count\n    print("Hip")\n#@count\nprint("Hooray")\n',
    },
  ],
  check: [{ type: 'runs_predicted' }],
}
const TASK = stripTaskLineHints(AUTHORED, 'python')
const CODE = TASK.codeStages[0].code

describe('#@count marker', () => {
  it('is a Python-only marker line', () => {
    expect(isCountMarkerLine('#@count', 'python')).toBe(true)
    expect(isCountMarkerLine('    #@count  ', 'python')).toBe(true)
    expect(isCountMarkerLine('#@count the hips', 'python')).toBe(true)
    expect(isCountMarkerLine('#@counter', 'python')).toBe(false)
    expect(isCountMarkerLine('x = 1  #@count', 'python')).toBe(false)
    expect(isCountMarkerLine('#@count', 'html')).toBe(false)
  })

  it('is stripped and marks the next line of code, skipping blanks and comments', () => {
    const result = parseLineHints('x = 0\n#@count\n\n# loud\nprint(x)\n', 'python')
    expect(result.code).toBe('x = 0\n\n# loud\nprint(x)\n')
    expect(result.counts).toEqual([{ line: 4, target: 'print(x)' }])
    expect(result.countMissed).toBe(0)
  })

  it('marks a line once for several markers, and reports a marker with no line after it', () => {
    expect(parseLineHints('#@count\n#@count\nx = 1', 'python').counts).toEqual([
      { line: 1, target: 'x = 1' },
    ])
    expect(parseLineHints('x = 1\n#@count\n', 'python').countMissed).toBe(1)
  })

  it('keeps the other markers right beside it', () => {
    const result = parseLineHints('#@peek\n#@count\nx = 1\n#> Change this\ny = 2', 'python')
    expect(result.code).toBe('x = 1\ny = 2')
    expect(result.peek).toEqual({ line: 1, target: 'x = 1' })
    expect(result.counts).toEqual([{ line: 1, target: 'x = 1' }])
    expect(result.hints).toEqual([{ line: 2, text: 'Change this', target: 'y = 2' }])
  })

  it('gives the stripped task its runtime-only countSets', () => {
    expect(CODE).toBe('for i in range(3):\n    print("Hip")\nprint("Hooray")\n')
    expect(TASK.countSets).toEqual([
      {
        source: 'starter',
        stageIndex: 0,
        file: null,
        counts: [
          { line: 2, target: 'print("Hip")' },
          { line: 3, target: 'print("Hooray")' },
        ],
      },
    ])
    // Stripping twice is safe.
    expect(stripTaskLineHints(TASK, 'python')).toBe(TASK)
  })
})

describe('marks and capture', () => {
  it('reads the marks from a stripped task or the authored one, at most three', () => {
    const marks = [
      { key: 'L2', line: 2, target: 'print("Hip")' },
      { key: 'L3', line: 3, target: 'print("Hooray")' },
    ]
    expect(getTaskCountMarks(TASK)).toEqual(marks)
    expect(getTaskCountMarks(AUTHORED)).toEqual(marks)
    const four = { starterCode: '#@count\na=1\n#@count\nb=2\n#@count\nc=3\n#@count\nd=4' }
    expect(getTaskCountMarks(four).map((m) => m.key)).toEqual(['L1', 'L2', 'L3'])
  })

  it('follows the marked lines as the student moves code about', () => {
    expect(anchorCountMarks(TASK, `# my notes\n${CODE}`)).toEqual([
      { key: 'L2', line: 3 },
      { key: 'L3', line: 4 },
    ])
    expect(anchorCountMarks(TASK, 'print("Hooray")\n')).toEqual([{ key: 'L3', line: 1 }])
  })

  it('asks the worker to count the marked lines, after the runtime’s own lines', () => {
    expect(runCaptureOptions(TASK, CODE)).toEqual({
      panel: false,
      countLines: [2, 3],
      lineOffset: 0,
    })
    expect(runCaptureOptions(TASK, CODE, { lineOffset: 4 }).lineOffset).toBe(4)
    // With the name-tag panel too.
    const both = { ...TASK, showVariables: { mode: 'view' } }
    expect(runCaptureOptions(both, CODE)).toMatchObject({ panel: true, countLines: [2, 3] })
    // Nothing to count: the panel's own options (or null).
    expect(runCaptureOptions({ ...TASK, runCounts: undefined, check: [] }, CODE)).toBeNull()
  })

  it('counts a line_run_count check’s line even without runCounts', () => {
    const task = {
      id: 5,
      starterCode: 'for i in range(5):\n    stamp()\n',
      check: [{ type: 'line_run_count', line: 2, value: 5 }],
    }
    expect(getRunCounts(task)).toBeNull()
    expect(taskCountsRuns(task)).toBe(true)
    expect(runCaptureOptions(task, task.starterCode).countLines).toEqual([2])
    expect(buildRunCounts(task, task.starterCode, { 2: 5 })).toEqual({ L2: 5 })
  })

  it('turns the worker’s counts by line into counts by mark, 0 for a line that never ran', () => {
    expect(buildRunCounts(TASK, CODE, { 2: 3, 3: 1 })).toEqual({ L2: 3, L3: 1 })
    expect(buildRunCounts(TASK, `# top\n${CODE}`, { 3: 3 })).toEqual({ L2: 3, L3: 0 })
    // The code never started (a syntax error): no counts.
    expect(buildRunCounts(TASK, CODE, null)).toBeNull()
  })
})

describe('predictions', () => {
  it('compares whole numbers, spaces ignored', () => {
    expect(countPredictionMatches('3', 3)).toBe(true)
    expect(countPredictionMatches(' 3 ', 3)).toBe(true)
    expect(countPredictionMatches('3.0', 3)).toBe(false)
    expect(countPredictionMatches('', 0)).toBe(false)
    expect(countPredictionMatches('0', 0)).toBe(true)
  })

  it('marks each box, a blank one wrong', () => {
    const result = evaluateCountPredictions(
      getTaskCountMarks(TASK),
      { L2: '3', L3: '3' },
      { L2: 3, L3: 1 }
    )
    expect(result.results).toEqual({ L2: true, L3: false })
    expect(result.entries[1]).toEqual({ key: 'L3', line: 3, value: '3', ran: 1, correct: false })
    expect(result.allCorrect).toBe(false)
  })

  it('says it in words: "ran 1 time", and the full sentence for screen readers', () => {
    expect(ranTimesText(1)).toBe('ran 1 time')
    expect(ranTimesText(0)).toBe('ran 0 times')
    expect(describeRunCount({ line: 3, count: 4, value: '4', correct: true })).toBe(
      'Line 3 ran 4 times. You predicted 4: right.'
    )
    expect(describeRunCount({ line: 3, count: 1, value: '3', correct: false })).toBe(
      'Line 3 ran 1 time. You predicted 3: not quite.'
    )
    expect(describeRunCount({ line: 2, count: 0 })).toBe('Line 2 ran 0 times.')
  })
})

describe('the Run lock (shared with predict mode)', () => {
  it('waits for every box shown on the code, with predict mode’s words', () => {
    expect(getRunCountLock(TASK, null, CODE)).toEqual({
      message: PREDICT_RUN_LOCK_MESSAGE,
      missing: ['line 2 (runs)', 'line 3 (runs)'],
    })
    const typed = { taskId: 14, counts: { L2: '3', L3: '1' } }
    expect(getRunCountLock(TASK, typed, CODE)).toBeNull()
    // A mark the student deleted has no box, so it never blocks.
    expect(getRunCountLock(TASK, { taskId: 14, counts: { L2: '3' } }, 'print("Hip")')).toBeNull()
  })

  it('lifts after the first Run, and never locks in show mode or with lockRun: false', () => {
    expect(getRunCountLock(TASK, { taskId: 14, counts: {}, ran: true }, CODE)).toBeNull()
    expect(getRunCountLock({ ...TASK, runCounts: 'show' }, null, CODE)).toBeNull()
    expect(
      getRunCountLock({ ...TASK, showVariables: { mode: 'view', lockRun: false } }, null, CODE)
    ).toBeNull()
  })

  it('joins with the name-tag panel’s lock', () => {
    const a = { message: PREDICT_RUN_LOCK_MESSAGE, missing: ['coins'] }
    const b = { message: PREDICT_RUN_LOCK_MESSAGE, missing: ['line 2 (runs)'] }
    expect(combineRunLocks(null, null)).toBeNull()
    expect(combineRunLocks(a, b)).toEqual({
      message: PREDICT_RUN_LOCK_MESSAGE,
      missing: ['coins', 'line 2 (runs)'],
    })
  })
})

describe('the editor widgets', () => {
  it('are boxes before the first Run, then counts with a verdict', () => {
    const before = getRunCountWidgets(TASK, CODE, {
      panel: { predictions: { taskId: 14, counts: { L2: '3' } }, countRun: null },
    })
    expect(before).toEqual({
      mode: 'predict',
      readOnly: false,
      marks: [
        { key: 'L2', line: 2, value: '3', count: null, correct: null, editable: true },
        { key: 'L3', line: 3, value: '', count: null, correct: null, editable: true },
      ],
    })
    const after = getRunCountWidgets(TASK, CODE, {
      panel: {
        predictions: { taskId: 14, counts: { L2: '3', L3: '3' }, ran: true },
        countRun: { taskId: 14, counts: { L2: 3, L3: 1 } },
      },
    })
    expect(after.marks.map((m) => [m.count, m.correct, m.editable])).toEqual([
      [3, true, false],
      [1, false, false],
    ])
  })

  it('stop being editable while the program runs', () => {
    const running = getRunCountWidgets(
      TASK,
      CODE,
      { panel: { predictions: null, countRun: null } },
      { running: true }
    )
    expect(running.marks.every((m) => !m.editable)).toBe(true)
  })

  it('show a synced copy read-only (a tutor, Go Live), and nothing without runCounts', () => {
    const synced = compactVariablesForSync(
      null,
      { taskId: 14, counts: { L2: '3', L3: '3' }, countResults: { L2: true, L3: false } },
      { taskId: 14, counts: { L2: 3, L3: 1 } }
    )
    const view = getRunCountWidgets(TASK, CODE, { synced }, { readOnly: true })
    expect(view.readOnly).toBe(true)
    expect(view.marks.map((m) => [m.value, m.count, m.editable])).toEqual([
      ['3', 3, false],
      ['3', 1, false],
    ])
    expect(getRunCountWidgets({ ...TASK, runCounts: undefined }, CODE)).toBeNull()
  })
})

describe('checks', () => {
  const context = {
    runCounts: {
      marks: getTaskCountMarks(TASK),
      values: { L2: '3', L3: '1' },
      counts: { L2: 3, L3: 1 },
    },
  }

  it('runs_predicted: every marked line (or the named lines) predicted right', () => {
    expect(evaluateRunsPredictedCheck({ type: 'runs_predicted' }, '', context)).toBe(true)
    const wrong = { runCounts: { ...context.runCounts, values: { L2: '3', L3: '3' } } }
    expect(evaluateRunsPredictedCheck({ type: 'runs_predicted' }, '', wrong)).toBe(false)
    expect(evaluateRunsPredictedCheck({ type: 'runs_predicted', lines: [2] }, '', wrong)).toBe(true)
    expect(evaluateRunsPredictedCheck({ type: 'runs_predicted', lines: [9] }, '', wrong)).toBe(
      false
    )
    expect(evaluateRunsPredictedCheck({ type: 'runs_predicted' }, '', {})).toBe(false)
  })

  it('line_run_count: the marked line (or `line`) ran equals / min / max times', () => {
    expect(evaluateLineRunCountCheck({ value: 3 }, '', context)).toBe(true)
    expect(evaluateLineRunCountCheck({ line: 3, value: 1 }, '', context)).toBe(true)
    expect(evaluateLineRunCountCheck({ line: 2, operator: 'min', value: 2 }, '', context)).toBe(
      true
    )
    expect(evaluateLineRunCountCheck({ line: 2, operator: 'max', value: 2 }, '', context)).toBe(
      false
    )
    expect(evaluateLineRunCountCheck({ line: 7, value: 0 }, '', context)).toBe(false)
    expect(evaluateLineRunCountCheck({ value: 3 }, '', {})).toBe(false)
  })

  it('are registered run-only checks for Python and Turtle', () => {
    for (const type of ['runs_predicted', 'line_run_count']) {
      const def = getCheckDefinition(type)
      expect(def.requiresRun).toBe(true)
      expect(def.submitAllowed).toBe(false)
      expect(def.appliesTo({ type: 'turtle', taskFields: [{ name: 'runCounts' }] })).toBe(true)
      expect(def.appliesTo({ type: 'html', taskFields: [] })).toBe(false)
    }
    expect(evaluateSingleCheck({ type: 'runs_predicted' }, '', context)).toBe(true)
    expect(evaluateSingleCheck({ type: 'line_run_count', line: 3, value: 1 }, '', context)).toBe(
      true
    )
  })
})

describe('tutor chip and session report', () => {
  it('counts the boxes on the tutor chip, with or without the name-tag panel', () => {
    const typing = compactVariablesForSync(null, { taskId: 14, counts: { L2: '3' } })
    expect(variablesCardSummary(TASK, typing).label).toBe('Predicted 1/2')
    const revealed = compactVariablesForSync(
      null,
      { taskId: 14, counts: { L2: '3', L3: '3' }, countResults: { L2: true, L3: false } },
      { taskId: 14, counts: { L2: 3, L3: 1 } }
    )
    expect(variablesCardSummary(TASK, revealed)).toEqual({
      label: '1/2 right',
      title: 'Predictions: line 2 runs = 3 ✓, line 3 runs = 3 ✗',
    })
    // Show mode has nothing to predict.
    expect(variablesCardSummary({ ...TASK, runCounts: 'show' }, revealed)).toBeNull()
  })

  it('records each prediction with its real count, and summarises the off-by-ones', () => {
    const evaluation = evaluateCountPredictions(
      getTaskCountMarks(TASK),
      { L2: '4', L3: '1' },
      { L2: 3, L3: 1 }
    )
    const entry = buildPredictionLogEntry(null, 100, { countEvaluation: evaluation })
    expect(entry).toEqual({
      at: 100,
      allCorrect: false,
      entries: {},
      counts: {
        L2: { value: '4', ran: 3, correct: false },
        L3: { value: '1', ran: 1, correct: true },
      },
    })
    const fields = runCountReportFields(AUTHORED, { predictionLog: { 14: { p1: entry } } })
    expect(fields.runCountPredictions.first).toEqual([
      { line: 2, value: '4', ran: 3, correct: false },
      { line: 3, value: '1', ran: 1, correct: true },
    ])
    expect(fields.runCountPredictions.firstAllCorrect).toBe(false)
    expect(summarizeRunCountPredictions([fields, {}])).toEqual({
      runCountStudentCount: 1,
      runCountFirstAllCorrectCount: 0,
      runCountFirstByLine: [
        { line: 2, correct: 0, total: 1, offByOne: 1 },
        { line: 3, correct: 1, total: 1, offByOne: 0 },
      ],
    })
    expect(runCountReportFields({ ...AUTHORED, runCounts: 'show' }, {})).toEqual({})
  })
})
