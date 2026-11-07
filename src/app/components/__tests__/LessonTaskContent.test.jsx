import React, { useEffect } from 'react'
import { render, screen, within } from '@testing-library/react'
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
  useEffect(() => {
    onVisiblePanesChange?.(['code'])
  }, [onVisiblePanesChange])
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
      />
    )

    expect(screen.getByLabelText('Greeting stage reference')).toHaveTextContent('print("Hello")')
    expect(screen.getByText('Opened by your teacher')).toBeInTheDocument()
  })
})

describe('LessonTaskContent teacher-live-code support reference', () => {
  const baseProps = {
    task: { id: 1, title: 'Say hello' },
    currentTaskId: 1,
    isSandbox: false,
    isViewingPrev: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
  }

  it('renders Presentation View live code as a reference for Python', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        cs={{ inPersonalSandbox: false, teacherLiveReferenceActive: true }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ code: 'print("live")' }}
      />
    )

    expect(screen.getByLabelText("Teacher's live code stage reference")).toHaveTextContent(
      'print("live")'
    )
    expect(screen.getByText("Live from your teacher's screen")).toBeInTheDocument()
  })

  it('marks a pinned (kept on) live code reference with 📌', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        cs={{
          inPersonalSandbox: false,
          teacherLiveReferenceActive: true,
          teacherLiveReferencePinned: true,
        }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ code: 'print("live")' }}
      />
    )

    expect(screen.getByText("📌 Live from your teacher's screen")).toBeInTheDocument()
  })

  it('gives the student no close or collapse control — only the tutor turns it off', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        cs={{
          inPersonalSandbox: false,
          teacherLiveReferenceActive: true,
          teacherLiveReferencePinned: true,
        }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ code: 'print("live")' }}
      />
    )

    const panel = screen.getByLabelText("Teacher's live code stage reference")
    expect(within(panel).queryAllByRole('button')).toHaveLength(0)
  })

  it('converts the teacherLive files map into text for HTML', () => {
    getLessonModule.mockReturnValue({
      type: 'html',
      StudentWorkspace: () => <div>Workspace</div>,
      getLayoutStyles: () => ({}),
    })

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'html' }}
        cs={{ inPersonalSandbox: false, teacherLiveReferenceActive: true }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ files: { 'index.html': '<h1>Hi</h1>' } }}
      />
    )

    expect(screen.getByLabelText("Teacher's live code stage reference")).toHaveTextContent(
      '<h1>Hi</h1>'
    )
  })

  it('parses the JSON-encoded teacherLive code into an fs object for Filesystem', () => {
    getLessonModule.mockReturnValue(FILESYSTEM_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'filesystem' }}
        cs={{ inPersonalSandbox: false, teacherLiveReferenceActive: true }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ code: JSON.stringify({ 'notes.txt': 'hi' }) }}
      />
    )

    expect(screen.getByLabelText("Teacher's live code stage reference")).toHaveTextContent(
      'notes.txt'
    )
  })

  it('does not render when teacherLiveReferenceActive is false', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        cs={{ inPersonalSandbox: false, teacherLiveReferenceActive: false }}
        isForcedTeacherLive={false}
        teacherLiveReferencePayload={{ code: 'print("live")' }}
      />
    )

    expect(screen.queryByLabelText("Teacher's live code stage reference")).toBeNull()
  })

  it('is suppressed during a full Go-Live takeover (isForcedTeacherLive)', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        cs={{ inPersonalSandbox: false, teacherLiveReferenceActive: true }}
        isForcedTeacherLive={true}
        teacherLiveReferencePayload={{ code: 'print("live")' }}
      />
    )

    expect(screen.queryByLabelText("Teacher's live code stage reference")).toBeNull()
  })
})

