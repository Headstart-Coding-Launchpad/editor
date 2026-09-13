import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TaskEditor from '../components/TaskEditor'

vi.mock('../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], loading: false, error: null }),
}))

vi.mock('../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], loading: false, error: null }),
}))

function composedLesson(task) {
  return {
    id: 'test-lesson',
    title: 'Test lesson',
    type: 'composed',
    tasks: [task],
  }
}

describe('TaskEditor code_arrange format', () => {
  it('switches a task to code_arrange with sensible defaults when Arrange is chosen', async () => {
    const user = userEvent.setup()
    const task = { id: 1, title: 'A task', moduleType: 'python', starterCode: 'print(1)' }
    const lesson = composedLesson(task)
    const onUpdate = vi.fn()

    render(<TaskEditor task={task} lesson={lesson} onUpdate={onUpdate} composedLesson={lesson} />)

    await user.click(screen.getByRole('button', { name: /Arrange/ }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updated = onUpdate.mock.calls[0][0]
    expect(updated.taskType).toBe('code_arrange')
    expect(updated.moduleType).toBe('python')
    expect(Array.isArray(updated.lines)).toBe(true)
    expect(updated.lines.length).toBeGreaterThan(0)
    // Every line is authored the same way — as parts — with no mode field.
    expect(updated.lines[0].mode).toBeUndefined()
    expect(Array.isArray(updated.lines[0].parts)).toBe(true)
    expect(Array.isArray(updated.distractors)).toBe(true)
    expect(updated.check).toBeNull()
  })

  it('renders the Code Arrange authoring form and preview for an existing code_arrange task', () => {
    const task = {
      id: 1,
      title: 'Arrange a loop',
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print(1)' }] }],
      distractors: [{ id: 'D1', code: 'print(2)' }],
      check: { type: 'output_contains', value: '1' },
    }
    const lesson = composedLesson(task)

    render(<TaskEditor task={task} lesson={lesson} onUpdate={vi.fn()} composedLesson={lesson} />)

    expect(screen.getByText('Program lines')).toBeInTheDocument()
    expect(screen.getByDisplayValue('print(1)')).toBeInTheDocument()
    expect(screen.getByText('Distractor tiles')).toBeInTheDocument()
    expect(screen.getByDisplayValue('print(2)')).toBeInTheDocument()
    expect(screen.getByText('Load authored solution')).toBeInTheDocument()
  })

  it('renders a line mixing fixed text and a blank as separate composer chips', () => {
    const task = {
      id: 1,
      title: 'Arrange a loop',
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [
        {
          id: 'L1',
          parts: [
            { type: 'text', text: 'for i in range(' },
            { type: 'slot', id: 'S1', code: '5' },
            { type: 'text', text: '):' },
          ],
        },
      ],
      distractors: [{ id: 'S1d1', code: '10' }],
      check: { type: 'output_contains', value: '0' },
    }
    const lesson = composedLesson(task)

    render(<TaskEditor task={task} lesson={lesson} onUpdate={vi.fn()} composedLesson={lesson} />)

    expect(screen.getByDisplayValue('for i in range(')).toBeInTheDocument()
    expect(screen.getByDisplayValue('):')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    // The blank's own distractor no longer lives on the part — it's in the
    // one shared task-level "Distractor tiles" list.
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    expect(screen.getByText('Distractor tiles')).toBeInTheDocument()
  })

  it('restricts the module picker to Python and HTML for a code_arrange task', () => {
    const task = {
      id: 1,
      title: 'Arrange',
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print(1)' }] }],
      check: { type: 'output_contains', value: '1' },
    }
    const lesson = composedLesson(task)

    render(<TaskEditor task={task} lesson={lesson} onUpdate={vi.fn()} composedLesson={lesson} />)

    expect(screen.queryByText(/🧩 Scratch/)).not.toBeInTheDocument()
    expect(screen.queryByText(/🗂️ Filesystem/)).not.toBeInTheDocument()
  })
})
