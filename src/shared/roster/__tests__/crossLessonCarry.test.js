import { describe, expect, it } from 'vitest'
import {
  buildCarryInboxEntry,
  CARRY_INBOX_MAX_CHARS,
  carryStarterUpdates,
  carryWaitingStudentIds,
  collectCarryInboxRequests,
  CROSS_LESSON_CARRY_FIELDS,
  crossLessonCarryField,
  crossLessonCarryReportFields,
  crossLessonCarrySourceWarnings,
  crossLessonFallbackReason,
  crossLessonFallbackRecord,
  crossLessonSourceIds,
  getCrossLessonCarry,
  makeCarryStatus,
  normaliseCarrySpec,
  readCarryInboxEntry,
  resolveCrossLessonCarry,
  summarizeCrossLessonCarry,
} from '../crossLessonCarry.js'
import { getModuleDefinition } from '../../../modules/definitions.js'
import { validateLessonCore } from '../../lessonValidation.js'

const lesson12 = {
  id: 'python-1-12',
  type: 'python',
  title: 'Final project, part 2',
  description: 'Two-lesson project',
  tasks: [
    { id: 1, title: 'Recap', taskType: 'information', explainer: 'Hi' },
    {
      id: 2,
      title: 'Carry on building',
      starterCode: 'print("start")',
      check: [],
      carryCodeFromLesson: { lesson: 'python-1-11', task: 5 },
    },
    { id: 3, title: 'Extend', starterCode: '', check: [], carryCodeFrom: 2 },
  ],
}

function session(overrides = {}) {
  return {
    state: 'active',
    currentTaskId: 2,
    students: { a: { displayName: 'Ann' }, b: { displayName: 'Ben' }, c: { displayName: 'Cat' } },
    ...overrides,
  }
}

describe('cross-lesson carry fields', () => {
  it('derives the field from the module carry field, only for modules that save roster work', () => {
    expect(crossLessonCarryField(getModuleDefinition('python'))).toBe('carryCodeFromLesson')
    expect(crossLessonCarryField(getModuleDefinition('html'))).toBe('carryCodeFromLesson')
    expect(crossLessonCarryField(getModuleDefinition('scratch'))).toBe('carryBlocksFromLesson')
    expect(crossLessonCarryField(getModuleDefinition('filesystem'))).toBeNull()
    expect(CROSS_LESSON_CARRY_FIELDS).toEqual(
      expect.arrayContaining(['carryCodeFromLesson', 'carryBlocksFromLesson'])
    )
  })

  it('normalises { lesson, task }', () => {
    expect(normaliseCarrySpec({ lesson: ' python-1-11 ', task: 5 })).toEqual({
      lesson: 'python-1-11',
      task: 5,
    })
    expect(normaliseCarrySpec({ lesson: 'x', task: 'build' })).toEqual({
      lesson: 'x',
      task: 'build',
    })
    expect(normaliseCarrySpec({ lesson: '', task: 5 })).toBeNull()
    expect(normaliseCarrySpec({ lesson: 'x' })).toBeNull()
    expect(normaliseCarrySpec('python-1-11')).toBeNull()
  })

  it('reads a task carry by its module, ignoring other modules’ fields', () => {
    expect(getCrossLessonCarry(lesson12, lesson12.tasks[1])).toEqual({
      field: 'carryCodeFromLesson',
      kind: 'code',
      moduleType: 'python',
      sourceLessonId: 'python-1-11',
      sourceTaskId: 5,
    })
    expect(getCrossLessonCarry(lesson12, lesson12.tasks[0])).toBeNull()
    const scratchLesson = {
      type: 'scratch',
      tasks: [{ id: 1, carryCodeFromLesson: { lesson: 's-1', task: 1 } }],
    }
    expect(getCrossLessonCarry(scratchLesson, scratchLesson.tasks[0])).toBeNull()
    scratchLesson.tasks[0].carryBlocksFromLesson = { lesson: 's-1', task: 1 }
    expect(getCrossLessonCarry(scratchLesson, scratchLesson.tasks[0])?.kind).toBe('blocks')
  })
})

