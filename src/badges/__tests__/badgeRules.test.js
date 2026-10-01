import { describe, expect, it } from 'vitest'
import { evaluateBadgeRules } from '../evaluate.js'
import { EXAMPLE_LESSON } from '../exampleLesson.js'
import { getPassGuard, isRealPass, computeFirstInClass } from '../rules.js'
import {
  attemptEvent as attempt,
  completeShownEvent,
  earlyJoinEvent,
  filterTimelinesToRoster,
  firstEditEvent,
  overrideEvent,
  pasteEvent,
  revealEvent,
  sandboxRunEvent as run,
} from '../timeline.js'

const evaluate = (badgeId, timelines, { lesson = EXAMPLE_LESSON, decisions, options } = {}) =>
  evaluateBadgeRules({
    timelines,
    lesson,
    decisions,
    options: { ...options, badgeIds: [badgeId] },
  })
const pairs = (suggestions) => suggestions.map((s) => [s.studentId, s.taskId])
const pass = (taskId, at, extra = {}) => attempt({ taskId, passed: true, at, ...extra })

// A lesson with three Debug Code Tasks, for first-in-class ordering.
const DEBUG_LESSON = {
  id: 'debug',
  type: 'python',
  title: 'Debug',
  tasks: ['d1', 'd2', 'd3'].map((id) => ({
    id,
    title: id.toUpperCase(),
    taskActivity: 'Code Task, Debug Code Task',
  })),
}

describe('real pass guards', () => {
  it('accepts a clean pass', () => {
    const timeline = [pass('t4', 100)]
    expect(isRealPass(timeline[0], timeline)).toBe(true)
  })

  it.each([
    ['assisted', [pass('t4', 100, { assisted: true })]],
    ['override', [overrideEvent({ taskId: 't4', at: 500 }), pass('t4', 100)]],
    ['complete_shown', [completeShownEvent({ taskId: 't4', at: 50 }), pass('t4', 100)]],
    ['complete_revealed', [revealEvent({ taskId: 't4', complete: true, at: 50 }), pass('t4', 100)]],
    ['paste', [pasteEvent({ taskId: 't4', firstAt: 99 }), pass('t4', 100)]],
  ])('rejects a pass guarded by %s', (guard, timeline) => {
    const passing = timeline.find((event) => event.type === 'attempt')
    expect(getPassGuard(passing, timeline)).toBe(guard)
  })

  it('ignores guards after the pass, or on another task', () => {
    const timeline = [
      pass('t4', 100),
      completeShownEvent({ taskId: 't4', at: 150 }),
      revealEvent({ taskId: 't4', complete: true, at: 150 }),
      pasteEvent({ taskId: 't4', firstAt: 200 }),
      pasteEvent({ taskId: 't2', firstAt: 10 }),
    ]
    expect(isRealPass(timeline[0], timeline)).toBe(true)
  })

  it('treats a guard with no time as before the pass', () => {
    const timeline = [pasteEvent({ taskId: 't4' }), pass('t4', 100)]
    expect(getPassGuard(timeline[1], timeline)).toBe('paste')
  })

  it('a non-complete support reveal is not a central guard', () => {
    const timeline = [revealEvent({ taskId: 't4', complete: false, at: 50 }), pass('t4', 100)]
    expect(isRealPass(timeline[1], timeline)).toBe(true)
  })
})

