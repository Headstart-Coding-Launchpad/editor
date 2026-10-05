// The Admin badge catalogue: save validation, and the display snapshot a catalogue award carries
// so students (who can't read Firestore `badgeCatalogue`) see the real emoji, title and blurb.
import { describe, expect, it } from 'vitest'
import {
  catalogueBadgeSnapshot,
  emojiKey,
  makeCatalogueId,
  normaliseCatalogueRecord,
  sortCatalogue,
  validateCatalogueBadge,
} from '../catalogue.js'
import { normaliseCatalogueBadge, resolveBadge } from '../badgeDisplay.js'
import { listMyMoments, mergeClassToasts } from '../celebration.js'
import { buildClassWall, rosterNameFor } from '../badgeSummary.js'

const STAR = { id: 'star_speaker', emoji: '🎺', title: 'Star Speaker', blurb: 'Presented well.' }

describe('validateCatalogueBadge', () => {
  it('accepts a complete, unique badge', () => {
    expect(validateCatalogueBadge(STAR, { catalogue: [] })).toEqual([])
  })

  it('refuses a registry id, a taken id and a bad id', () => {
    const errs = (id, extra = {}) => validateCatalogueBadge({ ...STAR, id }, extra)
    expect(errs('bug_hunter')[0]).toMatch(/built-in badge id/)
    expect(errs('star_speaker', { catalogue: [{ ...STAR, emoji: '🎙' }] })[0]).toMatch(
      /already uses the id/
    )
    expect(errs('Star-Speaker')[0]).toMatch(/lowercase letters/)
    expect(errs('')[0]).toBe('Add an id.')
  })

  it('lets an edit keep its own id and emoji', () => {
    expect(validateCatalogueBadge(STAR, { catalogue: [STAR], isNew: false })).toEqual([])
  })

  it('keeps emoji unique across the registry and the catalogue, archived ones included', () => {
    expect(validateCatalogueBadge({ ...STAR, emoji: '🐛' })).toContain(
      '🐛 is already the Bug Hunter badge.'
    )
    // A variation selector doesn't make a different emoji.
    expect(validateCatalogueBadge({ ...STAR, emoji: '⌨' })[0]).toMatch(/Keyboard Wizard/)
    const archived = { id: 'old', emoji: '🎺', title: 'Old Mic', archived: true }
    expect(validateCatalogueBadge(STAR, { catalogue: [archived] })).toContain(
      '🎺 is already the Old Mic badge.'
    )
  })

  it('requires an emoji, a title and a blurb within their limits', () => {
    const errors = validateCatalogueBadge({ id: 'x_badge', emoji: '', title: '', blurb: '' })
    expect(errors).toEqual(['Add an emoji.', 'Add a title.', expect.stringMatching(/blurb/)])
    expect(validateCatalogueBadge({ ...STAR, title: 'x'.repeat(41) })[0]).toMatch(/40 characters/)
    expect(validateCatalogueBadge({ ...STAR, emoji: 'two words' })[0]).toMatch(/single emoji/)
  })
})

describe('catalogue helpers', () => {
  it('derives an id from a title', () => {
    expect(makeCatalogueId('Great Teamwork!')).toBe('great_teamwork')
    expect(makeCatalogueId('  42 Brave Coders ')).toBe('brave_coders')
  })

  it('compares emoji without variation selectors', () => {
    expect(emojiKey('⌨️')).toBe(emojiKey('⌨'))
  })

  it('normalises a Firestore record and sorts archived badges last', () => {
    const record = normaliseCatalogueRecord('b', { emoji: ' 🌈 ', title: 'B', archived: 1 })
    expect(record).toMatchObject({ id: 'b', emoji: '🌈', title: 'B', blurb: '', archived: true })
    const sorted = sortCatalogue([record, { id: 'z', title: 'Z' }, { id: 'a', title: 'A' }])
    expect(sorted.map((e) => e.id)).toEqual(['a', 'z', 'b'])
  })

  it('snapshots only catalogue badges', () => {
    expect(catalogueBadgeSnapshot(normaliseCatalogueBadge(STAR))).toEqual({
      emoji: '🎺',
      title: 'Star Speaker',
      blurb: 'Presented well.',
    })
    expect(catalogueBadgeSnapshot(resolveBadge('bug_hunter'))).toBeNull()
  })
})

describe('a catalogue award seen by students (no catalogue access)', () => {
  const decision = {
    status: 'awarded',
    source: 'manual',
    announce: true,
    decidedAt: 5,
    badge: { emoji: '🎺', title: 'Star Speaker', blurb: 'Presented well.' },
  }
  const decisions = { alex: { star_speaker: decision } }

  it('resolves from the decision snapshot', () => {
    expect(resolveBadge('star_speaker', [], decision)).toMatchObject({
      emoji: '🎺',
      title: 'Star Speaker',
      blurb: 'Presented well.',
      catalogue: true,
    })
    // The live catalogue wins when the viewer has it (the tutor).
    expect(resolveBadge('star_speaker', [{ ...STAR, title: 'Renamed' }], decision).title).toBe(
      'Renamed'
    )
    expect(resolveBadge('star_speaker').title).toBe('star_speaker')
  })

  it("feeds the recipient's moments (card, pill and sticker sheet)", () => {
    const [moment] = listMyMoments(decisions, 'alex')
    expect(moment.badge).toMatchObject({ emoji: '🎺', title: 'Star Speaker' })
  })

  it('carries the snapshot on the class toast', () => {
    const [toast] = mergeClassToasts(
      [],
      [{ key: 'k', studentId: 'alex', badgeId: 'star_speaker', decision }],
      { viewerId: 'sam', students: { alex: { displayName: 'Alex' } } }
    )
    expect(toast.badge).toEqual(decision.badge)
    expect(resolveBadge(toast.badgeId, [], { badge: toast.badge }).title).toBe('Star Speaker')
  })

  it('names the badge on the Badge Summary class wall', () => {
    const wall = buildClassWall(decisions, {
      nameFor: rosterNameFor({ alex: { displayName: 'Alex' } }),
    })
    expect(wall).toEqual([
      expect.objectContaining({
        badgeId: 'star_speaker',
        badge: expect.objectContaining({ emoji: '🎺', title: 'Star Speaker' }),
        names: ['Alex'],
      }),
    ])
  })
})
