import React, { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../../modules/registry', () => ({
  getLessonModule: vi.fn(),
}))

vi.mock('../../../shared/useElementSize', () => ({
  useElementSize: vi.fn(),
}))

import { getLessonModule } from '../../../modules/registry'
import { useElementSize } from '../../../shared/useElementSize'
import LessonTaskContent from '../LessonTaskContent'

const PYTHON_MODULE = {
  type: 'python',
  StudentWorkspace: () => <div>Workspace</div>,
  getLayoutStyles: () => ({}),
}

const SCRATCH_MODULE = {
  type: 'scratch',
  StudentWorkspace: () => <div>Workspace</div>,
  getLayoutStyles: () => ({}),
}

const FILESYSTEM_MODULE = {
  type: 'filesystem',
  StudentWorkspace: () => <div>Workspace</div>,
  getLayoutStyles: () => ({}),
}

// Reports a fixed module pane (mirroring how Python/HTML/Electronics' real
// StudentWorkspace components report their own internal panes) so tests can verify
// LessonTaskContent merges the "instructions" pane into that report correctly.
function PythonWorkspaceStub({ onVisiblePanesChange }) {
  useEffect(() => { onVisiblePanesChange?.(['code']) }, [onVisiblePanesChange])
  return <div>Workspace</div>
}
const PYTHON_MODULE_WITH_PANES = {
  type: 'python',
  StudentWorkspace: PythonWorkspaceStub,
  getLayoutStyles: () => ({}),
}

beforeEach(() => {
  useElementSize.mockReturnValue([{ current: null }, { width: 0, height: 0 }])
  // Isolate tests from each other's persisted tab choice (layoutTabStorageKey) —
  // a test that clicks a tab writes to localStorage, which would otherwise leak
  // into a later test's "what's the default?" assertions.
  localStorage.clear()
})

describe('LessonTaskContent', () => {
  it('renders a teacher-revealed support stage without crashing student view', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        lesson={{ type: 'python' }}
        task={{
          id: 1,
          title: 'Say hello',
          codeStages: [{ label: 'Greeting', code: 'print("Hello")' }],
        }}
        cs={{
          inPersonalSandbox: false,
          activeSupportStageIndex: 0,
          supportStageReveals: { 0: { source: 'teacher' } },
        }}
        currentTaskId={1}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isQuizTask={false}
        isAutoEvaluatedQuiz={false}
        isInformationTask={false}
        isTeacherEditing={false}
      />,
    )

    expect(screen.getByLabelText('Greeting stage reference')).toHaveTextContent('print("Hello")')
    expect(screen.getByText('Opened by your teacher')).toBeInTheDocument()
  })
})

