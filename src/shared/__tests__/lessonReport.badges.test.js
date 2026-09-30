import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { anonymizeSessionReport, buildSessionReport, reportToYamlText } from '../lessonReport'
import {
  capSessionReportSize,
  REPORT_MAX_BYTES,
  REPORT_SIZE_NOTE_PUSHES,
  REPORT_SIZE_NOTE_SNAPSHOTS,
} from '../../badges/reportMetrics'
import { normaliseSessionArchive } from '../../badges/sessionArchive'

// A realistic live session with badges data (docs/architecture/live-badges-plan.md, "Session
// report"): three students, a debug task, a code task, a three-question quiz group, a Badge
// Summary task, signals, decisions, pending suggestions and one teacher-sandbox visit.
const quiz = (id, title) => ({
  id,
  title,
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Yes' },
    { id: 'b', text: 'No' },
  ],
  check: { type: 'answer_equals', value: 'a' },
})

const lesson = {
  id: 'badges-lesson',
  title: 'Badges Lesson',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Fix the bug',
      taskActivity: 'Code Task, Debug Code Task',
      check: { type: 'output_contains', value: 'hello' },
    },
    { id: 2, title: 'Loops', check: { type: 'output_contains', value: '0' } },
    {
      id: 'g1',
      type: 'group',
      title: 'End Quiz',
      subtasks: [quiz(3, 'Q1'), quiz(4, 'Q2'), quiz(5, 'Q3')],
    },
    { id: 9, title: 'Moments', taskType: 'information', informationType: 'badges' },
  ],
}

const attempt = (n, passed, submission, at, extra = {}) => ({
  attemptNumber: n,
  passed,
  submission,
  suggestion: passed ? null : 'Try again',
  retries: 0,
  loggedAt: at,
  ...(passed ? { passedAt: at } : {}),
  ...extra,
})

const session = {
  lessonId: 'badges-lesson',
  startedAt: 500,
  endedAt: 100000,
  taskStartTimes: { 1: 1000, 2: 5000, 3: 9000, 4: 9000, 5: 9000 },
  students: {
    'uid-alex': { displayName: 'Alex' },
    'uid-sam': { displayName: 'Sam' },
    'uid-jo': { displayName: 'Jo', pasteLog: { 1: { count: 1, chars: 200, firstAt: 1550 } } },
  },
  attemptLog: {
    'uid-alex': {
      1: {
        a: attempt(1, false, 'prnt("hello")', 1100, { error: 'NameError' }),
        b: attempt(2, true, 'print("hello")', 1500),
      },
      3: { a: attempt(1, true, 'a', 9100) },
      4: { a: attempt(1, true, 'a', 9200) },
      5: { a: attempt(1, false, 'b', 9300), b: attempt(2, true, 'a', 9400) },
    },
    'uid-sam': {
      1: {
        a: attempt(1, false, 'one', 1200),
        b: attempt(2, false, 'two', 1300),
        c: attempt(3, false, 'one', 1350),
        d: attempt(4, true, 'print("hello")', 1400, { teacherAssisted: true }),
      },
      2: { a: attempt(1, true, 'for i in range(3): print(i)', 6000) },
      3: { a: attempt(1, true, 'a', 9150) },
      4: { a: attempt(1, true, 'a', 9250) },
      5: { a: attempt(1, true, 'a', 9350) },
    },
    'uid-jo': {
      1: { a: attempt(1, true, 'print("hello")', 1600) },
    },
  },
  studentSignals: {
    'uid-alex': {
      topics: { task: { 1: { loops: { openedAt: 1200, source: 'student', via: 'button' } } } },
      shortcuts: { run: { firstUsedAt: 1300, context: 'task', taskId: 1 } },
      firstEdits: { 1: { elapsedMs: 4000, at: 1004 }, 2: { elapsedMs: 9000, at: 5009 } },
      sandbox: { personal: { timeMs: 60000, runs: 4, errorRuns: 2, fixes: 1, runsLog: [] } },
    },
    'uid-sam': {
      topics: { task: { 1: { loops: { openedAt: 1250, source: 'teacher', via: 'teacher' } } } },
      shortcuts: {
        run: { firstUsedAt: 1310, context: 'task', taskId: 1 },
        undo: { firstUsedAt: 7300, context: 'sandbox', taskId: null },
      },
      firstEdits: { 1: { elapsedMs: 12000, at: 1012 } },
      sandbox: { session: { timeMs: 120000, runs: 3, errorRuns: 1, fixes: 1, runsLog: [] } },
    },
  },
  badges: {
    'uid-alex': {
      bug_hunter: {
        status: 'awarded',
        source: 'rule',
        reason: 'First to fix the bug in “Fix the bug”',
        taskId: 1,
        announce: true,
        decidedAt: 2000,
      },
      keyboard_wizard: {
        status: 'awarded',
        source: 'auto',
        reason: 'Used Ctrl+Enter',
        taskId: 1,
        announce: true,
        decidedAt: 2100,
      },
    },
    'uid-sam': {
      keyboard_wizard: {
        status: 'awarded',
        source: 'manual',
        reason: null,
        taskId: null,
        announce: true,
        decidedAt: 2200,
      },
      persistence: {
        status: 'dismissed',
        source: 'rule',
        reason: '2 different tries, then passed “Fix the bug”',
        taskId: 1,
        decidedAt: 2300,
      },
    },
    'uid-jo': {
      code_fixer: {
        status: 'revoked',
        source: 'rule',
        reason: 'Fixed an error in the sandbox',
        taskId: null,
        decidedAt: 2400,
        revokedAt: 2500,
      },
    },
  },
}