describe('LessonTaskContent feedback popup visibility', () => {
  const baseProps = {
    lesson: { type: 'python' },
    task: { id: 1, title: 'Say hello', check: true },
    currentTaskId: 1,
    isSandbox: false,
    isViewingPrev: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
    displayCheckAttempted: true,
    displayCheckPassed: false,
  }

  it('shows the feedback popup after a check attempt in a normal (not forced-live) view', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    render(
      <LessonTaskContent
        {...baseProps}
        cs={{ inPersonalSandbox: false }}
        isForcedTeacherLive={false}
      />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('hides the feedback popup while the viewer is forced into a teacher/peer broadcast', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    render(
      <LessonTaskContent
        {...baseProps}
        cs={{ inPersonalSandbox: false }}
        isForcedTeacherLive={true}
      />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it('keeps the side-by-side split (no tabs) when the panel is measured as wide, with the explainer at its fixed 320px width — not draggable, not proportional', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeVisible()
    const explainerText = screen.getByText('Drag the move block.')
    const explainerColumn = explainerText.closest('[style*="width: 320px"]')
    expect(explainerColumn).toBeInTheDocument()
    // No drag handle — SplitPane's draggable divider has this cursor; the fixed layout has none.
    expect(document.querySelector('[style*="cursor: col-resize"]')).not.toBeInTheDocument()
  })

  it('keeps the explainer at exactly 320px regardless of how wide the panel is (no proportional growth)', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const { rerender } = render(<LessonTaskContent {...scratchProps} />)
    const widthAt1600 = screen.getByText('Drag the move block.').closest('[style*="width: 320px"]')
    expect(widthAt1600).toBeInTheDocument()

    useElementSize.mockReturnValue([{ current: null }, { width: 3000, height: 900 }])
    rerender(<LessonTaskContent {...scratchProps} />)
    const widthAt3000 = screen.getByText('Drag the move block.').closest('[style*="width: 320px"]')
    expect(widthAt3000).toBeInTheDocument()
  })

  // The calm Scratch screen (capabilities.calmScratch) replaced the Instructions/Code tabs: the
  // explainer stays beside the blocks at every width (stacked beside the stage on a portrait
  // tablet). See LessonTaskContent.scratchCalm.test.jsx.
  it.each([700, 1000, 1200, 1331, 1332])(
    'never tabs Instructions away from the code at %ipx (calm Scratch screen)',
    (width) => {
      getLessonModule.mockReturnValue(SCRATCH_MODULE)
      useElementSize.mockReturnValue([{ current: null }, { width, height: 700 }])

      render(<LessonTaskContent {...scratchProps} />)

      expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
      expect(screen.getByText('Workspace')).toBeVisible()
    }
  )

  it('keeps the explainer on screen beside the blocks on a 1024px tablet', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 992, height: 700 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByText('Drag the move block.')).toBeVisible()
    expect(screen.getByText('Workspace')).toBeVisible()
  })

  it('ignores height for the Instructions/Code decision — a short-but-wide panel stays split, leaving ScratchWorkspace to compact its own Blocks/Stage split if needed', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 300 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.queryByRole('tablist', { name: 'Task panel' })).not.toBeInTheDocument()
  })

  it('collapses the explainer to its one-line title strip, never to a rail (calm Scratch screen)', async () => {
    const user = userEvent.setup()
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...scratchProps} />)

    expect(screen.getByText('Drag the move block.')).toBeVisible()
    expect(screen.queryByTitle('Collapse Explainer')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Move the cat/ }))

    expect(screen.queryByText('Drag the move block.')).not.toBeInTheDocument()
    expect(screen.getByText('Move the cat')).toBeVisible()
    expect(screen.queryByTitle('Show Explainer')).not.toBeInTheDocument()
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
        useEffect(() => {
          mountCount++
        }, [])
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

  it('removes "instructions" from visiblePanes when the Scratch explainer card is folded to its strip', async () => {
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
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'blocks', 'stage'])

    await user.click(screen.getByRole('button', { name: /Move the cat/ }))

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
      />
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
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions'])

    await user.click(screen.getByRole('button', { name: /Explore files/ }))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith([])
  })

  // The previous code task's panes (still held in scratchCodePanes/modulePanes) must not be
  // re-reported once the class moves to a task with no panes at all.
  it('reports an empty list on an information task after a code task', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const onVisiblePanesChange = vi.fn()
    const props = {
      ...baseProps,
      lesson: { type: 'scratch' },
      onVisiblePanesChange,
    }

    const { rerender } = render(
      <LessonTaskContent
        {...props}
        task={{ id: 1, title: 'Move the cat', explainer: 'Drag the move block.' }}
      />
    )
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'blocks', 'stage'])

    rerender(
      <LessonTaskContent
        {...props}
        currentTaskId={2}
        isInformationTask
        task={{ id: 2, taskType: 'information', title: 'Intro', explainer: 'Welcome.' }}
      />
    )
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith([])
  })

  it('re-reports an unchanged pane list when the task changes', () => {
    getLessonModule.mockReturnValue(SCRATCH_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const onVisiblePanesChange = vi.fn()
    const props = { ...baseProps, lesson: { type: 'scratch' }, onVisiblePanesChange }

    const { rerender } = render(
      <LessonTaskContent {...props} task={{ id: 1, title: 'One', explainer: 'First.' }} />
    )
    const callsBefore = onVisiblePanesChange.mock.calls.length
    rerender(
      <LessonTaskContent
        {...props}
        currentTaskId={2}
        task={{ id: 2, title: 'Two', explainer: 'Second.' }}
      />
    )
    expect(onVisiblePanesChange.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['instructions', 'blocks', 'stage'])
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
      />
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
      />
    )

    expect(screen.getByTitle('Collapse Explainer')).not.toHaveClass('pane-highlight-pulse')
  })

  it('forwards highlightedPanes down to the module StudentWorkspace', () => {
    let receivedProp
    getLessonModule.mockReturnValue({
      type: 'electronics',
      StudentWorkspace: ({ highlightedPanes }) => {
        receivedProp = highlightedPanes
        return <div>Workspace</div>
      },
      getLayoutStyles: () => ({}),
    })
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'electronics' }}
        task={{ id: 1, title: 'Wire it up' }}
        highlightedPanes={['breadboard']}
      />
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
      />
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
      />
    )
    expect(screen.getByText('Use the print function.')).toBeVisible()

    rerender(
      <LessonTaskContent
        {...baseProps}
        lesson={{ type: 'python' }}
        task={{ id: 1, title: 'Say hello', explainer: 'Use the print function.' }}
        forcedPaneCommand={{ mode: 'force', panes: ['code'], pushedAt: 222 }}
      />
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
      />
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
      />
    )
    expect(screen.getByText('Use the print function.')).toBeVisible()
  })

  it('forwards forcedPaneCommand down to the module StudentWorkspace', () => {
    let receivedProp
    getLessonModule.mockReturnValue({
      type: 'electronics',
      StudentWorkspace: ({ forcedPaneCommand }) => {
        receivedProp = forcedPaneCommand
        return <div>Workspace</div>
      },
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
      />
    )

    expect(receivedProp).toBe(command)
  })
})

