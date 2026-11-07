import React, { useEffect } from 'react'
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
import { HelpRequestContext } from '../peerHelp/helpRequestContext'

// The calm code screen (Python): the Fun moment is a child's first passing Run. The "What to
// change" box folds out of the way only then (never after a failed Run), and the hint beside
// the task stays in view the whole time, amber with the real hint once a Run fails.

const workspaceProps = vi.fn()
const workspaceMounts = vi.fn()
function WorkspaceStub(props) {
  workspaceProps(props)
  useEffect(() => {
    workspaceMounts()
  }, [])
  return <div>Workspace</div>
}
const PYTHON_MODULE = {
  type: 'python',
  StudentWorkspace: WorkspaceStub,
  getLayoutStyles: () => ({}),
}
const TURTLE_MODULE = {
  type: 'turtle',
  StudentWorkspace: WorkspaceStub,
  getLayoutStyles: () => ({}),
}

const task = {
  id: 36,
  title: '🪐 Design Your Planet',
  explainer: 'Add your planet: type the circle line.\n\n- 🖱 Then drag the size',
  check: { type: 'code_contains', value: 'circle(' },
  codeStages: [
    { label: 'Starter', role: 'starter', code: 'from stage import *\nbackground("black")' },
    {
      label: 'Complete',
      role: 'complete',
      show: 'change',
      code: 'from stage import *\nbackground("black")\ncircle(90, "orange", x=100, y=250)',
    },
  ],
}

const baseProps = {
  lesson: { type: 'python' },
  task,
  currentTaskId: 36,
  isSandbox: false,
  isViewingPrev: false,
  isForcedTeacherLive: false,
  isMobile: false,
  isQuizTask: false,
  isAutoEvaluatedQuiz: false,
  isInformationTask: false,
  isTeacherEditing: false,
  displayCode: 'from stage import *\nbackground("black")',
}

const csAt = (extra = {}) => ({
  inPersonalSandbox: false,
  completePreviewShown: true,
  checkPassed: false,
  runStatus: null,
  ...extra,
})

beforeEach(() => {
  getLessonModule.mockReturnValue(PYTHON_MODULE)
  useElementSize.mockReturnValue([{ current: null }, { width: 0, height: 0 }])
  workspaceProps.mockClear()
  workspaceMounts.mockClear()
  localStorage.clear()
})

const lastWorkspaceProps = () => workspaceProps.mock.calls.at(-1)[0]

describe('Calm code screen: the "What to change" box', () => {
  it('stays open after a failed Run and folds only after a passing one; a tap reopens it', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    const box = screen.getByRole('region', { name: 'What to change' })
    expect(within(box).getByLabelText(/added: circle\(90/)).toBeInTheDocument()

    // A failed Run: still open.
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ running: true })} />)
    rerender(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ runStatus: 'success', checkFailCount: 1 })}
        displayCheckAttempted
        displayCheckPassed={false}
      />
    )
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
    expect(lastWorkspaceProps().whatToChange.folded).toBe(false)

    // The passing Run: it folds to one line, and the Type this out box folds with it.
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ running: true })} />)
    rerender(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ runStatus: 'success', checkPassed: true })}
        displayCheckAttempted
        displayCheckPassed
      />
    )
    expect(screen.queryByLabelText(/added: circle\(90/)).not.toBeInTheDocument()
    expect(lastWorkspaceProps().whatToChange.folded).toBe(true)
    await user.click(screen.getByRole('button', { name: /Show what to change/ }))
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })

  it('is open on first view, even on a task passed before', () => {
    render(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ checkPassed: true, runStatus: 'success' })}
        displayCheckAttempted
        displayCheckPassed
      />
    )
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })

  it('is the only box: the Type this out copy gives way to the change view', () => {
    render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    expect(lastWorkspaceProps().whatToChange.hideCopyCode).toBe(true)
    expect(screen.getByRole('button', { name: 'Show all the code' })).toBeInTheDocument()
  })
})