const archive = normaliseSessionArchive(
  {
    visits: {
      7000: {
        enteredAt: 7000,
        exitedAt: 7000 + 14 * 60000,
        previousTaskId: 2,
        explainer: 'Try a loop that counts',
        pushes: { p1: { at: 7100, code: 'for i in range(3):' } },
        studentSnapshots: { 'uid-sam': { at: 7200, code: 'for i in range(3): print(i)' } },
      },
    },
  },
  { endedAt: 100000 }
)

const pendingSuggestions = [
  { badgeId: 'quiz_master', studentId: 'uid-sam', taskId: 5, reason: 'End Quiz: 3 of 3' },
  { badgeId: 'ready_to_code', studentId: 'uid-alex', taskId: 1, reason: 'Started 4 s in' },
]

const topics = [{ id: 'loops', title: 'Loops' }]

function build(overrides = {}) {
  return buildSessionReport({
    session,
    lesson,
    sessionArchive: archive,
    pendingSuggestions,
    topics,
    ...overrides,
  })
}

const bytesOf = (value) => new TextEncoder().encode(JSON.stringify(value)).length
const byLabel = (report, label) => report.students.find((s) => s.studentLabel === label)
const taskOf = (list, id) => list.find((t) => t.taskId === id)

describe('buildSessionReport: live badges', () => {
  it('adds each student’s moments, topic opens, shortcuts and sandbox activity', () => {
    const report = build()
    const alex = byLabel(report, 'Student 1')
    expect(alex.badges).toEqual([
      {
        badgeId: 'bug_hunter',
        emoji: '🐛',
        title: 'Bug Hunter',
        source: 'rule',
        reason: 'First to fix the bug in “Fix the bug”',
        taskId: 1,
        awardedAt: 2000,
      },
      expect.objectContaining({ badgeId: 'keyboard_wizard', source: 'auto', awardedAt: 2100 }),
    ])
    expect(alex.topicsOpened).toEqual([
      {
        topicId: 'loops',
        title: 'Loops',
        context: 'task',
        taskId: 1,
        source: 'student',
        openedAt: 1200,
      },
    ])
    expect(alex.shortcutsUsed).toEqual([
      { shortcutId: 'run', label: 'Ctrl+Enter', context: 'task', taskId: 1, firstUsedAt: 1300 },
    ])
    expect(alex.personalSandbox).toEqual({ timeMs: 60000, runs: 4, errorRuns: 2, fixes: 1 })
    expect(alex).not.toHaveProperty('teacherSandbox')

    const sam = byLabel(report, 'Student 2')
    expect(sam.teacherSandbox).toEqual({ timeMs: 120000, runs: 3, errorRuns: 1, fixes: 1 })
    expect(sam.shortcutsUsed.map((s) => s.shortcutId)).toEqual(['run', 'undo'])

    // A revoked badge is not a moment.
    const jo = byLabel(report, 'Student 3')
    expect(jo).not.toHaveProperty('badges')
  })

  it('adds per-task first edit, error attempts, unique failed tries and the first real pass', () => {
    const report = build()
    const alexTask1 = taskOf(byLabel(report, 'Student 1').tasks, 1)
    expect(alexTask1).toMatchObject({
      timeToFirstEditMs: 4000,
      errorAttempts: 1,
      uniqueFailedAttempts: 1,
      firstPassInClass: true,
    })
    // Sam: one → two → one is 2 unique fails; his assisted pass isn't a real pass.
    const samTask1 = taskOf(byLabel(report, 'Student 2').tasks, 1)
    expect(samTask1).toMatchObject({ timeToFirstEditMs: 12000, uniqueFailedAttempts: 2 })
    expect(samTask1).not.toHaveProperty('errorAttempts')
    expect(samTask1).not.toHaveProperty('firstPassInClass')
    // Jo pasted before passing: not a real pass either.
    expect(taskOf(byLabel(report, 'Student 3').tasks, 1)).not.toHaveProperty('firstPassInClass')
    expect(taskOf(byLabel(report, 'Student 2').tasks, 2)).toMatchObject({
      firstPassInClass: true,
    })
  })

  it('summarises time to first edit, console errors, topic opens and the first real pass', () => {
    const report = build()
    expect(taskOf(report.taskSummary, 1)).toMatchObject({
      timeToFirstEdit: { medianMs: 8000, minMs: 4000, maxMs: 12000, studentCount: 2 },
      errorStudentCount: 1,
      topicOpens: { student: 1, teacher: 1 },
      firstRealPass: { studentLabel: 'Student 1', afterMs: 500 },
    })
    expect(taskOf(report.taskSummary, 2)).toMatchObject({
      timeToFirstEdit: { medianMs: 9000, minMs: 9000, maxMs: 9000, studentCount: 1 },
      firstRealPass: { studentLabel: 'Student 2', afterMs: 1000 },
    })
    expect(taskOf(report.taskSummary, 2)).not.toHaveProperty('errorStudentCount')
    expect(taskOf(report.taskSummary, 2)).not.toHaveProperty('topicOpens')
    // The Badge Summary task is an information task: never reported.
    expect(taskOf(report.taskSummary, 9)).toBeUndefined()
  })

  it('reports each quiz group’s first-try scores and the class median', () => {
    expect(build().quizGroups).toEqual([
      {
        groupId: 'g1',
        title: 'End Quiz',
        quizTaskIds: [3, 4, 5],
        students: [
          { studentLabel: 'Student 1', right: 2, total: 3, firstTryPercent: 67 },
          { studentLabel: 'Student 2', right: 3, total: 3, firstTryPercent: 100 },
        ],
        medianFirstTryPercent: 84,
      },
    ])
  })

  it('copies the teacher sandbox from the archive as a possible lesson gap', () => {
    expect(build().teacherSandbox).toEqual({
      possibleLessonGap: true,
      visits: [
        {
          visitId: '7000',
          enteredAt: 7000,
          exitedAt: 7000 + 14 * 60000,
          durationMs: 14 * 60000,
          previousTaskId: 2,
          previousTaskTitle: 'Loops',
          explainer: 'Try a loop that counts',
          pushes: [{ at: 7100, code: 'for i in range(3):' }],
          studentSnapshots: [
            { studentLabel: 'Student 2', at: 7200, code: 'for i in range(3): print(i)' },
          ],
        },
      ],
    })
  })

  it('leaves the teacher sandbox out when no archive is passed (the in-progress preview)', () => {
    expect(buildSessionReport({ session, lesson })).not.toHaveProperty('teacherSandbox')
  })

  it('counts every badge decision and the pending suggestions in badgeSummary', () => {
    const empty = { suggested: 0, awarded: 0, autoAwarded: 0, manual: 0, dismissed: 0, revoked: 0 }
    expect(build().badgeSummary).toEqual({
      bug_hunter: { ...empty, suggested: 1, awarded: 1 },
      keyboard_wizard: { ...empty, suggested: 1, awarded: 2, autoAwarded: 1, manual: 1 },
      persistence: { ...empty, suggested: 1, dismissed: 1 },
      code_fixer: { ...empty, suggested: 1, revoked: 1 },
      quiz_master: { ...empty, suggested: 1 },
      ready_to_code: { ...empty, suggested: 1 },
    })
  })

  it('counts the students who used each shortcut', () => {
    expect(build().shortcutSummary).toEqual({ run: 2, undo: 1 })
  })

  it('never stores names or anonymous ids, in any section', () => {
    const text = JSON.stringify(build())
    for (const leak of ['Alex', 'Sam', '"Jo"', 'uid-']) expect(text).not.toContain(leak)
  })

  it('reports nothing new for a session without badge data', () => {
    const report = buildSessionReport({
      session: { startedAt: 1, students: { a: { displayName: 'A' } } },
      lesson: { id: 'x', tasks: [{ id: 1, title: 'T', check: { type: 'output_contains' } }] },
    })
    for (const key of ['quizGroups', 'teacherSandbox', 'badgeSummary', 'shortcutSummary']) {
      expect(report).not.toHaveProperty(key)
    }
    expect(Object.keys(report.students[0])).toEqual(['studentLabel', 'tasks'])
  })
})

