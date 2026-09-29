import { afterEach, describe, expect, it, vi } from 'vitest'
import { NUDGE_TITLE, showNudgeNotification, startTitleFlash } from '../nudgeAlert'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

describe('startTitleFlash', () => {
  it('alternates the title and favicon, then restores both on stop', () => {
    vi.useFakeTimers()
    document.title = 'Lesson'
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = '/favicon.svg'
    document.head.appendChild(link)

    const stop = startTitleFlash({ intervalMs: 500 })
    expect(document.title).toBe(NUDGE_TITLE)
    expect(link.getAttribute('href')).toMatch(/^data:image\/svg\+xml/)

    vi.advanceTimersByTime(500)
    expect(document.title).toBe('Lesson')
    expect(link.getAttribute('href')).toBe('/favicon.svg')

    vi.advanceTimersByTime(500)
    expect(document.title).toBe(NUDGE_TITLE)

    stop()
    expect(document.title).toBe('Lesson')
    expect(link.getAttribute('href')).toBe('/favicon.svg')
    vi.advanceTimersByTime(2000)
    expect(document.title).toBe('Lesson')
  })
})

describe('showNudgeNotification', () => {
  it('only notifies once permission has been granted', () => {
    const Notification = vi.fn()
    Notification.permission = 'default'
    vi.stubGlobal('Notification', Notification)

    showNudgeNotification()
    expect(Notification).not.toHaveBeenCalled()

    Notification.permission = 'granted'
    showNudgeNotification()
    expect(Notification).toHaveBeenCalledWith(
      NUDGE_TITLE,
      expect.objectContaining({ tag: 'headstart-nudge' })
    )
  })
})