describe('carry inbox entries', () => {
  it('round-trips code, files and blocks as one JSON payload', () => {
    const works = [
      { kind: 'code', code: 'print(1)' },
      { kind: 'files', files: [{ name: 'index.html', content: '<h1>Hi</h1>' }] },
      { kind: 'blocks', scratchState: { sprites: [], vars: [] } },
    ]
    for (const work of works) {
      const { entry } = buildCarryInboxEntry(work, { sourceLessonId: 'l', sourceTaskId: 5 })
      expect(entry.kind).toBe(work.kind)
      expect(entry.sourceTaskId).toBe('5')
      expect(readCarryInboxEntry(entry, work.kind)).toEqual(work)
    }
  })

  it('refuses empty, wrong-kind and oversized work', () => {
    expect(buildCarryInboxEntry(null)).toEqual({ error: 'empty' })
    expect(buildCarryInboxEntry({ kind: 'code', code: 'x' }, { kind: 'blocks' })).toEqual({
      error: 'kind',
    })
    const big = { kind: 'code', code: 'x'.repeat(CARRY_INBOX_MAX_CHARS) }
    expect(buildCarryInboxEntry(big)).toEqual({ error: 'too_large' })
    expect(readCarryInboxEntry({ kind: 'code', payload: '{oops' }, 'code')).toBeNull()
    expect(readCarryInboxEntry({ kind: 'files', payload: '{"files":[]}' }, 'code')).toBeNull()
  })

  it('validates statuses', () => {
    expect(makeCarryStatus('found', { sourceLessonId: 'l', sourceTaskId: 5, at: 1 })).toEqual({
      status: 'found',
      sourceLessonId: 'l',
      sourceTaskId: '5',
      reason: null,
      rosterId: null,
      by: null,
      at: 1,
    })
    expect(() => makeCarryStatus('maybe')).toThrow()
  })
})

describe('resolveCrossLessonCarry (hold logic)', () => {
  const carry = getCrossLessonCarry(lesson12, lesson12.tasks[1])
  const live = { carry, live: true, classSource: 'fork', status: null, hasOwnWork: false }

  it('holds a live student with no status and no work of their own', () => {
    expect(resolveCrossLessonCarry(live)).toBe('hold')
    expect(resolveCrossLessonCarry({ ...live, classSource: 'unset' })).toBe('hold')
  })

  it('never holds without a carry, with own work, without a tutor, or with No class', () => {
    expect(resolveCrossLessonCarry({ ...live, carry: null })).toBe('off')
    expect(resolveCrossLessonCarry({ ...live, hasOwnWork: true })).toBe('own')
    expect(resolveCrossLessonCarry({ ...live, live: false })).toBe('solo')
    expect(resolveCrossLessonCarry({ ...live, classSource: 'none' })).toBe('no_class')
  })

  it('follows the tutor status', () => {
    for (const status of ['found', 'none', 'starter']) {
      expect(resolveCrossLessonCarry({ ...live, status: { status } })).toBe(status)
    }
    expect(resolveCrossLessonCarry({ ...live, status: { status: 'odd' } })).toBe('hold')
  })

  it('logs starter fallbacks with a reason, but not solo', () => {
    expect(crossLessonFallbackReason('none')).toBe('none')
    expect(crossLessonFallbackReason('no_class')).toBe('no_class')
    expect(crossLessonFallbackReason('solo')).toBeNull()
    expect(crossLessonFallbackReason('found')).toBeNull()
    expect(crossLessonFallbackRecord(2, carry, 'starter')).toEqual({
      taskId: 2,
      field: 'carryCodeFromLesson',
      crossLesson: true,
      reason: 'starter',
      sourceLessonId: 'python-1-11',
      sourceTaskId: 5,
    })
  })
})

describe('tutor side', () => {
  it('asks for each matched, joined student without a status', () => {
    const requests = collectCarryInboxRequests({
      session: session({ carryStatus: { b: { 2: { status: 'none' } } } }),
      lesson: lesson12,
      matches: { a: 'r1', b: 'r2', gone: 'r3' },
    })
    expect(requests).toEqual([
      expect.objectContaining({
        anonymousId: 'a',
        rosterId: 'r1',
        taskId: 2,
        kind: 'code',
        sourceLessonId: 'python-1-11',
        sourceTaskId: 5,
      }),
    ])
  })

  it('lists students waiting on the current carry task', () => {
    const s = session({ carryStatus: { a: { 2: { status: 'found' } } } })
    expect(carryWaitingStudentIds({ session: s, lesson: lesson12, classSource: 'fork' })).toEqual([
      'b',
      'c',
    ])
    expect(carryWaitingStudentIds({ session: s, lesson: lesson12, classSource: 'none' })).toEqual(
      []
    )
    expect(
      carryWaitingStudentIds({ session: { ...s, currentTaskId: 3 }, lesson: lesson12 })
    ).toEqual([])
  })

  it('writes "Use the starter" only where there is no status yet', () => {
    const updates = carryStarterUpdates({
      session: session({ carryStatus: { a: { 2: { status: 'found' } } } }),
      lesson: lesson12,
      anonymousIds: ['a', 'b'],
      by: 'tutor',
      at: 5,
    })
    expect(Object.keys(updates)).toEqual(['carryStatus/b/2'])
    expect(updates['carryStatus/b/2']).toMatchObject({ status: 'starter', by: 'tutor', at: 5 })
  })
})

