// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  CLASS_TOAST_QUEUE_CAP,
  awardKey,
  classToastLabel,
  collectAwardKeys,
  findNewAwards,
  isStillAwarded,
  listMyMoments,
  mergeClassToasts,
} from '../celebration.js'
import { resolveBadge } from '../badgeDisplay.js'

const award = (overrides = {}) => ({
  status: 'awarded',
  source: 'manual',
  reason: null,
  taskId: 1,
  announce: true,
  bulkId: null,
  decidedAt: 100,
  ...overrides,
})

const STUDENTS = {
  alex: { displayName: 'Alex' },
  sam: { displayName: 'Sam' },
  kim: { displayName: 'Kim' },
}

describe('award keys and the load baseline', () => {
  it('only counts awarded decisions, and a re-award after a revoke is a new award', () => {
    const decisions = {
      alex: { bug_hunter: award(), code_fixer: award({ status: 'dismissed' }) },
      sam: { persistence: award({ status: 'revoked' }) },
    }
    const baseline = collectAwardKeys(decisions)
    expect([...baseline]).toEqual([awardKey('alex', 'bug_hunter', decisions.alex.bug_hunter)])
    expect(findNewAwards(decisions, baseline)).toEqual([])

    const later = {
      ...decisions,
      sam: { persistence: award({ decidedAt: 300 }) },
      kim: { bug_hunter: award({ decidedAt: 200 }) },
    }
    expect(findNewAwards(later, baseline).map((a) => a.studentId)).toEqual(['kim', 'sam'])
  })

  it('drops a queued card once its award is revoked', () => {
    const decisions = { alex: { bug_hunter: award() } }
    const [queued] = findNewAwards(decisions, new Set())
    expect(isStillAwarded(decisions, queued)).toBe(true)
    expect(isStillAwarded({ alex: { bug_hunter: award({ status: 'revoked' }) } }, queued)).toBe(
      false
    )
  })
})

describe('listMyMoments', () => {
  it("lists only the student's own awarded badges, oldest first, resolved for display", () => {
    const decisions = {
      alex: {
        keyboard_wizard: award({ decidedAt: 300 }),
        bug_hunter: award({ decidedAt: 100 }),
        code_fixer: award({ status: 'revoked' }),
      },
      sam: { persistence: award() },
    }
    const moments = listMyMoments(decisions, 'alex')
    expect(moments.map((m) => m.badgeId)).toEqual(['bug_hunter', 'keyboard_wizard'])
    expect(moments[0].badge).toBe(resolveBadge('bug_hunter'))
    expect(listMyMoments(decisions, null)).toEqual([])
  })
})

describe('mergeClassToasts', () => {
  const fresh = (decisions) => findNewAwards(decisions, new Set())

  it("toasts a classmate's award but never the viewer's own", () => {
    const queue = mergeClassToasts(
      [],
      fresh({ alex: { bug_hunter: award() }, sam: { code_fixer: award({ decidedAt: 200 }) } }),
      { viewerId: 'alex', students: STUDENTS }
    )
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ badgeId: 'code_fixer', names: ['Sam'] })
    const fixer = resolveBadge('code_fixer')
    expect(classToastLabel(queue[0], fixer)).toBe(`Sam earned a badge: ${fixer.emoji} Code Fixer`)
  })

  it('suppresses the toast when the tutor unticked announce', () => {
    const queue = mergeClassToasts([], fresh({ sam: { bug_hunter: award({ announce: false }) } }), {
      viewerId: 'alex',
      students: STUDENTS,
    })
    expect(queue).toEqual([])
  })

  it('merges a bulk award into one toast, even across snapshots', () => {
    const bulk = { bulkId: 'bulk-kw', badge: 'keyboard_wizard' }
    let queue = mergeClassToasts(
      [],
      fresh({ sam: { [bulk.badge]: award({ bulkId: bulk.bulkId }) } }),
      { viewerId: null, students: STUDENTS }
    )
    queue = mergeClassToasts(
      queue,
      fresh({
        kim: { [bulk.badge]: award({ bulkId: bulk.bulkId, decidedAt: 101 }) },
        alex: { [bulk.badge]: award({ bulkId: bulk.bulkId, decidedAt: 102 }) },
      }),
      { viewerId: null, students: STUDENTS }
    )
    expect(queue).toHaveLength(1)
    expect(queue[0].recipientIds).toEqual(['sam', 'kim', 'alex'])
    const wizard = resolveBadge(bulk.badge)
    expect(classToastLabel(queue[0], wizard)).toBe(
      `3 students earned a badge: ${wizard.emoji} Keyboard Wizard`
    )
  })

  it('gives a bulk recipient no toast for that bulk (they get the card)', () => {
    const finishedBulkIds = new Set()
    let queue = mergeClassToasts([], fresh({ sam: { bug_hunter: award({ bulkId: 'b1' }) } }), {
      viewerId: 'alex',
      students: STUDENTS,
      finishedBulkIds,
    })
    expect(queue).toHaveLength(1)
    queue = mergeClassToasts(
      queue,
      fresh({ alex: { bug_hunter: award({ bulkId: 'b1', decidedAt: 101 }) } }),
      { viewerId: 'alex', students: STUDENTS, finishedBulkIds }
    )
    expect(queue).toEqual([])
    expect(finishedBulkIds.has('b1')).toBe(true)
  })

  it('does not toast a bulk again once its toast has finished', () => {
    const queue = mergeClassToasts(
      [],
      fresh({ kim: { bug_hunter: award({ bulkId: 'b1', decidedAt: 500 }) } }),
      { viewerId: 'alex', students: STUDENTS, finishedBulkIds: new Set(['b1']) }
    )
    expect(queue).toEqual([])
  })

  it('drops new toasts once the queue is full', () => {
    const decisions = {}
    for (let i = 0; i < CLASS_TOAST_QUEUE_CAP + 3; i++) {
      decisions[`s${i}`] = { bug_hunter: award({ decidedAt: i }) }
    }
    const queue = mergeClassToasts([], fresh(decisions), { viewerId: 'alex', students: {} })
    expect(queue).toHaveLength(CLASS_TOAST_QUEUE_CAP)
    expect(queue.map((t) => t.recipientIds[0])).toEqual(['s0', 's1', 's2', 's3', 's4'])
    expect(queue[0].names).toEqual(['A coder'])
  })
})
