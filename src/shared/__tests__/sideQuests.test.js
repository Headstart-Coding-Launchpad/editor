import { describe, expect, it } from 'vitest'
import {
  buildSideQuestReport,
  buildSideQuestTask,
  bumpSideQuestCount,
  canShowSideQuests,
  getSideQuests,
  sideQuestRecord,
  sideQuestRecordToSnapshot,
  sideQuestStatus,
  sideQuestStorageTaskId,
  SIDE_QUEST_TASK_ID,
  supportsSideQuests,
  validateSideQuests,
} from '../sideQuests.js'
import { validateLessonCore } from '../lessonValidation.js'
import { buildSessionReport } from '../lessonReport.js'
import { buildLiveTimelines } from '../../badges/liveTimeline.js'

const QUESTS = [
  { title: 'Break it, then fix it', kind: 'debug', explainer: 'Fix it.', starter: 'for i in x' },
  { title: 'Predict, then run', kind: 'predict', starter: 'print(1)' },
  { title: 'Mini challenge', kind: 'challenge', explainer: 'Count down.', starter: '' },
]

const codeTask = (extra = {}) => ({
  id: 't2',
  title: 'Copy the Code: for loops',
  starterCode: 'x = 1',
  check: { type: 'code_contains', value: 'x' },
  sideQuests: QUESTS,
  ...extra,
})

describe('getSideQuests', () => {
  it('keeps titled side-quests in order with their index, and fills defaults', () => {
    const quests = getSideQuests(
      codeTask({ sideQuests: [{ title: ' A ' }, { kind: 'debug' }, { title: 'C', kind: 'odd' }] })
    )
    expect(quests).toEqual([
      { index: 0, title: 'A', kind: 'challenge', explainer: '', starter: '' },
      { index: 2, title: 'C', kind: 'challenge', explainer: '', starter: '' },
    ])
  })

  it('reads at most three, and nothing from a task without them', () => {
    expect(getSideQuests(codeTask({ sideQuests: [...QUESTS, { title: 'D' }] }))).toHaveLength(3)
    expect(getSideQuests({ id: 1 })).toEqual([])
    expect(getSideQuests(null)).toEqual([])
  })

  it('supports python, turtle and html only', () => {
    expect(['python', 'turtle', 'html'].every(supportsSideQuests)).toBe(true)
    expect(supportsSideQuests('scratch')).toBe(false)
  })
})

describe('validateSideQuests', () => {
  const run = (task, ctx = {}) => {
    const errors = []
    const warnings = []
    validateSideQuests(
      task,
      { n: 1, moduleType: 'python', isCodeTask: true, ...ctx },
      errors,
      warnings
    )
    return { errors, warnings }
  }

  it('accepts up to three well-formed side-quests', () => {
    expect(run(codeTask())).toEqual({ errors: [], warnings: [] })
    expect(run({ id: 1 })).toEqual({ errors: [], warnings: [] })
  })

  it('rejects a malformed list', () => {
    expect(run(codeTask({ sideQuests: 'x' })).errors).toEqual(['Task 1 sideQuests must be a list'])
    expect(run(codeTask({ sideQuests: [...QUESTS, { title: 'D' }] })).errors).toContain(
      'Task 1 sideQuests can have at most 3 side-quests'
    )
    const { errors } = run(
      codeTask({
        sideQuests: [
          { kind: 'debug' },
          { title: 'x', kind: 'quiz' },
          { title: 'y', starter: 3 },
          7,
        ],
      })
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        'Task 1 side-quest 1 needs a title',
        'Task 1 side-quest 2 kind must be one of: challenge, debug, predict',
        'Task 1 side-quest 3 starter must be text',
        'Task 1 side-quest 4 must be an object with a title',
      ])
    )
    expect(run(codeTask({ sideQuests: [{ title: 'x'.repeat(61) }] })).errors).toEqual([
      'Task 1 side-quest 1 title must be 60 characters or fewer',
    ])
  })

  it('warns (and ignores them) on scratch or a non-code task', () => {
    expect(run(codeTask(), { moduleType: 'scratch' }).warnings).toEqual([
      'Task 1 sideQuests are not supported on scratch tasks yet (only python, turtle, html); they are ignored',
    ])
    expect(run(codeTask(), { isCodeTask: false }).warnings).toEqual([
      'Task 1 sideQuests only work on code tasks; they are ignored here',
    ])
  })

  it('runs as part of lesson validation', () => {
    const lesson = { id: 'sq', type: 'python', title: 'Side-quests', tasks: [codeTask()] }
    expect(validateLessonCore(lesson).errors).toEqual([])
    const bad = { ...lesson, tasks: [codeTask({ sideQuests: [{ title: '' }] })] }
    expect(validateLessonCore(bad).errors).toContain('Task 1 side-quest 1 needs a title')
  })
})

describe('buildSideQuestTask', () => {
  const [debug] = getSideQuests(codeTask())

  it('builds an unchecked python task from the starter and explainer', () => {
    const task = buildSideQuestTask(
      codeTask({ carryCodeFrom: 't1', copyCode: 'x' }),
      debug,
      'python'
    )
    expect(task).toEqual({
      id: SIDE_QUEST_TASK_ID,
      title: '🐞 Break it, then fix it',
      explainer: 'Fix it.',
      starterCode: 'for i in x',
      codeStages: [{ label: 'Starter', role: 'starter', code: 'for i in x' }],
    })
  })

  it('builds an html task with the starter as index.html', () => {
    const task = buildSideQuestTask(codeTask(), { ...debug, starter: '<p>Hi</p>' }, 'html')
    expect(task.starterFiles).toEqual([{ name: 'index.html', type: 'html', content: '<p>Hi</p>' }])
    expect(task.entryFile).toBe('index.html')
    expect(task.codeStages[0]).toMatchObject({ role: 'starter', entryFile: 'index.html' })
    expect(task.check).toBeUndefined()
  })
})

