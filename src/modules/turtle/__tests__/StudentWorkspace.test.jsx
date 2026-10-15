import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

// jsdom has no real canvas 2D context (getContext returns null) — stub it so the
// component's `if (ctx) drawTurtleCommands(...)` guard actually runs in tests.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}))
})

vi.mock('../../python/PythonEditor', () => ({
  default: ({ code }) => <div>python-editor:{code}</div>,
}))

const drawTurtleCommands = vi.fn()
vi.mock('../draw.js', async (importOriginal) => ({
  ...(await importOriginal()),
  drawTurtleCommands: (...args) => drawTurtleCommands(...args),
  sizeCanvasToDisplay: () => false,
}))

// The layout comes from the workspace's measured size, which jsdom never has: the tests pick
// it (side by side, or below on a phone, unless a test says otherwise).
const layoutState = vi.hoisted(() => ({ layout: null }))
vi.mock('../../../shared/resultPane/useWorkspaceLayout.js', () => ({
  useWorkspaceLayout: ({ isMobile }) => ({
    ref: () => {},
    layout: layoutState.layout ?? (isMobile ? 'below' : 'side'),
    inset: 0,
  }),
}))

function makeCs(overrides = {}) {
  return {
    code: 'turtle.forward(10)',
    running: false,
    pyodideStatus: 'ready',
    output: '',
    runStatus: null,
    checkPassed: false,
    checkAttempted: false,
    errorLine: null,
    inPersonalSandbox: false,
    turtleResult: null,
    handleRun: vi.fn(),
    handleStop: vi.fn(),
    handleCodeChange: vi.fn(),
    handleResetCode: vi.fn(),
    readSavedTaskCode: vi.fn(),
    ...overrides,
  }
}

describe('Turtle StudentWorkspace', () => {
  it('shows the Run button and starts a run on click', () => {
    const cs = makeCs()
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    fireEvent.click(screen.getByText('Run'))
    expect(cs.handleRun).toHaveBeenCalledTimes(1)
  })

  it('shows Stop and calls handleStop while running', () => {
    const cs = makeCs({ running: true })
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    fireEvent.click(screen.getByText('Stop'))
    expect(cs.handleStop).toHaveBeenCalledTimes(1)
  })

  it('draws the most recent turtle result onto the canvas', () => {
    const commands = [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }]
    const cs = makeCs({ turtleResult: { state: {}, commands, calls: [] } })
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      commands,
      expect.objectContaining({ background: '#ffffff' })
    )
  })

  it("passes the run's final background colour through to the renderer", () => {
    const cs = makeCs({
      turtleResult: { state: { background: '#000000' }, commands: [], calls: [] },
    })
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({ background: '#000000' })
    )
  })

  it('ignores its own turtleResult while forced-live, using the broadcast snapshot instead', () => {
    const ownCommands = [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }]
    const broadcastCommands = [{ type: 'line', x1: 0, y1: 0, x2: 99, y2: 0, color: 'red' }]
    const cs = makeCs({ turtleResult: { state: {}, commands: ownCommands, calls: [] } })
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        isMobile={false}
        isForcedTeacherLive
        displayCode="turtle.forward(5)"
        displayTurtleResult={{ state: { background: '#eee' }, commands: broadcastCommands }}
      />
    )
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      broadcastCommands,
      expect.objectContaining({ background: '#eee' })
    )
  })

  it('shows a blank canvas while forced-live if no broadcast turtle result has synced yet', () => {
    const commands = [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }]
    const cs = makeCs({ turtleResult: { state: {}, commands, calls: [] } })
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        isMobile={false}
        isForcedTeacherLive
        displayCode="turtle.forward(5)"
      />
    )
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({ background: '#ffffff' })
    )
  })

  it('passes the turtle marker state, defaulting to the origin before any run', () => {
    render(<StudentWorkspace task={{}} cs={makeCs()} isMobile={false} />)
    expect(drawTurtleCommands).toHaveBeenLastCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({
        turtle: expect.objectContaining({ x: 0, y: 0, heading: 0, visible: true }),
      })
    )
  })

  it("passes the run's final position, heading and visibility to the marker", () => {
    const cs = makeCs({
      turtleResult: { state: { x: 30, y: -10, heading: 90, visible: false }, commands: [] },
    })
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    expect(drawTurtleCommands).toHaveBeenLastCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({
        turtle: expect.objectContaining({ x: 30, y: -10, heading: 90, visible: false }),
      })
    )
  })

  it('collapses Output into a slim horizontal bar under the canvas and reopens it', () => {
    render(<StudentWorkspace task={{}} cs={makeCs()} isMobile={false} />)
    const rail = screen.getByRole('button', { name: 'Show Output' })
    // The vertical rail is height: 100%, which swallowed half the pane under the canvas.
    expect(rail.style.height).toBe('auto')
    expect(rail.style.flexDirection).toBe('row')
    fireEvent.click(rail)
    expect(screen.getByRole('button', { name: 'Collapse Output' }).textContent).toBe('v')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Output' }))
    expect(screen.getByRole('button', { name: 'Show Output' })).toBeTruthy()
  })

  it('redraws onto the new canvas when switching between the mobile and split layouts', () => {
    const commands = [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }]
    const cs = makeCs({ turtleResult: { state: {}, commands, calls: [] } })
    const { container, rerender } = render(<StudentWorkspace task={{}} cs={cs} isMobile={false} />)
    const desktopCanvas = container.querySelector('canvas')
    drawTurtleCommands.mockClear()

    rerender(<StudentWorkspace task={{}} cs={cs} isMobile />)

    const mobileCanvas = container.querySelector('canvas')
    expect(mobileCanvas).not.toBe(desktopCanvas)
    expect(drawTurtleCommands).toHaveBeenCalledWith(expect.anything(), commands, expect.anything())
  })

  it('disables editing and code changes while viewing previous work', () => {
    const cs = makeCs({ readSavedTaskCode: vi.fn(() => ({ code: 'turtle.left(90)' })) })
    render(<StudentWorkspace task={{}} cs={cs} isMobile={false} isViewingPrev viewingTaskId="t1" />)
    expect(screen.getByText('python-editor:turtle.left(90)')).toBeTruthy()
    expect(screen.queryByText('Run')).toBeNull()
  })
})

