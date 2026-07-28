import { describe, expect, it, vi } from 'vitest'
import {
  canCarryTaskContent,
  resolveSavedCarrySource,
  selectHtmlTaskFiles,
  selectPythonTaskCode,
  selectScratchInitialProject,
  selectScratchToolboxSnippets,
} from '../studentTaskContent'

const groupedTasks = [{
  id: 'group-1',
  type: 'group',
  subtasks: [
    { id: 1, starterCode: 'first' },
    { id: 2, starterCode: 'second', carryCodeFrom: 1 },
    { id: 3, taskType: 'quiz' },
  ],
}]

describe('canCarryTaskContent', () => {
  it('preserves carry-through for any authored runnable source task', () => {
    expect(canCarryTaskContent(groupedTasks, 1, 2)).toBe(true)
    expect(canCarryTaskContent(groupedTasks, 3, 2)).toBe(false)
    expect(canCarryTaskContent([{ id: 1 }, { id: 2 }], 1, 2)).toBe(true)
    expect(canCarryTaskContent([
      { id: 'first-group', type: 'group', subtasks: [{ id: 1 }] },
      { id: 'second-group', type: 'group', subtasks: [{ id: 2 }] },
    ], 1, 2)).toBe(true)
    expect(canCarryTaskContent(groupedTasks, 99, 2)).toBe(false)
    expect(canCarryTaskContent([{ id: 1, carryCodeFrom: 1 }], 1, 1)).toBe(false)
  })
})

describe('selectPythonTaskCode', () => {
  const task = groupedTasks[0].subtasks[1]

  it('prefers own solo work before carried or starter code', () => {
    const readSavedCode = vi.fn(id => id === 2 ? { code: 'own code' } : { code: 'carried code' })
    expect(selectPythonTaskCode({ tasks: groupedTasks, task, taskId: 2, phase: 'solo', readSavedCode })).toBe('own code')
    expect(readSavedCode).toHaveBeenCalledTimes(1)
  })

  it('uses the first unified Starter stage before legacy starterCode', () => {
    expect(selectPythonTaskCode({
      tasks: [],
      task: {
        starterCode: 'legacy starter',
        codeStages: [
          { role: 'starter', code: 'first starter' },
          { role: 'starter', code: 'second starter' },
        ],
      },
      taskId: 1,
      phase: 'lesson',
      readSavedCode: () => null,
    })).toBe('first starter')
  })

  it('uses carried code, including an intentionally saved empty editor', () => {
    expect(selectPythonTaskCode({
      tasks: groupedTasks,
      task,
      taskId: 2,
      phase: 'lesson',
      readSavedCode: () => ({ code: 'carried code' }),
    })).toBe('carried code')
    expect(selectPythonTaskCode({
      tasks: groupedTasks,
      task,
      taskId: 2,
      phase: 'lesson',
      readSavedCode: () => ({ code: '' }),
    })).toBe('')
  })

  it('walks back an authored carry chain when the immediate source has no save', () => {
    const tasks = [{
      id: 'group-1',
      type: 'group',
      subtasks: [
        { id: 1, starterCode: 'one' },
        { id: 2, starterCode: 'two', carryCodeFrom: 1 },
        { id: 3, starterCode: 'three', carryCodeFrom: 2 },
      ],
    }]
    const onCarryFallback = vi.fn()

    expect(selectPythonTaskCode({
      tasks,
      task: tasks[0].subtasks[2],
      taskId: 3,
      phase: 'lesson',
      readSavedCode: id => id === 1 ? { code: 'saved one' } : null,
      onCarryFallback,
    })).toBe('saved one')
    expect(onCarryFallback).toHaveBeenCalledWith({
      taskId: 3,
      field: 'carryCodeFrom',
      requestedSourceTaskId: 2,
      resolvedSourceTaskId: 1,
      skippedSourceTaskIds: [2],
    })
  })

  it('walks from a later group through a skipped bridge task to earlier saved code', () => {
    const tasks = [
      {
        id: 'build-up',
        type: 'group',
        subtasks: [
          { id: 14, starterCode: 'task 14 starter' },
          { id: 15, starterCode: 'task 15 starter', carryCodeFrom: 14 },
        ],
      },
      {
        id: 'project',
        type: 'group',
        subtasks: [
          { id: 21, starterCode: 'task 21 starter', carryCodeFrom: 15 },
        ],
      },
    ]

    expect(selectPythonTaskCode({
      tasks,
      task: tasks[1].subtasks[0],
      taskId: 21,
      phase: 'lesson',
      readSavedCode: id => id === 14 ? { code: 'name = "Ada"' } : null,
    })).toBe('name = "Ada"')
  })

  it('carries saved code directly across groups', () => {
    const tasks = [
      { id: 'source-group', type: 'group', subtasks: [{ id: 15, starterCode: 'source' }] },
      { id: 'target-group', type: 'group', subtasks: [{ id: 21, starterCode: 'target', carryCodeFrom: 15 }] },
    ]

    expect(selectPythonTaskCode({
      tasks,
      task: tasks[1].subtasks[0],
      taskId: 21,
      phase: 'lesson',
      readSavedCode: id => id === 15 ? { code: 'print("from 15")' } : null,
    })).toBe('print("from 15")')
  })
})

