import { describe, expect, it } from 'vitest'
import {
  selectHtmlTaskFiles,
  selectPythonTaskCode,
  selectScratchInitialProject,
} from '../studentTaskContent'

// Cross-lesson carry (src/shared/roster/crossLessonCarry.js) in the student's task loaders.
const pyTask = {
  id: 2,
  starterCode: 'starter',
  carryCodeFromLesson: { lesson: 'python-1-11', task: 5 },
}

describe('selectPythonTaskCode with a cross-lesson carry', () => {
  const base = { tasks: [pyTask], task: pyTask, taskId: 2, phase: 'lesson' }

  it('starts from the carried code when found', () => {
    const code = selectPythonTaskCode({
      ...base,
      readSavedCode: () => null,
      crossLesson: { state: 'found', work: { kind: 'code', code: 'my lesson 11 program' } },
    })
    expect(code).toBe('my lesson 11 program')
  })

  it("keeps the student's own save for the task, even in a live lesson", () => {
    const code = selectPythonTaskCode({
      ...base,
      readSavedCode: (taskId) => (taskId === 2 ? { code: 'own work' } : null),
      crossLesson: { state: 'own', work: null },
    })
    expect(code).toBe('own work')
  })

  it('uses the starter for none, starter, no class and solo', () => {
    for (const state of ['none', 'starter', 'no_class', 'solo', 'missing', 'hold']) {
      const code = selectPythonTaskCode({
        ...base,
        readSavedCode: () => null,
        crossLesson: { state, work: null },
      })
      expect(code, state).toBe('starter')
    }
  })
})

describe('selectHtmlTaskFiles with a cross-lesson carry', () => {
  const task = {
    id: 2,
    starterFiles: [
      { name: 'index.html', content: '<p>starter</p>' },
      { name: 'style.css', content: 'body {}' },
    ],
    carryCodeFromLesson: { lesson: 'html-1-11', task: 3 },
  }

  it('carries each starter file by name and keeps the starter for the rest', () => {
    const files = selectHtmlTaskFiles({
      tasks: [task],
      task,
      taskId: 2,
      phase: 'lesson',
      readSavedFile: () => null,
      crossLesson: {
        state: 'found',
        work: {
          kind: 'files',
          files: [
            { name: 'index.html', content: '<p>mine</p>' },
            { name: 'extra.js', content: 'hidden' },
          ],
        },
      },
    })
    expect(files.map((file) => [file.name, file.content])).toEqual([
      ['index.html', '<p>mine</p>'],
      ['style.css', 'body {}'],
    ])
  })
})

describe('selectScratchInitialProject with a cross-lesson carry', () => {
  const task = {
    id: 2,
    starterBlocks: { starter: true },
    carryBlocksFromLesson: { lesson: 'scratch-1-11', task: 4 },
  }

  it('prefers the own save, then the carried project, then the starter', () => {
    const carried = { state: 'found', work: { kind: 'blocks', scratchState: { mine: true } } }
    expect(
      selectScratchInitialProject({
        tasks: [task],
        task,
        taskId: 2,
        readSavedCode: () => ({ state: { own: true } }),
        crossLesson: carried,
      })
    ).toEqual({ own: true })
    expect(
      selectScratchInitialProject({
        tasks: [task],
        task,
        taskId: 2,
        readSavedCode: () => null,
        crossLesson: carried,
      })
    ).toEqual({ mine: true })
    expect(
      selectScratchInitialProject({
        tasks: [task],
        task,
        taskId: 2,
        readSavedCode: () => null,
        crossLesson: { state: 'none', work: null },
      })
    ).toEqual({ starter: true })
  })
})
