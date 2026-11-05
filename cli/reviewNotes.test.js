// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ records: new Map(), updates: [] }))

function mockCollection(path) {
  return {
    doc: (id) => ({
      get: async () => {
        const data = state.records.get(`${path}/${id}`)
        return { exists: data != null, id, data: () => data }
      },
      update: async (patch) => {
        state.updates.push({ path: `${path}/${id}`, patch })
        state.records.set(`${path}/${id}`, { ...state.records.get(`${path}/${id}`), ...patch })
      },
      collection: (child) => mockCollection(`${path}/${id}/${child}`),
    }),
    get: async () => {
      const prefix = `${path}/`
      const docs = [...state.records.keys()]
        .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map((key) => ({ id: key.slice(prefix.length), data: () => state.records.get(key) }))
      return { docs, size: docs.length }
    },
  }
}

vi.mock('./firebase.mjs', () => ({ db: { collection: (name) => mockCollection(name) } }))

import {
  checkStatusMove,
  listReviewNotes,
  setReviewNoteStatus,
  summariseReviewNotes,
} from './reviewNotes.mjs'

const ts = (iso) => ({ toDate: () => new Date(iso) })
const P = 'lessons/L/reviewNotes'

beforeEach(() => {
  state.records.clear()
  state.updates.length = 0
  state.records.set(`${P}/b`, {
    lessonId: 'L',
    taskId: 3,
    lessonVersion: 7,
    text: 'Swap 2 and 3',
    tag: null,
    status: 'new',
    createdAt: ts('2026-11-05T10:00:00Z'),
    statusChangedAt: ts('2026-11-05T10:00:00Z'),
    createdBy: 'admin-1',
  })
  state.records.set(`${P}/a`, {
    lessonId: 'L',
    taskId: 3,
    lessonVersion: 6,
    text: 'Hint gives the answer away',
    tag: 'wrong',
    status: 'picked_up',
    createdAt: ts('2026-11-04T09:00:00Z'),
    statusChangedAt: ts('2026-11-05T11:00:00Z'),
    createdBy: 'admin-2',
  })
})

describe('lessons notes', () => {
  it('lists every note oldest first with ISO times', async () => {
    const notes = await listReviewNotes('L')
    expect(notes.map((n) => n.noteId)).toEqual(['a', 'b'])
    expect(notes[0]).toEqual({
      noteId: 'a',
      lessonId: 'L',
      taskId: 3,
      lessonVersion: 6,
      text: 'Hint gives the answer away',
      tag: 'wrong',
      status: 'picked_up',
      createdAt: '2026-11-04T09:00:00.000Z',
      statusChangedAt: '2026-11-05T11:00:00.000Z',
      createdBy: 'admin-2',
    })
  })

  it('filters by --since and --status', async () => {
    expect((await listReviewNotes('L', { since: '2026-11-05' })).map((n) => n.noteId)).toEqual([
      'b',
    ])
    expect((await listReviewNotes('L', { status: 'picked_up' })).map((n) => n.noteId)).toEqual([
      'a',
    ])
    expect(() => summariseReviewNotes([], { since: 'yesterday' })).toThrow(/ISO date/)
    expect(() => summariseReviewNotes([], { status: 'open' })).toThrow(/new, picked_up, done/)
  })

  it('moves a note forward and records when', async () => {
    const note = await setReviewNoteStatus('L', 'b', 'picked_up')
    expect(note).toMatchObject({ noteId: 'b', status: 'picked_up' })
    expect(Date.parse(note.statusChangedAt)).toBeGreaterThan(Date.parse('2026-11-05T10:00:00Z'))
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0].patch.status).toBe('picked_up')
    expect(state.updates[0].patch.statusChangedAt).toBeInstanceOf(Date)
    await setReviewNoteStatus('L', 'b', 'done')
    expect(state.records.get(`${P}/b`).status).toBe('done')
  })

  it('never goes backwards, refuses unknown ids and statuses, and a repeat is a no-op', async () => {
    await expect(setReviewNoteStatus('L', 'a', 'new')).rejects.toThrow(/picked_up or done/)
    await setReviewNoteStatus('L', 'a', 'done')
    await expect(setReviewNoteStatus('L', 'a', 'picked_up')).rejects.toThrow(/cannot go back/)
    await expect(setReviewNoteStatus('L', 'zzz', 'done')).rejects.toThrow(/No review note 'zzz'/)
    state.updates.length = 0
    const same = await setReviewNoteStatus('L', 'a', 'done')
    expect(same.status).toBe('done')
    expect(state.updates).toHaveLength(0)
    expect(checkStatusMove('new', 'done')).toBe(true)
  })
})
