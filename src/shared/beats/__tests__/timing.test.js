import { describe, expect, it } from 'vitest'
import { validateBeatCall, readBeatSong } from '../patterns.js'
import {
  DEFAULT_LOOPS,
  MAX_PLAY_SECONDS,
  buildTimeline,
  eventAt,
  loopCountFor,
  positionAt,
  songSeconds,
  stepSeconds,
} from '../timing.js'

const songOf = (...calls) =>
  readBeatSong(calls.map(([args, kwargs]) => validateBeatCall('play', args, kwargs).command))

describe('stepSeconds', () => {
  it('makes a step a sixteenth note', () => {
    expect(stepSeconds(100)).toBeCloseTo(0.15)
    expect(stepSeconds(120)).toBeCloseTo(0.125)
    expect(stepSeconds(60)).toBeCloseTo(0.25)
  })
})

describe('buildTimeline', () => {
  it('has one event per step, with the hits on it', () => {
    const { events, period } = buildTimeline(songOf([['x...', '..x.'], { tempo: 100 }]))
    expect(events).toHaveLength(4)
    expect(period).toBeCloseTo(0.6)
    expect(events[0]).toEqual({ at: 0, part: 0, step: 0, hits: [{ name: 'kick', accent: false }] })
    expect(events[1].hits).toEqual([])
    expect(events[2].at).toBeCloseTo(0.3)
    expect(events[2].hits).toEqual([{ name: 'snare', accent: false }])
  })

  it('repeats a shorter row until the longest ends', () => {
    const { events } = buildTimeline(songOf([['x.', '.......X']]))
    expect(events.filter((e) => e.hits.some((h) => h.name === 'kick')).map((e) => e.step)).toEqual([
      0, 2, 4, 6,
    ])
    expect(events[7].hits).toEqual([{ name: 'snare', accent: true }])
  })

  it('plays parts one after another, each at its own tempo', () => {
    const { events, period } = buildTimeline(
      songOf([['x...'], { tempo: 100 }], [['x.'], { tempo: 60 }])
    )
    expect(events.map((e) => [e.part, e.step])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 1],
    ])
    expect(events[4].at).toBeCloseTo(0.6)
    expect(period).toBeCloseTo(0.6 + 0.5)
  })
})

describe('loopCountFor', () => {
  it('plays four times through, more for a very short beat, fewer for a long song', () => {
    expect(loopCountFor(2.4)).toBe(DEFAULT_LOOPS)
    expect(loopCountFor(0.6)).toBe(14) // at least 8 seconds
    expect(loopCountFor(20)).toBe(3) // at most a minute
    expect(loopCountFor(90)).toBe(1) // a very long song still plays once
    expect(loopCountFor(0)).toBe(0)
    expect(loopCountFor(25) * 25).toBeLessThanOrEqual(MAX_PLAY_SECONDS)
  })
})

describe('eventAt / positionAt', () => {
  const timeline = buildTimeline(songOf([['x...'], { tempo: 100 }]))

  it('counts steps across loops', () => {
    const { time, event, loop } = eventAt(timeline, 5)
    expect(loop).toBe(1)
    expect(event.step).toBe(1)
    expect(time).toBeCloseTo(0.6 + 0.15)
  })

  it('finds the step the playhead is on, and null outside the performance', () => {
    expect(positionAt(timeline, 0, 2)).toEqual({ loop: 0, part: 0, step: 0 })
    expect(positionAt(timeline, 0.16, 2)).toEqual({ loop: 0, part: 0, step: 1 })
    expect(positionAt(timeline, 0.6 + 0.46, 2)).toEqual({ loop: 1, part: 0, step: 3 })
    expect(positionAt(timeline, -0.01, 2)).toBeNull()
    expect(positionAt(timeline, 1.2, 2)).toBeNull()
  })

  it('totals the seconds played', () => {
    expect(songSeconds(songOf([['x'.repeat(16)], { tempo: 100 }]))).toBeCloseTo(2.4 * 4)
    expect(songSeconds(null)).toBe(0)
  })
})
