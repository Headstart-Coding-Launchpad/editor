// Characterisation tests for the live badge engine: realistic `sessions/{lessonId}` snapshots
// (as `snap.val()` returns them) through buildLiveTimelines and evaluateBadgeRules
// (docs/agents/runtime-model.md, "Badge data"; docs/architecture/live-badges-plan.md).
import { describe, expect, it } from 'vitest'
import { evaluateBadgeRules } from '../evaluate.js'
import {
  badgeEvaluationInputKey,
  buildLiveTimelines,
  liveBadgeLesson,
  studentTimelineInputKey,
} from '../liveTimeline.js'
import { hashSubmission } from '../signals.js'

const COMPLETE_STAGES = [
  { role: 'starter', code: 'for i in range(3):\nprint(i)' },
  { role: 'support', label: 'Indent the print', code: 'for i in range(3):\n  ...' },
  { role: 'complete', code: 'for i in range(3):\n    print(i)' },
]

// A live lesson with numeric ids, as published lessons have.
const LESSON = {
  id: 'loops-101',
  type: 'python',
  title: 'Loops',
  tasks: [
    { id: 1, title: 'Say hello', taskActivity: 'Code Task, Complete Example' },
    { id: 2, title: 'Type it out', taskActivity: 'Code Task, Copy the Code' },
    {
      id: 3,
      title: 'Fix the loop',
      taskActivity: 'Code Task, Debug Code Task',
      codeStages: COMPLETE_STAGES,
    },
    { id: 4, title: 'Count up', taskActivity: 'Code Task' },
    { id: 5, title: 'Solo bug', taskActivity: 'Code Task, Debug Code Task', taskMode: 'solo' },
    {
      id: 'g1',
      type: 'group',
      title: 'End Quiz',
      subtasks: [
        {
          id: 6,
          title: 'Spot the error',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          taskActivity: 'Quiz: What Is the Error?',
          check: { type: 'answer_equals', value: 'a' },
        },
        {
          id: 7,
          title: 'Fix the bug',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          taskActivity: 'Quiz: Fix a Common Bug',
          check: { type: 'answer_equals', value: 'b' },
        },
        {
          id: 8,
          title: 'Match the words',
          taskType: 'quiz',
          quizType: 'match',
          taskActivity: 'Quiz: Vocabulary Match',
        },
      ],
    },
    { id: 10, title: 'Coming up next', taskType: 'information', explainer: 'Next time…' },
  ],
}

const TOPICS = [{ id: 'loops', title: 'Loops' }]

let pushSeq = 0
// One attemptLog entry, as logAttempt writes it (server timestamps resolved).
function entry(code, { passed = false, at, error = null, assisted = false, attemptNumber = 1 }) {
  pushSeq += 1
  return [
    `-N${String(pushSeq).padStart(4, '0')}`,
    {
      submission: code,
      passed,
      suggestion: null,
      ...(assisted ? { teacherAssisted: true } : {}),
      ...(error ? { error } : {}),
      attemptNumber,
      retries: 0,
      loggedAt: at,
      ...(passed ? { passedAt: at } : {}),
    },
  ]
}
const log = (...entries) => Object.fromEntries(entries)

function student(name, extra = {}) {
  return { displayName: name, joinedAt: 1, online: true, currentCode: '', ...extra }
}

function makeSession({ roster = ['alex', 'sam'], ...rest } = {}) {
  return {
    state: 'active',
    currentTaskId: 1,
    students: Object.fromEntries(roster.map((id) => [id, student(id)])),
    ...rest,
  }
}

function suggest(session, { lesson = LESSON, badgeIds, topics = TOPICS } = {}) {
  const badgeLesson = liveBadgeLesson(lesson)
  return evaluateBadgeRules({
    timelines: buildLiveTimelines({ session, lesson, topics }),
    lesson: badgeLesson,
    decisions: session.badges ?? {},
    options: {
      currentTaskId: session.currentTaskId,
      sessionEnded: session.state === 'ended',
      ...(badgeIds ? { badgeIds } : {}),
    },
  })
}
const pairs = (suggestions) => suggestions.map((s) => [s.studentId, s.taskId])

