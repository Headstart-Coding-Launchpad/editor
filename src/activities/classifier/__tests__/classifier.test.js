// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  GRID,
  K,
  addClass,
  addExample,
  canTest,
  canTrain,
  classify,
  clearExamples,
  countsOf,
  decodeGrid,
  describeConfusion,
  describeResult,
  encodeGrid,
  gradeTask,
  gridFromRows,
  heldOutIndexes,
  initialClassifierState,
  isGridString,
  normalizeClassifierState,
  rasterize,
  recordLive,
  removeClass,
  removeExample,
  runTest,
  setClassName,
  sharedState,
  solutionFor,
  splitExamples,
  tally,
  teacherTestItems,
  train,
  validateClassifierTask,
  validateClassifierWarnings,
} from '../classifier.js'
import definition from '../definition.js'

// Pure logic tests for the Classifier activity. The shared contract (default task validates,
// state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'classifier',
  mode: 'drawing',
  classes: ['circle', 'line'],
  minExamplesPerClass: 4,
  testSet: 'held_out',
  targetAccuracy: 0.75,
}

const circle = (r = 0.3, dx = 0) => [
  Array.from({ length: 25 }, (_, i) => [
    0.5 + dx + r * Math.cos((i / 24) * 2 * Math.PI),
    0.5 + r * Math.sin((i / 24) * 2 * Math.PI),
  ]),
]
const line = (tilt = 0) => [
  [
    [0.1, 0.5 + tilt],
    [0.9, 0.5 - tilt],
  ],
]
const gridOf = (strokes) => encodeGrid(rasterize(strokes))

function withExamples(task = TASK, perClass = 8) {
  let state = initialClassifierState(task)
  for (let i = 0; i < perClass; i += 1) {
    state = addExample(state, 'circle', gridOf(circle(0.2 + i * 0.03, i * 0.01)))
    state = addExample(state, 'line', gridOf(line(i * 0.02 - 0.05)))
  }
  return state
}

describe('rasterize / grids', () => {
  it('makes a GRID x GRID grid of values from 0 to 1', () => {
    const cells = rasterize(circle())
    expect(cells).toHaveLength(GRID * GRID)
    expect(Math.max(...cells)).toBe(1)
    expect(Math.min(...cells)).toBe(0)
  })

  it('is empty with no strokes and ignores junk points', () => {
    expect(rasterize([]).every((v) => v === 0)).toBe(true)
    expect(rasterize([[['x', 1]]]).every((v) => v === 0)).toBe(true)
  })

  it('does not care where or how big the drawing is', () => {
    const small = gridOf([
      [
        [0.1, 0.1],
        [0.3, 0.1],
        [0.3, 0.3],
      ],
    ])
    const big = gridOf([
      [
        [0.4, 0.4],
        [0.8, 0.4],
        [0.8, 0.8],
      ],
    ])
    expect(small).toBe(big)
  })

  it('draws a single dot in the middle', () => {
    const cells = rasterize([[[0.9, 0.2]]])
    expect(cells[8 * GRID + 8]).toBeGreaterThan(0.8)
    expect(cells[0]).toBe(0)
  })

  it('encodes and decodes one digit per cell', () => {
    const text = gridOf(circle())
    expect(isGridString(text)).toBe(true)
    expect(text).toHaveLength(256)
    expect(encodeGrid(decodeGrid(text))).toBe(text)
    expect(decodeGrid('nope').every((v) => v === 0)).toBe(true)
  })

  it('reads authored grid rows (. empty, # ink, digits)', () => {
    const rows = Array(GRID).fill('.#5'.padEnd(GRID, '.'))
    const text = gridFromRows(rows)
    expect(isGridString(text)).toBe(true)
    expect(text.slice(0, 3)).toBe('095')
  })
})