describe('LessonTaskContent compact Scratch layout', () => {
  const scratchProps = {
    lesson: { type: 'scratch' },
    task: { id: 1, title: 'Move the cat', explainer: 'Drag the move block.' },
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

  it('keeps the side-by-side split (no tabs) when the panel is measured as wide, with the explainer at its fixed 400px width — not draggable, not proportional', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeVisible()
    const explainerText = screen.getByText('Drag the move block.')
    const explainerColumn = explainerText.closest('[style*="width: 400px"]')
    expect(explainerColumn).toBeInTheDocument()
    // No drag handle — SplitPane's draggable divider has this cursor; the fixed layout has none.
    expect(document.querySelector('[style*="cursor: col-resize"]')).not.toBeInTheDocument()
  })

  it('keeps the explainer at exactly 400px regardless of how wide the panel is (no proportional growth)', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const { rerender } = render(<LessonTaskContent {...scratchProps} />)
    const widthAt1600 = screen.getByText('Drag the move block.').closest('[style*="width: 400px"]')
    expect(widthAt1600).toBeInTheDocument()

    useElementSize.mockReturnValue([{ current: null }, { width: 3000, height: 900 }])
    rerender(<LessonTaskContent {...scratchProps} />)
    const widthAt3000 = screen.getByText('Drag the move block.').closest('[style*="width: 400px"]')
    expect(widthAt3000).toBeInTheDocument()
  })

  it('switches to an Instructions/Code tab switcher when the panel is measured as narrow, defaulting to Code, without unmounting either pane', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 700, height: 500 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByRole('tablist', { name: 'Task panel' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Workspace')).toBeVisible()
    // The explainer stays mounted (not unmounted) even while its tab isn't active.
    expect(screen.getByText('Drag the move block.')).not.toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Instructions' }))

    expect(screen.getByRole('tab', { name: 'Instructions' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Drag the move block.')).toBeVisible()
    expect(screen.getByText('Workspace')).not.toBeVisible()
  })

  it('tabs Instructions away before the code area would be squeezed under 1000px by a fixed 400px explainer, instead of leaving Blocks/Stage to compact on their own', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    // 1200 - 400 (fixed explainer) = 800px code area, under ScratchWorkspace's own 1000px
    // "wide" threshold — but 1200px is plenty if Code gets the whole row via a tab.
    useElementSize.mockReturnValue([{ current: null }, { width: 1200, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByRole('tablist', { name: 'Task panel' })).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeVisible()
  })

  it('sits right at the boundary: 1412px (400 explainer + 12 gap + 1000 code) stays split, 1411px tabs', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)

    useElementSize.mockReturnValue([{ current: null }, { width: 1412, height: 900 }])
    const { rerender } = render(<LessonTaskContent {...scratchProps} />)
    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()

    useElementSize.mockReturnValue([{ current: null }, { width: 1411, height: 900 }])
    rerender(<LessonTaskContent {...scratchProps} />)
    expect(screen.getByRole('tablist', { name: 'Task panel' })).toBeInTheDocument()
  })

  it('ignores height for the Instructions/Code decision — a short-but-wide panel stays split, leaving ScratchWorkspace to compact its own Blocks/Stage split if needed', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 300 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
  })

  it('still supports manually collapsing the explainer to a rail in the fixed-width layout', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByText('Drag the move block.')).toBeVisible()

    await user.click(screen.getByTitle('Collapse Explainer'))

    expect(screen.queryByText('Drag the move block.')).not.toBeInTheDocument()
    expect(screen.getByTitle('Show Explainer')).toBeInTheDocument()
  })

  it('gives the Scratch panel no minimum-height floor, so a growing sibling (e.g. the completion banner) can shrink it freely — ScratchWorkspace scales its own stage down to fit rather than the page needing to scroll around a reserved floor', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByText('Workspace').closest('[style*="min-height: 0px"]')).toBeInTheDocument()
    expect(document.querySelector('.task-slide-viewport').style.overflow).toBe('hidden')
  })

  it('never applies the compact tab tier to non-Scratch lesson types', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 500, height: 400 }])

    render(<LessonTaskContent {...scratchProps} lesson={{ type: 'python' }} />)

    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
  })

  // Regression test: split and compact modes used to render structurally different
  // trees at this position (PanelTabPanel-wrapped fragment vs. plain divs), so React
  // would unmount and remount everything below — including ScratchWorkspace, destroying
  // and re-injecting every Blockly workspace — on every threshold crossing. That could
  // leave ScratchWorkspace's own compact-detection mid-remeasurement and stuck, which is
  // what "sometimes the stage shows, sometimes it stays collapsed" traced back to.
  it('does not remount the workspace when toggling between split and compact as the panel resizes', () => {
    let mountCount = 0
    getLessonModule.mockReturnValue({
      type: 'scratch',
      StudentWorkspace: () => {
        useEffect(() => { mountCount++ }, [])
        return <div>Workspace</div>
      },
      getLayoutStyles: () => ({}),
    })

    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }]) // split
    const { rerender } = render(<LessonTaskContent {...scratchProps} />)
    expect(mountCount).toBe(1)

    useElementSize.mockReturnValue([{ current: null }, { width: 700, height: 500 }]) // compact
    rerender(<LessonTaskContent {...scratchProps} />)
    expect(mountCount).toBe(1)

    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }]) // back to split
    rerender(<LessonTaskContent {...scratchProps} />)
    expect(mountCount).toBe(1)
  })
})

