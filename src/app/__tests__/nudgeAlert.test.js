import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHIME_PRESETS,
  NUDGE_TITLE,
  playCompleteChime,
  showNudgeNotification,
  startTitleFlash,
} from '../nudgeAlert'

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

describe('playCompleteChime', () => {
  it('plays a short rising three-note chime, gentler than the nudge', () => {
    const frequencies = []
    class FakeAudioContext {
      currentTime = 0
      destination = {}
      createOscillator() {
        const osc = {
          frequency: {
            set value(v) {
              frequencies.push(v)
            },
          },
          connect: (node) => node,
          start: vi.fn(),
          stop: vi.fn(),
        }
        return osc
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: (node) => node,
        }
      }
      close() {
        return Promise.resolve()
      }
    }
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    playCompleteChime()
    expect(frequencies).toEqual(CHIME_PRESETS.complete.notes)
    expect(frequencies[0]).toBeLessThan(frequencies[1])
    expect(frequencies[1]).toBeLessThan(frequencies[2])
    const { notes, spacing, decay, gain } = CHIME_PRESETS.complete
    expect((notes.length - 1) * spacing + decay).toBeLessThanOrEqual(0.5)
    expect(gain).toBeLessThan(CHIME_PRESETS.nudge.gain)
    expect(CHIME_PRESETS.complete.notes).not.toEqual(CHIME_PRESETS.badge.notes)
  })

  it('is silent without Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(() => playCompleteChime()).not.toThrow()
  })
})
