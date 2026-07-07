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
