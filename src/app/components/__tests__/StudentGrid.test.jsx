import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentGrid from '../StudentGrid'

vi.mock('../StudentCard', () => ({
  default: ({ student, onExpand }) => (
    <div data-testid="student-card">
      <span>{student.displayName}</span>
      <button onClick={() => onExpand(student)}>Expand {student.displayName}</button>
    </div>
  ),
}))

vi.mock('../StudentModal', () => ({
  default: ({ student, onClose, onPrev, onNext, hasPrev, hasNext }) => (
    <div data-testid="student-modal">
      <span data-testid="modal-name">{student.displayName}</span>
      {hasPrev && <button onClick={onPrev}>Prev student</button>}
      {hasNext && <button onClick={onNext}>Next student</button>}
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}))

const LESSON_WITH_CHECK = {
  type: 'python',
  tasks: [{ id: 1, title: 'Task 1', check: { type: 'output_contains', value: 'hello' } }],
}

const PYTHON_LESSON = {
  type: 'python',
  tasks: [{ id: 1, title: 'Task 1' }],
}

const ACTIVE_SESSION = { state: 'active', currentTaskId: 1 }

const STUDENTS = [
  { anonymousId: 's1', displayName: 'Alice', online: true,  lastRunStatus: 'success', checkPassed: true  },
  { anonymousId: 's2', displayName: 'Bob',   online: false, lastRunStatus: 'error',   checkPassed: false },
  { anonymousId: 's3', displayName: 'Carol', online: true,  lastRunStatus: null,      checkPassed: null  },
]

function mkProps(overrides = {}) {
  return {
    students: STUDENTS,
    lesson: PYTHON_LESSON,
    lessonId: 'lesson-1',
    session: ACTIVE_SESSION,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onRemoteReset: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  }
}

describe('StudentGrid', () => {
  describe('expanded (default) state', () => {
    it('renders one card per student', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(screen.getAllByTestId('student-card')).toHaveLength(3)
    })

    it('renders the display name of each student', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Carol')).toBeInTheDocument()
    })

    it('shows an empty state message when no students are present', () => {
      render(<StudentGrid {...mkProps({ students: [] })} />)
      expect(screen.getByText('No students yet.')).toBeInTheDocument()
    })

    it('shows check count badges when the current task has a check', () => {
      render(<StudentGrid {...mkProps({ lesson: LESSON_WITH_CHECK })} />)
      // Alice passed (s1), Bob run but not passed (s2)
      expect(screen.getByTitle('Students who passed the completion check')).toHaveTextContent('1')
      expect(screen.getByTitle('Students who failed the completion check')).toHaveTextContent('1')
    })

    it('does not show check count badges when the task has no check', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(screen.queryByTitle('Students who passed the completion check')).not.toBeInTheDocument()
    })
  })

  describe('collapsed state', () => {
    function renderCollapsed(studentOverrides = {}) {
      return render(<StudentGrid {...mkProps({ collapsed: true, lesson: LESSON_WITH_CHECK, ...studentOverrides })} />)
    }

    it('shows the total student count badge', () => {
      renderCollapsed()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('joined')).toBeInTheDocument()
    })

    it('shows the run count', () => {
      renderCollapsed()
      // Alice and Bob have run (lastRunStatus != null)
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('run')).toBeInTheDocument()
    })

    it('shows passed and failed counts when task has a check', () => {
      renderCollapsed()
      expect(screen.getByText('passed')).toBeInTheDocument()
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  describe('expand and modal navigation', () => {
    it('renders StudentModal for the expanded student when a card is expanded', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps()} />)
      await user.click(screen.getByRole('button', { name: 'Expand Alice' }))
      expect(screen.getByTestId('student-modal')).toBeInTheDocument()
      expect(screen.getByTestId('modal-name')).toHaveTextContent('Alice')
    })

    it('advances to the next student when Next is clicked in the modal', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps()} />)
      await user.click(screen.getByRole('button', { name: 'Expand Alice' }))
      expect(screen.getByTestId('modal-name')).toHaveTextContent('Alice')
      await user.click(screen.getByRole('button', { name: 'Next student' }))
      expect(screen.getByTestId('modal-name')).toHaveTextContent('Bob')
    })

    it('moves to the previous student when Prev is clicked in the modal', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps()} />)
      await user.click(screen.getByRole('button', { name: 'Expand Bob' }))
      await user.click(screen.getByRole('button', { name: 'Prev student' }))
      expect(screen.getByTestId('modal-name')).toHaveTextContent('Alice')
    })

    it('closes the modal when Close is clicked', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps()} />)
      await user.click(screen.getByRole('button', { name: 'Expand Alice' }))
      expect(screen.getByTestId('student-modal')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Close modal' }))
      expect(screen.queryByTestId('student-modal')).not.toBeInTheDocument()
    })
  })
})
