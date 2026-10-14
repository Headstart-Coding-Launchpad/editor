import { useEffect, useRef } from 'react'
import { SCRUB_USE_KINDS } from '../../shared/scrub/scrubUse.js'

// Firebase is loaded on first use, so screens (and tests) that never scrub don't pull the SDK in
// through this hook.
async function rtdb() {
  const [{ db }, database] = await Promise.all([
    import('../../shared/firebase'),
    import('firebase/database'),
  ])
  return { db, ...database }
}

const FLUSH_MS = 3000

/**
 * Scrub use for the session report (src/shared/scrub/scrubUse.js), called from
 * useStudentCodeState: `recordScrub({ kind: 'number' | 'colour' })` (the code editor's
 * onScrubCommit, once per finished scrub) adds to the student's own
 * `students/{id}/scrubLog/{taskId}` `{ numbers, colours, lastAt }`, batched (one write per few
 * seconds at most). Live lessons only: never the presentation window, Builder preview, solo or a
 * personal sandbox.
 */
export function useScrubLog({
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
            `sessions/${lessonId}/students/${pending.anonymousId}/scrubLog/${pending.taskId}`
          ),
          {
            ...(pending.numbers ? { numbers: increment(pending.numbers) } : {}),
            ...(pending.colours ? { colours: increment(pending.colours) } : {}),
            lastAt: Date.now(),
          }
        )
      )
      .catch(() => {})
  }

  // A task change (or leaving) sends what's waiting at once.
  useEffect(() => () => flush(), [currentTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

  function recordScrub({ kind } = {}) {
    if (!SCRUB_USE_KINDS.includes(kind)) return
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef?.current)
      return
    const anonymousId = effectiveIdentity?.anonymousId
    if (!anonymousId || currentTaskId == null) return
    const pending = pendingRef.current
    if (pending && (pending.taskId !== currentTaskId || pending.anonymousId !== anonymousId))
      flush()
    const next = pendingRef.current ?? {
      anonymousId,
      taskId: currentTaskId,
      numbers: 0,
      colours: 0,
    }
    if (kind === 'number') next.numbers += 1
    else next.colours += 1
    pendingRef.current = next
    if (!timerRef.current) timerRef.current = setTimeout(flush, FLUSH_MS)
  }

  return { recordScrub }
}
