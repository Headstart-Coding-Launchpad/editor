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
 * useStudentCodeState: `recordScrub({ kind: 'number' | 'colour' | 'boolean' })` (the code editor's
 * onScrubCommit, once per finished scrub) adds to the student's own
 * `students/{id}/scrubLog/{taskId}` `{ numbers, colours, booleans, lastAt }`, batched (one write per few
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
    const path = `sessions/${lessonId}/students/${pending.anonymousId}/scrubLog/${pending.taskId}`
    rtdb()
      .then(({ db, ref, update, increment }) => {
        const writes = []
        if (pending.numbers || pending.colours) {
          writes.push({
            ...(pending.numbers ? { numbers: increment(pending.numbers) } : {}),
            ...(pending.colours ? { colours: increment(pending.colours) } : {}),
            lastAt: Date.now(),
          })
        }
        // Its own write, so a database without the booleans rule yet still keeps the others.
        if (pending.booleans) {
          writes.push({ booleans: increment(pending.booleans), lastAt: Date.now() })
        }
        return Promise.all(writes.map((data) => update(ref(db, path), data).catch(() => {})))
      })
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
      booleans: 0,
    }
    if (kind === 'number') next.numbers += 1
    else if (kind === 'boolean') next.booleans += 1
    else next.colours += 1
    pendingRef.current = next
    if (!timerRef.current) timerRef.current = setTimeout(flush, FLUSH_MS)
  }

  return { recordScrub }
}
