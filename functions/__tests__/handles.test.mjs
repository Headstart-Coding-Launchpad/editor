import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const { normaliseHandle } = createRequire(import.meta.url)('../handles.js')

describe('tutor handles', () => {
  it('accepts 2-20 lower-case letters and digits, trimmed and lower-cased', () => {
    expect(normaliseHandle('ryan')).toBe('ryan')
    expect(normaliseHandle('  Sam ')).toBe('sam')
    expect(normaliseHandle('t2')).toBe('t2')
    expect(normaliseHandle('a'.repeat(20))).toBe('a'.repeat(20))
  })

  it('rejects anything that could break a database key or a link', () => {
    for (const bad of [
      '',
      'a',
      'a'.repeat(21),
      'sam~x',
      'a b',
      'a/b',
      'a.b',
      '$sam',
      'sam!',
      null,
    ]) {
      expect(normaliseHandle(bad)).toBe('')
    }
  })
})
