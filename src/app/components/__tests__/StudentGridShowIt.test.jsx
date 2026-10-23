import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StudentGrid from '../StudentGrid'

vi.mock('../StudentCard', () => ({
  default: ({ student, selectMode, selected, onToggleSelect }) => (
    <div data-testid="student-card">
      <span>{student.displayName}</span>
      {selectMode && (
        <button aria-pressed={selected} onClick={() => onToggleSelect(student.anonymousId)}>
          Pick {student.displayName}
        </button>
      )}
    </div>
  ),
}))
vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div />,
}))
vi.mock('../StudentModal', () => ({ default: () => <div /> }))

const LESSON = { type: 'python', tasks: [{ id: 1, title: 'Task 1' }] }
const STUDENTS = ['A', 'B', 'C', 'D'].map((n) => ({
  anonymousId: `s${n}`,
  displayName: n,
  online: true,
}))

function renderGrid(overrides = {}) {
  const props = {
    students: STUDENTS,
    joiningStudents: [],
    lesson: LESSON,
    lessonId: 'L',
    session: { state: 'active', currentTaskId: 1 },
    topics: [],
    onShowIt: vi.fn().mockResolvedValue(undefined),
    onStopShowIt: vi.fn().mockResolvedValue(undefined),
    collapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  }
  render(<StudentGrid {...props} />)
  return props
}

async function openPicker(user) {
  await user.click(screen.getByRole('button', { name: /more class actions/i }))
  await user.click(screen.getByRole('button', { name: /📺 Show it/ }))
}

describe('Show it picker', () => {
  it('writes the picked ids', async () => {
    const user = userEvent.setup()
    const props = renderGrid()
    await openPicker(user)
    await user.click(screen.getByRole('button', { name: 'Pick B' }))
    await user.click(screen.getByRole('button', { name: 'Pick D' }))
    await user.click(screen.getByRole('button', { name: '📺 Show it' }))
    expect(props.onShowIt).toHaveBeenCalledWith(['sB', 'sD'])
  })

  it('refuses a fourth pick', async () => {
    const user = userEvent.setup()
    const props = renderGrid()
    await openPicker(user)
    for (const n of ['A', 'B', 'C', 'D']) {
      await user.click(screen.getByRole('button', { name: `Pick ${n}` }))
    }
    const button = screen.getByRole('button', { name: /Show it \(max 3\)/ })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(props.onShowIt).not.toHaveBeenCalled()
  })

  it('is disabled with a reason when there are no students', async () => {
    const user = userEvent.setup()
    renderGrid({ students: [] })
    await user.click(screen.getByRole('button', { name: /more class actions/i }))
    const item = screen.getByRole('button', { name: /📺 Show it/ })
    expect(item).toBeDisabled()
    expect(item).toHaveTextContent(/no students yet/i)
  })

  it('shows a Stop showing button while it is on, and stops', async () => {
    const user = userEvent.setup()
    const props = renderGrid({
      session: {
        state: 'active',
        currentTaskId: 1,
        showIt: { studentIds: ['sA', 'sB'], taskId: '1', startedAt: 1 },
      },
    })
    expect(screen.getByText(/Showing 2 builds/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Stop showing/ }))
    expect(props.onStopShowIt).toHaveBeenCalled()
  })
})