describe('anonymizeSessionReport: live badge sections', () => {
  it('relabels students referenced by name in the new sections', () => {
    const named = {
      students: [
        { displayName: 'Alex', badges: [{ badgeId: 'bug_hunter' }], tasks: [] },
        { anonymousId: 'uid-sam', displayName: 'Sam', tasks: [] },
      ],
      taskSummary: [{ taskId: 1, firstRealPass: { displayName: 'Alex', afterMs: 500 } }],
      quizGroups: [{ groupId: 'g', students: [{ anonymousId: 'uid-sam', right: 1, total: 1 }] }],
      teacherSandbox: {
        visits: [{ visitId: '1', studentSnapshots: [{ displayName: 'Nobody', code: 'x' }] }],
      },
    }
    const result = anonymizeSessionReport(named)
    expect(result.taskSummary[0].firstRealPass).toEqual({ studentLabel: 'Student 1', afterMs: 500 })
    expect(result.quizGroups[0].students[0]).toEqual({
      studentLabel: 'Student 2',
      right: 1,
      total: 1,
    })
    expect(result.teacherSandbox.visits[0].studentSnapshots[0]).toEqual({
      studentLabel: 'Former student',
      code: 'x',
    })
    const text = JSON.stringify(result)
    for (const leak of ['Alex', 'Sam', 'Nobody', 'uid-']) expect(text).not.toContain(leak)
  })

  it('keeps a built report’s labels as they are', () => {
    const report = build()
    expect(anonymizeSessionReport(report)).toEqual(report)
  })
})

