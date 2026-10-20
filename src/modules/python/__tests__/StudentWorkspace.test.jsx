import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

const pythonEditorSpy = vi.fn()
vi.mock('../PythonEditor', () => ({
  default: (props) => {
    pythonEditorSpy(props)
    return <div>python-editor</div>
  },
}))
const outputPanelSpy = vi.fn()
vi.mock('../../../app/components/OutputPanel', () => ({
  default: (props) => {
    outputPanelSpy(props)
    return <div>output-panel</div>
  },
}))
vi.mock('../../../app/components/CopyCodePanel', () => ({
  default: () => <div>copy-code-panel</div>,
}))
// The layout comes from the workspace's measured size, which jsdom never has: the tests pick
// it (side by side unless a test says otherwise, like an unmeasured workspace).
const layoutState = vi.hoisted(() => ({ layout: null }))
vi.mock('../../../shared/resultPane/useWorkspaceLayout.js', () => ({
  useWorkspaceLayout: ({ isMobile }) => ({
    ref: () => {},
    layout: layoutState.layout ?? (isMobile ? 'below' : 'side'),
    inset: 0,
  }),
}))

const cs = {
  code: '',
  output: '',
  runStatus: null,
  checkPassed: false,
  running: false,
  runningTests: false,
  testResults: null,
  pyodideStatus: 'ready',
  inPersonalSandbox: false,
  handleRun: vi.fn(),
  handleStop: vi.fn(),
  handleRunTests: vi.fn(),
  handleResetCode: vi.fn(),
  handleCodeChange: vi.fn(),
  handleEditorSelection: vi.fn(),
  handleEditorActivity: vi.fn(),
  handleInputSubmit: vi.fn(),
  handleInputChange: vi.fn(),
  publishOutputCollapsed: vi.fn(),
  dismissHighlight: vi.fn(),
  readSavedTaskCode: vi.fn(),
}

describe('Python StudentWorkspace output side on open', () => {
  const renderTask = (task) =>
    render(
      <StudentWorkspace
        task={task}
        cs={{ ...cs, code: 'from stage import *\ntext("hi", y=200)' }}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

  it('opens with the output side showing for a task that runs on open (scrub on), P6-23', () => {
    renderTask({ id: 't1', scrub: { enabled: true } })
    expect(screen.queryByTitle('Show Output')).not.toBeInTheDocument()
  })

  it('stays folded for a plain task, and for runOnOpen: false', () => {
    const { unmount } = renderTask({ id: 't1' })
    expect(screen.getByTitle('Show Output')).toBeInTheDocument()
    unmount()
    renderTask({ id: 't1', scrub: { enabled: true }, runOnOpen: false })
    expect(screen.getByTitle('Show Output')).toBeInTheDocument()
  })
})

describe('Python StudentWorkspace onVisiblePanesChange reporting (teacher live-status badge)', () => {
  it('reports just "code" while output is collapsed, and adds "console" once shown', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])

    fireEvent.click(screen.getByText('Run'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'console'])
  })

  it('publishes the collapse-state change alongside the local toggle, for any live-viewing student to mirror', () => {
    cs.publishOutputCollapsed.mockClear()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

    fireEvent.click(screen.getByText('Run'))
    expect(cs.publishOutputCollapsed).toHaveBeenCalledWith(false)
  })

  it('never reports "console" for submit-mode tasks, since the output pane never renders', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{ interactionMode: 'submit' }}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
    fireEvent.click(screen.getByText('Submit'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })
})

describe('Python StudentWorkspace input() live-mirror wiring', () => {
  it('wires cs.handleInputChange through to OutputPanel while interactive', () => {
    outputPanelSpy.mockClear()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

    // Output starts collapsed (not mounted inside SplitPane's right pane) —
    // expand it via Run, same as the visible-panes tests above.
    fireEvent.click(screen.getByText('Run'))

    const props = outputPanelSpy.mock.calls.at(-1)[0]
    expect(props.onInputChange).toBe(cs.handleInputChange)
  })
})

describe('Python StudentWorkspace forced-live output-collapse lock', () => {
  it('mirrors displayOutputCollapsed=true (collapsed) while forced-live', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive
        displayOutputCollapsed={true}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })

  it('mirrors displayOutputCollapsed=false (expanded) while forced-live', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive
        displayOutputCollapsed={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'console'])
  })

  it('does not let a forced-live viewer expand the collapsed panel themselves (locked, not just seeded)', () => {
    cs.publishOutputCollapsed.mockClear()
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive
        displayOutputCollapsed={true}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    // The collapsed rail is still shown (so the viewer knows the panel exists)
    // but is inert while forced-live — clicking it must not change anything.
    fireEvent.click(screen.getByTitle('Output (collapsed by the presenter)'))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
    expect(cs.publishOutputCollapsed).not.toHaveBeenCalled()
  })
})

