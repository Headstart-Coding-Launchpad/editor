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
    expect(solo).toBe(
      `${window.location.origin}${window.location.pathname}#/lesson/py-intro?solo=true`
    )
  })

  it('returns a teacher link with ?teacher=true appended', () => {
    const { teacher } = getLessonLinks('py-intro')
    expect(teacher).toBe(
      `${window.location.origin}${window.location.pathname}#/lesson/py-intro?teacher=true`
    )
  })

  it('returns a preview link with ?preview=true appended', () => {
    const { preview } = getLessonLinks('py-intro')
    expect(preview).toBe(
      `${window.location.origin}${window.location.pathname}#/lesson/py-intro?preview=true`
    )
  })

  it('returns exactly the four known link kinds', () => {
    const links = getLessonLinks('py-intro')
    expect(Object.keys(links).sort()).toEqual(['join', 'preview', 'solo', 'teacher'])
  })

  it('puts the tutor handle on the join link only, so the class opens in their own session', () => {
    const base = `${window.location.origin}${window.location.pathname}#/lesson/py-intro`
    const links = getLessonLinks('py-intro', 'Sam')
    expect(links.join).toBe(`${base}?t=sam`)
    expect(links.solo).toBe(`${base}?solo=true`)
    expect(links.teacher).toBe(`${base}?teacher=true`)
    // Not a handle: the plain link, as before.
    expect(getLessonLinks('py-intro', 'a b/c').join).toBe(base)
  })
})