describe('selectHtmlTaskFiles', () => {
  const htmlTasks = [{
    id: 'html-group',
    type: 'group',
    subtasks: [
      { id: 1 },
      {
        id: 2,
        carryCodeFrom: 1,
        starterFiles: [
          { name: 'index.html', content: 'starter html' },
          { name: 'style.css', content: 'starter css' },
        ],
      },
    ],
  }]
  const task = htmlTasks[0].subtasks[1]

  it('selects saved files independently and does not mutate starter files', () => {
    const files = selectHtmlTaskFiles({
      tasks: htmlTasks,
      task,
      taskId: 2,
      phase: 'solo',
      readSavedFile: (id, name) => id === 2 && name === 'index.html' ? 'own html' : id === 1 ? 'carried css' : null,
    })

    expect(files).toEqual([
      { name: 'index.html', content: 'own html' },
      { name: 'style.css', content: 'carried css' },
    ])
    expect(task.starterFiles[0].content).toBe('starter html')
  })

  it('uses files from the first unified Starter stage', () => {
    const files = selectHtmlTaskFiles({
      tasks: [],
      task: {
        starterFiles: [{ name: 'legacy.html', content: 'legacy' }],
        codeStages: [{ role: 'starter', files: [{ name: 'index.html', content: 'unified' }] }],
      },
      taskId: 1,
      phase: 'lesson',
      readSavedFile: () => null,
    })
    expect(files).toEqual([{ name: 'index.html', content: 'unified' }])
  })

  it('walks the authored chain per starter filename', () => {
    const tasks = [{
      id: 'html-group',
      type: 'group',
      subtasks: [
        { id: 1 },
        { id: 2, carryCodeFrom: 1 },
        {
          id: 3,
          carryCodeFrom: 2,
          starterFiles: [
            { name: 'index.html', content: 'starter html' },
            { name: 'style.css', content: 'starter css' },
          ],
        },
      ],
    }]
    const onCarryFallback = vi.fn()

    const files = selectHtmlTaskFiles({
      tasks,
      task: tasks[0].subtasks[2],
      taskId: 3,
      phase: 'lesson',
      readSavedFile: (id, name) => id === 1 && name === 'index.html' ? 'saved html' : null,
      onCarryFallback,
    })

    expect(files).toEqual([
      { name: 'index.html', content: 'saved html' },
      { name: 'style.css', content: 'starter css' },
    ])
    expect(onCarryFallback).toHaveBeenCalledWith({
      taskId: 3,
      field: 'carryCodeFrom',
      requestedSourceTaskId: 2,
      resolvedSourceTaskId: 1,
      skippedSourceTaskIds: [2],
      files: [{
        filename: 'index.html',
        requestedSourceTaskId: 2,
        resolvedSourceTaskId: 1,
        skippedSourceTaskIds: [2],
      }],
    })
  })
})

