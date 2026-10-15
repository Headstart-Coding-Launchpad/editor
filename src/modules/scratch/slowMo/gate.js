// The Scratch slow-mo gate. Pure (timers are injected), so the scheduling rules are unit-tested
// without Blockly or a browser.
//
// Every block of a slow-mo run asks the gate for its turn (`wait`) before it runs; the
// interpreter awaits that promise in runBlock (scratch.js, `signal.onBlockStart`). A "script" is
// one running hat stack, keyed by the caller (ScratchWorkspace uses `<sprite or clone id>|<top
// block id>`).
//
// Playing: each script runs at most `speed` blocks a second, on its own clock. A block that waits
// (wait, glide, play until done, ask) takes as long as it takes; the next block goes as soon as
// the script's interval since its last block has passed, so waits are never doubled. Scripts that
// run at the same time move together.
//
// Paused + Step: the gate is global. Each Step lets exactly one block through, taking turns
// (round-robin) across the scripts that are waiting, in the order the scripts first asked. When
// every script is busy inside a block (a wait or a glide), the Step is kept and the next script to
// ask goes straight through. One Step is kept at most, so tapping Step five times during a long
// wait doesn't race five blocks afterwards.

export const SLOW_MO_MIN_SPEED = 0.25
export const SLOW_MO_MAX_SPEED = 4
export const SLOW_MO_DEFAULT_SPEED = 1

export function clampSlowMoSpeed(speed) {
  const n = Number(speed)
  if (!Number.isFinite(n) || n <= 0) return SLOW_MO_DEFAULT_SPEED
  return Math.min(SLOW_MO_MAX_SPEED, Math.max(SLOW_MO_MIN_SPEED, n))
}

/**
 * @param {object} options
 * @param {number} [options.speed] blocks a second while playing (clamped to 0.25–4)
 * @param {boolean} [options.paused] start paused (Step) rather than playing
 * @param {(release: { key, payload, step }) => void} [options.onRelease] called as each block is
 *   let through, before it runs (`step` counts from 1)
 * @param {() => number} [options.now]
 * @param {{ setTimeout, clearTimeout }} [options.timers]
 */
export function createSlowMoGate({
  speed = SLOW_MO_DEFAULT_SPEED,
  paused = false,
  onRelease = null,
  now = () => Date.now(),
  timers = globalThis,
} = {}) {
  let mode = paused ? 'paused' : 'playing'
  let interval = 1000 / clampSlowMoSpeed(speed)
  let disposed = false
  let stepCredit = 0
  let stepCount = 0
  let lastStepKey = null
  const order = [] // script keys in first-asked order (round-robin)
  const queues = new Map() // key → [waiter]
  const lastReleaseAt = new Map() // key → time its last block went through
  let timer = null

  function clearTimer() {
    if (timer != null) timers.clearTimeout(timer)
    timer = null
  }

  function removeWaiter(waiter) {
    const queue = queues.get(waiter.key)
    if (!queue) return
    const index = queue.indexOf(waiter)
    if (index >= 0) queue.splice(index, 1)
    if (queue.length === 0) queues.delete(waiter.key)
  }

  function release(waiter, counted = true) {
    removeWaiter(waiter)
    if (counted) {
      stepCount += 1
      lastReleaseAt.set(waiter.key, now())
      onRelease?.({ key: waiter.key, payload: waiter.payload, step: stepCount })
    }
    waiter.resolve()
  }

  // A waiter whose script stopped (Stop, a deleted clone) goes through uncounted.
  function dropIfDead(waiter) {
    if (disposed || waiter.isAlive()) return false
    release(waiter, false)
    return true
  }

  function dueAt(key) {
    const last = lastReleaseAt.get(key)
    return last == null ? -Infinity : last + interval
  }

  // Playing: let every waiter through whose script's interval has passed, then sleep until the
  // next one is due.
  function pump() {
    clearTimer()
    if (disposed || mode !== 'playing') return
    const t = now()
    let next = Infinity
    for (const key of [...order]) {
      const waiter = queues.get(key)?.[0]
      if (!waiter || dropIfDead(waiter)) continue
      const due = dueAt(key)
      if (due <= t) release(waiter)
      else next = Math.min(next, due)
    }
    if (next !== Infinity) timer = timers.setTimeout(pump, Math.max(0, next - t))
  }

  // Paused: the next waiting script after the last one stepped, in first-asked order.
  function nextStepWaiter() {
    if (order.length === 0) return null
    const start = lastStepKey == null ? 0 : order.indexOf(lastStepKey) + 1
    for (let i = 0; i < order.length; i++) {
      const key = order[(start + i) % order.length]
      let waiter = queues.get(key)?.[0]
      while (waiter && dropIfDead(waiter)) waiter = queues.get(key)?.[0]
      if (waiter) return waiter
    }
    return null
  }

  function wait(key, payload = null, isAlive = () => true) {
    if (disposed) return Promise.resolve()
    return new Promise((resolve) => {
      const waiter = { key, payload, isAlive, resolve }
      if (!order.includes(key)) order.push(key)
      if (!queues.has(key)) queues.set(key, [])
      queues.get(key).push(waiter)
      if (mode === 'playing') {
        pump()
      } else if (stepCredit > 0) {
        stepCredit = 0
        lastStepKey = key
        release(waiter)
      }
    })
  }

  return {
    wait,
    get mode() {
      return disposed ? 'stopped' : mode
    },
    get stepCount() {
      return stepCount
    },
    get speed() {
      return 1000 / interval
    },
    /** How many blocks are waiting for their turn right now. */
    get waitingCount() {
      let n = 0
      for (const queue of queues.values()) n += queue.length
      return n
    },
    play() {
      if (disposed) return
      mode = 'playing'
      stepCredit = 0
      pump()
    },
    pause() {
      if (disposed) return
      mode = 'paused'
      clearTimer()
    },
    /** Pauses if playing, then lets exactly one block through (see the rule above). */
    step() {
      if (disposed) return false
      if (mode === 'playing') {
        mode = 'paused'
        clearTimer()
      }
      const waiter = nextStepWaiter()
      if (!waiter) {
        stepCredit = 1
        return false
      }
      lastStepKey = waiter.key
      release(waiter)
      return true
    },
    setSpeed(nextSpeed) {
      interval = 1000 / clampSlowMoSpeed(nextSpeed)
      if (mode === 'playing') pump()
    },
    /** Ends the gate: every waiting block goes through (its run has been stopped). */
    dispose() {
      if (disposed) return
      disposed = true
      clearTimer()
      for (const queue of [...queues.values()]) {
        for (const waiter of [...queue]) release(waiter, false)
      }
      queues.clear()
    },
  }
}
