import { courseLogEntry } from '../../shared/courseUse.js'

// Firebase is loaded on first use, so screens (and tests) that never run a course don't pull the
// SDK in through this hook.
async function rtdb() {
  const [{ db }, database] = await Promise.all([
    import('../../shared/firebase'),
    import('firebase/database'),
  ])
  return { db, ...database }
}

/**
 * Turtle course runs for the session report (src/shared/courseUse.js), called from
 * useStudentCodeState: `recordCourseRun(course)` (a run result's `turtle.course`) adds the run to
 * the student's own `students/{id}/courseLog/{taskId}`
 * `{ runs, goalRuns, crashes, pickups, lastGoalReached, lastAt }`. One write per Run (runs are
 * rare, so nothing is batched). Live lessons only: never the presentation window, Builder preview,
 * solo or a personal sandbox.
 */
export function useCourseLog({
  lessonId,
  phase,
  teacherPresentation,
  previewMode,
  effectiveIdentity,
  currentTaskId,
  inPersonalSandboxRef,
}) {
  function recordCourseRun(course) {
    const entry = courseLogEntry(course)
    if (!entry || !lessonId) return
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef?.current)
      return
    const anonymousId = effectiveIdentity?.anonymousId
    if (!anonymousId || currentTaskId == null) return
    rtdb()
      .then(({ db, ref, update, increment }) =>
        update(ref(db, `sessions/${lessonId}/students/${anonymousId}/courseLog/${currentTaskId}`), {
          runs: increment(1),
          ...(entry.goal ? { goalRuns: increment(1) } : {}),
          ...(entry.crashes ? { crashes: increment(entry.crashes) } : {}),
          pickups: entry.pickups,
          lastGoalReached: entry.goal,
          lastAt: Date.now(),
        })
      )
      .catch(() => {})
  }

  return { recordCourseRun }
}
