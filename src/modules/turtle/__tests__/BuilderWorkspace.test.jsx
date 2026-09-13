import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeAll } from 'vitest'
import BuilderWorkspace from '../BuilderWorkspace'
import { TURTLE_SHIM } from '../shim.js'

// jsdom has no real canvas 2D context (getContext returns null) — stub it so the
// component's `if (ctx) drawTurtleCommands(...)` guard actually runs in tests.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}))
})

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <div>code-editor:{value}</div>,
}))
vi.mock('../../../builder/components/task-editor/TaskEditorFields', () => ({
  CodeWorkspaceTabs: () => <div>code-workspace-tabs</div>,
  StageMetadataEditor: () => <div>stage-metadata-editor</div>,
}))

const initPyodide = vi.fn(() => Promise.resolve())
const stopPython = vi.fn()
const runPython = vi.fn(() =>
  Promise.resolve({
    status: 'success',
    turtle: {
      state: {},
      commands: [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' }],
    },
  })
)
vi.mock('../../python/pyodide', () => ({
  initPyodide: (...args) => initPyodide(...args),
  stopPython: (...args) => stopPython(...args),
  runPython: (...args) => runPython(...args),
}))

const drawTurtleCommands = vi.fn()
vi.mock('../draw.js', () => ({
  drawTurtleCommands: (...args) => drawTurtleCommands(...args),
  sizeCanvasToDisplay: () => false,
}))

const task = { starterCode: 'turtle.forward(10)', codeStages: [] }

describe('Turtle BuilderWorkspace preview', () => {
  it('runs the active code through the turtle shim and draws the result', async () => {
    render(
      <BuilderWorkspace
        task={task}
        onUpdate={vi.fn()}
        codeTab="stage_0"
        codeStages={[{ role: 'starter', code: 'turtle.forward(10)' }]}
        activePythonCode="turtle.forward(10)"
        handleCodeTabChange={vi.fn()}
        handleAddStage={vi.fn()}
        handleRemoveStage={vi.fn()}
        resetToStarterBtn={null}
      />
    )

    fireEvent.click(screen.getByText('Run'))
    expect(initPyodide).toHaveBeenCalled()

    await waitFor(() => expect(runPython).toHaveBeenCalled())
    const [program] = runPython.mock.calls[0]
    expect(program).toContain('turtle.forward(10)')
    expect(program).toContain(JSON.stringify(TURTLE_SHIM))

    await waitFor(() =>
      expect(drawTurtleCommands).toHaveBeenLastCalledWith(expect.anything(), [
        { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' },
      ])
    )
    // Run completed, so the button reverts from Stop back to Run.
    expect(screen.getByText('Run')).toBeTruthy()
  })
})
