import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeAll } from 'vitest'
import TeacherLiveView from '../TeacherLiveView'

// jsdom has no real canvas 2D context (getContext returns null) — stub it so the
// component's `if (ctx) drawTurtleCommands(...)` guard actually runs in tests.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}))
})

vi.mock('../../python/PythonEditor', () => ({
  default: ({ code }) => <div>python-editor:{code}</div>,
}))

const drawTurtleCommands = vi.fn()
vi.mock('../draw.js', () => ({
  drawTurtleCommands: (...args) => drawTurtleCommands(...args),
  sizeCanvasToDisplay: () => false,
}))

describe('Turtle TeacherLiveView', () => {
  it('shows the student code passed as displayState', () => {
    render(<TeacherLiveView displayState="turtle.forward(10)" readOnly />)
    expect(screen.getByText('python-editor:turtle.forward(10)')).toBeTruthy()
  })

  it('renders a blank canvas when there is no student (Builder authoring/preview context)', () => {
    render(<TeacherLiveView displayState="" readOnly />)
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.objectContaining({ background: '#ffffff' })
    )
  })

  it("draws the watched student's synced currentTurtleResult", () => {
    const commands = [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'blue' }]
    const student = { currentTurtleResult: { state: { background: '#f0f0f0' }, commands } }
    render(<TeacherLiveView displayState="turtle.forward(10)" student={student} readOnly />)
    expect(drawTurtleCommands).toHaveBeenCalledWith(
      expect.anything(),
      commands,
      expect.objectContaining({ background: '#f0f0f0' })
    )
  })
})
