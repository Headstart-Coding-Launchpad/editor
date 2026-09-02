import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace.jsx'
import { DEFAULT_CIRCUIT, makeComponent, serializeCircuit } from '../circuit.js'

function makeCs(code) {
  return {
    code,
    output: '',
    runStatus: null,
    running: false,
    checkPassed: false,
    handleCodeChange: vi.fn(),
    handleRun: vi.fn(),
    handleStop: vi.fn(),
    handleSubmit: vi.fn(),
    handleResetCode: vi.fn(),
    readSavedTaskCode: vi.fn(() => null),
  }
}

function renderWorkspace({ task = {}, onVisiblePanesChange, circuit = DEFAULT_CIRCUIT } = {}) {
  const cs = makeCs(serializeCircuit(circuit))
  return render(
    <StudentWorkspace
      lesson={{ type: 'electronics', tasks: [] }}
      task={task}
      cs={cs}
      viewingTaskId={null}
      isViewingPrev={false}
      isForcedTeacherLive={false}
      isTeacherEditing={false}
      onVisiblePanesChange={onVisiblePanesChange}
    />
  )
}

// Regression guard for an unbounded render loop: ElectronicsWorkspace reports its visible
// tab from an effect that depends on this callback, so an identity that changes every
// render re-ran the effect every render, wrote fresh pane state, and re-rendered forever
// ("Maximum update depth exceeded" on every electronics task).
describe('electronics StudentWorkspace — pane reporting is stable across renders', () => {
  it('reports the visible pane once, not once per render', () => {
    const onVisiblePanesChange = vi.fn()
    const { rerender } = renderWorkspace({ onVisiblePanesChange })

    expect(onVisiblePanesChange).toHaveBeenCalledTimes(1)
    expect(onVisiblePanesChange).toHaveBeenCalledWith(['breadboard'])

    const cs = makeCs(serializeCircuit(DEFAULT_CIRCUIT))
    for (let pass = 0; pass < 3; pass += 1) {
      rerender(
        <StudentWorkspace
          lesson={{ type: 'electronics', tasks: [] }}
          task={{}}
          cs={cs}
          viewingTaskId={null}
          isViewingPrev={false}
          isForcedTeacherLive={false}
          isTeacherEditing={false}
          onVisiblePanesChange={onVisiblePanesChange}
        />
      )
    }

    expect(onVisiblePanesChange).toHaveBeenCalledTimes(1)
  })

  it('still reports a real tab change', () => {
    const onVisiblePanesChange = vi.fn()
    renderWorkspace({
      task: { microcontroller: { enabled: true } },
      onVisiblePanesChange,
    })

    onVisiblePanesChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'MicroPython' }))

    expect(onVisiblePanesChange).toHaveBeenCalledTimes(1)
    expect(onVisiblePanesChange).toHaveBeenCalledWith(['code'])
  })
})

describe('electronics StudentWorkspace — output panel default', () => {
  it('opens the output panel when the Micro Controller comes from the circuit rather than the task flag', () => {
    const microcontroller = makeComponent('microcontroller', 1, { row: 2, col: 2 })
    renderWorkspace({
      task: {},
      circuit: { ...DEFAULT_CIRCUIT, components: [microcontroller] },
    })

    // The collapsed state renders an "Output" rail button instead of the panel.
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })
})
