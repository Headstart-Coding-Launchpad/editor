import { describe, it, expect, beforeEach } from 'vitest'
import { getLessonLinks } from '../lessonLinks'

describe('getLessonLinks', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#/admin')
  })

  it('returns a join link that is the bare lesson URL', () => {
    const { join } = getLessonLinks('py-intro')
    expect(join).toBe(`${window.location.origin}${window.location.pathname}#/lesson/py-intro`)
    expect(join).not.toContain('?')
  })

  it('returns a solo link with ?solo=true appended', () => {
    const { solo } = getLessonLinks('py-intro')
    expect(solo).toBe(`${window.location.origin}${window.location.pathname}#/lesson/py-intro?solo=true`)
  })

  it('returns exactly the join and solo keys', () => {
    const links = getLessonLinks('py-intro')
    expect(Object.keys(links).sort()).toEqual(['join', 'solo'])
  })
})
