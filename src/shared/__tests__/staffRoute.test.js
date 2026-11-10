import { describe, expect, it } from 'vitest'
import { isStaffRoute } from '../staffRoute'

describe('isStaffRoute', () => {
  it('treats admin, builder, account, login and shot pages as staff', () => {
    for (const path of ['/admin', '/admin/lessons', '/builder', '/account', '/login', '/shot']) {
      expect(isStaffRoute(path, '')).toBe(true)
    }
  })

  it('treats the tutor lesson window, presentation and preview as staff', () => {
    expect(isStaffRoute('/lesson/abc', '?teacher=true')).toBe(true)
    expect(isStaffRoute('/lesson/abc', '?teacher=true&present=true')).toBe(true)
    expect(isStaffRoute('/lesson/abc', '?preview=true')).toBe(true)
  })

  it("keeps a child's pages as child pages", () => {
    expect(isStaffRoute('/lesson/abc', '')).toBe(false)
    expect(isStaffRoute('/lesson/abc', '?t=sam')).toBe(false)
    expect(isStaffRoute('/lesson/abc', '?solo=true')).toBe(false)
    expect(isStaffRoute('/room/sam', '')).toBe(false)
    expect(isStaffRoute('/playground/python', '')).toBe(false)
    expect(isStaffRoute('/', '')).toBe(false)
  })
})
