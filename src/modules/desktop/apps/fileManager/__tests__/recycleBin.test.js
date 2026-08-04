import { describe, it, expect } from 'vitest'
import { softDeleteEntry, restoreEntry, purgeEntry, isInRecycleBin } from '../recycleBin.js'

const BASE_FS = {
  '/': { type: 'dir' },
  '/Documents/': { type: 'dir' },
  '/Documents/notes.txt': { type: 'file', content: 'hello' },
}

describe('recycleBin', () => {
  it('softDeleteEntry removes a file from fs and records it in the recycle bin', () => {
    const { fs, recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/notes.txt')
    expect(fs['/Documents/notes.txt']).toBeUndefined()
    expect(recycleBin).toHaveLength(1)
    expect(recycleBin[0].path).toBe('/Documents/notes.txt')
    expect(isInRecycleBin(recycleBin, '/Documents/notes.txt')).toBe(true)
  })

  it('softDeleteEntry removes a folder and all of its descendants', () => {
    const { fs, recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/')
    expect(fs['/Documents/']).toBeUndefined()
    expect(fs['/Documents/notes.txt']).toBeUndefined()
    expect(Object.keys(recycleBin[0].entries)).toEqual(
      expect.arrayContaining(['/Documents/', '/Documents/notes.txt'])
    )
  })

  it('is a no-op when the path does not exist', () => {
    const result = softDeleteEntry(BASE_FS, [], '/missing.txt')
    expect(result.fs).toBe(BASE_FS)
    expect(result.recycleBin).toEqual([])
  })

  it('restoreEntry puts a file back at its original location', () => {
    const { fs, recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/notes.txt')
    const restored = restoreEntry(fs, recycleBin, '/Documents/notes.txt')
    expect(restored.fs['/Documents/notes.txt']).toEqual({ type: 'file', content: 'hello' })
    expect(restored.recycleBin).toHaveLength(0)
  })

  it('restoreEntry renames on conflict instead of clobbering a newer item at the same path', () => {
    const { fs, recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/notes.txt')
    // A new file now occupies the original path.
    const fsWithConflict = { ...fs, '/Documents/notes.txt': { type: 'file', content: 'newer' } }
    const restored = restoreEntry(fsWithConflict, recycleBin, '/Documents/notes.txt')
    expect(restored.fs['/Documents/notes.txt']).toEqual({ type: 'file', content: 'newer' })
    expect(restored.fs['/Documents/notes.txt (restored)']).toEqual({ type: 'file', content: 'hello' })
    expect(restored.recycleBin).toHaveLength(0)
  })

  it('restoreEntry restores a folder with its descendants intact', () => {
    const { fs, recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/')
    const restored = restoreEntry(fs, recycleBin, '/Documents/')
    expect(restored.fs['/Documents/']).toEqual({ type: 'dir' })
    expect(restored.fs['/Documents/notes.txt']).toEqual({ type: 'file', content: 'hello' })
  })

  it('purgeEntry removes an item without restoring it', () => {
    const { recycleBin } = softDeleteEntry(BASE_FS, [], '/Documents/notes.txt')
    expect(purgeEntry(recycleBin, '/Documents/notes.txt')).toEqual([])
  })
})
