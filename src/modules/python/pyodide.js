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
 */

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

// ─── Worker management ────────────────────────────────────────────────────────

function createAndInitWorker() {
  // Reject any in-flight load promise so callers awaiting it unblock immediately.
  if (_loadReject) {
    _loadReject(new Error('__hs_stopped__'))
    _loadReject = null
    _loadResolve = null
  }

  const w = new Worker(new URL('./pyodide.worker.js', import.meta.url), { type: 'module' })
  w.onmessage = handleWorkerMessage
  _loadingPromise = new Promise((res, rej) => {
    _loadResolve = res
    _loadReject = rej
  })
  w.postMessage({ type: 'init' })
  return w
}

function handleWorkerMessage({ data }) {
  switch (data.type) {
    case 'progress':
      _progressCallback?.(data.msg)
      break

    case 'ready':
      _loadResolve?.()
      _loadResolve = null
      _loadReject = null
      _loadingPromise = null
      break

    case 'load_error':
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
    _worker = createAndInitWorker()
  }
  if (_loadingPromise) {
    try {
      await _loadingPromise
    } catch (err) {
      if (!String(err).includes('__hs_stopped__')) throw err
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
  if (!_worker) throw new Error('Pyodide not initialised — call initPyodide first')

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
      // Worker was terminated while we were waiting for the pre-warm to finish
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
      const timer = setTimeout(() => {
        if (!_stageRenders.has(id)) return
        _stageRenders.delete(id)
        resolve(null)
        stopPython()
      }, timeoutMs)
      _stageRenders.set(id, (result) => {
        clearTimeout(timer)
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
