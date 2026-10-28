// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  gradeTask,
  hintFor,
  itemResultsOf,
  normalizeState,
  sharedState,
  targetOf,
  validateLearningTreeTask,
  validateLearningTreeWarnings,
} from '../learning_tree.js'
import definition from '../definition.js'

// Pure logic tests for the Learning Tree activity. The shared contract (default task
// validates, state round-trips) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.

const TASK = definition.defaultTask({ id: 1 })

// fur -> pet, otherwise wild: gets Hamster, Dog, Eagle and Shark right, Goldfish wrong (4 of 5).
const GOOD = {
  v: 1,
  tried: true,
  examples: [
    { n: 'cat', f: '100', l: 0 },
    { n: 'dog', f: '100', l: 0 },
    { n: 'owl', f: '010', l: 1 },
    { n: 'whale', f: '001', l: 1 },
  ],
}

describe('validateLearningTreeTask', () => {
  it('accepts the default task', () => {
    expect(validateLearningTreeTask(TASK, 1)).toEqual([])
    expect(validateLearningTreeWarnings(TASK, 1)).toEqual([])
  })
  it('checks features', () => {
    expect(validateLearningTreeTask({ ...TASK, features: [] }, 2)[0]).toBe(
      'Task 2: features must be 1 to 6 different names, each 1 to 24 characters.'
    )
    expect(validateLearningTreeTask({ ...TASK, features: ['a', 'a'] }, 2)[0]).toMatch(/features/)
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(validateLearningTreeTask({ ...TASK, features: seven }, 1)[0]).toMatch(/features/)
  })
  it('checks labels', () => {
    expect(validateLearningTreeTask({ ...TASK, labels: ['pet'] }, 1)[0]).toMatch(/labels must be 2/)
    expect(validateLearningTreeTask({ ...TASK, labels: ['pet', 'pet'] }, 1)[0]).toMatch(/labels/)
  })
  it('checks maxExamples, maxDepth and passAt', () => {
    expect(validateLearningTreeTask({ ...TASK, maxExamples: 2 }, 1)[0]).toMatch(/maxExamples/)
    expect(validateLearningTreeTask({ ...TASK, maxDepth: 9 }, 1)[0]).toMatch(/maxDepth/)
    expect(validateLearningTreeTask({ ...TASK, passAt: 0 }, 1)[0]).toMatch(/passAt/)
    expect(validateLearningTreeTask({ ...TASK, passAt: 6 }, 1)[0]).toMatch(/passAt/)
    expect(validateLearningTreeTask({ ...TASK, passAt: 3 }, 1)).toEqual([])
    expect(validateLearningTreeTask({ ...TASK, passAt: 0.6 }, 1)).toEqual([])
  })
  it('checks test items', () => {
    expect(validateLearningTreeTask({ ...TASK, testItems: [] }, 1)[0]).toBe(
      'Task 1: testItems needs 2 to 12 items.'
    )
    const bad = [
      { name: '', yes: ['has_fur'], label: 'pet' },
      { name: 'x', yes: ['has_fur'], label: 'nope' },
      { name: 'y', yes: ['wings'], label: 'pet' },
    ]
    expect(validateLearningTreeTask({ ...TASK, testItems: bad }, 1)).toEqual([
      'Task 1 item 1: name is required (1 to 16 characters).',
      "Task 1 item 2: label must be one of the task's labels.",
      "Task 1 item 3: yes must list only the task's features, each once.",
    ])
  })
  it('warns when an empty tree could pass', () => {
    const task = {
      ...TASK,
      testItems: TASK.testItems.map((item) => ({ ...item, label: 'pet' })),
    }
    expect(validateLearningTreeWarnings(task, 1)[0]).toMatch(/empty tree could pass/)
  })
})

describe('targetOf', () => {
  it('defaults to 80% rounded up (4 of 5), and takes a share or a count', () => {
    expect(targetOf({}, 5)).toBe(4)
    expect(targetOf({}, 3)).toBe(3)
    expect(targetOf({ passAt: 0.6 }, 5)).toBe(3)
    expect(targetOf({ passAt: 2 }, 5)).toBe(2)
    expect(targetOf({ passAt: 9 }, 5)).toBe(5)
  })
})

describe('normalizeState', () => {
  it('drops bad examples, caps the count and clears tried when empty', () => {
    expect(normalizeState(TASK, null)).toEqual({ v: 1, examples: [], tried: false })
    const messy = {
      tried: true,
      examples: [
        { n: 'ok', f: '101', l: 1 },
        { n: 'short', f: '10', l: 0 },
        { n: 'badlabel', f: '101', l: 7 },
        null,
      ],
    }
    expect(normalizeState(TASK, messy).examples).toEqual([{ n: 'ok', f: '101', l: 1 }])
    expect(normalizeState(TASK, { tried: true, examples: [] }).tried).toBe(false)
    const many = { examples: Array.from({ length: 50 }, () => ({ n: 'a', f: '000', l: 0 })) }
    expect(normalizeState({ ...TASK, maxExamples: 6 }, many).examples).toHaveLength(6)
  })
})

