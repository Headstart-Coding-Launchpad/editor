import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../modules/registry', () => ({
  getLessonModule: vi.fn(),
}))

vi.mock('../../../shared/useElementSize', () => ({
  useElementSize: vi.fn(),
}))

import { getLessonModule } from '../../../modules/registry'
import { useElementSize } from '../../../shared/useElementSize'
import LessonTaskContent from '../LessonTaskContent'
import { HelpRequestProvider } from '../peerHelp/helpRequestContext'

// The real Scratch StudentWorkspace hands `calm` to ScratchWorkspace, which shows `calm.aside`
// beside its pinned stage in the stacked (portrait) layout. This stub does the same.
let workspaceProps = null
function ScratchWorkspaceStub(props) {
  workspaceProps = props
  return (
    <div data-testid="workspace-stub">
      Workspace
      {props.calm?.stacked && <div data-testid="stacked-aside">{props.calm.aside}</div>}
    </div>
  )
}
const SCRATCH_MODULE = {
  type: 'scratch',
  StudentWorkspace: ScratchWorkspaceStub,
  getLayoutStyles: () => ({}),
}
const PYTHON_MODULE = {
  type: 'python',
  StudentWorkspace: (props) => {
    workspaceProps = props
    return <div>Workspace</div>
  },
  getLayoutStyles: () => ({}),
}

// StudentView provides the top-bar ✋ Help's handler only where that button shows.
function WithHelp({ onAsk, requested = false, children }) {
  return (
    <HelpRequestProvider enabled onAsk={onAsk} requested={requested}>
      {children}
    </HelpRequestProvider>
  )
}

const baseProps = {
  lesson: { type: 'scratch' },
  task: { id: 1, title: '🐱 Move the cat', explainer: 'Make the cat say Hello! 🎉' },
  cs: { inPersonalSandbox: false },
  currentTaskId: 1,
  isSandbox: false,
  isViewingPrev: false,
  isForcedTeacherLive: false,
  isMobile: false,
  isQuizTask: false,
  isAutoEvaluatedQuiz: false,
  isInformationTask: false,
  isTeacherEditing: false,
}

function panelWidth(width, height = 700) {
  useElementSize.mockReturnValue([{ current: null }, { width, height }])
}

beforeEach(() => {
  workspaceProps = null
  getLessonModule.mockReturnValue(SCRATCH_MODULE)
  localStorage.clear()
})

describe('calm Scratch: the explainer stays in view while building', () => {
  it.each([
    ['laptop', 1334],
    ['1024 tablet', 992],
  ])('on a %s the explainer card sits beside the blocks, never behind a tab', (_, width) => {
    panelWidth(width)
    render(<LessonTaskContent {...baseProps} />)
    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
    expect(screen.getByText('Make the cat say Hello! 🎉')).toBeVisible()
    expect(screen.getByText('Workspace')).toBeVisible()
    expect(workspaceProps.calm).toMatchObject({ stacked: false })
    const column = screen.getByTestId('scratch-calm-aside')
    const columnWidth = parseInt(column.style.width, 10)
    expect(columnWidth).toBeGreaterThanOrEqual(220)
    expect(columnWidth).toBeLessThanOrEqual(320)
  })

  it('on a portrait tablet the card goes beside the pinned stage (stacked layout), still visible', () => {
    panelWidth(736, 960)
    render(<LessonTaskContent {...baseProps} />)
    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
    expect(workspaceProps.calm).toMatchObject({ stacked: true })
    const aside = screen.getByTestId('stacked-aside')
    expect(within(aside).getByText('Make the cat say Hello! 🎉')).toBeVisible()
    // Only one copy of the explainer on screen.
    expect(screen.getAllByText('Make the cat say Hello! 🎉')).toHaveLength(1)
  })

  it('keeps the emojis in the title and the explainer', () => {
    panelWidth(1334)
    render(<LessonTaskContent {...baseProps} />)
    expect(screen.getByText('🐱 Move the cat')).toBeInTheDocument()
    expect(screen.getByText('Make the cat say Hello! 🎉')).toBeInTheDocument()
  })

  it('collapses to a one-line strip (the title), never to a rail or a tab, and reports it to the tutor', async () => {
    const user = userEvent.setup()
    panelWidth(992)
    const onVisiblePanesChange = vi.fn()
    render(<LessonTaskContent {...baseProps} onVisiblePanesChange={onVisiblePanesChange} />)
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'blocks', 'stage'])
    expect(screen.queryByTitle('Collapse Explainer')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Move the cat/ }))
    expect(screen.queryByText('Make the cat say Hello! 🎉')).not.toBeInTheDocument()
    expect(screen.getByText('🐱 Move the cat')).toBeVisible()
    expect(screen.queryByTitle('Show Explainer')).not.toBeInTheDocument()
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['blocks', 'stage'])

    await user.click(screen.getByRole('button', { name: /Move the cat/ }))
    expect(screen.getByText('Make the cat say Hello! 🎉')).toBeVisible()
  })

  it('a tutor forcing "instructions" opens a collapsed strip again', async () => {
    const user = userEvent.setup()
    panelWidth(1334)
    const { rerender } = render(<LessonTaskContent {...baseProps} />)
    await user.click(screen.getByRole('button', { name: /Move the cat/ }))
    expect(screen.queryByText('Make the cat say Hello! 🎉')).not.toBeInTheDocument()
    rerender(
      <LessonTaskContent
        {...baseProps}
        forcedPaneCommand={{ mode: 'force', panes: ['instructions'], pushedAt: 7 }}
      />
    )
    expect(screen.getByText('Make the cat say Hello! 🎉')).toBeVisible()
  })

  it('does not move the workspace (no Blockly re-inject) when the layout switches between beside and stacked', () => {
    let mounts = 0
    getLessonModule.mockReturnValue({
      ...SCRATCH_MODULE,
      StudentWorkspace: function Counting(props) {
        React.useEffect(() => {
          mounts += 1
        }, [])
        return ScratchWorkspaceStub(props)
      },
    })
    panelWidth(1334)
    const { rerender } = render(<LessonTaskContent {...baseProps} />)
    panelWidth(736, 960)
    rerender(<LessonTaskContent {...baseProps} />)
    panelWidth(1334)
    rerender(<LessonTaskContent {...baseProps} />)
    expect(mounts).toBe(1)
  })

  it('leaves Python alone (no calm Scratch layout)', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    panelWidth(736)
    render(<LessonTaskContent {...baseProps} lesson={{ type: 'python' }} />)
    expect(workspaceProps.calm).toBeUndefined()
    expect(screen.queryByTestId('scratch-calm-aside')).not.toBeInTheDocument()
  })
})

