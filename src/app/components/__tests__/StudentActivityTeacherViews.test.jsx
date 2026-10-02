import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentCard from '../StudentCard'
import StudentModal from '../StudentModal'
import { buildStageOptions } from '../../../shared/taskUtils'
import binary from '../../../activities/binary/definition.js'

// Teacher surfaces for hosted activity tasks (plan step 2.3): the card summary and device
// badge from currentAnswer, the modal's read-only/editable activity view, starter/complete
// reset options, and the Go Live restriction on quiz and activity tasks.

vi.mock('../../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library-dialog" />,
}))
vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div>{content}</div>,
  InlineMarkdown: ({ content }) => <span>{content}</span>,
}))
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <textarea data-testid="code-editor" readOnly value={value ?? ''} />,
}))

const BINARY = {
  id: 1,
  title: 'Make numbers',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [
    { id: 'a', target: 5 },
    { id: 'b', target: 2 },
  ],
}
const LESSON = { type: 'python', tasks: [BINARY, { id: 2, title: 'Code task' }] }
const SESSION = { state: 'active', currentTaskId: 1 }
const HALF_DONE = JSON.stringify({
  v: 1,
  items: { a: { bits: '0101', carries: '' }, b: { bits: '0000', carries: '' } },
})

const STUDENT = {
  anonymousId: 'student-1',
  displayName: 'Jamie',
  online: true,
  checkPassed: null,
  lastRunStatus: null,
  currentAnswer: HALF_DONE,
  currentCode: '',
  currentOutput: '',
  currentFiles: null,
}

function modalProps(overrides = {}, student = {}) {
  return {
    student: { ...STUDENT, ...student },
    lesson: LESSON,
    session: SESSION,
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
    onRequestTeacherStage: vi.fn(),
    ...overrides,
  }
}

describe('StudentCard on an activity task', () => {
  it("summarises the student's activity state", () => {
    render(<StudentCard student={STUDENT} lesson={LESSON} session={SESSION} />)
    expect(screen.getByTestId('activity-summary')).toHaveTextContent('1/2 correct')
    expect(screen.queryByTitle('Last run')).not.toBeInTheDocument()
  })

  it('says not started before any answer arrives', () => {
    render(
      <StudentCard
        student={{ ...STUDENT, currentAnswer: null }}
        lesson={LESSON}
        session={SESSION}
      />
    )
    expect(screen.getByTestId('activity-summary')).toHaveTextContent('Not started')
  })

  it('shows the marked result once submitted, and the device badge', () => {
    const touchAnswer = JSON.stringify({
      v: 1,
      device: { touch: true },
      items: {},
    })
    const lesson = {
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'Mouse',
          taskType: 'activity',
          activityType: 'mouse',
          targets: [{ id: 'star', label: 'star', x: 0.5, y: 0.5 }],
          items: [{ id: 'a', action: 'click', target: 'star' }],
        },
      ],
    }
    render(
      <StudentCard
        student={{
          ...STUDENT,
          currentAnswer: touchAnswer,
          lastRunStatus: 'submitted',
          checkPassed: false,
        }}
        lesson={lesson}
        session={SESSION}
      />
    )
    expect(screen.getByTestId('activity-device')).toHaveTextContent('Touch screen')
    expect(screen.getByLabelText('Failed')).toBeInTheDocument()
  })
})

describe('StudentModal on an activity task', () => {
  it("shows the student's activity read-only, without code tools or student Go Live", () => {
    render(<StudentModal {...modalProps({ onRemoteRun: vi.fn() })} />)
    const four = screen.getByRole('switch', { name: 'Bits 4 column' })
    expect(four).toHaveAttribute('aria-checked', 'true')
    expect(four).toBeDisabled()
    const more = screen.queryByRole('button', { name: /^More/ })
    if (more) fireEvent.click(more)
    expect(screen.queryByRole('button', { name: /Go Live for All/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Run on student' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Support/ }))
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument()
  })

  it('still lets the teacher stop a broadcast that is already running', () => {
    const onStopLive = vi.fn()
    render(<StudentModal {...modalProps({ isLive: true, isLiveForAll: true, onStopLive })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop Live' }))
    expect(onStopLive).toHaveBeenCalled()
  })

  it('lets the teacher edit the activity and pushes the serialised state', () => {
    const onTeacherAnswerEdit = vi.fn()
    render(<StudentModal {...modalProps({ onTeacherAnswerEdit })} />)
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit answers' }))
    // Question 1 is already right; move to question 2 and make 2.
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 2 column' }))
    const solved = {
      v: 1,
      items: { a: { bits: '0101', carries: '' }, b: { bits: '0010', carries: '' } },
    }
    expect(onTeacherAnswerEdit).toHaveBeenLastCalledWith('student-1', {
      answer: JSON.stringify(solved),
      passed: true,
    })
    expect(binary.grade(BINARY, solved).passed).toBe(true)
    // The teacher's edit shows immediately.
    expect(screen.getByRole('switch', { name: 'Bits 2 column' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('pushes a partial edit unmarked', () => {
    const onTeacherAnswerEdit = vi.fn()
    render(<StudentModal {...modalProps({ onTeacherAnswerEdit })} />)
    fireEvent.click(screen.getByRole('button', { name: '✏️ Edit answers' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 8 column' }))
    expect(onTeacherAnswerEdit).toHaveBeenLastCalledWith('student-1', {
      answer: expect.any(String),
      passed: null,
    })
  })

  it('offers Start again / Complete as the reset stages', () => {
    render(<StudentModal {...modalProps()} />)
    expect(buildStageOptions(BINARY, 'python')).toEqual([
      { value: 'starter', label: 'Start again' },
      { value: 'complete', label: 'Complete (show answers)' },
    ])
    fireEvent.click(screen.getByRole('button', { name: /^Support/ }))
    expect(screen.getByText('Set stage')).toBeInTheDocument()
  })
})

describe('Go Live restriction', () => {
  it('does not offer Go Live for All on a quiz task', () => {
    const lesson = {
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'Quiz',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          options: [{ id: 'a', text: 'A' }],
        },
      ],
    }
    render(<StudentModal {...modalProps({ lesson })} />)
    const more = screen.queryByRole('button', { name: /^More/ })
    if (more) fireEvent.click(more)
    expect(screen.queryByRole('button', { name: /Go Live for All/ })).not.toBeInTheDocument()
  })

  it('still offers Go Live for All on a code task', () => {
    const onGoLiveForAll = vi.fn()
    render(
      <StudentModal
        {...modalProps({ onGoLiveForAll, session: { ...SESSION, currentTaskId: 2 } })}
      />
    )
    const header = screen.getByRole('dialog')
    fireEvent.click(within(header).getByRole('button', { name: /^More/ }))
    fireEvent.click(within(header).getByRole('button', { name: '📡 Go Live for All' }))
    expect(onGoLiveForAll).toHaveBeenCalled()
  })

  it('also offers "Show to class (keep coding)", which broadcasts in panel mode', () => {
    const onGoLiveForAll = vi.fn()
    render(
      <StudentModal
        {...modalProps({ onGoLiveForAll, session: { ...SESSION, currentTaskId: 2 } })}
      />
    )
    const header = screen.getByRole('dialog')
    fireEvent.click(within(header).getByRole('button', { name: /^More/ }))
    fireEvent.click(within(header).getByRole('button', { name: '📺 Show to class (keep coding)' }))
    expect(onGoLiveForAll).toHaveBeenCalledWith('panel')
  })
})
