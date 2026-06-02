import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FS,
  createEntry,
  deleteEntry,
  renameEntry,
  moveEntry,
  updateFileContent,
  listChildren,
  entryName,
  parentPath,
  normaliseDirPath,
  normaliseFilePath,
  evaluateFsCheck,
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

// ── evaluateFsCheck ───────────────────────────────────────────────────────────

describe('evaluateFsCheck', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: 'Hello World' },
    '/Pictures/': { type: 'dir' },
  }

  describe('fs_file_exists', () => {
    it('passes when file exists', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/notes.txt' }, fs)).toBe(true)
    })
    it('fails when file does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/missing.txt' }, fs)).toBe(false)
    })
    it('fails for a directory path', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/' }, fs)).toBe(false)
    })
  })

  describe('fs_dir_exists', () => {
    it('passes when directory exists', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/Documents/' }, fs)).toBe(true)
    })
    it('fails when directory does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/Projects/' }, fs)).toBe(false)
    })
    it('normalises path without trailing slash', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/Documents' }, fs)).toBe(true)
    })
  })

  describe('fs_not_exists', () => {
    it('passes when path does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Deleted/' }, fs)).toBe(true)
    })
    it('fails when path exists as dir', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Documents/' }, fs)).toBe(false)
    })
    it('fails when path exists as file', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Documents/notes.txt' }, fs)).toBe(false)
    })
  })

  describe('fs_content_contains', () => {
    it('passes when content contains value (case-insensitive)', () => {
      expect(evaluateFsCheck({ type: 'fs_content_contains', path: '/Documents/notes.txt', value: 'hello' }, fs)).toBe(true)
    })
    it('fails when content does not contain value', () => {
      expect(evaluateFsCheck({ type: 'fs_content_contains', path: '/Documents/notes.txt', value: 'goodbye' }, fs)).toBe(false)
    })
    it('fails for nonexistent file', () => {
      expect(evaluateFsCheck({ type: 'fs_content_contains', path: '/missing.txt', value: 'x' }, fs)).toBe(false)
    })
  })

  describe('fs_content_equals', () => {
    it('passes on exact match (trimmed, case-insensitive)', () => {
      expect(evaluateFsCheck({ type: 'fs_content_equals', path: '/Documents/notes.txt', value: 'hello world' }, fs)).toBe(true)
    })
    it('fails when content does not match', () => {
      expect(evaluateFsCheck({ type: 'fs_content_equals', path: '/Documents/notes.txt', value: 'hello' }, fs)).toBe(false)
    })
  })

  describe('fs_file_in_dir', () => {
    it('passes when file is in the specified dir', () => {
      expect(evaluateFsCheck({ type: 'fs_file_in_dir', path: '/Documents/notes.txt', dir: '/Documents/' }, fs)).toBe(true)
    })
    it('fails when file is in a different dir', () => {
      expect(evaluateFsCheck({ type: 'fs_file_in_dir', path: '/Documents/notes.txt', dir: '/Pictures/' }, fs)).toBe(false)
    })
    it('fails when file does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_file_in_dir', path: '/missing.txt', dir: '/' }, fs)).toBe(false)
    })
  })

  describe('fs_dir_opened', () => {
    it('passes when the student navigated to the expected folder', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_opened', path: '/Documents/' }, fs, { currentDir: '/Documents/' })).toBe(true)
    })
    it('fails when the student is viewing a different folder', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_opened', path: '/Documents/' }, fs, { currentDir: '/Pictures/' })).toBe(false)
    })
  })

  describe('fs_file_opened', () => {
    it('passes when the student opened the expected file', () => {
      expect(evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/notes.txt' }, fs, { openFile: '/Documents/notes.txt' })).toBe(true)
    })
    it('fails when the student opened a different file', () => {
      expect(evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/notes.txt' }, fs, { openFile: '/Documents/other.txt' })).toBe(false)
    })
  })

  it('returns false for null fs', () => {
    expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/x.txt' }, null)).toBe(false)
  })

  it('returns false for unknown type', () => {
    expect(evaluateFsCheck({ type: 'fs_unknown', path: '/' }, fs)).toBe(false)
  })
})
