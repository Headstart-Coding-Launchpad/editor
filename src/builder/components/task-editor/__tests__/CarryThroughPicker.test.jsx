import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CarryThroughPicker } from '../TaskEditorFields'
import { getLessonModule } from '../../../../modules/registry'

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

  it('also patches codeStages[0].blocks and carries enableStageCode when the target task has stages', async () => {
    const lesson = makeLesson()
    lesson.tasks[1].enableStageCode = false
    lesson.tasks[0].enableStageCode = true
    lesson.tasks[1].codeStages = [
      { label: 'Starter', role: 'starter', blocks: null },
      { label: 'Support 1', role: 'support', blocks: { a: 2 } },
    ]
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

    const updated = onUpdate.mock.calls[0][0]
    expect(updated.enableStageCode).toBe(true)
    expect(updated.codeStages[0]).toEqual({ label: 'Starter', role: 'starter', blocks: lesson.tasks[0].completeBlocks })
    // Stage 1 (support) is untouched — only stage 0 is patched with the carried content.
    expect(updated.codeStages[1]).toEqual({ label: 'Support 1', role: 'support', blocks: { a: 2 } })
  })

  it('limits composed lessons to earlier tasks in the same module', async () => {
    const lesson = {
      type: 'composed',
      tasks: [
        { id: 1, moduleType: 'python', title: 'Python one', starterCode: 'print(1)', completeCode: 'print(1)' },
        { id: 2, moduleType: 'scratch', title: 'Scratch task', starterBlocks: {} },
        { id: 3, moduleType: 'python', title: 'Python two', starterCode: '', carryCodeFrom: null },
      ],
    }
    const onUpdate = vi.fn()

    render(<CarryThroughPicker task={lesson.tasks[2]} lesson={lesson} lessonMod={getLessonModule('python')} onUpdate={onUpdate} />)

    await userEvent.click(screen.getByText('Carry from last task').closest('label').querySelector('input'))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ carryCodeFrom: 1, starterCode: 'print(1)' }))
  })

  it('also patches codeStages[0].code for a Python task authored with codeStages', async () => {
    const lesson = {
      type: 'python',
      tasks: [
        { id: 1, title: 'One', starterCode: 'a=1', completeCode: 'a=1; print(a)' },
        {
          id: 2, title: 'Two', starterCode: '', carryCodeFrom: null,
          codeStages: [{ label: 'Starter', role: 'starter', code: '' }],
        },
      ],
    }
    const onUpdate = vi.fn()

    render(<CarryThroughPicker task={lesson.tasks[1]} lesson={lesson} lessonMod={getLessonModule('python')} onUpdate={onUpdate} />)

    await userEvent.click(screen.getByText('Carry from last task').closest('label').querySelector('input'))

    const updated = onUpdate.mock.calls[0][0]
    expect(updated.starterCode).toBe('a=1; print(a)')
    expect(updated.codeStages[0]).toEqual({ label: 'Starter', role: 'starter', code: 'a=1; print(a)' })
  })
})
