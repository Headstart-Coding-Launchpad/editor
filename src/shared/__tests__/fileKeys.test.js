import { describe, expect, it } from 'vitest'
import { encodeFileKey, decodeFileKey } from '../fileKeys'

describe('encodeFileKey', () => {
  it('replaces dots with __dot__', () => {
    expect(encodeFileKey('index.html')).toBe('index__dot__html')
  })

  it('replaces multiple dots', () => {
    expect(encodeFileKey('style.min.css')).toBe('style__dot__min__dot__css')
  })

  it('leaves names without dots unchanged', () => {
    expect(encodeFileKey('README')).toBe('README')
  })

  it('handles a leading dot', () => {
    expect(encodeFileKey('.gitignore')).toBe('__dot__gitignore')
  })
})

describe('decodeFileKey', () => {
  it('restores dots from __dot__', () => {
    expect(decodeFileKey('index__dot__html')).toBe('index.html')
  })

  it('restores multiple __dot__ sequences', () => {
    expect(decodeFileKey('style__dot__min__dot__css')).toBe('style.min.css')
  })

  it('leaves keys without __dot__ unchanged', () => {
    expect(decodeFileKey('README')).toBe('README')
  })

  it('handles a leading __dot__', () => {
    expect(decodeFileKey('__dot__gitignore')).toBe('.gitignore')
  })
})

describe('round-trip', () => {
  it('encodes then decodes back to the original name', () => {
    const names = ['index.html', 'style.min.css', 'README', '.gitignore', 'a.b.c.d']
    names.forEach(name => {
      expect(decodeFileKey(encodeFileKey(name))).toBe(name)
    })
  })
})
