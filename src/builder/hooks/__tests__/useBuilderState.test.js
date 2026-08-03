import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useBuilderState } from '../useBuilderState'

function makeScratchLesson(overrides = {}) {
  return {
    type: 'scratch',
    tasks: [
      {
        id: 1,
        title: 'Task 1',
        sprites: [{ id: 'sprite1', name: 'Rocket', type: 'arrow', x: -100, y: 0 }],
        backdrops: [{ id: 'backdrop1', name: 'Space', colour: '#000000' }],
        variables: [{ name: 'score', showOnStage: true }],
        starterBlocks: { sprite1: { blocks: {} } },
        completeBlocks: { sprite1: { blocks: { a: 1 } } },
      },
    ],
    ...overrides,
  }
}

describe('useBuilderState scratch task creation', () => {
  it('inherits sprites/backdrops/variables from the previous task and carries blocks', () => {
    const lesson = makeScratchLesson()
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.selectTask(1)
    })
    rerender({ lesson: currentLesson })

    act(() => {
      result.current.handleAddTask()
    })
    rerender({ lesson: currentLesson })

    const newTask = currentLesson.tasks[1]
    expect(newTask.carryBlocksFrom).toBe(1)
    expect(newTask.starterBlocks).toEqual(lesson.tasks[0].completeBlocks)
    expect(newTask.sprites).toEqual(lesson.tasks[0].sprites)
    expect(newTask.backdrops).toEqual(lesson.tasks[0].backdrops)
    expect(newTask.variables).toEqual(lesson.tasks[0].variables)

    // Must be independent copies, not shared references
    expect(newTask.sprites).not.toBe(lesson.tasks[0].sprites)
  })

  it('falls back to a default preset sprite when there is no previous task', () => {
    const lesson = makeScratchLesson({ tasks: [] })
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })
    const defaultSprites = [{ id: 'preset-cat', name: 'Cat', type: 'cat' }]

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate, defaultSprites }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddTask()
    })
    rerender({ lesson: currentLesson })

    const newTask = currentLesson.tasks[0]
    expect(newTask.carryBlocksFrom).toBeNull()
    expect(newTask.starterBlocks).toBeNull()
    expect(newTask.sprites).toHaveLength(1)
    expect(newTask.sprites[0].name).toBe('Cat')
  })
})

describe('useBuilderState taskActivity default-seeding', () => {
  it('seeds an empty taskActivity on a new top-level task, alongside intent', () => {
    const lesson = { type: 'python', tasks: [{ id: 1, title: 'First', starterCode: '' }] }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddTask()
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[1]).toMatchObject({ intent: '', taskActivity: '' })
  })

  it('seeds an empty taskActivity on a new composed-lesson task', () => {
    const lesson = { type: 'composed', tasks: [] }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddTask()
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0]).toMatchObject({ intent: '', taskActivity: '' })
  })

  it('seeds an empty taskActivity on a new group\'s first subtask', () => {
    const lesson = { type: 'python', tasks: [] }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddGroup()
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].subtasks[0]).toMatchObject({ intent: '', taskActivity: '' })
  })

  it('seeds an empty taskActivity on a new subtask added to an existing group', () => {
    const lesson = {
      type: 'python',
      tasks: [{ id: 'group-a', type: 'group', title: 'Group', subtasks: [{ id: 1, title: 'First', starterCode: '' }] }],
    }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddSubtask('group-a')
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].subtasks[1]).toMatchObject({ intent: '', taskActivity: '' })
  })
})

describe('useBuilderState task renumbering', () => {
  it('renumbers lesson tasks and keeps the selected task selected by position', () => {
    const lesson = {
      type: 'python',
      tasks: [
        { id: 5, title: 'First', starterCode: '' },
        {
          id: 'group-a',
          type: 'group',
          title: 'Group',
          subtasks: [
            { id: 9, title: 'Second', starterCode: '' },
            { id: 10, title: 'Third', starterCode: '', carryCodeFrom: 9 },
          ],
        },
      ],
    }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.selectTask(10)
    })
    rerender({ lesson: currentLesson })

    act(() => {
      result.current.handleRenumberTasks()
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].id).toBe(1)
    expect(currentLesson.tasks[1].subtasks[0].id).toBe(2)
    expect(currentLesson.tasks[1].subtasks[1]).toMatchObject({ id: 3, carryCodeFrom: 2 })
    expect(result.current.selectedTaskId).toBe(3)
  })
})

describe('useBuilderState grouped task titles', () => {
  it('creates and duplicates grouped subtasks without deriving titles from the group', () => {
    const lesson = {
      type: 'python',
      tasks: [
        {
          id: 'group-a',
          type: 'group',
          title: 'Practice',
          subtasks: [{ id: 1, title: 'Write a loop', starterCode: '' }],
        },
      ],
    }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddSubtask('group-a')
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].subtasks[0].title).toBe('Write a loop')
    expect(currentLesson.tasks[0].subtasks[1].title).toBe('')

    act(() => {
      result.current.handleDuplicate(currentLesson.tasks[0].subtasks[0], 'group-a')
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].subtasks[2].title).toBe('Write a loop (copy)')
  })

  it('starts the first task in a new group with an independent blank title', () => {
    const lesson = { type: 'python', tasks: [] }
    let currentLesson = lesson
    const onUpdate = vi.fn(updater => {
      currentLesson = typeof updater === 'function' ? updater(currentLesson) : updater
    })

    const { result, rerender } = renderHook(
      ({ lesson }) => useBuilderState({ lesson, onUpdate }),
      { initialProps: { lesson } }
    )

    act(() => {
      result.current.handleAddGroup()
    })
    rerender({ lesson: currentLesson })

    expect(currentLesson.tasks[0].title).toBe('New Group')
    expect(currentLesson.tasks[0].subtasks[0].title).toBe('')
  })
})
