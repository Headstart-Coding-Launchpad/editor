import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StudentModal from '../../StudentModal'
import { studentCanSee } from '../studentCanSee'

// The "Student can see" strip (sketch OK'd 10 Nov 2026): one line under the tutor's action
// buttons saying what this student has open (Copy code, the Support stage they see, Complete),
// each item previewing, read-only, exactly what the student sees. Reads only data already
// logged; never writes.

vi.mock('../../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <textarea data-testid="code-editor" value={value ?? ''} readOnly />,
}))
vi.mock('../../../../modules/scratch/ScratchWorkspace.jsx', () => ({
  default: () => <div data-testid="scratch-workspace" />,
  SPRITE_TYPES: [],
}))
vi.mock('../../IframePreview', () => ({ default: () => <div data-testid="iframe-preview" /> }))
vi.mock('../../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output-panel">{output}</div>,
}))
vi.mock('../../ExplainerPanel', () => ({
  default: ({ content }) => <div data-testid="explainer-panel">{content}</div>,
}))
vi.mock('../../../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('../../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library-dialog" />,
}))
vi.mock('../../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div>{content}</div>,
}))

const AT_1432 = new Date(2026, 10, 10, 14, 32).getTime()
const AT_1441 = new Date(2026, 10, 10, 14, 41).getTime()

const TASK = {
  id: 3,
  title: 'Add up',
  explainer: 'Use a loop to add 0, 1 and 2',
  copyCode: 'score = 0\nfor i in range(3):',
  codeStages: [
    { role: 'starter', code: 'name = input("Name? ")\nprint(name)' },
    { role: 'support', label: 'Ask', code: 'name = input("Name? ")' },
    {
      role: 'support',
      label: 'Loop',
      show: 'change',
      code: 'score = 0\nfor i in range(3):\n    score = score + i',
    },
    {
      role: 'complete',
      code: 'name = input("Name? ")\nscore = 0\nfor i in range(3):\n    score = score + i\nprint(name, score)',
    },
  ],
}

const LESSON = { type: 'python', tasks: [{ id: 1, title: 'Warm up' }, TASK] }

const STUDENT = {
  anonymousId: 'sam',
  displayName: 'Sam R.',
  online: true,
  currentCode: 'name = input("Name? ")\nscore = 0\nprint(name, score)',
  currentOutput: '',
}

function renderModal(session = {}, overrides = {}) {
  const props = {
    student: STUDENT,
    lesson: LESSON,
    session: { state: 'active', currentTaskId: 3, ...session },
    isLive: true,
    isLiveForAll: false,
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onClose: vi.fn(),
    onRemoteReset: vi.fn(),
    onRevealSupportStage: vi.fn(),
    ...overrides,
  }
  render(<StudentModal {...props} />)
  return props
}

