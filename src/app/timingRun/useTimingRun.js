import { useCallback, useEffect, useRef, useState } from 'react'
import { clearTimingRun, loadTimingRun, saveTimingRun } from '../studentStorage'
import { buildTimingTaskList } from './taskList'
import {
  accrue,
  buildRunPayload,
  restoreRun,
  setHidden,
  setUserPaused,
  startRun,
  switchTask,
} from './timingRun'

const HEARTBEAT_MS = 10000
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/**
 * Drives one timing run. `taskId` is the task on screen. Returns the run state (null when no
 * run is going) plus start / pause / resume / finish-payload helpers.
 */
export function useTimingRun({ lessonId, lesson, taskId, tutorUid }) {
  const [state, setState] = useState(() => {
    return restoreRun(loadTimingRun(lessonId, tutorUid), Date.now(), { hidden: isHidden() })
  })
  const stateRef = useRef(state)
  stateRef.current = state
  const running = state !== null

  const update = useCallback(
    (fn) => {
      const cur = stateRef.current
      if (!cur) return
      const next = fn(cur, Date.now())
      stateRef.current = next
      setState(next)
      saveTimingRun(lessonId, tutorUid, next)
    },
    [lessonId, tutorUid]
  )

  // Task on screen changed.
  useEffect(() => {
    update((s, now) => switchTask(s, taskId ?? null, now))
  }, [taskId, update, running])

  // Pause when the tab is hidden, resume when visible.
  useEffect(() => {
    const onVis = () => update((s, now) => setHidden(s, isHidden(), now))
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [update])

  // Heartbeat so a reload loses at most a few seconds.
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => update((s, now) => accrue(s, now)), HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [running, update])

  const start = useCallback(() => {
    const next = startRun(Date.now(), { taskId: taskId ?? null, hidden: isHidden() })
    stateRef.current = next
    setState(next)
    saveTimingRun(lessonId, tutorUid, next)
  }, [lessonId, tutorUid, taskId])

  const setPaused = useCallback(
    (paused) => update((s, now) => setUserPaused(s, paused, now)),
    [update]
  )

  const buildPayload = useCallback(
    (meta) =>
      buildRunPayload(stateRef.current, Date.now(), {
        lessonId,
        lessonTitle: lesson?.title,
        taskList: buildTimingTaskList(lesson),
        tutorUid,
        ...meta,
      }),
    [lessonId, lesson, tutorUid]
  )

  const discard = useCallback(() => {
    stateRef.current = null
    setState(null)
    clearTimingRun(lessonId, tutorUid)
  }, [lessonId, tutorUid])

  return { state, start, setPaused, buildPayload, discard }
}
