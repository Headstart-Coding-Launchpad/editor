import { describe, it, expect } from 'vitest'
import { evaluateFsCheck } from '../checks.js'

describe('evaluateFsCheck', () => {
  const fs = {
    '/': { type: 'dir' },
    '/Documents/': { type: 'dir' },
    '/Documents/notes.txt': { type: 'file', content: 'Hello World' },
    '/Pictures/': { type: 'dir' },
  }

  describe('fs_file_exists', () => {
    it('passes when file exists', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/notes.txt' }, fs)).toBe(
        true
      )
    })
    it('fails when file does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/missing.txt' }, fs)).toBe(
        false
      )
    })
    it('fails for a directory path', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/' }, fs)).toBe(false)
    })
    it('passes with different casing (case-insensitive)', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/documents/NOTES.TXT' }, fs)).toBe(
        true
      )
    })
    it('passes with * wildcard matching filename', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/*.txt' }, fs)).toBe(true)
    })
    it('passes with * wildcard matching any file in dir', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/*' }, fs)).toBe(true)
    })
    it('passes with ** wildcard matching across dirs', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/**/*.txt' }, fs)).toBe(true)
    })
    it('passes with ? wildcard matching single char', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/notes.tx?' }, fs)).toBe(
        true
      )
    })
    it('fails when wildcard matches no file', () => {
      expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/Documents/*.py' }, fs)).toBe(false)
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
    it('passes with different casing (case-insensitive)', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/DOCUMENTS/' }, fs)).toBe(true)
    })
    it('passes with * wildcard matching dir name', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/Doc*/' }, fs)).toBe(true)
    })
    it('fails when wildcard matches no directory', () => {
      expect(evaluateFsCheck({ type: 'fs_dir_exists', path: '/Pro*/' }, fs)).toBe(false)
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
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Documents/notes.txt' }, fs)).toBe(
        false
      )
    })
    it('fails when path exists with different casing (case-insensitive)', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/DOCUMENTS/' }, fs)).toBe(false)
    })
    it('fails when wildcard matches an existing file', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Documents/*.txt' }, fs)).toBe(false)
    })
    it('passes when wildcard matches nothing', () => {
      expect(evaluateFsCheck({ type: 'fs_not_exists', path: '/Documents/*.py' }, fs)).toBe(true)
    })
  })

  describe('fs_content_contains', () => {
    it('passes when content contains value (case-insensitive)', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_content_contains', path: '/Documents/notes.txt', value: 'hello' },
          fs
        )
      ).toBe(true)
    })
    it('fails when content does not contain value', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_content_contains', path: '/Documents/notes.txt', value: 'goodbye' },
          fs
        )
      ).toBe(false)
    })
    it('fails for nonexistent file', () => {
      expect(
        evaluateFsCheck({ type: 'fs_content_contains', path: '/missing.txt', value: 'x' }, fs)
      ).toBe(false)
    })
    it('matches across Windows line endings (CRLF in content, LF in value)', () => {
      const winFs = { '/f.txt': { type: 'file', content: 'Hello\r\nWorld' } }
      expect(
        evaluateFsCheck(
          { type: 'fs_content_contains', path: '/f.txt', value: 'hello\nworld' },
          winFs
        )
      ).toBe(true)
    })
  })

  describe('fs_content_equals', () => {
    it('passes on exact match (trimmed, case-insensitive)', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_content_equals', path: '/Documents/notes.txt', value: 'hello world' },
          fs
        )
      ).toBe(true)
    })
    it('fails when content does not match', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_content_equals', path: '/Documents/notes.txt', value: 'hello' },
          fs
        )
      ).toBe(false)
    })
    it('matches across Windows line endings (CRLF in content, LF in value)', () => {
      const winFs = { '/f.txt': { type: 'file', content: 'Hello\r\nWorld' } }
      expect(
        evaluateFsCheck({ type: 'fs_content_equals', path: '/f.txt', value: 'hello\nworld' }, winFs)
      ).toBe(true)
    })
  })

  describe('fs_file_in_dir', () => {
    it('passes when file is in the specified dir', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_file_in_dir', path: '/Documents/notes.txt', dir: '/Documents/' },
          fs
        )
      ).toBe(true)
    })
    it('fails when file is in a different dir', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_file_in_dir', path: '/Documents/notes.txt', dir: '/Pictures/' },
          fs
        )
      ).toBe(false)
    })
    it('fails when file does not exist', () => {
      expect(evaluateFsCheck({ type: 'fs_file_in_dir', path: '/missing.txt', dir: '/' }, fs)).toBe(
        false
      )
    })
    it('passes with different casing on path and dir (case-insensitive)', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_file_in_dir', path: '/DOCUMENTS/notes.txt', dir: '/documents/' },
          fs
        )
      ).toBe(true)
    })
  })

  describe('fs_dir_opened', () => {
    it('passes when the student navigated to the expected folder', () => {
      expect(
        evaluateFsCheck({ type: 'fs_dir_opened', path: '/Documents/' }, fs, {
          currentDir: '/Documents/',
        })
      ).toBe(true)
    })
    it('fails when the student is viewing a different folder', () => {
      expect(
        evaluateFsCheck({ type: 'fs_dir_opened', path: '/Documents/' }, fs, {
          currentDir: '/Pictures/',
        })
      ).toBe(false)
    })
    it('passes when casing differs (case-insensitive)', () => {
      expect(
        evaluateFsCheck({ type: 'fs_dir_opened', path: '/documents/' }, fs, {
          currentDir: '/Documents/',
        })
      ).toBe(true)
    })
    it('passes when wildcard matches the current dir', () => {
      expect(
        evaluateFsCheck({ type: 'fs_dir_opened', path: '/Doc*/' }, fs, {
          currentDir: '/Documents/',
        })
      ).toBe(true)
    })
    it('fails when wildcard does not match the current dir', () => {
      expect(
        evaluateFsCheck({ type: 'fs_dir_opened', path: '/Pro*/' }, fs, {
          currentDir: '/Documents/',
        })
      ).toBe(false)
    })
  })

  describe('fs_file_opened', () => {
    it('passes when the student opened the expected file', () => {
      expect(
        evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/notes.txt' }, fs, {
          openFile: '/Documents/notes.txt',
        })
      ).toBe(true)
    })
    it('fails when the student opened a different file', () => {
      expect(
        evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/notes.txt' }, fs, {
          openFile: '/Documents/other.txt',
        })
      ).toBe(false)
    })
    it('passes when casing differs (case-insensitive)', () => {
      expect(
        evaluateFsCheck({ type: 'fs_file_opened', path: '/documents/NOTES.TXT' }, fs, {
          openFile: '/Documents/notes.txt',
        })
      ).toBe(true)
    })
    it('passes when wildcard matches the opened file', () => {
      expect(
        evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/*.txt' }, fs, {
          openFile: '/Documents/notes.txt',
        })
      ).toBe(true)
    })
    it('fails when wildcard does not match the opened file', () => {
      expect(
        evaluateFsCheck({ type: 'fs_file_opened', path: '/Documents/*.py' }, fs, {
          openFile: '/Documents/notes.txt',
        })
      ).toBe(false)
    })
  })

  describe('canonical fs checks', () => {
    const richFs = {
      ...fs,
      '/Projects/': { type: 'dir' },
      '/Projects/app.py': { type: 'file', content: 'print("Hello")\nprint("World")\n' },
      '/Projects/index.html': { type: 'file', content: '<h1>Hello</h1>' },
      '/Projects/assets/': { type: 'dir' },
    }

    it('checks path existence with an item type field', () => {
      expect(
        evaluateFsCheck(
          { type: 'fs_path', operator: 'exists', path: '/Projects/app.py', itemType: 'file' },
          richFs
        )
      ).toBe(true)
      expect(
        evaluateFsCheck(
          { type: 'fs_path', operator: 'exists', path: '/Projects/app.py', itemType: 'dir' },
          richFs
        )
      ).toBe(false)
    })

    it('checks file content with regex flags', () => {
      const check = {
        type: 'fs_file_content',
        operator: 'matches_regex',
        path: '/Projects/app.py',
        value: '^print',
        flags: 'm',
      }
      expect(evaluateFsCheck(check, richFs)).toBe(true)
    })

    it('checks file line counts with comparison operators', () => {
      const check = {
        type: 'fs_file_line_count',
        operator: 'less_than_or_equal',
        path: '/Projects/app.py',
        value: '2',
      }
      expect(evaluateFsCheck(check, richFs)).toBe(true)
    })

    it('checks folder child counts by item type', () => {
      const check = {
        type: 'fs_folder_count',
        operator: 'greater_than_or_equal',
        path: '/Projects/',
        itemType: 'file',
        value: '2',
      }
      expect(evaluateFsCheck(check, richFs)).toBe(true)
    })

    it('checks opened folders and files with the same canonical type', () => {
      expect(
        evaluateFsCheck({ type: 'fs_opened', path: '/Projects/', itemType: 'dir' }, richFs, {
          currentDir: '/Projects/',
        })
      ).toBe(true)
      expect(
        evaluateFsCheck({ type: 'fs_opened', path: '/Projects/app.py', itemType: 'file' }, richFs, {
          openFile: '/Projects/app.py',
        })
      ).toBe(true)
    })
  })

  it('returns false for null fs', () => {
    expect(evaluateFsCheck({ type: 'fs_file_exists', path: '/x.txt' }, null)).toBe(false)
  })

  it('returns false for unknown type', () => {
    expect(evaluateFsCheck({ type: 'fs_unknown', path: '/' }, fs)).toBe(false)
  })
})