describe('canShowSideQuests', () => {
  const quests = getSideQuests(codeTask())
  const base = { quests, moduleType: 'python', phase: 'lesson', checkPassed: true }

  it('unlocks after a pass, live on the current task or solo', () => {
    expect(canShowSideQuests(base)).toBe(true)
    expect(canShowSideQuests({ ...base, phase: 'solo' })).toBe(true)
  })

  it('stays locked before a pass, looking back, in a sandbox or the presentation window', () => {
    expect(canShowSideQuests({ ...base, checkPassed: false })).toBe(false)
    expect(canShowSideQuests({ ...base, isViewingPrev: true })).toBe(false)
    expect(canShowSideQuests({ ...base, inPersonalSandbox: true })).toBe(false)
    expect(canShowSideQuests({ ...base, teacherPresentation: true })).toBe(false)
    expect(canShowSideQuests({ ...base, phase: 'sandbox' })).toBe(false)
    expect(canShowSideQuests({ ...base, moduleType: 'scratch' })).toBe(false)
    expect(canShowSideQuests({ ...base, quests: [] })).toBe(false)
  })
})

describe('saved work', () => {
  it('stores code or files under a pseudo task id beside the task', () => {
    expect(sideQuestStorageTaskId('t2', 1)).toBe('t2_sidequest_1')
    expect(sideQuestRecord('python', { code: 'print(1)' })).toEqual({ code: 'print(1)' })
    expect(
      sideQuestRecord('html', {
        files: [{ name: 'index.html', content: '<p>', type: 'html' }],
        activeFile: 'index.html',
      })
    ).toEqual({ files: [{ name: 'index.html', content: '<p>' }], activeFile: 'index.html' })
  })

  it('turns a saved record back into a seedable snapshot', () => {
    expect(sideQuestRecordToSnapshot('turtle', { code: 'fd(10)' })).toEqual({ code: 'fd(10)' })
    expect(
      sideQuestRecordToSnapshot('html', { files: [{ name: 'index.html', content: '<p>' }] })
    ).toEqual({ files: { 'index.html': '<p>' }, activeFile: '' })
    expect(sideQuestRecordToSnapshot('python', null)).toBeNull()
    expect(sideQuestRecordToSnapshot('python', { files: [] })).toBeNull()
    expect(sideQuestRecordToSnapshot('html', { code: 'x' })).toBeNull()
  })
})

describe('status and report', () => {
  const session = {
    currentTaskId: 't2',
    sideQuestLog: {
      ali: {
        t2: {
          0: { openedAt: 100, runs: 3, errorRuns: 1, done: true, doneAt: 150 },
          2: { openedAt: 200, runs: 1 },
        },
      },
    },
  }

  it('bumps a counter from nothing', () => {
    expect(bumpSideQuestCount(null)).toBe(1)
    expect(bumpSideQuestCount(4)).toBe(5)
  })

  it('gives the teacher card the open side-quest and the done ticks', () => {
    const student = { anonymousId: 'ali', sideQuestOpen: 2 }
    expect(sideQuestStatus({ student, session, task: codeTask() })).toEqual({
      open: 2,
      total: 3,
      done: 1,
    })
    expect(sideQuestStatus({ student: { anonymousId: 'bo' }, session, task: { id: 't9' } })).toBe(
      null
    )
  })

  it('reports each opened side-quest per task, with counts and the self-reported done', () => {
    expect(buildSideQuestReport(session.sideQuestLog.ali.t2, getSideQuests(codeTask()))).toEqual([
      {
        index: 0,
        title: 'Break it, then fix it',
        kind: 'debug',
        openedAt: 100,
        runs: 3,
        errorRuns: 1,
        done: true,
        doneAt: 150,
      },
      {
        index: 2,
        title: 'Mini challenge',
        kind: 'challenge',
        openedAt: 200,
        runs: 1,
        errorRuns: 0,
        done: false,
        doneAt: null,
      },
    ])
    expect(buildSideQuestReport(null)).toEqual([])
  })

  it('adds sideQuests to the session report and a per-task summary', () => {
    const lesson = { id: 'sq', type: 'python', title: 'Side-quests', tasks: [codeTask()] }
    const report = buildSessionReport({
      session: { ...session, students: { ali: { anonymousId: 'ali', displayName: 'Ali' } } },
      lesson,
    })
    const task = report.students[0].tasks.find((t) => t.taskId === 't2')
    expect(task.sideQuests.map((quest) => [quest.index, quest.done])).toEqual([
      [0, true],
      [2, false],
    ])
    expect(report.taskSummary[0]).toMatchObject({ sideQuestStudentCount: 1, sideQuestDoneCount: 1 })
  })

  it('turns Done side-quests into badge timeline events', () => {
    const lesson = { id: 'sq', type: 'python', title: 'Side-quests', tasks: [codeTask()] }
    const timelines = buildLiveTimelines({
      session: { ...session, students: { ali: { anonymousId: 'ali' } } },
      lesson,
    })
    expect(timelines.ali.filter((e) => e.type === 'side_quest_done')).toEqual([
      { type: 'side_quest_done', context: 'task', taskId: 't2', index: 0, at: 150 },
    ])
  })
})
