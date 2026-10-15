// A Turtle or Stage arrangement (P6-15) sits in its host module's own StudentWorkspace, with the
// tile board in the editor's place (`arrangeBoard`); a plain Python arrangement keeps its board
// and console. The module workspaces are stand-ins here: the wiring is what is under test.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workspaceProps = { turtle: [], python: [] }

function makeFakeWorkspace(type) {
  return function FakeWorkspace(props) {
    workspaceProps[type].push(props)
    const onRun = props.__onRun ?? (() => props.cs.handleRun())
    return (
      <div data-testid={`${type}-workspace`} data-arrange-ready={String(props.arrangeReady)}>
        {props.arrangeBoard?.({ onRun })}
        <div>{type} result pane</div>
      </div>
    )
  }
}

vi.mock('../../../modules/registry', async (importOriginal) => {
  const actual = await importOriginal()
  const fakes = { turtle: makeFakeWorkspace('turtle'), python: makeFakeWorkspace('python') }
  return {
    ...actual,
    getLessonModule: (type) => {
      const mod = actual.getLessonModule(type)
      return fakes[type] ? { ...mod, StudentWorkspace: fakes[type] } : mod
    },
  }
})

const { default: CodeArrangeTaskContainer } = await import('../CodeArrangeTaskContainer.jsx')
const { CodeArrangeTeacherLiveView } = await import('../ui.jsx')

const TURTLE_TASK = {
  id: 1,
  taskType: 'code_arrange',
  moduleType: 'turtle',
  lines: [
    { id: 'L1', parts: [{ type: 'text', text: 'import turtle' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'turtle.forward(100)' }] },
  ],
  distractors: [{ id: 'D1', code: 'turtle.left(45)' }],
  check: { type: 'turtle_segment_count', operator: 'equals', value: '1' },
}

const STAGE_TASK = {
  id: 2,
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'text', text: 'from stage import *' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'background("navy")' }] },
  ],
  check: { type: 'stage_shape_count', min: 0 },
}

const PLAIN_TASK = {
  id: 3,
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print("Hi")' }] }],
  check: { type: 'output', operator: 'contains', value: 'Hi' },
}

function makeCs(overrides = {}) {
  return {
    readSavedTaskFile: vi.fn(() => null),
    readSavedTaskCode: vi.fn(() => null),
    saveTaskAuxFile: vi.fn(),
    handleCodeChange: vi.fn(),
    handleFileChange: vi.fn(),
    handleCodeArrangeSlotsChange: vi.fn(),
    handleCodeArrangeDragCursor: vi.fn(),
    handleRun: vi.fn(),
    handleStop: vi.fn(),
    code: '',
    output: '',
    runStatus: null,
    running: false,
    checkPassed: false,
    checkAttempted: false,
    pyodideStatus: 'ready',
    iframeRef: { current: null },
    ...overrides,
  }
}

function renderContainer(props) {
  return render(
    <CodeArrangeTaskContainer
      currentTaskId={props.task.id}
      viewingTaskId={null}
      isViewingPrev={false}
      isForcedTeacherLive={false}
      isTeacherEditing={false}
      {...props}
    />
  )
}

beforeEach(() => {
  workspaceProps.turtle.length = 0
  workspaceProps.python.length = 0
})

