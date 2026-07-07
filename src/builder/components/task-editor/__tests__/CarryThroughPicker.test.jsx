import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CarryThroughPicker } from '../TaskEditorFields'

function makeLesson() {
  return {
    type: 'scratch',
    tasks: [
      {
        id: 1,
        title: 'First task',
        sprites: [{ id: 'sprite1', name: 'Rocket', type: 'arrow' }],
        backdrops: [{ id: 'backdrop1', name: 'Space', colour: '#000000' }],
        variables: [{ name: 'score', showOnStage: true }],
        starterBlocks: null,
        completeBlocks: { sprite1: { blocks: { a: 1 } } },
      },
      {
        id: 2,
        title: 'Second task',
        sprites: [],
        backdrops: [],
        variables: [],
        starterBlocks: null,
        carryBlocksFrom: null,
      },
    ],
  }
}

describe('CarryThroughPicker scratch stage copy', () => {
  it('copies sprites/backdrops/variables from the source task when carrying from last task', async () => {
    const lesson = makeLesson()
    const task = lesson.tasks[1]
    const onUpdate = vi.fn()

    render(
      <CarryThroughPicker
        task={task}
        lesson={lesson}
        onUpdate={onUpdate}
        isScratch
        isPython={false}
        isFilesystem={false}
      />
    )

    await userEvent.click(screen.getByText('Carry from last task').closest('label').querySelector('input'))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updated = onUpdate.mock.calls[0][0]
    expect(updated.carryBlocksFrom).toBe(1)
    expect(updated.starterBlocks).toEqual(lesson.tasks[0].completeBlocks)
    expect(updated.sprites).toEqual(lesson.tasks[0].sprites)
    expect(updated.backdrops).toEqual(lesson.tasks[0].backdrops)
    expect(updated.variables).toEqual(lesson.tasks[0].variables)
    expect(updated.sprites).not.toBe(lesson.tasks[0].sprites)
  })
})
