import { describe, expect, it, vi } from 'vitest'
import { defineActivity } from '../../../activities/defineActivity.js'
import {
  buildCarryInboxEntry,
  carryStarterUpdates,
  carryWaitingStudentIds,
  collectCarryInboxRequests,
  crossLessonSourceIds,
  getCrossLessonCarry,
  listCrossLessonCarryTasks,
  readCarryInboxEntry,
  resolveCrossLessonCarry,
} from '../crossLessonCarry.js'
import {
  buildRosterWorkDoc,
  hashRosterWork,
  makeRosterSlotWorkId,
  readRosterWorkDoc,
} from '../rosterModel.js'
import {
  changedRosterWorkCandidates,
  collectRosterWorkCandidates,
  extractActivitySlotWork,
  markRosterWorkSeen,
} from '../rosterWorkChanges.js'

// A fake activity with a carry slot (the real one, station, lives in src/activities/station/).
const mocks = vi.hoisted(() => ({ fake: { current: null } }))
vi.mock('../../../activities/registry.pure.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getTaskActivity: (task) =>
      task?.activityType === 'carrydemo' ? mocks.fake.current : actual.getTaskActivity(task),
  }
})

const fake = defineActivity({
  id: 'carrydemo',
  label: 'Carry demo',
  category: 'computing',
  defaultTask: () => ({}),
  validateTask: () => ({ errors: [], warnings: [] }),
  initialState: () => ({ v: 1, scene: { parts: [] }, junk: 0 }),
  grade: () => ({ passed: true }),
  carrySlot: {
    id: 'demo',
    extract: (state) => (state.scene.parts.length ? { v: 1, scene: state.scene } : null),
    apply: (task, carried) => ({ v: 1, scene: carried.scene, junk: 0 }),
  },
})
mocks.fake.current = fake

const SLOT_TASK = { id: 2, title: 'Build', taskType: 'activity', activityType: 'carrydemo' }
const lesson = {
  id: 'lesson-5',
  type: 'python',
  tasks: [{ id: 1, title: 'Code', starterCode: 'x' }, SLOT_TASK, { ...SLOT_TASK, id: 3 }],
}
const answer = (parts) => JSON.stringify({ v: 1, scene: { parts }, junk: 3 })

describe('makeRosterSlotWorkId', () => {
  it('is the fixed id slot__<slotId>, for a lowercase identifier only', () => {
    expect(makeRosterSlotWorkId('station')).toBe('slot__station')
    expect(makeRosterSlotWorkId('a_1')).toBe('slot__a_1')
    expect(makeRosterSlotWorkId('Station')).toBeNull()
    expect(makeRosterSlotWorkId('a/b')).toBeNull()
    expect(makeRosterSlotWorkId('')).toBeNull()
    expect(makeRosterSlotWorkId(null)).toBeNull()
  })
})

describe('activity_slot roster work', () => {
  const work = {
    kind: 'activity_slot',
    slotId: 'demo',
    state: { v: 1, scene: { parts: [[1, 2]] } },
  }

  it('round-trips through the Firestore document, inline and chunked', () => {
    const meta = { moduleType: 'activity', sourceLessonId: 'lesson-5', sourceTaskId: 2 }
    const inline = buildRosterWorkDoc(work, meta)
    expect(inline.chunks).toEqual([])
    expect(typeof inline.doc.slotState).toBe('string')
    expect(readRosterWorkDoc(inline.doc)).toMatchObject(work)

    const chunked = buildRosterWorkDoc(work, meta, { inlineMax: 10, chunkSize: 20 })
    expect(chunked.chunks.length).toBeGreaterThan(1)
    expect(readRosterWorkDoc(chunked.doc, chunked.chunks)).toMatchObject(work)
  })

  it('hashes by content, so an unchanged state is not saved again', () => {
    expect(hashRosterWork(work)).toBe(hashRosterWork({ ...work }))
    expect(hashRosterWork(work)).not.toBe(
      hashRosterWork({ ...work, state: { v: 1, scene: { parts: [] } } })
    )
  })

  it('reads nothing from a malformed document', () => {
    expect(readRosterWorkDoc({ kind: 'activity_slot', slotId: 'demo', chunkCount: 0 })).toBeNull()
  })
})

describe('extractActivitySlotWork', () => {
  it("extracts the slot's state from the mirrored answer", () => {
    expect(extractActivitySlotWork(fake, SLOT_TASK, answer([[1]]))).toEqual({
      kind: 'activity_slot',
      slotId: 'demo',
      state: { v: 1, scene: { parts: [[1]] } },
    })
  })

  it('returns null when there is nothing to save', () => {
    expect(extractActivitySlotWork(fake, SLOT_TASK, answer([]))).toBeNull()
    expect(extractActivitySlotWork(fake, SLOT_TASK, '')).toBeNull()
    expect(extractActivitySlotWork(fake, SLOT_TASK, undefined)).toBeNull()
    expect(extractActivitySlotWork({ carrySlot: null }, SLOT_TASK, answer([[1]]))).toBeNull()
  })
})

