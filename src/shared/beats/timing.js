// Beat Maker's timing maths (docs/authoring/beats.md). Pure: times are seconds from the start of
// the song, so the live player (./player.js) and the WAV render (./render.js) share them.
//
// A step is a sixteenth note: at tempo 100 (beats a minute) a beat is 0.6 s and a step 0.15 s,
// so a 16-step pattern is one bar. A song is a run's parts (play() calls) one after another;
// it loops (loopCountFor) and then stops.

import { stepHit } from './patterns.js'

export const STEPS_PER_BEAT = 4
/** A song plays this many times through... */
export const DEFAULT_LOOPS = 4
/** ...or more, until it has played at least this long... */
export const MIN_PLAY_SECONDS = 8
/** ...but never longer than this (a long song plays fewer times, at least once). */
export const MAX_PLAY_SECONDS = 60

/** Seconds per step at a tempo (beats a minute). */
export function stepSeconds(tempo) {
  return 60 / Number(tempo) / STEPS_PER_BEAT
}

/**
 * A song → `{ events, period }`: one event per step of every part, in order, with `at` (seconds
 * from the song's start), `part`, `step` and `hits` ([{ name, accent }]), and the seconds one
 * time through takes. A row shorter than its part repeats until the part ends.
 */
export function buildTimeline(song) {
  const events = []
  let partStart = 0
  ;(song?.parts ?? []).forEach((part, partIndex) => {
    const step = stepSeconds(part.tempo)
    for (let i = 0; i < part.length; i++) {
      const hits = []
      for (const row of part.rows) {
        const { hit, accent } = stepHit(row.steps, i)
        if (hit) hits.push({ name: row.name, accent })
      }
      // Multiplied, not added up step by step, so long songs don't drift.
      events.push({ at: partStart + i * step, part: partIndex, step: i, hits })
    }
    partStart += part.length * step
  })
  return { events, period: partStart }
}

/** How many times a song plays through, from one time through's length in seconds. */
export function loopCountFor(period) {
  if (!(period > 0)) return 0
  let loops = Math.max(DEFAULT_LOOPS, Math.ceil(MIN_PLAY_SECONDS / period))
  while (loops > 1 && loops * period > MAX_PLAY_SECONDS) loops -= 1
  return loops
}

/** The k-th step of the whole performance (k counts across loops): `{ time, event }`. */
export function eventAt(timeline, k) {
  const n = timeline.events.length
  const loop = Math.floor(k / n)
  const event = timeline.events[k % n]
  return { time: loop * timeline.period + event.at, event, loop }
}

/**
 * Where the playhead is `elapsed` seconds in: `{ loop, part, step }`, or null before the start
 * and once `loops` times through have finished.
 */
export function positionAt(timeline, elapsed, loops) {
  const { events, period } = timeline
  if (!events.length || !(period > 0) || elapsed < 0 || elapsed >= period * loops) return null
  const loop = Math.floor(elapsed / period)
  const within = elapsed - loop * period
  // The last event that has started (binary search; events are in time order).
  let lo = 0
  let hi = events.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (events[mid].at <= within) lo = mid
    else hi = mid - 1
  }
  return { loop, part: events[lo].part, step: events[lo].step }
}

/** The total seconds a song plays for, with its loops (0 for an empty song). */
export function songSeconds(song, loops = null) {
  const { period } = buildTimeline(song)
  return period * (loops ?? loopCountFor(period))
}
