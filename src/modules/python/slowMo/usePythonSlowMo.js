import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { getPythonSlowMo } from './config.js'
import {
  buildSlowMoModel,
  describePosition,
  initialPlayback,
  lineAt,
  outputAt,
  passLabel,
  passesAt,
  playbackReducer,
  readRecording,
  stageAt,
  turtleAt,
  variablesAt,
} from './recording.js'
import {
  buildLiveSlowMoPayload,
  buildLiveSlowMoStep,
  parseLiveRecording,
  readLiveSlowMo,
} from './live.js'

// Faster than this (steps a second) the changed-tag pulse is turned off, so nothing flashes 3 or
// more times a second.
const PULSE_MAX_SPEED = 2

let recordingCounter = 0
function newRecordingId() {
  recordingCounter += 1
  return `${Date.now().toString(36)}-${recordingCounter}`
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b)

/**
 * Python slow-mo for one workspace (python and turtle; docs/authoring/python.md "Slow-mo"):
 * record the run, then play it back line by line.
 *
 * Two sources:
 * - the student's (or presenting tutor's) own workspace: Slow-mo and Step start a slow-mo Run
 *   (cs.handleRun({ slowMo: true })) — that run IS the run, so output, checks, the attempt and
 *   the save happen exactly as for Run — and then play its recording; editing the code, a
 *   normal Run or another task ends slow-mo. Use is counted for the session report
 *   (cs.recordSlowMoUse: one 'run' per recording, one 'step' per step shown). In a Go Live
 *   broadcast it sends the recording once and then each step (teacherLive.pythonSlowMo).
 * - a Go Live viewer (`live` = displayPythonSlowMo): follows the presenter's recording and step,
 *   read-only.
 *
 * Returns the view the workspace draws (null fields when slow-mo isn't showing) and the actions.
 */
