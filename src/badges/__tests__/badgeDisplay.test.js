import { describe, it, expect } from 'vitest'
import {
  createBadgeBulkId,
  heldBadgeIds,
  listAwardableBadges,
  normaliseCatalogueBadge,
  resolveBadge,
} from '../badgeDisplay.js'
import { getBadgeDefinitions } from '../registry.pure.js'

describe('badgeDisplay', () => {
  it('resolves registry, catalogue and unknown badges', () => {
    expect(resolveBadge('bug_hunter').title).toBe('Bug Hunter')
    const catalogue = [{ id: 'star', emoji: '⭐', title: 'Star', archived: true }]
    expect(resolveBadge('star', catalogue)).toMatchObject({ emoji: '⭐', catalogue: true })
    expect(resolveBadge('gone')).toMatchObject({ emoji: '🏅', title: 'gone' })
  })

  it('never lets a catalogue entry shadow a registry badge', () => {
    expect(normaliseCatalogueBadge({ id: 'bug_hunter', emoji: '🦋', title: 'Fake' })).toBeNull()
    expect(resolveBadge('bug_hunter', [{ id: 'bug_hunter', title: 'Fake' }]).title).toBe(
      'Bug Hunter'
    )
  })

  it('lists every registry badge then the live catalogue', () => {
    const list = listAwardableBadges([
      { id: 'star', emoji: '⭐', title: 'Star' },
      { id: 'old', emoji: '🗿', title: 'Old', archived: true },
    ])
    const registryIds = getBadgeDefinitions().map((badge) => badge.id)
    expect(list.map((badge) => badge.id)).toEqual([...registryIds, 'star'])
  })

  it('counts only awarded decisions as held', () => {
    const decisions = {
      s1: {
        bug_hunter: { status: 'awarded' },
        code_fixer: { status: 'revoked' },
        persistence: { status: 'dismissed' },
      },
    }
    expect(heldBadgeIds(decisions, 's1')).toEqual(['bug_hunter'])
    expect(heldBadgeIds(decisions, 's2')).toEqual([])
  })

  it('makes distinct bulk ids', () => {
    const a = createBadgeBulkId('bug_hunter')
    const b = createBadgeBulkId('bug_hunter')
    expect(a).toMatch(/^bulk-bug_hunter-/)
    expect(a).not.toBe(b)
  })
})