describe('first in class', () => {
  const timelines = {
    alex: [pass('d1', 100), pass('d2', 300)],
    sam: [pass('d1', 150), pass('d2', 200)],
    kit: [pass('d2', 400), pass('d3', 500)],
  }

  it('picks each task’s earliest student, one task per student', () => {
    // d1 → alex (100); d2's earliest is sam (200); d3 → kit.
    expect(pairs(evaluate('bug_hunter', timelines, { lesson: DEBUG_LESSON }))).toEqual([
      ['alex', 'd1'],
      ['sam', 'd2'],
      ['kit', 'd3'],
    ])
  })

  it('skips a student already picked for an earlier task', () => {
    const t = { alex: [pass('d1', 100), pass('d2', 110)], sam: [pass('d2', 200)] }
    expect(pairs(evaluate('bug_hunter', t, { lesson: DEBUG_LESSON }))).toEqual([
      ['alex', 'd1'],
      ['sam', 'd2'],
    ])
  })

  it('is stable after an award, and after a teacher reload', () => {
    const decisions = { alex: { bug_hunter: { status: 'awarded', decidedAt: 1000 } } }
    const first = evaluate('bug_hunter', timelines, { lesson: DEBUG_LESSON, decisions })
    const again = evaluate('bug_hunter', structuredClone(timelines), {
      lesson: structuredClone(DEBUG_LESSON),
      decisions: structuredClone(decisions),
    })
    expect(pairs(first)).toEqual([
      ['sam', 'd2'],
      ['kit', 'd3'],
    ])
    expect(again).toEqual(first)
  })

  it('a dismissal uses up the task', () => {
    const decisions = { alex: { bug_hunter: { status: 'dismissed', decidedAt: 1000 } } }
    // d1 is not handed to sam; d2 and d3 are unaffected.
    expect(pairs(evaluate('bug_hunter', timelines, { lesson: DEBUG_LESSON, decisions }))).toEqual([
      ['sam', 'd2'],
      ['kit', 'd3'],
    ])
  })

  it('skips a student decided before the task’s earliest pass', () => {
    // A manual award at 50 happened before d1's first pass: alex can't hold d1.
    const decisions = {
      alex: { bug_hunter: { status: 'awarded', source: 'manual', decidedAt: 50 } },
    }
    expect(pairs(evaluate('bug_hunter', timelines, { lesson: DEBUG_LESSON, decisions }))).toEqual([
      ['sam', 'd1'],
      ['kit', 'd2'],
    ])
  })

  it('removed students are excluded by roster filtering', () => {
    const roster = { sam: {}, kit: {} }
    const filtered = filterTimelinesToRoster(timelines, roster)
    expect(Object.keys(filtered)).toEqual(['sam', 'kit'])
    expect(pairs(evaluate('bug_hunter', filtered, { lesson: DEBUG_LESSON }))).toEqual([
      ['sam', 'd1'],
      ['kit', 'd2'],
    ])
    expect(Object.keys(filterTimelinesToRoster(timelines, ['alex']))).toEqual(['alex'])
  })

  it('ignores tasks no longer in the lesson', () => {
    const edited = { ...DEBUG_LESSON, tasks: DEBUG_LESSON.tasks.slice(1) }
    expect(pairs(evaluate('bug_hunter', timelines, { lesson: edited }))).toEqual([
      ['sam', 'd2'],
      ['kit', 'd3'],
    ])
  })

  it('computeFirstInClass orders tasks by earliest pass, then lesson order', () => {
    const tasks = [
      { info: { id: 'a', order: 0 }, passes: [{ studentId: 'x', at: 20 }] },
      { info: { id: 'b', order: 1 }, passes: [{ studentId: 'y', at: 10 }] },
      { info: { id: 'c', order: 2 }, passes: [] },
    ]
    expect(computeFirstInClass({ tasks, badgeId: 'b1', decisions: {} })).toEqual([
      { studentId: 'y', info: tasks[1].info, at: 10 },
      { studentId: 'x', info: tasks[0].info, at: 20 },
    ])
  })

  it('writes the reason from the task title', () => {
    const [suggestion] = evaluate('bug_hunter', { alex: [pass('t3', 1)] })
    expect(suggestion).toMatchObject({
      badgeId: 'bug_hunter',
      studentId: 'alex',
      taskId: 't3',
      context: 'task',
      reason: 'First to fix the bug in “Fix the loop”',
    })
  })
})

describe('badgeHints', () => {
  const lesson = {
    ...EXAMPLE_LESSON,
    tasks: [
      { id: 'a', title: 'A', taskActivity: 'Code Task', badgeHints: { suggest: ['bug_hunter'] } },
      {
        id: 'b',
        title: 'B',
        taskActivity: 'Code Task, Debug Code Task',
        badgeHints: { suppress: ['bug_hunter'] },
      },
    ],
  }

  it('suggest adds a trigger task and suppress removes one', () => {
    const t = { alex: [pass('a', 10)], sam: [pass('b', 5)] }
    expect(pairs(evaluate('bug_hunter', t, { lesson }))).toEqual([['alex', 'a']])
  })

  it('suppress stops a signal badge on that task', () => {
    const suppressed = {
      ...EXAMPLE_LESSON,
      tasks: [{ id: 'a', title: 'A', badgeHints: { suppress: ['ready_to_code'] } }],
    }
    const t = { alex: [firstEditEvent({ taskId: 'a', elapsedMs: 100 })] }
    expect(evaluate('ready_to_code', t, { lesson: suppressed })).toEqual([])
  })
})

