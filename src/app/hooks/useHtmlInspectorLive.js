import { useEffect, useRef } from 'react'
import { normalizeInspectorLiveState } from '../../modules/html/inspector/config'
import { INSPECTOR_USE_KINDS } from '../../shared/inspectorUse'

// Firebase is loaded on first use, so screens (and tests) that never touch the Inspector don't
// pull the SDK in through this hook.
async function rtdb() {
  const [{ db }, database] = await Promise.all([
    import('../../shared/firebase'),
    import('firebase/database'),
  ])
  return { db, ...database }
}

const FLUSH_MS = 3000

/**
 * The HTML Inspector's live side (src/modules/html/inspector), called from useStudentCodeState:
 *
 * - `publishInspector(state)` — the tutor's (or broadcasting source's) inspect state for Go Live,
 *   `{ on, selector, property }` or null. Kept in `inspectorRef` (the html wire's liveExtras puts
 *   it in every full teacherLive payload, explicit null when cleared) and written straight to
 *   `teacherLive/inspector` so a click reaches the class without bumping teacherLive.updatedAt,
 *   which would rebuild the viewers' preview iframe.
 * - `liveInspector` — teacherLive.inspector, what a forced-live viewer's Inspector follows.
 * - `recordInspectorUse('open' | 'select')` — the student's own use for the session report:
 *   `students/{id}/inspectorLog/{taskId}` `{ opens, selects, lastAt }`, batched (one write per
 *   few seconds at most). Live lessons only: never the presentation window, Builder preview,
 *   solo or a personal sandbox.
 */
export function useHtmlInspectorLive({
  lessonId,
  session,
  phase,
  teacherPresentation,
  previewMode,
  effectiveIdentity,
  currentTaskId,
  inPersonalSandboxRef,
  inspectorRef,
  canPublishTeacherLive,
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
            `sessions/${lessonId}/students/${pending.anonymousId}/inspectorLog/${pending.taskId}`
          ),
          {
            ...(pending.opens ? { opens: increment(pending.opens) } : {}),
            ...(pending.selects ? { selects: increment(pending.selects) } : {}),
            lastAt: Date.now(),
          }
        )
      )
      .catch(() => {})
  }

  // A task change (or leaving) sends what's waiting at once.
  useEffect(() => () => flush(), [currentTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

  function recordInspectorUse(kind) {
    if (!INSPECTOR_USE_KINDS.includes(kind)) return
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef?.current)
      return
    const anonymousId = effectiveIdentity?.anonymousId
    if (!anonymousId || currentTaskId == null) return
    const pending = pendingRef.current
    if (pending && (pending.taskId !== currentTaskId || pending.anonymousId !== anonymousId))
      flush()
    const next = pendingRef.current ?? { anonymousId, taskId: currentTaskId, opens: 0, selects: 0 }
    if (kind === 'open') next.opens += 1
    else next.selects += 1
    pendingRef.current = next
    if (!timerRef.current) timerRef.current = setTimeout(flush, FLUSH_MS)
  }

  function publishInspector(state) {
    const normalized = normalizeInspectorLiveState(state)
    inspectorRef.current = normalized
    if (!lessonId || !canPublishTeacherLive()) return
    rtdb()
      .then(({ db, ref, set }) =>
        set(ref(db, `sessions/${lessonId}/teacherLive/inspector`), normalized)
      )
      .catch(() => {})
  }

  return {
    liveInspector: normalizeInspectorLiveState(session?.teacherLive?.inspector),
    publishInspector,
    recordInspectorUse,
  }
}
