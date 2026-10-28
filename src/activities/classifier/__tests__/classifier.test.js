// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  GRID,
  K,
  MAX_STUDENT_CLASSES,
  addClass,
  addExample,
  canTest,
  classify,
  classifierBadgeResult,
  clearExamples,
  countsOf,
  NOT_THING,
  UNSURE,
  CUTOFF_FLOOR,
  answerFor,
  answerText,
  blockGrid,
  cutoffOf,
  gridSizeOf,
  notThingOf,
  runSelfTest,
  selftestOf,
  setGridSize,
  unsureOf,
  viewOf,
  decodeGrid,
  describeResult,
  encodeGrid,
  gradeTask,
  gridFromRows,
  guessOf,
  heldOutIndexes,
  initialClassifierState,
  isGridString,
  mixupsOf,
  nextTarget,
  normalizeClassifierState,
  packGrid,
  padOf,
  panelsOf,
  predictLive,
  rasterize,
  readyOf,
  recentMissesOf,
  recordLive,
  removeClass,
  removeExample,
  rightsOf,
  runTest,
  setClassName,
  setPad,
  sharedState,
  shortLabel,
  solutionFor,
  splitExamples,
  splitLabel,
  tally,
  taughtOf,
  teachMiss,
  withReadyAt,
  teacherTestItems,
  testSetOf,
  unpackGrid,
  validateClassifierTask,
  validateClassifierWarnings,
} from '../classifier.js'
import definition from '../definition.js'

// Pure logic tests for the Classifier activity. The shared contract (default task validates,
// state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

// The older kept-back test (a Test button on every 4th drawing).
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