// Regression coverage for the info/explainer open-closed signal reported to the teacher
// (StudentCard's "👀 Info + ..." badge): collapsing the explainer must remove
// "instructions" from the reported visiblePanes on every code path that can hide it —
// the side-rail collapse (Scratch and other SIDE_EXPLAINER_TYPES), and the explainer's
// own accordion collapse (lesson types with no side explainer, e.g. Filesystem).
describe('LessonTaskContent instructions-pane reporting', () => {
  const baseProps = {
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

  it('removes "instructions" from visiblePanes when the Scratch explainer rail is collapsed', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const onVisiblePanesChange = vi.fn()

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'scratch' }}
        task={{ id: 1, title: 'Move the cat', explainer: 'Drag the move block.' }}
        onVisiblePanesChange={onVisiblePanesChange}
      />,
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'blocks', 'stage'])

    await user.click(screen.getByTitle('Collapse Explainer'))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['blocks', 'stage'])
  })

  it('merges "instructions" into a module-reported visiblePanes list (e.g. Python) and removes it on collapse', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(PYTHON_MODULE_WITH_PANES)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const onVisiblePanesChange = vi.fn()

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        onVisiblePanesChange={onVisiblePanesChange}
      />,
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'code'])

    await user.click(screen.getByTitle('Collapse Explainer'))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })

  it('reports "instructions" via the accordion collapse for lesson types with no side explainer (e.g. Filesystem)', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(FILESYSTEM_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const onVisiblePanesChange = vi.fn()

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'filesystem' }}
        task={{ id: 1, title: 'Explore files', explainer: 'Look around the tree.' }}
        onVisiblePanesChange={onVisiblePanesChange}
      />,
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions'])

    await user.click(screen.getByRole('button', { name: /Explore files/ }))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith([])
  })
})

describe('LessonTaskContent highlightedPanes', () => {
  const baseProps = {
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

  it('pulses the explainer collapse button when "instructions" is highlighted (side-rail layout)', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        highlightedPanes={['instructions']}
      />,
    )

    expect(screen.getByTitle('Collapse Explainer')).toHaveClass('pane-highlight-pulse')
  })

  it('does not pulse the explainer collapse button when a different pane is highlighted', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        highlightedPanes={['code']}
      />,
    )

    expect(screen.getByTitle('Collapse Explainer')).not.toHaveClass('pane-highlight-pulse')
  })

  it('forwards highlightedPanes down to the module StudentWorkspace', () => {
    let receivedProp
    getLessonModule.mockReturnValue({
      type: 'electronics',
      StudentWorkspace: ({ highlightedPanes }) => { receivedProp = highlightedPanes; return <div>Workspace</div> },
      getLayoutStyles: () => ({}),
    })
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'electronics' }}
        task={{ id: 1, title: 'Wire it up' }}
        highlightedPanes={['breadboard']}
      />,
    )

    expect(receivedProp).toEqual(['breadboard'])
  })
})

describe('LessonTaskContent forcedPaneCommand', () => {
  const baseProps = {
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

  it('opens the collapsed explainer rail when forced to show "instructions"', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        forcedPaneCommand={{ mode: 'force', panes: ['instructions'], pushedAt: 111 }}
      />,
    )

    expect(screen.getByText('Use the print function.')).toBeVisible()
  })

  it('collapses an open explainer when forced to a non-instructions pane', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    const { rerender } = render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
      />,
    )
    expect(screen.getByText('Use the print function.')).toBeVisible()

    rerender(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        forcedPaneCommand={{ mode: 'force', panes: ['code'], pushedAt: 222 }}
      />,
    )

    expect(screen.queryByText('Use the print function.')).not.toBeInTheDocument()
    expect(screen.getByTitle('Show Explainer')).toBeInTheDocument()

    // The student stays free to re-open it manually right after — a force isn't a lock.
    await user.click(screen.getByTitle('Show Explainer'))
    expect(screen.getByText('Use the print function.')).toBeVisible()
  })

  it('applies a forced command only once per distinct pushedAt token, not on every re-render', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const command = { mode: 'force', panes: ['code'], pushedAt: 333 }

    const { rerender } = render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        forcedPaneCommand={command}
      />,
    )
    expect(screen.getByTitle('Show Explainer')).toBeInTheDocument()

    // Student re-opens manually.
    await user.click(screen.getByTitle('Show Explainer'))
    expect(screen.getByText('Use the print function.')).toBeVisible()

    // An unrelated re-render with the SAME token must not re-force it closed again.
    rerender(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        forcedPaneCommand={{ ...command }}
      />,
    )
    expect(screen.getByText('Use the print function.')).toBeVisible()
  })

  it('forwards forcedPaneCommand down to the module StudentWorkspace', () => {
    let receivedProp
    getLessonModule.mockReturnValue({
      type: 'electronics',
      StudentWorkspace: ({ forcedPaneCommand }) => { receivedProp = forcedPaneCommand; return <div>Workspace</div> },
      getLayoutStyles: () => ({}),
    })
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const command = { mode: 'force', panes: ['breadboard'], pushedAt: 444 }

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'electronics' }}
        task={{ id: 1, title: 'Wire it up' }}
        forcedPaneCommand={command}
      />,
    )

    expect(receivedProp).toBe(command)
  })
})
