import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentCard from '../StudentCard'

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

  describe('presence badge', () => {
    it('shows Online when student is connected', () => {
      render(<StudentCard {...mkProps()} />)
      expect(screen.getByText('Online')).toBeInTheDocument()
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
      render(<StudentCard {...mkProps({ lesson: LESSON_WITH_CHECK }, { checkPassed: true, lastRunStatus: 'success' })} />)
      expect(screen.getByText('Passed')).toBeInTheDocument()
    })

    it('shows the Failed badge when a run was attempted but check not passed', () => {
      render(<StudentCard {...mkProps({ lesson: LESSON_WITH_CHECK }, { checkPassed: false, lastRunStatus: 'error' })} />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
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
  })

  describe('quiz answer display', () => {
    const QUIZ_LESSON = {
      type: 'python',
      tasks: [{
        id: 1,
        taskType: 'quiz',
        quizType: 'multiple_choice',
        title: 'Quiz',
        options: [{ id: 'a', text: 'Option A' }],
      }],
    }

    it('shows the answer ID and option text for a multiple-choice response', () => {
      render(<StudentCard {...mkProps({ lesson: QUIZ_LESSON }, { currentAnswer: 'a', lastRunStatus: 'submitted' })} />)
      expect(screen.getByText('a')).toBeInTheDocument()
    })

    it('shows "No answer yet" when the student has not answered', () => {
      render(<StudentCard {...mkProps({ lesson: QUIZ_LESSON })} />)
      expect(screen.getByText('No answer yet')).toBeInTheDocument()
    })

    it('preserves line breaks in short-answer responses', () => {
      const shortAnswerLesson = {
        type: 'python',
        tasks: [{
          id: 1,
          taskType: 'quiz',
          quizType: 'short_answer',
          title: 'Quiz',
        }],
      }

      render(<StudentCard {...mkProps({ lesson: shortAnswerLesson }, { currentAnswer: 'line one\nline two', lastRunStatus: 'submitted' })} />)

      const answer = screen.getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === 'line one\nline two')

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
})
