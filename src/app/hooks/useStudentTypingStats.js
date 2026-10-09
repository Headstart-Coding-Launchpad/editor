import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLatestRef } from './useLatestRef'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'
import { getModuleDefinition } from '../../modules/definitions.js'
import {
  applyTypingEvent,
  applyTypingRun,
  createTypingState,
  typingRecordOf,
} from '../../shared/typingStats'

/**
 * Typing measures for the session report (src/shared/typingStats.js; report fields in
 * docs/authoring/session-reports.md "Typing"). The shared CodeEditor reports each keystroke
 * insert, Backspace/Delete press and accepted autocomplete through BadgeSignalsContext
 * (`reportTyping`); this hook adds them up in memory per task, on this device's clock, and
 * writes one aggregated record per task to the student's own `students/{id}/typingLog/{taskId}`
 * (`writers.recordStudentTyping`). Writes happen only on Run (`noteRun`, which also takes the
 * first Run's copyDistance), when the class moves to another task or into the teacher's
 * sandbox, and when the tab is hidden or the page unloads: never per keystroke, and never after
 * the session ended (typing after the student's last such write is not reported).
 *
 * Recorded only for a real student in a live lesson, on a task of a typing lesson type
 * (python, turtle, html), outside the personal sandbox, on a keyboard device. Never solo, the
 * presentation window, the Builder preview or a touch device (on-screen keyboard speeds aren't
 * comparable).
 *
 * Returns stable `reportTyping(event)`, `noteRun({ copyCode, work })` and `flush()`, plus
 * `enabled`.
 */
export function useStudentTypingStats({
  phase,
  identity,
  session,
  teacherPresentation = false,
  previewMode = false,
  currentTaskId,
  lessonType,
  inPersonalSandbox = false,
  writers = {},
}) {
  const isTouchDevice = useIsTouchDevice()
  const anonymousId = identity?.anonymousId ?? null
  const enabled =
    !isTouchDevice &&
    !teacherPresentation &&
    !previewMode &&
    !inPersonalSandbox &&
    !!anonymousId &&
    !!session &&
    phase === 'lesson' &&
    currentTaskId != null &&
    getModuleDefinition(lessonType)?.capabilities?.typingStats === true

  const stateRef = useLatestRef({ enabled, anonymousId, currentTaskId })
  const sessionRef = useLatestRef(session)
  const writersRef = useLatestRef(writers)
  // taskId (as a string) → { state, dirty }, for this session run.
  const trackersRef = useRef(new Map())

  // A new session run starts every count afresh.
  useEffect(() => {
    trackersRef.current = new Map()
  }, [session?.createdAt])

  const trackerFor = useCallback(
    (taskId) => {
      const key = String(taskId)
      let tracker = trackersRef.current.get(key)
      if (!tracker) {
        const s = stateRef.current
        // Seed from what this student already stored for the task (a reload, or the class
        // coming back to it), so the counts carry on instead of starting again.
        const stored = sessionRef.current?.students?.[s.anonymousId]?.typingLog?.[key] ?? null
        tracker = { state: createTypingState(stored), dirty: false }
        trackersRef.current.set(key, tracker)
      }
      return tracker
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const flushTask = useCallback(
    (taskId) => {
      const s = stateRef.current
      if (taskId == null || !s.anonymousId) return
      const tracker = trackersRef.current.get(String(taskId))
      if (!tracker?.dirty) return
      // Never after the session ended (endSession removes the students node, and a write would
      // recreate it) or once the teacher removed this student.
      const live = sessionRef.current
      if (live?.state !== 'active' && live?.state !== 'sandbox') return
      if (!live?.students?.[s.anonymousId]) return
      const record = typingRecordOf(tracker.state)
      if (!record) return
      tracker.dirty = false
      Promise.resolve(
        writersRef.current.recordStudentTyping?.(s.anonymousId, taskId, record)
      ).catch(() => {
        // Lost on a failed write; the next flush sends the totals again.
        tracker.dirty = true
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const flush = useCallback(
    () => {
      for (const key of trackersRef.current.keys()) flushTask(key)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportTyping = useCallback(
    (event) => {
      const s = stateRef.current
      if (!s.enabled || !event) return
      const tracker = trackerFor(s.currentTaskId)
      applyTypingEvent(tracker.state, event)
      tracker.dirty = true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // The student pressed Run on the current task: the first Run on a copyCode task records the
  // copy distance, and every Run sends the totals so far.
  const noteRun = useCallback(
    ({ copyCode, work } = {}) => {
      const s = stateRef.current
      if (!s.enabled) return
      const tracker = trackerFor(s.currentTaskId)
      if (applyTypingRun(tracker.state, { copyCode, work })) tracker.dirty = true
      flushTask(s.currentTaskId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Moving to another task sends the previous task's totals.
  const previousTaskIdRef = useRef(currentTaskId)
  useEffect(() => {
    const previous = previousTaskIdRef.current
    previousTaskIdRef.current = currentTaskId
    if (previous != null && String(previous) !== String(currentTaskId)) flushTask(previous)
  }, [currentTaskId, flushTask])

  // Leaving the lesson phase (the class going into the teacher's sandbox) sends what is left.
  useEffect(() => {
    if (!enabled) flush()
  }, [enabled, flush])

  // A hidden tab or a closing page sends the totals too; so does unmounting.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return useMemo(
    () => ({ enabled, reportTyping, noteRun, flush }),
    [enabled, reportTyping, noteRun, flush]
  )
}
