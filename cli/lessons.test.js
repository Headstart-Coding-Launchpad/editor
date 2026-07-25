import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ records: new Map(), set: vi.fn() }))

vi.mock('./firebase.mjs', () => ({
  db: {
    collection: name => ({
      doc: id => ({
        get: async () => {
          const data = state.records.get(`${name}/${id}`)
          return { exists: data != null, id, data: () => data }
        },
        set: async value => {
          state.set(name, id, value)
          state.records.set(`${name}/${id}`, value)
        },
      }),
      get: async () => ({ docs: [] }),
    }),
  },
}))

import { publishYamlLesson, upsertLesson } from './lessons.mjs'

const draft = {
  id: 'cli-draft', type: 'python', title: 'CLI draft', description: 'In progress', draft: true,
  tasks: [{ id: 41, title: 'First task', intent: 'Create a simple variable.' }],
}

describe('CLI draft lesson upsert', () => {
  beforeEach(() => {
    state.records.clear()
    state.set.mockReset()
  })

  it('creates and updates an incomplete YAML-shaped draft while preserving task identity and audit fields', async () => {
    const created = await upsertLesson(draft)
    expect(created).toMatchObject({ success: true, version: 1, noOp: false })
    const stored = state.records.get('lessons/cli-draft')
    expect(stored).toMatchObject({ draft: true, version: 1, tasks: [{ id: 41, intent: draft.tasks[0].intent }] })

    const updated = await upsertLesson({ ...draft, tasks: [{ ...draft.tasks[0], intent: 'Create and print a simple variable.' }] })
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
    expect(result.errors).toContain('Draft lessons cannot be published. Clear draft only after full validation passes.')
    expect(state.set).not.toHaveBeenCalled()
  })
})
