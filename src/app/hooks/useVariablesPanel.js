import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLatestRef } from './useLatestRef'
import {
  buildVariablesRun,
  compactVariablesForSync,
  currentSnapshot,
  getShowVariables,
} from '../../shared/variablesPanel/variablesPanel.js'
import {
  MAX_PREDICTION_LOG_ENTRIES,
  buildPredictionLogEntry,
  evaluatePredictions,
} from '../../shared/variablesPanel/predictions.js'

// Task ids arrive as numbers or strings, so compare them as text.
const sameTaskId = (a, b) => a != null && b != null && String(a) === String(b)

// How often predictions typed while the tutor watches (activeStudentView) reach them.
const WATCHED_PREDICTION_WRITE_MS = 400

/**
 * The name-tag panel's student-side state (showVariables, src/shared/variablesPanel/): the last
 * run's variables and the student's predictions, for the current task. useStudentCodeState
 * owns one; runWithRuntime hands it each finished run (`receiveRun`), and the workspaces read
 * `run` / `predictions` through `cs.variablesPanel`.
 *
 * Tutor visibility: the panel state (`compactVariablesForSync`) is written to
 * students/{id}/currentVariables after every run and whenever a prediction is committed (on
 * blur), and while the tutor is watching this student (activeStudentView) as they type,
 * throttled. Each reveal of predictions (a Run) is logged to students/{id}/predictionLog/{taskId}
 * for the session report. A Go Live broadcast carries the same state through `syncedRef`
 * (teacherLive.variablesPanel, the python / turtle wire's liveExtras).
 *
 * Nothing is written from the presentation window, outside a live lesson task, or without a
 * session.
 */
