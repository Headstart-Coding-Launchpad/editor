// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareAttemptEntries } from '../attemptOrder.js'

describe('compareAttemptEntries', () => {
  it('orders by loggedAt first, so a reload that restarts attemptNumber cannot reorder attempts', () => {
    const entries = [
      { attemptNumber: 1, loggedAt: 1300 }, // after a reload the number restarted at 1
      { attemptNumber: 2, loggedAt: 1200 },
      { attemptNumber: 1, loggedAt: 1100 },
    ]
    expect([...entries].sort(compareAttemptEntries).map((e) => e.loggedAt)).toEqual([
      1100, 1200, 1300,
    ])
  })

  it('breaks ties by attemptNumber and puts entries with no time last', () => {
    const entries = [
      { attemptNumber: 2, loggedAt: 1000 },
      { attemptNumber: 3 },
      { attemptNumber: 1, loggedAt: 1000 },
      { attemptNumber: 1 },
    ]
    expect([...entries].sort(compareAttemptEntries)).toEqual([
      { attemptNumber: 1, loggedAt: 1000 },
      { attemptNumber: 2, loggedAt: 1000 },
      { attemptNumber: 1 },
      { attemptNumber: 3 },
    ])
  })
})