describe('classify (k-nearest-neighbours)', () => {
  const near = gridOf(circle(0.3))
  const far = gridOf(line())

  it('uses K = 3', () => expect(K).toBe(3))

  it('returns null with no examples', () => expect(classify([], near)).toBeNull())

  it('picks the label of the closest drawings', () => {
    const examples = [
      { label: 'circle', grid: gridOf(circle(0.28)) },
      { label: 'circle', grid: gridOf(circle(0.32)) },
      { label: 'line', grid: far },
      { label: 'line', grid: gridOf(line(0.04)) },
    ]
    expect(classify(examples, near)).toBe('circle')
    expect(classify(examples, gridOf(line(0.02)))).toBe('line')
  })

  it('takes a vote of the 3 nearest, not just the nearest', () => {
    const examples = [
      { label: 'line', grid: near },
      { label: 'circle', grid: gridOf(circle(0.31)) },
      { label: 'circle', grid: gridOf(circle(0.29)) },
      { label: 'line', grid: far },
    ]
    expect(classify(examples, near)).toBe('circle')
  })

  it('breaks a tie with the closer drawings', () => {
    const examples = [
      { label: 'a', grid: near },
      { label: 'b', grid: far },
    ]
    expect(classify(examples, near)).toBe('a')
  })
})

describe('state changes', () => {
  it('adds, counts and removes drawings, and a change makes the model stale', () => {
    let state = withExamples(TASK, 3)
    expect(countsOf(state)).toEqual({ circle: 3, line: 3 })
    state = train(TASK, state)
    expect(state.trained).toBe(true)
    state = removeExample(state, 'circle', 0)
    expect(countsOf(state).circle).toBe(2)
    expect(state.trained).toBe(false)
    expect(state.result).toBeNull()
  })

  it('ignores a drawing for an unknown class or a bad grid', () => {
    const state = initialClassifierState(TASK)
    expect(addExample(state, 'dog', gridOf(circle()))).toBe(state)
    expect(addExample(state, 'circle', 'abc')).toBe(state)
  })

  it('caps drawings per class', () => {
    let state = initialClassifierState(TASK)
    for (let i = 0; i < 45; i += 1) state = addExample(state, 'circle', gridOf(circle()))
    expect(countsOf(state).circle).toBe(40)
  })

  it('clears every drawing', () => {
    expect(countsOf(clearExamples(withExamples(TASK, 3)))).toEqual({ circle: 0, line: 0 })
  })

  it('lets the student name classes until they have drawings, and trims on the first drawing', () => {
    const task = { ...TASK, classes: [] }
    let state = initialClassifierState(task)
    state = setClassName(state, 0, 'cat ')
    state = setClassName(state, 1, 'fish')
    state = addExample(state, 'cat ', gridOf(circle()))
    expect(state.classes).toEqual(['cat', 'fish'])
    expect(setClassName(state, 0, 'dog').classes[0]).toBe('cat')
    state = addClass(state)
    expect(state.classes).toEqual(['cat', 'fish', ''])
    expect(removeClass(state, 2).classes).toEqual(['cat', 'fish'])
  })

  it('does not add a drawing under a duplicate class name', () => {
    const task = { ...TASK, classes: [] }
    let state = setClassName(setClassName(initialClassifierState(task), 0, 'cat'), 1, 'cat')
    expect(addExample(state, 'cat', gridOf(circle()))).toBe(state)
    const dup = setClassName(setClassName(initialClassifierState(task), 0, 'cat'), 1, 'cat ')
    expect(addExample(dup, 'cat ', gridOf(circle()))).toBe(dup)
  })

  it('caps the class list at 6', () => {
    let state = initialClassifierState({ ...TASK, classes: [] })
    for (let i = 0; i < 10; i += 1) state = addClass(state)
    expect(state.classes).toHaveLength(6)
  })
})

describe('held-out split', () => {
  it('keeps back every 4th drawing in a class', () => {
    expect(heldOutIndexes(3)).toEqual([])
    expect(heldOutIndexes(4)).toEqual([3])
    expect(heldOutIndexes(8)).toEqual([3, 7])
    expect(heldOutIndexes(11)).toEqual([3, 7])
  })

  it('splits train and held for held_out and keeps everything for training otherwise', () => {
    const state = withExamples(TASK, 8)
    const split = splitExamples(TASK, state)
    expect(split.held).toHaveLength(4)
    expect(split.train).toHaveLength(12)
    const teacher = splitExamples({ ...TASK, testSet: 'teacher' }, state)
    expect(teacher.held).toHaveLength(0)
    expect(teacher.train).toHaveLength(16)
  })
})