describe('Calm code screen: the hint beside the task', () => {
  it('is in view before any Run as a gentle nudge, not a popup', () => {
    render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    const hint = screen.getByTestId('task-hint')
    expect(hint).toHaveAttribute('data-tone', 'nudge')
    expect(hint.textContent.trim()).not.toBe('')
    expect(document.querySelector('.check-feedback-popup')).toBeNull()
  })

  it('turns amber with the specific hint after a failed Run, and stays (no close, no timer)', () => {
    render(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ checkFailCount: 1 })}
        displayCheckAttempted
        displayCheckPassed={false}
        displayCheckSuggestion="Which command draws a circle?"
      />
    )
    const hint = screen.getByTestId('task-hint')
    expect(hint).toHaveAttribute('data-tone', 'fail')
    expect(hint).toHaveTextContent('Which command draws a circle?')
    expect(within(hint).queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    expect(document.querySelector('.check-feedback-popup')).toBeNull()
  })

  it("offers 'Replace my code with this' in the hint where it applies", () => {
    render(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ checkFailCount: 1, handleShowCompleteCode: () => {} })}
        displayCheckAttempted
        displayCheckPassed={false}
        canOfferCompleteSolution
      />
    )
    expect(
      within(screen.getByTestId('task-hint')).getByRole('button', {
        name: 'Replace my code with this',
      })
    ).toBeInTheDocument()
  })

  it("'✋ Ask for help' calls the same handler as the top-bar ✋ Help, before and after a failed Run", async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    const { rerender } = render(
      <HelpRequestContext.Provider value={{ onAsk, requested: false }}>
        <LessonTaskContent {...baseProps} cs={csAt()} />
      </HelpRequestContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: '✋ Ask for help' }))
    rerender(
      <HelpRequestContext.Provider value={{ onAsk, requested: false }}>
        <LessonTaskContent
          {...baseProps}
          cs={csAt({ checkFailCount: 1 })}
          displayCheckAttempted
          displayCheckPassed={false}
        />
      </HelpRequestContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: '✋ Ask for help' }))
    expect(onAsk).toHaveBeenCalledTimes(2)
  })

  it('in solo (no tutor to ask) shows no help line, and keeps the hint', () => {
    render(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ checkFailCount: 1 })}
        displayCheckAttempted
        displayCheckPassed={false}
        displayCheckSuggestion="Which command draws a circle?"
      />
    )
    expect(screen.getByTestId('task-hint')).toHaveTextContent('Which command draws a circle?')
    expect(screen.queryByRole('button', { name: /help/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Still stuck/i)).not.toBeInTheDocument()
  })

  it('is not shown on a broadcast the student is watching', () => {
    render(<LessonTaskContent {...baseProps} cs={csAt()} isForcedTeacherLive />)
    expect(screen.queryByTestId('task-hint')).not.toBeInTheDocument()
  })

  it('the task card keeps its emoji title and bullets', () => {
    render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    expect(screen.getByRole('heading', { name: '🪐 Design Your Planet' })).toBeInTheDocument()
    expect(screen.getByText(/🖱 Then drag the size/)).toBeInTheDocument()
  })
})

describe('Calm code screen: Topic library', () => {
  it('moves the Topic library chip from the task card to the code row', () => {
    render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    expect(
      within(screen.getByTestId('task-instructions')).queryByRole('button', {
        name: /Topic library/,
      })
    ).not.toBeInTheDocument()
    expect(typeof lastWorkspaceProps().onOpenTopicLibrary).toBe('function')
  })
})

describe('Other modules keep the check popup', () => {
  it('a Turtle task still shows the popup and no docked hint', () => {
    getLessonModule.mockReturnValue(TURTLE_MODULE)
    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'turtle' }}
        cs={csAt({ completePreviewShown: false })}
        displayCheckAttempted
        displayCheckPassed={false}
      />
    )
    expect(document.querySelector('.check-feedback-popup')).not.toBeNull()
    expect(screen.queryByTestId('task-hint')).not.toBeInTheDocument()
    expect(lastWorkspaceProps().whatToChange).toBeUndefined()
  })
})