describe('selectScratchInitialProject', () => {
  const starterBlocks = { selected: 'starter' }
  const task = { carryBlocksFrom: 1, starterBlocks }

  it('falls back from saved task blocks to carried blocks and starter blocks', () => {
    expect(selectScratchInitialProject({
      task,
      taskId: 2,
      readSavedCode: id => id === 2 ? { state: { selected: 'own' } } : { state: { selected: 'carry' } },
    })).toEqual({ selected: 'own' })
    expect(selectScratchInitialProject({
      task,
      taskId: 2,
      readSavedCode: id => id === 1 ? { state: { selected: 'carry' } } : null,
    })).toEqual({ selected: 'carry' })
    expect(selectScratchInitialProject({ task, taskId: 2, readSavedCode: () => null })).toBe(starterBlocks)
  })

  it('uses the current task starter when the authored chain has no saved work', () => {
    const sourceComplete = { selected: 'source-complete' }
    const tasks = [
      { id: 1, completeBlocks: sourceComplete, starterBlocks: { selected: 'source-starter' } },
      { id: 2, carryBlocksFrom: 1, starterBlocks },
    ]
    expect(selectScratchInitialProject({
      tasks, task: tasks[1], taskId: 2, readSavedCode: () => null,
    })).toBe(starterBlocks)
  })

  it('follows the carry chain to find saved blocks', () => {
    const rootSaved = { selected: 'root-saved' }
    const tasks = [
      { id: 1, starterBlocks: { selected: 'root-starter' } },
      { id: 2, carryBlocksFrom: 1 },
      { id: 3, carryBlocksFrom: 2, starterBlocks },
    ]
    const onCarryFallback = vi.fn()
    expect(selectScratchInitialProject({
      tasks,
      task: tasks[2],
      taskId: 3,
      readSavedCode: id => id === 1 ? { state: rootSaved } : null,
      onCarryFallback,
    })).toBe(rootSaved)
    expect(onCarryFallback).toHaveBeenCalledWith({
      taskId: 3,
      field: 'carryBlocksFrom',
      requestedSourceTaskId: 2,
      resolvedSourceTaskId: 1,
      skippedSourceTaskIds: [2],
    })
  })

  it('saved carry state still beats the authored fallback', () => {
    const tasks = [
      { id: 1, completeBlocks: { selected: 'source-complete' } },
      { id: 2, carryBlocksFrom: 1, starterBlocks },
    ]
    expect(selectScratchInitialProject({
      tasks, task: tasks[1], taskId: 2,
      readSavedCode: id => id === 1 ? { state: { selected: 'carry' } } : null,
    })).toEqual({ selected: 'carry' })
  })
})

describe('resolveSavedCarrySource', () => {
  it('supports non-code saved state for filesystem and electronics carry fields', () => {
    const tasks = [
      { id: 1, starterFs: { '/': { type: 'dir' } } },
      { id: 2, carryFsFrom: 1 },
      { id: 3, carryFsFrom: 2 },
    ]

    expect(resolveSavedCarrySource({
      tasks,
      taskId: 3,
      carryFromId: 2,
      carryField: 'carryFsFrom',
      readSavedState: id => id === 1 ? { '/': { type: 'dir' }, '/main.py': { type: 'file', content: '' } } : null,
      hasSavedState: fs => fs != null,
    })).toEqual({
      saved: { '/': { type: 'dir' }, '/main.py': { type: 'file', content: '' } },
      sourceTaskId: 1,
      fallback: {
        taskId: 3,
        field: 'carryFsFrom',
        requestedSourceTaskId: 2,
        resolvedSourceTaskId: 1,
        skippedSourceTaskIds: [2],
      },
    })
  })
})

describe('selectScratchToolboxSnippets', () => {
  it('merges task-level and active-stage Scratch toolbox snippets', () => {
    const taskPredefined = [{ id: 'task-pb', type: 'motion_movesteps' }]
    const stagePredefined = [{ id: 'stage-pb', type: 'looks_say' }]
    const taskStack = [{ id: 'task-stack', stack: { type: 'motion_movesteps' } }]
    const stageStack = [{ id: 'stage-stack', stack: { type: 'looks_say' } }]
    const task = {
      predefinedBlocks: taskPredefined,
      prebuiltStacks: taskStack,
      codeStages: [{ predefinedBlocks: stagePredefined, prebuiltStacks: stageStack }],
    }

    expect(selectScratchToolboxSnippets({ task, activeStageIndex: 0 })).toEqual({
      predefinedBlocks: [...taskPredefined, ...stagePredefined],
      prebuiltStacks: [...taskStack, ...stageStack],
    })
    expect(selectScratchToolboxSnippets({ task, activeStageIndex: null })).toEqual({
      predefinedBlocks: taskPredefined,
      prebuiltStacks: taskStack,
    })
    expect(selectScratchToolboxSnippets({ task, activeStageIndex: 0, disabled: true })).toEqual({
      predefinedBlocks: null,
      prebuiltStacks: null,
    })
  })
})
