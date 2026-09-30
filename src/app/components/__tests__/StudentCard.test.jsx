import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentCard from '../StudentCard'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  LEGACY_QUIZ_TASKS,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  PYTHON_CODE_ARRANGE_TASK,
  SHORT_ANSWER_TASK,
} from '../../../test/fixtures/legacyActivityTasks'

vi.mock('../QuizTask', () => ({
  getQuizOptionText: (_task, answer) => (answer ? `Text for ${answer}` : ''),
  CONFIDENCE_COLOURS: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
}))

vi.mock('../../../shared/markdown', () => ({
  InlineMarkdown: ({ content }) => <span>{content}</span>,
}))

const BASE_STUDENT = {
  anonymousId: 'student-1',
  displayName: 'Jamie',
  online: true,
  lastRunStatus: null,
  currentCode: '',
  currentOutput: '',
  currentFiles: null,
  currentAnswer: null,
  checkPassed: null,
  inPersonalSandbox: null,
}

const PYTHON_LESSON = {
  type: 'python',
  tasks: [{ id: 1, title: 'Task 1' }],
}

const LESSON_WITH_CHECK = {
  type: 'python',
  tasks: [{ id: 1, title: 'Task 1', check: { type: 'output_contains', value: 'hello' } }],
}

const ACTIVE_SESSION = { state: 'active', currentTaskId: 1 }

function mkProps(overrides = {}, studentOverrides = {}) {
  return {
    student: { ...BASE_STUDENT, ...studentOverrides },
    lesson: PYTHON_LESSON,
    lessonId: 'lesson-1',
    session: ACTIVE_SESSION,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onExpand: vi.fn(),
    ...overrides,
  }
}

