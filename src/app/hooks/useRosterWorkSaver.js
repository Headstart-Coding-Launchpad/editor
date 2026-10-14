import { useEffect, useRef } from 'react'
import { hashRosterWork } from '../../shared/roster/rosterModel'
import {
  changedRosterWorkCandidates,
  collectRosterWorkCandidates,
  markRosterWorkSeen,
} from '../../shared/roster/rosterWorkChanges'
import { saveRosterWork } from '../../shared/roster/rosterService'

// How long a matched student's new Run or submission waits before it is saved, so a burst of
// runs makes one write.
export const ROSTER_SAVE_DEBOUNCE_MS = 3000

// Tutor-mediated saving (Ryan, 2026-10-14): students never write Firestore, so the tutor's
// signed-in TeacherView saves each matched student's work from what it already receives — the
// last Run on the current task (`currentCode` / `currentFiles` with a new `lastRunAt`) and each
// new attempt (`attemptLog`, auto-check-on-leave included) — to
// classes/{classId}/roster/{rosterId}/work/{sourceLessonId}__{sourceTaskId}.
// Never per keystroke: a save waits ROSTER_SAVE_DEBOUNCE_MS after the last change for that
// student and task, and every pending save is flushed at once when the class moves to another
// task (the leaving task's last Run is captured before setTaskId clears it) or the view closes.
// Unchanged work (same hash as this tab last saved) is skipped.
// `matches`: { anonymousId: rosterId } (activeRosterMatches). Saves only while `classId` is set.
export function useRosterWorkSaver({ session, lesson, lessonId, classId, matches, onError }) {
  const seenRef = useRef(new Map())
  const savedHashRef = useRef(new Map())
  const pendingRef = useRef(new Map())
  const timersRef = useRef(new Map())
  const classIdRef = useRef(classId)
  const onErrorRef = useRef(onError)
  classIdRef.current = classId
  onErrorRef.current = onError

  // Captures the work now (the session snapshot may be wiped by the next task change) and
  // writes it unless this tab already saved the same work there.
  async function save(entry) {
    const targetClassId = entry.classId
    const savedKey = `${targetClassId}/${entry.rosterId}/${entry.workId}`
    const hash = hashRosterWork(entry.work)
    if (savedHashRef.current.get(savedKey) === hash) return
    savedHashRef.current.set(savedKey, hash)
    try {
      await saveRosterWork(targetClassId, entry.rosterId, entry.workId, entry.work, {
        moduleType: entry.moduleType,
        sessionLessonId: lessonId,
        taskId: entry.taskId,
        sourceLessonId: entry.sourceLessonId,
        sourceTaskId: entry.sourceTaskId,
        origin: entry.origin,
        hash,
      })
    } catch (err) {
      savedHashRef.current.delete(savedKey)
      onErrorRef.current?.(err)
    }
  }

  function flush(key) {
    const entry = pendingRef.current.get(key)
    clearTimeout(timersRef.current.get(key))
    timersRef.current.delete(key)
    pendingRef.current.delete(key)
    if (entry) save(entry)
  }

  function flushAll() {
    for (const key of [...pendingRef.current.keys()]) flush(key)
  }

  // A new class choice starts afresh; anything pending for the old class is still saved there.
  // (Declared before the collecting effect, which must see the fresh map.)
  useEffect(() => {
    seenRef.current = new Map()
  }, [classId])

  useEffect(() => {
    if (!classId || !session || !lesson) return
    const candidates = collectRosterWorkCandidates({ session, lesson, lessonId, matches })
    for (const candidate of changedRosterWorkCandidates(candidates, seenRef.current)) {
      markRosterWorkSeen(seenRef.current, candidate)
      const work = candidate.extract()
      if (!work) continue
      pendingRef.current.set(candidate.key, { ...candidate, work, classId })
      clearTimeout(timersRef.current.get(candidate.key))
      timersRef.current.set(
        candidate.key,
        setTimeout(() => flush(candidate.key), ROSTER_SAVE_DEBOUNCE_MS)
      )
    }
    // flush is stable in behaviour (it reads refs only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, session, lesson, lessonId, matches])

  // The class moved on (or the session ended / the sandbox opened): save what is pending now.
  useEffect(() => {
    flushAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentTaskId, session?.state])

  useEffect(() => {
    const onPageHide = () => flushAll()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      flushAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