describe('train and test', () => {
  it('needs two classes with 2 drawings each to train', () => {
    expect(canTrain(withExamples(TASK, 1))).toBe(false)
    expect(canTrain(withExamples(TASK, 2))).toBe(true)
    const state = train(TASK, withExamples(TASK, 1))
    expect(state.trained).toBe(false)
  })

  it('drops blank class rows when it trains', () => {
    const task = { ...TASK, classes: [] }
    let state = initialClassifierState(task)
    state = setClassName(setClassName(state, 0, 'a'), 1, 'b')
    state = addExample(addExample(state, 'a', gridOf(circle())), 'a', gridOf(circle(0.2)))
    state = addExample(addExample(state, 'b', gridOf(line())), 'b', gridOf(line(0.1)))
    state = addClass(state)
    expect(train(task, state).classes).toEqual(['a', 'b'])
  })

  it('tests on the kept-back drawings and reports counts', () => {
    let state = train(TASK, withExamples(TASK, 8))
    expect(canTest(TASK, state)).toBe(true)
    state = runTest(TASK, state)
    expect(state.result.total).toBe(4)
    expect(state.result.right).toBe(4)
    expect(state.tests).toBe(1)
    expect(describeResult(state.result)).toBe('4 of 4 right, 100%')
  })

  it('cannot test before training or with nothing kept back', () => {
    expect(canTest(TASK, withExamples(TASK, 8))).toBe(false)
    expect(canTest(TASK, train(TASK, withExamples(TASK, 3)))).toBe(false)
  })

  it('tests on the teacher drawings (strokes and grid)', () => {
    const task = {
      ...TASK,
      testSet: 'teacher',
      testItems: [
        { label: 'circle', strokes: [circle(0.3).flat().flat()] },
        { label: 'line', strokes: [[0.1, 0.5, 0.9, 0.5]] },
        { label: 'line', grid: Array(GRID).fill('.'.repeat(GRID)) },
      ],
    }
    expect(teacherTestItems(task)).toHaveLength(3)
    const state = runTest(task, train(task, withExamples(task, 4)))
    expect(state.result.total).toBe(3)
    expect(state.result.confusion.circle.circle).toBe(1)
    expect(state.result.confusion.line.line).toBeGreaterThanOrEqual(1)
  })

  it('records live test drawings and shows a result once enough are done', () => {
    const task = { ...TASK, testSet: 'live', liveTestSize: 3 }
    let state = train(task, withExamples(task, 4))
    let done = recordLive(task, state, 'circle', gridOf(circle(0.25)))
    expect(done.predicted).toBe('circle')
    expect(done.state.result).toBeNull()
    state = done.state
    state = recordLive(task, state, 'line', gridOf(line(0.03))).state
    expect(state.result).toBeNull()
    done = recordLive(task, state, 'line', gridOf(circle(0.3)))
    expect(done.predicted).toBe('circle')
    expect(done.state.result).toEqual({
      right: 2,
      total: 3,
      confusion: { circle: { circle: 1 }, line: { line: 1, circle: 1 } },
    })
  })

  it('refuses a live drawing before training', () => {
    const task = { ...TASK, testSet: 'live' }
    const state = withExamples(task, 4)
    expect(recordLive(task, state, 'circle', gridOf(circle())).predicted).toBeNull()
  })

  it('tallies a confusion table and says it in words', () => {
    const result = tally([
      ['cat', 'cat'],
      ['cat', 'cat'],
      ['cat', 'fish'],
      ['cat', 'rocket'],
      ['fish', 'fish'],
    ])
    expect(describeResult(result)).toBe('3 of 5 right, 60%')
    const rows = describeConfusion(result, ['cat', 'fish', 'rocket'])
    expect(rows.map((r) => r.text)).toEqual([
      'cat: 2 of 4 right. 1 was called fish; 1 was called rocket.',
      'fish: 1 of 1 right.',
    ])
  })
})

