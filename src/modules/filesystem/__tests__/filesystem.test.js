import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FS,
  createEntry,
  deleteEntry,
  renameEntry,
  moveEntry,
  copyEntry,
  updateFileContent,
  listChildren,
  entryName,
  parentPath,
  normaliseDirPath,
  normaliseFilePath,
} from '../filesystem.js'

// ── path helpers ──────────────────────────────────────────────────────────────

describe('normaliseDirPath', () => {
  it('adds leading slash', () => expect(normaliseDirPath('Documents/')).toBe('/Documents/'))
  it('adds trailing slash', () => expect(normaliseDirPath('/Documents')).toBe('/Documents/'))
  it('leaves root alone', () => expect(normaliseDirPath('/')).toBe('/'))
})

describe('normaliseFilePath', () => {
  it('adds leading slash', () => expect(normaliseFilePath('notes.txt')).toBe('/notes.txt'))
  it('strips trailing slash', () => expect(normaliseFilePath('/notes.txt/')).toBe('/notes.txt'))
})

describe('entryName', () => {
  it('returns directory name', () => expect(entryName('/Documents/')).toBe('Documents'))
  it('returns file name', () => expect(entryName('/Documents/notes.txt')).toBe('notes.txt'))
  it('returns empty for root', () => expect(entryName('/')).toBe(''))
})

describe('parentPath', () => {
  it('returns parent of directory', () => expect(parentPath('/Documents/')).toBe('/'))
  it('returns parent of file', () => expect(parentPath('/Documents/notes.txt')).toBe('/Documents/'))
  it('returns root for top-level dir', () => expect(parentPath('/Documents/')).toBe('/'))
})

// ── listChildren ──────────────────────────────────────────────────────────────

describe('listChildren', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: '' },
    '/Pictures/': { type: 'dir' },
  }

  it('lists root children', () => {
    expect(listChildren(fs, '/')).toEqual(expect.arrayContaining(['/Documents/', '/Pictures/']))
  })

  it('does not include root itself', () => {
    expect(listChildren(fs, '/')).not.toContain('/')
  })

  it('lists directory children', () => {
    expect(listChildren(fs, '/Documents/')).toEqual(['/Documents/notes.txt'])
  })

  it('returns empty for leaf directory', () => {
    expect(listChildren(fs, '/Pictures/')).toEqual([])
  })
})

// ── createEntry ───────────────────────────────────────────────────────────────

describe('createEntry', () => {
  it('creates a directory', () => {
    const fs = createEntry(DEFAULT_FS, '/Documents/', 'dir')
    expect(fs['/Documents/']).toEqual({ type: 'dir' })
  })

  it('creates a file', () => {
    const fs = createEntry(DEFAULT_FS, '/readme.txt', 'file', 'hello')
    expect(fs['/readme.txt']).toEqual({ type: 'file', content: 'hello' })
  })

  it('does not overwrite existing entry', () => {
    const original = { ...DEFAULT_FS, '/Documents/': { type: 'dir' } }
    const after = createEntry(original, '/Documents/', 'dir')
    expect(after).toBe(original)
  })

  it('normalises path for directory', () => {
    const fs = createEntry(DEFAULT_FS, 'Documents', 'dir')
    expect(fs['/Documents/']).toBeDefined()
  })

  it('does not create a case-only-different duplicate of an existing entry', () => {
    const original = { ...DEFAULT_FS, '/Notes.txt': { type: 'file', content: 'hi' } }
    const after = createEntry(original, '/notes.txt', 'file', 'other')
    expect(after).toBe(original)
  })
})

// ── deleteEntry ───────────────────────────────────────────────────────────────

describe('deleteEntry', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: '' },
    '/Documents/sub/': { type: 'dir' },
    '/Documents/sub/file.txt': { type: 'file', content: '' },
  }

  it('deletes a file', () => {
    const after = deleteEntry(fs, '/Documents/notes.txt')
    expect(after['/Documents/notes.txt']).toBeUndefined()
    expect(after['/Documents/']).toBeDefined()
  })

  it('deletes a directory and all descendants', () => {
    const after = deleteEntry(fs, '/Documents/')
    expect(after['/Documents/']).toBeUndefined()
    expect(after['/Documents/notes.txt']).toBeUndefined()
    expect(after['/Documents/sub/']).toBeUndefined()
    expect(after['/Documents/sub/file.txt']).toBeUndefined()
    expect(after['/']).toBeDefined()
  })
})

