import { describe, expect, it } from 'vitest'
import {
  SHOW_IT_MAX,
  clampShowItIndex,
  defaultShowItView,
  getShowIt,
  getShowItBuilds,
  normalizeShowItIds,
  showItDisabledReason,
} from '../showIt.js'

describe('showIt helpers', () => {
  it('keeps at most three unique ids', () => {
    expect(SHOW_IT_MAX).toBe(3)
    expect(normalizeShowItIds(['a', 'a', 'b', '', 7, 'c', 'd'])).toEqual(['a', 'b', 'c'])
    expect(normalizeShowItIds(null)).toEqual([])
  })

  it('reads the node, or null when nothing is shown', () => {
    expect(getShowIt({})).toBeNull()
    expect(getShowIt({ showIt: { studentIds: [], taskId: 1 } })).toBeNull()
    expect(getShowIt({ showIt: { studentIds: ['a'], taskId: 4, startedAt: 9 } })).toEqual({
      studentIds: ['a'],
      taskId: '4',
      startedAt: 9,
      view: null,
      index: 0,
    })
    expect(
      getShowIt({ showIt: { studentIds: ['a'], taskId: 4, view: 'single', index: 2 } })
    ).toMatchObject({ view: 'single', index: 2 })
    expect(
      getShowIt({ showIt: { studentIds: ['a'], taskId: 4, view: 'grid', index: -1 } })
    ).toMatchObject({
      view: null,
      index: 0,
    })
  })

  it('labels builds by position and drops students who left', () => {
    const session = {
      showIt: { studentIds: ['a', 'gone', 'b'], taskId: 1, startedAt: 1 },
      students: { a: { displayName: 'Ann' }, b: { displayName: 'Bo' } },
    }
    const builds = getShowItBuilds(session)
    expect(builds.map((b) => b.label)).toEqual(['Build 1', 'Build 2'])
    expect(builds[1].student.anonymousId).toBe('b')
  })

  it('explains why it is unavailable with no students', () => {
    expect(showItDisabledReason(0)).toMatch(/no students/i)
    expect(showItDisabledReason(2)).toBeNull()
  })
})

describe('Show it view', () => {
  it('opens one at a time only for an activity that says its view is big', () => {
    expect(defaultShowItView({ id: 1, taskType: 'activity', activityType: 'binary' })).toBe('side')
    expect(defaultShowItView({ id: 2 })).toBe('side')
  })

  it('keeps the index inside the builds that exist', () => {
    expect(clampShowItIndex(5, 2)).toBe(1)
    expect(clampShowItIndex(-1, 3)).toBe(0)
    expect(clampShowItIndex(undefined, 3)).toBe(0)
    expect(clampShowItIndex(1, 0)).toBe(0)
  })
})
