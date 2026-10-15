import { describe, it, expect, vi } from 'vitest'
import {
  computeTurtleTransform,
  toCanvasPoint,
  drawTurtleCommands,
  sizeCanvasToDisplay,
  turtleMarkerTransform,
  TURTLE_MARKER_EMOJI,
  isTurtleFillShown,
  drawTurtleItems,
  drawPartialTurtleLine,
} from '../draw.js'

// jsdom has no real canvas 2D context, and we're not adding the `canvas` npm
// package to get one (no new dependencies) — so drawTurtleCommands is tested
// against a mock context that just records what it was asked to do.
function createMockContext(width, height) {
  const calls = []
  return {
    canvas: { width, height },
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    beginPath: () => calls.push(['beginPath']),
    closePath: () => calls.push(['closePath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    stroke: () => calls.push(['stroke']),
    fill: () => calls.push(['fill']),
    arc: (...args) => calls.push(['arc', ...args]),
    translate: (...args) => calls.push(['translate', ...args]),
    rotate: (...args) => calls.push(['rotate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    set fillStyle(v) {
      calls.push(['fillStyle', v])
    },
    set strokeStyle(v) {
      calls.push(['strokeStyle', v])
    },
    set lineWidth(v) {
      calls.push(['lineWidth', v])
    },
    set lineCap(v) {},
    set lineJoin(v) {},
    set font(v) {
      calls.push(['font', v])
    },
    set textAlign(v) {
      calls.push(['textAlign', v])
    },
    set textBaseline(v) {},
    _calls: calls,
  }
}

describe('computeTurtleTransform', () => {
  it('centres the origin and scales to fit a square canvas exactly', () => {
    const transform = computeTurtleTransform(400, 400, 400, 400)
    expect(transform.scale).toBe(1)
    expect(transform.offsetX).toBe(200)
    expect(transform.offsetY).toBe(200)
  })

  it('scales down to fit a smaller canvas, same logical world', () => {
    const transform = computeTurtleTransform(200, 200, 400, 400)
    expect(transform.scale).toBe(0.5)
  })

  it('"contain"-fits a non-square canvas using the smaller ratio', () => {
    const transform = computeTurtleTransform(800, 200, 400, 400)
    expect(transform.scale).toBe(0.5)
  })
})

describe('toCanvasPoint', () => {
  it('flips y (turtle up is canvas down) and applies the offset/scale', () => {
    const transform = { scale: 2, offsetX: 100, offsetY: 100 }
    expect(toCanvasPoint(10, 20, transform)).toEqual({ x: 120, y: 60 })
  })
})

describe('drawTurtleCommands', () => {
  it('clears the canvas and strokes each drawn line', () => {
    const ctx = createMockContext(400, 400)
    const commands = [
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'red' },
      { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100, color: 'blue' },
    ]
    drawTurtleCommands(ctx, commands)
    expect(ctx._calls.filter((c) => c[0] === 'fillRect')).toHaveLength(1)
    expect(ctx._calls.filter((c) => c[0] === 'stroke')).toHaveLength(2)
    expect(ctx._calls).toContainEqual(['strokeStyle', 'red'])
    expect(ctx._calls).toContainEqual(['strokeStyle', 'blue'])
  })

  it('ignores non-line commands and handles an empty log', () => {
    const ctx = createMockContext(400, 400)
    expect(() => drawTurtleCommands(ctx, [{ type: 'unknown' }])).not.toThrow()
    expect(ctx._calls.filter((c) => c[0] === 'stroke')).toHaveLength(0)
  })

  it('defaults to a white background', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [])
    expect(ctx._calls).toContainEqual(['fillStyle', '#ffffff'])
  })

  it('uses the given background colour', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [], { background: '#000000' })
    expect(ctx._calls).toContainEqual(['fillStyle', '#000000'])
  })

  it('fills a polygon for a fill command with 3+ points', () => {
    const ctx = createMockContext(400, 400)
    const commands = [
      {
        type: 'fill',
        color: 'green',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ]
    drawTurtleCommands(ctx, commands)
    expect(ctx._calls).toContainEqual(['fillStyle', 'green'])
    expect(ctx._calls.filter((c) => c[0] === 'fill')).toHaveLength(1)
    expect(ctx._calls.filter((c) => c[0] === 'closePath')).toHaveLength(1)
  })

  it('ignores a fill command with fewer than 3 points', () => {
    const ctx = createMockContext(400, 400)
    const commands = [{ type: 'fill', color: 'green', points: [{ x: 0, y: 0 }] }]
    drawTurtleCommands(ctx, commands)
    expect(ctx._calls.filter((c) => c[0] === 'fill')).toHaveLength(0)
  })

  const triangle = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]

  it('draws in code order, so a later fill covers an earlier line', () => {
    const ctx = createMockContext(400, 400)
    const commands = [
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' },
      { type: 'fill', color: 'green', points: triangle },
    ]
    drawTurtleCommands(ctx, commands)
    const fillIndex = ctx._calls.findIndex((c) => c[0] === 'fill')
    const strokeIndex = ctx._calls.findIndex((c) => c[0] === 'stroke')
    expect(strokeIndex).toBeLessThan(fillIndex)
  })

  it("keeps a fill's own outline on top: the fill record comes before its outline", () => {
    const ctx = createMockContext(400, 400)
    // As the recorder logs it: begin_fill() puts the fill first, closed after 3 more records.
    const commands = [
      { type: 'fill', color: 'green', points: triangle, closedAt: 3 },
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' },
      { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100, color: 'black' },
    ]
    drawTurtleCommands(ctx, commands)
    const fillIndex = ctx._calls.findIndex((c) => c[0] === 'fill')
    const strokeIndex = ctx._calls.findIndex((c) => c[0] === 'stroke')
    expect(fillIndex).toBeLessThan(strokeIndex)
  })

  it('a later line covers an earlier dot and the other way round', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [
      { type: 'dot', x: 0, y: 0, size: 20, color: 'red' },
      { type: 'line', x1: 0, y1: 0, x2: 50, y2: 0, color: 'blue' },
      { type: 'dot', x: 50, y: 0, size: 20, color: 'white' },
    ])
    const order = ctx._calls.filter((c) => c[0] === 'arc' || c[0] === 'stroke').map((c) => c[0])
    expect(order).toEqual(['arc', 'stroke', 'arc'])
  })

  it('skips motion records (move, turn, speed, visible)', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [
      { type: 'move', x1: 0, y1: 0, x2: 50, y2: 0, heading: 0 },
      { type: 'turn', from: 0, delta: 90 },
      { type: 'speed', speed: 3 },
      { type: 'visible', visible: false },
    ])
    expect(ctx._calls.filter((c) => ['stroke', 'fill', 'arc'].includes(c[0]))).toHaveLength(0)
  })

  it('draws lines at their pensize, never thinner than 1.5 units', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black', width: 1 },
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black', width: 6 },
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: 'black' },
    ])
    expect(ctx._calls.filter((c) => c[0] === 'lineWidth').map((c) => c[1])).toEqual([1.5, 6, 1.5])
  })

  it('draws nothing for pensize 0', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [{ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, width: 0 }])
    expect(ctx._calls.filter((c) => c[0] === 'stroke')).toHaveLength(0)
  })

  it('draws a dot as a filled circle of the given diameter, centred on the turtle', () => {
    const ctx = createMockContext(400, 400)
    drawTurtleCommands(ctx, [{ type: 'dot', x: 10, y: 20, size: 30, color: 'gold' }])
    expect(ctx._calls).toContainEqual(['fillStyle', 'gold'])
    const arc = ctx._calls.find((c) => c[0] === 'arc')
    expect(arc.slice(1, 4)).toEqual([210, 180, 15])
  })

  it('hides a fill until the shown records include where it closed', () => {
    const commands = [
      { type: 'fill', color: 'green', points: triangle, closedAt: 3 },
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' },
      { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100, color: 'black' },
    ]
    expect(isTurtleFillShown(commands[0], 2)).toBe(false)
    expect(isTurtleFillShown(commands[0], 3)).toBe(true)
    // A fill from before closedAt existed (an old synced drawing) always shows.
    expect(isTurtleFillShown({ type: 'fill', points: triangle })).toBe(true)
    const ctx = createMockContext(400, 400)
    drawTurtleItems(ctx, commands, computeTurtleTransform(400, 400), 0, 2)
    expect(ctx._calls.filter((c) => c[0] === 'fill')).toHaveLength(0)
  })

  it('draws part of a line for playback', () => {
    const ctx = createMockContext(400, 400)
    drawPartialTurtleLine(
      ctx,
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' },
      0.5,
      computeTurtleTransform(400, 400)
    )
    expect(ctx._calls).toContainEqual(['lineTo', 250, 200])
  })

  it('uses a custom marker when one is given', () => {
    const ctx = createMockContext(400, 400)
    const drawMarker = vi.fn()
    const turtle = { x: 0, y: 0, heading: 0, visible: true }
    drawTurtleCommands(ctx, [], { turtle, drawMarker })
    expect(drawMarker).toHaveBeenCalledWith(ctx, turtle, expect.objectContaining({ scale: 1 }))
    expect(ctx._calls.some((c) => c[1] === TURTLE_MARKER_EMOJI)).toBe(false)
  })

  it('draws a stamp as a rotated/translated triangle', () => {
    const ctx = createMockContext(400, 400)
    const commands = [{ type: 'stamp', x: 10, y: 20, heading: 90, color: 'blue' }]
    drawTurtleCommands(ctx, commands)
    expect(ctx._calls.filter((c) => c[0] === 'translate')).toHaveLength(1)
    expect(ctx._calls.filter((c) => c[0] === 'rotate')).toHaveLength(1)
    expect(ctx._calls).toContainEqual(['fillStyle', 'blue'])
  })

  it('draws text with fillText at the given alignment', () => {
    const ctx = createMockContext(400, 400)
    const commands = [
      { type: 'text', x: 0, y: 0, text: 'hi', color: 'black', align: 'center', fontSize: 12 },
    ]
    drawTurtleCommands(ctx, commands)
    expect(ctx._calls).toContainEqual(['textAlign', 'center'])
    expect(ctx._calls.some((c) => c[0] === 'fillText' && c[1] === 'hi')).toBe(true)
  })

  const markerCalls = (ctx) =>
    ctx._calls.filter((c) => c[0] === 'fillText' && c[1] === TURTLE_MARKER_EMOJI)

  it('draws the 🐢 marker at the turtle position, last so it sits on top', () => {
    const ctx = createMockContext(400, 400)
    const commands = [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' }]
    drawTurtleCommands(ctx, commands, { turtle: { x: 50, y: 25, heading: 0, visible: true } })
    expect(markerCalls(ctx)).toHaveLength(1)
    // (50, 25) in turtle space is (250, 175) on a 400x400 canvas.
    expect(ctx._calls).toContainEqual(['translate', 250, 175])
    const markerIndex = ctx._calls.findIndex((c) => c[0] === 'fillText')
    const strokeIndex = ctx._calls.findIndex((c) => c[0] === 'stroke')
    expect(markerIndex).toBeGreaterThan(strokeIndex)
  })

  it('does not draw the marker when hidden or when no turtle state is given', () => {
    const hidden = createMockContext(400, 400)
    drawTurtleCommands(hidden, [], { turtle: { x: 0, y: 0, heading: 0, visible: false } })
    expect(markerCalls(hidden)).toHaveLength(0)
    const none = createMockContext(400, 400)
    drawTurtleCommands(none, [])
    expect(markerCalls(none)).toHaveLength(0)
  })
})

