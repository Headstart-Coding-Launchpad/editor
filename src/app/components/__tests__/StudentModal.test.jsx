import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StudentModal from '../StudentModal'

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))

vi.mock('../../../shared/iframe', () => ({
  buildIframeSrc: vi.fn(() => 'blob:mock-iframe'),
  waitForIframeText: vi.fn(),
}))

vi.mock('../ScratchWorkspace', () => ({
  default: () => <div data-testid="scratch-workspace" />,
}))

vi.mock('../FilesystemTask', () => ({
  default: () => <div data-testid="filesystem-task" />,
}))

vi.mock('../IframePreview', () => ({
  default: () => <div data-testid="iframe-preview" />,
}))

vi.mock('../QuizTask', () => ({
  default: ({ task, selectedAnswer }) => (
    <div data-testid="quiz-task">
      <span>{task?.title}</span>
      <span>{selectedAnswer}</span>
    </div>
  ),
}))

vi.mock('../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output-panel">{output}</div>,
}))

vi.mock('../ExplainerPanel', () => ({
  default: ({ content }) => <div data-testid="explainer-panel">{content}</div>,
}))

vi.mock('../LiveActivityToast', () => ({
  default: () => null,
}))

vi.mock('../../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library-dialog" />,
}))
vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div>{content}</div>,
}))

const BASE_STUDENT = {
  anonymousId: 'student-1',
  displayName: 'Jamie',
  online: true,
  checkPassed: false,
  currentCode: 'print("hello")',
  currentOutput: 'hello',
  lastRunStatus: 'success',
  currentFiles: null,
  currentAnswer: null,
  currentActivity: null,
  currentActiveFile: null,
  currentSelection: null,
}

const PYTHON_LESSON = {
  type: 'python',
  tasks: [{ id: 1, title: 'Task 1' }],
}

const ACTIVE_SESSION = { state: 'active', currentTaskId: 1 }

function mkProps(overrides = {}, studentOverrides = {}) {
  return {
    student: { ...BASE_STUDENT, ...studentOverrides },
    lesson: PYTHON_LESSON,
    session: ACTIVE_SESSION,
    isLive: false,
    isLiveForAll: false,
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onClose: vi.fn(),
    hasPrev: false,
    hasNext: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onRemoteReset: vi.fn(),
    ...overrides,
  }
}

