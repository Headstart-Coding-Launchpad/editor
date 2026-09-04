import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import EditLessonModal from '../EditLessonModal'

// TaskList/TaskEditor/GroupEditor pull in CodeMirror, Pyodide, and other
// builder-only machinery already covered (or deliberately not yet covered,
// matching BuilderView) elsewhere. Stub them so this test focuses on the
// modal's own glue: role-based actions, save wiring, and the active-task
// delete guard.
vi.mock('../../../builder/components/TaskList', () => ({
  default: ({ tasks, onAdd, onDelete, onSelect }) => (
    <div>
      <button onClick={onAdd}>mock-add-task</button>
      {tasks.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}>
          select-{t.id}
        </button>
      ))}
      <button onClick={() => onDelete(1)}>delete-task-1</button>
      <button onClick={() => onDelete(2)}>delete-task-2</button>
    </div>
  ),
}))

vi.mock('../../../builder/components/TaskEditor', () => ({
  default: ({ task }) => <div>Editing {task.title}</div>,
}))

vi.mock('../../../builder/components/GroupEditor', () => ({
  default: () => <div>group editor</div>,
}))

vi.mock('../../../builder/components/ValidationPanel', () => ({
  default: () => null,
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], defaultSprites: [], loading: false }),
}))

function makeLesson() {
  return {
    id: 'py-1',
    type: 'python',
    title: 'Lesson',
    tasks: [
      { id: 1, title: 'Task 1', starterCode: 'print(1)' },
      { id: 2, title: 'Task 2', starterCode: 'print(2)' },
    ],
  }
}

function renderModal(overrides = {}) {
  const props = {
    lesson: makeLesson(),
    role: 'teacher',
    currentTaskId: 1,
    onApplySession: vi.fn().mockResolvedValue(undefined),
    onSavePermanent: vi.fn().mockResolvedValue(undefined),
    onResetToOriginal: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<EditLessonModal {...props} />)
  return props
}

describe('EditLessonModal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows only "Apply for This Session" for teachers', () => {
    renderModal({ role: 'teacher' })
    expect(screen.getByRole('button', { name: 'Apply for This Session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Permanently' })).not.toBeInTheDocument()
  })

  it('shows both Apply and Save Permanently for admins', () => {
    renderModal({ role: 'admin' })
    expect(screen.getByRole('button', { name: 'Apply for This Session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Permanently' })).toBeInTheDocument()
  })

  it('closes without saving on Cancel', () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(props.onApplySession).not.toHaveBeenCalled()
  })

  it('adds a new task to the draft via the task list', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'mock-add-task' }))
    expect(screen.getByRole('button', { name: 'select-3' })).toBeInTheDocument()
  })

  it('applies edited tasks for this session, preserving existing task IDs', async () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Apply for This Session' }))

    await waitFor(() => expect(props.onApplySession).toHaveBeenCalledOnce())
    const savedTasks = props.onApplySession.mock.calls[0][0]
    expect(savedTasks.map((t) => t.id)).toEqual([1, 2])
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('saves permanently for admins', async () => {
    const props = renderModal({ role: 'admin' })
    fireEvent.click(screen.getByRole('button', { name: 'Save Permanently' }))

    await waitFor(() => expect(props.onSavePermanent).toHaveBeenCalledOnce())
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('warns extra before deleting the task the live session is currently on', () => {
    renderModal({ currentTaskId: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'delete-task-1' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('currently on'))
  })

  it('does not show the active-task warning when deleting a different task', () => {
    renderModal({ currentTaskId: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'delete-task-2' }))
    expect(window.confirm).not.toHaveBeenCalledWith(expect.stringContaining('currently on'))
  })

  it('resets to the original lesson after confirmation', () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Original' }))
    expect(props.onResetToOriginal).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
