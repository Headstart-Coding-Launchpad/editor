// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  collection: vi.fn((_db, name) => ({ collection: name })),
  doc: vi.fn((_db, name, id) => ({ path: `${name}/${id}` })),
  getDocs: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIME'),
}))

vi.mock('firebase/firestore', () => fs)
vi.mock('../../shared/firebase', () => ({ firestore: {} }))

import {
  fetchBadgeCatalogue,
  saveCatalogueBadge,
  setCatalogueBadgeArchived,
} from '../catalogueService.js'

beforeEach(() => vi.clearAllMocks())

describe('catalogueService', () => {
  it('lists the catalogue, live badges first', async () => {
    fs.getDocs.mockResolvedValue({
      docs: [
        { id: 'old', data: () => ({ emoji: '🗿', title: 'Old', archived: true }) },
        { id: 'star', data: () => ({ emoji: '🌟', title: 'Star', blurb: 'Shone.' }) },
      ],
    })
    const entries = await fetchBadgeCatalogue()
    expect(fs.collection).toHaveBeenCalledWith({}, 'badgeCatalogue')
    expect(entries.map((e) => [e.id, e.archived])).toEqual([
      ['star', false],
      ['old', true],
    ])
  })

  it('saves a valid badge with who changed it and when', async () => {
    const saved = await saveCatalogueBadge(
      { id: 'star', emoji: ' 🌟', title: 'Star ', blurb: 'Shone.' },
      { catalogue: [], isNew: true, updatedBy: 'admin@x.test' }
    )
    expect(fs.setDoc).toHaveBeenCalledWith(
      { path: 'badgeCatalogue/star' },
      {
        emoji: '🌟',
        title: 'Star',
        blurb: 'Shone.',
        archived: false,
        updatedAt: 'SERVER_TIME',
        updatedBy: 'admin@x.test',
      }
    )
    expect(saved).toMatchObject({ id: 'star', emoji: '🌟', title: 'Star' })
  })

  it('refuses an invalid badge without writing', async () => {
    await expect(
      saveCatalogueBadge(
        { id: 'bug_hunter', emoji: '🐛', title: 'Bug', blurb: 'x' },
        { catalogue: [], isNew: true }
      )
    ).rejects.toMatchObject({ errors: expect.arrayContaining([expect.stringMatching(/built-in/)]) })
    expect(fs.setDoc).not.toHaveBeenCalled()
  })

  it('archives by merging the flag', async () => {
    await setCatalogueBadgeArchived('star', true, { updatedBy: 'a@x.test' })
    expect(fs.setDoc).toHaveBeenCalledWith(
      { path: 'badgeCatalogue/star' },
      { archived: true, updatedAt: 'SERVER_TIME', updatedBy: 'a@x.test' },
      { merge: true }
    )
  })
})