describe('buildLiveTimelines', () => {
  it('maps every stored source to its timeline event', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          4: log(
            entry('x = 1', { at: 100, error: 'NameError' }),
            entry('x = 2', { passed: true, at: 200, attemptNumber: 2 })
          ),
        },
      },
      supportRevealLog: {
        alex: { 3: { 2: { taskId: 3, stageIndex: 2, source: 'teacher', revealedAt: 50 } } },
      },
      overrideLog: { alex: { 2: { taskId: 2, overriddenAt: 60, attemptNumber: 1 } } },
      studentSignals: {
        alex: {
          topics: { task: { 4: { loops: { openedAt: 70, source: 'student', via: 'link' } } } },
          shortcuts: { run: { firstUsedAt: 80, context: 'task', taskId: 4 } },
          firstEdits: { 4: { elapsedMs: 6200, at: 90 } },
          completeShown: { 3: { at: 95, via: 'show' } },
          sandbox: {
            personal: {
              runs: 1,
              runsLog: [{ at: 300, error: 'TypeError', submissionHash: 'h1' }],
            },
          },
        },
      },
    })
    session.students.alex.pasteLog = { 4: { count: 1, chars: 400, lastAt: 99, firstAt: 98 } }

    const timeline = buildLiveTimelines({ session, lesson: LESSON, topics: TOPICS }).alex
    const byType = (type) => timeline.filter((event) => event.type === type)

    expect(byType('attempt')).toEqual([
      {
        type: 'attempt',
        context: 'task',
        taskId: 4,
        passed: false,
        firstTry: true,
        error: 'NameError',
        assisted: false,
        submissionHash: hashSubmission('x = 1'),
        at: 100,
      },
      expect.objectContaining({ passed: true, firstTry: false, at: 200 }),
    ])
    expect(byType('reveal')).toEqual([
      expect.objectContaining({ taskId: 3, stage: 2, complete: true, at: 50 }),
    ])
    expect(byType('override')).toEqual([expect.objectContaining({ taskId: 2, at: 60 })])
    expect(byType('paste')).toEqual([expect.objectContaining({ taskId: 4, firstAt: 98 })])
    expect(byType('topic_open')).toEqual([
      expect.objectContaining({
        context: 'task',
        topicId: 'loops',
        topicTitle: 'Loops',
        taskId: 4,
        source: 'student',
        at: 70,
      }),
    ])
    expect(byType('shortcut')).toEqual([
      expect.objectContaining({ context: 'task', shortcutId: 'run', taskId: 4, at: 80 }),
    ])
    expect(byType('first_edit')).toEqual([expect.objectContaining({ taskId: 4, elapsedMs: 6200 })])
    expect(byType('complete_shown')).toEqual([
      expect.objectContaining({ taskId: 3, via: 'show', at: 95 }),
    ])
    expect(byType('sandbox_run')).toEqual([
      expect.objectContaining({ context: 'personal', error: 'TypeError', submissionHash: 'h1' }),
    ])
  })

  it('treats a support stage reveal as not complete', () => {
    const session = makeSession({
      roster: ['alex'],
      supportRevealLog: { alex: { 3: { 1: { stageIndex: 1, revealedAt: 5 } } } },
    })
    const [reveal] = buildLiveTimelines({ session, lesson: LESSON }).alex
    expect(reveal).toMatchObject({ type: 'reveal', stage: 1, complete: false })
  })

  it('builds timelines only for the current roster', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: { gone: { 3: log(entry('a', { passed: true, at: 1 })) } },
    })
    expect(Object.keys(buildLiveTimelines({ session, lesson: LESSON }))).toEqual(['alex'])
  })

  it('drops task events on tasks outside the live lesson, but keeps sandbox and no-task ones', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          5: log(entry('solo', { passed: true, at: 1 })),
          99: log(entry('gone', { passed: true, at: 2 })),
        },
      },
      studentSignals: {
        alex: {
          topics: {
            task: { 99: { loops: { openedAt: 3, source: 'student' } } },
            sandbox: { 4: { loops: { openedAt: 4, source: 'student' } } },
          },
          shortcuts: {
            run: { firstUsedAt: 5, context: 'task', taskId: 99 },
            undo: { firstUsedAt: 6, context: 'task', taskId: null },
          },
          firstEdits: { 99: { elapsedMs: 1000 } },
        },
      },
    })
    const timeline = buildLiveTimelines({ session, lesson: LESSON }).alex
    expect(timeline).toEqual([
      expect.objectContaining({ type: 'topic_open', context: 'sandbox', taskId: null }),
      expect.objectContaining({ type: 'shortcut', shortcutId: 'undo', taskId: null }),
    ])
  })

  it('marks only the earliest entry as the first try, even after a reload reset attemptNumber', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          4: log(
            entry('a', { at: 10, attemptNumber: 1 }),
            // after a reload the tab's de-dupe cache is empty, so numbering restarts
            entry('b', { at: 20, attemptNumber: 1 })
          ),
        },
      },
    })
    const attempts = buildLiveTimelines({ session, lesson: LESSON }).alex
    expect(attempts.map((a) => a.firstTry)).toEqual([true, false])
  })
})

