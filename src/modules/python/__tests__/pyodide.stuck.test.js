import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// R3 (deep review 2026-11-10): a Python worker that dies or never gets ready marks Python stuck,
// settles whatever waits on it; a slow load only shows the prompt; an explicit Run tries again.

class FakeWorker {
  static all = []
  constructor() {
    this.posted = []
    this.terminated = false
    FakeWorker.all.push(this)
  }
  postMessage(message) {
    this.posted.push(message)
  }
  terminate() {
    this.terminated = true
  }
  say(data) {
    this.onmessage?.({ data })
  }
  die() {
    this.onerror?.(new Event('error'))
  }
}

let py
let health

beforeEach(async () => {
  vi.resetModules()
  FakeWorker.all = []
  vi.stubGlobal('Worker', FakeWorker)
  py = await import('../pyodide.js')
  health = await import('../pythonHealth.js')
})

afterEach(() => {
  health.setPythonStuck(false)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a dead Python worker (R3)', () => {
  it('marks Python stuck when the worker errors while loading, and rejects the load', async () => {
    const changes = []
    health.onPythonStuckChange((stuck) => changes.push(stuck))
    const loading = py.initPyodide()
    FakeWorker.all[0].die()
    await expect(loading).rejects.toThrow(health.PYTHON_ASLEEP_MESSAGE)
    expect(health.isPythonStuck()).toBe(true)
    expect(changes).toEqual([true])
    expect(FakeWorker.all[0].terminated).toBe(true)
    expect(py.isPyodideReady()).toBe(false)
  })

  it('an error after the worker got ready does not kill it', async () => {
    const loading = py.initPyodide()
    FakeWorker.all[0].say({ type: 'ready' })
    await loading
    FakeWorker.all[0].die()
    expect(health.isPythonStuck()).toBe(false)
    expect(FakeWorker.all[0].terminated).toBe(false)
    expect(py.isPyodideReady()).toBe(true)
  })

  it('after a dead worker, the next explicit Run builds a worker again and runs', async () => {
    const first = py.initPyodide()
    FakeWorker.all[0].die()
    await expect(first).rejects.toThrow()
    expect(health.isPythonStuck()).toBe(true)
    // A stage redraw (not a Run) never rebuilds.
    await expect(py.renderStage('x = 1')).resolves.toBeNull()
    expect(FakeWorker.all).toHaveLength(1)
    const run = py.runPython('print(1)', {})
    await Promise.resolve()
    expect(FakeWorker.all).toHaveLength(2)
    FakeWorker.all[1].say({ type: 'ready' })
    expect(health.isPythonStuck()).toBe(false)
    await vi.waitFor(() =>
      expect(FakeWorker.all[1].posted.some((m) => m.type === 'run')).toBe(true)
    )
    FakeWorker.all[1].say({ type: 'done', status: 'success' })
    await expect(run).resolves.toMatchObject({ status: 'success' })
  })

  it('a Run whose rebuilt worker dies again says Python fell asleep, never silence', async () => {
    const first = py.initPyodide()
    FakeWorker.all[0].die()
    await expect(first).rejects.toThrow()
    const out = []
    const run = py.runPython('print(1)', { onOutput: (text, kind) => out.push([text, kind]) })
    await Promise.resolve()
    FakeWorker.all[1].die()
    await expect(run).resolves.toMatchObject({ status: 'stopped', pythonAsleep: true })
    expect(out.map(([t]) => t).join('')).toContain(health.PYTHON_ASLEEP_MESSAGE)
    expect(out[0][1]).toBe('stderr')
  })

  it('marks Python stuck when the rebuilt worker after Stop cannot load', async () => {
    const loading = py.initPyodide()
    FakeWorker.all[0].say({ type: 'ready' })
    await loading
    py.stopPython()
    expect(FakeWorker.all).toHaveLength(2)
    // The old worker's late error is not this one's.
    FakeWorker.all[0].die()
    expect(health.isPythonStuck()).toBe(false)
    FakeWorker.all[1].die()
    expect(health.isPythonStuck()).toBe(true)
  })

  it('a slow load only shows the prompt: the worker lives on and clears it when ready', async () => {
    vi.useFakeTimers()
    const loading = py.initPyodide()
    vi.advanceTimersByTime(py.PYTHON_READY_TIMEOUT_MS - 1000)
    expect(health.isPythonStuck()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(health.isPythonStuck()).toBe(true)
    expect(FakeWorker.all[0].terminated).toBe(false)
    // Another Run while it is still loading is told at once, rather than waiting in silence.
    const out = []
    await expect(
      py.runPython('print(1)', { onOutput: (text) => out.push(text) })
    ).resolves.toMatchObject({ status: 'stopped', pythonAsleep: true })
    // Slow, not asleep (third review): the calmer line, never "fell asleep".
    expect(out.join('')).toContain(health.PYTHON_SLOW_MESSAGE)
    expect(out.join('')).not.toContain(health.PYTHON_ASLEEP_MESSAGE)
    await expect(py.initPyodide()).rejects.toThrow(health.PYTHON_SLOW_MESSAGE)
    // The download finishes after all: the first load resolves and the prompt goes.
    FakeWorker.all[0].say({ type: 'ready' })
    await expect(loading).resolves.toBeUndefined()
    expect(health.isPythonStuck()).toBe(false)
    expect(py.isPyodideReady()).toBe(true)
    expect(FakeWorker.all).toHaveLength(1)
  })

  // Third review (10 Nov): a slow first download is not a death. At 90 s the student sees the
  // calmer "taking a while" prompt; the tutor hears nothing until the worker errors or 180 s pass.
  it('a slow load is "slow" at 90 s and only "stuck" (for the tutor) at 180 s', async () => {
    vi.useFakeTimers()
    py.initPyodide().catch(() => {})
    vi.advanceTimersByTime(py.PYTHON_READY_TIMEOUT_MS)
    expect(health.isPythonStuck()).toBe(true)
    expect(health.getPythonHealthLevel()).toBe('slow')
    FakeWorker.all[0].say({ type: 'progress', msg: 'Downloading…' })
    vi.advanceTimersByTime(py.PYTHON_STUCK_TIMEOUT_MS - py.PYTHON_READY_TIMEOUT_MS - 1000)
    expect(health.getPythonHealthLevel()).toBe('slow')
    vi.advanceTimersByTime(1000)
    expect(health.getPythonHealthLevel()).toBe('stuck')
    expect(FakeWorker.all[0].terminated).toBe(false)
    FakeWorker.all[0].say({ type: 'ready' })
    expect(health.getPythonHealthLevel()).toBe('ok')
  })

  it('a slow worker that then errors is stuck at once', async () => {
    vi.useFakeTimers()
    py.initPyodide().catch(() => {})
    vi.advanceTimersByTime(py.PYTHON_READY_TIMEOUT_MS)
    expect(health.getPythonHealthLevel()).toBe('slow')
    FakeWorker.all[0].die()
    expect(health.getPythonHealthLevel()).toBe('stuck')
  })

  it('a worker that gets ready in time is never marked stuck', async () => {
    vi.useFakeTimers()
    const loading = py.initPyodide()
    FakeWorker.all[0].say({ type: 'ready' })
    await loading
    vi.advanceTimersByTime(py.PYTHON_READY_TIMEOUT_MS * 2)
    expect(health.isPythonStuck()).toBe(false)
    expect(py.isPyodideReady()).toBe(true)
  })
})

// Third review (10 Nov): one helper for the line a caught Run or load error adds to an output.
describe('asleepNote', () => {
  it('is the stuck or slow message and a newline, or nothing for any other error', () => {
    expect(health.asleepNote(new Error(health.PYTHON_ASLEEP_MESSAGE))).toBe(
      `${health.PYTHON_ASLEEP_MESSAGE}\n`
    )
    expect(health.asleepNote(new Error(health.PYTHON_SLOW_MESSAGE))).toBe(
      `${health.PYTHON_SLOW_MESSAGE}\n`
    )
    expect(health.asleepNote(new Error('SyntaxError'))).toBe('')
    expect(health.asleepNote(undefined)).toBe('')
  })
})
