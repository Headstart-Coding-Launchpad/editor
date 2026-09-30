import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playBadgeChime } from '../nudgeAlert'
import { useSoundsMuted } from '../soundSettings'
import {
  collectAwardKeys,
  findNewAwards,
  isStillAwarded,
  listMyMoments,
  mergeClassToasts,
} from '../../badges/celebration'

/**
 * The student side of live badges (docs/architecture/live-badges-plan.md, "Student experience"):
 * the recipient's celebration cards, the class toasts and the Coding moments list.
 *
 * Awards already stored when the session first loads are a baseline, as in useNudgeAlert, so a
 * reload or a late join never replays them (they still show in the pill). New awards are only
 * queued while `enabled` (a live lesson or sandbox), but are always marked seen, so leaving and
 * coming back doesn't replay them either.
 *
 * - `viewerId`: this student's id, or null for the presentation window, which only gets toasts.
 * - `soundsOff`: the tutor's class-wide `badgeSettings.soundsOff`. The student's own mute is the
 *   app-wide Sounds setting (`useSoundsMuted`, localStorage `headstart_sounds_muted`), shared
 *   with the top-bar 🔊 button and the complete chime.
 *
 * Returns `{ moments, card, cardDone, toast, toastDone, muted, setMuted }`; the components own
 * the timing and call `cardDone` / `toastDone` when theirs finishes.
 */
export default function useBadgeCelebrations({
  ready,
  enabled,
  decisions,
  viewerId = null,
  students,
  soundsOff = false,
  catalogueBadges,
}) {
  const seenRef = useRef(null)
  const finishedBulkIdsRef = useRef(new Set())
  const [cardQueue, setCardQueue] = useState([])
  const [toastQueue, setToastQueue] = useState([])
  const [muted, setMuted] = useSoundsMuted()

  if (ready && seenRef.current == null) seenRef.current = collectAwardKeys(decisions)

  // snap.val() rebuilds the tree on every session write, so key on the awards themselves.
  const awardsSignature = useMemo(
    () => [...collectAwardKeys(decisions)].sort().join('|'),
    [decisions]
  )

  useEffect(() => {
    const seen = seenRef.current
    if (!seen) return
    const fresh = findNewAwards(decisions, seen)
    // A revoked card that hasn't shown yet is dropped without a word.
    setCardQueue((queue) => {
      const kept = queue.filter((award) => isStillAwarded(decisions, award))
      return kept.length === queue.length ? queue : kept
    })
    if (fresh.length === 0) return
    for (const award of fresh) seen.add(award.key)
    if (!enabled) return

    if (viewerId) {
      const mine = fresh.filter((award) => award.studentId === viewerId)
      if (mine.length > 0) setCardQueue((queue) => [...queue, ...mine])
    }
    setToastQueue((queue) =>
      mergeClassToasts(queue, fresh, {
        viewerId,
        students,
        finishedBulkIds: finishedBulkIdsRef.current,
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awardsSignature, enabled, viewerId])

  const card = viewerId ? (cardQueue[0] ?? null) : null
  const soundsOffRef = useRef(soundsOff)
  soundsOffRef.current = soundsOff || muted

  // One gentle chime as each card starts; skipped when the tutor turned sounds off or the student
  // muted.
  useEffect(() => {
    if (card && !soundsOffRef.current) playBadgeChime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.key])

  const cardDone = useCallback(() => setCardQueue((queue) => queue.slice(1)), [])
  const toastDone = useCallback(() => {
    setToastQueue((queue) => {
      if (queue[0]?.bulkId) finishedBulkIdsRef.current.add(queue[0].bulkId)
      return queue.slice(1)
    })
  }, [])

  const moments = useMemo(
    () => listMyMoments(decisions, viewerId, catalogueBadges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awardsSignature, viewerId, catalogueBadges]
  )

  return {
    moments,
    card: enabled ? card : null,
    cardDone,
    toast: enabled ? (toastQueue[0] ?? null) : null,
    toastDone,
    muted,
    setMuted,
  }
}