describe('formats (🧩 Code Arranger)', () => {
  const lesson = {
    ...EXAMPLE_LESSON,
    tasks: [
      { id: 'a1', title: 'Arrange', taskType: 'code_arrange' },
      {
        id: 'a2',
        title: 'Quiet',
        taskType: 'code_arrange',
        badgeHints: { suppress: ['code_arranger'] },
      },
      {
        id: 'c1',
        title: 'Code',
        taskActivity: 'Code Task',
        badgeHints: { suggest: ['code_arranger'] },
      },
    ],
  }

  it('triggers on the format, honours suppress, and suggest adds a code task', () => {
    const t = { alex: [pass('a1', 10)], sam: [pass('a2', 5)], kim: [pass('c1', 20)] }
    expect(pairs(evaluate('code_arranger', t, { lesson }))).toEqual([
      ['alex', 'a1'],
      ['kim', 'c1'],
    ])
  })
})

describe('Early Bird (joinedEarly)', () => {
  const MINUTE = 60 * 1000
  it('needs the lead in minutes and reports whole minutes, with no task', () => {
    const t = {
      alex: [earlyJoinEvent({ leadMs: 7.9 * MINUTE, at: 1 })],
      sam: [earlyJoinEvent({ leadMs: 4 * MINUTE, at: 2 })],
      kim: [earlyJoinEvent({ leadMs: Number.NaN, at: 3 })],
    }
    const found = evaluate('early_bird', t)
    expect(pairs(found)).toEqual([['alex', null]])
    expect(found[0].reason).toBe('Joined 7 min before the lesson started')
    expect(
      pairs(evaluate('early_bird', t, { options: { badgeOptions: { earlyBirdMinutes: 3 } } }))
    ).toEqual([
      ['alex', null],
      ['sam', null],
    ])
  })
})

describe('Persistence', () => {
  const fail = (hash, at) => attempt({ taskId: 't4', submissionHash: hash, at })

  it('counts unique failed hashes: A → B → A is 2', () => {
    const [s] = evaluate('persistence', {
      alex: [fail('A', 1), fail('B', 2), fail('A', 3), pass('t4', 4, { submissionHash: 'C' })],
    })
    expect(s).toMatchObject({ taskId: 't4', reason: '2 different tries, then passed “Count up”' })
  })

  it('a reload re-run of the same code adds nothing', () => {
    // After a reload the attempt cache is empty, so the same code can be logged twice.
    const t = {
      alex: [fail('A', 1), fail('A', 2), fail('A', 3), pass('t4', 4, { submissionHash: 'C' })],
    }
    expect(evaluate('persistence', t)).toEqual([])
  })

  it('respects persistenceMinFails and ignores fails after the pass', () => {
    const t = {
      alex: [fail('A', 1), fail('B', 2), pass('t4', 3, { submissionHash: 'C' }), fail('D', 4)],
    }
    const lesson = { ...EXAMPLE_LESSON, badgeOptions: { persistenceMinFails: 3 } }
    expect(evaluate('persistence', t, { lesson })).toEqual([])
    expect(pairs(evaluate('persistence', t))).toEqual([['alex', 't4']])
  })

  it('never fires on quizzes', () => {
    const t = {
      alex: [
        attempt({ taskId: 'q1', submissionHash: 'A', at: 1 }),
        attempt({ taskId: 'q1', submissionHash: 'B', at: 2 }),
        pass('q1', 3, { submissionHash: 'C' }),
      ],
    }
    expect(evaluate('persistence', t)).toEqual([])
  })
})

