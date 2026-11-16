// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Egress guard: full-collection reads of `lessons` must project to the fields they use.
const state = vi.hoisted(() => ({ lessons: new Map(), selects: [], fullReads: 0 }))

function project(data, fields) {
  if (!fields) return data
  const out = {}
  for (const f of fields) if (f in data) out[f] = data[f]
  return out
}

function query(fields) {
  return {
    select: (...f) => {
      state.selects.push(f)
      return query(f)
    },
    get: async () => {
      if (!fields) state.fullReads += 1
      const docs = [...state.lessons].map(([id, data]) => ({
        id,
        data: () => project(data, fields),
      }))
      return { docs, size: docs.length }
    },
  }
}

vi.mock('./firebase.mjs', () => ({
  db: {
    collection: (name) =>
      name === 'lessons'
        ? {
            ...query(null),
            doc: (id) => ({
              get: async () => {
                const data = state.lessons.get(id)
                return { exists: data != null, id, data: () => data }
              },
            }),
          }
        : { get: async () => ({ docs: [] }) },
  },
}))

import { linkSoloCompanions, listLessonForks, listLessons } from './lessons.mjs'

const task = { id: 1, type: 'code', title: 'T', bigCode: 'x'.repeat(100) }

beforeEach(() => {
  state.lessons.clear()
  state.selects.length = 0
  state.fullReads = 0
  state.lessons.set('a', { title: 'A', type: 'python', tasks: [task] })
  state.lessons.set('a-solo', { title: 'A solo', type: 'python', tasks: [task] })
  state.lessons.set('b-solo', { title: 'B solo', tasks: [task] })
  state.lessons.set('c-solo', { title: 'C', companionOf: 'c', tasks: [task] })
  state.lessons.set('f2', {
    title: 'F2',
    type: 'python',
    tasks: [task, task],
    fork: { sourceLessonId: 'a', classId: 'k2', className: 'Zed' },
  })
  state.lessons.set('f1', {
    title: 'F1',
    type: 'python',
    tasks: [task],
    fork: { sourceLessonId: 'a', classId: 'k1', className: 'Alpha' },
  })
})

describe('lessons collection reads select only what they need', () => {
  it('linkSoloCompanions selects companionOf and keeps its output', async () => {
    const result = await linkSoloCompanions()
    expect(state.fullReads).toBe(0)
    expect(state.selects).toContainEqual(['companionOf'])
    expect(result).toEqual({
      applied: false,
      linked: [{ id: 'a-solo', companionOf: 'a' }],
      alreadyLinked: [{ id: 'c-solo', companionOf: 'c' }],
      orphaned: [{ id: 'b-solo' }],
    })
  })

  it('listLessonForks selects fork for the scan and keeps its output', async () => {
    const result = await listLessonForks('a')
    expect(state.fullReads).toBe(0)
    expect(state.selects).toContainEqual(['fork'])
    expect(result).toEqual([
      {
        id: 'f1',
        title: 'F1',
        type: 'python',
        flatTaskCount: 1,
        sourceLessonId: 'a',
        classId: 'k1',
        className: 'Alpha',
      },
      {
        id: 'f2',
        title: 'F2',
        type: 'python',
        flatTaskCount: 2,
        sourceLessonId: 'a',
        classId: 'k2',
        className: 'Zed',
      },
    ])
  })

  it('listLessons --light selects no tasks and returns only the six columns', async () => {
    state.lessons.get('c-solo').levelId = 'lv1'
    const rows = await listLessons({ light: true })
    expect(state.fullReads).toBe(0)
    expect(state.selects).toHaveLength(1)
    expect(state.selects[0]).not.toContain('tasks')
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(Object.keys(row)).toEqual([
        'id',
        'title',
        'draft',
        'version',
        'levelId',
        'companionOf',
      ])
    }
    expect(rows.find((r) => r.id === 'c-solo')).toMatchObject({ levelId: 'lv1', companionOf: 'c' })
  })

  it('default listLessons still reads full docs with taskCount', async () => {
    const rows = await listLessons()
    expect(state.fullReads).toBe(1)
    expect(rows.find((r) => r.id === 'f2')).toMatchObject({ taskCount: 2 })
  })
})
