import { describe, it, expect, vi } from 'vitest'
import { createTurtlePlayer } from '../turtlePlayer.js'

// A canvas-like object whose 2D context records what it was asked to do (jsdom has no canvas).
function mockCanvas(width = 400, height = 400) {
  const calls = []
  const ctx = new Proxy(
    { _calls: calls },
    {
      get(target, key) {
        if (key in target) return target[key]
        if (key === 'canvas') return canvas
        return (...args) => calls.push([key, ...args])
      },
      set(target, key, value) {
        calls.push([key, value])
        return true
      },
    }
  )
  const canvas = { width, height, clientWidth: width, clientHeight: height, getContext: () => ctx }
  return { canvas, ctx, calls }
}

function setup(overrides = {}) {
  const front = mockCanvas()
  const backs = []
  let clock = 0
  let pending = null
  const statuses = []
  const drawMarker = vi.fn()
  const player = createTurtlePlayer({
    canvas: front.canvas,
    drawMarker,
    onStatus: (s) => statuses.push(s),
    now: () => clock,
    requestFrame: (cb) => {
      pending = cb
      return 1
    },
    cancelFrame: () => {
      pending = null
    },
    createCanvas: () => {
      const back = mockCanvas(300, 150)
      backs.push(back)
      return back.canvas
    },
    ...overrides,
  })
  return {
    player,
    front,
    backs,
    statuses,
    drawMarker,
    advance(ms) {
      clock += ms
      const cb = pending
      pending = null
      cb?.()
    },
  }
}

const line = (x2, extra = {}) => ({
  type: 'line',
  x1: 0,
  y1: 0,
  x2,
  y2: 0,
  heading: 0,
  color: 'black',
  width: 1,
  ...extra,
})

describe('createTurtlePlayer', () => {
  it('load() shows the finished drawing at once', () => {
    const t = setup()
    t.player.load({ commands: [line(100)], finalPose: { x: 100, y: 0, heading: 0 } })
    expect(t.front.calls.filter((c) => c[0] === 'stroke')).toHaveLength(1)
    expect(t.drawMarker).toHaveBeenLastCalledWith(
      expect.anything(),
      { x: 100, y: 0, heading: 0 },
      expect.anything(),
      null
    )
    expect(t.player.status).toBe('idle')
  })

  it('plays: part of the line and the marker part way, then the finished drawing', () => {
    const t = setup()
    t.player.load({ commands: [line(100)], finalPose: { x: 100, y: 0, heading: 0 } })
    t.player.play()
    expect(t.player.status).toBe('playing')
    t.advance(10) // halfway along a 20 ms line
    expect(t.front.calls).toContainEqual(['drawImage', t.backs[0].canvas, 0, 0])
    const pose = t.drawMarker.mock.calls.at(-1)[1]
    expect(pose.x).toBeCloseTo(50)
    t.advance(20)
    expect(t.player.status).toBe('finished')
    expect(t.statuses).toEqual(['playing', 'finished'])
  })

  it('draws each finished record onto the back canvas only once', () => {
    const t = setup()
    t.player.load({ commands: [line(100), line(50), line(25)] })
    t.player.play()
    t.advance(25) // the first line (20 ms) is done
    t.advance(1)
    t.advance(1)
    const strokes = t.backs[0].calls.filter((c) => c[0] === 'stroke')
    expect(strokes).toHaveLength(1)
  })

  it('redraws the back canvas from scratch when a fill closes', () => {
    const t = setup()
    const fill = {
      type: 'fill',
      color: 'green',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      closedAt: 3,
    }
    t.player.load({ commands: [fill, line(100), line(100), line(100)] })
    t.player.play()
    t.advance(45) // fill + 2 lines done (fill closes at 3)
    const back = t.backs[0].calls
    const fillAt = back.findIndex((c) => c[0] === 'fill')
    const lastClear = back.map((c) => c[0]).lastIndexOf('fillRect')
    expect(fillAt).toBeGreaterThan(lastClear)
  })

  it('skip() jumps to the finished drawing', () => {
    const t = setup()
    t.player.load({ commands: [{ type: 'speed', speed: 1 }, line(100)] })
    t.player.play()
    t.advance(5)
    t.player.skip()
    expect(t.player.status).toBe('finished')
  })

  it('an instant drawing (speed 0) never plays', () => {
    const t = setup()
    t.player.load({ commands: [{ type: 'speed', speed: 0 }, line(100)] })
    t.player.play()
    expect(t.player.status).toBe('finished')
  })

  it('does not animate without a 2D context (jsdom)', () => {
    const canvas = { width: 1, height: 1, clientWidth: 1, clientHeight: 1, getContext: () => null }
    const player = createTurtlePlayer({ canvas, requestFrame: vi.fn(), cancelFrame: vi.fn() })
    player.load({ commands: [line(100)] })
    player.play()
    expect(player.status).toBe('finished')
  })
})
