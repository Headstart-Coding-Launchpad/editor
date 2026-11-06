import { useCallback, useEffect, useRef, useState } from 'react'
import { usePassMoment } from '../../shared/motion'
import { loadSideQuestOffered, saveSideQuestOffered } from '../studentStorage'
import { COMPLETE_CHIME_ARRIVAL_GRACE_MS } from './useCompleteChime'

/**
 * Waits for the bonus quest card (SideQuestOfferCard). Read at use time, so tests can shorten
 * them. `arrivalGraceMs`: a pass this soon after arriving on a task is a restore, not a moment
 * (as for the complete chime). `passBannerCapMs`: the card waits for the pass banner to go on its
 * own (closed, or its own timeout), but no longer than this after the pass; then the banner
 * closes for it. `idleMs`: the student has stopped typing and clicking. `recheckMs`: how often a
 * card held back by a hidden tab or a focused output iframe looks again (focus inside an iframe
 * sends the page no input events).
 */
export const SIDE_QUEST_OFFER_TIMING = {
  arrivalGraceMs: COMPLETE_CHIME_ARRIVAL_GRACE_MS,
  passBannerCapMs: 10000,
  idleMs: 2000,
  recheckMs: 500,
}

const INPUT_EVENTS = ['keydown', 'pointerdown', 'input']

// Not now: the tab is in the background, or the student is in the output (an iframe).
function pageBusy() {
  if (typeof document === 'undefined') return false
  return document.hidden === true || document.activeElement?.tagName === 'IFRAME'
}

/**
 * The one-time "Want a bonus quest?" card, local to the student: it writes nothing to Firebase
 * (opening a quest from it goes through useSideQuests' own `openQuest`, which logs `openedAt` in
 * a live lesson exactly like the strip button). The tutor sees no new state; they keep seeing
 * the quest once it is opened, as before.
 *
 * Offered once per task per student, after a pass the student watched: from a Run they pressed in
 * this view (`running` went true on this task), not within the arrival grace. Then it waits for
 * the pass banner to go (`passBannerUp`, capped at `passBannerCapMs` after the pass), for no Run
 * in progress, for `idleMs` with no input, and for the tab to be visible with focus outside the
 * output iframe. It never shows while `blocked` (a badge celebration) or while not `eligible` (the
 * side-quest strip's own gate: quests available on this screen, nothing else on show). It counts
 * as offered only when it really shows, or when a quest is opened from the strip first; then it is
 * remembered in memory and, for a real student (`persist`), in localStorage
 * (`sideQuestOfferStorageKey`), best-effort. Leaving the task closes it for good.
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
  passBannerUp = false,
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
  // The task the student last pressed Run on in this view: a pass without one is a restore.
  const ranOnRef = useRef(null)
  // `{ taskKey, passedAt }` between the pass and the card showing.
  const [pending, setPending] = useState(null)
  // The task whose card is on screen.
  const [shownFor, setShownFor] = useState(null)
  const [tick, setTick] = useState(0)
  const hasQuests = (quests?.length ?? 0) > 0
  const eligibleRef = useRef(eligible)
  eligibleRef.current = eligible

  // Declared before the pass effect so a new task restarts the grace first. Leaving a task ends
  // its card for good (it is already in offeredRef if it showed).
  useEffect(() => {
    arrivedAtRef.current = Date.now()
    ranOnRef.current = null
    setPending(null)
    setShownFor(null)
  }, [taskKey])

  useEffect(() => {
    if (running && taskKey != null) ranOnRef.current = taskKey
  }, [running, taskKey])

  useEffect(() => {
    // A pass somewhere the quests aren't offered (the personal sandbox, a tutor broadcast), or
    // one with no Run pressed here (a restore), is not this moment.
    if (passMoment === 0 || taskKey == null || !hasQuests || !eligibleRef.current) return
    if (ranOnRef.current !== taskKey) return
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

  // Typing or clicking restarts the idle wait; the tab coming back looks again.
  useEffect(() => {
    if (!waiting) return undefined
    const onInput = () => {
      lastInputRef.current = Date.now()
    }
    const onVisibility = () => setTick((n) => n + 1)
    INPUT_EVENTS.forEach((type) => document.addEventListener(type, onInput, true))
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      INPUT_EVENTS.forEach((type) => document.removeEventListener(type, onInput, true))
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [waiting])

  useEffect(() => {
    if (!waiting || !eligible || running || blocked) return undefined
    const readyAt = Math.max(
      passBannerUp ? pending.passedAt + SIDE_QUEST_OFFER_TIMING.passBannerCapMs : 0,
      lastInputRef.current + SIDE_QUEST_OFFER_TIMING.idleMs
    )
    const wait = readyAt - Date.now()
    if (wait > 0 || pageBusy()) {
      const timer = setTimeout(
        () => setTick((n) => n + 1),
        wait > 0 ? wait : SIDE_QUEST_OFFER_TIMING.recheckMs
      )
      return () => clearTimeout(timer)
    }
    // Shown now, with the tab visible: only now does it count as offered.
    offeredRef.current.add(taskKey)
    if (persist) saveSideQuestOffered(lessonId, taskKey, anonymousId)
    setPending(null)
    setShownFor(taskKey)
    return undefined
  }, [
    waiting,
    eligible,
    running,
    passBannerUp,
    blocked,
    tick,
    pending,
    taskKey,
    persist,
    lessonId,
    anonymousId,
  ])

  // Opening a quest any way (the strip too) ends the offer, a pending one included: the student
  // has found the quests, so the card is not needed on this task.
  useEffect(() => {
    if (!questOpen) return
    if (taskKey != null) offeredRef.current.add(taskKey)
    setPending(null)
    setShownFor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