describe('LessonTaskContent live copy blocking', () => {
  const baseProps = {
    lesson: { type: 'python' },
    task: { id: 1, title: 'Say hello' },
    cs: {},
    currentTaskId: 1,
    isSandbox: false,
    isViewingPrev: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
    isForcedTeacherLive: true,
  }

  function renderWorkspace(props) {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    const { container } = render(<LessonTaskContent {...baseProps} {...props} />)
    return container.querySelector('.live-view-active')
  }

  it('marks the mirrored workspace unselectable while a student watches a broadcast', () => {
    const editorArea = renderWorkspace({ isLiveCopyBlocked: true })

    expect(editorArea).toHaveClass('live-copy-blocked')
  })

  it('cancels a copy raised from inside the mirrored workspace', () => {
    const editorArea = renderWorkspace({ isLiveCopyBlocked: true })

    // Raised from a descendant, so this also covers the real case: a copy fired
    // inside CodeMirror's contenteditable bubbling out to the workspace wrapper.
    const source = editorArea.querySelector('*') ?? editorArea
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })
    source.dispatchEvent(copyEvent)

    expect(source).not.toBe(editorArea)
    expect(copyEvent.defaultPrevented).toBe(true)
  })

  it("stops copy, cut and drag before CodeMirror's own handler can fill the clipboard", () => {
    // Stands in for CodeMirror, which listens on its content element and writes the
    // selection to the clipboard itself — cancelling afterwards would be too late.
    const editorHandler = vi.fn((event) => event.clipboardData?.setData('text/plain', 'secret'))
    function EditorStub() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const el = ref.current
        ;['copy', 'cut', 'dragstart'].forEach((type) => el.addEventListener(type, editorHandler))
      }, [])
      return <div ref={ref} data-testid="cm-content" />
    }
    getLessonModule.mockReturnValue({ ...PYTHON_MODULE, StudentWorkspace: EditorStub })
    render(<LessonTaskContent {...baseProps} isLiveCopyBlocked />)
    const content = screen.getByTestId('cm-content')

    for (const type of ['copy', 'cut', 'dragstart']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      event.clipboardData = { setData: vi.fn() }
      content.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.setData).not.toHaveBeenCalled()
    }
    expect(editorHandler).not.toHaveBeenCalled()
  })

  it('also copy-blocks the explainer panel beside the mirrored workspace', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    const { container } = render(
      <LessonTaskContent
        {...baseProps}
        task={{ ...baseProps.task, explainer: 'Read this **carefully**' }}
        isLiveCopyBlocked
      />
    )
    const blocked = container.querySelectorAll('.live-copy-blocked')
    expect(blocked.length).toBe(2)
    const explainer = [...blocked].find((el) => !el.classList.contains('live-view-active'))
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })
    ;(explainer.querySelector('*') ?? explainer).dispatchEvent(copyEvent)
    expect(copyEvent.defaultPrevented).toBe(true)
  })

  it('reports pastes into a code editor, and copies from it, to the code state', () => {
    const cs = { handleEditorPaste: vi.fn(), handleEditorCopy: vi.fn() }
    getLessonModule.mockReturnValue({
      ...PYTHON_MODULE,
      StudentWorkspace: () => (
        <div className="cm-editor">
          <div data-testid="cm-content">code</div>
        </div>
      ),
    })
    render(<LessonTaskContent {...baseProps} cs={cs} isForcedTeacherLive={false} />)
    const target = screen.getByTestId('cm-content')

    const paste = new Event('paste', { bubbles: true })
    paste.clipboardData = { getData: () => 'pasted text' }
    target.dispatchEvent(paste)
    expect(cs.handleEditorPaste).toHaveBeenCalledWith('pasted text')

    const copy = new Event('copy', { bubbles: true })
    copy.clipboardData = { getData: () => 'my own code' }
    target.dispatchEvent(copy)
    expect(cs.handleEditorCopy).toHaveBeenCalledWith('my own code')
  })

  it('leaves the workspace selectable for a presenting teacher watching a student', () => {
    const editorArea = renderWorkspace({ isLiveCopyBlocked: false })

    expect(editorArea).not.toHaveClass('live-copy-blocked')

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })
    editorArea.dispatchEvent(copyEvent)

    expect(copyEvent.defaultPrevented).toBe(false)
  })
})

