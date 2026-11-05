import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({ calls: [], snapshot: null }))

vi.mock('../../../shared/firebase', () => ({ firestore: { app: 'test' } }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...segments) => ({ path: segments.join('/') }),
  doc: (_db, ...segments) => ({ path: segments.join('/') }),
  query: (ref, ...clauses) => ({ ...ref, clauses }),
  where: (field, op, value) => ({ field, op, value }),
  limit: (n) => ({ limit: n }),
  serverTimestamp: () => 'SERVER_TIME',
  addDoc: vi.fn(async (ref, data) => {
    fs.calls.push({ op: 'add', path: ref.path, data })
    return { id: 'n1' }
  }),
  updateDoc: vi.fn(async (ref, data) => fs.calls.push({ op: 'update', path: ref.path, data })),
  deleteDoc: vi.fn(async (ref) => fs.calls.push({ op: 'delete', path: ref.path })),
  getDocs: vi.fn(async (q) => {
    fs.calls.push({ op: 'getDocs', path: q.path, clauses: q.clauses })
    return { docs: fs.snapshot }
  }),
  onSnapshot: vi.fn((ref, next) => {
    fs.calls.push({ op: 'onSnapshot', path: ref.path, clauses: ref.clauses })
    next({ docs: fs.snapshot })
    return () => {}
  }),
}))

import {
  canChangeReviewNote,
  checkReviewNoteText,
  latestReviewNoteStatus,
  normaliseReviewNote,
  notesForTask,
  reviewNoteStatusLabel,
  reviewNoteTagLabel,
} from '../reviewNotes'
import {
  addReviewNote,
  deleteReviewNote,
  listTaskReviewNotes,
  REVIEW_NOTES_PER_TASK_LIMIT,
  subscribeReviewNotes,
  updateReviewNote,
} from '../reviewNotesService'

const snapDoc = (id, data) => ({ id, data: () => data })

beforeEach(() => {
  fs.calls = []
  fs.snapshot = []
})

describe('review note helpers', () => {
  it('normalises Firestore timestamps and unknown statuses', () => {
    const note = normaliseReviewNote({
      id: 'a',
      taskId: 3,
      text: 'Hi',
      status: 'weird',
      createdAt: { toMillis: () => 1000 },
      statusChangedAt: { seconds: 2 },
    })
    expect(note).toMatchObject({
      id: 'a',
      taskId: 3,
      status: 'new',
      createdAt: 1000,
      statusChangedAt: 2000,
      tag: null,
    })
    expect(normaliseReviewNote({ id: 'b', createdAt: null }).createdAt).toBeNull()
  })

  it('picks one task oldest first, with an unconfirmed save last, and its newest status', () => {
    const notes = [
      { id: 'c', taskId: 3, createdAt: null, status: 'new' },
      { id: 'a', taskId: '3', createdAt: 10, status: 'done' },
      { id: 'b', taskId: 3, createdAt: 20, status: 'picked_up' },
      { id: 'x', taskId: 4, createdAt: 5, status: 'new' },
    ]
    const task3 = notesForTask(notes, 3)
    expect(task3.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(latestReviewNoteStatus(task3)).toBe('new')
    expect(latestReviewNoteStatus(notesForTask(notes, 9))).toBeNull()
  })

  it('lets only the writer change a note, and only while it is New', () => {
    expect(canChangeReviewNote({ status: 'new', createdBy: 'u1' }, 'u1')).toBe(true)
    expect(canChangeReviewNote({ status: 'new', createdBy: 'u1' }, 'u2')).toBe(false)
    expect(canChangeReviewNote({ status: 'picked_up', createdBy: 'u1' }, 'u1')).toBe(false)
    expect(canChangeReviewNote({ status: 'new', createdBy: 'u1' }, null)).toBe(false)
  })

  it('checks the text is 1 to 500 characters after trimming', () => {
    expect(checkReviewNoteText('  hi  ')).toEqual({ text: 'hi' })
    expect(checkReviewNoteText('   ').error).toMatch(/Type a note/)
    expect(checkReviewNoteText('x'.repeat(501)).error).toMatch(/500/)
    expect(checkReviewNoteText('x'.repeat(500)).text).toHaveLength(500)
  })

  it('labels statuses and tags', () => {
    expect(reviewNoteStatusLabel('picked_up')).toBe('Picked up')
    expect(reviewNoteStatusLabel(undefined)).toBe('New')
    expect(reviewNoteTagLabel('too_long')).toBe('Too long')
    expect(reviewNoteTagLabel(null)).toBeNull()
  })
})

describe('review notes service', () => {
  it('writes a New note under lessons/{id}/reviewNotes with server times', async () => {
    const id = await addReviewNote('L', {
      taskId: 3,
      lessonVersion: 7,
      text: 'Hint gives the answer away',
      tag: 'wrong',
      createdBy: 'admin-1',
    })
    expect(id).toBe('n1')
    expect(fs.calls).toEqual([
      {
        op: 'add',
        path: 'lessons/L/reviewNotes',
        data: {
          lessonId: 'L',
          taskId: 3,
          lessonVersion: 7,
          text: 'Hint gives the answer away',
          tag: 'wrong',
          status: 'new',
          createdAt: 'SERVER_TIME',
          statusChangedAt: 'SERVER_TIME',
          createdBy: 'admin-1',
        },
      },
    ])
  })

  it('edits only text and tag, and deletes by id', async () => {
    await updateReviewNote('L', 'n1', { text: 'New words', tag: undefined })
    await deleteReviewNote('L', 'n1')
    expect(fs.calls).toEqual([
      { op: 'update', path: 'lessons/L/reviewNotes/n1', data: { text: 'New words', tag: null } },
      { op: 'delete', path: 'lessons/L/reviewNotes/n1' },
    ])
  })

  it('streams normalised notes for one task only (taskId filter, capped, no orderBy index)', () => {
    fs.snapshot = [snapDoc('n1', { taskId: 3, text: 'A', status: 'new', createdAt: 5 })]
    const seen = []
    subscribeReviewNotes('L', 3, (notes) => seen.push(notes))
    expect(fs.calls[0]).toMatchObject({ op: 'onSnapshot', path: 'lessons/L/reviewNotes' })
    const [taskFilter, cap, ...rest] = fs.calls[0].clauses
    expect(taskFilter).toMatchObject({ field: 'taskId', op: 'in' })
    expect(taskFilter.value).toEqual(expect.arrayContaining([3, '3']))
    expect(cap).toEqual({ limit: REVIEW_NOTES_PER_TASK_LIMIT })
    expect(rest).toEqual([])
    expect(seen[0][0]).toMatchObject({ id: 'n1', taskId: 3, text: 'A', createdAt: 5 })
  })

  it('lists one task newest first for the Builder, matching text or number ids', async () => {
    fs.snapshot = [
      snapDoc('old', { taskId: 3, text: 'Old', createdAt: 1 }),
      snapDoc('new', { taskId: 3, text: 'New', createdAt: 9 }),
    ]
    const notes = await listTaskReviewNotes('L', 3)
    expect(notes.map((n) => n.id)).toEqual(['new', 'old'])
    expect(fs.calls[0].clauses[0]).toMatchObject({ field: 'taskId', op: 'in' })
    expect(fs.calls[0].clauses[0].value).toEqual(expect.arrayContaining([3, '3']))
  })
})