describe('Code Arrange in the host module workspace', () => {
  it("renders a Turtle arrangement's board inside the Turtle workspace, with no console of its own", () => {
    renderContainer({ task: TURTLE_TASK, cs: makeCs() })
    const workspace = screen.getByTestId('turtle-workspace')
    expect(workspace).toHaveTextContent('import turtle')
    expect(workspace).toHaveTextContent('turtle result pane')
    expect(screen.getByRole('button', { name: 'turtle.forward(100)' })).toBeInTheDocument()
    // The board leaves the result to the workspace: no "Output" console from the board.
    expect(screen.queryByText('Output')).not.toBeInTheDocument()
  })

  it('passes the Go Live display state and layout props through to the workspace', () => {
    const displayTurtleResult = { commands: [], runId: 'r1' }
    const onVisiblePanesChange = vi.fn()
    renderContainer({
      task: TURTLE_TASK,
      cs: makeCs(),
      isMobile: true,
      displayTurtleResult,
      onVisiblePanesChange,
      lesson: { type: 'turtle' },
    })
    const props = workspaceProps.turtle.at(-1)
    expect(props.task).toBe(TURTLE_TASK)
    expect(props.isSandbox).toBe(false)
    expect(props.isMobile).toBe(true)
    expect(props.displayTurtleResult).toBe(displayTurtleResult)
    expect(props.onVisiblePanesChange).toBe(onVisiblePanesChange)
    expect(props.lesson).toEqual({ type: 'turtle' })
  })

  it("reports arrangeReady once every blank is filled, and Run uses the workspace's onRun", async () => {
    const user = userEvent.setup()
    const cs = makeCs()
    const onRun = vi.fn()
    renderContainer({ task: TURTLE_TASK, cs, __onRun: onRun })
    expect(screen.getByTestId('turtle-workspace')).toHaveAttribute('data-arrange-ready', 'false')
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'turtle.forward(100)' }))
    await user.click(screen.getAllByText('Tap to place')[0])

    expect(screen.getByTestId('turtle-workspace')).toHaveAttribute('data-arrange-ready', 'true')
    await user.click(screen.getByRole('button', { name: 'Run' }))
    expect(onRun).toHaveBeenCalledTimes(1)
    // The assembled program went into the shared code slot, as for any arrangement.
    expect(cs.handleCodeChange).toHaveBeenCalledWith('import turtle\nturtle.forward(100)')
  })

  it('renders a Python arrangement that imports stage inside the Python workspace', () => {
    renderContainer({ task: STAGE_TASK, cs: makeCs() })
    expect(screen.getByTestId('python-workspace')).toHaveTextContent('from stage import *')
    expect(workspaceProps.turtle).toHaveLength(0)
  })

  it('keeps a plain Python arrangement on its own board and console', () => {
    renderContainer({ task: PLAIN_TASK, cs: makeCs() })
    expect(screen.queryByTestId('python-workspace')).not.toBeInTheDocument()
    expect(workspaceProps.python).toHaveLength(0)
    expect(screen.getByText(/Fill in every blank to run/)).toBeInTheDocument()
  })

  it('shows a watched board read-only (no Run) inside the workspace for a Go Live viewer', () => {
    renderContainer({
      task: TURTLE_TASK,
      cs: makeCs(),
      isForcedTeacherLive: true,
      displayCodeArrangeSlots: { L2: 'L2' },
    })
    expect(screen.getByTestId('turtle-workspace')).toHaveTextContent('turtle.forward(100)')
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expect(workspaceProps.turtle.at(-1).isForcedTeacherLive).toBe(true)
  })
})

describe("Code Arrange tutor's view of a Turtle or Stage arrangement", () => {
  const student = {
    currentCode: '',
    currentOutput: '',
    lastRunStatus: null,
    currentTurtleResult: null,
    currentStageResult: null,
  }

  it("shows the student's Turtle picture with their board", () => {
    render(
      <CodeArrangeTeacherLiveView
        task={TURTLE_TASK}
        student={student}
        mirror="view"
        files={[]}
        slots={{ L2: 'L2' }}
      />
    )
    expect(screen.getByTestId('code-arrange-tutor-picture')).toBeInTheDocument()
    expect(screen.getByTestId('code-arrange-slot-L2')).toHaveTextContent('turtle.forward(100)')
  })

  it("shows the student's Stage for a Stage arrangement", () => {
    render(
      <CodeArrangeTeacherLiveView
        task={STAGE_TASK}
        student={student}
        mirror="code"
        files={[]}
        slots={null}
      />
    )
    expect(screen.getByRole('region', { name: "Student's stage" })).toBeInTheDocument()
  })

  it('adds no picture to a plain Python arrangement', () => {
    render(
      <CodeArrangeTeacherLiveView
        task={PLAIN_TASK}
        student={student}
        mirror="code"
        files={[]}
        slots={null}
      />
    )
    expect(screen.queryByTestId('code-arrange-tutor-picture')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-pane')).not.toBeInTheDocument()
  })
})