describe('grading and hints', () => {
  it('hints at the first thing missing, in order', () => {
    const task = TASK
    expect(gradeTask(task, initialClassifierState(task)).hint).toMatch(
      /Draw more circle: you have 0 and need 4/
    )
    let state = withExamples(task, 4)
    expect(gradeTask(task, state).hint).toMatch(/Press Train/)
    state = train(task, state)
    expect(gradeTask(task, state).hint).toMatch(/Press Test/)
    const live = { ...task, testSet: 'live' }
    expect(gradeTask(live, state).hint).toMatch(/Test the model on 5 new drawings/)
    expect(
      gradeTask(task, {
        ...state,
        result: tally([
          ['circle', 'line'],
          ['line', 'line'],
        ]),
      }).hint
    ).toMatch(/got 50% and needs 75%/)
  })

  it('passes when trained, enough drawings and the target is reached', () => {
    const state = runTest(TASK, train(TASK, withExamples(TASK, 8)))
    const graded = gradeTask(TASK, state)
    expect(graded.passed).toBe(true)
    expect(graded.accuracy).toBe(1)
    expect(graded.hint).toBeNull()
  })

  it('does not pass with too few drawings in a class even at 100%', () => {
    const state = runTest(TASK, train(TASK, withExamples(TASK, 4)))
    expect(state.result.total).toBe(2)
    const short = removeExample(state, 'circle', 0)
    expect(gradeTask(TASK, { ...short, trained: true, result: state.result }).passed).toBe(false)
  })

  it('needs at least two named classes when the student names them', () => {
    const task = { ...TASK, classes: [] }
    const graded = gradeTask(task, initialClassifierState(task))
    expect(graded.passed).toBe(false)
    expect(graded.hint).toMatch(/at least two things/)
  })

  it('reads counts from the shared summary', () => {
    const shared = normalizeClassifierState(
      TASK,
      sharedState(runTest(TASK, train(TASK, withExamples(TASK, 8))))
    )
    expect(shared.examples).toBeUndefined()
    expect(countsOf(shared)).toEqual({ circle: 8, line: 8 })
    expect(gradeTask(TASK, shared).passed).toBe(true)
  })
})

describe('privacy: what is shared', () => {
  it('never contains a drawing', () => {
    const state = runTest(TASK, train(TASK, withExamples(TASK, 8)))
    const shared = definition.serializeShared(state)
    expect(shared).not.toMatch(/examples/)
    expect(shared).not.toMatch(/\d{40}/)
    expect(JSON.parse(shared)).toEqual({
      v: 1,
      shared: true,
      classes: ['circle', 'line'],
      counts: { circle: 8, line: 8 },
      trained: true,
      result: state.result,
      liveCount: 0,
      tests: 1,
    })
    // The device's own copy does keep them.
    expect(definition.serialize(state)).toMatch(/examples/)
  })

  it('stays small with the most classes and the longest names', () => {
    const names = [
      'abcdefghijklmnop',
      'bcdefghijklmnopq',
      'cdefghijklmnopqr',
      'defghijklmnopqrs',
      'efghijklmnopqrst',
      'fghijklmnopqrstu',
    ].map((n) => n.slice(0, 16))
    const task = { ...TASK, classes: names, minExamplesPerClass: 4 }
    const confusion = Object.fromEntries(
      names.map((a) => [a, Object.fromEntries(names.map((b) => [b, 99]))])
    )
    const state = {
      ...initialClassifierState(task),
      trained: true,
      result: { right: 99, total: 3564, confusion },
    }
    expect(definition.serializeShared(state).length).toBeLessThan(2048)
  })

  it('the shared form of a state with drawings reads back to the same counts', () => {
    const state = train(TASK, withExamples(TASK, 5))
    const back = definition.deserialize(definition.serializeShared(state), TASK)
    expect(countsOf(back)).toEqual({ circle: 5, line: 5 })
    expect(back.trained).toBe(true)
  })

  it('a shared state turned back into work starts clean', () => {
    const shared = definition.deserialize(definition.serializeShared(withExamples(TASK, 5)), TASK)
    const next = addExample(shared, 'circle', gridOf(circle()))
    expect(next.shared).toBeUndefined()
    expect(next.counts).toBeUndefined()
    expect(countsOf(next)).toEqual({ circle: 1, line: 0 })
  })
})

