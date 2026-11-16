import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StudentModal from '../StudentModal'
import { fitChipCount } from '../student-modal/ModalStrip'

// The tidied Student View Modal (sketch OK'd 7 Nov 2026): one header line, an "Only you see"
// strip in priority order, a grouped Tools menu, instructions on the left and Output on the
// right, so the tutor's screen looks like the student's.

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <textarea data-testid="code-editor" value={value ?? ''} readOnly />,
}))
vi.mock('../../../modules/scratch/ScratchWorkspace.jsx', () => ({
  default: ({ forceCompact }) => (
    <div data-testid="scratch-workspace" data-compact={String(!!forceCompact)} />
  ),
  SPRITE_TYPES: [],
}))
vi.mock('../IframePreview', () => ({ default: () => <div data-testid="iframe-preview" /> }))
vi.mock('../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output-panel">{output}</div>,
}))
vi.mock('../ExplainerPanel', () => ({
  default: ({ content }) => <div data-testid="explainer-panel">{content}</div>,
}))
vi.mock('../../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library-dialog" />,
}))
vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div>{content}</div>,
}))

const STUDENT = {
  anonymousId: 'student-1',
  displayName: 'Jordan',
  online: true,
  checkPassed: false,
  currentCode: 'print("hi")',
  currentOutput: 'hi',
  lastRunStatus: 'success',
}

const PYTHON_LESSON = {
  type: 'python',
  tasks: [
    { id: 1, title: 'Warm up', explainer: 'Start here' },
    {
      id: 2,
      title: 'Say hello',
      explainer: 'Ask for a name, then greet it',
      copyCode: 'print("Hi", name)',
      check: { type: 'output_contains', value: 'Hi' },
    },
    { id: 3, title: 'Loop it' },
  ],
}

const SCRATCH_LESSON = {
  type: 'scratch',
  tasks: [{ id: 1, title: 'Move the cat', explainer: 'Make the cat move' }],
}

function props(overrides = {}, student = {}) {
  return {
    student: { ...STUDENT, ...student },
    lesson: PYTHON_LESSON,
    session: { state: 'active', currentTaskId: 2 },
    isLive: true,
    isLiveForAll: false,
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onClose: vi.fn(),
    hasPrev: true,
    hasNext: true,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onRemoteReset: vi.fn(),
    position: 3,
    total: 9,
    ...overrides,
  }
}

