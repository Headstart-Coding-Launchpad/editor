import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'

describe('createThrottledMirrorWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the first value immediately', () => {
    const write = vi.fn()
    const writer = createThrottledMirrorWriter({ write })
    writer.push('a')
    expect(write).toHaveBeenCalledWith('a')
  })

  it('writes the tail of a burst once the cooldown ends (trailing edge)', () => {
    const write = vi.fn()
    const writer = createThrottledMirrorWriter({ write })
    writer.push('a')
    vi.advanceTimersByTime(50)
    writer.push('ab')
    writer.push('abc')
    expect(write).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(150)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith('abc')
  })

  it('never writes more than once per interval during a sustained stream', () => {
    const write = vi.fn()
    const writer = createThrottledMirrorWriter({ write })
    for (let i = 0; i < 100; i += 1) {
      writer.push(`v${i}`)
      vi.advanceTimersByTime(10)
    }
    vi.advanceTimersByTime(200)
    expect(write.mock.calls.length).toBeLessThanOrEqual(7)
    expect(write).toHaveBeenLastCalledWith('v99')
  })

  it('flush writes a waiting value straight away', () => {
    const write = vi.fn()
    const writer = createThrottledMirrorWriter({ write })
    writer.push('a')
    writer.push('ab')
    writer.flush()
    expect(write).toHaveBeenLastCalledWith('ab')
    vi.advanceTimersByTime(500)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('cancel and markWritten drop a waiting value', () => {
    const write = vi.fn()
    const writer = createThrottledMirrorWriter({ write })
    writer.push('a')
    writer.push('ab')
    writer.cancel()
    vi.advanceTimersByTime(500)
    expect(write).toHaveBeenCalledTimes(1)

    writer.push('abc')
    expect(write).toHaveBeenCalledTimes(2)
    writer.push('abcd')
    writer.markWritten()
    vi.advanceTimersByTime(500)
    expect(write).toHaveBeenCalledTimes(2)
  })
})