describe('calm Scratch: the hint is docked under the explainer', () => {
  it('shows a gentle nudge before any run, in the explainer column, with no popup', () => {
    panelWidth(1334)
    render(<LessonTaskContent {...baseProps} />)
    const hint = screen.getByTestId('task-hint')
    expect(within(screen.getByTestId('scratch-calm-aside')).getByTestId('task-hint')).toBe(hint)
    expect(hint).toHaveTextContent(/green flag/i)
    expect(hint).toHaveAttribute('data-tone', 'nudge')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('after a failed run shows the specific hint in the dock (not a popup), and no "Still stuck" line without Help', () => {
    panelWidth(1334)
    render(
      <LessonTaskContent
        {...baseProps}
        task={{ ...baseProps.task, check: { type: 'block_used', opcode: 'looks_say' } }}
        displayCheckAttempted
        displayCheckPassed={false}
        displayCheckSuggestion="Add a **say** block under the flag."
      />
    )
    const hint = screen.getByTestId('task-hint')
    expect(hint).toHaveAttribute('data-tone', 'fail')
    expect(hint).toHaveTextContent('Add a say block under the flag.')
    expect(document.querySelector('.check-feedback-popup')).toBeNull()
    expect(screen.queryByText(/Still stuck/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ask for help/ })).not.toBeInTheDocument()
  })

  it('offers ✋ Ask for help only where the top-bar Help exists (a tutor is there)', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    panelWidth(1334)
    const { rerender } = render(<LessonTaskContent {...baseProps} />)
    expect(screen.queryByRole('button', { name: /Ask for help/ })).not.toBeInTheDocument()

    rerender(
      <WithHelp onAsk={onAsk}>
        <LessonTaskContent {...baseProps} />
      </WithHelp>
    )
    await user.click(screen.getByRole('button', { name: '✋ Ask for help' }))
    expect(onAsk).toHaveBeenCalledTimes(1)

    rerender(
      <WithHelp onAsk={onAsk}>
        <LessonTaskContent
          {...baseProps}
          task={{ ...baseProps.task, check: { type: 'block_used', opcode: 'looks_say' } }}
          displayCheckAttempted
          displayCheckPassed={false}
          displayCheckSuggestion="Add a say block."
        />
      </WithHelp>
    )
    expect(screen.getByRole('button', { name: '✋ Ask for help' })).toBeInTheDocument()
    expect(screen.queryByText(/Still stuck/)).not.toBeInTheDocument()
  })

  it('shows "Help requested" once asked: still bright (aria-disabled, never greyed out), a second tap does nothing', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    panelWidth(1334)
    render(
      <WithHelp onAsk={onAsk} requested>
        <LessonTaskContent {...baseProps} />
      </WithHelp>
    )
    const button = screen.getByRole('button', { name: '✋ Help requested' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(onAsk).not.toHaveBeenCalled()
  })

  it('keeps the popup (no dock) while the student watches a broadcast', () => {
    panelWidth(1334)
    render(<LessonTaskContent {...baseProps} isForcedTeacherLive />)
    expect(screen.queryByTestId('task-hint')).not.toBeInTheDocument()
  })
})