describe('reportToYamlText: live badge sections', () => {
  it('exports every new section', () => {
    const parsed = yaml.load(reportToYamlText(build()))
    expect(parsed.students[0].badges[0].badgeId).toBe('bug_hunter')
    expect(parsed.students[0].topicsOpened).toHaveLength(1)
    expect(parsed.students[0].shortcutsUsed).toHaveLength(1)
    expect(parsed.students[0].personalSandbox.runs).toBe(4)
    expect(parsed.taskSummary[0].firstRealPass.studentLabel).toBe('Student 1')
    expect(parsed.quizGroups[0].medianFirstTryPercent).toBe(84)
    expect(parsed.teacherSandbox.visits[0].studentSnapshots[0].studentLabel).toBe('Student 2')
    expect(parsed.badgeSummary.keyboard_wizard.awarded).toBe(2)
    expect(parsed.shortcutSummary).toEqual({ run: 2, undo: 1 })
  })
})

describe('session report size cap', () => {
  it('drops the students’ sandbox snapshots first, and notes it', () => {
    const withBigSnapshot = normaliseSessionArchive(
      {
        visits: {
          7000: {
            enteredAt: 7000,
            previousTaskId: 2,
            pushes: { p1: { at: 7100, code: 'for i in range(3):' } },
            studentSnapshots: { 'uid-sam': { at: 7200, code: 'x'.repeat(5000) } },
          },
        },
      },
      { endedAt: 100000 }
    )
    const report = build({ sessionArchive: withBigSnapshot })
    // Just too big: dropping the one snapshot is enough.
    const capped = capSessionReportSize(report, bytesOf(report) - 1000)
    expect(capped.teacherSandbox.visits[0].studentSnapshots).toEqual([])
    expect(capped.teacherSandbox.studentSnapshotsDropped).toBe(true)
    expect(capped.sizeNote).toBe(REPORT_SIZE_NOTE_SNAPSHOTS)
    // Everything else is kept.
    expect(capped.teacherSandbox.visits[0].pushes).toEqual(report.teacherSandbox.visits[0].pushes)
    expect(capped.badgeSummary).toEqual(report.badgeSummary)
  })

  it('drops the teacher’s pushed code too when the snapshots are not enough', () => {
    const report = build()
    const capped = capSessionReportSize(report, 100)
    expect(capped.teacherSandbox.visits[0].pushes).toEqual([{ at: 7100 }])
    expect(capped.teacherSandbox.pushesDropped).toBe(true)
    expect(capped.sizeNote).toBe(REPORT_SIZE_NOTE_PUSHES)
  })

  it('leaves a report that fits unchanged', () => {
    const report = build()
    expect(capSessionReportSize(report)).toBe(report)
    expect(report).not.toHaveProperty('sizeNote')
  })

  it('stays under the cap with 30 students and a long sandbox visit', () => {
    const code = 'x = 1\n'.repeat(3400) // ~20 KB, the archive's per-snapshot cap
    const students = {}
    const studentSnapshots = {}
    for (let i = 0; i < 30; i += 1) {
      students[`s${i}`] = { displayName: `Coder ${i}` }
      studentSnapshots[`s${i}`] = { at: 7000 + i, code }
    }
    const bigArchive = normaliseSessionArchive(
      {
        visits: {
          7000: {
            enteredAt: 7000,
            exitedAt: 7000 + 40 * 60000,
            previousTaskId: 2,
            studentSnapshots,
          },
          9000: { enteredAt: 9000, exitedAt: 9500, previousTaskId: 2, studentSnapshots },
        },
      },
      { endedAt: 100000 }
    )
    const report = buildSessionReport({
      session: { ...session, students },
      lesson,
      sessionArchive: bigArchive,
    })
    expect(bytesOf(report)).toBeLessThanOrEqual(REPORT_MAX_BYTES)
    expect(report.sizeNote).toBe(REPORT_SIZE_NOTE_SNAPSHOTS)
    expect(report.teacherSandbox.visits).toHaveLength(2)
  })
})