describe('first in class (🐛 Bug Hunter)', () => {
  const base = () =>
    makeSession({
      attemptLog: {
        alex: { 3: log(entry('fixed a', { passed: true, at: 200 })) },
        sam: { 3: log(entry('fixed s', { passed: true, at: 100 })) },
      },
    })
  const bugHunter = (session) => pairs(suggest(session, { badgeIds: ['bug_hunter'] }))

  it('suggests the earliest real pass', () => {
    expect(bugHunter(base())).toEqual([['sam', 3]])
  })

  it('stays put after an award: nobody else is suggested for that task', () => {
    const session = {
      ...base(),
      badges: { sam: { bug_hunter: { status: 'awarded', decidedAt: 300 } } },
    }
    expect(bugHunter(session)).toEqual([])
  })

  it('a dismissal uses up the task', () => {
    const session = {
      ...base(),
      badges: { sam: { bug_hunter: { status: 'dismissed', decidedAt: 300 } } },
    }
    expect(bugHunter(session)).toEqual([])
  })

  it('is the same after a teacher reload (fresh objects)', () => {
    const session = {
      ...base(),
      badges: { sam: { bug_hunter: { status: 'dismissed', decidedAt: 300 } } },
    }
    expect(suggest(structuredClone(session))).toEqual(suggest(session))
    expect(bugHunter(structuredClone(base()))).toEqual([['sam', 3]])
  })

  it('excludes a removed student', () => {
    const session = base()
    delete session.students.sam
    expect(bugHunter(session)).toEqual([['alex', 3]])
  })

  it('ignores the solo-only task and a task removed by Edit Lesson', () => {
    const session = makeSession({
      attemptLog: {
        alex: { 5: log(entry('solo', { passed: true, at: 50 })) },
        sam: { 3: log(entry('fixed', { passed: true, at: 100 })) },
      },
    })
    expect(bugHunter(session)).toEqual([['sam', 3]])
    // "Apply for this session" removed task 3: the edited lesson is what the engine reads.
    const edited = { ...LESSON, tasks: LESSON.tasks.filter((task) => task.id !== 3) }
    expect(pairs(suggest(session, { lesson: edited, badgeIds: ['bug_hunter'] }))).toEqual([])
  })
})

