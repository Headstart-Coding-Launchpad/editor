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
  default: ({ student, onClose, onPrev, onNext, hasPrev, hasNext, onSendVideoCallLink }) => (
    <div data-testid="student-modal">
      <span data-testid="modal-name">{student.displayName}</span>
      {hasPrev && <button onClick={onPrev}>Prev student</button>}
      {hasNext && <button onClick={onNext}>Next student</button>}
      {onSendVideoCallLink && (
        <button onClick={() => onSendVideoCallLink(student.anonymousId)}>
          Send video call link
        </button>
      )}
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
  {
    anonymousId: 's1',
    displayName: 'Alice',
    online: true,
    lastRunStatus: 'success',
    checkPassed: true,
  },
  {
    anonymousId: 's2',
    displayName: 'Bob',
    online: false,
    lastRunStatus: 'error',
    checkPassed: false,
  },
  { anonymousId: 's3', displayName: 'Carol', online: true, lastRunStatus: null, checkPassed: null },
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

    it('does not show check count badges during a teacher-started sandbox', () => {
      render(
        <StudentGrid
          {...mkProps({
            lesson: LESSON_WITH_CHECK,
            session: { state: 'sandbox', currentTaskId: 1 },
          })}
        />
      )
      expect(
        screen.queryByTitle('Students who failed the completion check')
      ).not.toBeInTheDocument()
    })

    it('does not show check count badges when the task has no check', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(
        screen.queryByTitle('Students who passed the completion check')
      ).not.toBeInTheDocument()
    })
  })

  describe('request fullscreen all', () => {
    it('does not show the button when no handler is provided', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(screen.queryByText('⛶ Fullscreen All')).not.toBeInTheDocument()
    })

    it('does not show the button when there are no students', () => {
      render(<StudentGrid {...mkProps({ students: [], onRequestFullscreenAll: vi.fn() })} />)
      expect(screen.queryByText('⛶ Fullscreen All')).not.toBeInTheDocument()
    })

    it('calls onRequestFullscreenAll and shows confirmation when clicked', async () => {
      const user = userEvent.setup()
      const onRequestFullscreenAll = vi.fn()
      render(<StudentGrid {...mkProps({ onRequestFullscreenAll })} />)
      await user.click(screen.getByText('⛶ Fullscreen All'))
      expect(onRequestFullscreenAll).toHaveBeenCalledTimes(1)
      expect(screen.getByText('✓ Requested')).toBeInTheDocument()
    })
  })

  describe('nudge Away students', () => {
    const withAway = STUDENTS.map((st) =>
      st.anonymousId === 's3' ? { ...st, windowFocused: false } : st
    )

    it('hides the button when nobody is Away', () => {
      render(<StudentGrid {...mkProps({ onNudgeAway: vi.fn() })} />)
      expect(screen.queryByText(/Nudge Away/)).not.toBeInTheDocument()
    })

    it('shows the Away count and nudges when clicked', async () => {
      const user = userEvent.setup()
      const onNudgeAway = vi.fn()
      render(<StudentGrid {...mkProps({ students: withAway, onNudgeAway })} />)
      await user.click(screen.getByText('🔔 Nudge Away (1)'))
      expect(onNudgeAway).toHaveBeenCalledTimes(1)
      expect(screen.getByText('✓ Nudged')).toBeInTheDocument()
    })
  })

  describe('collapsed state', () => {
    function renderCollapsed(studentOverrides = {}) {
      return render(
        <StudentGrid
          {...mkProps({ collapsed: true, lesson: LESSON_WITH_CHECK, ...studentOverrides })}
        />
      )
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

    it('threads onSendVideoCallLink through to the expanded StudentModal', async () => {
      const user = userEvent.setup()
      const onSendVideoCallLink = vi.fn()
      render(<StudentGrid {...mkProps({ onSendVideoCallLink })} />)
      await user.click(screen.getByRole('button', { name: 'Expand Alice' }))
      await user.click(screen.getByRole('button', { name: 'Send video call link' }))
      expect(onSendVideoCallLink).toHaveBeenCalledWith('s1')
    })
  })

  // A solid green 0 beside a solid red 0 rendered whenever the task had a check, whether
  // or not anyone had passed or failed - the electronics status strip in the two colours
  // the quiz fix is reclaiming.
  describe('check counters', () => {
    const withCheck = {
      type: 'python',
      tasks: [{ id: 1, title: 'T', check: { type: 'output_contains', value: 'hi' } }],
    }
    const session = { state: 'active', currentTaskId: 1 }

    it('hides both counters while nobody has passed or failed', () => {
      const students = [{ anonymousId: 's1', displayName: 'A', online: true, lastRunStatus: null }]
      render(<StudentGrid students={students} lesson={withCheck} session={session} />)
      expect(screen.queryByTitle(/passed the completion check/i)).not.toBeInTheDocument()
      expect(screen.queryByTitle(/failed the completion check/i)).not.toBeInTheDocument()
    })

    it('shows only the counter that has a value', () => {
      const students = [
        {
          anonymousId: 's1',
          displayName: 'A',
          online: true,
          lastRunStatus: 'success',
          checkPassed: true,
        },
      ]
      render(<StudentGrid students={students} lesson={withCheck} session={session} />)
      expect(screen.getByTitle(/passed the completion check/i)).toBeInTheDocument()
      expect(screen.queryByTitle(/failed the completion check/i)).not.toBeInTheDocument()
    })
  })
})

describe('StudentGrid live badges', () => {
  it('shows the Suggestions button with its count and opens the panel', async () => {
    const user = userEvent.setup()
    const onOpenBadgeSuggestions = vi.fn()
    render(
      <StudentGrid
        {...mkProps({
          onOpenBadgeSuggestions,
          badgeSuggestions: { suggestions: [{}, {}], pendingCountByStudent: {} },
        })}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Badge suggestions: 2 pending' }))
    expect(onOpenBadgeSuggestions).toHaveBeenCalled()
    expect(screen.getByText('🏅 Suggestions (2)')).toBeInTheDocument()
  })

  it('hides the Suggestions button outside a live session with nothing pending', () => {
    render(
      <StudentGrid
        {...mkProps({
          session: { state: 'waiting' },
          onOpenBadgeSuggestions: vi.fn(),
          badgeSuggestions: { suggestions: [] },
        })}
      />
    )
    expect(screen.queryByText(/Suggestions \(/)).not.toBeInTheDocument()
  })

  it('select mode awards a badge to several students with one bulkId', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => ({ committed: true }))
    render(<StudentGrid {...mkProps({ onDecideBadge })} />)
    await user.click(screen.getByRole('button', { name: '☑ Select' }))
    const award = screen.getByRole('button', { name: '🏅 Award badge' })
    expect(award).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    await user.click(award)
    expect(
      screen.getByRole('dialog', { name: /Award badge · Alice, Bob, Carol/ })
    ).toBeInTheDocument()
    await user.click(screen.getByTestId('badge-option-helpful_coder'))
    expect(onDecideBadge).toHaveBeenCalledTimes(3)
    const bulkIds = new Set(onDecideBadge.mock.calls.map((call) => call[2].bulkId))
    expect(bulkIds.size).toBe(1)
    expect([...bulkIds][0]).toMatch(/^bulk-helpful_coder-/)
    expect(onDecideBadge.mock.calls[0][2].source).toBe('manual')
  })

  it('has no select mode without a badge writer', () => {
    render(<StudentGrid {...mkProps()} />)
    expect(screen.queryByRole('button', { name: '☑ Select' })).not.toBeInTheDocument()
  })
})