describe('Student can see strip: the fun moment', () => {
  it('says the student opened Support 2 at 14:32 and, on a click, shows the change view they see', () => {
    const props = renderModal({
      supportRevealLog: {
        sam: {
          3: {
            2: { source: 'student', stageLabel: 'Loop', revealedAt: AT_1432 },
            teacherLive: { source: 'teacher', revealedAt: AT_1441 },
          },
        },
      },
    })

    const strip = screen.getByTestId('student-can-see-strip')
    expect(strip).toHaveTextContent('Student can see')
    const items = within(strip).getAllByRole('button')
    expect(items.map((b) => b.textContent)).toEqual([
      'Copy code: set',
      'Support 2opened by student 14:32',
      'Complete: closed',
    ])
    // The old one-word chip has gone from the Only-you-see strip.
    expect(screen.queryByText('Reference opened')).not.toBeInTheDocument()

    fireEvent.click(within(strip).getByRole('button', { name: /Support 2/ }))
    const preview = screen.getByTestId('can-see-preview')
    expect(preview).toHaveTextContent('Support stage 2 - what Sam R. sees')
    expect(preview).toHaveTextContent('Read-only')
    // The Support change view against Sam's own code: the new lines, anchored after score = 0.
    const change = within(preview).getByTestId('stage-change-view')
    expect(change).toHaveTextContent('for i in range(3):')
    expect(change).toHaveTextContent('score = score + i')
    expect(change).toHaveTextContent('after this line')

    // Read-only: nothing is sent to the student.
    expect(props.onRevealSupportStage).not.toHaveBeenCalled()
    expect(props.onRemoteReset).not.toHaveBeenCalled()

    // Escape closes the preview, not the modal.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('can-see-preview')).not.toBeInTheDocument()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('shows Complete opened by the student from the completeShown signal, and tutor reveals as "by you"', () => {
    renderModal({
      supportRevealLog: { sam: { 3: { 1: { source: 'teacher', revealedAt: AT_1432 } } } },
      studentSignals: { sam: { completeShown: { 3: { at: AT_1441, via: 'preview' } } } },
    })
    const strip = screen.getByTestId('student-can-see-strip')
    expect(strip).toHaveTextContent('Support 1opened by you 14:32')
    expect(strip).toHaveTextContent('Completeopened by student 14:41')

    fireEvent.click(within(strip).getByRole('button', { name: /^Complete/ }))
    const preview = screen.getByTestId('can-see-preview')
    expect(preview).toHaveTextContent('Complete - what Sam R. sees')
    expect(preview).toHaveTextContent('print(name, score)')
  })

  it('greys out what the student cannot see and offers no preview for it', () => {
    renderModal({}, { lesson: { ...LESSON, tasks: [{ ...TASK, copyCode: '' }] } })
    const strip = screen.getByTestId('student-can-see-strip')
    expect(within(strip).getByRole('button', { name: 'Copy code: off' })).toBeDisabled()
    expect(within(strip).getByRole('button', { name: 'Support: none' })).toBeDisabled()
    expect(within(strip).getByRole('button', { name: 'Complete: closed' })).toBeDisabled()
  })

  it('says the log means "opened earlier", not "open right now"', () => {
    renderModal({
      supportRevealLog: { sam: { 3: { 2: { source: 'student', revealedAt: AT_1432 } } } },
    })
    const strip = screen.getByTestId('student-can-see-strip')
    expect(within(strip).getByText('Student can see')).toHaveAttribute(
      'title',
      expect.stringMatching(/opened earlier; may be closed now/i)
    )
    fireEvent.click(within(strip).getByRole('button', { name: /Support 2/ }))
    expect(screen.getByTestId('can-see-preview')).toHaveTextContent(
      /opened earlier; may be closed now/i
    )
  })

  it('keeps the Reference opened chip where the strip does not show (sandbox)', () => {
    renderModal({
      state: 'sandbox',
      supportRevealLog: { sam: { 3: { 1: { source: 'student', revealedAt: AT_1432 } } } },
    })
    expect(screen.queryByTestId('student-can-see-strip')).not.toBeInTheDocument()
    expect(screen.getByText('Reference opened')).toBeInTheDocument()
  })

  it('closes the preview on a pointerdown outside it, but not on one inside', () => {
    renderModal({
      supportRevealLog: { sam: { 3: { 2: { source: 'student', revealedAt: AT_1432 } } } },
    })
    const strip = screen.getByTestId('student-can-see-strip')
    fireEvent.click(within(strip).getByRole('button', { name: /Support 2/ }))
    fireEvent.pointerDown(screen.getByTestId('can-see-preview'))
    expect(screen.getByTestId('can-see-preview')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('can-see-preview')).not.toBeInTheDocument()
  })

  it('a preview whose item turned off does not swallow the first Escape', () => {
    const session = {
      state: 'active',
      currentTaskId: 3,
      supportRevealLog: { sam: { 3: { 2: { source: 'student', revealedAt: AT_1432 } } } },
    }
    const props = {
      student: STUDENT,
      lesson: LESSON,
      session,
      isLive: true,
      onClose: vi.fn(),
      onRevealSupportStage: vi.fn(),
    }
    const { rerender } = render(<StudentModal {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Support 2/ }))
    expect(screen.getByTestId('can-see-preview')).toBeInTheDocument()
    // The tutor resets the student's task: the log entry goes, the item is no longer on.
    rerender(<StudentModal {...props} session={{ ...session, supportRevealLog: {} }} />)
    expect(screen.queryByTestId('can-see-preview')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })
})

describe('studentCanSee', () => {
  const base = { task: TASK, copyCode: 'x', supportsCopyCode: true, supportsStages: true }

  it('picks the highest revealed support stage, skipping the teacher live-code keys', () => {
    const items = studentCanSee({
      ...base,
      revealLog: {
        1: { source: 'teacher-auto', revealedAt: 1 },
        2: { source: 'student', revealedAt: 2 },
        teacherLive: { source: 'teacher', revealedAt: 3 },
        teacherLivePinned: { source: 'teacher', revealedAt: 4 },
      },
    })
    const support = items.find((i) => i.key === 'support')
    expect(support).toMatchObject({ on: true, number: 2, stageIndex: 2, by: 'student', at: 2 })
  })

  it('takes the earlier of a tutor reveal and the completeShown signal for Complete', () => {
    const tutorFirst = studentCanSee({
      ...base,
      revealLog: { 3: { source: 'teacher', revealedAt: 10 } },
      completeShown: { at: 12, via: 'preview' },
    }).find((i) => i.key === 'complete')
    expect(tutorFirst).toMatchObject({ on: true, by: 'tutor', at: 10 })
    const studentFirst = studentCanSee({
      ...base,
      revealLog: { 3: { source: 'teacher', revealedAt: 20 } },
      completeShown: { at: 12, via: 'show' },
    }).find((i) => i.key === 'complete')
    expect(studentFirst).toMatchObject({ on: true, by: 'student', at: 12 })
    // A tutor reset hides the Complete code again: it never turns the item on.
    const reset = studentCanSee({ ...base, completeShown: { at: 5, via: 'teacherReset' } }).find(
      (i) => i.key === 'complete'
    )
    expect(reset).toEqual({ key: 'complete', on: false })
  })

  it('lists only the items the task has', () => {
    expect(
      studentCanSee({ task: { id: 1 }, supportsCopyCode: true, supportsStages: true }).map(
        (i) => i.key
      )
    ).toEqual(['copy'])
    expect(studentCanSee({ task: TASK, supportsCopyCode: false, supportsStages: false })).toEqual(
      []
    )
  })
})