// The default: the live round (no testSet). 3 drawings of each thing, 3 tries.
const LIVE = {
  id: 2,
  taskType: 'activity',
  activityType: 'classifier',
  mode: 'drawing',
  classes: ['circle', 'line'],
  minExamplesPerClass: 3,
  liveTestSize: 3,
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

// A ready live state with the given tries ([actual, predicted] pairs) already played.
function played(pairs, task = LIVE) {
  const state = withExamples(task, 3)
  const misses = pairs
    .filter(([actual, predicted]) => actual !== predicted)
    .map(([actual, predicted]) => ({ actual, predicted, grid: gridOf(circle()) }))
  return { ...state, live: pairs, misses, result: pairs.length ? tally(pairs) : null }
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

  it('looks at up to 7 near drawings', () => expect(K).toBe(7))

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

  it('weighs the near drawings together, not just the nearest', () => {
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

describe('things with emoji', () => {
  it('splits a leading emoji from the name', () => {
    expect(splitLabel('🐱 cat')).toEqual({ emoji: '🐱', name: 'cat' })
    expect(splitLabel('cat')).toEqual({ emoji: '', name: 'cat' })
    expect(splitLabel('👩‍🚀 astronaut').name).toBe('astronaut')
    expect(splitLabel('👩‍🚀 astronaut').emoji).toBe('👩‍🚀')
  })

  it('shows the emoji when there is one, else the name', () => {
    expect(shortLabel('🐱 cat')).toBe('🐱')
    expect(shortLabel('cat')).toBe('cat')
  })
})

function withExamplesList() {
  return splitExamples(LIVE, withExamples(LIVE, 3)).train
}

describe('guessing', () => {
  const examples = () => splitExamples(LIVE, withExamples(LIVE, 3)).train

  it('says what it thinks and how much of the vote each thing has', () => {
    const guess = guessOf(examples(), gridOf(circle(0.27)), ['circle', 'line'])
    expect(guess.label).toBe('circle')
    expect(guess.scores.circle).toBeGreaterThan(0.5)
    expect(guess.scores.circle + guess.scores.line).toBeCloseTo(1)
    expect(guessOf(examples(), gridOf(line(0.01)), ['circle', 'line']).label).toBe('line')
  })

  it('moves smoothly, not in thirds, and climbs as more drawings are taught', () => {
    const base = [
      { label: 'circle', grid: gridOf(circle(0.2)) },
      { label: 'line', grid: gridOf(line()) },
    ]
    const more = [...base, { label: 'circle', grid: gridOf(circle(0.28)) }]
    const before = guessOf(base, gridOf(circle(0.3)), ['circle', 'line']).scores.circle
    const after = guessOf(more, gridOf(circle(0.3)), ['circle', 'line']).scores.circle
    expect(after).toBeGreaterThan(before)
    // A drawing between the two things gets in-between shares, not 0 / 33 / 67 / 100%.
    const diagonal = gridOf([
      [
        [0.1, 0.1],
        [0.9, 0.9],
      ],
    ])
    const between = guessOf(withExamplesList(), diagonal, ['circle', 'line']).scores
    expect([0, 1 / 3, 2 / 3, 1].some((third) => Math.abs(between.circle - third) < 0.02)).toBe(
      false
    )
    expect(between.circle + between.line).toBeCloseTo(1)
  })

  it('has no guess without drawings', () => {
    expect(guessOf([], gridOf(circle()), ['circle'])).toEqual({
      label: null,
      scores: { circle: 0 },
    })
  })
})

describe('state changes', () => {
  it('adds, counts and removes drawings', () => {
    let state = withExamples(LIVE, 3)
    expect(countsOf(state)).toEqual({ circle: 3, line: 3 })
    state = removeExample(state, 'circle', 0)
    expect(countsOf(state).circle).toBe(2)
  })

  it('ignores a drawing for an unknown class or a bad grid', () => {
    const state = initialClassifierState(LIVE)
    expect(addExample(state, 'dog', gridOf(circle()))).toBe(state)
    expect(addExample(state, 'circle', 'abc')).toBe(state)
  })

  it('caps drawings per class', () => {
    let state = initialClassifierState(LIVE)
    for (let i = 0; i < 45; i += 1) state = addExample(state, 'circle', gridOf(circle()))
    expect(countsOf(state).circle).toBe(40)
  })

  it('clears every drawing and the round', () => {
    const cleared = clearExamples(played([['circle', 'line']]))
    expect(countsOf(cleared)).toEqual({ circle: 0, line: 0 })
    expect(cleared.live).toEqual([])
    expect(cleared.misses).toEqual([])
  })

  it('lets the student name things until they have drawings, and trims on the first drawing', () => {
    const task = { ...LIVE, classes: [] }
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

  it('does not add a drawing under a duplicate name', () => {
    const task = { ...LIVE, classes: [] }
    const state = setClassName(setClassName(initialClassifierState(task), 0, 'cat'), 1, 'cat')
    expect(addExample(state, 'cat', gridOf(circle()))).toBe(state)
  })

  it('caps the class rows (6 in general, 4 when the student names them)', () => {
    let state = initialClassifierState({ ...LIVE, classes: [] })
    for (let i = 0; i < 10; i += 1) state = addClass(state)
    expect(state.classes).toHaveLength(6)
    let four = initialClassifierState({ ...LIVE, classes: [] })
    for (let i = 0; i < 10; i += 1) four = addClass(four, MAX_STUDENT_CLASSES)
    expect(four.classes).toHaveLength(4)
  })
})

describe('ready (no Train step)', () => {
  it('is ready once every named thing has its drawings', () => {
    expect(readyOf(withExamples(LIVE, 2))).toBe(false)
    expect(readyOf(withExamples(LIVE, 3))).toBe(true)
  })

  it('needs at least two named things and ignores blank rows', () => {
    const task = { ...LIVE, classes: [] }
    let state = setClassName(initialClassifierState(task), 0, 'a')
    for (let i = 0; i < 3; i += 1) state = addExample(state, 'a', gridOf(circle(0.2 + i * 0.05)))
    expect(readyOf(state)).toBe(false)
    state = setClassName(state, 1, 'b')
    for (let i = 0; i < 3; i += 1) state = addExample(state, 'b', gridOf(line(i * 0.02)))
    expect(readyOf(state)).toBe(true)
    expect(readyOf(addClass(state))).toBe(true)
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
    expect(splitExamples(LIVE, withExamples(LIVE, 8)).held).toHaveLength(0)
  })
})

describe('test sets', () => {
  it('defaults to the live round', () => {
    expect(testSetOf(LIVE)).toBe('live')
    expect(testSetOf({ testSet: 'teacher' })).toBe('teacher')
    expect(testSetOf({ testSet: 'nonsense' })).toBe('live')
  })

  it('tests on the kept-back drawings and reports counts', () => {
    let state = withExamples(TASK, 8)
    expect(canTest(TASK, state)).toBe(true)
    state = runTest(TASK, state)
    expect(state.result.total).toBe(4)
    expect(state.result.right).toBe(4)
    expect(state.tests).toBe(1)
    expect(describeResult(state.result)).toBe('4 of 4 right, 100%')
  })

  it('cannot test until it is ready, or in the live round', () => {
    expect(canTest(TASK, withExamples(TASK, 3))).toBe(false)
    expect(canTest(LIVE, withExamples(LIVE, 3))).toBe(false)
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
    const state = runTest(task, withExamples(task, 4))
    expect(state.result.total).toBe(3)
    expect(state.result.confusion.circle.circle).toBe(1)
    expect(state.result.confusion.line.line).toBeGreaterThanOrEqual(1)
  })

  it('changing the drawings makes a kept-back test result stale', () => {
    const tested = runTest(TASK, withExamples(TASK, 8))
    expect(removeExample(tested, 'circle', 0).result).toBeNull()
  })
})

describe('the live round', () => {
  it('asks for each thing in turn', () => {
    const state = withExamples(LIVE, 3)
    expect(nextTarget(state)).toBe('circle')
    expect(nextTarget(played([['circle', 'circle']]))).toBe('line')
    expect(
      nextTarget(
        played([
          ['circle', 'circle'],
          ['line', 'line'],
        ])
      )
    ).toBe('circle')
  })

  it('records a right guess', () => {
    const done = recordLive(LIVE, withExamples(LIVE, 3), 'circle', gridOf(circle(0.27)))
    expect(done.predicted).toBe('circle')
    expect(done.state.live).toEqual([['circle', 'circle']])
    expect(done.state.misses).toEqual([])
    expect(done.state.result).toEqual({ right: 1, total: 1, confusion: { circle: { circle: 1 } } })
    expect(rightsOf(done.state)).toBe(1)
  })

  it('keeps a miss as a drawing to teach, on the device', () => {
    const start = recordLive(LIVE, withExamples(LIVE, 3), 'circle', gridOf(circle(0.27))).state
    const done = recordLive(LIVE, start, 'line', gridOf(circle(0.3)))
    expect(done.predicted).toBe('circle')
    expect(done.state.live).toEqual([
      ['circle', 'circle'],
      ['line', 'circle'],
    ])
    expect(done.state.misses).toHaveLength(1)
    expect(done.state.misses[0]).toMatchObject({ actual: 'line', predicted: 'circle' })
    expect(rightsOf(done.state)).toBe(1)
    expect(mixupsOf(done.state.result)).toEqual([{ actual: 'line', predicted: 'circle', count: 1 }])
  })

  it('refuses a try before it is ready, for an unknown thing or with a bad grid', () => {
    expect(recordLive(LIVE, withExamples(LIVE, 2), 'circle', gridOf(circle())).predicted).toBeNull()
    expect(recordLive(LIVE, withExamples(LIVE, 3), 'dog', gridOf(circle())).predicted).toBeNull()
    expect(recordLive(LIVE, withExamples(LIVE, 3), 'circle', 'abc').predicted).toBeNull()
  })

  it('grades what they said they drew: the pad is right when its guess matches, whatever it asked for', () => {
    // The pad may have asked for a line; they drew a circle and said so: the pad was right.
    const fool = recordLive(LIVE, withExamples(LIVE, 3), 'circle', gridOf(circle(0.3)))
    expect(fool.predicted).toBe('circle')
    expect(rightsOf(fool.state)).toBe(1)
    expect(fool.state.misses).toEqual([])
    expect(predictLive(LIVE, withExamples(LIVE, 3), gridOf(circle(0.3)))).toBe('circle')
    expect(predictLive(LIVE, withExamples(LIVE, 2), gridOf(circle(0.3)))).toBeNull()
  })

  it('clears the pad when a try is recorded', () => {
    const padded = setPad(withExamples(LIVE, 3), gridOf(circle()), 'circle')
    expect(padded.pad).toEqual({ grid: gridOf(circle()), target: 'circle' })
    expect(recordLive(LIVE, padded, 'circle', gridOf(circle())).state.pad).toBeNull()
  })

  it('teaches a miss: it becomes a drawing of what it really was, and the round is kept', () => {
    const miss = recordLive(LIVE, withExamples(LIVE, 3), 'line', gridOf(circle(0.3))).state
    const grid = miss.misses[0].grid
    const taught = teachMiss(miss, 'line', grid)
    expect(countsOf(taught).line).toBe(4)
    expect(taught.misses[0].fixed).toBe(true)
    expect(taught.live).toEqual(miss.live)
    expect(taught.result).toEqual(miss.result)
    expect(teachMiss(miss, 'dog', grid)).toBe(miss)
  })

  it('counts the misses taught, once each, and keeps the count through the shared form', () => {
    const miss = recordLive(LIVE, withExamples(LIVE, 3), 'line', gridOf(circle(0.3))).state
    const grid = miss.misses[0].grid
    expect(taughtOf(miss)).toBe(0)
    const taught = teachMiss(miss, 'line', grid)
    expect(taughtOf(taught)).toBe(1)
    expect(taught.taught).toBe(1)
    // Teaching the same miss again adds nothing.
    expect(taughtOf(teachMiss(taught, 'line', grid))).toBe(1)
    const shared = JSON.parse(definition.serializeShared(taught))
    expect(shared.taught).toBe(1)
    expect(normalizeClassifierState(LIVE, shared).taught).toBe(1)
    expect(taughtOf(clearExamples(taught))).toBe(0)
    // An old save with fixed misses and no counter still counts them.
    expect(taughtOf({ misses: [{ fixed: true }, { fixed: true }, {}] })).toBe(2)
  })

  it('stamps readyAt the first time the pad is ready, and keeps it', () => {
    expect(withReadyAt(withExamples(LIVE, 2), 500).readyAt).toBeUndefined()
    const ready = withReadyAt(withExamples(LIVE, 3), 500)
    expect(ready.readyAt).toBe(500)
    expect(withReadyAt(ready, 900)).toBe(ready)
    expect(withReadyAt(clearExamples(ready), 900).readyAt).toBe(500)
    const shared = JSON.parse(definition.serializeShared(ready))
    expect(shared.readyAt).toBe(500)
    expect(normalizeClassifierState(LIVE, shared).readyAt).toBe(500)
    expect(normalizeClassifierState(LIVE, JSON.parse(definition.serialize(ready))).readyAt).toBe(
      500
    )
    // Old saves have none.
    expect(normalizeClassifierState(LIVE, { v: 1, examples: {} }).readyAt).toBeUndefined()
  })

  it('summarises the passing submission for the badges', () => {
    const ready = withReadyAt(withExamples(LIVE, 3), 500)
    const state = {
      ...ready,
      live: [
        ['circle', 'circle'],
        ['line', 'line'],
        ['line', 'circle'],
      ],
      misses: [{ actual: 'line', predicted: 'circle', grid: gridOf(circle()), fixed: true }],
      taught: 1,
    }
    const shared = definition.deserialize(definition.buildSubmission(LIVE, state), LIVE)
    expect(definition.badgeResult(LIVE, shared)).toEqual({
      core: 3,
      tries: 3,
      right: 2,
      misses: 1,
      taught: 1,
      readyAt: 500,
    })
    // Not the live round: no core, so Perfect Round can't fire.
    expect(classifierBadgeResult({ ...LIVE, testSet: 'held_out' }, state).core).toBe(0)
    expect(classifierBadgeResult(LIVE, withExamples(LIVE, 3)).readyAt).toBeNull()
  })

  it('lists mix-ups, most common first', () => {
    const result = tally([
      ['cat', 'cat'],
      ['cat', 'fish'],
      ['fish', 'cat'],
      ['fish', 'cat'],
    ])
    expect(mixupsOf(result)).toEqual([
      { actual: 'fish', predicted: 'cat', count: 2 },
      { actual: 'cat', predicted: 'fish', count: 1 },
    ])
    expect(describeResult(result)).toBe('1 of 4 right, 25%')
  })
})

describe('grading and hints', () => {
  it('hints at the first thing missing, in order (live round)', () => {
    expect(gradeTask(LIVE, initialClassifierState(LIVE)).hint).toBe(
      'Draw more circle: you have 0 and need 3.'
    )
    expect(gradeTask(LIVE, withExamples(LIVE, 2)).hint).toBe(
      'Draw more circle: you have 2 and need 3.'
    )
    expect(gradeTask(LIVE, withExamples(LIVE, 3)).hint).toMatch(
      /press Done and tell it what you drew\. It needs 3 tries: you have 0 so far/
    )
    const free = { ...LIVE, classes: [] }
    expect(gradeTask(free, initialClassifierState(free)).hint).toMatch(/Name at least two things/)
  })

  it('passes the live round at liveTestSize tries, right or wrong; bonus tries change nothing', () => {
    const right = ['circle', 'circle']
    const wrong = ['line', 'circle']
    expect(gradeTask(LIVE, played([right, right])).passed).toBe(false)
    expect(gradeTask(LIVE, played([right, right, wrong])).passed).toBe(true)
    // A round where the pad got every one wrong is still a finished round.
    expect(gradeTask(LIVE, played([wrong, wrong, wrong])).passed).toBe(true)
    const bonus = gradeTask(LIVE, played([right, right, right, wrong, wrong]))
    expect(bonus.passed).toBe(true)
    expect(bonus.rights).toBe(3)
    expect(bonus.tries).toBe(5)
  })

  it('a live round with too few drawings in a thing does not pass', () => {
    const state = { ...withExamples(LIVE, 2), live: Array(3).fill(['circle', 'circle']) }
    expect(gradeTask(LIVE, state).passed).toBe(false)
  })

  it('kept-back test: hints, then passes at the target', () => {
    expect(gradeTask(TASK, withExamples(TASK, 3)).hint).toBe(
      'Draw more circle: you have 3 and need 4.'
    )
    expect(gradeTask(TASK, withExamples(TASK, 8)).hint).toMatch(/Press Test/)
    const tested = runTest(TASK, withExamples(TASK, 8))
    expect(gradeTask(TASK, tested).passed).toBe(true)
    const bad = {
      ...tested,
      result: tally([
        ['circle', 'line'],
        ['line', 'line'],
      ]),
    }
    expect(gradeTask(TASK, bad).hint).toMatch(/The model got 50% and needs 75%/)
  })

  it('needs at least two named things when the student names them', () => {
    const free = { ...LIVE, classes: [] }
    let state = setClassName(initialClassifierState(free), 0, 'a')
    for (let i = 0; i < 3; i += 1) state = addExample(state, 'a', gridOf(circle(0.2 + i * 0.05)))
    expect(gradeTask(free, state).passed).toBe(false)
  })

  it('reads counts and rights from the shared summary', () => {
    const shared = normalizeClassifierState(LIVE, sharedState(played([['circle', 'circle']])))
    expect(shared.shared).toBe(true)
    expect(countsOf(shared)).toEqual({ circle: 3, line: 3 })
    expect(rightsOf(shared)).toBe(1)
    expect(readyOf(shared)).toBe(true)
  })
})

describe('panels', () => {
  it('defaults to the fool-it panel only', () => {
    expect(panelsOf(LIVE)).toEqual(['fool'])
    expect(panelsOf({ panels: ['grid', 'sure'] })).toEqual(['grid', 'sure'])
    expect(panelsOf({ panels: [] })).toEqual([])
    expect(panelsOf({ panels: ['grid', 'bias'] })).toEqual(['grid'])
  })
})

describe('privacy: what is shared', () => {
  const miss = ['line', 'circle']
  const right = ['circle', 'circle']

  it('never contains a drawing', () => {
    const state = played([right, miss])
    const shared = definition.serializeShared(state)
    expect(shared).not.toMatch(/examples/)
    expect(shared).not.toMatch(/strokes/)
    expect(JSON.parse(shared)).toEqual({
      v: 1,
      shared: true,
      classes: ['circle', 'line'],
      counts: { circle: 3, line: 3 },
      trained: true,
      result: state.result,
      liveCount: 2,
      rights: 1,
      misses: 1,
      taught: 0,
      tests: 0,
      gridSize: 16,
      pad: null,
      target: null,
      recent: [{ g: packGrid(gridOf(circle())), s: 'circle', d: 'line' }],
    })
    // The device's own copy does keep them.
    expect(definition.serialize(state)).toMatch(/examples/)
    expect(definition.serialize(state)).toMatch(/misses/)
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
    const task = { ...LIVE, classes: names, minExamplesPerClass: 4 }
    const confusion = Object.fromEntries(
      names.map((a) => [a, Object.fromEntries(names.map((b) => [b, 99]))])
    )
    const state = {
      ...initialClassifierState(task),
      result: { right: 99, total: 3564, confusion },
    }
    expect(definition.serializeShared(state).length).toBeLessThan(2048)
  })

  it('the shared form reads back to the same counts and rights', () => {
    const back = definition.deserialize(definition.serializeShared(played([right, miss])), LIVE)
    expect(countsOf(back)).toEqual({ circle: 3, line: 3 })
    expect(rightsOf(back)).toBe(1)
    expect(readyOf(back)).toBe(true)
  })

  it('shares the pad now and the last 3 misses as grids, and the tutor reads them back', () => {
    const grids = [circle(0.3), line(), line(0.1), circle(0.2, 0.1)].map(gridOf)
    let state = withExamples(LIVE, 3)
    for (const [i, grid] of grids.entries()) {
      state = recordLive(LIVE, state, i % 2 ? 'circle' : 'line', grid).state
    }
    state = setPad(state, grids[1], 'line')
    const shared = JSON.parse(definition.serializeShared(state))
    expect(shared.recent.length).toBeLessThanOrEqual(3)
    expect(shared.pad).toBe(packGrid(grids[1]))
    expect(shared.target).toBe('line')
    const back = definition.deserialize(definition.serializeShared(state), LIVE)
    expect(padOf(back)).toEqual({ grid: grids[1], target: 'line' })
    expect(recentMissesOf(back)).toEqual(
      recentMissesOf(state).map(({ actual, predicted, grid }) => ({ actual, predicted, grid }))
    )
    expect(back.examples).toBeUndefined()
    // The device's own copy keeps the pad too.
    expect(padOf(definition.deserialize(definition.serialize(state), LIVE))).toEqual(padOf(state))
  })

  it('packs a grid for the wire and unpacks it again', () => {
    const grid = gridOf(circle())
    expect(unpackGrid(packGrid(grid))).toBe(grid)
    expect(packGrid(grid).length).toBeLessThan(grid.length)
    expect(unpackGrid('nope')).toBeNull()
    expect(unpackGrid(null)).toBeNull()
    expect(packGrid('short')).toBeNull()
  })

  it('stays under the budget even with the pad and 3 misses and the longest names', () => {
    const names = ['abcdefghijklmnop', 'bcdefghijklmnopq', 'cdefghijklmnopqr', 'defghijklmnopqrs']
    const task = { ...LIVE, classes: names, minExamplesPerClass: 4 }
    const noisy = Array.from({ length: 256 }, (_, i) => String((i * 7) % 10)).join('')
    const state = {
      ...initialClassifierState(task),
      pad: { grid: noisy, target: names[0] },
      misses: [0, 1, 2].map(() => ({ actual: names[0], predicted: names[1], grid: noisy })),
    }
    expect(definition.serializeShared(state).length).toBeLessThanOrEqual(1800)
  })

  it('a shared state turned back into work starts clean', () => {
    const shared = definition.deserialize(definition.serializeShared(withExamples(LIVE, 3)), LIVE)
    const next = addExample(shared, 'circle', gridOf(circle()))
    expect(next.shared).toBeUndefined()
    expect(next.counts).toBeUndefined()
    expect(countsOf(next)).toEqual({ circle: 1, line: 0 })
  })

  it('keeps the drawings and misses in the device copy when it is loaded again', () => {
    const state = played([right, miss])
    const back = definition.deserialize(definition.serialize(state), LIVE)
    expect(countsOf(back)).toEqual({ circle: 3, line: 3 })
    expect(back.misses).toHaveLength(1)
    expect(back.live).toEqual([right, miss])
  })
})

describe('definition', () => {
  const right = ['circle', 'circle']
  const wrong = ['line', 'circle']

  it('classifies a name typed as continuous and everything else as discrete', () => {
    const task = { ...LIVE, classes: [] }
    const named = setClassName(initialClassifierState(task), 0, 'c')
    expect(definition.classifyChange(initialClassifierState(task), named, task)).toBe('continuous')
    expect(
      definition.classifyChange(
        initialClassifierState(LIVE),
        addExample(initialClassifierState(LIVE), 'circle', gridOf(circle())),
        LIVE
      )
    ).toBe('discrete')
    expect(definition.classifyChange(withExamples(LIVE, 3), played([right]), LIVE)).toBe('discrete')
    // The pad's grid at each stroke end is the frequent change.
    const ready = withExamples(LIVE, 3)
    expect(definition.classifyChange(ready, setPad(ready, gridOf(circle()), 'circle'), LIVE)).toBe(
      'continuous'
    )
  })

  it('summarises for the teacher card: where the student is', () => {
    const text = (task, state) => definition.summarize(task, state).text
    expect(text(LIVE, initialClassifierState(LIVE))).toBe('No drawings yet')
    expect(text(LIVE, withExamples(LIVE, 2))).toBe('Teaching: circle 2/3 · line 2/3')
    expect(text(LIVE, withExamples(LIVE, 3))).toBe('Ready: 0/3 tried')
    expect(text(LIVE, played([right, wrong]))).toBe('2/3 tried · 1 right')
    expect(definition.summarize(LIVE, played([right, wrong, ['line', 'line']]))).toEqual({
      text: '3/3 tried · 2 right',
      tone: 'success',
    })
    const bonus = definition.summarize(LIVE, played([right, right, right, right, wrong]))
    expect(bonus).toEqual({ text: '3/3 tried · +2 bonus · 4 right', tone: 'success' })
    expect(text(TASK, withExamples(TASK, 3))).toBe('Teaching: circle 3/4 · line 3/4')
    expect(text(TASK, withExamples(TASK, 8))).toBe('16 drawings, ready')
    expect(definition.summarize(TASK, runTest(TASK, withExamples(TASK, 8)))).toEqual({
      text: '100% on test',
      tone: 'success',
    })
  })

  it('reports progress: things taught, then tries', () => {
    const progress = (task, state) => definition.getProgress(task, state)
    expect(progress(LIVE, withExamples(LIVE, 2))).toEqual({
      kind: 'items',
      filled: 0,
      total: 5,
      correct: 0,
    })
    expect(progress(LIVE, withExamples(LIVE, 3))).toMatchObject({ filled: 2, total: 5 })
    expect(progress(LIVE, played([right, wrong]))).toMatchObject({ filled: 4, total: 5 })
    expect(progress(LIVE, played([right, wrong, wrong]))).toMatchObject({ filled: 5, total: 5 })
    expect(progress(TASK, withExamples(TASK, 4))).toEqual({
      kind: 'items',
      filled: 2,
      total: 2,
      correct: 2,
    })
    const grade = definition.grade(LIVE, withExamples(LIVE, 2))
    expect(grade.passed).toBe(false)
    expect(grade.itemResults).toEqual({ circle: false, line: false })
  })

  it('logs the shared form as the submission', () => {
    const sub = definition.buildSubmission(LIVE, played([right, wrong]))
    expect(sub.shared).toBe(true)
    expect(sub).toMatchObject({ rights: 1, misses: 1 })
    expect(JSON.stringify(sub)).not.toMatch(/examples/)
  })

  it('adds up accuracy and confusion across students for the report', () => {
    const tested = runTest(TASK, withExamples(TASK, 8))
    const bad = {
      ...tested,
      result: tally([
        ['circle', 'line'],
        ['line', 'line'],
      ]),
    }
    const sub = (state) => ({ distinctAttempts: [{ submission: sharedState(state) }] })
    const fields = definition.report.summaryFields(TASK, [
      sub(tested),
      sub(bad),
      { distinctAttempts: [] },
    ])
    expect(fields.classifierResults).toMatchObject({
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

  it('counts a live round that reached its tries as at target', () => {
    const sub = (state) => ({ distinctAttempts: [{ submission: sharedState(state) }] })
    const fields = definition.report.summaryFields(LIVE, [
      sub(played([right, wrong, wrong])),
      sub(played([right, wrong])),
    ])
    expect(fields.classifierResults.testedCount).toBe(2)
    expect(fields.classifierResults.atTargetCount).toBe(1)
  })

  it('seals the test drawings', () => {
    expect(definition.sealedFields).toContain('testItems')
  })

  it('has a solution that passes and an initial state that does not', () => {
    for (const task of [LIVE, TASK]) {
      expect(definition.grade(task, definition.solutionState(task)).passed).toBe(true)
      expect(definition.grade(task, definition.initialState(task)).passed).toBe(false)
    }
    const free = { ...LIVE, classes: [] }
    expect(solutionFor(free).classes).toHaveLength(2)
  })

  it('prints the setup', () => {
    const live = definition.printHtml(LIVE, { esc: (v) => String(v) })
    expect(live).toContain('circle, line')
    expect(live).toContain('3 tries')
    expect(definition.printHtml(TASK, { esc: (v) => String(v) })).toContain('75%')
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
    // testSet is optional: missing means the live round.
    expect(ok({ ...TASK, testSet: undefined })).toEqual([])
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
    // The default is 3, which is too few to keep one back.
    expect(ok({ ...TASK, minExamplesPerClass: undefined })[0]).toMatch(/held_out needs/)
    expect(ok({ ...TASK, testSet: 'live', minExamplesPerClass: 3 })).toEqual([])
    expect(ok({ ...TASK, testSet: undefined, minExamplesPerClass: 3 })).toEqual([])
  })

  it('checks the panels', () => {
    expect(ok({ ...LIVE, panels: ['grid', 'sure', 'fool'] })).toEqual([])
    expect(ok({ ...LIVE, panels: [] })).toEqual([])
    expect(ok({ ...LIVE, panels: undefined })).toEqual([])
    expect(ok({ ...LIVE, panels: ['grid', 'bias'] })).toEqual([
      'Task 3: classifier panels has an unknown value "bias". Use grid, sure, fool, gridsize, close, unsure, selftest.',
    ])
    expect(ok({ ...LIVE, panels: 'grid' })[0]).toMatch(/panels must be a list/)
  })

  it('accepts emoji in the class names', () => {
    expect(ok({ ...LIVE, classes: ['🐱 cat', '🐟 fish', '🚀 rocket'] })).toEqual([])
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

// ── AI Level 1 additions: grid size, self-test, one thing, not sure ─────────

function liveTriesOf(state) {
  return state.live.length
}

describe('grid size (gridsize panel)', () => {
  const SIZED = { ...LIVE, panels: ['gridsize'], gridSize: 8 }

  it('averages 16 -> 8 -> 4 by blocks and keeps 256 numbers', () => {
    const grid = gridOf(circle())
    expect(viewOf(grid, 16)).toEqual(decodeGrid(grid))
    for (const size of [8, 4]) {
      const view = viewOf(grid, size)
      expect(view).toHaveLength(GRID * GRID)
      const block = GRID / size
      // Every cell in a block holds the same number: the block's average.
      const first = view[0]
      for (let y = 0; y < block; y += 1) {
        for (let x = 0; x < block; x += 1) expect(view[y * GRID + x]).toBe(first)
      }
    }
    const flat = encodeGrid(new Array(256).fill(1))
    expect(viewOf(flat, 4).every((v) => v === 1)).toBe(true)
    expect(blockGrid(flat, 4)).toBe(flat)
  })

  it('starts at the lesson size and lets the student change it only with the panel', () => {
    expect(initialClassifierState(SIZED).gridSize).toBe(8)
    expect(initialClassifierState(LIVE).gridSize).toBe(16)
    let state = initialClassifierState(SIZED)
    state = setGridSize(state, 4)
    expect(gridSizeOf(SIZED, state)).toBe(4)
    expect(gridSizeOf({ ...LIVE, gridSize: 8 }, state)).toBe(8)
    expect(setGridSize(state, 5)).toBe(state)
    expect(setGridSize(state, 4)).toBe(state)
  })

  it('re-reads the same drawings at the new size, with no redrawing', () => {
    const state = withExamples(SIZED, 3)
    const small = setGridSize(state, 4)
    expect(countsOf(small)).toEqual(countsOf(state))
    expect(small.examples).toEqual(state.examples)
    const grid = gridOf(circle(0.25))
    expect(predictLive(SIZED, small, grid)).toBe('circle')
    expect(predictLive(SIZED, setGridSize(state, 16), grid)).toBe('circle')
    const train = splitExamples(SIZED, small).train
    expect(guessOf(train, grid, ['circle', 'line'], 7, 4).label).toBe('circle')
  })

  it('shares and restores the size', () => {
    const state = setGridSize(withExamples(SIZED, 3), 4)
    const shared = JSON.parse(definition.serializeShared(state))
    expect(shared.gridSize).toBe(4)
    expect(normalizeClassifierState(SIZED, shared).gridSize).toBe(4)
    expect(normalizeClassifierState(SIZED, JSON.parse(definition.serialize(state))).gridSize).toBe(
      4
    )
  })

  it('validates gridSize', () => {
    expect(validateClassifierTask({ ...LIVE, gridSize: 8 }, 3)).toEqual([])
    expect(validateClassifierTask({ ...LIVE, gridSize: 5 }, 3)).toEqual([
      'Task 3: gridSize must be 4, 8 or 16.',
    ])
  })
})

describe('Test on what it learned (selftest panel)', () => {
  const SELF = { ...LIVE, panels: ['fool', 'selftest'] }

  it('scores every training drawing and is cleared when the drawings change', () => {
    const state = runSelfTest(SELF, withExamples(SELF, 3))
    expect(selftestOf(state)).toEqual({ right: 6, total: 6 })
    expect(selftestOf(addExample(state, 'circle', gridOf(circle(0.4))))).toBeNull()
    expect(selftestOf(setGridSize(state, 4))).toBeNull()
  })

  it('does nothing until the model is ready', () => {
    const state = initialClassifierState(SELF)
    expect(runSelfTest(SELF, state)).toBe(state)
  })

  it('does not count towards passing or the round score', () => {
    const base = played([['circle', 'circle']], SELF)
    const tested = runSelfTest(SELF, base)
    expect(rightsOf(tested)).toBe(1)
    expect(gradeTask(SELF, tested).passed).toBe(gradeTask(SELF, base).passed)
    expect(tested.live).toEqual(base.live)
  })

  it('is shared with the tutor next to the round score', () => {
    const state = runSelfTest(SELF, played([['circle', 'circle']], SELF))
    const shared = JSON.parse(definition.serializeShared(state))
    expect(shared.selftest).toEqual({ right: 6, total: 6 })
    expect(shared.rights).toBe(1)
    expect(selftestOf(normalizeClassifierState(SELF, shared))).toEqual({ right: 6, total: 6 })
    expect(definition.summarize(SELF, state).text).toMatch(/own test 6\/6/)
  })
})

describe('the cut-off', () => {
  const g = (r, dx = 0) => gridOf(circle(r, dx))

  it('is the floor for none or one drawing', () => {
    expect(cutoffOf([])).toBe(CUTOFF_FLOOR)
    expect(cutoffOf([g(0.3)])).toBe(CUTOFF_FLOOR)
  })

  it('is 1.5 x the median nearest-neighbour distance, never below the floor', () => {
    const spread = [g(0.15), g(0.3), g(0.45), g(0.6)]
    const views = spread.map((x) => viewOf(x))
    const dist = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0))
    const nn = views.map((a, i) =>
      Math.min(...views.filter((_, j) => j !== i).map((b) => dist(a, b)))
    )
    nn.sort((a, b) => a - b)
    const median = (nn[1] + nn[2]) / 2
    expect(cutoffOf(spread)).toBeCloseTo(Math.max(CUTOFF_FLOOR, median * 1.5), 6)
    // A tight cluster still gets the floor.
    expect(cutoffOf([g(0.3), g(0.3), g(0.3)])).toBe(CUTOFF_FLOOR)
  })

  it('grows when more varied drawings are added', () => {
    const tight = cutoffOf([g(0.3), g(0.31), g(0.32)])
    // Drawings are scaled to fit before comparing, so 'varied' means different shapes.
    const wide = cutoffOf([g(0.3), gridOf(line(0)), gridOf(line(0.3)), gridOf(line(-0.3))])
    expect(wide).toBeGreaterThan(tight)
  })
})

describe('only one thing (a single class)', () => {
  const ONE = {
    id: 5,
    taskType: 'activity',
    activityType: 'classifier',
    mode: 'drawing',
    classes: ['⬜ square'],
    minExamplesPerClass: 3,
    liveTestSize: 3,
    panels: ['close'],
  }
  const square = (wobble = 0) => [
    [
      [0.2, 0.2],
      [0.8 + wobble, 0.2],
      [0.8, 0.8 + wobble],
      [0.2, 0.8],
      [0.2, 0.2],
    ],
  ]
  const oneState = () => {
    let state = initialClassifierState(ONE)
    for (let i = 0; i < 3; i += 1) state = addExample(state, '⬜ square', gridOf(square(i * 0.02)))
    return state
  }

  it('is valid with one class in the live round only', () => {
    expect(validateClassifierTask(ONE, 3)).toEqual([])
    const held = { ...ONE, testSet: 'held_out', minExamplesPerClass: 4 }
    expect(validateClassifierTask(held, 3)[0]).toMatch(/needs 2 to 6 classes/)
  })

  it('is ready with one thing and its drawings', () => {
    expect(readyOf(initialClassifierState(ONE))).toBe(false)
    expect(readyOf(oneState())).toBe(true)
    expect(gradeTask(ONE, oneState()).ready).toBe(true)
  })

  it('says the thing for a square and "not a square" for a circle', () => {
    const state = oneState()
    expect(predictLive(ONE, state, gridOf(square(0.01)))).toBe('⬜ square')
    expect(predictLive(ONE, state, gridOf(circle(0.3)))).toBe(NOT_THING)
    expect(answerText(NOT_THING, state.classes)).toBe('not a square')
  })

  it('records tries as the thing or not-the-thing, and counts the not-a answers', () => {
    const state = oneState()
    const square1 = gridOf(square(0.01))
    const circle1 = gridOf(circle(0.3))
    let r = recordLive(ONE, state, '⬜ square', square1)
    expect(r.state.live).toEqual([['⬜ square', '⬜ square']])
    r = recordLive(ONE, r.state, NOT_THING, circle1)
    expect(r.predicted).toBe(NOT_THING)
    expect(rightsOf(r.state)).toBe(2)
    r = recordLive(ONE, r.state, '⬜ square', circle1)
    expect(r.state.misses).toHaveLength(1)
    expect(notThingOf(r.state)).toBe(2)
    expect(sharedState(r.state).notThing).toBe(2)
    expect(sharedState(r.state).liveCount).toBe(3)
    expect(gradeTask(ONE, r.state).passed).toBe(true)
    expect(notThingOf(normalizeClassifierState(ONE, sharedState(r.state)))).toBe(2)
    // "not a" is only an answer in a one-thing lesson.
    const two = withExamples(LIVE, 3)
    expect(recordLive(LIVE, two, NOT_THING, square1).predicted).toBeNull()
  })

  it('widens with more varied drawings', () => {
    let state = oneState()
    const odd = gridOf(square(0.25))
    for (const w of [0.1, 0.2, 0.3]) state = addExample(state, '⬜ square', gridOf(square(w)))
    expect(predictLive(ONE, state, odd)).toBe('⬜ square')
  })
})

describe('not sure (unsure panel)', () => {
  const SURE = { ...LIVE, panels: ['fool', 'unsure'] }
  const far = gridOf([
    [
      [0.1, 0.1],
      [0.1, 0.9],
      [0.5, 0.2],
      [0.9, 0.9],
    ],
  ])

  it('is off by default: it always picks a thing it knows', () => {
    const state = withExamples(LIVE, 3)
    expect(['circle', 'line']).toContain(predictLive(LIVE, state, far))
  })

  it('answers not sure when nothing taught is close enough, and still knows what it was taught', () => {
    const state = withExamples(SURE, 3)
    expect(predictLive(SURE, state, gridOf(circle(0.25)))).toBe('circle')
    const answer = answerFor(splitExamples(SURE, state).train, far, state.classes, {
      cutoff: true,
    })
    expect(answer.ratio).toBeGreaterThan(1)
    expect(answer.label).toBe(UNSURE)
    expect(answerText(UNSURE, state.classes)).toBe('not sure')
  })

  it('counts a not-sure try as a try and as a miss, and shares the count', () => {
    const state = withExamples(SURE, 3)
    const r = recordLive(SURE, state, 'circle', far)
    expect(r.predicted).toBe(UNSURE)
    expect(liveTriesOf(r.state)).toBe(1)
    expect(rightsOf(r.state)).toBe(0)
    expect(unsureOf(r.state)).toBe(1)
    expect(sharedState(r.state).unsure).toBe(1)
    expect(unsureOf(normalizeClassifierState(SURE, sharedState(r.state)))).toBe(1)
    expect(definition.summarize(SURE, r.state).text).toMatch(/1 not sure/)
  })
})
