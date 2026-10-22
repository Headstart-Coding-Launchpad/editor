// @vitest-environment node
// Handoff #92: failed live-scrub releases are not attempts for the badge engine.
import { describe, expect, it } from 'vitest'
import { buildLiveTimelines } from '../liveTimeline.js'

const LESSON = {
  id: 'l',
  type: 'python',
  title: 'L',
  tasks: [{ id: 4, title: 'Count up', taskActivity: 'Code Task' }],
}

function row(code, at, extra = {}) {
  return {
    submission: code,
    passed: false,
    suggestion: null,
    attemptNumber: 1,
    retries: 0,
    loggedAt: at,
    ...extra,
  }
}

describe('failed scrub releases in the badge timeline', () => {
  it('are not attempts, first tries or errors; a passing release is the pass', () => {
    const session = {
      state: 'active',
      currentTaskId: 4,
      students: { alex: { displayName: 'alex', joinedAt: 1, online: true } },
      attemptLog: {
        alex: {
          4: {
            n1: row('x = 1', 100, { source: 'scrub', error: 'NameError' }),
            n2: row('x = 3', 150),
            n3: row('x = 2', 200, { source: 'scrub', passed: true, passedAt: 200 }),
          },
        },
      },
    }
    const timeline = buildLiveTimelines({ session, lesson: LESSON, topics: [] }).alex
    const attempts = timeline.filter((event) => event.type === 'attempt')
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toMatchObject({ passed: false, firstTry: true, error: false })
    expect(attempts[1]).toMatchObject({ passed: true, firstTry: false })
  })
})
