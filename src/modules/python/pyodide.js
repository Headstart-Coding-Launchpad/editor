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
 */

// ─── Module state ─────────────────────────────────────────────────────────────

let _worker = null
let _loadingPromise = null  // resolves when Pyodide is ready inside the worker
let _loadResolve = null
let _loadReject = null
let _runResolve = null      // resolves when the current run finishes
let _onOutput = null
let _onInputRequired = null
let _stopped = false
let _progressCallback = null

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
      _worker = null  // worker is unusable; force re-creation on next initPyodide
      break

    case 'output':
      if (!_stopped) _onOutput?.(data.text, data.kind)
      break

    case 'input_required':
      if (!_stopped) _onInputRequired?.(data.prompt)
      break

    case 'done':
      _runResolve?.({ status: _stopped ? 'stopped' : data.status, variables: data.variables ?? {} })
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

/**
 * Run a Python code string in the worker.
 * Waits for Pyodide to finish loading if a pre-warm is in progress.
 */
export async function runPython(code, { onOutput, onInputRequired } = {}) {
  if (!_worker) throw new Error('Pyodide not initialised — call initPyodide first')

  _stopped = false
  _onOutput = onOutput
  _onInputRequired = onInputRequired

  if (_loadingPromise) {
    try {
      await _loadingPromise
    } catch {
      // Worker was terminated while we were waiting for the pre-warm to finish
      return { status: 'stopped' }
    }
  }

  // Guard: stopPython() may have been called between the await above and here
  if (_stopped) return { status: 'stopped' }

  return new Promise((resolve) => {
    _runResolve = resolve
    _worker.postMessage({ type: 'run', code })
  })
}

/** Terminate the running worker immediately and pre-warm a replacement. */
export function stopPython() {
  if (!_worker) return
  _stopped = true
  _worker.terminate()
  _runResolve?.({ status: 'stopped' })
  _runResolve = null
  // createAndInitWorker rejects the old _loadingPromise and creates a fresh one
  _worker = createAndInitWorker()
}

/** Supply the value for a pending input() call. */
export function provideInput(value) {
  _worker?.postMessage({ type: 'input', value })
}
