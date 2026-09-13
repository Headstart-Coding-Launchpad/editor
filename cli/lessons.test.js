import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ records: new Map(), set: vi.fn(), deleted: [] }))

function mockCollection(path) {
  return {
    doc: (id) => ({
      get: async () => {
        const data = state.records.get(`${path}/${id}`)
        return { exists: data != null, id, data: () => data }
      },
      set: async (value) => {
        state.set(path, id, value)
        state.records.set(`${path}/${id}`, value)
      },
      delete: async () => {
        state.deleted.push(`${path}/${id}`)
        state.records.delete(`${path}/${id}`)
      },
      collection: (child) => mockCollection(`${path}/${id}/${child}`),
    }),
    get: async () => {
      const prefix = `${path}/`
      const docs = [...state.records.keys()]
        .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map((key) => ({
          id: key.slice(prefix.length),
          data: () => state.records.get(key),
          ref: { delete: async () => state.deleted.push(key) && state.records.delete(key) },
        }))
      return { docs, size: docs.length }
    },
  }
}

vi.mock('./firebase.mjs', () => ({
  db: { collection: (name) => mockCollection(name) },
}))

import { deleteLesson, getLesson, publishYamlLesson, upsertLesson } from './lessons.mjs'

const draft = {
  id: 'cli-draft',
  type: 'python',
  title: 'CLI draft',
  description: 'In progress',
  draft: true,
  tasks: [{ id: 41, title: 'First task', intent: 'Create a simple variable.' }],
}

describe('CLI draft lesson upsert', () => {
  beforeEach(() => {
    state.records.clear()
    state.set.mockReset()
    state.deleted.length = 0
  })

  it('creates and updates an incomplete YAML-shaped draft while preserving task identity and audit fields', async () => {
    const created = await upsertLesson(draft)
    expect(created).toMatchObject({ success: true, version: 1, noOp: false })
    const stored = state.records.get('lessons/cli-draft')
    expect(stored).toMatchObject({
      draft: true,
      version: 1,
      tasks: [{ id: 41, intent: draft.tasks[0].intent }],
    })

    const updated = await upsertLesson({
      ...draft,
      tasks: [{ ...draft.tasks[0], intent: 'Create and print a simple variable.' }],
    })
    expect(updated).toMatchObject({ success: true, version: 2, noOp: false })
    const changed = state.records.get('lessons/cli-draft').tasks[0]
    expect(changed.id).toBe(41)
    expect(changed.intentLastChangedAt).toEqual(expect.any(String))
    expect(changed.taskLastChangedAt).toBe(stored.tasks[0].taskLastChangedAt)
  })

  it('does not write a new version for a no-op upsert', async () => {
    await upsertLesson(draft)
    const result = await upsertLesson(draft)
    expect(result).toMatchObject({ success: true, version: 1, noOp: true })
    expect(state.set).toHaveBeenCalledTimes(1)
  })

  it('refuses final publishing while a lesson remains a draft', async () => {
    const yaml = `
id: cli-draft
type: python
title: CLI draft
description: In progress
draft: true
tasks:
  - title: First task
    intent: Create a simple variable.
`
    const result = await publishYamlLesson(yaml)
    expect(result.success).toBe(false)
    expect(result.errors).toContain(
      'Draft lessons cannot be published. Clear draft only after full validation passes.'
    )
    expect(state.set).not.toHaveBeenCalled()
  })
})

describe('CLI lesson Firestore encoding', () => {
  beforeEach(() => {
    state.records.clear()
    state.set.mockReset()
    state.deleted.length = 0
  })

  // Deep enough that a raw object tree would exceed Firestore's 20-level nesting cap.
  function deepBlocks(depth) {
    let block = { type: 'motion_movesteps', fields: { STEPS: 10 } }
    for (let i = 0; i < depth; i++) block = { type: 'motion_movesteps', next: { block } }
    return { blocks: { languageVersion: 0, blocks: [block] } }
  }

  const scratchLesson = {
    id: 'deep-scratch',
    type: 'composed',
    title: 'Deep Scratch',
    description: 'A long script',
    tasks: [{ id: 1, moduleType: 'scratch', title: 'Move', starterBlocks: deepBlocks(30) }],
  }

  it('stores Scratch block trees as JSON strings, like the web app', async () => {
    const result = await upsertLesson(scratchLesson)
    expect(result.success).toBe(true)
    const stored = state.records.get('lessons/deep-scratch')
    expect(typeof stored.tasks[0].starterBlocks).toBe('string')
    expect(JSON.parse(stored.tasks[0].starterBlocks)).toEqual(scratchLesson.tasks[0].starterBlocks)
  })

  it('decodes stored block strings on read, so re-publishing unchanged work is a no-op', async () => {
    await upsertLesson(scratchLesson)
    const read = await getLesson('deep-scratch')
    expect(read.tasks[0].starterBlocks).toEqual(scratchLesson.tasks[0].starterBlocks)

    const republished = await upsertLesson(scratchLesson)
    expect(republished).toMatchObject({ success: true, noOp: true })
    expect(state.set).toHaveBeenCalledTimes(1)
  })

  it('clears session reports and feedback when deleting a lesson, like the web app', async () => {
    await upsertLesson(scratchLesson)
    state.records.set('lessons/deep-scratch/sessionReports/r1', { id: 'r1' })
    state.records.set('lessons/deep-scratch/feedback/f1', { id: 'f1' })

    const result = await deleteLesson('deep-scratch')

    expect(result).toMatchObject({
      success: true,
      cleared: { reportsDeleted: 1, feedbackDeleted: 1 },
    })
    expect(state.deleted).toEqual(
      expect.arrayContaining([
        'lessons/deep-scratch/sessionReports/r1',
        'lessons/deep-scratch/feedback/f1',
        'lessons/deep-scratch',
      ])
    )
  })
})
