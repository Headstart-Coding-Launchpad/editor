import { useEffect, useRef, useState } from 'react'
import { getClassCountdownRemainingMs, isClassCountdown } from '../../shared/classCountdown'
import { playTimesUpChime } from '../nudgeAlert'
import { useSoundsMuted } from '../soundSettings'

// How long the "Time's up" banner stays up. The pill keeps saying Time's up until the teacher
// adds time or clears the countdown.
export const TIMES_UP_VISIBLE_MS = 5000

// The pill redraws a few times a second so the seconds tick over close to the real boundary.
export const COUNTDOWN_TICK_MS = 250

/**
 * Milliseconds left on the class countdown, re-rendering its caller every COUNTDOWN_TICK_MS
 * while it runs. Use it in the small component that draws the time, not in a whole view.
 * Returns null when there is no countdown. `serverTimeOffset` is useSession's
 * `.info/serverTimeOffset`, so every screen counts to the same server-time deadline.
 */
export function useCountdownRemaining(countdown, serverTimeOffset = 0) {
  const valid = isClassCountdown(countdown)
  const endsAt = valid ? countdown.endsAt : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    if (endsAt == null) return undefined
    const intervalId = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      // Stop ticking once it has reached zero; a new deadline restarts the effect.
      if (endsAt - (current + serverTimeOffset) <= 0) window.clearInterval(intervalId)
    }, COUNTDOWN_TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [endsAt, serverTimeOffset])

  if (!valid) return null
  return getClassCountdownRemainingMs(countdown, now + serverTimeOffset)
}

/**
 * The "Time's up" moment of the teacher's class countdown (sessions/{lessonId}/classCountdown).
 * Does not tick: it schedules one timer for the deadline, so a whole view can call it without
 * re-rendering every second.
 *
 * The moment only fires for a deadline this screen watched counting down: arriving or reloading
 * after it already hit zero shows the pill's Time's up but no banner or sound. Adding time
 * (a new endsAt) arms it again. Nothing is locked or paused.
 *
 * - `enabled`: show the banner on this screen (a live student lesson or the presentation window).
 * - `playSound`: also play the time's-up chime (the student's own screen only; never the
 *   presentation window or teacher view). The student's Sounds mute and the tutor's class-wide
 *   Sounds off (`soundsOff`) both silence it.
 *
 * Returns `{ timesUpAt }`: the deadline whose banner is on screen, or null.
 */
export default function useClassCountdown({
  countdown,
  serverTimeOffset = 0,
  enabled = true,
  playSound = false,
  soundsOff = false,
}) {
  const [muted] = useSoundsMuted()
  const [timesUpAt, setTimesUpAt] = useState(null)
  const valid = enabled && isClassCountdown(countdown)
  const endsAt = valid ? countdown.endsAt : null
  // Read at the moment of the deadline, so changing them doesn't re-arm the timer.
  const soundRef = useRef({ playSound, muted, soundsOff })
  soundRef.current = { playSound, muted, soundsOff }

  useEffect(() => {
    if (endsAt == null) {
      setTimesUpAt(null)
      return undefined
    }
    const remaining = endsAt - (Date.now() + serverTimeOffset)
    // Already over when this screen first saw it: no moment.
    if (remaining <= 0) return undefined
    const timer = window.setTimeout(() => {
      setTimesUpAt(endsAt)
      const sound = soundRef.current
      if (sound.playSound && !sound.muted && !sound.soundsOff) playTimesUpChime()
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [endsAt, serverTimeOffset])

  // The banner auto-dismisses.
  useEffect(() => {
    if (timesUpAt == null) return undefined
    const timer = window.setTimeout(() => setTimesUpAt(null), TIMES_UP_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [timesUpAt])

  // A banner for an old deadline (time was added or the countdown was cleared) is stale.
  return { timesUpAt: timesUpAt != null && timesUpAt === endsAt ? timesUpAt : null }
}
