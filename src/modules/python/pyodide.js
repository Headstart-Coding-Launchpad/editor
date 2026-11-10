/**
 * Shared Pyodide loader and execution module — main-thread side.
 *
 * Python runs inside a Web Worker (pyodide.worker.js) so the UI never freezes,
 * even on infinite loops. Stopping execution terminates the worker instantly;
 * a new worker is pre-warmed in the background immediately so the next run
 * reloads Pyodide as quickly as possible.
 *
 * Public API (unchanged from previous version):
 *   initPyodide(onProgress?)  — load Pyodide; resolves when ready
 *   runPython(code, callbacks) — run code; resolves { status: 'success'|'error'|'stopped' }
 *   stopPython()               — terminate worker and pre-warm a replacement
 *   provideInput(text)         — supply a value for a pending input() call
 *   isPyodideReady()           — true when worker is alive and Pyodide is loaded
 *   renderStage(code)          — run a stageTarget's code silently; resolves its stage commands
 *   isPythonRunning()          — true while a run is in progress
 *
 * Python stuck (./pythonHealth.js, deep review R3), shown on the student screens as one Reload:
 * - a worker that dies before it says "ready" (its onerror: e.g. a mid-class deploy removed the
 *   old hashed worker file, so the replacement stopPython builds cannot load) is dropped and
 *   pending loads and runs settle. Only the next explicit Run (runPython, initPyodide) or Stop
 *   builds another, as before. An error after "ready" kills nothing.
 * - a worker with no "ready" after PYTHON_READY_TIMEOUT_MS is only slow: the prompt says "Python is
 *   taking a while" and it keeps loading; a "ready" that comes after all clears the prompt again.
 *   Only an error before "ready", or no "ready" by PYTHON_STUCK_TIMEOUT_MS, is stuck (the tutor's
 *   chip too). Third review, 10 Nov: a slow first download is not a death.
 * While stuck, a Run or load that would otherwise wait in silence says PYTHON_ASLEEP_MESSAGE.
 */

import { setChartsLoading } from '../../shared/stage/chartsStatus.js'
import {
  getPythonHealthLevel,
  isPythonStuck,
  PYTHON_ASLEEP_MESSAGE,
  PYTHON_SLOW_MESSAGE,
  setPythonSlow,
  setPythonStuck,
} from './pythonHealth.js'

// Generous: the first load downloads Pyodide (several MB) on school Wi-Fi, with no progress
// messages while it does. A dead worker file is caught at once by onerror instead.
export const PYTHON_READY_TIMEOUT_MS = 90 * 1000
// Still no "ready" by now (the download long since finished or never will): stuck, for the tutor.
export const PYTHON_STUCK_TIMEOUT_MS = 180 * 1000

// What the student is told: only "taking a while" while the load is merely slow.
function asleepMessage() {
  return getPythonHealthLevel() === 'slow' ? PYTHON_SLOW_MESSAGE : PYTHON_ASLEEP_MESSAGE
}

function asleepError() {
  return new Error(asleepMessage())
}

