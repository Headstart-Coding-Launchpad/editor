// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewScheduler, SCRUB_PREVIEW_DELAY_MS } from '../previewScheduler.js'

// A run that stays going until the test finishes it.
function controlledRun() {
  const calls = []
  const finishers = []
  const run = vi.fn((job) => {
    calls.push(job)
    return new Promise((resolve) => finishers.push(resolve))
  })
  const finishNext = async () => {
    finishers.shift()?.()
    await vi.runAllTimersAsync()
  }
  return { run, calls, finishNext }
}

describe('createPreviewScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces: only the value that settles runs', async () => {
    const { run, calls } = controlledRun()
    const scheduler = createPreviewScheduler({ run })
    scheduler.request('a')
    await vi.advanceTimersByTimeAsync(SCRUB_PREVIEW_DELAY_MS - 50)
    scheduler.request('b')
    await vi.advanceTimersByTimeAsync(SCRUB_PREVIEW_DELAY_MS - 50)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(50)
    expect(calls).toEqual(['b'])
  })

  it('never starts a run while one is going, then runs only the latest request', async () => {
    const { run, calls, finishNext } = controlledRun()
    const scheduler = createPreviewScheduler({ run, delayMs: 10 })
    scheduler.request('a')
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toEqual(['a'])
    scheduler.request('b')
    await vi.advanceTimersByTimeAsync(10)
    scheduler.request('c')
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toEqual(['a'])
    expect(scheduler.busy()).toBe(true)
    await finishNext()
    expect(calls).toEqual(['a', 'c'])
    await finishNext()
    expect(scheduler.busy()).toBe(false)
  })

  it('skips a request the same as the last run, until reset', async () => {
    const { run, calls, finishNext } = controlledRun()
    const scheduler = createPreviewScheduler({
      run,
      delayMs: 10,
      isSame: (a, b) => a.code === b.code,
    })
    scheduler.request({ code: 'x' })
    await vi.advanceTimersByTimeAsync(10)
    await finishNext()
    scheduler.request({ code: 'x' })
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toHaveLength(1)
    scheduler.reset()
    scheduler.request({ code: 'x' })
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toHaveLength(2)
  })

  it('settle drops a waiting request and resolves when the running one ends', async () => {
    const { run, calls, finishNext } = controlledRun()
    const scheduler = createPreviewScheduler({ run, delayMs: 10 })
    scheduler.request('a')
    await vi.advanceTimersByTimeAsync(10)
    scheduler.request('b')
    let settled = false
    scheduler.settle().then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await finishNext()
    expect(settled).toBe(true)
    expect(calls).toEqual(['a'])
    await expect(scheduler.settle()).resolves.toBeUndefined()
  })

  it('keeps going after a run that throws', async () => {
    const run = vi.fn(async (job) => {
      if (job === 'bad') throw new Error('boom')
    })
    const scheduler = createPreviewScheduler({ run, delayMs: 10 })
    scheduler.request('bad')
    await vi.runAllTimersAsync()
    scheduler.request('good')
    await vi.runAllTimersAsync()
    expect(run.mock.calls.map(([job]) => job)).toEqual(['bad', 'good'])
    expect(scheduler.busy()).toBe(false)
  })
})