describe('Python StudentWorkspace in a teacher-started sandbox', () => {
  it("ignores the session task's submit mode, tests and check", () => {
    outputPanelSpy.mockClear()
    render(
      <StudentWorkspace
        task={{
          interactionMode: 'submit',
          tests: [{ name: 't1' }],
          check: { type: 'output_contains', value: 'hi' },
          copyCode: 'print(1)',
        }}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={true}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    expect(screen.queryByText('Run Tests')).not.toBeInTheDocument()
    expect(screen.queryByText('copy-code-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Run'))
    expect(outputPanelSpy).toHaveBeenLastCalledWith(expect.objectContaining({ hasCheck: false }))
  })
})

describe('Python StudentWorkspace result tabs on smaller screens (P6-12)', () => {
  afterEach(() => {
    layoutState.layout = null
  })

  const CIRCLE = { type: 'circle', x: 200, y: 200, r: 40, colour: '#ff0000' }

  function renderWorkspace(props = {}, csOverrides = {}) {
    const ownCs = { ...cs, variablesPanel: null, stageResult: null, ...csOverrides }
    const utils = render(
      <StudentWorkspace
        task={{ id: 't1' }}
        cs={ownCs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        {...props}
      />
    )
    return { ...utils, cs: ownCs }
  }

  it('keeps everything side by side on a wide screen (no tabs)', () => {
    renderWorkspace({ task: { id: 't1', showVariables: { mode: 'view' } } })
    expect(screen.queryByRole('tablist', { name: 'Result panes' })).toBeNull()
  })

  it('opens predict mode on the Tags tab beside the editor, and reports the visible panes', () => {
    layoutState.layout = 'tabs'
    const onVisiblePanesChange = vi.fn()
    renderWorkspace({
      task: { id: 't1', showVariables: { mode: 'predict', predict: ['size'] } },
      onVisiblePanesChange,
    })
    expect(screen.getByText('python-editor')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Tags' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Picture' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Console' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Variables' })).toBeVisible()
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'tags'])
  })

  it("offers a Picture tab when the code imports stage, and an author's firstPane picks the first tab", () => {
    layoutState.layout = 'tabs'
    renderWorkspace(
      { task: { id: 't1', layout: { firstPane: 'picture' } } },
      { code: 'from stage import *\ncircle(40)\n' }
    )
    expect(screen.getByRole('tab', { name: 'Picture' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('stage-pane')).toBeVisible()
  })

  it('switches to the Picture after a Run that drew, with a badge for the hidden Console', () => {
    layoutState.layout = 'tabs'
    const task = { id: 't1' }
    const code = 'from stage import *\ncircle(40)\nprint("hi")\n'
    const { rerender, cs: ownCs } = renderWorkspace({ task }, { code })
    // The output side starts folded away (no name tags, no target); Run opens it.
    fireEvent.click(screen.getByText('Run'))
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')

    const props = {
      task,
      lessonId: 'lesson-1',
      identityId: 'student-1',
      viewingTaskId: null,
      isSandbox: false,
      isViewingPrev: false,
      isForcedTeacherLive: false,
      isMobile: false,
      isTeacherEditing: false,
      teacherLiveCode: '',
    }
    rerender(<StudentWorkspace {...props} cs={{ ...ownCs, running: true }} />)
    rerender(
      <StudentWorkspace
        {...props}
        cs={{ ...ownCs, running: false, output: 'hi\n', stageResult: { commands: [CIRCLE] } }}
      />
    )
    expect(screen.getByRole('tab', { name: 'Picture' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Console, 1 new line in the Console' })).toBeVisible()
    expect(screen.getByText('Picture updated. 1 new line in the Console')).toBeInTheDocument()
  })

  it('puts the collapse button at the end of the tab strip', () => {
    layoutState.layout = 'tabs'
    cs.publishOutputCollapsed.mockClear()
    renderWorkspace({ task: { id: 't1', showVariables: { mode: 'view' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Output' }))
    expect(cs.publishOutputCollapsed).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Show Output' })).toBeInTheDocument()
  })

  it('stacks the editor above the tabs on portrait screens and phones', () => {
    const { container } = renderWorkspace({
      task: { id: 't1', showVariables: { mode: 'target', target: { size: 3 } } },
      isMobile: true,
    })
    expect(container.querySelector('[data-layout="below"]')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Tags' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Python StudentWorkspace hosting a Stage Code Arrange board (P6-15)', () => {
  afterEach(() => {
    layoutState.layout = null
  })

  function renderArrange(props = {}) {
    const ownCs = { ...cs, variablesPanel: null, stageResult: null, handleRun: vi.fn() }
    render(
      <StudentWorkspace
        task={{ id: 't1' }}
        cs={ownCs}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        arrangeBoard={({ onRun }) => (
          <button type="button" onClick={onRun}>
            board-run
          </button>
        )}
        {...props}
      />
    )
    return ownCs
  }

  it("puts the board in the editor's place and shows the Stage and console from the start", () => {
    const ownCs = renderArrange()
    expect(screen.queryByText('python-editor')).not.toBeInTheDocument()
    expect(screen.queryByText('Reset Code')).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-pane')).toBeInTheDocument()
    expect(screen.getByText('output-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('board-run'))
    expect(ownCs.handleRun).toHaveBeenCalledTimes(1)
  })

  it('offers the Picture tab before the assembled code exists, on smaller screens', () => {
    layoutState.layout = 'tabs'
    renderArrange()
    expect(screen.getByRole('tab', { name: 'Picture' })).toBeInTheDocument()
    expect(screen.getByText('board-run')).toBeInTheDocument()
  })
})

describe("Python StudentWorkspace predict mode's Run lock (P6-18)", () => {
  const lock = { message: 'Fill in your predictions first', missing: ['coins'] }
  const task = { id: 1, showVariables: { mode: 'predict', predict: ['coins'] } }

  it('disables Run with the reason in words, and the run shortcut does nothing', () => {
    const handleRun = vi.fn()
    render(
      <StudentWorkspace
        task={task}
        cs={{ ...cs, handleRun, predictRunLock: lock }}
        isMobile={false}
      />
    )
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run).toBeDisabled()
    expect(run).toHaveAttribute('title', 'Fill in your predictions first')
    expect(run).toHaveAccessibleDescription(/Fill in your predictions first/)
    expect(document.getElementById('predict-run-lock-note')).toHaveTextContent(
      'Fill in your predictions first'
    )
    fireEvent.click(run)
    expect(handleRun).not.toHaveBeenCalled()
  })

  it('runs as normal once the lock lifts, and never locks a read-only view', () => {
    const handleRun = vi.fn()
    const { rerender } = render(
      <StudentWorkspace
        task={task}
        cs={{ ...cs, handleRun, predictRunLock: null }}
        isMobile={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(handleRun).toHaveBeenCalledTimes(1)
    rerender(
      <StudentWorkspace
        task={task}
        cs={{ ...cs, handleRun, predictRunLock: lock }}
        isMobile={false}
        isForcedTeacherLive
      />
    )
    expect(screen.queryByText('Fill in your predictions first')).toBeNull()
  })
})

describe('Python StudentWorkspace predict tags above the code (placement: above)', () => {
  const task = {
    id: 1,
    showVariables: { mode: 'predict', predict: ['coins'], placement: 'above' },
  }
  const panel = (extra = {}) => ({
    run: null,
    predictions: { taskId: 1, values: {} },
    setPrediction: vi.fn(),
    commitPredictions: vi.fn(),
    ...extra,
  })
  const isBefore = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  afterEach(() => {
    layoutState.layout = null
  })

  it('puts the tags above the editor until the first Run, with no Tags tab', () => {
    layoutState.layout = 'tabs'
    const { container } = render(
      <StudentWorkspace task={task} cs={{ ...cs, variablesPanel: panel() }} isMobile={false} />
    )
    const tags = container.querySelector('.ntp')
    expect(tags).toHaveClass('ntp--above')
    expect(isBefore(tags, screen.getByText('python-editor'))).toBe(true)
    expect(container.querySelectorAll('.ntp')).toHaveLength(1)
    expect(screen.queryByRole('tab', { name: /Tags/ })).toBeNull()
  })

  it('goes back to its usual place after the first Run', () => {
    const { container } = render(
      <StudentWorkspace
        task={task}
        cs={{
          ...cs,
          variablesPanel: panel({ predictions: { taskId: 1, values: { coins: '3' }, ran: true } }),
        }}
        isMobile={false}
      />
    )
    const tags = container.querySelector('.ntp')
    expect(tags).not.toHaveClass('ntp--above')
    expect(isBefore(screen.getByText('python-editor'), tags)).toBe(true)
  })
})

describe('Python StudentWorkspace line hints', () => {
  const hintTask = {
    lineHintSets: [{ file: null, hints: [{ line: 1, text: 'Write your print() line here' }] }],
  }
  const renderWith = (codeState) =>
    render(
      <StudentWorkspace
        task={hintTask}
        cs={codeState}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

  it('shows the line hints while the task is not yet passed', () => {
    pythonEditorSpy.mockClear()
    renderWith(cs)
    expect(pythonEditorSpy.mock.lastCall[0].lineHints).toEqual([
      [{ line: 1, text: 'Write your print() line here' }],
    ])
  })

  it('drops the line hints once the check passes (no ghost text after finished code)', () => {
    pythonEditorSpy.mockClear()
    renderWith({ ...cs, checkPassed: true })
    expect(pythonEditorSpy.mock.lastCall[0].lineHints).toBeNull()
  })
})