describe('session report', () => {
  it('reports each outcome anonymously and counts them per task', () => {
    const s = session({
      carryStatus: {
        a: {
          2: { status: 'found', sourceLessonId: 'python-1-11', sourceTaskId: '5', rosterId: 'r1' },
        },
        b: { 2: { status: 'none', reason: 'not_saved' } },
      },
      carryFallbackLog: {
        c: { 2: { crossLesson: true, reason: 'no_class', sourceLessonId: 'python-1-11' } },
      },
    })
    const a = crossLessonCarryReportFields(s, 'a', 2)
    expect(a).toEqual({
      crossLessonCarry: { outcome: 'found', sourceLessonId: 'python-1-11', sourceTaskId: '5' },
    })
    expect(JSON.stringify(a)).not.toContain('r1')
    expect(crossLessonCarryReportFields(s, 'b', 2).crossLessonCarry).toMatchObject({
      outcome: 'none',
      reason: 'not_saved',
    })
    expect(crossLessonCarryReportFields(s, 'c', 2).crossLessonCarry.outcome).toBe('no_class')
    expect(crossLessonCarryReportFields(s, 'c', 3)).toEqual({})
    const perStudent = ['a', 'b', 'c'].map((id) => crossLessonCarryReportFields(s, id, 2))
    expect(summarizeCrossLessonCarry(perStudent)).toEqual({
      crossLessonCarryCounts: { found: 1, none: 1, no_class: 1 },
    })
    expect(summarizeCrossLessonCarry([{}])).toEqual({})
  })
})

describe('validation', () => {
  const errorsFor = (lesson) => validateLessonCore(lesson).errors

  it('accepts a valid carry', () => {
    expect(errorsFor(lesson12).filter((e) => e.includes('FromLesson'))).toEqual([])
  })

  it('rejects a bad shape, unknown keys and the wrong module field', () => {
    const task = lesson12.tasks[1]
    const withCarry = (value, field = 'carryCodeFromLesson') => ({
      ...lesson12,
      tasks: [lesson12.tasks[0], { ...task, carryCodeFromLesson: undefined, [field]: value }],
    })
    expect(errorsFor(withCarry({ lesson: 'python-1-11' }))).toContain(
      "Task 2 carryCodeFromLesson must be { lesson, task }: the earlier lesson's id and one of its task ids"
    )
    expect(errorsFor(withCarry({ lesson: 'python-1-11', task: 5, label: 'x' }))).toContain(
      'Task 2 carryCodeFromLesson has unknown fields: label'
    )
    expect(errorsFor(withCarry({ lesson: 'p', task: 1 }, 'carryBlocksFromLesson'))).toContain(
      'Task 2 carryBlocksFromLesson is not supported on this task; use carryCodeFromLesson'
    )
  })

  it('rejects naming this lesson and combining with in-lesson carry', () => {
    const task = lesson12.tasks[1]
    const self = {
      ...lesson12,
      tasks: [
        ...lesson12.tasks.slice(0, 1),
        { ...task, carryCodeFromLesson: { lesson: 'python-1-12', task: 1 } },
      ],
    }
    expect(errorsFor(self)).toContain(
      'Task 2 carryCodeFromLesson names this lesson; use carryCodeFrom to carry within a lesson'
    )
    const both = {
      ...lesson12,
      tasks: [
        { id: 1, title: 'One', starterCode: '', check: [] },
        { ...task, carryCodeFrom: 1 },
      ],
    }
    expect(errorsFor(both)).toContain(
      'Task 2 cannot use both carryCodeFromLesson and carryCodeFrom'
    )
  })

  it('rejects the field on information tasks', () => {
    const info = {
      ...lesson12,
      tasks: [{ ...lesson12.tasks[0], carryCodeFromLesson: { lesson: 'x', task: 1 } }],
    }
    expect(errorsFor(info)).toContain(
      'Task 1 carryCodeFromLesson is not supported on this task type'
    )
  })
})

describe('source warnings (CLI publish)', () => {
  it('warns softly about a missing lesson, a missing task, or another kind of work', () => {
    expect(crossLessonSourceIds(lesson12)).toEqual(['python-1-11'])
    expect(crossLessonCarrySourceWarnings(lesson12, new Map())).toEqual([])
    expect(crossLessonCarrySourceWarnings(lesson12, new Map([['python-1-11', null]]))).toEqual([
      'Task 2 carryCodeFromLesson: lesson python-1-11 was not found, so every student will start from the starter',
    ])
    const source = { id: 'python-1-11', type: 'python', tasks: [{ id: 4, starterCode: '' }] }
    expect(crossLessonCarrySourceWarnings(lesson12, new Map([['python-1-11', source]]))).toEqual([
      'Task 2 carryCodeFromLesson: lesson python-1-11 has no task 5',
    ])
    const scratchSource = { id: 'python-1-11', type: 'scratch', tasks: [{ id: 5 }] }
    expect(
      crossLessonCarrySourceWarnings(lesson12, new Map([['python-1-11', scratchSource]]))
    ).toEqual([
      'Task 2 carryCodeFromLesson: task 5 of lesson python-1-11 saves a different kind of work, so nothing will carry',
    ])
    const good = { id: 'python-1-11', type: 'python', tasks: [{ id: 5, starterCode: '' }] }
    expect(crossLessonCarrySourceWarnings(lesson12, new Map([['python-1-11', good]]))).toEqual([])
  })
})
