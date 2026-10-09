// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLiveInkWriter } from '../liveInkWriter'
import { POINTER_INTERVAL_MS, STROKE_REMOVE_AFTER_MS } from '../liveInkData'

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  push: vi.fn((parentRef) => ({ path: `${parentRef.path}/pushed-1`, key: 'pushed-1' })),
  onDisconnectRemove: vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => firebaseMocks.ref(...args),
  set: (...args) => firebaseMocks.set(...args),
  remove: (...args) => firebaseMocks.remove(...args),
  push: (...args) => firebaseMocks.push(...args),
  onDisconnect: (target) => ({ remove: () => firebaseMocks.onDisconnectRemove(target) }),
}))

vi.mock('../../../shared/firebase', () => ({ db: {} }))

const pointerWrites = () =>
  firebaseMocks.set.mock.calls.filter(([target]) => target.path === 'liveInk/lesson-1/pointer')

describe('createLiveInkWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('throttles pointer writes to ~12Hz, always ending where the mouse stopped', () => {
    const writer = createLiveInkWriter('lesson-1')
    for (let i = 0; i < 60; i += 1) {
      writer.movePointer({ surface: 'info:1', anchor: 'b0.p0', rx: i / 100, ry: 0.5 })
      vi.advanceTimersByTime(10)
    }
    vi.advanceTimersByTime(POINTER_INTERVAL_MS)
    // 600ms of movement at one write per 80ms, plus the leading and trailing edges.
    expect(pointerWrites().length).toBeLessThanOrEqual(Math.ceil(600 / POINTER_INTERVAL_MS) + 2)
    expect(pointerWrites().length).toBeGreaterThan(1)
    expect(pointerWrites().at(-1)[1]).toEqual({
      surface: 'info:1',
      anchor: 'b0.p0',
      rx: 0.59,
      ry: 0.5,
      t: expect.any(Number),
    })
  })

  it('writes a text-anchored pointer with only its own keys', () => {
    const writer = createLiveInkWriter('lesson-1')
    writer.movePointer({ surface: 'info:1', anchor: 'b0.p0', c: 7, dx: 0.25, dy: -0.1 })
    vi.advanceTimersByTime(POINTER_INTERVAL_MS)
    expect(pointerWrites().at(-1)[1]).toEqual({
      surface: 'info:1',
      anchor: 'b0.p0',
      c: 7,
      dx: 0.25,
      dy: -0.1,
      t: expect.any(Number),
    })
  })

  it('hidePointer drops a waiting move and removes the pointer', () => {
    const writer = createLiveInkWriter('lesson-1')
    writer.movePointer({ surface: 'info:1', anchor: 'b0', rx: 0.1, ry: 0.1 })
    writer.movePointer({ surface: 'info:1', anchor: 'b0', rx: 0.2, ry: 0.2 })
    writer.hidePointer()
    vi.advanceTimersByTime(500)
    expect(pointerWrites().map(([, value]) => value?.rx ?? null)).toEqual([0.1, null])
  })

  it('writes a stroke once and deletes it after its fade', () => {
    const writer = createLiveInkWriter('lesson-1')
    writer.addStroke({ surface: 'explainer:2', anchor: 'b0.li1', points: [[0.1, 0.2]] })
    expect(firebaseMocks.push).toHaveBeenCalledWith({ path: 'liveInk/lesson-1/strokes' })
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'liveInk/lesson-1/strokes/pushed-1' }),
      expect.objectContaining({ surface: 'explainer:2', anchor: 'b0.li1', points: [[0.1, 0.2]] })
    )
    expect(firebaseMocks.remove).not.toHaveBeenCalled()
    vi.advanceTimersByTime(STROKE_REMOVE_AFTER_MS)
    expect(firebaseMocks.remove).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'liveInk/lesson-1/strokes/pushed-1' })
    )
  })

  it('adds and removes highlights', () => {
    const writer = createLiveInkWriter('lesson-1')
    writer.addHighlight({ surface: 'info:1', anchor: 'b0.p0', quote: 'print', occurrence: 1 })
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'liveInk/lesson-1/highlights/pushed-1' }),
      { surface: 'info:1', anchor: 'b0.p0', quote: 'print', occurrence: 1, t: 10_000 }
    )
    writer.removeHighlight('h9')
    expect(firebaseMocks.remove).toHaveBeenCalledWith({ path: 'liveInk/lesson-1/highlights/h9' })
  })

  it('clears the whole node, and arms the same on disconnect', () => {
    const writer = createLiveInkWriter('lesson-1')
    writer.armDisconnectCleanup()
    expect(firebaseMocks.onDisconnectRemove).toHaveBeenCalledWith({ path: 'liveInk/lesson-1' })
    writer.clearAll()
    expect(firebaseMocks.remove).toHaveBeenCalledWith({ path: 'liveInk/lesson-1' })
  })
})
