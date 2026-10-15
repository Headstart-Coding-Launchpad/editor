// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createTurtleRecorder, defaultDotSize, shortestTurn } from '../recorder.js'

const types = (rec) => rec.commands.map((c) => c.type)

describe('createTurtleRecorder', () => {
  it('records lines with pen colour, pensize and heading', () => {
    const rec = createTurtleRecorder()
    rec.forward(100)
    expect(rec.commands).toEqual([
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, heading: 0, color: 'black', width: 1 },
    ])
    expect(rec.calls).toEqual([{ name: 'forward', args: [100] }])
  })

  it('records pen-up travel as a move, not a line', () => {
    const rec = createTurtleRecorder()
    rec.penUp()
    rec.goto(10, 20)
    expect(types(rec)).toEqual(['move'])
    expect(rec.commands[0]).toMatchObject({ x1: 0, y1: 0, x2: 10, y2: 20 })
  })

  it('records turns with their signed size, and nothing for a zero turn', () => {
    const rec = createTurtleRecorder()
    rec.turn(90)
    rec.turn(-450)
    rec.turn(0)
    expect(rec.commands).toEqual([
      { type: 'turn', from: 0, delta: 90 },
      { type: 'turn', from: 90, delta: -450 },
    ])
    // 90 - 450 = -360 wraps to 0 (not -0).
    expect(rec.state.heading).toBe(0)
  })

  it("marks circle()'s turns as instant", () => {
    const rec = createTurtleRecorder()
    rec.turn(10, true)
    expect(rec.commands[0]).toEqual({ type: 'turn', from: 0, delta: 10, instant: true })
  })

  it('setheading() turns the shortest way, like real turtle', () => {
    const rec = createTurtleRecorder()
    rec.setHeading(270)
    expect(rec.commands[0]).toEqual({ type: 'turn', from: 0, delta: -90 })
    expect(rec.state.heading).toBe(270)
    expect(shortestTurn(350, 10)).toBe(20)
    expect(shortestTurn(10, 350)).toBe(-20)
  })

  it('home() moves back then turns to face east', () => {
    const rec = createTurtleRecorder()
    rec.turn(90)
    rec.forward(50)
    rec.home()
    expect(types(rec)).toEqual(['turn', 'line', 'line', 'turn'])
    expect(rec.state).toMatchObject({ x: 0, y: 0, heading: 0 })
  })

  it('pensize() sets the width of later lines', () => {
    const rec = createTurtleRecorder()
    rec.setPensize(5)
    rec.forward(10)
    expect(rec.state.pensize).toBe(5)
    expect(rec.commands[0].width).toBe(5)
    expect(rec.calls[0]).toEqual({ name: 'pensize', args: [5] })
  })

  it('dot() defaults to max(pensize + 4, 2 * pensize) in the pen colour, and does not move', () => {
    expect(defaultDotSize(1)).toBe(5)
    expect(defaultDotSize(10)).toBe(20)
    const rec = createTurtleRecorder()
    rec.setColor('red')
    rec.forward(10)
    rec.dot()
    rec.dot(20, 'white')
    expect(rec.commands.slice(1)).toEqual([
      { type: 'dot', x: 10, y: 0, size: 5, color: 'red' },
      { type: 'dot', x: 10, y: 0, size: 20, color: 'white' },
    ])
    expect(rec.state).toMatchObject({ x: 10, y: 0 })
    expect(rec.calls.filter((c) => c.name === 'dot')).toHaveLength(2)
  })

  it('records speed() in the log and the state', () => {
    const rec = createTurtleRecorder()
    rec.setSpeed(3)
    expect(rec.commands).toEqual([{ type: 'speed', speed: 3 }])
    expect(rec.state.speed).toBe(3)
  })

  it('puts a fill before its outline, closed when end_fill() runs', () => {
    const rec = createTurtleRecorder()
    rec.setFillColor('yellow')
    rec.beginFill()
    rec.forward(100)
    rec.turn(120)
    rec.forward(100)
    rec.turn(120)
    rec.forward(100)
    rec.endFill()
    expect(types(rec)).toEqual(['fill', 'line', 'turn', 'line', 'turn', 'line'])
    const fill = rec.commands[0]
    expect(fill.color).toBe('yellow')
    expect(fill.points).toHaveLength(4)
    expect(fill.closedAt).toBe(6)
  })

  it('leaves an unfinished or too-small fill without points', () => {
    const rec = createTurtleRecorder()
    rec.beginFill()
    rec.forward(10)
    rec.endFill()
    expect(rec.commands[0]).toMatchObject({ type: 'fill', points: [], closedAt: null })
  })

  it('records hiding and showing only when it changes', () => {
    const rec = createTurtleRecorder()
    rec.setVisible(true)
    rec.setVisible(false)
    rec.setVisible(false)
    expect(rec.commands).toEqual([{ type: 'visible', visible: false }])
  })

  it('reset() swaps in a new command list', () => {
    const rec = createTurtleRecorder()
    rec.forward(10)
    const before = rec.commands
    rec.reset()
    expect(rec.commands).not.toBe(before)
    expect(rec.commands).toEqual([])
    expect(rec.calls.map((c) => c.name)).toEqual(['forward', 'reset'])
  })
})