describe('LessonTaskContent teacher-started sandbox instructions', () => {
  const sandboxProps = {
    lesson: { type: 'python' },
    task: { id: 1, title: 'Lesson task', explainer: 'Lesson task explainer' },
    cs: { inPersonalSandbox: false },
    currentTaskId: 1,
    isSandbox: true,
    sandboxExplainer: 'Build anything you like',
    isViewingPrev: false,
    isForcedTeacherLive: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
  }

  it('shows the pushed instructions in the same collapsible side explainer as a normal task', async () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const user = userEvent.setup()

    render(<LessonTaskContent {...sandboxProps} />)

    expect(screen.getAllByText('Build anything you like')).toHaveLength(1)
    expect(screen.queryByText('Lesson task explainer')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Collapse Explainer'))
    expect(screen.getByTitle('Show Explainer')).toBeInTheDocument()
  })

  it('keeps the side layout when the session is parked on a quiz task', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...sandboxProps} isQuizTask />)

    expect(screen.getByTitle('Collapse Explainer')).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('shows no explainer when the teacher has not pushed any instructions', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])

    render(<LessonTaskContent {...sandboxProps} sandboxExplainer="" />)

    expect(screen.queryByTitle('Collapse Explainer')).not.toBeInTheDocument()
    expect(screen.queryByText('Lesson task explainer')).not.toBeInTheDocument()
  })
})

