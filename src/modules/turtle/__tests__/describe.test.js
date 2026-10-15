// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { describeTurtleDrawing, describeHeading } from '../describe.js'
import { createTurtleRecorder } from '../recorder.js'

describe('describeTurtleDrawing', () => {
  it('says when nothing is drawn, and where the turtle is', () => {
    expect(describeTurtleDrawing({ commands: [], state: { x: 0, y: 0, heading: 0 } })).toBe(
      'Turtle drawing, 400 by 400. Nothing is drawn yet. The turtle is at x 0, y 0, facing right (0 degrees).'
    )
  })

  it('counts lines, fills, dots, stamps and text, naming their colours', () => {
    const rec = createTurtleRecorder()
    rec.setPensize(3)
    rec.setColor('red')
    rec.setFillColor('yellow')
    rec.beginFill()
    rec.forward(50)
    rec.turn(120)
    rec.setColor('orange')
    rec.forward(50)
    rec.turn(120)
    rec.forward(50)
    rec.endFill()
    rec.dot(20, 'white')
    rec.stamp()
    rec.write('Hi', 'left', 8)
    rec.turn(90)
    rec.setVisible(false)
    const text = describeTurtleDrawing({ commands: rec.commands, state: rec.state })
    expect(text).toContain('3 lines in red and orange, 3 wide')
    expect(text).toContain('1 filled shape in yellow')
    expect(text).toContain('1 dot in white')
    expect(text).toContain('1 stamp in orange')
    expect(text).toContain('the text "Hi"')
    expect(text).toContain('hidden')
  })

  it('names a background that is not white', () => {
    const text = describeTurtleDrawing({ commands: [], state: { background: 'navy' } })
    expect(text).toContain('Background: navy.')
  })

  it('leaves out a fill that never closed', () => {
    const rec = createTurtleRecorder()
    rec.beginFill()
    rec.forward(10)
    expect(describeTurtleDrawing({ commands: rec.commands, state: rec.state })).not.toContain(
      'filled shape'
    )
  })

  it('caps the colours it names', () => {
    const commands = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((color) => ({
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      color,
    }))
    expect(describeTurtleDrawing({ commands })).toContain('7 lines in a, b, c, d, e and 2 more')
  })
})

describe('describeHeading', () => {
  it('names the four main directions', () => {
    expect(describeHeading(90)).toBe('up (90 degrees)')
    expect(describeHeading(180)).toBe('left (180 degrees)')
    expect(describeHeading(-90)).toBe('down (270 degrees)')
    expect(describeHeading(45)).toBe('45 degrees')
  })
})