describe('StudentModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the student display name', () => {
    render(<StudentModal {...mkProps()} />)
    expect(screen.getByText('Jamie')).toBeInTheDocument()
  })

  it('renders the presence badge', () => {
    render(<StudentModal {...mkProps()} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('renders the check badge when checkPassed is true', () => {
    render(<StudentModal {...mkProps({}, { checkPassed: true })} />)
    expect(screen.getByText('✅')).toBeInTheDocument()
  })

  it('does not render the check badge when checkPassed is false', () => {
    render(<StudentModal {...mkProps()} />)
    expect(screen.queryByText('✅')).not.toBeInTheDocument()
  })

  describe('live badge', () => {
    it('shows the LIVE badge when isLive is true', () => {
      render(<StudentModal {...mkProps({ isLive: true })} />)
      expect(screen.getByText(/LIVE/)).toBeInTheDocument()
    })

    it('shows LIVE FOR ALL when both isLive and isLiveForAll are true', () => {
      render(<StudentModal {...mkProps({ isLive: true, isLiveForAll: true })} />)
      expect(screen.getByText(/LIVE FOR ALL/)).toBeInTheDocument()
    })

    it('does not show the LIVE badge when isLive is false', () => {
      render(<StudentModal {...mkProps()} />)
      expect(screen.queryByText(/LIVE/)).not.toBeInTheDocument()
    })
  })

  describe('closing the modal', () => {
    it('calls onClose when the close button is clicked', async () => {
      const user = userEvent.setup()
      const props = mkProps()
      render(<StudentModal {...props} />)
      await user.click(screen.getByRole('button', { name: /close/i }))
      expect(props.onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when the Escape key is pressed', async () => {
      const user = userEvent.setup()
      const props = mkProps()
      render(<StudentModal {...props} />)
      await user.keyboard('{Escape}')
      expect(props.onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when the overlay backdrop is clicked directly', () => {
      const props = mkProps()
      render(<StudentModal {...props} />)
      // The overlay div carries role="dialog"; clicking it directly (not a child) triggers onClose
      fireEvent.click(screen.getByRole('dialog'))
      expect(props.onClose).toHaveBeenCalledOnce()
    })
  })

  describe('navigation buttons', () => {
    it('disables the Prev button when hasPrev is false', () => {
      render(<StudentModal {...mkProps({ hasPrev: false })} />)
      expect(screen.getByTitle('Previous student')).toBeDisabled()
    })

    it('enables the Prev button when hasPrev is true', () => {
      render(<StudentModal {...mkProps({ hasPrev: true })} />)
      expect(screen.getByTitle('Previous student')).not.toBeDisabled()
    })

    it('calls onPrev when Prev button is clicked', async () => {
      const user = userEvent.setup()
      const props = mkProps({ hasPrev: true })
      render(<StudentModal {...props} />)
      await user.click(screen.getByTitle('Previous student'))
      expect(props.onPrev).toHaveBeenCalledOnce()
    })

    it('calls onNext when Next button is clicked', async () => {
      const user = userEvent.setup()
      const props = mkProps({ hasNext: true })
      render(<StudentModal {...props} />)
      await user.click(screen.getByTitle('Next student'))
      expect(props.onNext).toHaveBeenCalledOnce()
    })
  })

  describe('remote reset stage options', () => {
    const LESSON_WITH_STAGES = {
      type: 'python',
      tasks: [{
        id: 1,
        title: 'Task 1',
        completeCode: 'print("done")',
        codeStages: [{ label: 'Stage 1', code: 'x = 1' }],
      }],
    }

    it('renders the Set Stage button when stages are available', () => {
      render(<StudentModal {...mkProps({ lesson: LESSON_WITH_STAGES })} />)
      expect(screen.getByRole('button', { name: /Set Stage/i })).toBeInTheDocument()
    })

    it('opens the stage dropdown and shows stage options when clicked', async () => {
      const user = userEvent.setup()
      render(<StudentModal {...mkProps({ lesson: LESSON_WITH_STAGES })} />)
      await user.click(screen.getByRole('button', { name: /Set Stage/i }))
      expect(screen.getByRole('button', { name: 'Starter code' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Stage 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Complete code' })).toBeInTheDocument()
    })

    it('requests student consent and shows waiting state when a stage is selected', async () => {
      const user = userEvent.setup()
      const onRequestTeacherStage = vi.fn()
      const props = mkProps({ lesson: LESSON_WITH_STAGES, onRequestTeacherStage })
      render(<StudentModal {...props} />)
      await user.click(screen.getByRole('button', { name: /Set Stage/i }))
      await user.click(screen.getByRole('button', { name: 'Starter code' }))
      expect(onRequestTeacherStage).toHaveBeenCalledWith('student-1', 'starter')
      expect(screen.getByText(/Waiting for Jamie/i)).toBeInTheDocument()
      expect(props.onRemoteReset).not.toHaveBeenCalled()
    })

    it('applies stage change and calls onRemoteReset when student accepts', async () => {
      const user = userEvent.setup()
      const onRequestTeacherStage = vi.fn()
      const onClearTeacherStage = vi.fn()
      const props = mkProps({ lesson: LESSON_WITH_STAGES, onRequestTeacherStage, onClearTeacherStage })
      const { rerender } = render(<StudentModal {...props} />)
      await user.click(screen.getByRole('button', { name: /Set Stage/i }))
      await user.click(screen.getByRole('button', { name: 'Starter code' }))
      rerender(<StudentModal {...props} student={{ ...props.student, teacherStageRequestedAt: 1, teacherStageAcceptedAt: 2 }} />)
      expect(props.onRemoteReset).toHaveBeenCalledWith('student-1', 'starter')
      expect(onClearTeacherStage).toHaveBeenCalledWith('student-1')
    })
  })
})
