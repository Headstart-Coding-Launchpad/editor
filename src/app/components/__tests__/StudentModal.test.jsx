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

vi.mock('../../../modules/scratch/ScratchWorkspace.jsx', () => ({
  default: () => <div data-testid="scratch-workspace" />,
  SPRITE_TYPES: [],
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

const SCRATCH_LESSON = {
  type: 'scratch',
  tasks: [{ id: 1, title: 'Scratch Task', starterBlocks: { sprite1: { blocks: [] } } }],
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

const CODE_ARRANGE_LESSON = {
  type: 'python',
  tasks: [{
    id: 1,
    title: 'Arrange Task',
    taskType: 'code_arrange',
    moduleType: 'python',
    lines: [
      { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print(1)' }] },
      { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'print(2)' }] },
    ],
    distractors: [{ id: 'D1', code: 'print(99)' }],
  }],
}

describe('code_arrange tasks', () => {
  it('renders the tile board matching the student\'s assembled code, not a raw code editor', () => {
    render(<StudentModal {...mkProps(
      { lesson: CODE_ARRANGE_LESSON },
      { currentCode: 'print(1)\nprint(2)' }
    )} />)

    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    // Both tiles are placed in their slots — the distractor stays in the pool.
    expect(screen.getAllByText('print(1)')).toHaveLength(1)
    expect(screen.getAllByText('print(2)')).toHaveLength(1)
    expect(screen.getByText('print(99)')).toBeInTheDocument()
  })

  it('shows empty slots when the student has not placed any tiles yet', () => {
    render(<StudentModal {...mkProps(
      { lesson: CODE_ARRANGE_LESSON },
      { currentCode: '' }
    )} />)

    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    expect(screen.getAllByText('Empty line')).toHaveLength(2)
  })

  it('shows the live code editor, not the stale tile board, once the session is in sandbox mode', () => {
    render(<StudentModal {...mkProps(
      { lesson: CODE_ARRANGE_LESSON, session: { state: 'sandbox', currentTaskId: 1 } },
      { currentCode: 'print("free code")' }
    )} />)

    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    expect(screen.queryByText('print(1)')).not.toBeInTheDocument()
  })
})

describe('StudentModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['HTML', { type: 'html', tasks: [{ id: 1, title: 'HTML task', starterFiles: [{ name: 'index.html', type: 'html', content: '<p>Hello</p>' }] }] }],
    ['ArcadeKit', { type: 'arcade', tasks: [{ id: 1, title: 'Arcade task', starterCode: 'game.run()' }] }],
    ['Electronics', { type: 'electronics', tasks: [{ id: 1, title: 'Circuit task' }] }],
    ['a composed ArcadeKit task', { type: 'composed', tasks: [{ id: 1, moduleType: 'arcade', title: 'Arcade task', starterCode: 'game.run()' }] }],
  ])('offers teacher live editing for %s workspaces', async (_name, lesson) => {
    const user = userEvent.setup()
    const onRequestTeacherEdit = vi.fn()
    render(<StudentModal {...mkProps({ lesson, onRequestTeacherEdit })} />)

    await user.click(screen.getByRole('button', { name: /^More/ }))
    await user.click(screen.getByRole('button', { name: /Edit Code/i }))

    expect(onRequestTeacherEdit).toHaveBeenCalledWith('student-1')
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
      expect(screen.getByRole('button', { name: 'Starter' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Stage 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument()
    })

    it('requests student consent and shows waiting state when a stage is selected', async () => {
      const user = userEvent.setup()
      const onRequestTeacherStage = vi.fn()
      const props = mkProps({ lesson: LESSON_WITH_STAGES, onRequestTeacherStage })
      render(<StudentModal {...props} />)
      await user.click(screen.getByRole('button', { name: /Set Stage/i }))
      await user.click(screen.getByRole('button', { name: 'Starter' }))
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
      await user.click(screen.getByRole('button', { name: 'Starter' }))
      rerender(<StudentModal {...props} student={{ ...props.student, teacherStageRequestedAt: 1, teacherStageAcceptedAt: 2 }} />)
      expect(props.onRemoteReset).toHaveBeenCalledWith('student-1', 'starter')
      expect(onClearTeacherStage).toHaveBeenCalledWith('student-1')
    })
  })

  describe('Scratch lessons', () => {
    it('renders the Scratch workspace when opening the modal', () => {
      render(<StudentModal {...mkProps({
        lesson: SCRATCH_LESSON,
        session: ACTIVE_SESSION,
      }, {
        currentCode: JSON.stringify({ sprite1: { blocks: [] } }),
        currentOutput: JSON.stringify({ x: 0, y: 0 }),
      })} />)

      expect(screen.getByTestId('scratch-workspace')).toBeInTheDocument()
    })
  })
})
