// Tutor actions: one home each (Deep Review U7, sketch OK'd by Ryan 27 Nov 2026, option A twice).
// Each tutor action has one home on the dashboard and one in the student pop-up:
// - Nudge: the row's hover icons (only while Away) and the pop-up bar.
// - Thumbs up: the row's hover icons and the pop-up bar.
// - Award: the suggestions panel, the row ⋯ menu (any badge), the pop-up bar (with a ▾ for a
//   different badge).
// - Open: the row's hover icons and Class health's Open link.
// The row's icons show on hover, on keyboard focus, and while the row is open (so a touch screen,
// which has no reliable hover, reaches them by tapping the row open).
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StudentGrid from '../StudentGrid'
import StudentModal from '../StudentModal'
import ClassHealthChip from '../ClassHealthChip'

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <textarea data-testid="code-editor" value={value ?? ''} readOnly />,
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

const LESSON = {
  type: 'python',
  tasks: [
    { id: 1, title: 'Make a score', check: { type: 'output_contains', value: 'Score' } },
    { id: 2, title: 'Add points in a loop' },
  ],
}
const SESSION = { state: 'active', currentTaskId: 1 }
const SUGGESTION = {
  badgeId: 'bug_hunter',
  studentId: 'b',
  taskId: 1,
  reason: 'Fixed an error without help',
  at: 1000,
}

const st = (id, name, extra = {}) => ({ anonymousId: id, displayName: name, online: true, ...extra })
const rowOf = (name) =>
  screen.getAllByTestId('student-row').find((row) => row.dataset.studentName === name)

function gridProps(overrides = {}) {
  return {
    students: [st('b', 'Bea', { windowFocused: false }), st('c', 'Cal')],
    lesson: LESSON,
    lessonId: 'L1',
    session: SESSION,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onGoLive: vi.fn(),
    onStopLive: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
    onThumbsUpStudent: vi.fn(),
    onNudgeStudent: vi.fn(),
    onDecideBadge: vi.fn(async () => ({ committed: true })),
    onRevokeBadge: vi.fn(),
    onSendHint: vi.fn(),
    onSendMessage: vi.fn(),
    onRequestFullscreenStudent: vi.fn(),
    badgeSuggestions: {
      suggestions: [SUGGESTION],
      pendingCountByStudent: { b: 1 },
      awardedCountByStudent: {},
    },
    ...overrides,
  }
}

describe('Tutor actions, one home each: the student row', () => {
  it('shows Nudge, Thumbs up and Open when the tutor tabs to an Away row, and they work', async () => {
    const user = userEvent.setup()
    const props = gridProps()
    render(<StudentGrid {...props} />)
    const row = rowOf('Bea')
    expect(within(row).queryByRole('button', { name: 'Nudge Bea' })).not.toBeInTheDocument()

    // Keyboard focus on the row, no mouse: the three icons appear.
    fireEvent.focus(within(row).getByTestId('row-main'))
    await user.click(within(row).getByRole('button', { name: 'Nudge Bea' }))
    expect(props.onNudgeStudent).toHaveBeenCalledWith('b')
    await user.click(within(row).getByRole('button', { name: 'Send Bea a thumbs up' }))
    expect(props.onThumbsUpStudent).toHaveBeenCalledWith('b')
    expect(within(row).getByRole('button', { name: 'Open Bea' })).toBeInTheDocument()
  })

  it('has no Nudge icon for a student who is not Away', () => {
    render(<StudentGrid {...gridProps()} />)
    fireEvent.mouseEnter(rowOf('Cal'))
    expect(within(rowOf('Cal')).getByRole('button', { name: 'Send Cal a thumbs up' })).toBeVisible()
    expect(within(rowOf('Cal')).queryByRole('button', { name: 'Nudge Cal' })).toBeNull()
  })

  it('the opened row keeps the icons (reachable on touch) and drops its repeats', async () => {
    const user = userEvent.setup()
    render(<StudentGrid {...gridProps()} />)
    fireEvent.click(within(rowOf('Bea')).getByTestId('row-main'))
    fireEvent.mouseLeave(rowOf('Bea'))
    const row = rowOf('Bea')
    const open = within(row).getByTestId('row-open')
    // The icons stay without hover or focus while the row is open.
    expect(within(row).getByRole('button', { name: 'Nudge Bea' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Send Bea a thumbs up' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Open Bea' })).toBeInTheDocument()
    // No worded Thumbs up / Open in the opened row.
    expect(within(open).queryByRole('button', { name: /Thumbs up/ })).toBeNull()
    expect(within(open).queryByRole('button', { name: /^Open/ })).toBeNull()
    // More: no Nudge and no one-tap Award.
    await user.click(within(open).getByRole('button', { name: /More/ }))
    const fold = screen.getByTestId('row-more')
    expect(within(fold).queryByRole('button', { name: /Nudge/ })).toBeNull()
    expect(within(fold).queryByTestId('one-tap-award')).toBeNull()
  })

  it('the ⋯ menu keeps Award badge, Hint, Message and fullscreen, without the row repeats', async () => {
    const user = userEvent.setup()
    render(<StudentGrid {...gridProps()} />)
    await user.click(within(rowOf('Bea')).getByRole('button', { name: 'Actions for Bea' }))
    const menu = screen.getByRole('menu')
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent)
    expect(items.some((t) => /Award badge/.test(t))).toBe(true)
    for (const label of ['Send hint', 'Message', 'Ask to go fullscreen', 'Rename student']) {
      expect(items.some((t) => t.includes(label))).toBe(true)
    }
    for (const gone of ['Thumbs up', 'Nudge', 'Open student']) {
      expect(items.some((t) => t.includes(gone))).toBe(false)
    }
    expect(within(menu).queryByText('Their screen')).toBeNull()
  })
})

