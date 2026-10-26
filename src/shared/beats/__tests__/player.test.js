import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBeatSong, validateBeatCall } from '../patterns.js'
import { buildTimeline } from '../timing.js'
import { createBeatScheduler, LOOKAHEAD_SECONDS, playBeat, stopBeat } from '../player.js'

const songOf = (args, kwargs = { tempo: 100 }) =>
  readBeatSong([validateBeatCall('play', args, kwargs).command])

describe('createBeatScheduler', () => {
  function setup({ loops = 2, start = 1 } = {}) {
    let t = 0
    const scheduled = []
    const steps = []
    const onEnd = vi.fn()
    const timeline = buildTimeline(songOf(['x.x.', '.x..']))
    const scheduler = createBeatScheduler({
      timeline,
      loops,
      now: () => t,
      start,
      schedule: (event, when) => scheduled.push([event.step, when, event.hits.map((h) => h.name)]),
      onStep: (position) => steps.push(position),
      onEnd,
    })
    return { scheduler, scheduled, steps, onEnd, setNow: (value) => (t = value) }
  }

  it('queues only the hits due within the lookahead', () => {
    const { scheduler, scheduled, setNow } = setup()
    setNow(1 - LOOKAHEAD_SECONDS + 0.01)
    scheduler.tick()
    expect(scheduled).toEqual([[0, 1, ['kick']]])
    setNow(1.2)
    scheduler.tick()
    // Step 1 (snare, at 1.15) and step 2 (kick, at 1.3) are now due; nothing is queued twice.
    expect(scheduled.map(([step]) => step)).toEqual([0, 1, 2])
    expect(scheduled[2][1]).toBeCloseTo(1.3)
  })

  it('follows the playhead, once per step', () => {
    const { scheduler, steps, setNow } = setup()
    setNow(0.5)
    scheduler.tick()
    expect(steps).toEqual([]) // not started yet
    setNow(1.01)
    scheduler.tick()
    scheduler.tick()
    setNow(1.16)
    scheduler.tick()
    expect(steps).toEqual([
      { loop: 0, part: 0, step: 0 },
      { loop: 0, part: 0, step: 1 },
    ])
  })

  it('loops, then ends once', () => {
    const { scheduler, scheduled, onEnd, setNow } = setup({ loops: 2 })
    // A 25 ms timer's ticks, from before the start to past the end.
    for (let t = 0.9; t < 2.4; t += 0.025) {
      setNow(t)
      scheduler.tick()
    }
    expect(scheduled.filter(([step]) => step === 0)).toHaveLength(2) // both loops' first kick
    expect(scheduled).toHaveLength(6) // kick, snare, kick, twice
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(scheduler.done).toBe(true)
  })

  it('skips hits that are already late (a sleeping tab) instead of playing them out of time', () => {
    const { scheduler, scheduled, setNow } = setup({ loops: 1 })
    setNow(1.5)
    scheduler.tick()
    expect(scheduled.map(([step]) => step)).toEqual([])
  })
})

describe('playBeat without Web Audio', () => {
  afterEach(() => {
    stopBeat()
  })

  it('plays silently on the page clock, and stopBeat ends it', async () => {
    const onSound = vi.fn()
    const onEnd = vi.fn()
    const onStep = vi.fn()
    const handle = playBeat(songOf(['x...']), { onSound, onEnd, onStep })
    expect(handle).not.toBeNull()
    await Promise.resolve()
    await Promise.resolve()
    expect(onSound).toHaveBeenCalledWith(false)
    stopBeat()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onStep).toHaveBeenLastCalledWith(null)
  })

  it('starting a beat stops the one already playing', () => {
    const first = vi.fn()
    playBeat(songOf(['x...']), { onEnd: first })
    playBeat(songOf(['x.x.']))
    expect(first).toHaveBeenCalledTimes(1)
  })
})
