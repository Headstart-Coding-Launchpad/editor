import { describe, expect, it } from 'vitest'
import { getEffectiveLessonForTask, getModuleCarrySourceIds, getTaskContext, validateComposedStructure } from '../composedLesson'

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

  it('rejects code tasks with no selected lesson module', () => {
    expect(validateComposedStructure({ type: 'composed', tasks: [{ id: 1, title: 'Loose code' }] })).toHaveLength(1)
  })
})
