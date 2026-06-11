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

    it('renders the stage dropdown with starter, stage, and complete options', () => {
      render(<StudentModal {...mkProps({ lesson: LESSON_WITH_STAGES })} />)
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Starter code' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Stage 1' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Complete code' })).toBeInTheDocument()
    })

    it('calls onRemoteReset with correct args after confirm', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const props = mkProps({ lesson: LESSON_WITH_STAGES })
      render(<StudentModal {...props} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'starter' } })
      expect(window.confirm).toHaveBeenCalled()
      expect(props.onRemoteReset).toHaveBeenCalledWith('student-1', 'starter')
    })

    it('does not call onRemoteReset when the confirm dialog is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const props = mkProps({ lesson: LESSON_WITH_STAGES })
      render(<StudentModal {...props} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'complete' } })
      expect(props.onRemoteReset).not.toHaveBeenCalled()
    })
  })
})
