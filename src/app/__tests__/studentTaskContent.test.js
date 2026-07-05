import { describe, expect, it, vi } from 'vitest'
import {
  canCarryTaskContent,
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
  it('preserves carry-through for runnable tasks in the same group or both outside groups', () => {
    expect(canCarryTaskContent(groupedTasks, 1, 2)).toBe(true)
    expect(canCarryTaskContent(groupedTasks, 3, 2)).toBe(false)
    expect(canCarryTaskContent([{ id: 1 }, { id: 2 }], 1, 2)).toBe(true)
    expect(canCarryTaskContent([
      { id: 'first-group', type: 'group', subtasks: [{ id: 1 }] },
      { id: 'second-group', type: 'group', subtasks: [{ id: 2 }] },
    ], 1, 2)).toBe(false)
    expect(canCarryTaskContent(groupedTasks, 99, 2)).toBe(false)
  })
})

describe('selectPythonTaskCode', () => {
  const task = groupedTasks[0].subtasks[1]

  it('prefers own solo work before carried or starter code', () => {
    const readSavedCode = vi.fn(id => id === 2 ? { code: 'own code' } : { code: 'carried code' })
    expect(selectPythonTaskCode({ tasks: groupedTasks, task, taskId: 2, phase: 'solo', readSavedCode })).toBe('own code')
    expect(readSavedCode).toHaveBeenCalledTimes(1)
  })

  it('uses non-empty carried code and otherwise retains starter code', () => {
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
    })).toBe('second')
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

  it('falls back to the carry source\'s authored blocks when no saved work exists', () => {
    const sourceComplete = { selected: 'source-complete' }
    const tasks = [
      { id: 1, completeBlocks: sourceComplete, starterBlocks: { selected: 'source-starter' } },
      { id: 2, carryBlocksFrom: 1, starterBlocks },
    ]
    expect(selectScratchInitialProject({
      tasks, task: tasks[1], taskId: 2, readSavedCode: () => null,
    })).toBe(sourceComplete)
  })

  it('follows the carry chain to find authored blocks', () => {
    const rootStarter = { selected: 'root-starter' }
    const tasks = [
      { id: 1, starterBlocks: rootStarter },
      { id: 2, carryBlocksFrom: 1 },
      { id: 3, carryBlocksFrom: 2, starterBlocks },
    ]
    expect(selectScratchInitialProject({
      tasks, task: tasks[2], taskId: 3, readSavedCode: () => null,
    })).toBe(rootStarter)
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