describe('gradeTask', () => {
  it('has an empty tree and no score before any examples', () => {
    const g = gradeTask(TASK, normalizeState(TASK, null))
    expect(g).toMatchObject({ count: 0, depth: 0, tried: false, correct: 0, passed: false })
    expect(g.total).toBe(5)
  })
  it('does not count the score until Try it is pressed', () => {
    const g = gradeTask(TASK, { ...GOOD, tried: false })
    expect(g.correct).toBe(0)
    expect(g.passed).toBe(false)
  })
  it('passes when the tree sorts 4 of 5', () => {
    const g = gradeTask(TASK, GOOD)
    expect(g.correct).toBe(4)
    expect(g.passed).toBe(true)
    expect(g.depth).toBe(1)
  })
  it('respects passAt', () => {
    expect(gradeTask({ ...TASK, passAt: 5 }, GOOD).passed).toBe(false)
    expect(gradeTask({ ...TASK, passAt: 0.6 }, GOOD).passed).toBe(true)
  })
  it('respects maxDepth', () => {
    const tricky = {
      v: 1,
      tried: true,
      examples: [
        { n: 'a', f: '100', l: 0 },
        { n: 'b', f: '110', l: 1 },
        { n: 'c', f: '000', l: 1 },
      ],
    }
    expect(gradeTask(TASK, tricky).depth).toBe(2)
    expect(gradeTask({ ...TASK, maxDepth: 1 }, tricky).depth).toBe(1)
  })
})

describe('hints, results and shared state', () => {
  it('guides each step', () => {
    expect(hintFor(TASK, normalizeState(TASK, null))).toMatch(/Add some examples/)
    expect(hintFor(TASK, { ...GOOD, tried: false })).toMatch(/Press Try it/)
    expect(hintFor(TASK, GOOD)).toBeNull()
    const weak = { v: 1, tried: true, examples: [{ n: 'x', f: '100', l: 1 }] }
    expect(hintFor(TASK, weak)).toMatch(/Your tree got 2 of 5/)
    expect(hintFor(TASK, weak)).toMatch(/wrong/)
  })
  it('reports per test item only after Try it', () => {
    expect(itemResultsOf(TASK, { ...GOOD, tried: false })).toEqual({})
    expect(itemResultsOf(TASK, GOOD)).toEqual({ t1: true, t2: true, t3: true, t4: true, t5: false })
  })
  it('shares examples, count, depth and score', () => {
    const shared = sharedState(TASK, GOOD)
    expect(shared).toMatchObject({ count: 4, depth: 1, score: { correct: 4, total: 5 } })
    expect(shared.examples).toHaveLength(4)
    expect(sharedState(TASK, null).score).toBeNull()
  })
})

describe('definition', () => {
  it('summarises for the tutor card', () => {
    expect(definition.summarize(TASK, definition.initialState(TASK)).text).toBe('No examples yet')
    expect(definition.summarize(TASK, { ...GOOD, tried: false }).text).toBe(
      '4 examples · depth 1 · not tried yet'
    )
    expect(definition.summarize(TASK, GOOD)).toEqual({
      text: '4 examples · depth 1 · test 4/5',
      tone: 'success',
    })
  })
  it('grades through the contract and treats every change as discrete', () => {
    expect(definition.grade(TASK, GOOD).passed).toBe(true)
    expect(definition.classifyChange(null, GOOD, TASK)).toBe('discrete')
  })
  it('summarises a class for the session report', () => {
    const attempt = (submission) => ({ distinctAttempts: [{ submission }] })
    const out = definition.report.summaryFields(TASK, [
      attempt(GOOD),
      attempt({ v: 1, tried: false, examples: [] }),
    ])
    expect(out.learningTreeResults).toEqual({
      triedCount: 1,
      passedCount: 1,
      avgExamples: 4,
      avgDepth: 1,
      avgScore: 0.8,
    })
  })
})

describe('solutionFor', () => {
  it('turns the test items into examples that pass the task', () => {
    const solution = definition.solutionState(TASK)
    expect(solution.examples).toHaveLength(5)
    expect(solution.tried).toBe(true)
    expect(definition.grade(TASK, solution).passed).toBe(true)
    expect(definition.grade(TASK, definition.initialState(TASK)).passed).toBe(false)
  })
})