describe('turtleMarkerTransform', () => {
  it('mirrors the left-facing emoji when the turtle heads east, with no rotation', () => {
    const { rotation, mirror } = turtleMarkerTransform(0)
    expect(mirror).toBe(true)
    expect(rotation).toBeCloseTo(0)
  })

  it('rotates counter-clockwise (negative canvas rotation) for a north heading', () => {
    const { rotation, mirror } = turtleMarkerTransform(90)
    expect(mirror).toBe(true)
    expect(rotation).toBeCloseTo(-Math.PI / 2)
  })

  it('keeps the turtle upright (unmirrored, unrotated) when heading west', () => {
    const { rotation, mirror } = turtleMarkerTransform(180)
    expect(mirror).toBe(false)
    expect(rotation).toBeCloseTo(0)
  })

  it('normalises negative and >360 headings', () => {
    expect(turtleMarkerTransform(-90)).toEqual(turtleMarkerTransform(270))
    expect(turtleMarkerTransform(450)).toEqual(turtleMarkerTransform(90))
  })
})

describe('sizeCanvasToDisplay', () => {
  it('sizes the backing buffer to clientWidth/clientHeight scaled by devicePixelRatio', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const canvas = { clientWidth: 300, clientHeight: 150, width: 0, height: 0 }
    const changed = sizeCanvasToDisplay(canvas)
    expect(changed).toBe(true)
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(300)
    vi.unstubAllGlobals()
  })

  it('returns false when the size has not changed', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const canvas = { clientWidth: 100, clientHeight: 100, width: 100, height: 100 }
    expect(sizeCanvasToDisplay(canvas)).toBe(false)
    vi.unstubAllGlobals()
  })

  it('returns false for a null canvas', () => {
    expect(sizeCanvasToDisplay(null)).toBe(false)
  })
})
