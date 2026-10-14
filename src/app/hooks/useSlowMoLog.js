import { useEffect, useRef } from 'react'
import { SLOW_MO_USE_KINDS } from '../../shared/slowMoUse'

// Firebase is loaded on first use, so screens (and tests) that never use slow-mo don't pull the
// SDK in through this hook.
async function rtdb() {
  const [{ db }, database] = await Promise.all([
    import('../../shared/firebase'),
    import('firebase/database'),
  ])
  return { db, ...database }
}

const FLUSH_MS = 3000

/**
 * Slow-mo use for the session report (src/shared/slowMoUse.js), called from useStudentCodeState:
 * `recordSlowMoUse({ kind: 'run' | 'step' })` adds to the student's own
 * `students/{id}/slowMoLog/{taskId}` `{ runs, steps, lastAt }`, batched (one write per few
 * seconds at most). Live lessons only: never the presentation window, Builder preview, solo or a
 * personal sandbox.
 */
export function useSlowMoLog({
  lessonId,
  phase,
  teacherPresentation,
  previewMode,
  effectiveIdentity,
  currentTaskId,
  inPersonalSandboxRef,
}) {
  const pendingRef = useRef(null)
  const timerRef = useRef(null)

  function flush() {
    clearTimeout(timerRef.current)
    timerRef.current = null
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending || !lessonId) return
    rtdb()
      .then(({ db, ref, update, increment }) =>
        update(
          ref(
            db,
            `sessions/${lessonId}/students/${pending.anonymousId}/slowMoLog/${pending.taskId}`
          ),
          {
            ...(pending.runs ? { runs: increment(pending.runs) } : {}),
            ...(pending.steps ? { steps: increment(pending.steps) } : {}),
            lastAt: Date.now(),
          }
        )
      )
      .catch(() => {})
  }

  // A task change (or leaving) sends what's waiting at once.
  useEffect(() => () => flush(), [currentTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

  function recordSlowMoUse({ kind } = {}) {
    if (!SLOW_MO_USE_KINDS.includes(kind)) return
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef?.current)
      return
    const anonymousId = effectiveIdentity?.anonymousId
    if (!anonymousId || currentTaskId == null) return
    const pending = pendingRef.current
    if (pending && (pending.taskId !== currentTaskId || pending.anonymousId !== anonymousId))
      flush()
    const next = pendingRef.current ?? { anonymousId, taskId: currentTaskId, runs: 0, steps: 0 }
    if (kind === 'run') next.runs += 1
    else next.steps += 1
    pendingRef.current = next
    if (!timerRef.current) timerRef.current = setTimeout(flush, FLUSH_MS)
  }

  return { recordSlowMoUse }
}