// ── renameEntry ───────────────────────────────────────────────────────────────

describe('renameEntry', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: 'hi' },
    '/Documents/sub/': { type: 'dir' },
  }

  it('renames a file', () => {
    const after = renameEntry(fs, '/Documents/notes.txt', 'readme.txt')
    expect(after['/Documents/readme.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Documents/notes.txt']).toBeUndefined()
  })

  it('renames a directory and updates descendants', () => {
    const after = renameEntry(fs, '/Documents/', 'Files')
    expect(after['/Files/']).toEqual({ type: 'dir' })
    expect(after['/Files/notes.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Files/sub/']).toEqual({ type: 'dir' })
    expect(after['/Documents/']).toBeUndefined()
  })

  it('returns original fs if new name is empty', () => {
    const after = renameEntry(fs, '/Documents/', '   ')
    expect(after).toBe(fs)
  })

  it('returns original fs if target path already exists', () => {
    const fsWithConflict = { ...fs, '/Pics/': { type: 'dir' } }
    const after = renameEntry(fsWithConflict, '/Documents/', 'Pics')
    expect(after).toBe(fsWithConflict)
  })

  it('refuses a rename that only differs from another entry by case', () => {
    const fsWithConflict = { ...fs, '/Documents/readme.txt': { type: 'file', content: '' } }
    const after = renameEntry(fsWithConflict, '/Documents/notes.txt', 'README.txt')
    expect(after).toBe(fsWithConflict)
  })

  it('allows a pure case-only rename of an entry to itself', () => {
    const after = renameEntry(fs, '/Documents/notes.txt', 'NOTES.txt')
    expect(after['/Documents/NOTES.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Documents/notes.txt']).toBeUndefined()
  })
})

// ── moveEntry ─────────────────────────────────────────────────────────────────

describe('moveEntry', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: 'hi' },
    '/Archive/': { type: 'dir' },
  }

  it('moves a file', () => {
    const after = moveEntry(fs, '/Documents/notes.txt', '/Archive/')
    expect(after['/Archive/notes.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Documents/notes.txt']).toBeUndefined()
  })

  it('moves a directory', () => {
    const after = moveEntry(fs, '/Documents/', '/Archive/')
    expect(after['/Archive/Documents/']).toBeDefined()
    expect(after['/Archive/Documents/notes.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Documents/']).toBeUndefined()
  })

  it('does not move into self', () => {
    const after = moveEntry(fs, '/Documents/', '/Documents/')
    expect(after).toBe(fs)
  })

  it('returns original if destination does not exist', () => {
    const after = moveEntry(fs, '/Documents/notes.txt', '/Nonexistent/')
    expect(after).toBe(fs)
  })

  it('refuses a move that only differs from an existing entry in the destination by case', () => {
    const fsWithConflict = { ...fs, '/Archive/NOTES.txt': { type: 'file', content: '' } }
    const after = moveEntry(fsWithConflict, '/Documents/notes.txt', '/Archive/')
    expect(after).toBe(fsWithConflict)
  })
})

// ── copyEntry ─────────────────────────────────────────────────────────────────

describe('copyEntry', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: 'hi' },
    '/Archive/': { type: 'dir' },
  }

  it('copies a file, leaving the source in place', () => {
    const after = copyEntry(fs, '/Documents/notes.txt', '/Archive/')
    expect(after['/Archive/notes.txt']).toEqual({ type: 'file', content: 'hi' })
    expect(after['/Documents/notes.txt']).toEqual({ type: 'file', content: 'hi' })
  })

  it('refuses a copy that only differs from an existing entry in the destination by case', () => {
    const fsWithConflict = { ...fs, '/Archive/NOTES.txt': { type: 'file', content: '' } }
    const after = copyEntry(fsWithConflict, '/Documents/notes.txt', '/Archive/')
    expect(after).toBe(fsWithConflict)
  })
})

// ── updateFileContent ─────────────────────────────────────────────────────────

describe('updateFileContent', () => {
  it('updates content of existing file', () => {
    const fs = { '/': { type: 'dir' }, '/readme.txt': { type: 'file', content: 'old' } }
    const after = updateFileContent(fs, '/readme.txt', 'new content')
    expect(after['/readme.txt'].content).toBe('new content')
  })

  it('returns original if path is a directory', () => {
    const fs = { '/': { type: 'dir' }, '/Documents/': { type: 'dir' } }
    const after = updateFileContent(fs, '/Documents/', 'oops')
    expect(after).toBe(fs)
  })
})