describe('Tutor actions, one home each: the student pop-up', () => {
  function modalProps(overrides = {}) {
    return {
      student: st('b', 'Bea'),
      lesson: LESSON,
      session: SESSION,
      isLive: true,
      isLiveForAll: false,
      onGoLive: vi.fn(),
      onGoLiveForAll: vi.fn(),
      onStopLive: vi.fn(),
      onClose: vi.fn(),
      onNudge: vi.fn(),
      onThumbsUp: vi.fn(),
      onDecideBadge: vi.fn(async () => ({ committed: true })),
      onRevokeBadge: vi.fn(),
      onSendMessage: vi.fn(),
      onSendToTopic: vi.fn(),
      topics: [{ id: 't1', title: 'Loops' }],
      onSendVideoCallLink: vi.fn(),
      onRequestShareSnapshot: vi.fn(),
      onRequestFullscreen: vi.fn(),
      badgeSuggestions: [SUGGESTION],
      ...overrides,
    }
  }

  it('awards a different badge from the bar ▾ without awarding the suggested one', async () => {
    const user = userEvent.setup()
    const props = modalProps()
    render(<StudentModal {...props} />)
    const header = screen.getByTestId('student-modal-header')
    expect(within(header).getByTestId('one-tap-award')).toHaveTextContent('Award Bug Hunter')
    await user.click(
      within(header).getByRole('button', { name: 'Choose a different badge for Bea' })
    )
    expect(props.onDecideBadge).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /Award badge · Bea/ })).toBeInTheDocument()
  })

  it('Tools loses the four repeats; each keeps its one home in the bar', async () => {
    const user = userEvent.setup()
    render(<StudentModal {...modalProps()} />)
    const header = screen.getByTestId('student-modal-header')
    // The bar homes.
    expect(within(header).getByRole('button', { name: 'Nudge Bea' })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'Send Bea a thumbs up' })).toBeVisible()
    expect(within(header).getByRole('button', { name: /Show to class/ })).toBeInTheDocument()

    await user.click(within(header).getByRole('button', { name: /^Tools/ }))
    const tools = screen.getByTestId('student-modal-tools')
    expect(within(tools).queryByText('Encourage')).toBeNull()
    expect(within(tools).queryByRole('button', { name: /Nudge/ })).toBeNull()
    expect(within(tools).queryByRole('button', { name: /Take over every screen/ })).toBeNull()
    expect(within(tools).queryByRole('button', { name: /Send Topic/ })).toBeNull()
    expect(within(tools).queryByRole('button', { name: /Video Call Link/ })).toBeNull()
    expect(within(tools).queryByRole('button', { name: /different badge/ })).toBeNull()
    // Still in Tools: Share a copy and Ask to go fullscreen.
    expect(within(tools).getByRole('button', { name: /Share a copy/ })).toBeInTheDocument()
    expect(within(tools).getByRole('button', { name: /Ask to go fullscreen/ })).toBeInTheDocument()
  })

  it('Live ▾ holds only Take over every screen; Message ▾ holds Topic and Video call', async () => {
    const user = userEvent.setup()
    const props = modalProps()
    render(<StudentModal {...props} />)
    await user.click(screen.getByRole('button', { name: /^Live/ }))
    expect(screen.queryByRole('button', { name: /keep coding/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Take over every screen/ }))
    expect(props.onGoLiveForAll).toHaveBeenCalledWith()

    await user.click(screen.getByRole('button', { name: 'More ways to message' }))
    expect(screen.getByRole('button', { name: '📖 Send Topic' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '📹 Send Video Call Link' }))
    expect(props.onSendVideoCallLink).toHaveBeenCalledWith('b')
  })
})

describe('Tutor actions, one home each: Class health', () => {
  it('keeps Open and drops Nudge', () => {
    const onOpenStudent = vi.fn()
    render(
      <ClassHealthChip
        students={[st('d', 'Dev'), st('e', 'Eve', { health: 'python_stuck' })]}
        appVersion="1.0.0"
        onOpenStudent={onOpenStudent}
        onNudgeStudent={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /class health/i }))
    const panel = screen.getByRole('dialog', { name: /class health/i })
    expect(within(panel).queryByRole('button', { name: 'Nudge' })).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: "Open Eve's screen" }))
    expect(onOpenStudent).toHaveBeenCalledWith('e')
  })
})