describe('Student View Modal tidy: the fun moment', () => {
  it('opens on a calm header, an Only-you-see strip with Help needed first, and a grouped Tools menu', () => {
    const p = props(
      {
        onDismissHelp: vi.fn(),
        onSendHint: vi.fn(),
        onSendMessage: vi.fn(),
        onNudge: vi.fn(),
        onOverrideCheck: vi.fn(),
        onRequestFullscreen: vi.fn(),
        onRemoteRun: vi.fn(),
        rosterName: 'Jordan P.',
      },
      {
        needsHelp: true,
        pasteLog: { 2: { count: 2, chars: 40 } },
      }
    )
    render(<StudentModal {...p} />)

    // Header: who, where in the class list, which task, and one row of actions.
    const header = screen.getByTestId('student-modal-header')
    expect(within(header).getByText('Jordan')).toBeInTheDocument()
    expect(within(header).getByText('3/9')).toBeInTheDocument()
    expect(within(header).getByText(/Task 2 · Say hello/)).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'Hint' })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: /Message/ })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'Nudge Jordan' })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: /^Tools/ })).toBeInTheDocument()
    expect(within(header).queryByRole('button', { name: /^More/ })).not.toBeInTheDocument()

    // Strip: tutor-only, Help needed first whatever else is there.
    const strip = screen.getByTestId('student-modal-strip')
    expect(strip).toHaveTextContent('Only you see')
    const chips = within(strip).getAllByTestId(/^strip-chip-/)
    expect(chips[0]).toHaveAttribute('data-testid', 'strip-chip-help')
    expect(strip).toHaveTextContent('Jordan P.')
    expect(strip).toHaveTextContent('Pasted ×2')
    fireEvent.click(within(strip).getByRole('button', { name: /Helped/ }))
    expect(p.onDismissHelp).toHaveBeenCalledWith('student-1')

    // Tools: every old More item, grouped.
    fireEvent.click(within(header).getByRole('button', { name: /^Tools/ }))
    const menu = screen.getByTestId('student-modal-tools')
    for (const heading of [
      'Encourage',
      'Help this student',
      'Mark the task',
      'Their screen and answers',
      'Their work',
    ])
      expect(within(menu).getByText(heading)).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: '🔔 Nudge' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: '⛶ Ask to go fullscreen' })).toBeInTheDocument()
  })

  it('puts the instructions, the hint the student sees and Type this out on the left, and Output on the right', () => {
    render(
      <StudentModal
        {...props(
          { onSetCopyCodeOverride: vi.fn() },
          {
            studentHint: {
              text: 'Count the ( and )',
              source: 'check',
              failStreak: 3,
              taskId: '2',
            },
          }
        )}
      />
    )
    const left = screen.getByTestId('student-modal-left')
    expect(within(left).getByTestId('explainer-panel')).toHaveTextContent(
      'Ask for a name, then greet it'
    )
    expect(within(left).getByTestId('student-hint-panel')).toHaveTextContent('Count the ( and )')
    expect(within(left).getByText('student is seeing this')).toBeInTheDocument()
    expect(within(left).getByText('student can open this')).toBeInTheDocument()
    expect(within(left).getByText('print("Hi", name)')).toBeInTheDocument()
    // The failed streak is also a strip chip.
    expect(screen.getByTestId('student-modal-strip')).toHaveTextContent('Failed 3 in a row')

    const right = screen.getByTestId('student-modal-output-column')
    expect(within(right).getByTestId('output-panel')).toHaveTextContent('hi')

    // The left column folds to a rail and back.
    fireEvent.click(within(left).getByRole('button', { name: 'Hide instructions' }))
    expect(screen.queryByTestId('student-modal-left')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show instructions' }))
    expect(screen.getByTestId('student-modal-left')).toBeInTheDocument()
  })

  it('shows Scratch like the student sees it: blocks and Stage side by side, not tabs', () => {
    render(<StudentModal {...props({ lesson: SCRATCH_LESSON, session: { currentTaskId: 1 } })} />)
    expect(screen.getByTestId('scratch-workspace')).toHaveAttribute('data-compact', 'false')
    expect(screen.getByTestId('student-modal-left')).toHaveTextContent('Make the cat move')
  })

  it('swaps Live for a red Stop Live and a SHOWN TO CLASS chip while broadcasting', () => {
    const p = props({ isLiveForAll: true, isLiveForAllPanel: true })
    render(<StudentModal {...p} />)
    const header = screen.getByTestId('student-modal-header')
    fireEvent.click(within(header).getByRole('button', { name: 'Stop Live' }))
    expect(p.onStopLive).toHaveBeenCalled()
    expect(within(header).queryByRole('button', { name: /^Live/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('student-modal-strip')).toHaveTextContent('SHOWN TO CLASS')
  })

  it('offers Go Live for All and Show to class under Live', () => {
    const p = props()
    render(<StudentModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /^Live/ }))
    fireEvent.click(
      screen.getByRole('button', { name: '📡 Take over every screen (Go Live for All)' })
    )
    expect(p.onGoLiveForAll).toHaveBeenCalled()
  })

  it('turns the strip into a mode row while a mode is on', () => {
    const p = props(
      { onRequestTeacherEdit: vi.fn(), onCancelTeacherEdit: vi.fn(), rosterName: 'Jordan P.' },
      {}
    )
    const { rerender } = render(<StudentModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /^Tools/ }))
    fireEvent.click(screen.getByRole('button', { name: /Edit their code|Edit Code/i }))
    const strip = screen.getByTestId('student-modal-strip')
    expect(within(strip).getByTestId('strip-mode')).toHaveTextContent('Waiting for Jordan')
    expect(strip).not.toHaveTextContent('Jordan P.')
    fireEvent.click(within(strip).getByRole('button', { name: 'Cancel' }))
    expect(p.onCancelTeacherEdit).toHaveBeenCalledWith('student-1')
    rerender(<StudentModal {...p} />)
    expect(screen.getByTestId('student-modal-strip')).toHaveTextContent('Jordan P.')
  })

  it('Hint caret sends a hint the class is seeing; Message caret has Send Topic', () => {
    const onSendHint = vi.fn()
    render(
      <StudentModal
        {...props({
          onSendHint,
          onSendMessage: vi.fn(),
          onSendToTopic: vi.fn(),
          topics: [{ id: 't1', title: 'Loops' }],
          commonHints: [{ group: 'g1', text: 'Remember the quotes', studentIds: ['a', 'b'] }],
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'More hints' }))
    fireEvent.click(screen.getByRole('button', { name: /Remember the quotes/ }))
    expect(screen.getByPlaceholderText(/Look at line 3/)).toHaveValue('Remember the quotes')
    fireEvent.click(screen.getByRole('button', { name: 'Send hint' }))
    expect(onSendHint).toHaveBeenCalledWith('student-1', 'Remember the quotes', 2)

    fireEvent.click(screen.getByRole('button', { name: 'More ways to message' }))
    fireEvent.click(screen.getByRole('button', { name: '📖 Send Topic' }))
    expect(screen.getByTestId('topic-library-dialog')).toBeInTheDocument()
  })

  it('shows when the student last ran their code', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-07T12:00:30Z'))
    render(<StudentModal {...props({}, { lastRunAt: Date.parse('2026-11-07T12:00:18Z') })} />)
    expect(screen.getByTestId('student-modal-strip')).toHaveTextContent('Last run 12s ago')
    vi.useRealTimers()
  })
})

describe('Student View Modal header: prev/next arrows keep a fixed place', () => {
  it('puts the arrows before the name, in a fixed-width box, so a long name cannot move them', () => {
    const { rerender } = render(<StudentModal {...props({}, { displayName: 'Al' })} />)
    const nav = screen.getByTestId('student-modal-nav')
    const who = screen.getByTestId('student-modal-status')
    expect(nav.compareDocumentPosition(who) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const width = nav.style.width
    expect(width).toMatch(/px$/)
    rerender(
      <StudentModal
        {...props({ position: 10, total: 12 }, { displayName: 'Bartholomew Longname-Smythe' })}
      />
    )
    expect(screen.getByTestId('student-modal-nav').style.width).toBe(width)
  })
})

describe('fitChipCount', () => {
  it('shows every chip when they all fit, or when there is no layout (0 width)', () => {
    expect(fitChipCount([50, 50, 50], 400, { gap: 8, moreWidth: 48 })).toBe(3)
    expect(fitChipCount([50, 50, 50], 0, { gap: 8, moreWidth: 48 })).toBe(3)
  })
  it('keeps room for the +N chip when some must go', () => {
    // 100 + 8 + 100 = 208 fits in 220 alone, but not with the +N chip (8 + 48).
    expect(fitChipCount([100, 100, 100], 220, { gap: 8, moreWidth: 48 })).toBe(1)
    expect(fitChipCount([100, 100, 100], 270, { gap: 8, moreWidth: 48 })).toBe(2)
  })
})