describe('anti-gaming guards', () => {
  const codeBuilder = (session) => pairs(suggest(session, { badgeIds: ['code_builder'] }))
  const twoPasses = (extra = {}) =>
    makeSession({
      attemptLog: {
        alex: { 2: log(entry('print(1)', { passed: true, at: 100, ...extra })) },
        sam: { 2: log(entry('print(2)', { passed: true, at: 200 })) },
      },
    })

  it('skips a pass after complete code was shown', () => {
    const session = twoPasses()
    session.studentSignals = { alex: { completeShown: { 2: { at: 90, via: 'preview' } } } }
    expect(codeBuilder(session)).toEqual([['sam', 2]])
  })

  it('skips a pass after a large paste, but not a paste after the pass', () => {
    const before = twoPasses()
    before.students.alex.pasteLog = { 2: { count: 1, chars: 300, lastAt: 95, firstAt: 95 } }
    expect(codeBuilder(before)).toEqual([['sam', 2]])
    const after = twoPasses()
    after.students.alex.pasteLog = { 2: { count: 1, chars: 300, lastAt: 150, firstAt: 150 } }
    expect(codeBuilder(after)).toEqual([['alex', 2]])
  })

  it('skips an overridden task and a teacher-assisted pass', () => {
    const overridden = twoPasses()
    overridden.overrideLog = { alex: { 2: { taskId: 2, overriddenAt: 300 } } }
    expect(codeBuilder(overridden)).toEqual([['sam', 2]])
    expect(codeBuilder(twoPasses({ assisted: true }))).toEqual([['sam', 2]])
  })

  it('skips a pass after the complete stage was revealed, not after a support stage', () => {
    const session = makeSession({
      attemptLog: {
        alex: { 3: log(entry('fixed a', { passed: true, at: 100 })) },
        sam: { 3: log(entry('fixed s', { passed: true, at: 200 })) },
      },
      supportRevealLog: { alex: { 3: { 2: { stageIndex: 2, revealedAt: 50 } } } },
    })
    expect(pairs(suggest(session, { badgeIds: ['bug_hunter'] }))).toEqual([['sam', 3]])
    session.supportRevealLog = { alex: { 3: { 1: { stageIndex: 1, revealedAt: 50 } } } }
    expect(pairs(suggest(session, { badgeIds: ['bug_hunter'] }))).toEqual([['alex', 3]])
  })
})

describe('🔨 Persistence', () => {
  const persistence = (session) => suggest(session, { badgeIds: ['persistence'] })

  it('A→B→A counts as 2 unique fails', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          4: log(
            entry('A', { at: 10 }),
            entry('B', { at: 20, attemptNumber: 2 }),
            entry('A', { at: 30, attemptNumber: 3 }),
            entry('C', { passed: true, at: 40, attemptNumber: 4 })
          ),
        },
      },
    })
    const [found] = persistence(session)
    expect(found).toMatchObject({ studentId: 'alex', taskId: 4 })
    expect(found.reason).toBe('2 different tries, then passed “Count up”')
  })

  it('a reload re-run of the same code does not add a unique fail', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          4: log(
            entry('A', { at: 10 }),
            // the reload emptied the de-dupe cache, so the same code got a new entry
            entry('A', { at: 20 }),
            entry('C', { passed: true, at: 30, attemptNumber: 2 })
          ),
        },
      },
    })
    expect(persistence(session)).toEqual([])
  })
})

describe('🔧 Code Fixer', () => {
  it('comes from an attemptLog error then a different passing submission', () => {
    const session = makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          4: log(
            entry('prnt(1)', { at: 10, error: 'NameError' }),
            entry('print(1)', { passed: true, at: 20, attemptNumber: 2 })
          ),
        },
      },
    })
    const [found] = suggest(session, { badgeIds: ['code_fixer'] })
    expect(found).toMatchObject({ studentId: 'alex', taskId: 4, context: 'task' })
    expect(found.reason).toBe('Fixed a NameError in “Count up”')
  })

  it('comes from the teacher sandbox runsLog', () => {
    const session = makeSession({
      roster: ['alex'],
      studentSignals: {
        alex: {
          sandbox: {
            session: {
              runs: 2,
              errorRuns: 1,
              fixes: 1,
              runsLog: {
                0: { at: 10, error: 'SyntaxError', submissionHash: 'h1' },
                1: { at: 20, error: false, submissionHash: 'h2', fix: true },
              },
            },
          },
        },
      },
    })
    const [found] = suggest(session, { badgeIds: ['code_fixer'] })
    expect(found).toMatchObject({ studentId: 'alex', taskId: null, context: 'sandbox' })
    expect(found.reason).toBe('Fixed a SyntaxError in the sandbox')
  })
})