export function useVariablesPanel({
  effectiveIdentity,
  currentTaskId,
  sessionRef,
  phaseRef,
  activeStudentViewRef,
  teacherPresentation,
  writeStudentVariables,
  recordVariablePredictions,
}) {
  const [run, setRun] = useState(null)
  // { taskId, values: { name: text }, results: { name: bool } | null, ran: bool } (`ran` once a
  // Run of the task finished: it lifts predict mode's Run lock, getPredictRunLock)
  const [predictions, setPredictions] = useState(null)
  const runRef = useRef(null)
  const predictionsRef = useRef(null)
  // The last run of each task with a snapshot, kept across clears, for "changed since last run".
  const previousRunRef = useRef(null)
  const lastLoggedRef = useRef(new Map())
  const watchedWriteTimerRef = useRef(null)
  const actorRef = useLatestRef(effectiveIdentity)
  const taskIdRef = useLatestRef(currentTaskId)
  const writersRef = useLatestRef({ writeStudentVariables, recordVariablePredictions })

  const setRunState = useCallback((next) => {
    runRef.current = next
    setRun(next)
  }, [])
  const setPredictionState = useCallback((next) => {
    predictionsRef.current = next
    setPredictions(next)
  }, [])

  const canWrite = useCallback(
    () =>
      !teacherPresentation &&
      !!sessionRef?.current &&
      !!actorRef.current?.anonymousId &&
      phaseRef?.current === 'lesson',
    [teacherPresentation, sessionRef, phaseRef, actorRef]
  )

  const sync = useCallback(() => {
    if (!canWrite()) return
    writersRef.current.writeStudentVariables?.(
      actorRef.current.anonymousId,
      compactVariablesForSync(runRef.current, predictionsRef.current)
    )
  }, [canWrite, writersRef, actorRef])

  // A new task starts with an empty panel and no predictions.
  useEffect(() => {
    runRef.current = null
    predictionsRef.current = null
    previousRunRef.current = null
    setRun(null)
    setPredictions(null)
    if (watchedWriteTimerRef.current) clearTimeout(watchedWriteTimerRef.current)
    watchedWriteTimerRef.current = null
  }, [currentTaskId])

  useEffect(
    () => () => {
      if (watchedWriteTimerRef.current) clearTimeout(watchedWriteTimerRef.current)
    },
    []
  )

  // Drops the last run (code reset, new run starting, a restore); predictions stay.
  const clear = useCallback(() => {
    if (runRef.current === null) return
    setRunState(null)
  }, [setRunState])

  /**
   * A finished run of `task` (null for free play): updates the panel, marks predictions, logs
   * and syncs. Returns the check-context extras (`variablePredictions` for the
   * variables_predicted check), `{}` when the task has no panel.
   */
  const receiveRun = useCallback(
    ({ task, status, result }) => {
      const config = getShowVariables(task)
      if (!config) {
        if (runRef.current) setRunState(null)
        return {}
      }
      const taskId = task?.id ?? taskIdRef.current
      const next = buildVariablesRun({
        taskId,
        status,
        capture: result?.variablesPanel ?? null,
        config,
        previous: previousRunRef.current,
      })
      if (next.snapshots.length > 0) previousRunRef.current = next
      setRunState(next)

      const extras = {}
      if (config.mode === 'predict') {
        const current = predictionsRef.current
        const values = sameTaskId(current?.taskId, taskId) ? { ...current.values } : {}
        const snapshot = currentSnapshot(next)
        const evaluation = snapshot ? evaluatePredictions(config.predict, values, snapshot) : null
        setPredictionState({ taskId, values, results: evaluation?.results ?? null, ran: true })
        extras.variablePredictions = { names: config.predict, values, snapshot }
        const typedAny = Object.values(values).some((value) => String(value ?? '').trim())
        const key = `${taskId}`
        const signature = JSON.stringify(values)
        const logged =
          sessionRef?.current?.students?.[actorRef.current?.anonymousId]?.predictionLog?.[taskId]
        const loggedCount = logged && typeof logged === 'object' ? Object.keys(logged).length : 0
        if (
          evaluation &&
          typedAny &&
          canWrite() &&
          lastLoggedRef.current.get(key) !== signature &&
          loggedCount < MAX_PREDICTION_LOG_ENTRIES
        ) {
          lastLoggedRef.current.set(key, signature)
          writersRef.current.recordVariablePredictions?.(
            actorRef.current.anonymousId,
            taskId,
            buildPredictionLogEntry(evaluation, Date.now())
          )
        }
      }
      sync()
      return extras
    },
    [setRunState, setPredictionState, taskIdRef, sessionRef, actorRef, canWrite, writersRef, sync]
  )

  const isWatched = useCallback(
    () =>
      !teacherPresentation &&
      !!actorRef.current?.anonymousId &&
      activeStudentViewRef?.current === actorRef.current.anonymousId,
    [teacherPresentation, activeStudentViewRef, actorRef]
  )

  // A prediction typed into a tag. Changing a revealed prediction hides its tick or cross until
  // the next Run.
  const setPrediction = useCallback(
    (name, text) => {
      const taskId = taskIdRef.current
      const current = sameTaskId(predictionsRef.current?.taskId, taskId)
        ? predictionsRef.current
        : null
      const values = { ...(current?.values ?? {}), [name]: String(text ?? '') }
      let results = current?.results ?? null
      if (results && name in results) {
        results = { ...results }
        delete results[name]
      }
      setPredictionState({ taskId, values, results, ran: !!current?.ran })
      if (isWatched() && !watchedWriteTimerRef.current) {
        watchedWriteTimerRef.current = setTimeout(() => {
          watchedWriteTimerRef.current = null
          sync()
        }, WATCHED_PREDICTION_WRITE_MS)
      }
    },
    [taskIdRef, setPredictionState, isWatched, sync]
  )

  // A prediction input lost focus: the tutor sees the predictions so far.
  const commitPredictions = useCallback(() => sync(), [sync])

  // What a Go Live broadcast carries (read at payload time by useTeacherLivePublish).
  const syncedState = useMemo(() => compactVariablesForSync(run, predictions), [run, predictions])
  const syncedRef = useLatestRef(syncedState)

  return {
    run,
    predictions,
    syncedState,
    syncedRef,
    receiveRun,
    clear,
    setPrediction,
    commitPredictions,
  }
}
