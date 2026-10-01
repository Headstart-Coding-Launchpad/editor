import { useEffect, useRef, useState } from 'react'
import { playBadgeChime } from '../nudgeAlert'
import { useSoundsMuted } from '../soundSettings'

// How long the 👍 toast stays up, and how old a push may be and still show. A push older than
// that (the student reconnected after a while, or the field arrived late) is stale praise.
export const THUMBS_UP_VISIBLE_MS = 2500
export const THUMBS_UP_MAX_AGE_MS = 30_000

/**
 * Reacts to a teacher's 👍 "you're on the right track" (students.{id}.thumbsUpPushedAt): a
 * short toast plus the gentle badge chime. It is transient: not a badge, not shown to the class
 * and not in session reports.
 *
 * As in useNudgeAlert, the timestamp already present when the session first loads is a baseline,
 * so a reload never replays an old 👍. Pushes arriving while disabled are marked seen too.
 *
 * - `ready`: the session has loaded (sets the baseline).
 * - `enabled`: the student's own live lesson (not the presentation window or a preview).
 * - `pushedAt`: this student's `thumbsUpPushedAt`.
 * - `soundsOff`: the tutor's class-wide Sounds off. The student's own mute is respected too.
 *
 * Returns `{ thumbsUpAt }`: the timestamp of the 👍 on screen, or null once it has auto-dismissed.
 */
export default function useThumbsUp({ ready, enabled, pushedAt, soundsOff = false }) {
  const [muted] = useSoundsMuted()
  const baselineRef = useRef(null)
  const [thumbsUpAt, setThumbsUpAt] = useState(null)

  if (ready && baselineRef.current == null) baselineRef.current = pushedAt ?? 0

  useEffect(() => {
    const baseline = baselineRef.current
    if (baseline == null || (pushedAt ?? 0) <= baseline) return
    baselineRef.current = pushedAt
    if (!enabled) return
    if (Date.now() - pushedAt > THUMBS_UP_MAX_AGE_MS) return
    setThumbsUpAt(pushedAt)
    if (!muted && !soundsOff) playBadgeChime()
    // Sound settings are read at the moment of the push; changing them doesn't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushedAt, enabled])

  // Each new 👍 restarts the timer.
  useEffect(() => {
    if (thumbsUpAt == null) return
    const timer = setTimeout(() => setThumbsUpAt(null), THUMBS_UP_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [thumbsUpAt])

  return { thumbsUpAt: enabled ? thumbsUpAt : null }
}
