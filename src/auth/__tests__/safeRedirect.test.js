import { describe, it, expect } from 'vitest'
import { safeRedirect } from '../safeRedirect'

describe('safeRedirect', () => {
  it('keeps in-app paths', () => {
    expect(safeRedirect('/admin')).toBe('/admin')
    expect(safeRedirect('/lesson/abc?x=1')).toBe('/lesson/abc?x=1')
  })

  it('falls back to home for missing or relative values', () => {
    expect(safeRedirect(null)).toBe('/')
    expect(safeRedirect('')).toBe('/')
    expect(safeRedirect('admin')).toBe('/')
    expect(safeRedirect('https://example.com')).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeRedirect('//example.com')).toBe('/')
    expect(safeRedirect('/\\example.com')).toBe('/')
  })
})