describe('definition', () => {
  const trained = train(TASK, withExamples(TASK, 8))

  it('classifies a class name typed as continuous and everything else as discrete', () => {
    const task = { ...TASK, classes: [] }
    const named = setClassName(initialClassifierState(task), 0, 'c')
    expect(definition.classifyChange(initialClassifierState(task), named, task)).toBe('continuous')
    expect(
      definition.classifyChange(
        initialClassifierState(TASK),
        addExample(initialClassifierState(TASK), 'circle', gridOf(circle())),
        TASK
      )
    ).toBe('discrete')
    expect(
      definition.classifyChange(withExamples(TASK, 3), train(TASK, withExamples(TASK, 3)), TASK)
    ).toBe('discrete')
  })

  it('summarises for the teacher card', () => {
    expect(definition.summarize(TASK, initialClassifierState(TASK)).text).toBe('No drawings yet')
    expect(definition.summarize(TASK, withExamples(TASK, 3)).text).toBe('6 drawings, not trained')
    expect(definition.summarize(TASK, train(TASK, withExamples(TASK, 3))).text).toBe(
      '6 drawings, trained'
    )
    const tested = runTest(TASK, trained)
    expect(definition.summarize(TASK, tested)).toEqual({
      text: '16 drawings, 100% on test',
      tone: 'success',
    })
  })

  it('reports progress per class', () => {
    expect(definition.getProgress(TASK, withExamples(TASK, 4))).toEqual({
      kind: 'items',
      filled: 2,
      total: 2,
      correct: 2,
    })
    expect(definition.getProgress(TASK, withExamples(TASK, 3))).toEqual({
      kind: 'items',
      filled: 0,
      total: 2,
      correct: 0,
    })
    const grade = definition.grade(TASK, withExamples(TASK, 3))
    expect(grade.passed).toBe(false)
    expect(grade.itemResults).toEqual({ circle: false, line: false })
  })

  it('logs the shared form as the submission', () => {
    expect(definition.buildSubmission(TASK, trained).shared).toBe(true)
    expect(JSON.stringify(definition.buildSubmission(TASK, trained))).not.toMatch(/examples/)
  })

  it('adds up accuracy and confusion across students for the report', () => {
    const tested = runTest(TASK, trained)
    const wrong = {
      ...tested,
      result: tally([
        ['circle', 'line'],
        ['line', 'line'],
      ]),
    }
    const sub = (state) => ({ distinctAttempts: [{ submission: sharedState(state) }] })
    const fields = definition.report.summaryFields(TASK, [
      sub(tested),
      sub(wrong),
      { distinctAttempts: [] },
    ])
    expect(fields.classifierResults).toEqual({
      testedCount: 2,
      atTargetCount: 1,
      targetAccuracy: 0.75,
      avgAccuracy: 0.75,
      confusion: {
        circle: { circle: 2, line: 1 },
        line: { line: 3 },
      },
    })
  })

  it('seals the test drawings', () => {
    expect(definition.sealedFields).toContain('testItems')
  })

  it('has a solution that passes and an initial state that does not', () => {
    expect(definition.grade(TASK, definition.solutionState(TASK)).passed).toBe(true)
    expect(definition.grade(TASK, definition.initialState(TASK)).passed).toBe(false)
    const free = { ...TASK, classes: [] }
    expect(solutionFor(free).classes).toHaveLength(2)
  })

  it('prints the setup', () => {
    const html = definition.printHtml(TASK, { esc: (v) => String(v) })
    expect(html).toContain('circle, line')
    expect(html).toContain('75%')
  })
})