// A failed check, as the student's own Run leaves it.
const failedRun = (extra = {}) => ({
  cs: csAt({ checkFailCount: 1, code: 'background("black")', ...extra }),
  displayCheckAttempted: true,
  displayCheckPassed: false,
  displayCheckSuggestion: 'Which command draws a circle?',
})

describe('Calm code screen: the editor stays mounted', () => {
  it('folding the explainer away and back, and the hint changing, keep the same editor', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    const editor = screen.getByTestId('task-workspace')
    expect(workspaceMounts).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))
    expect(screen.getByTestId('task-workspace')).toBe(editor)
    expect(screen.getByTestId('task-hint')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show Explainer' }))
    expect(screen.getByTestId('task-workspace')).toBe(editor)

    // The hint going from the nudge to a failed check.
    rerender(<LessonTaskContent {...baseProps} {...failedRun()} />)
    expect(screen.getByTestId('task-workspace')).toBe(editor)
    expect(workspaceMounts).toHaveBeenCalledTimes(1)
  })
})

describe('Calm code screen: the hint shows in every layout', () => {
  it.each([
    ['side by side', {}],
    ['explainer only (presentation layout)', { presenterLayout: 'explainer' }],
    ['code only (presentation layout)', { presenterLayout: 'code' }],
    ['a narrow screen', { isMobile: true }],
  ])('the failed-check hint shows: %s', (_name, layout) => {
    render(<LessonTaskContent {...baseProps} {...failedRun()} {...layout} />)
    expect(screen.getByText('Which command draws a circle?')).toBeInTheDocument()
  })

  it('the failed-check hint shows with the explainer folded away', async () => {
    const user = userEvent.setup()
    render(<LessonTaskContent {...baseProps} {...failedRun()} />)
    await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))
    expect(screen.getByTestId('task-hint')).toHaveTextContent('Which command draws a circle?')
  })

  it("a tutor's sent hint and the stage offer show in the explainer-only layout", () => {
    const { unmount } = render(
      <LessonTaskContent
        {...baseProps}
        presenterLayout="explainer"
        cs={csAt({ teacherHint: { text: 'Try circle(', at: 5 } })}
      />
    )
    expect(screen.getByText('Hint from your tutor')).toBeInTheDocument()
    expect(screen.getByText('Try circle(')).toBeInTheDocument()
    unmount()
    render(
      <LessonTaskContent
        {...baseProps}
        presenterLayout="explainer"
        cs={csAt({ offeredSupportStageIndex: 0, handleRevealOfferedSupportStage: vi.fn() })}
      />
    )
    expect(screen.getByRole('button', { name: 'Show me a hint' })).toBeInTheDocument()
  })
})

describe('Calm code screen: a reference the tutor opened', () => {
  it('keeps its "Opened by your teacher" label in the What to change box and never folds on a pass', () => {
    const tutorOpened = (extra = {}) =>
      csAt({ supportStageReveals: { 1: { source: 'teacher' } }, ...extra })
    const { rerender } = render(<LessonTaskContent {...baseProps} cs={tutorOpened()} />)
    expect(screen.getByRole('region', { name: 'What to change' })).toHaveTextContent(
      'Opened by your teacher'
    )
    rerender(<LessonTaskContent {...baseProps} cs={tutorOpened({ running: true })} />)
    rerender(
      <LessonTaskContent
        {...baseProps}
        cs={tutorOpened({ checkPassed: true, runStatus: 'success' })}
        displayCheckAttempted
        displayCheckPassed
      />
    )
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })

  it('a stage shown for feedback (the check, not the tutor) keeps its label', () => {
    render(
      <LessonTaskContent
        {...baseProps}
        cs={csAt({ completePreviewShown: false, targetedPreviewStageIndex: 1 })}
      />
    )
    expect(screen.getByRole('region', { name: 'What to change' })).toHaveTextContent(
      'Shown for your feedback'
    )
  })
})

