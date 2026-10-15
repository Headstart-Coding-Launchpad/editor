// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildTurtleTimeline,
  moveDurationMs,
  normalizeTurtleSpeed,
  turnDurationMs,
  turtleTimelineFrame,
  DEFAULT_PLAYBACK_MAX_MS,
} from '../playback.js'
import { createTurtleRecorder } from '../recorder.js'

const line = (x1, y1, x2, y2, extra = {}) => ({
  type: 'line',
  x1,
  y1,
  x2,
  y2,
  heading: 0,
  color: 'black',
  width: 1,
  ...extra,
})

describe('normalizeTurtleSpeed', () => {
  it('reads names and numbers like real turtle', () => {
    expect(normalizeTurtleSpeed('fastest')).toBe(0)
    expect(normalizeTurtleSpeed('fast')).toBe(10)
    expect(normalizeTurtleSpeed('Normal')).toBe(6)
    expect(normalizeTurtleSpeed('slow')).toBe(3)
    expect(normalizeTurtleSpeed('slowest')).toBe(1)
    expect(normalizeTurtleSpeed(5.4)).toBe(5)
    expect(normalizeTurtleSpeed('7')).toBe(7)
    // Outside 0.5–10.5 means instant, as in real turtle.
    expect(normalizeTurtleSpeed(11)).toBe(0)
    expect(normalizeTurtleSpeed(0.3)).toBe(0)
    expect(normalizeTurtleSpeed('zoom')).toBeNull()
    expect(normalizeTurtleSpeed(null)).toBeNull()
  })
})

describe('real turtle pace', () => {
  it('moves take 1 + floor(d / (3 · 1.1^s · s)) updates of 10 ms', () => {
    expect(moveDurationMs(100, 10)).toBe(20)
    expect(moveDurationMs(100, 1)).toBe(310)
    expect(moveDurationMs(-100, 1)).toBe(310)
    expect(moveDurationMs(100, 0)).toBe(0)
  })

  it('turns take 1 + floor(|a| / (3 · s)) updates of 10 ms', () => {
    expect(turnDurationMs(90, 10)).toBe(40)
    expect(turnDurationMs(-90, 1)).toBe(310)
    expect(turnDurationMs(90, 0)).toBe(0)
  })

  it('slower speeds take longer', () => {
    for (let s = 1; s < 10; s += 1) {
      expect(moveDurationMs(200, s)).toBeGreaterThanOrEqual(moveDurationMs(200, s + 1))
    }
  })
})

describe('buildTurtleTimeline', () => {
  it('with no speed() call plays at speed 10, squeezed into about 4 s', () => {
    const commands = Array.from({ length: 500 }, () => line(0, 0, 100, 0))
    const timeline = buildTurtleTimeline(commands)
    expect(timeline.mode).toBe('default')
    expect(timeline.totalMs).toBeCloseTo(DEFAULT_PLAYBACK_MAX_MS, 6)
    expect(timeline.scale).toBeCloseTo(DEFAULT_PLAYBACK_MAX_MS / (500 * 20), 6)
  })

  it('does not stretch a short drawing with no speed() call', () => {
    const timeline = buildTurtleTimeline([line(0, 0, 100, 0)])
    expect(timeline.mode).toBe('default')
    expect(timeline.totalMs).toBe(20)
    expect(timeline.scale).toBe(1)
  })

  it('with speed() plays at real pace however long it takes', () => {
    const commands = [
      { type: 'speed', speed: 1 },
      ...Array.from({ length: 100 }, () => line(0, 0, 100, 0)),
    ]
    const timeline = buildTurtleTimeline(commands)
    expect(timeline.mode).toBe('speed')
    expect(timeline.totalMs).toBe(100 * 310)
  })

  it('moves before the first speed() call play at speed 10', () => {
    const timeline = buildTurtleTimeline([
      line(0, 0, 100, 0),
      { type: 'speed', speed: 1 },
      line(0, 0, 100, 0),
    ])
    expect(timeline.steps.map((s) => s.end - s.start)).toEqual([20, 0, 310])
  })

  it('speed(0) draws instantly', () => {
    const timeline = buildTurtleTimeline([{ type: 'speed', speed: 0 }, line(0, 0, 100, 0)])
    expect(timeline.totalMs).toBe(0)
    expect(timeline.mode).toBe('instant')
  })

  it("turns take time, except circle()'s own turns and turns while hidden", () => {
    const timeline = buildTurtleTimeline([
      { type: 'turn', from: 0, delta: 90 },
      { type: 'turn', from: 90, delta: 6, instant: true },
      { type: 'visible', visible: false },
      { type: 'turn', from: 96, delta: 90 },
    ])
    expect(timeline.steps.map((s) => s.end - s.start)).toEqual([40, 0, 0, 0])
  })

  it('pen-up moves take time while the turtle is visible', () => {
    const timeline = buildTurtleTimeline([
      { type: 'move', x1: 0, y1: 0, x2: 100, y2: 0, heading: 0 },
    ])
    expect(timeline.totalMs).toBe(20)
  })

  it('lists where fills close, for a full redraw', () => {
    const recorder = createTurtleRecorder()
    recorder.beginFill()
    recorder.forward(100)
    recorder.turn(120)
    recorder.forward(100)
    recorder.turn(120)
    recorder.forward(100)
    recorder.endFill()
    const timeline = buildTurtleTimeline(recorder.commands)
    expect(timeline.redrawAt).toEqual([6])
    expect(timeline.steps).toHaveLength(recorder.commands.length)
  })
})

describe('turtleTimelineFrame', () => {
  const timeline = buildTurtleTimeline([line(0, 0, 100, 0), { type: 'turn', from: 0, delta: 90 }])

  it('is part way along a line', () => {
    const frame = turtleTimelineFrame(timeline, 10)
    expect(frame.done).toBe(0)
    expect(frame.active.kind).toBe('line')
    expect(frame.progress).toBeCloseTo(0.5)
    expect(frame.pose).toMatchObject({ x: 50, y: 0, heading: 0 })
  })

  it('turns the marker part way', () => {
    const frame = turtleTimelineFrame(timeline, 40)
    expect(frame.done).toBe(1)
    expect(frame.active.kind).toBe('turn')
    expect(frame.pose.heading).toBeCloseTo(45)
    expect(frame.pose).toMatchObject({ x: 100, y: 0 })
  })

  it('is finished at the end', () => {
    const frame = turtleTimelineFrame(timeline, 10_000)
    expect(frame).toMatchObject({ done: 2, finished: true, active: null })
    expect(frame.pose.heading).toBe(90)
  })
})
