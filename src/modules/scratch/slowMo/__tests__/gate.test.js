import { describe, it, expect, vi } from 'vitest'
import { clampSlowMoSpeed, createSlowMoGate } from '../gate.js'

// A fake clock + timers so the gate's scheduling is checked step by step.
function fakeTimers() {
  let t = 0
  let seq = 0
  const pending = new Map()
  return {
    now: () => t,
    timers: {
      setTimeout(fn, ms) {
        seq += 1
        pending.set(seq, { fn, at: t + ms })
        return seq
      },
      clearTimeout(id) {
        pending.delete(id)
      },
    },
    advance(ms) {
      const end = t + ms
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, p]) => p.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        pending.delete(due[0])
        t = due[1].at
        due[1].fn()
      }
      t = end
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function track(promise) {
  const box = { done: false }
  promise.then(() => {
    box.done = true
  })
  return box
}

describe('clampSlowMoSpeed', () => {
  it('keeps the speed within 0.25–4 and defaults bad values to 1', () => {
    expect(clampSlowMoSpeed(2)).toBe(2)
    expect(clampSlowMoSpeed(10)).toBe(4)
    expect(clampSlowMoSpeed(0.1)).toBe(0.25)
    expect(clampSlowMoSpeed(0)).toBe(1)
    expect(clampSlowMoSpeed('fast')).toBe(1)
  })
})

describe('createSlowMoGate — playing', () => {
  it('lets a script’s first block straight through, then one block per interval', async () => {
    const clock = fakeTimers()
    const onRelease = vi.fn()
    const gate = createSlowMoGate({ speed: 1, onRelease, ...clock })
    const first = track(gate.wait('a'))
    await flush()
    expect(first.done).toBe(true)
    const second = track(gate.wait('a'))
    clock.advance(999)
    await flush()
    expect(second.done).toBe(false)
    clock.advance(1)
    await flush()
    expect(second.done).toBe(true)
    expect(onRelease.mock.calls.map(([r]) => r.step)).toEqual([1, 2])
  })

  it('moves concurrent scripts together, each on its own clock', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ speed: 2, ...clock })
    const a = track(gate.wait('a'))
    const b = track(gate.wait('b'))
    await flush()
    expect([a.done, b.done]).toEqual([true, true])
    const a2 = track(gate.wait('a'))
    const b2 = track(gate.wait('b'))
    clock.advance(500)
    await flush()
    expect([a2.done, b2.done]).toEqual([true, true])
  })

  it('does not add a second delay after a block that waited by itself', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ speed: 1, ...clock })
    gate.wait('a')
    clock.advance(2000) // e.g. a "wait 2 seconds" block ran
    const next = track(gate.wait('a'))
    await flush()
    expect(next.done).toBe(true)
  })

  it('holds blocks while paused and continues on play', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ speed: 1, ...clock })
    gate.wait('a')
    gate.pause()
    const next = track(gate.wait('a'))
    clock.advance(5000)
    await flush()
    expect(next.done).toBe(false)
    expect(gate.mode).toBe('paused')
    gate.play()
    await flush()
    expect(next.done).toBe(true)
  })

  it('picks up a new speed straight away', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ speed: 0.25, ...clock })
    gate.wait('a')
    const next = track(gate.wait('a'))
    gate.setSpeed(4)
    clock.advance(250)
    await flush()
    expect(next.done).toBe(true)
  })
})

describe('createSlowMoGate — Step (paused)', () => {
  it('lets exactly one block through per Step', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ paused: true, ...clock })
    const first = track(gate.wait('a'))
    await flush()
    expect(first.done).toBe(false)
    expect(gate.step()).toBe(true)
    await flush()
    expect(first.done).toBe(true)
    const second = track(gate.wait('a'))
    clock.advance(10_000)
    await flush()
    expect(second.done).toBe(false)
    gate.step()
    await flush()
    expect(second.done).toBe(true)
  })

  it('takes turns round-robin across the waiting scripts', () => {
    const clock = fakeTimers()
    const released = []
    const gate = createSlowMoGate({
      paused: true,
      onRelease: ({ key }) => released.push(key),
      ...clock,
    })
    gate.wait('a')
    gate.wait('b')
    gate.wait('c')
    gate.step() // a
    gate.wait('a')
    gate.step() // b (a just went)
    gate.step() // c
    gate.wait('b')
    gate.step() // a
    gate.step() // b
    expect(released).toEqual(['a', 'b', 'c', 'a', 'b'])
  })

  it('keeps one Step for the next script to ask when every script is busy', async () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ paused: true, ...clock })
    expect(gate.step()).toBe(false)
    expect(gate.step()).toBe(false) // still only one kept
    const first = track(gate.wait('a'))
    const second = track(gate.wait('a'))
    await flush()
    expect(first.done).toBe(true)
    expect(second.done).toBe(false)
  })

  it('pauses a playing gate when Step is pressed', () => {
    const clock = fakeTimers()
    const gate = createSlowMoGate({ speed: 1, ...clock })
    gate.wait('a')
    gate.step()
    expect(gate.mode).toBe('paused')
  })

  it('skips scripts that have stopped (a deleted clone) without counting a step', async () => {
    const clock = fakeTimers()
    const released = []
    const gate = createSlowMoGate({
      paused: true,
      onRelease: ({ key }) => released.push(key),
      ...clock,
    })
    const dead = track(gate.wait('clone', null, () => false))
    gate.wait('b')
    gate.step()
    await flush()
    expect(dead.done).toBe(true)
    expect(released).toEqual(['b'])
    expect(gate.stepCount).toBe(1)
  })
})

describe('createSlowMoGate — dispose', () => {
  it('lets every waiting block go (its run was stopped) and ignores later waits', async () => {
    const clock = fakeTimers()
    const onRelease = vi.fn()
    const gate = createSlowMoGate({ paused: true, onRelease, ...clock })
    const a = track(gate.wait('a'))
    const b = track(gate.wait('b'))
    gate.dispose()
    await flush()
    expect([a.done, b.done]).toEqual([true, true])
    expect(onRelease).not.toHaveBeenCalled()
    expect(gate.mode).toBe('stopped')
    const late = track(gate.wait('a'))
    await flush()
    expect(late.done).toBe(true)
  })
})