describe('Calm code screen: when the box folds (once per task view, after a Run here)', () => {
  it('does not fold when a pass from before arrives late, with no Run', () => {
    const { rerender } = render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ checkPassed: true })} />)
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })

  it('once the student reopens it, a later fail then pass leaves it open', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LessonTaskContent {...baseProps} cs={csAt()} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ running: true })} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ checkPassed: true })} />)
    await user.click(screen.getByRole('button', { name: /Show what to change/ }))
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ running: true })} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ checkFailCount: 1 })} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ running: true })} />)
    rerender(<LessonTaskContent {...baseProps} cs={csAt({ checkPassed: true })} />)
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })

  it('a task with no check folds after its first good Run only', async () => {
    const user = userEvent.setup()
    const noCheck = { ...task, check: undefined }
    const at = (extra) => <LessonTaskContent {...baseProps} task={noCheck} cs={csAt(extra)} />
    const { rerender } = render(at({}))
    rerender(at({ running: true }))
    rerender(at({ runStatus: 'success' }))
    expect(screen.queryByLabelText(/added: circle\(90/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show what to change/ }))
    rerender(at({ running: true }))
    rerender(at({ runStatus: 'success' }))
    expect(screen.getByLabelText(/added: circle\(90/)).toBeInTheDocument()
  })
})

describe('Calm code screen: one box, never two', () => {
  it('the Type this out copy hides exactly while the change view box is on screen', () => {
    const copyTask = { ...task, copyCode: 'circle(90, "orange", x=100, y=250)' }
    const { rerender } = render(
      <LessonTaskContent
        {...baseProps}
        task={copyTask}
        cs={csAt({ completePreviewShown: false })}
      />
    )
    expect(screen.queryByTestId('stage-change-view')).not.toBeInTheDocument()
    expect(lastWorkspaceProps().whatToChange.hideCopyCode).toBe(false)
    rerender(<LessonTaskContent {...baseProps} task={copyTask} cs={csAt()} />)
    expect(screen.getByTestId('stage-change-view')).toBeInTheDocument()
    expect(lastWorkspaceProps().whatToChange.hideCopyCode).toBe(true)
  })
})

describe('Calm code screen: the hint after the student moves on', () => {
  it('a failed-check hint turns gentle (blue) once the code changes, and stays readable', () => {
    const { rerender } = render(<LessonTaskContent {...baseProps} {...failedRun()} />)
    expect(screen.getByTestId('task-hint')).toHaveAttribute('data-tone', 'fail')
    rerender(
      <LessonTaskContent {...baseProps} {...failedRun({ code: 'background("black")\ncirc' })} />
    )
    const hint = screen.getByTestId('task-hint')
    expect(hint).toHaveAttribute('data-tone', 'nudge')
    expect(hint).toHaveTextContent('Which command draws a circle?')
  })

  it('a failed-check hint turns gentle when a new Run starts', () => {
    const { rerender } = render(<LessonTaskContent {...baseProps} {...failedRun()} />)
    rerender(<LessonTaskContent {...baseProps} {...failedRun({ running: true })} />)
    expect(screen.getByTestId('task-hint')).toHaveAttribute('data-tone', 'nudge')
  })

  it("a tutor's hint stays while the student types, with no extra Ask for help, until Got it", async () => {
    const user = userEvent.setup()
    const help = { onAsk: vi.fn(), requested: false }
    const sent = (code) => (
      <HelpRequestContext.Provider value={help}>
        <LessonTaskContent
          {...baseProps}
          cs={csAt({ code, teacherHint: { text: 'Try circle(', at: 5 } })}
        />
      </HelpRequestContext.Provider>
    )
    const { rerender } = render(sent('a'))
    rerender(sent('ab'))
    const hint = screen.getByTestId('task-hint')
    expect(hint).toHaveAttribute('data-tone', 'tutor')
    expect(hint).toHaveTextContent('Try circle(')
    expect(within(hint).queryByRole('button', { name: /Ask for help/ })).not.toBeInTheDocument()
    await user.click(within(hint).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText('Try circle(')).not.toBeInTheDocument()
  })
})
