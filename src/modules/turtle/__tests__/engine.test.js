import { describe, it, expect } from 'vitest'
import {
  createTurtleState,
  applyTurtleForward,
  applyTurtleTurn,
  applyTurtleSetHeading,
  applyTurtleGoto,
  applyTurtleHome,
  applyTurtleSetFillColor,
  applyTurtleSetBackground,
} from '../engine.js'

describe('createTurtleState', () => {
  it('starts at the origin facing east with the pen down', () => {
    expect(createTurtleState()).toEqual({
      x: 0,
      y: 0,
      heading: 0,
      penDown: true,
      color: 'black',
      fillColor: 'black',
      background: '#ffffff',
    })
  })
})

describe('applyTurtleForward', () => {
  it('moves along heading 0 (east) purely in x', () => {
    const { nextState, segment } = applyTurtleForward(createTurtleState(), 100)
    expect(nextState.x).toBeCloseTo(100)
    expect(nextState.y).toBeCloseTo(0)
    expect(segment).toEqual({ x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' })
  })

  it('moves along heading 90 (north, y increases upward) purely in y', () => {
    const state = { ...createTurtleState(), heading: 90 }
    const { nextState } = applyTurtleForward(state, 100)
    expect(nextState.x).toBeCloseTo(0)
    expect(nextState.y).toBeCloseTo(100)
  })

  it('supports negative distance (backward)', () => {
    const { nextState } = applyTurtleForward(createTurtleState(), -50)
    expect(nextState.x).toBeCloseTo(-50)
  })

  it('does not record a segment when the pen is up', () => {
    const state = { ...createTurtleState(), penDown: false }
    const { segment } = applyTurtleForward(state, 100)
    expect(segment).toBeNull()
  })

  it('does not record a zero-length segment', () => {
    const { segment } = applyTurtleForward(createTurtleState(), 0)
    expect(segment).toBeNull()
  })

  it('uses the pen colour in effect before the move', () => {
    const state = { ...createTurtleState(), color: 'red' }
    const { segment } = applyTurtleForward(state, 10)
    expect(segment.color).toBe('red')
  })
})

describe('applyTurtleTurn', () => {
  it('left() (positive degrees) increases heading counter-clockwise', () => {
    expect(applyTurtleTurn(createTurtleState(), 90).heading).toBe(90)
  })

  it('right() (negative degrees) normalizes into [0, 360)', () => {
    expect(applyTurtleTurn(createTurtleState(), -90).heading).toBe(270)
  })

  it('wraps past 360', () => {
    expect(applyTurtleTurn({ ...createTurtleState(), heading: 350 }, 20).heading).toBe(10)
  })
})

describe('applyTurtleSetHeading', () => {
  it('sets heading directly, normalized', () => {
    expect(applyTurtleSetHeading(createTurtleState(), -30).heading).toBe(330)
  })
})

describe('applyTurtleGoto', () => {
  it('jumps directly to the given coordinates', () => {
    const { nextState, segment } = applyTurtleGoto(createTurtleState(), 40, 60)
    expect(nextState.x).toBe(40)
    expect(nextState.y).toBe(60)
    expect(segment).toEqual({ x1: 0, y1: 0, x2: 40, y2: 60, color: 'black' })
  })
})

describe('applyTurtleHome', () => {
  it('returns to the origin and resets heading to 0, drawing a line if pen is down', () => {
    const state = { x: 50, y: 50, heading: 45, penDown: true, color: 'blue' }
    const { nextState, segment } = applyTurtleHome(state)
    expect(nextState).toEqual({ x: 0, y: 0, heading: 0, penDown: true, color: 'blue' })
    expect(segment).toEqual({ x1: 50, y1: 50, x2: 0, y2: 0, color: 'blue' })
  })
})

describe('applyTurtleSetFillColor', () => {
  it('sets the fill colour without touching other state', () => {
    const next = applyTurtleSetFillColor(createTurtleState(), 'yellow')
    expect(next.fillColor).toBe('yellow')
    expect(next.color).toBe('black')
  })
})

describe('applyTurtleSetBackground', () => {
  it('sets the background colour without touching other state', () => {
    const next = applyTurtleSetBackground(createTurtleState(), '#000000')
    expect(next.background).toBe('#000000')
    expect(next.color).toBe('black')
  })
})