describe('validateClassifierTask', () => {
  const ok = (task) => validateClassifierTask(task, 3)

  it('accepts a valid task and the default task', () => {
    expect(ok(TASK)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('says sound is not built yet', () => {
    expect(ok({ ...TASK, mode: 'sound' })).toEqual([
      'Task 3: classifier mode sound is not built yet. Use mode: drawing.',
    ])
  })

  it('rejects an unknown mode and test set', () => {
    expect(ok({ ...TASK, mode: 'webcam' })).toEqual(['Task 3: classifier mode must be drawing.'])
    expect(ok({ ...TASK, mode: undefined })[0]).toMatch(/mode must be drawing/)
    expect(ok({ ...TASK, testSet: 'x' })[0]).toMatch(
      /testSet must be one of held_out, teacher, live/
    )
    expect(ok({ ...TASK, testSet: undefined })[0]).toMatch(/testSet must be one of/)
  })

  it('checks the classes', () => {
    expect(ok({ ...TASK, classes: 'cat' })[0]).toMatch(/classes must be a list of names/)
    expect(ok({ ...TASK, classes: ['a', ''] })[0]).toMatch(
      /each class name must be 1 to 16 characters/
    )
    expect(ok({ ...TASK, classes: ['a', 'A'] })[0]).toMatch(/class names must all be different/)
    expect(ok({ ...TASK, classes: ['a'] })[0]).toMatch(/needs 2 to 6 classes/)
    expect(ok({ ...TASK, classes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })[0]).toMatch(
      /needs 2 to 6 classes/
    )
    expect(ok({ ...TASK, classes: [] })).toEqual([])
    expect(ok({ ...TASK, classes: undefined })).toEqual([])
  })

  it('checks the numbers', () => {
    expect(ok({ ...TASK, minExamplesPerClass: 1 })[0]).toMatch(
      /minExamplesPerClass must be a whole number from 2 to 40/
    )
    expect(ok({ ...TASK, minExamplesPerClass: 2.5 })[0]).toMatch(/minExamplesPerClass must be/)
    expect(ok({ ...TASK, targetAccuracy: 0 })[0]).toMatch(
      /targetAccuracy must be a number above 0 and up to 1/
    )
    expect(ok({ ...TASK, targetAccuracy: 80 })[0]).toMatch(/targetAccuracy must be/)
    expect(ok({ ...TASK, liveTestSize: 2 })[0]).toMatch(
      /liveTestSize must be a whole number from 3 to 20/
    )
    expect(ok({ ...TASK, testSet: 'live', liveTestSize: 8 })).toEqual([])
  })

  it('needs enough drawings for a held-out test', () => {
    expect(ok({ ...TASK, minExamplesPerClass: 3 })[0]).toMatch(
      /held_out needs minExamplesPerClass of at least 4/
    )
    expect(ok({ ...TASK, minExamplesPerClass: undefined })).toEqual([])
    expect(ok({ ...TASK, testSet: 'live', minExamplesPerClass: 3 })).toEqual([])
  })

  describe('teacher test set', () => {
    const teacher = (items, extra = {}) => ({
      ...TASK,
      testSet: 'teacher',
      testItems: items,
      ...extra,
    })
    const stroke = [[0.1, 0.1, 0.9, 0.9]]
    const good = [
      { label: 'circle', strokes: stroke },
      { label: 'line', grid: Array(GRID).fill('#'.repeat(GRID)) },
    ]

    it('accepts strokes and grids', () => {
      expect(ok(teacher(good))).toEqual([])
    })

    it('needs classes and 2 to 24 test drawings', () => {
      expect(ok(teacher(good, { classes: [] }))[0]).toMatch(/testSet teacher needs classes/)
      expect(ok(teacher(undefined))[0]).toMatch(/needs testItems with 2 to 24 test drawings/)
      expect(ok(teacher([good[0]]))[0]).toMatch(/needs testItems with 2 to 24/)
    })

    it('checks each test drawing', () => {
      expect(ok(teacher([{ strokes: stroke }, good[1]]))[0]).toMatch(
        /Task 3 test drawing 1: needs a label/
      )
      expect(ok(teacher([{ label: 'dog', strokes: stroke }, good[1]]))[0]).toMatch(
        /test drawing 1: label "dog" is not one of the classes/
      )
      expect(ok(teacher([{ label: 'circle' }, good[1]]))[0]).toMatch(
        /needs either strokes or grid \(not both\)/
      )
      expect(ok(teacher([{ label: 'circle', strokes: stroke, grid: [] }, good[1]]))[0]).toMatch(
        /needs either strokes or grid/
      )
      expect(ok(teacher([{ label: 'circle', strokes: [[0.1, 0.1, 0.9]] }, good[1]]))[0]).toMatch(
        /strokes must be a list of strokes/
      )
      expect(ok(teacher([{ label: 'circle', strokes: [[0.1, 2]] }, good[1]]))[0]).toMatch(
        /strokes must be a list of strokes/
      )
      expect(ok(teacher([{ label: 'circle', grid: ['#'] }, good[1]]))[0]).toMatch(
        /grid must be 16 rows of 16 characters/
      )
    })

    it('warns about a class with no test drawing', () => {
      expect(validateClassifierWarnings(teacher([good[0], good[0]]), 3)).toEqual([
        'Task 3: no test drawing for class "line".',
      ])
      expect(validateClassifierWarnings(teacher(good), 3)).toEqual([])
      expect(validateClassifierWarnings(TASK, 3)).toEqual([])
    })
  })
})