describe('Turtle StudentWorkspace result tabs on smaller screens (P6-12)', () => {
  afterEach(() => {
    layoutState.layout = null
  })

  const LINE = { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }

  it('shows Picture and Console tabs beside the editor, opening on the Picture', () => {
    layoutState.layout = 'tabs'
    const onVisiblePanesChange = vi.fn()
    const { container } = render(
      <StudentWorkspace
        task={{ id: 1 }}
        cs={makeCs()}
        isMobile={false}
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )
    expect(screen.getByRole('tab', { name: 'Picture' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Tags' })).toBeNull()
    expect(container.querySelector('canvas')).toBeVisible()
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'canvas'])
    // The Console is its own tab, so there is no collapse rail.
    expect(screen.queryByRole('button', { name: 'Show Output' })).toBeNull()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Picture' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Console' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('canvas')).not.toBeVisible()
    // Hidden, not unmounted: the drawing keeps its canvas.
    expect(container.querySelector('canvas')).toBeInTheDocument()
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'console'])
  })

  it('opens predict mode on the Tags tab', () => {
    layoutState.layout = 'tabs'
    render(
      <StudentWorkspace
        task={{ id: 1, showVariables: { mode: 'predict', predict: ['size'] } }}
        cs={makeCs({ variablesPanel: null })}
        isMobile={false}
      />
    )
    expect(screen.getByRole('tab', { name: 'Tags' })).toHaveAttribute('aria-selected', 'true')
  })

  it('goes back to the Picture after a Run and badges the Console lines it printed', () => {
    layoutState.layout = 'tabs'
    const task = { id: 1 }
    const cs = makeCs()
    const { rerender } = render(<StudentWorkspace task={task} cs={cs} isMobile={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Console' }))
    rerender(<StudentWorkspace task={task} cs={{ ...cs, running: true }} isMobile={false} />)
    rerender(
      <StudentWorkspace
        task={task}
        cs={{
          ...cs,
          running: false,
          output: 'one\ntwo\n',
          turtleResult: { state: {}, commands: [LINE], runId: 'r1' },
        }}
        isMobile={false}
      />
    )
    expect(screen.getByRole('tab', { name: 'Picture' })).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tab', { name: 'Console, 2 new lines in the Console' })
    ).toBeInTheDocument()
  })

  it('stacks the editor above the tabs on a phone', () => {
    const { container } = render(<StudentWorkspace task={{ id: 1 }} cs={makeCs()} isMobile />)
    expect(container.querySelector('[data-layout="below"]')).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Result panes' })).toBeInTheDocument()
  })
})
