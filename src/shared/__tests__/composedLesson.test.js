import { describe, expect, it } from 'vitest'
import { getEffectiveLessonForTask, getLessonModules, getModuleCarrySourceIds, getTaskContext, validateComposedStructure } from '../composedLesson'

const lesson = {
  type: 'composed',
  tasks: [
    { id: 1, taskType: 'information', title: 'Introduction' },
    { id: 2, moduleType: 'python', title: 'Print', starterCode: 'print(1)' },
    { id: 3, moduleType: 'python', title: 'Loop', starterCode: 'for i in range(2): pass' },
    { id: 4, moduleType: 'scratch', title: 'Move', starterBlocks: { blocks: {} } },
  ],
}

describe('composed lesson helpers', () => {
  it('resolves the active module from a task', () => {
    expect(getTaskContext(lesson, 3)).toMatchObject({ moduleType: 'python', lessonModule: { id: 'python' } })
    expect(getTaskContext(lesson, 1).moduleType).toBeNull()
  })

  it('adapts module sandbox state without changing the persisted lesson type', () => {
    const effective = getEffectiveLessonForTask(lesson, 4)
    expect(effective.type).toBe('scratch')
    expect(effective.composedLesson).toBe(lesson)
    expect(JSON.parse(effective.sandboxStarter)).toEqual({ blocks: {} })
  })

  it('limits carry sources to earlier tasks in the same lesson module', () => {
    expect(getModuleCarrySourceIds(lesson, 3)).toEqual([2])
    expect(getModuleCarrySourceIds(lesson, 4)).toEqual([])
  })

  it('uses task order rather than task IDs for carry-through eligibility', () => {
    const reordered = {
      type: 'composed',
      tasks: [
        { id: 20, moduleType: 'python', title: 'First' },
        { id: 5, moduleType: 'python', title: 'Second' },
      ],
    }

    expect(getModuleCarrySourceIds(reordered, 5)).toEqual([20])
    expect(getModuleCarrySourceIds(reordered, 20)).toEqual([])
  })

  it('keeps repeated workspace instances isolated by their module IDs', () => {
    const repeatedHtml = {
      type: 'composed',
      modules: [
        { id: 'html-intro', type: 'html', title: 'First site' },
        { id: 'html-finale', type: 'html', title: 'Second site' },
      ],
      tasks: [
        { id: 1, moduleId: 'html-intro', title: 'Intro page', starterFiles: [{ name: 'index.html', content: '<h1>One</h1>' }] },
        { id: 2, moduleId: 'html-finale', title: 'Final page', starterFiles: [{ name: 'index.html', content: '<h1>Two</h1>' }] },
      ],
    }

    expect(getLessonModules(repeatedHtml).map(module => module.id)).toEqual(['html-intro', 'html-finale'])
    expect(getTaskContext(repeatedHtml, 2).lessonModule).toMatchObject({ id: 'html-finale', type: 'html' })
    expect(getEffectiveLessonForTask(repeatedHtml, 2).sandboxStarterFiles[0].content).toContain('Two')
    expect(getModuleCarrySourceIds(repeatedHtml, 2)).toEqual([])
    expect(validateComposedStructure(repeatedHtml)).toEqual([])
  })

  it('rejects code tasks with no selected lesson module', () => {
    expect(validateComposedStructure({ type: 'composed', tasks: [{ id: 1, title: 'Loose code' }] })).toHaveLength(1)
  })
})