// Ryan, 7 Nov 2026: activities (keyboard, binary, quizzes...) have no Topic library chip in their
// header; code lessons keep theirs.
describe('LessonTaskContent Topic library chip', () => {
  const props = {
    lesson: { type: 'python' },
    cs: { inPersonalSandbox: false, activity: null },
    currentTaskId: 1,
    isSandbox: false,
    isViewingPrev: false,
    isForcedTeacherLive: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
    onTopicOpen: vi.fn(),
    onTopicClose: vi.fn(),
    openTopicId: null,
  }

  it('an activity header shows no Topic library chip', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const task = {
      id: 1,
      title: 'Make 5',
      description: 'Turn bits **on** to make the number.',
      taskType: 'activity',
      activityType: 'binary',
      mode: 'make_number',
      bits: 4,
      items: [{ id: 'a', target: 5 }],
    }

    render(<LessonTaskContent {...props} task={task} isActivityTask />)

    expect(screen.getByRole('heading', { name: 'Make 5' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Topic library|Loading library/ })).toBeNull()
  })

  it('a code task still shows the Topic library chip (Python: in the calm code row)', () => {
    // The calm code screen moves Python's chip from the explainer to the workspace's code row
    // (onOpenTopicLibrary); this stub renders that chip as the real row does.
    getLessonModule.mockReturnValue({
      ...PYTHON_MODULE,
      StudentWorkspace: ({ onOpenTopicLibrary }) =>
        onOpenTopicLibrary ? (
          <button type="button" onClick={onOpenTopicLibrary}>
            Topic library
          </button>
        ) : (
          <div>Workspace</div>
        ),
    })
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
    const task = { id: 1, title: 'Say hello', explainer: 'Print a greeting.' }

    render(<LessonTaskContent {...props} task={task} />)

    expect(screen.getAllByRole('button', { name: /Topic library|Loading library/ })).toHaveLength(1)
  })
})