describe('StudentCard', () => {
  it('renders the student display name', () => {
    render(<StudentCard {...mkProps()} />)
    expect(screen.getByText('Jamie')).toBeInTheDocument()
  })

  it('flags a large paste on the current task only', () => {
    const { unmount } = render(
      <StudentCard {...mkProps({}, { pasteLog: { 1: { count: 2, chars: 120 } } })} />
    )
    expect(screen.getByText('📋 Pasted ×2')).toBeInTheDocument()
    unmount()
    render(<StudentCard {...mkProps({}, { pasteLog: { 7: { count: 1, chars: 50 } } })} />)
    expect(screen.queryByText(/Pasted/)).not.toBeInTheDocument()
  })

  describe('nudge', () => {
    it('offers a nudge button only while the student is Away', () => {
      const { unmount } = render(<StudentCard {...mkProps({ onNudge: vi.fn() })} />)
      expect(screen.queryByRole('button', { name: 'Nudge Jamie' })).not.toBeInTheDocument()
      unmount()
      render(<StudentCard {...mkProps({ onNudge: vi.fn() }, { windowFocused: false })} />)
      expect(screen.getByRole('button', { name: 'Nudge Jamie' })).toBeInTheDocument()
    })

    it('nudges without expanding the card', async () => {
      const user = userEvent.setup()
      const props = mkProps({ onNudge: vi.fn() }, { windowFocused: false })
      render(<StudentCard {...props} />)
      await user.click(screen.getByRole('button', { name: 'Nudge Jamie' }))
      expect(props.onNudge).toHaveBeenCalledWith('student-1')
      expect(props.onExpand).not.toHaveBeenCalled()
    })
  })

  describe('presence badge', () => {
    // Online is the default and is already carried by the status dot. Spending a badge
    // on it put a green pill on every card in the column, which is the same noise the
    // electronics status strip made by printing "0 motors on".
    it('does not badge Online when the student is simply connected', () => {
      render(<StudentCard {...mkProps()} />)
      expect(screen.queryByText('Online')).not.toBeInTheDocument()
    })

    it('shows Offline when student is disconnected', () => {
      render(<StudentCard {...mkProps({}, { online: false })} />)
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('shows Waiting when the session state is waiting', () => {
      render(<StudentCard {...mkProps({ session: { state: 'waiting', currentTaskId: 1 } })} />)
      expect(screen.getByText('Waiting')).toBeInTheDocument()
    })
  })

  describe('check badges', () => {
    it('shows the Passed badge when checkPassed and the task has a check', () => {
      render(
        <StudentCard
          {...mkProps(
            { lesson: LESSON_WITH_CHECK },
            { checkPassed: true, lastRunStatus: 'success' }
          )}
        />
      )
      expect(screen.getByText('Passed')).toBeInTheDocument()
    })

    it('shows the Failed badge when a run was attempted but check not passed', () => {
      render(
        <StudentCard
          {...mkProps(
            { lesson: LESSON_WITH_CHECK },
            { checkPassed: false, lastRunStatus: 'error' }
          )}
        />
      )
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('shows no check badge during a teacher-started sandbox, even if the session task has a check', () => {
      render(
        <StudentCard
          {...mkProps(
            { lesson: LESSON_WITH_CHECK, session: { state: 'sandbox', currentTaskId: 1 } },
            { checkPassed: false, lastRunStatus: 'success' }
          )}
        />
      )
      expect(screen.queryByText('Passed')).not.toBeInTheDocument()
      expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    })

    it('shows no check badge when the task has no check defined', () => {
      render(<StudentCard {...mkProps({}, { lastRunStatus: 'success', checkPassed: false })} />)
      expect(screen.queryByText('Passed')).not.toBeInTheDocument()
      expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    })

    it('shows the Sandbox badge when the student is in personal sandbox', () => {
      render(<StudentCard {...mkProps({}, { inPersonalSandbox: true })} />)
      expect(screen.getByText('Sandbox')).toBeInTheDocument()
    })

    it('shows the Fullscreen badge when the student is in fullscreen mode', () => {
      render(<StudentCard {...mkProps({}, { isFullscreen: true })} />)
      expect(screen.getByText('⛶ Fullscreen')).toBeInTheDocument()
    })

    it('shows no Fullscreen badge when the student is not in fullscreen mode', () => {
      render(<StudentCard {...mkProps({}, { isFullscreen: false })} />)
      expect(screen.queryByText('⛶ Fullscreen')).not.toBeInTheDocument()
    })
  })

  describe('quiz answer display', () => {
    const QUIZ_LESSON = {
      type: 'python',
      tasks: [
        {
          id: 1,
          taskType: 'quiz',
          quizType: 'multiple_choice',
          title: 'Quiz',
          options: [{ id: 'a', text: 'Option A' }],
        },
      ],
    }

    it('shows the answer ID and option text for a multiple-choice response', () => {
      render(
        <StudentCard
          {...mkProps({ lesson: QUIZ_LESSON }, { currentAnswer: 'a', lastRunStatus: 'submitted' })}
        />
      )
      expect(screen.getByText('a')).toBeInTheDocument()
    })

    it('shows "No answer yet" when the student has not answered', () => {
      render(<StudentCard {...mkProps({ lesson: QUIZ_LESSON })} />)
      expect(screen.getByText('No answer yet')).toBeInTheDocument()
    })

    it('preserves line breaks in short-answer responses', () => {
      const shortAnswerLesson = {
        type: 'python',
        tasks: [
          {
            id: 1,
            taskType: 'quiz',
            quizType: 'short_answer',
            title: 'Quiz',
          },
        ],
      }

      render(
        <StudentCard
          {...mkProps(
            { lesson: shortAnswerLesson },
            { currentAnswer: 'line one\nline two', lastRunStatus: 'submitted' }
          )}
        />
      )

      const answer = screen.getByText(
        (_, element) => element?.tagName === 'SPAN' && element.textContent === 'line one\nline two'
      )

      expect(answer).toHaveStyle({ whiteSpace: 'pre-wrap' })
    })
  })

  describe('expand button', () => {
    it('calls onExpand with the student object when clicked', async () => {
      const user = userEvent.setup()
      const props = mkProps()
      render(<StudentCard {...props} />)
      await user.click(screen.getByRole('button', { name: /expand/i }))
      expect(props.onExpand).toHaveBeenCalledWith(props.student)
    })

    it('does not render the expand button for information tasks', () => {
      const infoLesson = {
        type: 'python',
        tasks: [{ id: 1, taskType: 'information', title: 'Intro' }],
      }
      render(<StudentCard {...mkProps({ lesson: infoLesson })} />)
      expect(screen.queryByRole('button', { name: /expand/i })).not.toBeInTheDocument()
    })
  })

  describe('visible panes badge', () => {
    it('labels Scratch pane ids', () => {
      render(<StudentCard {...mkProps({}, { visiblePanes: ['instructions', 'blocks'] })} />)
      expect(screen.getByText('👀 Info + Blocks')).toBeInTheDocument()
    })

    it('labels Electronics, Python, Arcade and HTML pane ids', () => {
      render(<StudentCard {...mkProps({}, { visiblePanes: ['breadboard'] })} />)
      expect(screen.getByText('👀 Breadboard')).toBeInTheDocument()
    })

    it('labels console, running and preview toggle states', () => {
      render(<StudentCard {...mkProps({}, { visiblePanes: ['code', 'console'] })} />)
      expect(screen.getByText('👀 Code + Console')).toBeInTheDocument()
    })

    it('passes an unmapped pane id (e.g. an HTML file name) through as-is', () => {
      render(<StudentCard {...mkProps({}, { visiblePanes: ['index.html', 'preview'] })} />)
      expect(screen.getByText('👀 index.html + Preview')).toBeInTheDocument()
    })

    it('shows no badge when visiblePanes is empty', () => {
      render(<StudentCard {...mkProps({}, { visiblePanes: [] })} />)
      expect(screen.queryByText(/👀/)).not.toBeInTheDocument()
    })
  })

  describe('rename form', () => {
    it('calls onRename with anonymousId and the new trimmed name on form submit', () => {
      const props = mkProps()
      render(<StudentCard {...props} />)
      fireEvent.click(screen.getByTitle('Rename student'))
      const input = screen.getByDisplayValue('Jamie')
      fireEvent.change(input, { target: { value: '  Alex  ' } })
      fireEvent.submit(input.closest('form'))
      expect(props.onRename).toHaveBeenCalledWith('student-1', 'Alex')
    })

    it('falls back to the original name if the input is cleared', () => {
      const props = mkProps()
      render(<StudentCard {...props} />)
      fireEvent.click(screen.getByTitle('Rename student'))
      const input = screen.getByDisplayValue('Jamie')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.submit(input.closest('form'))
      expect(props.onRename).toHaveBeenCalledWith('student-1', 'Jamie')
    })
  })

  // A composed lesson's envelope type is 'composed', so the module has to be resolved from
  // the task's own moduleType. Before this was fixed every code task in a composed lesson
  // (27 of the 28 published lessons) fell through to the HTML fallback.
  describe('composed lessons', () => {
    const composedLesson = (moduleType) => ({
      type: 'composed',
      tasks: [{ id: 1, title: 'Task 1', moduleType }],
    })

    it('shows the output snippet for a Python task rather than the HTML fallback', () => {
      render(
        <StudentCard
          {...mkProps({ lesson: composedLesson('python') }, { currentOutput: 'Hello from Python' })}
        />
      )
      expect(screen.getByText(/Hello from Python/)).toBeInTheDocument()
      expect(screen.queryByText('No run yet')).not.toBeInTheDocument()
    })

    it('shows "No output yet" for a Python task that has not run', () => {
      render(<StudentCard {...mkProps({ lesson: composedLesson('python') })} />)
      expect(screen.getByText('No output yet')).toBeInTheDocument()
      expect(screen.queryByText('No run yet')).not.toBeInTheDocument()
    })

    it.each(['arcade', 'electronics'])('shows the output snippet for a %s task', (moduleType) => {
      render(
        <StudentCard
          {...mkProps({ lesson: composedLesson(moduleType) }, { currentOutput: 'device ready' })}
        />
      )
      expect(screen.getByText(/device ready/)).toBeInTheDocument()
      expect(screen.queryByText('No run yet')).not.toBeInTheDocument()
    })

    it('shows block state for a Scratch task rather than the HTML fallback', () => {
      render(
        <StudentCard
          {...mkProps({ lesson: composedLesson('scratch') }, { currentCode: '{"blocks":[]}' })}
        />
      )
      expect(screen.getByText('Blocks edited')).toBeInTheDocument()
      expect(screen.queryByText('HTML project')).not.toBeInTheDocument()
    })

    it('still shows the HTML fallback for an HTML task', () => {
      render(
        <StudentCard
          {...mkProps(
            { lesson: composedLesson('html') },
            { currentFiles: [{ name: 'index.html' }] }
          )}
        />
      )
      expect(screen.getByText('HTML project')).toBeInTheDocument()
    })
  })

  // The wall runs in a ~283px single column at eight students. A full-width Expand
  // button cost ~45px on every card and carried nothing about the student it belonged to.
  describe('opening a student', () => {
    it('opens the student when the card itself is clicked', async () => {
      const user = userEvent.setup()
      const props = mkProps()
      render(<StudentCard {...props} />)
      await user.click(screen.getByRole('button', { name: /expand jamie/i }))
      expect(props.onExpand).toHaveBeenCalled()
    })

    it('does not open the student when the rename control is used', async () => {
      const user = userEvent.setup()
      const props = mkProps()
      render(<StudentCard {...props} />)
      await user.click(screen.getByTitle('Rename student'))
      expect(props.onExpand).not.toHaveBeenCalled()
    })

    it('leaves an information task inert', () => {
      const lesson = {
        type: 'python',
        tasks: [{ id: 1, title: 'Task 1', taskType: 'information' }],
      }
      render(<StudentCard {...mkProps({ lesson })} />)
      expect(screen.queryByRole('button', { name: /expand/i })).not.toBeInTheDocument()
    })
  })
  describe('workspace share badge', () => {
    it('shows Sharing when the student has a pending share request', () => {
      render(<StudentCard {...mkProps({}, { shareRequestedAt: 1700000000000 })} />)
      expect(screen.getByText('Sharing')).toBeInTheDocument()
    })

    it('does not show Sharing when there is no pending request', () => {
      render(<StudentCard {...mkProps()} />)
      expect(screen.queryByText('Sharing')).not.toBeInTheDocument()
    })
  })

  describe('live viewing-a-share badge', () => {
    const sessionWithShare = {
      ...ACTIVE_SESSION,
      sharedWorkspaces: { 'share-1': { sharerName: 'Alex' } },
    }

    it("shows who a connected student is currently viewing another student's share", () => {
      render(
        <StudentCard
          {...mkProps({ session: sessionWithShare }, { viewingShareId: 'share-1', online: true })}
        />
      )
      expect(screen.getByTitle('Viewing Alex shared work')).toBeInTheDocument()
    })

    it('does not show the badge once the student is offline, even if the field is stale', () => {
      render(
        <StudentCard
          {...mkProps({ session: sessionWithShare }, { viewingShareId: 'share-1', online: false })}
        />
      )
      expect(screen.queryByTitle('Viewing Alex shared work')).not.toBeInTheDocument()
    })

    it('does not show the badge when no share is being viewed', () => {
      render(<StudentCard {...mkProps({ session: sessionWithShare }, { online: true })} />)
      expect(screen.queryByTitle('Viewing Alex shared work')).not.toBeInTheDocument()
    })
  })

  describe('item progress badge', () => {
    const matchLesson = {
      type: 'python',
      tasks: [
        {
          id: 1,
          taskType: 'quiz',
          quizType: 'match',
          pairs: [
            { id: 'p1', prompt: 'a', answer: 'A' },
            { id: 'p2', prompt: 'b', answer: 'B' },
            { id: 'p3', prompt: 'c', answer: 'C' },
          ],
        },
      ],
    }

    it('shows filled and correct counts for a match quiz in progress', () => {
      render(
        <StudentCard
          {...mkProps({ lesson: matchLesson }, { currentAnswer: '{"p1":"p1","p2":"p3"}' })}
        />
      )
      expect(screen.getByTestId('item-progress')).toHaveTextContent('2/3 filled · 1 correct')
    })

    it('shows a slots-filled count for a code arrange task', () => {
      const lesson = {
        type: 'python',
        tasks: [
          {
            id: 1,
            taskType: 'code_arrange',
            lines: [
              {
                parts: [
                  { type: 'slot', id: 's1' },
                  { type: 'slot', id: 's2' },
                ],
              },
            ],
          },
        ],
      }
      render(<StudentCard {...mkProps({ lesson }, { currentCodeArrangeSlots: { s1: 's1' } })} />)
      expect(screen.getByTestId('item-progress')).toHaveTextContent('1/2 slots filled')
    })

    it('shows an Assisted badge only for the task the teacher edited', () => {
      const { rerender } = render(
        <StudentCard {...mkProps({ lesson: matchLesson }, { teacherAssistedTaskId: 1 })} />
      )
      expect(screen.getByTestId('teacher-assisted')).toHaveTextContent('Assisted')
      rerender(<StudentCard {...mkProps({ lesson: matchLesson }, { teacherAssistedTaskId: 2 })} />)
      expect(screen.queryByTestId('teacher-assisted')).not.toBeInTheDocument()
    })

    it('is absent for ordinary code tasks', () => {
      render(<StudentCard {...mkProps()} />)
      expect(screen.queryByTestId('item-progress')).not.toBeInTheDocument()
    })
  })

  // Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
  // what the teacher's card shows from the mirrored currentAnswer /
  // currentCodeArrangeSlots for each legacy fixture. (getQuizOptionText is mocked
  // file-wide above, so multiple choice shows "Text for <id>".)
  describe('characterisation: legacy quiz + code_arrange fixtures', () => {
    const fixtureLesson = {
      type: 'python',
      tasks: [...Object.values(LEGACY_QUIZ_TASKS), PYTHON_CODE_ARRANGE_TASK],
    }
    function renderTask(taskId, student = {}, session = { state: 'active' }) {
      return render(
        <StudentCard
          {...mkProps(
            { lesson: fixtureLesson, session: { ...session, currentTaskId: taskId } },
            student
          )}
        />
      )
    }

    it('shows "No answer yet" for every quiz sub-type with a null or empty answer', () => {
      for (const task of Object.values(LEGACY_QUIZ_TASKS)) {
        for (const currentAnswer of [null, '']) {
          const { unmount } = renderTask(task.id, { currentAnswer })
          expect(screen.getByText('No answer yet')).toBeInTheDocument()
          unmount()
        }
      }
    })

    it('multiple_choice shows the option id and its text; submitted results badge the card', () => {
      renderTask(MULTIPLE_CHOICE_TASK.id, {
        currentAnswer: 'b',
        lastRunStatus: 'submitted',
        checkPassed: false,
      })
      expect(screen.getByText('b')).toBeInTheDocument()
      expect(screen.getByText('Text for b')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it.each([
      [{ lastRunStatus: null, checkPassed: null }, 'In progress…'],
      [{ lastRunStatus: 'submitted', checkPassed: null }, 'Answered'],
      [{ lastRunStatus: 'submitted', checkPassed: false }, '✗ Some incorrect'],
      [{ lastRunStatus: 'submitted', checkPassed: true }, '✓ All correct'],
      // checkPassed true wins even before a submitted run status.
      [{ lastRunStatus: null, checkPassed: true }, '✓ All correct'],
    ])('match / fill_blank summarise %o as %s', (student, label) => {
      for (const [task, currentAnswer] of [
        [MATCH_TASK, '{"p1":"p1"}'],
        [FILL_BLANK_DRAG_TASK, '{"b1":"b1"}'],
        [FILL_BLANK_TYPE_TASK, '{"t1":"loop"}'],
      ]) {
        const { unmount } = renderTask(task.id, { currentAnswer, ...student })
        expect(screen.getByText(label)).toBeInTheDocument()
        unmount()
      }
    })

    it('match / fill_blank show per-item progress from the mirrored answer', () => {
      const { unmount } = renderTask(MATCH_TASK.id, { currentAnswer: '{"p1":"p1","p2":"p3"}' })
      expect(screen.getByTestId('item-progress')).toHaveTextContent('🧩 2/3 filled · 1 correct')
      unmount()
      renderTask(FILL_BLANK_DRAG_TASK.id, { currentAnswer: '{"b1":"b1","b2":"d1"}' })
      expect(screen.getByTestId('item-progress')).toHaveTextContent('🧩 2/2 filled · 1 correct')
    })

    it('short_answer shows the raw answer text', () => {
      renderTask(SHORT_ANSWER_TASK.id, { currentAnswer: 'It shows text' })
      expect(screen.getByText('It shows text')).toBeInTheDocument()
    })

    it('confidence shows the level out of 5, and no pass/fail badge even once submitted', () => {
      const { unmount } = renderTask(CONFIDENCE_TASK.id, {
        currentAnswer: '4',
        lastRunStatus: 'submitted',
        checkPassed: true,
      })
      expect(screen.getByText('4/5')).toBeInTheDocument()
      expect(screen.queryByText('Passed')).not.toBeInTheDocument()
      unmount()
      // A non-numeric answer is not guarded.
      renderTask(CONFIDENCE_TASK.id, { currentAnswer: 'abc' })
      expect(screen.getByText('NaN/5')).toBeInTheDocument()
    })

    it('hides the quiz answer area during a teacher-started sandbox', () => {
      renderTask(SHORT_ANSWER_TASK.id, { currentAnswer: 'It shows text' }, { state: 'sandbox' })
      expect(screen.queryByText('It shows text')).not.toBeInTheDocument()
      expect(screen.queryByText('No answer yet')).not.toBeInTheDocument()
    })

    it('code_arrange shows slot progress from currentCodeArrangeSlots, not a quiz answer', () => {
      renderTask(PYTHON_CODE_ARRANGE_TASK.id, {
        currentCodeArrangeSlots: { S1: 'S1' },
        currentAnswer: 'ignored',
      })
      expect(screen.getByTestId('item-progress')).toHaveTextContent('🧩 1/2 slots filled')
      expect(screen.queryByText('ignored')).not.toBeInTheDocument()
    })
  })
})

describe('StudentCard live badges (teacher-only)', () => {
  it('shows nothing with no badges or suggestions', () => {
    render(<StudentCard {...mkProps()} />)
    expect(screen.queryByTestId('badge-count')).not.toBeInTheDocument()
  })

  it('shows the awarded count and a dot while a suggestion is pending', () => {
    render(<StudentCard {...mkProps({ badgeAwardedCount: 2, badgePendingCount: 1 })} />)
    const count = screen.getByTestId('badge-count')
    expect(count).toHaveTextContent('🏅 2')
    expect(count).toHaveAccessibleName('2 badges awarded, badge suggestion waiting')
    expect(screen.getByTestId('badge-pending-dot')).toBeInTheDocument()
  })

  it('shows the dot without a count before any award', () => {
    render(<StudentCard {...mkProps({ badgePendingCount: 3 })} />)
    expect(screen.getByTestId('badge-count')).toHaveTextContent(/^🏅$/)
    expect(screen.getByTestId('badge-pending-dot')).toBeInTheDocument()
  })

  it('toggles selection instead of expanding in select mode', async () => {
    const user = userEvent.setup()
    const onExpand = vi.fn()
    const onToggleSelect = vi.fn()
    render(
      <StudentCard {...mkProps({ onExpand, onToggleSelect, selectMode: true, selected: true })} />
    )
    const card = screen.getByRole('checkbox', { name: 'Select Jamie' })
    expect(card).toHaveAttribute('aria-checked', 'true')
    await user.click(card)
    expect(onToggleSelect).toHaveBeenCalledWith('student-1')
    expect(onExpand).not.toHaveBeenCalled()
    card.focus()
    await user.keyboard(' ')
    expect(onToggleSelect).toHaveBeenCalledTimes(2)
  })
})
