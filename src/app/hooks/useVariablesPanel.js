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
  evaluateTypePredictions,
} from '../../shared/variablesPanel/predictions.js'
import {
  buildRunCounts,
  evaluateCountPredictions,
  getRunCounts,
  getTaskCountMarks,
  taskCountsRuns,
} from '../../shared/runCounts.js'

// Task ids arrive as numbers or strings, so compare them as text.
const sameTaskId = (a, b) => a != null && b != null && String(a) === String(b)

// How often predictions typed while the tutor watches (activeStudentView) reach them.
const WATCHED_PREDICTION_WRITE_MS = 400

/**
 * The name-tag panel's student-side state (showVariables, src/shared/variablesPanel/): the last
 * run's variables and the student's predictions, for the current task — and the task's run
 * counts (`runCounts` / `#@count`, src/shared/runCounts.js: the count boxes' predictions and the
 * last run's counts), which work with or without the panel. useStudentCodeState owns one;
 * runWithRuntime hands it each finished run (`receiveRun`), and the workspaces read `run` /
 * `predictions` / `countRun` through `cs.variablesPanel`.
 *
 * Tutor visibility: the panel state (`compactVariablesForSync`) is written to
 * students/{id}/currentVariables after every run and whenever a prediction is committed (on
 * blur, or a button pick), and while the tutor is watching this student (activeStudentView) as
 * they type, throttled. Each reveal of predictions (a Run) is logged to
 * students/{id}/predictionLog/{taskId} for the session report. A Go Live broadcast carries the
 * same state through `syncedRef` (teacherLive.variablesPanel, the python / turtle wire's
 * liveExtras).
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
  // { taskId, values: { name: text }, results: { name: bool } | null, types: { name: type
  // label }, typeResults: { name: bool } | null, counts: { L3: text }, countResults: { L3: bool }
  // | null, ran: bool } (`types` the predictType picks; `counts` the run-count boxes; `ran` once
  // a Run of the task finished: it lifts predict mode's Run lock, getPredictRunLock /
  // getRunCountLock)
  const [predictions, setPredictions] = useState(null)
  // The last run's counts: { taskId, counts: { L3: 4 } } (src/shared/runCounts.js), or null.
  const [countRun, setCountRun] = useState(null)
  const runRef = useRef(null)
  const predictionsRef = useRef(null)
  const countRunRef = useRef(null)
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
  const setCountRunState = useCallback((next) => {
    countRunRef.current = next
    setCountRun(next)
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
      compactVariablesForSync(runRef.current, predictionsRef.current, countRunRef.current)
    )
  }, [canWrite, writersRef, actorRef])

  // A new task starts with an empty panel, no counts and no predictions.
  useEffect(() => {
    runRef.current = null
    predictionsRef.current = null
    countRunRef.current = null
    previousRunRef.current = null
    setRun(null)
    setPredictions(null)
    setCountRun(null)
    if (watchedWriteTimerRef.current) clearTimeout(watchedWriteTimerRef.current)
    watchedWriteTimerRef.current = null
  }, [currentTaskId])

  useEffect(
    () => () => {
      if (watchedWriteTimerRef.current) clearTimeout(watchedWriteTimerRef.current)
    },
    []
  )

  // Drops the last run and its counts (code reset, new run starting, a restore); predictions
  // stay. After the first Run the count boxes don't come back: the marked lines are blank until
  // the next Run reports its counts.
  const clear = useCallback(() => {
    if (runRef.current !== null) setRunState(null)
    if (countRunRef.current !== null) setCountRunState(null)
  }, [setRunState, setCountRunState])

  /**
   * A finished run of `task` (null for free play) of `code` (the code that ran, so counted
   * lines are placed where they ran): updates the panel and the run counts, marks predictions,
   * logs and syncs. Returns the check-context extras (`variablePredictions` for the
   * variables_predicted / types_predicted checks, `runCounts` for runs_predicted /
   * line_run_count), `{}` when the task has neither panel nor counts.
   */
  const receiveRun = useCallback(
    ({ task, status, result, code = '' }) => {
      const config = getShowVariables(task)
      const counting = !!task && taskCountsRuns(task)
      if (!config && runRef.current) setRunState(null)
      if (!counting && countRunRef.current) setCountRunState(null)
      if (!config && !counting) return {}
      const taskId = task?.id ?? taskIdRef.current
      const extras = {}
      const current = predictionsRef.current
      const own = sameTaskId(current?.taskId, taskId) ? current : null
      let nextPredictions = null
      let evaluation = null
      let typeEvaluation = null
      let countEvaluation = null

      if (config) {
        const next = buildVariablesRun({
          taskId,
          status,
          capture: result?.variablesPanel ?? null,
          config,
          previous: previousRunRef.current,
        })
        if (next.snapshots.length > 0) previousRunRef.current = next
        setRunState(next)
        if (config.mode === 'predict') {
          const values = own ? { ...own.values } : {}
          const types = own?.types ? { ...own.types } : {}
          const snapshot = currentSnapshot(next)
          evaluation = snapshot ? evaluatePredictions(config.predict, values, snapshot) : null
          typeEvaluation =
            snapshot && config.predictType.length > 0
              ? evaluateTypePredictions(config.predictType, types, snapshot)
              : null
          nextPredictions = {
            ...(own ?? {}),
            taskId,
            values,
            results: evaluation?.results ?? null,
            types,
            typeResults: typeEvaluation?.results ?? null,
            ran: true,
          }
          extras.variablePredictions = {
            names: config.predict,
            values,
            typeNames: config.predictType,
            types,
            snapshot,
          }
        }
      }

      if (counting) {
        const counts = buildRunCounts(task, code, result?.lineCounts ?? null)
        setCountRunState(counts ? { taskId, counts } : null)
        const marks = getTaskCountMarks(task)
        const base = nextPredictions ?? own
        const countValues = base?.counts ? { ...base.counts } : {}
        extras.runCounts = { marks, values: countValues, counts }
        if (getRunCounts(task) === 'predict' && marks.length > 0) {
          countEvaluation = counts ? evaluateCountPredictions(marks, countValues, counts) : null
          nextPredictions = {
            values: {},
            results: null,
            ...(base ?? {}),
            taskId,
            counts: countValues,
            countResults: countEvaluation?.results ?? null,
            ran: true,
          }
        }
      }

      if (nextPredictions) {
        setPredictionState(nextPredictions)
        const typedAny = [
          ...Object.values(nextPredictions.values ?? {}),
          ...Object.values(nextPredictions.types ?? {}),
          ...Object.values(nextPredictions.counts ?? {}),
        ].some((value) => String(value ?? '').trim())
        const key = `${taskId}`
        const signature = JSON.stringify([
          nextPredictions.values ?? {},
          nextPredictions.types ?? {},
          nextPredictions.counts ?? {},
        ])
        const logged =
          sessionRef?.current?.students?.[actorRef.current?.anonymousId]?.predictionLog?.[taskId]
        const loggedCount = logged && typeof logged === 'object' ? Object.keys(logged).length : 0
        if (
          (evaluation || countEvaluation) &&
          typedAny &&
          canWrite() &&
          lastLoggedRef.current.get(key) !== signature &&
          loggedCount < MAX_PREDICTION_LOG_ENTRIES
        ) {
          lastLoggedRef.current.set(key, signature)
          writersRef.current.recordVariablePredictions?.(
            actorRef.current.anonymousId,
            taskId,
            buildPredictionLogEntry(evaluation, Date.now(), { typeEvaluation, countEvaluation })
          )
        }
      }
      sync()
      return extras
    },
    [
      setRunState,
      setCountRunState,
      setPredictionState,
      taskIdRef,
      sessionRef,
      actorRef,
      canWrite,
      writersRef,
      sync,
    ]
  )

  const isWatched = useCallback(
    () =>
      !teacherPresentation &&
      !!actorRef.current?.anonymousId &&
      activeStudentViewRef?.current === actorRef.current.anonymousId,
    [teacherPresentation, activeStudentViewRef, actorRef]
  )

  // While the tutor watches this student (activeStudentView), what they type reaches the tutor,
  // throttled; otherwise only on commit (blur) and Run.
  const syncIfWatched = useCallback(() => {
    if (isWatched() && !watchedWriteTimerRef.current) {
      watchedWriteTimerRef.current = setTimeout(() => {
        watchedWriteTimerRef.current = null
        sync()
      }, WATCHED_PREDICTION_WRITE_MS)
    }
  }, [isWatched, sync])

  // The prediction state for the current task, to change one field of.
  const currentPredictions = useCallback(() => {
    const taskId = taskIdRef.current
    const current = sameTaskId(predictionsRef.current?.taskId, taskId)
      ? predictionsRef.current
      : null
    return { taskId, current }
  }, [taskIdRef])

  // A prediction typed into a tag. Changing a revealed prediction hides its tick or cross until
  // the next Run.
  const setPrediction = useCallback(
    (name, text) => {
      const { taskId, current } = currentPredictions()
      const values = { ...(current?.values ?? {}), [name]: String(text ?? '') }
      let results = current?.results ?? null
      if (results && name in results) {
        results = { ...results }
        delete results[name]
      }
      setPredictionState({
        ...(current ?? {}),
        taskId,
        values,
        results,
        ran: !!current?.ran,
      })
      syncIfWatched()
    },
    [currentPredictions, setPredictionState, syncIfWatched]
  )

  // A type picked on a predictType tag (p6-27): one tap, so the tutor sees it at once (a single
  // write per pick, never per keystroke). Changing a revealed pick hides its tick or cross.
  const setTypePrediction = useCallback(
    (name, label) => {
      const { taskId, current } = currentPredictions()
      const types = { ...(current?.types ?? {}), [name]: String(label ?? '') }
      let typeResults = current?.typeResults ?? null
      if (typeResults && name in typeResults) {
        typeResults = { ...typeResults }
        delete typeResults[name]
      }
      setPredictionState({
        values: {},
        results: null,
        ...(current ?? {}),
        taskId,
        types,
        typeResults,
        ran: !!current?.ran,
      })
      sync()
    },
    [currentPredictions, setPredictionState, sync]
  )

  // A number typed into a run-count box (`key` the marked line's `L<n>`, p6-26). Like a typed
  // prediction: to the tutor on commit (blur) and, while watched, throttled as they type.
  const setCountPrediction = useCallback(
    (key, text) => {
      const { taskId, current } = currentPredictions()
      const counts = { ...(current?.counts ?? {}), [key]: String(text ?? '') }
      setPredictionState({
        values: {},
        results: null,
        ...(current ?? {}),
        taskId,
        counts,
        ran: !!current?.ran,
      })
      syncIfWatched()
    },
    [currentPredictions, setPredictionState, syncIfWatched]
  )

  // A prediction input lost focus: the tutor sees the predictions so far.
  const commitPredictions = useCallback(() => sync(), [sync])

  // What a Go Live broadcast carries (read at payload time by useTeacherLivePublish).
  const syncedState = useMemo(
    () => compactVariablesForSync(run, predictions, countRun),
    [run, predictions, countRun]
  )
  const syncedRef = useLatestRef(syncedState)

  return {
    run,
    predictions,
    countRun,
    syncedState,
    syncedRef,
    receiveRun,
    clear,
    setPrediction,
    setTypePrediction,
    setCountPrediction,
    commitPredictions,
  }
}