describe('Quiz Master', () => {
  const right = (taskId, at) => attempt({ taskId, passed: true, firstTry: true, at })
  const wrong = (taskId, at) => attempt({ taskId, passed: false, firstTry: true, at })
  const quiz = (id, quizType = 'multiple_choice', extra = {}) => ({
    id,
    title: id,
    taskType: 'quiz',
    quizType,
    ...(quizType === 'multiple_choice' ? { check: { type: 'answer_equals', value: 'a' } } : {}),
    ...extra,
  })
  const lessonWith = (subtasks, after = [{ id: 'after', title: 'After' }]) => ({
    id: 'qm',
    type: 'python',
    title: 'QM',
    tasks: [
      { id: 'before', title: 'Before' },
      { id: 'g1', type: 'group', title: 'End Quiz', subtasks },
      ...after,
    ],
  })

  it('needs quizMasterMinQuizzes graded quizzes; confidence and unchecked short answer are not graded', () => {
    const lesson = lessonWith([
      quiz('a'),
      quiz('b'),
      quiz('c', 'confidence'),
      quiz('d', 'short_answer'),
    ])
    const t = { alex: [right('a', 1), right('b', 2), right('c', 3), right('d', 4)] }
    expect(evaluate('quiz_master', t, { lesson })).toEqual([])
    const checked = lessonWith([
      quiz('a'),
      quiz('b'),
      quiz('d', 'short_answer', { check: { type: 'answer_contains', value: 'x' } }),
    ])
    expect(pairs(evaluate('quiz_master', t, { lesson: checked }))).toEqual([['alex', 'd']])
  })

  it('applies the threshold to first attempts only', () => {
    const lesson = lessonWith(['a', 'b', 'c', 'd', 'e'].map((id) => quiz(id)))
    const fourOfFive = {
      alex: [
        right('a', 1),
        right('b', 2),
        right('c', 3),
        right('d', 4),
        wrong('e', 5),
        pass('e', 6),
      ],
    }
    const [s] = evaluate('quiz_master', fourOfFive, { lesson })
    expect(s.reason).toBe('End Quiz: 4 of 5 right first time')
    const threeOfFive = {
      alex: [right('a', 1), right('b', 2), right('c', 3), wrong('d', 4), wrong('e', 5)],
    }
    expect(evaluate('quiz_master', threeOfFive, { lesson })).toEqual([])
  })

  it('an assisted first try is not right', () => {
    const lesson = lessonWith(['a', 'b', 'c'].map((id) => quiz(id)))
    const t = {
      alex: [
        right('a', 1),
        right('b', 2),
        attempt({ taskId: 'c', passed: true, firstTry: true, assisted: true, at: 3 }),
      ],
    }
    expect(evaluate('quiz_master', t, { lesson })).toEqual([])
  })

  it('waits for every quiz unless the class has moved past the group', () => {
    const lesson = lessonWith(['a', 'b', 'c', 'd', 'e'].map((id) => quiz(id)))
    const t = { alex: [right('a', 1), right('b', 2), right('c', 3), right('d', 4)] }
    expect(evaluate('quiz_master', t, { lesson })).toEqual([])
    // Still inside the group: not evaluated.
    expect(evaluate('quiz_master', t, { lesson, options: { currentTaskId: 'e' } })).toEqual([])
    // Moved past: 4 of 5 (the unattempted one counts as not right).
    const [s] = evaluate('quiz_master', t, { lesson, options: { currentTaskId: 'after' } })
    expect(s).toMatchObject({ taskId: 'e', reason: 'End Quiz: 4 of 5 right first time' })
    expect(evaluate('quiz_master', t, { lesson, options: { sessionEnded: true } })).toHaveLength(1)
    // Moved past with too few attempted.
    const few = { alex: [right('a', 1)] }
    expect(evaluate('quiz_master', few, { lesson, options: { currentTaskId: 'after' } })).toEqual(
      []
    )
  })

  it('suggests once, for the first qualifying group', () => {
    const lesson = {
      id: 'qm2',
      type: 'python',
      title: 'QM',
      tasks: [
        {
          id: 'g1',
          type: 'group',
          title: 'Quiz 1',
          subtasks: ['a', 'b', 'c'].map((id) => quiz(id)),
        },
        {
          id: 'g2',
          type: 'group',
          title: 'Quiz 2',
          subtasks: ['x', 'y', 'z'].map((id) => quiz(id)),
        },
      ],
    }
    const t = {
      alex: ['a', 'b', 'c', 'x', 'y', 'z'].map((id, i) => right(id, i)),
    }
    expect(pairs(evaluate('quiz_master', t, { lesson }))).toEqual([['alex', 'c']])
  })
})

