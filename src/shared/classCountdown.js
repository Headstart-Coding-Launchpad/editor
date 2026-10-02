// The teacher's class countdown: one shared deadline stored at
// sessions/{lessonId}/classCountdown as { startedAt, endsAt, durationMs }, all in server-time
// milliseconds (Date.now() + Firebase's .info/serverTimeOffset). It is separate from a task's
// estimatedMinutes timer, survives task changes and locks nothing when it reaches zero.

export const MINUTE_MS = 60_000

// Quick picks in the teacher's countdown popover, in minutes.
export const CLASS_COUNTDOWN_PRESET_MINUTES = Object.freeze([1, 2, 5, 10])

// Custom durations are clamped to this range (minutes). Two hours covers any lesson.
export const CLASS_COUNTDOWN_MIN_MINUTES = 0.25
export const CLASS_COUNTDOWN_MAX_MINUTES = 120

const MAX_DURATION_MS = CLASS_COUNTDOWN_MAX_MINUTES * MINUTE_MS

/** True for a stored countdown with usable numbers. */
export function isClassCountdown(countdown) {
  return (
    !!countdown &&
    Number.isFinite(countdown.startedAt) &&
    Number.isFinite(countdown.endsAt) &&
    Number.isFinite(countdown.durationMs) &&
    countdown.durationMs > 0 &&
    countdown.endsAt >= countdown.startedAt
  )
}

/** A new countdown of `durationMs` starting at `serverNow`, or null for an unusable duration. */
export function buildClassCountdown(durationMs, serverNow) {
  const ms = Math.round(Number(durationMs))
  if (!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(serverNow)) return null
  const clamped = Math.min(ms, MAX_DURATION_MS)
  return { startedAt: serverNow, endsAt: serverNow + clamped, durationMs: clamped }
}

/**
 * Adds `extraMs` to a running countdown. One that already reached zero restarts from
 * `serverNow`, so "+1 min" after Time's up gives the class one more minute. Returns null when
 * there is no countdown to extend.
 */
export function extendClassCountdown(countdown, extraMs, serverNow) {
  if (!isClassCountdown(countdown)) return null
  const extra = Math.round(Number(extraMs))
  if (!Number.isFinite(extra) || extra <= 0 || !Number.isFinite(serverNow)) return null
  const base = Math.max(countdown.endsAt, serverNow)
  const endsAt = Math.min(base + extra, serverNow + MAX_DURATION_MS)
  return {
    startedAt: countdown.startedAt,
    endsAt,
    durationMs: Math.max(1, endsAt - countdown.startedAt),
  }
}

/** Milliseconds left (never negative), or null when there is no countdown. */
export function getClassCountdownRemainingMs(countdown, serverNow) {
  if (!isClassCountdown(countdown)) return null
  return Math.max(0, countdown.endsAt - serverNow)
}

/** Parses the teacher's custom-minutes field; null when it isn't a usable number. */
export function parseCountdownMinutes(value) {
  const minutes = Number(String(value ?? '').trim())
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return Math.min(Math.max(minutes, CLASS_COUNTDOWN_MIN_MINUTES), CLASS_COUNTDOWN_MAX_MINUTES)
}
