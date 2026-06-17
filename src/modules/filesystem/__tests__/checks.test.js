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