describe('Code Fixer', () => {
  it('task variant: an error, then a real pass with different code', () => {
    const [s] = evaluate('code_fixer', {
      alex: [
        attempt({ taskId: 't4', error: 'NameError', submissionHash: 'a', at: 10 }),
        pass('t4', 20, { submissionHash: 'b' }),
      ],
    })
    expect(s).toMatchObject({
      taskId: 't4',
      context: 'task',
      reason: 'Fixed a NameError in “Count up”',
    })
  })

  it('task variant: the pass must be real', () => {
    const t = {
      alex: [
        attempt({ taskId: 't4', error: true, submissionHash: 'a', at: 10 }),
        completeShownEvent({ taskId: 't4', at: 15 }),
        pass('t4', 20, { submissionHash: 'b' }),
      ],
    }
    expect(evaluate('code_fixer', t)).toEqual([])
  })

  it('task variant: an error after the pass does not count', () => {
    const t = {
      alex: [
        pass('t4', 10, { submissionHash: 'b' }),
        attempt({ taskId: 't4', error: true, submissionHash: 'a', at: 20 }),
      ],
    }
    expect(evaluate('code_fixer', t)).toEqual([])
  })

  it('sandbox variants, and the earliest fix supplies the reason', () => {
    const t = {
      alex: [
        run({ context: 'personal', error: 'SyntaxError', submissionHash: 'a', at: 5 }),
        run({ context: 'personal', submissionHash: 'b', at: 8 }),
        attempt({ taskId: 't4', error: true, submissionHash: 'a', at: 10 }),
        pass('t4', 20, { submissionHash: 'b' }),
      ],
      sam: [
        run({ error: true, submissionHash: 'a', at: 10 }),
        run({ error: true, submissionHash: 'b', at: 20 }),
        run({ submissionHash: 'b', at: 30 }),
      ],
    }
    const suggestions = evaluate('code_fixer', t)
    expect(suggestions).toEqual([
      expect.objectContaining({
        studentId: 'alex',
        taskId: null,
        context: 'personal',
        reason: 'Fixed a SyntaxError in their own sandbox',
      }),
      // sam's clean run 'b' fixes the earlier error 'a' (not the same code).
      expect.objectContaining({
        studentId: 'sam',
        taskId: null,
        context: 'sandbox',
        reason: 'Fixed an error in the sandbox',
      }),
    ])
  })

  it('an error-free run in another sandbox is not a fix', () => {
    const t = {
      alex: [
        run({ context: 'sandbox', error: true, submissionHash: 'a', at: 10 }),
        run({ context: 'personal', submissionHash: 'b', at: 20 }),
      ],
    }
    expect(evaluate('code_fixer', t)).toEqual([])
  })
})

describe('composed lessons', () => {
  const lesson = {
    id: 'composed',
    type: 'composed',
    title: 'Composed',
    tasks: [
      {
        id: 'p1',
        title: 'Python debug',
        moduleType: 'python',
        taskActivity: 'Code Task, Debug Code Task',
      },
      { id: 's1', title: 'Scratch task', moduleType: 'scratch', taskActivity: 'Code Task' },
      { id: 'i1', title: 'Info', taskType: 'information', explainer: 'x' },
    ],
  }

  it('resolves patterns and code tasks per task', () => {
    expect(pairs(evaluate('bug_hunter', { alex: [pass('p1', 1)] }, { lesson }))).toEqual([
      ['alex', 'p1'],
    ])
    const t = {
      alex: [firstEditEvent({ taskId: 's1', elapsedMs: 2000 })],
      sam: [firstEditEvent({ taskId: 'i1', elapsedMs: 2000 })],
    }
    expect(pairs(evaluate('ready_to_code', t, { lesson }))).toEqual([['alex', 's1']])
  })
})

describe('evaluateBadgeRules', () => {
  it('suggests each badge at most once per student and drops decided keys', () => {
    const t = {
      alex: [pass('t2', 10), pass('t3', 20), firstEditEvent({ taskId: 't2', elapsedMs: 1000 })],
    }
    const decisions = { alex: { ready_to_code: { status: 'revoked', decidedAt: 5 } } }
    const suggestions = evaluateBadgeRules({ timelines: t, lesson: EXAMPLE_LESSON, decisions })
    expect(suggestions.map((s) => s.badgeId)).toEqual(['bug_hunter', 'code_builder'])
  })

  it('runs with no timelines', () => {
    expect(evaluateBadgeRules({ timelines: {}, lesson: EXAMPLE_LESSON })).toEqual([])
  })
})
