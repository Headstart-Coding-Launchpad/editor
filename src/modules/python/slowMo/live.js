// Python slow-mo in a Go Live broadcast. Pure.
//
// The presenter's recording travels once, as JSON text (so the realtime database can't reshape
// its lists), squeezed under SLOW_MO_LIVE_BUDGET by compactRecording; after that only the step
// moves. It lives at teacherLive.pythonSlowMo — its own key, written with small merge updates
// (like outputCollapsed), never inside the full payload, which is re-sent on every keystroke:
//
//   { taskId, id, json, position, mode, speed }
//
// null when the presenter isn't in slow-mo. A new Go Live (setTeacherLive) starts without it.
import { SLOW_MO_MODES, compactRecording, readRecording } from './recording.js'
import { clampPythonSlowMoSpeed } from './config.js'

/** The full broadcast for a recording: `{ pythonSlowMo: {...} }` for updateTeacherLive. */
export function buildLiveSlowMoPayload({ taskId, id, recording, position, mode, speed }) {
  const compact = compactRecording(recording)
  if (!compact) return { pythonSlowMo: null }
  return {
    pythonSlowMo: {
      taskId: taskId ?? null,
      id: String(id),
      json: compact.json,
      position: Math.max(0, Math.trunc(position) || 0),
      mode: SLOW_MO_MODES.includes(mode) ? mode : 'paused',
      speed: clampPythonSlowMoSpeed(speed),
    },
  }
}

/** A step update for the broadcast already sent: multi-path keys, so the recording stays. */
export function buildLiveSlowMoStep({ position, mode, speed }) {
  return {
    'pythonSlowMo/position': Math.max(0, Math.trunc(position) || 0),
    'pythonSlowMo/mode': SLOW_MO_MODES.includes(mode) ? mode : 'paused',
    'pythonSlowMo/speed': clampPythonSlowMoSpeed(speed),
  }
}

/**
 * Reads a received broadcast: `{ taskId, id, json, position, mode, speed }`, or null when it
 * isn't a whole one (no recording text yet).
 */
export function readLiveSlowMo(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.json !== 'string' || !raw.id) return null
  return {
    taskId: raw.taskId ?? null,
    id: String(raw.id),
    json: raw.json,
    position: Number.isFinite(raw.position) ? Math.max(0, Math.trunc(raw.position)) : 0,
    mode: SLOW_MO_MODES.includes(raw.mode) ? raw.mode : 'paused',
    speed: clampPythonSlowMoSpeed(raw.speed),
  }
}

/** The recording inside a broadcast's JSON text, or null when it can't be read. */
export function parseLiveRecording(json) {
  if (typeof json !== 'string' || !json) return null
  try {
    return readRecording(JSON.parse(json))
  } catch {
    return null
  }
}
