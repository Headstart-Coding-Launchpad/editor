import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library" />,
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
      // Alice passed (s1); Bob's run crashed (s2), which counts as errored, not failed
      expect(screen.getByTitle('Students who passed the completion check')).toHaveTextContent('1')
      expect(
        screen.getByTitle('Students whose latest run crashed with an error')
      ).toHaveTextContent('1')
      expect(
        screen.queryByTitle('Students who failed the completion check')
      ).not.toBeInTheDocument()
    })

    it('counts a run that finished but failed the check as failed', () => {
      const students = STUDENTS.map((st) =>
        st.anonymousId === 's2' ? { ...st, lastRunStatus: 'success' } : st
      )
      render(<StudentGrid {...mkProps({ lesson: LESSON_WITH_CHECK, students })} />)
      expect(screen.getByTitle('Students who failed the completion check')).toHaveTextContent('1')
      expect(
        screen.queryByTitle('Students whose latest run crashed with an error')
      ).not.toBeInTheDocument()
    })

    it('shows hints two or more students share, and outlines their cards on click', () => {
      const hint = (text) => ({ text, source: 'check', failStreak: 1, taskId: '1', at: 1 })
      const students = [
        { ...STUDENTS[0], checkPassed: false, studentHint: hint('Use **quotes**') },
        { ...STUDENTS[1], studentHint: hint('Use quotes') },
        { ...STUDENTS[2], lastRunStatus: 'success', studentHint: hint('Something else') },
      ]
      render(<StudentGrid {...mkProps({ lesson: LESSON_WITH_CHECK, students })} />)
      expect(screen.getByTestId('common-hints')).toHaveTextContent('Common hints right now (1)')
      const row = within(screen.getByTestId('common-hints')).getByRole('button', {
        name: /Use quotes/,
      })
      expect(row).toHaveTextContent('2')
      expect(row).toHaveAttribute('title', 'Alice, Bob')
      expect(screen.getByTestId('common-hints')).not.toHaveTextContent('Something else')
      fireEvent.click(row)
      expect(row).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows no common-hints strip when no hint is shared', () => {
      render(<StudentGrid {...mkProps({ lesson: LESSON_WITH_CHECK })} />)
      expect(screen.queryByTestId('common-hints')).not.toBeInTheDocument()
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

  describe('nudge Away students (in the ⋯ menu)', () => {
    const withAway = STUDENTS.map((st) =>
      st.anonymousId === 's3' ? { ...st, windowFocused: false } : st
    )

    it('disables the item and shows no attention dot when nobody is Away', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps({ onNudgeAway: vi.fn() })} />)
      expect(screen.queryByText(/Nudge Away/)).not.toBeInTheDocument()
      const more = screen.getByRole('button', { name: 'More class actions' })
      expect(within(more).queryByTestId('dropdown-indicator')).not.toBeInTheDocument()
      await user.click(more)
      expect(screen.getByRole('button', { name: /Nudge Away \(0\)/ })).toBeDisabled()
    })

    it('shows the Away count and nudges when clicked, with a dot on ⋯', async () => {
      const user = userEvent.setup()
      const onNudgeAway = vi.fn()
      render(<StudentGrid {...mkProps({ students: withAway, onNudgeAway })} />)
      const more = screen.getByRole('button', { name: /More class actions \(something/ })
      expect(within(more).getByTestId('dropdown-indicator')).toBeInTheDocument()
      await user.click(more)
      await user.click(screen.getByText('🔔 Nudge Away (1)'))
      expect(onNudgeAway).toHaveBeenCalledTimes(1)
      expect(screen.getByText('✓ Nudged')).toBeInTheDocument()
    })
  })

  describe('header', () => {
    it('is one non-wrapping line: Students (n), Fullscreen All, ⋯ and the collapse arrow', () => {
      render(
        <StudentGrid
          {...mkProps({
            onRequestFullscreenAll: vi.fn(),
            onNudgeAway: vi.fn(),
            onDecideBadge: vi.fn(),
            onOpenBadgeSuggestions: vi.fn(),
            topics: [{ id: 't1', title: 'Loops' }],
          })}
        />
      )
      expect(screen.getByText('Students')).toHaveTextContent('Students (3)')
      const header = screen.getByText('Students').parentElement
      expect(header.style.flexWrap).toBe('nowrap')
      expect(within(header).getByText('⛶ Fullscreen All')).toBeInTheDocument()
      expect(within(header).getByRole('button', { name: 'More class actions' })).toBeInTheDocument()
      expect(within(header).getByTitle('Collapse Students')).toBeInTheDocument()
      // Everything else lives in the menu until it's opened.
      expect(screen.queryByText(/Suggestions \(/)).not.toBeInTheDocument()
      expect(screen.queryByText('☑ Select')).not.toBeInTheDocument()
      expect(screen.queryByText('📖 Reference')).not.toBeInTheDocument()
    })

    it('lists Nudge Away, Suggestions, Select and Reference in the ⋯ menu', async () => {
      const user = userEvent.setup()
      render(
        <StudentGrid
          {...mkProps({
            onNudgeAway: vi.fn(),
            onDecideBadge: vi.fn(),
            onOpenBadgeSuggestions: vi.fn(),
            badgeSuggestions: { suggestions: [], pendingCountByStudent: {} },
            topics: [{ id: 't1', title: 'Loops' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'More class actions' }))
      expect(screen.getByText('🔔 Nudge Away (0)')).toBeInTheDocument()
      expect(screen.getByText('🏅 Suggestions (0)')).toBeInTheDocument()
      expect(screen.getByText('☑ Select')).toBeInTheDocument()
      expect(screen.getByText('📖 Reference')).toBeInTheDocument()
    })

    it('opens the topic library from 📖 Reference', async () => {
      const user = userEvent.setup()
      render(<StudentGrid {...mkProps({ topics: [{ id: 't1', title: 'Loops', content: '' }] })} />)
      await user.click(screen.getByRole('button', { name: 'More class actions' }))
      await user.click(screen.getByText('📖 Reference'))
      expect(screen.queryByText('📖 Reference')).not.toBeInTheDocument()
      expect(screen.getByTestId('topic-library')).toBeInTheDocument()
    })

    it('has no ⋯ menu when there is nothing to put in it', () => {
      render(<StudentGrid {...mkProps()} />)
      expect(screen.queryByRole('button', { name: /More class actions/ })).not.toBeInTheDocument()
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

    it('shows passed and errored counts when task has a check', () => {
      renderCollapsed()
      expect(screen.getByText('passed')).toBeInTheDocument()
      expect(screen.getByText('errored')).toBeInTheDocument()
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
  it('shows Suggestions with its count in the ⋯ menu (with a dot) and opens the panel', async () => {
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
    const more = screen.getByRole('button', { name: /More class actions \(something/ })
    expect(within(more).getByTestId('dropdown-indicator')).toBeInTheDocument()
    await user.click(more)
    expect(screen.getByText('🏅 Suggestions (2)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Badge suggestions: 2 pending' }))
    expect(onOpenBadgeSuggestions).toHaveBeenCalled()
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
    await user.click(screen.getByRole('button', { name: 'More class actions' }))
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
    await user.click(screen.getByTestId('badge-award-confirm'))
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

describe('StudentGrid joining students', () => {
  const JOINING = [
    { tempId: 't1', typedName: 'Jamie', joinedAt: 1 },
    { tempId: 't2', typedName: '', joinedAt: 2 },
  ]

  it('lists joining students by the name they are typing, or Someone when empty', () => {
    render(<StudentGrid {...mkProps({ joiningStudents: JOINING })} />)
    const list = screen.getByRole('region', { name: 'Students joining' })
    expect(within(list).getByText('Jamie')).toBeInTheDocument()
    expect(within(list).getByText('Someone')).toBeInTheDocument()
    expect(within(list).getAllByText('(typing…)')).toHaveLength(2)
    expect(screen.getByText('2 joining…')).toBeInTheDocument()
  })

  it('lists joining students in the empty state too', () => {
    render(<StudentGrid {...mkProps({ students: [], joiningStudents: JOINING.slice(0, 1) })} />)
    expect(screen.getByRole('region', { name: 'Students joining' })).toHaveTextContent('Jamie')
    expect(screen.queryByText('No students yet.')).not.toBeInTheDocument()
  })

  it('Pull in opens an editor prefilled with the typed name and admits with the edited name', async () => {
    const user = userEvent.setup()
    const onAdmitJoining = vi.fn().mockResolvedValue(undefined)
    render(<StudentGrid {...mkProps({ joiningStudents: JOINING, onAdmitJoining })} />)

    await user.click(screen.getByRole('button', { name: 'Pull in Jamie' }))
    const input = screen.getByRole('textbox', { name: 'Name to join with' })
    expect(input).toHaveValue('Jamie')
    expect(input).toHaveAttribute('maxLength', '30')

    await user.clear(input)
    await user.type(input, '  Jamie B  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdmitJoining).toHaveBeenCalledTimes(1)
    expect(onAdmitJoining).toHaveBeenCalledWith('t1', 'Jamie B')
    expect(screen.queryByRole('textbox', { name: 'Name to join with' })).not.toBeInTheDocument()
  })

  it('cannot admit with an empty name, and Cancel closes the editor', async () => {
    const user = userEvent.setup()
    const onAdmitJoining = vi.fn()
    render(<StudentGrid {...mkProps({ joiningStudents: JOINING, onAdmitJoining })} />)

    await user.click(screen.getByRole('button', { name: 'Pull in Someone' }))
    expect(screen.getByRole('textbox', { name: 'Name to join with' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox', { name: 'Name to join with' })).not.toBeInTheDocument()
    expect(onAdmitJoining).not.toHaveBeenCalled()
  })

  it('Hide names masks the typed names', async () => {
    const user = userEvent.setup()
    render(<StudentGrid {...mkProps({ joiningStudents: JOINING })} />)
    await user.click(screen.getByRole('button', { name: 'Hide names' }))
    const list = screen.getByRole('region', { name: 'Students joining' })
    expect(within(list).queryByText('Jamie')).not.toBeInTheDocument()
    expect(within(list).getAllByText('Someone')).toHaveLength(2)
  })

  it('shows no Pull in button without an admit handler', () => {
    render(<StudentGrid {...mkProps({ joiningStudents: JOINING })} />)
    expect(screen.queryByRole('button', { name: /Pull in/ })).not.toBeInTheDocument()
  })
})
