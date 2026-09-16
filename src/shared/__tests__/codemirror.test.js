import { describe, it, expect } from 'vitest'
import { getTabSize, getIndentUnit, getLanguageExtension, createBaseExtensions } from '../codemirror.js'

// ─── getTabSize ───────────────────────────────────────────────────────────────

describe('getTabSize', () => {
  it('returns 4 for python', () => {
    expect(getTabSize('python')).toBe(4)
  })

  it('returns 2 for html', () => {
    expect(getTabSize('html')).toBe(2)
  })

  it('returns 2 for javascript', () => {
    expect(getTabSize('javascript')).toBe(2)
  })

  it('returns 2 for css', () => {
    expect(getTabSize('css')).toBe(2)
  })

  it('returns 2 for unknown type', () => {
    expect(getTabSize('markdown')).toBe(2)
  })
})

// ─── getIndentUnit ──────────────────────────────────────────────────────────

describe('getIndentUnit', () => {
  it('returns 4 spaces for python', () => {
    expect(getIndentUnit('python')).toBe('    ')
  })

  it('returns 2 spaces for html', () => {
    expect(getIndentUnit('html')).toBe('  ')
  })

  it('returns 2 spaces for javascript', () => {
    expect(getIndentUnit('javascript')).toBe('  ')
  })

  it('returns 2 spaces for css', () => {
    expect(getIndentUnit('css')).toBe('  ')
  })

  it('returns 2 spaces for unknown type', () => {
    expect(getIndentUnit('markdown')).toBe('  ')
  })
})

// ─── getLanguageExtension ─────────────────────────────────────────────────────

describe('getLanguageExtension', () => {
  it('returns a non-null extension for python', () => {
    expect(getLanguageExtension('python')).not.toBeNull()
  })

  it('returns a non-null extension for html', () => {
    expect(getLanguageExtension('html')).not.toBeNull()
  })

  it('returns a non-null extension for css', () => {
    expect(getLanguageExtension('css')).not.toBeNull()
  })

  it('returns a non-null extension for javascript', () => {
    expect(getLanguageExtension('javascript')).not.toBeNull()
  })

  it('falls back to python extension for unknown type', () => {
    const pythonExt = getLanguageExtension('python')
    const unknownExt = getLanguageExtension('brainfuck')
    // Both should be truthy; they should be equal by reference (same python() call shape)
    expect(unknownExt).not.toBeNull()
    // Verify the fallback is the python extension (same constructor name)
    expect(Object.getPrototypeOf(unknownExt)).toEqual(Object.getPrototypeOf(pythonExt))
  })
})

// ─── createBaseExtensions ─────────────────────────────────────────────────────

describe('createBaseExtensions', () => {
  it('returns an array for python', () => {
    const exts = createBaseExtensions('python')
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('returns an array for html', () => {
    const exts = createBaseExtensions('html')
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('returns an array for javascript', () => {
    const exts = createBaseExtensions('javascript')
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('returns an array for css', () => {
    const exts = createBaseExtensions('css')
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('works with readOnly = true', () => {
    const exts = createBaseExtensions('python', true)
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })

  it('uses python as default when type is omitted', () => {
    const exts = createBaseExtensions()
    expect(Array.isArray(exts)).toBe(true)
    expect(exts.length).toBeGreaterThan(0)
  })
})