export function usePythonSlowMo({ task, cs, code, readOnly = false, live = undefined }) {
  const config = useMemo(() => getPythonSlowMo(task), [task])
  const isViewer = live !== undefined
  const enabled = !!config && !readOnly && !isViewer

  // ── The student's own recording ──
  const [own, setOwn] = useState(null) // { id, code, taskId, model }
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [playback, dispatch] = useReducer(playbackReducer, config?.speed, initialPlayback)

  // Each task starts at its own speed.
  useEffect(() => {
    if (config) dispatch({ type: 'speed', speed: config.speed })
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    setOwn(null)
    dispatch({ type: 'clear' })
  }, [])

  const record = useCallback(
    async (start) => {
      if (!enabled || pendingRef.current || cs.running || cs.runningTests) return
      if (cs.pyodideStatus === 'loading') return
      pendingRef.current = true
      setPending(true)
      clear()
      const codeAtStart = code
      const taskId = task?.id ?? null
      let result = null
      try {
        await cs.handleRun({
          slowMo: true,
          onResult: (value) => {
            result = value
          },
        })
      } finally {
        pendingRef.current = false
        setPending(false)
      }
      const recording = readRecording(result?.slowMo)
      if (!recording) return
      const model = buildSlowMoModel(recording)
      setOwn({ id: newRecordingId(), code: codeAtStart, taskId, model })
      dispatch({ type: 'load', count: model.count, play: start === 'play', step: start === 'step' })
      cs.recordSlowMoUse?.({ kind: 'run' })
    },
    [enabled, cs, code, task?.id, clear]
  )

  // Editing the code (the recording no longer matches it), another task, or slow-mo turned off
  // ends slow-mo.
  useEffect(() => {
    if (own && (own.code !== code || !sameId(own.taskId, task?.id) || !enabled)) clear()
  }, [own, code, task?.id, enabled, clear])

  // A normal Run (or Run Tests) ends slow-mo too: its output replaces the recording's.
  useEffect(() => {
    if (own && (cs.running || cs.runningTests) && !pendingRef.current) clear()
  }, [own, cs.running, cs.runningTests, clear])

  // The playback timer.
  useEffect(() => {
    if (playback.mode !== 'playing') return undefined
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000 / playback.speed)
    return () => clearInterval(timer)
  }, [playback.mode, playback.speed])

  // Steps shown, for the session report.
  const lastPositionRef = useRef(0)
  useEffect(() => {
    const before = lastPositionRef.current
    lastPositionRef.current = playback.position
    if (own && playback.position > before) cs.recordSlowMoUse?.({ kind: 'step' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.position, own?.id])

  // ── Go Live: the presenter's recording and step ──
  const publishedRef = useRef(null)
  useEffect(() => {
    if (isViewer) return
    const canPublish = typeof cs.canPublishTeacherLive === 'function' && cs.canPublishTeacherLive()
    const send = (payload) => {
      try {
        Promise.resolve(cs.updateTeacherLiveFn?.(payload)).catch(() => {})
      } catch {
        // A failed broadcast write never breaks the student's own playback.
      }
    }
    if (!own) {
      if (publishedRef.current && canPublish) send({ pythonSlowMo: null })
      publishedRef.current = null
      return
    }
    if (!canPublish) {
      publishedRef.current = null
      return
    }
    if (publishedRef.current !== own.id) {
      send(
        buildLiveSlowMoPayload({
          taskId: own.taskId,
          id: own.id,
          recording: own.model.recording,
          position: playback.position,
          mode: playback.mode,
          speed: playback.speed,
        })
      )
      publishedRef.current = own.id
    } else {
      send(buildLiveSlowMoStep(playback))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, own, playback.position, playback.mode, playback.speed])

  // ── A Go Live viewer ──
  const liveState = useMemo(() => (isViewer ? readLiveSlowMo(live) : null), [isViewer, live])
  const liveJson = liveState && sameId(liveState.taskId, task?.id) ? liveState.json : null
  const liveModel = useMemo(() => {
    const recording = parseLiveRecording(liveJson)
    return recording ? buildSlowMoModel(recording) : null
  }, [liveJson])

  // ── The view ──
  const model = isViewer ? liveModel : (own?.model ?? null)
  const position = isViewer ? (liveState?.position ?? 0) : playback.position
  const mode = isViewer ? (liveState?.mode ?? 'paused') : playback.mode
  const speed = isViewer ? (liveState?.speed ?? 1) : playback.speed
  const p = model ? Math.min(model.count, Math.max(0, position)) : 0

  const view = useMemo(() => {
    if (!model) return null
    const passes = passesAt(model, p)
    return {
      count: model.count,
      position: p,
      line: lineAt(model, p),
      passes,
      marker: {
        line: lineAt(model, p),
        passes: passes.map((pass) => ({ line: pass.line, label: passLabel(pass) })),
      },
      output: outputAt(model, p),
      variables: variablesAt(model, p),
      turtle: turtleAt(model, p),
      stage: stageAt(model, p),
      hasTurtle: !!model.recording.turtle,
      hasStage: !!model.recording.stage,
      description: describePosition(model, p),
      status: model.recording.status,
      finished: p >= model.count,
      varsDropped: model.recording.varsDropped,
      drawingDropped: model.recording.drawingDropped,
    }
  }, [model, p])

  return {
    config,
    enabled,
    isViewer,
    active: !!view,
    pending,
    mode: view ? mode : 'idle',
    speed,
    pulse: !(mode === 'playing' && speed > PULSE_MAX_SPEED),
    view,
    // Actions (the student's own workspace only).
    slowMo: () => (own ? dispatch({ type: 'play' }) : record('play')),
    pause: () => dispatch({ type: 'pause' }),
    step: () => (own ? dispatch({ type: 'step' }) : record('step')),
    back: () => dispatch({ type: 'back' }),
    restart: () => dispatch({ type: 'restart' }),
    setSpeed: (value) => dispatch({ type: 'speed', speed: value }),
    exit: clear,
  }
}
