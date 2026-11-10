import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// R3 (deep review 2026-11-10): a Python worker that dies or never gets ready marks Python stuck,
// settles whatever waits on it, and is never rebuilt from the (possibly gone) old file.

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
    await expect(loading).rejects.toThrow()
    expect(health.isPythonStuck()).toBe(true)
    expect(changes).toEqual([true])
    expect(FakeWorker.all[0].terminated).toBe(true)
    expect(py.isPyodideReady()).toBe(false)
  })

  it('settles a run waiting on a worker that dies, and never builds another', async () => {
    const loading = py.initPyodide()
    FakeWorker.all[0].say({ type: 'ready' })
    await loading
    const run = py.runPython('print(1)', {})
    await Promise.resolve()
    FakeWorker.all[0].die()
    await expect(run).resolves.toMatchObject({ status: 'stopped' })
    // Stop and later loads do not rebuild from the old file.
    py.stopPython()
    await expect(py.initPyodide()).rejects.toThrow()
    expect(FakeWorker.all).toHaveLength(1)
    await expect(py.runPython('print(2)', {})).resolves.toMatchObject({ status: 'stopped' })
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

  it('marks Python stuck when it never says ready in time, but not before', async () => {
    vi.useFakeTimers()
    const loading = py.initPyodide().catch((err) => err)
    vi.advanceTimersByTime(py.PYTHON_READY_TIMEOUT_MS - 1000)
    expect(health.isPythonStuck()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(health.isPythonStuck()).toBe(true)
    expect(await loading).toBeInstanceOf(Error)
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
