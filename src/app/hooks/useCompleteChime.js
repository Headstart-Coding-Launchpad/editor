import { useCallback, useEffect, useRef } from 'react'
import { usePassMoment } from '../../shared/motion'
import { playCompleteChime } from '../nudgeAlert'
import { useSoundsMuted } from '../soundSettings'

// A pass this soon after arriving on a task is a restore (a reload, a teacher override replayed
// from the session, a check re-run on load), not one the student just earned.
export const COMPLETE_CHIME_ARRIVAL_GRACE_MS = 1500

/**
 * The student's success chime: one short rising chime the first time a task's checks pass while
 * they are watching. Arriving on an already-passed task, a restored pass and a later fail → pass
 * on a task that already chimed on this screen stay silent. The caller disables it for the teacher
 * presentation window, the Builder / Admin preview and anywhere that isn't the student's own
 * lesson (e.g. the personal sandbox).
 *
 * - `enabled`: the student is working on `taskKey` in a solo or live lesson.
 * - `passed`: the current task's completion state (`cs.checkPassed`).
 * - `taskKey`: identifies the task (lesson + task id).
 * - `soundsOff`: the tutor's class-wide Sounds off in a live session.
 *
 * Also respects the student's own mute (`useSoundsMuted`). Returns `{ skipTask }`, which marks the
 * current task as already celebrated (used before "Show complete" fills in the answer).
 */
export default function useCompleteChime({
  enabled,
  passed,
  taskKey,
  soundsOff = false,
  graceMs = COMPLETE_CHIME_ARRIVAL_GRACE_MS,
}) {
  const [muted] = useSoundsMuted()
  const passMoment = usePassMoment(!!passed, taskKey)
  const chimedRef = useRef(new Set())
  const arrivedAtRef = useRef(Date.now())
  const taskKeyRef = useRef(taskKey)
  taskKeyRef.current = taskKey
  const silencedRef = useRef(false)
  silencedRef.current = muted || soundsOff

  // Declared before the pass effect so a new task (or being enabled) restarts the grace first.
  useEffect(() => {
    arrivedAtRef.current = Date.now()
  }, [taskKey, enabled])

  useEffect(() => {
    if (passMoment === 0 || !enabled || taskKey == null) return
    const chimed = chimedRef.current
    if (chimed.has(taskKey)) return
    chimed.add(taskKey)
    if (Date.now() - arrivedAtRef.current < graceMs) return
    if (!silencedRef.current) playCompleteChime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passMoment])

  const skipTask = useCallback(() => {
    if (taskKeyRef.current != null) chimedRef.current.add(taskKeyRef.current)
  }, [])

  return { skipTask }
}
