import { describe, expect, it } from 'vitest'
import {
  getSandboxConfiguredCode,
  getSandboxConfiguredFiles,
  getSandboxConfiguredScratch,
  getSandboxStarterCode,
  getSandboxStarterFiles,
  getSandboxStarterScratch,
} from '../teacherSandboxContent'

const pythonLesson = {
  sandboxStarter: 'configured',
  tasks: [{ id: 2, starterCode: 'task' }],
}

describe('getSandboxStarterCode', () => {
  it('prefers draft work, then live sandbox content, then configured content', () => {
    const session = { state: 'sandbox', sandboxCode: 'live' }
    expect(getSandboxStarterCode({
      lesson: pythonLesson,
      taskId: 2,
      session,
      draftCode: 'draft',
      currentCode: 'current',
    })).toBe('draft')
    expect(getSandboxStarterCode({
      lesson: pythonLesson,
      taskId: 2,
      session,
      draftCode: 'draft',
      currentCode: 'current',
      preferDraft: false,
    })).toBe('live')
    expect(getSandboxStarterCode({
      lesson: pythonLesson,
      taskId: 2,
      currentCode: 'current',
    })).toBe('configured')
  })

  it('uses current editor content before the task starter when no sandbox starter is configured', () => {
    const lesson = { tasks: [{ id: 2, starterCode: 'task' }] }
    expect(getSandboxStarterCode({ lesson, taskId: 2, currentCode: 'current' })).toBe('current')
    expect(getSandboxStarterCode({ lesson, taskId: 2, currentCode: '' })).toBe('task')
  })
})

describe('getSandboxStarterFiles', () => {
  const lesson = {
    sandboxStarterFiles: [{ name: 'configured.html', content: 'configured' }],
    tasks: [{ id: 2, starterFiles: [{ name: 'task.html', content: 'task' }] }],
  }
  it('returns cloned draft files before live sandbox files', () => {
    const draftFiles = [{ name: 'draft.html', content: 'draft' }]
    const selected = getSandboxStarterFiles({
      lesson,
      taskId: 2,
      session: { state: 'sandbox', sandboxFiles: { 'live__dot__html': 'live' } },
      draftFiles,
      currentFiles: [],
    })
    selected[0].content = 'edited'
    expect(draftFiles[0].content).toBe('draft')
    expect(selected[0].name).toBe('draft.html')
  })

  it('decodes live sandbox files and falls back through configured, current, and task files', () => {
    expect(getSandboxStarterFiles({
      lesson,
      taskId: 2,
      session: { state: 'sandbox', sandboxFiles: { 'live__dot__html': 'live' } },
      draftFiles: [],
      currentFiles: [],
    })[0]).toMatchObject({ name: 'live.html', type: 'html' })
    expect(getSandboxStarterFiles({ lesson, taskId: 2, currentFiles: [] })[0].name).toBe('configured.html')
    expect(getSandboxStarterFiles({
      lesson: { tasks: lesson.tasks },
      taskId: 2,
      currentFiles: [{ name: 'current.html', content: 'current' }],
    })[0].name).toBe('current.html')
    expect(getSandboxStarterFiles({
      lesson: { tasks: lesson.tasks },
      taskId: 2,
      currentFiles: [],
    })[0].name).toBe('task.html')
  })
})

describe('getSandboxStarterScratch', () => {
  const taskState = { blocks: { blocks: [{ id: 'task' }] } }
  const lesson = { tasks: [{ id: 2, starterBlocks: taskState }] }

  it('clones draft state and parses the live sandbox state when draft work is skipped', () => {
    const draftState = { blocks: { blocks: [{ id: 'draft' }] } }
    const session = { state: 'sandbox', sandboxCode: JSON.stringify({ blocks: { blocks: [{ id: 'live' }] } }) }
    const selected = getSandboxStarterScratch({ lesson, taskId: 2, session, draftState })
    selected.blocks.blocks[0].id = 'edited'
    expect(draftState.blocks.blocks[0].id).toBe('draft')
    expect(getSandboxStarterScratch({
      lesson,
      taskId: 2,
      session,
      draftState,
      preferDraft: false,
    }).blocks.blocks[0].id).toBe('live')
  })
})

describe('configured sandbox content', () => {
  it('reads explicit lesson starters and clones fallback files and Scratch state', () => {
    const scratchState = { blocks: { blocks: [{ id: 'task' }] } }
    const lesson = {
      sandboxStarter: JSON.stringify({ blocks: { blocks: [{ id: 'configured' }] } }),
      sandboxStarterFiles: [{ name: 'sandbox.html', content: 'start' }],
      tasks: [{ id: 2, starterCode: 'task', starterFiles: [], starterBlocks: scratchState }],
    }
    expect(getSandboxConfiguredCode({ lesson: pythonLesson, taskId: 2 })).toBe('configured')
    const files = getSandboxConfiguredFiles({ lesson, taskId: 2 })
    files[0].content = 'edited'
    expect(lesson.sandboxStarterFiles[0].content).toBe('start')
    expect(getSandboxConfiguredScratch({ lesson, taskId: 2 }).blocks.blocks[0].id).toBe('configured')
    const fallback = getSandboxConfiguredScratch({ lesson: { tasks: lesson.tasks }, taskId: 2 })
    fallback.blocks.blocks[0].id = 'edited'
    expect(scratchState.blocks.blocks[0].id).toBe('task')
  })
})