describe('signal badges', () => {
  it('📚 Resourceful Coder: a student open counts, a teacher-sent topic does not', () => {
    const topics = (source, topicId = 'loops') => ({
      task: { 4: { [topicId]: { openedAt: 10, source } } },
    })
    const withTopics = (t) =>
      makeSession({ roster: ['alex'], studentSignals: { alex: { topics: t } } })
    const resourceful = (session) => suggest(session, { badgeIds: ['resourceful_coder'] })

    expect(resourceful(withTopics(topics('student')))[0].reason).toBe(
      'Opened “Loops” in the Topic Library'
    )
    expect(resourceful(withTopics(topics('teacher')))).toEqual([])
    expect(resourceful(withTopics(topics('student', '_library')))[0].reason).toBe(
      'Opened the Topic Library'
    )
  })

  it('⌨️ Keyboard Wizard: a listed shortcut', () => {
    const session = makeSession({
      roster: ['alex'],
      studentSignals: {
        alex: { shortcuts: { run: { firstUsedAt: 10, context: 'sandbox', taskId: 4 } } },
      },
    })
    const [found] = suggest(session, { badgeIds: ['keyboard_wizard'] })
    expect(found).toMatchObject({ studentId: 'alex', taskId: null, context: 'sandbox' })
    expect(found.reason).toBe('Used Ctrl+Enter')
  })

  it('🚀 Ready to Code: the threshold, and the lesson badgeOptions', () => {
    const session = makeSession({
      studentSignals: {
        alex: { firstEdits: { 4: { elapsedMs: 6000, at: 1 } } },
        sam: { firstEdits: { 4: { elapsedMs: 12000, at: 1 } } },
      },
    })
    expect(pairs(suggest(session, { badgeIds: ['ready_to_code'] }))).toEqual([['alex', 4]])
    const patient = { ...LESSON, badgeOptions: { readyToCodeSeconds: 15 } }
    expect(pairs(suggest(session, { lesson: patient, badgeIds: ['ready_to_code'] }))).toEqual([
      ['alex', 4],
      ['sam', 4],
    ])
  })
})

describe('🎯 Quiz Master', () => {
  const lesson = { ...LESSON, badgeOptions: { quizMasterThreshold: 0.6 } }
  // Right first time on two of the three graded quizzes; the third not attempted.
  const session = (extra) =>
    makeSession({
      roster: ['alex'],
      attemptLog: {
        alex: {
          6: log(entry('"a"', { passed: true, at: 10 })),
          7: log(entry('"b"', { passed: true, at: 20 })),
        },
      },
      ...extra,
    })
  const quizMaster = (s) => pairs(suggest(s, { lesson, badgeIds: ['quiz_master'] }))

  it('waits while the class is still in the group', () => {
    expect(quizMaster(session({ currentTaskId: 7 }))).toEqual([])
  })

  it('evaluates once the class has moved past the group, or the session ended', () => {
    expect(quizMaster(session({ currentTaskId: 10 }))).toEqual([['alex', 8]])
    expect(quizMaster(session({ currentTaskId: 7, state: 'ended' }))).toEqual([['alex', 8]])
    const [found] = suggest(session({ currentTaskId: 10 }), { lesson, badgeIds: ['quiz_master'] })
    expect(found.reason).toBe('End Quiz: 2 of 3 right first time')
  })
})

describe('input keys', () => {
  const session = () =>
    makeSession({
      attemptLog: { alex: { 4: log(entry('secret code', { at: 10 })) } },
      studentSignals: { sam: { firstEdits: { 4: { elapsedMs: 5 } } } },
    })

  it('ignore non-badge writes and code text, and follow badge inputs', () => {
    const a = session()
    const b = structuredClone(a)
    b.students.alex.currentCode = 'typing…'
    b.students.alex.lastActivityAt = 999
    expect(badgeEvaluationInputKey(b)).toBe(badgeEvaluationInputKey(a))
    expect(studentTimelineInputKey(a, 'alex')).not.toContain('secret code')

    b.badges = { alex: { persistence: { status: 'dismissed', decidedAt: 1 } } }
    expect(badgeEvaluationInputKey(b)).not.toBe(badgeEvaluationInputKey(a))
    const c = structuredClone(a)
    c.currentTaskId = 2
    expect(badgeEvaluationInputKey(c)).not.toBe(badgeEvaluationInputKey(a))
    const d = structuredClone(a)
    delete d.students.sam
    expect(badgeEvaluationInputKey(d)).not.toBe(badgeEvaluationInputKey(a))
  })
})
