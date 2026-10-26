// Beat Maker's live player (docs/authoring/beats.md). One beat plays at a time on the page:
// starting one stops any other. Hits are scheduled a little ahead on the AudioContext's clock
// (a lookahead scheduler: a 25 ms timer queues every hit due in the next LOOKAHEAD seconds),
// so timing stays tight even when the page is busy. The playhead reads the same clock.
//
// Sound needs a user gesture first. Run and Play are clicks, and once the sequencer has shown,
// every later click or key press on the page wakes the audio (installBeatAudioUnlock). If the
// browser still won't start sound, the beat plays silently on the page clock: the grid and
// playhead work exactly the same.

import { createDrumOutput, scheduleDrum } from './drums.js'
import { buildTimeline, eventAt, loopCountFor, positionAt } from './timing.js'

export const LOOKAHEAD_SECONDS = 0.12
export const TICK_MS = 25
// The first hit waits this long, so it isn't cut off while the clock settles.
const START_DELAY = 0.08
// A hit more than this late (a sleeping tab) is skipped rather than played out of time.
const LATE_SECONDS = 0.05
// How long to wait for a suspended AudioContext to resume before playing silently.
const RESUME_WAIT_MS = 250

let audioContext = null
let unlockInstalled = false
let current = null

function AudioContextClass() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

/** The page's AudioContext for beats, made on first use (null where Web Audio is missing). */
export function getBeatAudioContext() {
  if (audioContext) return audioContext
  const Ctor = AudioContextClass()
  if (!Ctor) return null
  try {
    audioContext = new Ctor()
  } catch {
    audioContext = null
  }
  return audioContext
}

/** Wakes the beats AudioContext. Call from inside a click or key press. */
export function unlockBeatAudio() {
  const ctx = getBeatAudioContext()
  if (ctx?.state === 'suspended') ctx.resume?.().catch?.(() => {})
}

/**
 * From now on, every click, tap or key press on the page wakes the beats audio, so a beat that
 * starts when a Run finishes can be heard. Installed once, when a sequencer first shows.
 */
export function installBeatAudioUnlock() {
  if (unlockInstalled || typeof document === 'undefined') return
  unlockInstalled = true
  const wake = () => unlockBeatAudio()
  document.addEventListener('pointerdown', wake, true)
  document.addEventListener('keydown', wake, true)
}

/**
 * The scheduling loop, without timers or audio, so it can be tested: `tick()` queues every hit
 * due before now + lookahead through `schedule(event, when)`, reports the playhead through
 * `onStep({ loop, part, step })` when it moves, and calls `onEnd()` once the last loop is over.
 */
export function createBeatScheduler({
  timeline,
  loops,
  now,
  start,
  schedule,
  onStep = () => {},
  onEnd = () => {},
  lookahead = LOOKAHEAD_SECONDS,
}) {
  const total = timeline.events.length * loops
  let next = 0
  let lastKey = null
  let done = false
  return {
    get done() {
      return done
    },
    tick() {
      if (done) return
      const t = now()
      while (next < total) {
        const { time, event } = eventAt(timeline, next)
        const when = start + time
        if (when >= t + lookahead) break
        if (when >= t - LATE_SECONDS && event.hits.length > 0) schedule(event, when)
        next += 1
      }
      const elapsed = t - start
      const position = positionAt(timeline, elapsed, loops)
      if (position) {
        const key = `${position.loop}:${position.part}:${position.step}`
        if (key !== lastKey) {
          lastKey = key
          onStep(position)
        }
      } else if (elapsed >= timeline.period * loops) {
        done = true
        onEnd()
      }
    },
  }
}

/** Stops the beat that is playing, if any. */
export function stopBeat() {
  current?.stop()
}

/** Changes the playing beat's volume at once (0 mutes it). */
export function setBeatGain(gain) {
  current?.setGain(gain)
}

function waitForRunning(ctx) {
  if (!ctx) return Promise.resolve(false)
  if (ctx.state === 'running') return Promise.resolve(true)
  const resumed = Promise.resolve(ctx.resume?.())
    .then(() => ctx.state === 'running')
    .catch(() => false)
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), RESUME_WAIT_MS))
  return Promise.race([resumed, timeout])
}

const pageClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000

/**
 * Plays a song (readBeatSong's shape) `loops` times (default loopCountFor). Returns a handle
 * `{ stop() }`; `onStep(position)` follows the playhead (null when it stops), `onSound(bool)`
 * says whether it is audible or silent (no Web Audio, or the browser kept it asleep), and
 * `onEnd()` fires once when it finishes or is stopped.
 */
export function playBeat(song, { gain = 0.5, loops, onStep, onEnd, onSound } = {}) {
  stopBeat()
  const timeline = buildTimeline(song)
  const count = loops ?? loopCountFor(timeline.period)
  if (!timeline.events.length || !count) {
    onEnd?.()
    return null
  }
  const ctx = getBeatAudioContext()
  if (ctx?.state === 'suspended') ctx.resume?.().catch?.(() => {})
  let timer = null
  let output = null
  let stopped = false
  const handle = {
    stop() {
      if (stopped) return
      stopped = true
      if (timer) clearInterval(timer)
      if (output && ctx) {
        // Fade the hits already queued out fast, then cut them off.
        try {
          output.gain.gain.cancelScheduledValues(ctx.currentTime)
          output.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
          const chain = output
          setTimeout(() => chain.gain.disconnect(), 80)
        } catch {
          // Already gone.
        }
      }
      if (current === handle) current = null
      onStep?.(null)
      onEnd?.()
    },
    setGain(next) {
      if (!output || !ctx) return
      try {
        output.gain.gain.setTargetAtTime(next, ctx.currentTime, 0.02)
      } catch {
        // Already gone.
      }
    },
  }
  current = handle
  waitForRunning(ctx).then((audible) => {
    if (stopped) return
    onSound?.(audible)
    const now = audible ? () => ctx.currentTime : pageClock
    if (audible) output = createDrumOutput(ctx, gain)
    const scheduler = createBeatScheduler({
      timeline,
      loops: count,
      now,
      start: now() + START_DELAY,
      schedule: (event, when) => {
        if (!output) return
        for (const hit of event.hits) scheduleDrum(ctx, output.input, hit.name, when, hit)
      },
      onStep: (position) => onStep?.(position),
      onEnd: () => handle.stop(),
    })
    scheduler.tick()
    timer = setInterval(() => scheduler.tick(), TICK_MS)
  })
  return handle
}