// A Run while Python is stuck: the message on its output (as stderr), never a silent no-op.
function asleepRun(onOutput) {
  try {
    onOutput?.(`${asleepMessage()}\n`, 'stderr')
  } catch {
    // the caller's output handler must not turn this into a throw
  }
  return { status: 'stopped', pythonAsleep: true }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _worker = null
let _loadingPromise = null // resolves when Pyodide is ready inside the worker
let _loadResolve = null
let _loadReject = null
let _runResolve = null // resolves when the current run finishes
let _onOutput = null
let _onInputRequired = null
let _onGpioWrite = null
let _onGpioConfigure = null
let _getGpioInputs = null
let _gpioInputs = {}
let _stopped = false
let _progressCallback = null
// Silent stage renders in flight (renderStage): id → resolve. A run waits for them first.
let _stageRenderId = 0
const _stageRenders = new Map()
let _stageRenderChain = Promise.resolve()
// The silent stage render's timeout, paused while the worker loads matplotlib (charts): the
// download is not the program taking too long. { pause, resume } or null.
let _stageRenderWatch = null
let _readyTimer = null
let _stuckTimer = null
// The worker that has said "ready": a later error in it is not a dead worker file.
let _readyWorker = null

// ─── Worker management ────────────────────────────────────────────────────────

function createAndInitWorker() {
  // Reject any in-flight load promise so callers awaiting it unblock immediately.
  if (_loadReject) {
    _loadReject(new Error('__hs_stopped__'))
    _loadReject = null
    _loadResolve = null
  }

  setChartsLoading(false)
  _loadingPromise = new Promise((res, rej) => {
    _loadResolve = res
    _loadReject = rej
  })
  // A load nobody awaits (the pre-warm after a Stop) must not surface as an unhandled rejection.
  _loadingPromise.catch(() => {})
  let w
  try {
    w = new Worker(new URL('./pyodide.worker.js', import.meta.url), { type: 'module' })
  } catch {
    dropDeadWorker(null)
    return null
  }
  w.onmessage = handleWorkerMessage
  // Only the current worker, and only before it got ready: a terminated older one is already
  // replaced, and an uncaught error in a loaded worker is not a dead worker file.
  w.onerror = () => {
    if (_worker === w && _readyWorker !== w) dropDeadWorker(w)
  }
  clearReadyTimers()
  // Slow, not dead: show the calm prompt and keep loading ('ready' clears it again). Stuck (the
  // tutor's chip) only if it is still not ready much later, or the worker errors (onerror).
  _readyTimer = setTimeout(() => {
    _readyTimer = null
    if (_worker === w && _readyWorker !== w) setPythonSlow()
  }, PYTHON_READY_TIMEOUT_MS)
  _stuckTimer = setTimeout(() => {
    _stuckTimer = null
    if (_worker === w && _readyWorker !== w) setPythonStuck(true)
  }, PYTHON_STUCK_TIMEOUT_MS)
  w.postMessage({ type: 'init' })
  return w
}

function clearReadyTimers() {
  clearTimeout(_readyTimer)
  clearTimeout(_stuckTimer)
  _readyTimer = null
  _stuckTimer = null
}

// A worker died before it got ready: drop it, settle whatever waits on it, and tell the screens.
// Only the next explicit Run or Stop builds another (the Reload loads the page and current files).
function dropDeadWorker(w) {
  clearReadyTimers()
  try {
    w?.terminate()
  } catch {
    // already gone
  }
  _worker = null
  setPythonStuck(true)
  _loadReject?.(asleepError())
  _loadResolve = null
  _loadReject = null
  _loadingPromise = null
  settleStageRenders()
  _stopped = true
  _runResolve?.({ status: 'stopped' })
  _runResolve = null
}

function handleWorkerMessage({ data }) {
  switch (data.type) {
    case 'progress':
      _progressCallback?.(data.msg)
      break

    // matplotlib is loading (a program that imports it, src/shared/stage/charts.js).
    case 'charts_loading':
      setChartsLoading(data.active)
      if (data.active) _stageRenderWatch?.pause()
      else _stageRenderWatch?.resume()
      break

    case 'ready':
      clearReadyTimers()
      _readyWorker = _worker
      _loadResolve?.()
      _loadResolve = null
      _loadReject = null
      _loadingPromise = null
      // A slow load that finished after all: the prompt goes.
      setPythonStuck(false)
      break

    case 'load_error':
      clearReadyTimers()
      _loadReject?.(new Error(data.msg))
      _loadResolve = null
      _loadReject = null
      _loadingPromise = null
      _worker = null // worker is unusable; force re-creation on next initPyodide
      break

    case 'output':
      if (!_stopped) _onOutput?.(data.text, data.kind, data.line)
      break

    case 'gpio_write':
      if (!_stopped) _onGpioWrite?.(data.pin, data.value)
      break

    case 'gpio_configure':
      if (!_stopped) _onGpioConfigure?.(data.pin, data.mode, data.pull)
      break

    case 'gpio_poll': {
      if (_stopped) break
      const values = _getGpioInputs ? _getGpioInputs() : _gpioInputs
      _gpioInputs = values ?? {}
      _worker?.postMessage({ type: 'gpio_inputs', values: _gpioInputs, requestId: data.requestId })
      break
    }

    case 'stage_rendered':
      _stageRenders.get(data.id)?.({
        status: data.status,
        commands: Array.isArray(data.commands) ? data.commands : [],
        error: data.error ?? null,
      })
      _stageRenders.delete(data.id)
      break

    case 'input_required':
      // `stage`: the Stage drawn so far ({ commands }), when the program has drawn (P6-32).
      if (!_stopped) _onInputRequired?.(data.prompt, data.stage ? { stage: data.stage } : {})
      break

    case 'done':
      _runResolve?.({
        status: _stopped ? 'stopped' : data.status,
        variables: data.variables ?? {},
        // The name-tag panel capture (runPython's `capture`), null without one.
        variablesPanel: data.variablesPanel ?? null,
        // Run counts of the capture's countLines ({ "<line>": count }, src/shared/runCounts.js).
        lineCounts: data.lineCounts ?? null,
        turtle: data.turtle ?? null,
        // The Python Stage drawing ({ commands }, src/shared/stage/).
        stage: data.stage ?? null,
        // The slow-mo recording (runPython's `record`, src/modules/python/slowMo/), else null.
        slowMo: data.slowMo ?? null,
      })
      _runResolve = null
      break
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isPyodideReady() {
  return _worker !== null && _loadingPromise === null
}

/**
 * Ensure Pyodide is loaded. Safe to call multiple times — returns immediately
 * if already ready, or waits for the in-progress load (e.g. pre-warm after stop).
 */
export async function initPyodide(onProgress) {
  _progressCallback = onProgress
  if (!_worker) {
    // The first load, or an explicit retry after a dead worker.
    _worker = createAndInitWorker()
    if (!_worker) throw asleepError()
  } else if (isPythonStuck() && _loadingPromise) {
    // Still loading past the timer: say so now rather than wait in silence. The load under way
    // carries on, and clears the prompt if it finishes.
    throw asleepError()
  }
  if (_loadingPromise) {
    try {
      await _loadingPromise
    } catch (err) {
      if (!String(err).includes('__hs_stopped__')) throw err
      if (isPythonStuck()) throw asleepError()
      // Stopped mid-load — not a real error, caller's .catch() should not fire
    }
  }
}

// Runs started and not yet finished (renderStage waits rather than overlap one).
let _runsPending = 0

/**
 * Run a Python code string in the worker.
 * Waits for Pyodide to finish loading if a pre-warm is in progress.
 */
export async function runPython(code, options = {}) {
  _runsPending += 1
  try {
    return await startRun(code, options)
  } finally {
    _runsPending -= 1
  }
}

async function startRun(
  code,
  {
    onOutput,
    onInputRequired,
    onGpioWrite,
    onGpioConfigure,
    gpioInputs,
    getGpioInputs,
    asyncNames,
    // Name-tag panel capture and run counts ({ panel, peekLine, hide, countLines, lineOffset },
    // see runCaptureOptions in src/shared/runCounts.js); omitted for neither.
    capture,
    // Slow-mo recording ({ lineOffset, hide }, see slowMoRecordOptions in
    // src/modules/python/slowMo/config.js); omitted for a normal run.
    record,
    // A task's hidden setupCode ({ code, afterLine }, see setupRunOptions in
    // src/shared/puzzle/setupCode.js); omitted without one.
    setup,
  } = {}
) {
  // Stuck: a dead worker gets one more try from this explicit Run; one still loading past the
  // timer is not waited on in silence.
  let retried = false
  if (!_worker && isPythonStuck()) {
    _worker = createAndInitWorker()
    retried = true
  }
  if (!_worker && isPythonStuck()) return asleepRun(onOutput)
  if (!_worker) throw new Error('Pyodide not initialised — call initPyodide first')
  if (isPythonStuck() && !retried) return asleepRun(onOutput)

  _stopped = false
  _onOutput = onOutput
  _onInputRequired = onInputRequired
  _onGpioWrite = onGpioWrite
  _onGpioConfigure = onGpioConfigure
  _gpioInputs = gpioInputs ?? {}
  _getGpioInputs = getGpioInputs ?? null

  if (_loadingPromise) {
    try {
      await _loadingPromise
    } catch {
      // The worker died while loading: say so. Otherwise it was terminated (Stop) while we
      // waited for the pre-warm to finish.
      if (isPythonStuck()) return asleepRun(onOutput)
      return { status: 'stopped' }
    }
  }

  // A silent stage render (a stageTarget) must finish first: the worker runs one program at once.
  await _stageRenderChain

  // Guard: stopPython() may have been called between the await above and here
  if (_stopped) return { status: 'stopped' }

  return new Promise((resolve) => {
    _runResolve = resolve
    _worker.postMessage({
      type: 'run',
      code,
      gpioInputs: _gpioInputs,
      asyncNames: Array.isArray(asyncNames) ? asyncNames : [],
      capture: capture ?? null,
      record: record ?? null,
      setup: setup ?? null,
    })
  })
}

// Bumped by every stopPython(), so a caller can tell a Stop happened while it waited.
let _stopCount = 0
export function getStopCount() {
  return _stopCount
}

export function isPythonRunning() {
  return _runsPending > 0
}

function settleStageRenders() {
  for (const resolve of _stageRenders.values()) resolve(null)
  _stageRenders.clear()
}

/**
 * Runs a stageTarget's code silently in the worker and resolves `{ status, commands, error }`
 * (src/shared/stage/), or null when it couldn't (a run is in progress, Python stopped, or it
 * took longer than `timeoutMs`, which stops Python). Never call it from inside a run.
 */
export async function renderStage(code, { timeoutMs = 8000 } = {}) {
  if (isPythonStuck()) return null
  if (!_worker) _worker = createAndInitWorker()
  if (_runsPending > 0) return null
  const job = _stageRenderChain.then(async () => {
    if (_loadingPromise) {
      try {
        await _loadingPromise
      } catch {
        return null
      }
    }
    if (!_worker || _runsPending > 0) return null
    const id = ++_stageRenderId
    return new Promise((resolve) => {
      let timer = null
      const arm = () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (!_stageRenders.has(id)) return
          _stageRenders.delete(id)
          _stageRenderWatch = null
          resolve(null)
          stopPython()
        }, timeoutMs)
      }
      arm()
      _stageRenderWatch = { pause: () => clearTimeout(timer), resume: arm }
      _stageRenders.set(id, (result) => {
        clearTimeout(timer)
        _stageRenderWatch = null
        resolve(result)
      })
      _worker.postMessage({ type: 'stage_render', id, code: String(code ?? '') })
    })
  })
  _stageRenderChain = job.then(
    () => undefined,
    () => undefined
  )
  return job
}

/** Terminate the running worker immediately and pre-warm a replacement. */
export function stopPython() {
  if (!_worker) return
  _stopped = true
  _stopCount += 1
  _worker.terminate()
  settleStageRenders()
  _runResolve?.({ status: 'stopped' })
  _runResolve = null
  // createAndInitWorker rejects the old _loadingPromise and creates a fresh one
  _worker = createAndInitWorker()
}

/** Supply the value for a pending input() call. */
export function provideInput(value) {
  _worker?.postMessage({ type: 'input', value })
}

export function updateGpioInputs(values = {}) {
  _gpioInputs = values ?? {}
  _worker?.postMessage({ type: 'gpio_inputs', values: _gpioInputs })
}
