import { describe, expect, it } from 'vitest'
import { mergeStorageAssets } from '../storageAssets'

describe('mergeStorageAssets', () => {
  it('uses the Firebase Storage folder as the inventory and defaults discovered files into the web editor', () => {
    expect(mergeStorageAssets([], [
      { name: 'hero.png', url: 'https://storage.test/hero.png' },
    ])).toEqual([
      { name: 'hero.png', url: 'https://storage.test/hero.png', showInEditor: true },
    ])
  })

  it('preserves schema metadata for files that still exist in Firebase Storage', () => {
    expect(mergeStorageAssets(
      [{ name: 'hero.png', url: 'old-url', showInEditor: false }],
      [{ name: 'hero.png', url: 'new-url' }],
    )).toEqual([
      { name: 'hero.png', url: 'new-url', showInEditor: false },
    ])
  })

  it('keeps schema-only assets as a compatibility fallback', () => {
    expect(mergeStorageAssets(
      [{ name: 'legacy.png', url: 'https://example.test/legacy.png', showInEditor: true }],
      [],
    )).toEqual([
      { name: 'legacy.png', url: 'https://example.test/legacy.png', showInEditor: true },
    ])
  })
})
