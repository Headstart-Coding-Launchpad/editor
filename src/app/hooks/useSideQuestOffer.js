import { useCallback, useEffect, useRef, useState } from 'react'
import { usePassMoment } from '../../shared/motion'
import { loadSideQuestOffered, saveSideQuestOffered } from '../studentStorage'
import { COMPLETE_CHIME_ARRIVAL_GRACE_MS } from './useCompleteChime'

/**
 * Waits for the bonus quest card (SideQuestOfferCard). Read at use time, so tests can shorten
 * them. `arrivalGraceMs`: a pass this soon after arriving on a task is a restore, not a moment
 * (as for the complete chime). `afterPassMs`: the pass banner has its moment first. `idleMs`:
 * the student has stopped typing and clicking.
 */
export const SIDE_QUEST_OFFER_TIMING = {
  arrivalGraceMs: COMPLETE_CHIME_ARRIVAL_GRACE_MS,
  afterPassMs: 3000,
  idleMs: 2000,
}

const INPUT_EVENTS = ['keydown', 'pointerdown', 'input']

/**
 * The one-time "Want a bonus quest?" card, local to the student: it writes nothing to Firebase
 * (opening a quest from it goes through useSideQuests' own `openQuest`, which logs `openedAt` in
 * a live lesson exactly like the strip button). The tutor sees no new state; they keep seeing
 * the quest once it is opened, as before.
 *
 * Offered once per task per student, after a pass the student watched (not a restored one), once
 * `afterPassMs` has gone by, no Run is in progress and they have been idle for `idleMs`. It never
 * shows while `blocked` (a badge celebration) or while not `eligible` (the side-quest strip's own
 * gate: quests available on this screen, nothing else on show). Remembered in memory and, for a
 * real student (`persist`), in localStorage (`sideQuestOfferStorageKey`), best-effort.
 *
 * Returns `{ visible, dismiss, tryQuest }`.
 */
export function useSideQuestOffer({
  lessonId,
  taskId,
  anonymousId,
  quests,
  passed,
  eligible,
  running = false,
  blocked = false,
  questOpen = false,
  persist = false,
  openQuest,
}) {
  const taskKey = taskId == null ? null : String(taskId)
  const passMoment = usePassMoment(!!passed, taskKey)
  const arrivedAtRef = useRef(Date.now())
  const offeredRef = useRef(new Set())
  const lastInputRef = useRef(0)
  // `{ taskKey, passedAt }` between the pass and the card showing.
  const [pending, setPending] = useState(null)
  // The task whose card is on screen.
  const [shownFor, setShownFor] = useState(null)
  const [tick, setTick] = useState(0)
  const hasQuests = (quests?.length ?? 0) > 0
  const eligibleRef = useRef(eligible)
  eligibleRef.current = eligible

  // Declared before the pass effect so a new task restarts the grace first.
  useEffect(() => {
    arrivedAtRef.current = Date.now()
    setPending(null)
  }, [taskKey])

  useEffect(() => {
    // A pass somewhere the quests aren't offered (the personal sandbox, a tutor broadcast) is
    // not this moment.
    if (passMoment === 0 || taskKey == null || !hasQuests || !eligibleRef.current) return
    if (offeredRef.current.has(taskKey)) return
    const now = Date.now()
    if (now - arrivedAtRef.current < SIDE_QUEST_OFFER_TIMING.arrivalGraceMs) return
    if (persist && loadSideQuestOffered(lessonId, taskKey, anonymousId)) {
      offeredRef.current.add(taskKey)
      return
    }
    lastInputRef.current = now
    setPending({ taskKey, passedAt: now })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passMoment])

  const waiting = pending != null && pending.taskKey === taskKey

  // Typing or clicking restarts the idle wait.
  useEffect(() => {
    if (!waiting) return undefined
    const onInput = () => {
      lastInputRef.current = Date.now()
    }
    INPUT_EVENTS.forEach((type) => document.addEventListener(type, onInput, true))
    return () => INPUT_EVENTS.forEach((type) => document.removeEventListener(type, onInput, true))
  }, [waiting])

  useEffect(() => {
    if (!waiting || !eligible || running || blocked) return undefined
    const readyAt = Math.max(
      pending.passedAt + SIDE_QUEST_OFFER_TIMING.afterPassMs,
      lastInputRef.current + SIDE_QUEST_OFFER_TIMING.idleMs
    )
    const wait = readyAt - Date.now()
    if (wait > 0) {
      const timer = setTimeout(() => setTick((n) => n + 1), wait)
      return () => clearTimeout(timer)
    }
    offeredRef.current.add(taskKey)
    if (persist) saveSideQuestOffered(lessonId, taskKey, anonymousId)
    setPending(null)
    setShownFor(taskKey)
    return undefined
  }, [waiting, eligible, running, blocked, tick, pending, taskKey, persist, lessonId, anonymousId])

  // Opening a quest any way (the strip too) ends the offer.
  useEffect(() => {
    if (questOpen) setShownFor(null)
  }, [questOpen])

  const dismiss = useCallback(() => setShownFor(null), [])
  const tryQuest = useCallback(
    (index) => {
      setShownFor(null)
      openQuest?.(index)
    },
    [openQuest]
  )

  return {
    visible: shownFor != null && shownFor === taskKey && eligible && !blocked && hasQuests,
    dismiss,
    tryQuest,
  }
}