describe('collectRosterWorkCandidates: slot tasks', () => {
  const session = (student = {}, extra = {}) => ({
    state: 'active',
    currentTaskId: 2,
    students: { a: { currentAnswer: answer([[1]]), ...student } },
    ...extra,
  })
  const collect = (sess, matches = { a: 'r1' }) =>
    collectRosterWorkCandidates({ session: sess, lesson, lessonId: 'lesson-5', matches })

  it("offers the matched student's state under the fixed slot work id", () => {
    const [candidate] = collect(session())
    expect(candidate).toMatchObject({
      key: 'a:slot:demo',
      origin: 'slot',
      moduleType: 'activity',
      workId: 'slot__demo',
      sourceLessonId: 'lesson-5',
      sourceTaskId: 2,
      taskId: 2,
    })
    expect(candidate.extract()).toEqual({
      kind: 'activity_slot',
      slotId: 'demo',
      state: { v: 1, scene: { parts: [[1]] } },
    })
  })

  it('uses the same key on every slot task, so the latest one wins', () => {
    const [first] = collect(session())
    const [second] = collect(session({}, { currentTaskId: 3 }))
    expect(second.key).toBe(first.key)
    expect(second.workId).toBe(first.workId)
  })

  it('is quiet for unmatched students, no state yet, sandboxes, ended sessions and other tasks', () => {
    expect(collect(session(), {})).toEqual([])
    expect(collect(session({ currentAnswer: undefined }))).toEqual([])
    expect(collect(session({ inPersonalSandbox: true }))).toEqual([])
    expect(collect(session({}, { state: 'ended' }))).toEqual([])
    expect(collect(session({}, { currentTaskId: 1 }))).toEqual([])
  })

  it('reports a change only when the state changes', () => {
    const seen = new Map()
    const first = collect(session())
    expect(changedRosterWorkCandidates(first, seen)).toHaveLength(1)
    markRosterWorkSeen(seen, first[0])
    expect(changedRosterWorkCandidates(collect(session()), seen)).toHaveLength(0)
    const next = collect(session({ currentAnswer: answer([[1], [2]]) }))
    expect(changedRosterWorkCandidates(next, seen)).toHaveLength(1)
  })
})

describe('activity slot carry (tutor and student helpers)', () => {
  it('is a carry with kind activity_slot and no source lesson', () => {
    expect(getCrossLessonCarry(lesson, SLOT_TASK)).toEqual({
      field: 'carrySlot',
      kind: 'activity_slot',
      moduleType: 'activity',
      slotId: 'demo',
      slotWorkId: 'slot__demo',
      sourceLessonId: null,
      sourceTaskId: null,
    })
    expect(getCrossLessonCarry(lesson, lesson.tasks[0])).toBeNull()
    expect(listCrossLessonCarryTasks(lesson).map((c) => c.taskId)).toEqual([2, 3])
    expect(crossLessonSourceIds(lesson)).toEqual([])
  })

  it('has no carry for an activity without a slot', () => {
    expect(
      getCrossLessonCarry(lesson, { id: 9, taskType: 'activity', activityType: 'binary' })
    ).toBeNull()
  })

  it('asks the tutor to fill the inbox for each matched, joined student with no status', () => {
    const session = {
      state: 'active',
      students: { a: {}, b: {} },
      carryStatus: { b: { 2: { status: 'none' } } },
    }
    const requests = collectCarryInboxRequests({
      session,
      lesson,
      matches: { a: 'r1', b: 'r2', c: 'r3' },
    })
    expect(requests.map((r) => [r.key, r.kind, r.slotId])).toEqual([
      ['a:2:r1', 'activity_slot', 'demo'],
      ['a:3:r1', 'activity_slot', 'demo'],
      ['b:3:r2', 'activity_slot', 'demo'],
    ])
  })

  it('builds and reads the inbox entry for a saved slot', () => {
    const work = {
      kind: 'activity_slot',
      slotId: 'demo',
      state: { v: 1, scene: { parts: [] } },
      sourceLessonId: 'lesson-4',
      sourceTaskId: '2',
    }
    const { entry } = buildCarryInboxEntry(work, { kind: 'activity_slot' })
    expect(entry.kind).toBe('activity_slot')
    expect(typeof entry.payload).toBe('string')
    expect(readCarryInboxEntry(entry, 'activity_slot')).toEqual({
      kind: 'activity_slot',
      slotId: 'demo',
      state: work.state,
    })
    expect(readCarryInboxEntry(entry, 'code')).toBeNull()
    expect(buildCarryInboxEntry(work, { kind: 'code' })).toEqual({ error: 'kind' })
    expect(
      readCarryInboxEntry({ kind: 'activity_slot', payload: '{"state":1}' }, 'activity_slot')
    ).toBeNull()
  })

  it('resolves like any carry: hold, the tutor status, and never waiting off a live class', () => {
    const carry = getCrossLessonCarry(lesson, SLOT_TASK)
    const base = { carry, live: true, classSource: 'session', status: null, hasOwnWork: false }
    expect(resolveCrossLessonCarry(base)).toBe('hold')
    expect(resolveCrossLessonCarry({ ...base, status: { status: 'found' } })).toBe('found')
    expect(resolveCrossLessonCarry({ ...base, status: { status: 'none' } })).toBe('none')
    expect(resolveCrossLessonCarry({ ...base, status: { status: 'starter' } })).toBe('starter')
    expect(resolveCrossLessonCarry({ ...base, hasOwnWork: true })).toBe('own')
    expect(resolveCrossLessonCarry({ ...base, live: false })).toBe('solo')
    expect(resolveCrossLessonCarry({ ...base, classSource: 'none' })).toBe('no_class')
  })

  it('lets the tutor see who waits and use the starter', () => {
    const session = { state: 'active', currentTaskId: 2, students: { a: {}, b: {} } }
    expect(carryWaitingStudentIds({ session, lesson, classSource: 'session' })).toEqual(['a', 'b'])
    const updates = carryStarterUpdates({ session, lesson, anonymousIds: ['a'], by: 't', at: 5 })
    expect(Object.keys(updates)).toEqual(['carryStatus/a/2', 'carryStatus/a/3'])
    expect(updates['carryStatus/a/2']).toMatchObject({ status: 'starter', sourceLessonId: '' })
  })
})