// Platform request 134: an opted-in Complete stage shows only its changes against the student's
// own code, on every path that opens it (Solo's "See complete code", the tutor's send stage, a
// targeted preview), and the load button says what it does.
describe('LessonTaskContent Complete stage change view', () => {
  const task = {
    id: 7,
    title: 'Turn it',
    check: { type: 'code_contains', value: 'turn' },
    codeStages: [
      { label: 'Starter', role: 'starter', code: 'size = 100\nsize -= 5' },
      {
        label: 'Complete',
        role: 'complete',
        show: 'change',
        code: 'size = 100\nsize -= 5\nturn += 10\nprint(size)',
      },
    ],
  }
  const props = {
    lesson: { type: 'python' },
    task,
    currentTaskId: 7,
    isSandbox: false,
    isViewingPrev: false,
    isForcedTeacherLive: false,
    isMobile: false,
    isQuizTask: false,
    isAutoEvaluatedQuiz: false,
    isInformationTask: false,
    isTeacherEditing: false,
  }

  it("opens the Complete (Solo self-reveal or the tutor's send stage) as the change view against the student's code", () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    render(
      <LessonTaskContent
        {...props}
        cs={{ inPersonalSandbox: false, completePreviewShown: true }}
        displayCode={'size = 100\nsize -= 5\nturn += 10'}
      />
    )
    const panel = screen.getByLabelText('Complete stage reference')
    expect(within(panel).getByLabelText('unchanged anchor: turn += 10')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: print(size)')).toBeInTheDocument()
    expect(panel).not.toHaveTextContent('size = 100')
  })

  it("uses the starter when the student's editor is empty", () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    render(
      <LessonTaskContent
        {...props}
        cs={{ inPersonalSandbox: false, targetedPreviewStageIndex: 1 }}
        displayCode=""
      />
    )
    const panel = screen.getByLabelText('Complete stage reference')
    expect(within(panel).getByLabelText('unchanged anchor: size -= 5')).toBeInTheDocument()
    expect(within(panel).getByLabelText('added: turn += 10')).toBeInTheDocument()
  })

  it('labels the load button "Replace my code with this" while the change view shows', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    render(
      <LessonTaskContent
        {...props}
        cs={{
          inPersonalSandbox: false,
          completePreviewShown: true,
          handleShowCompleteCode: () => {},
        }}
        displayCode={'size = 100\nsize -= 5'}
        displayCheckAttempted
        displayCheckPassed={false}
        canOfferCompleteSolution
      />
    )
    expect(screen.getByRole('button', { name: 'Replace my code with this' })).toBeInTheDocument()
  })

  it('after "Replace my code with this" the view compares with the replaced code', async () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    const user = userEvent.setup()
    function Harness() {
      const [code, setCode] = React.useState('size = 100\nsize -= 5')
      return (
        <LessonTaskContent
          {...props}
          cs={{
            inPersonalSandbox: false,
            completePreviewShown: true,
            handleShowCompleteCode: () => setCode(task.codeStages[1].code),
          }}
          displayCode={code}
          displayCheckAttempted
          displayCheckPassed={false}
          canOfferCompleteSolution
        />
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Replace my code with this' }))
    expect(
      within(screen.getByLabelText('Complete stage reference')).getByText(
        'Your code already matches this step'
      )
    ).toBeInTheDocument()
  })

  it('keeps the old load words when the change view shows a stage the button does not load', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    const twoCompletes = {
      ...task,
      codeStages: [
        task.codeStages[0],
        { ...task.codeStages[1], label: 'First complete', show: undefined },
        { ...task.codeStages[1], label: 'Other complete' },
      ],
    }
    render(
      <LessonTaskContent
        {...props}
        task={twoCompletes}
        cs={{
          inPersonalSandbox: false,
          targetedPreviewStageIndex: 2,
          handleShowCompleteCode: () => {},
        }}
        displayCode={'size = 100\nsize -= 5'}
        displayCheckAttempted
        displayCheckPassed={false}
        canOfferCompleteSolution
      />
    )
    expect(screen.getByLabelText('Other complete stage reference')).toHaveTextContent(
      'after this line'
    )
    expect(
      screen.getByRole('button', { name: 'Load complete code into my editor' })
    ).toBeInTheDocument()
  })

  it('a Complete stage without show: change shows the whole program as before', () => {
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    const fullTask = {
      ...task,
      codeStages: [task.codeStages[0], { ...task.codeStages[1], show: undefined }],
    }
    render(
      <LessonTaskContent
        {...props}
        task={fullTask}
        cs={{ inPersonalSandbox: false, completePreviewShown: true }}
        displayCode={'size = 100\nsize -= 5'}
      />
    )
    expect(
      screen.getByLabelText('Complete stage reference').querySelector('code').textContent
    ).toBe('size = 100\nsize -= 5\nturn += 10\nprint(size)')
  })
})
