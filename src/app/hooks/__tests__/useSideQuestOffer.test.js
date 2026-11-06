import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDE_QUEST_OFFER_TIMING, useSideQuestOffer } from '../useSideQuestOffer'
import { sideQuestOfferStorageKey } from '../../studentStorage'

const QUESTS = [{ index: 0, title: 'Make it spin', kind: 'challenge' }]
const { arrivalGraceMs, passBannerCapMs, idleMs } = SIDE_QUEST_OFFER_TIMING
// With no pass banner up, the card waits only for the idle wait.
const afterPassMs = idleMs

function setup(overrides = {}) {
  const openQuest = vi.fn()
  const base = {
    lessonId: 'L',
    taskId: 1,
    anonymousId: 'kid',
    quests: QUESTS,
    passed: false,
    eligible: false,
    running: false,
    blocked: false,
    questOpen: false,
    persist: true,
    openQuest,
    ...overrides,
  }
  const hook = renderHook((props) => useSideQuestOffer(props), { initialProps: base })
  const update = (patch) => {
    Object.assign(base, patch)
    hook.rerender({ ...base })
  }
  return { ...hook, update, openQuest }
}

const advance = (ms) => act(() => vi.advanceTimersByTime(ms))

// A pass the student watched: after the arrival grace, from a Run they pressed here, and the
// quests become eligible with it.
function passNow(update) {
  advance(arrivalGraceMs + 10)
  update({ running: true })
  update({ running: false, passed: true, eligible: true })
}

describe('useSideQuestOffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows after the pass banner wait and the idle wait, then remembers the task', () => {
    const { result, update } = setup()
    passNow(update)
    expect(result.current.visible).toBe(false)
    advance(Math.max(afterPassMs, idleMs) - 10)
    expect(result.current.visible).toBe(false)
    advance(20)
    expect(result.current.visible).toBe(true)
    expect(localStorage.getItem(sideQuestOfferStorageKey('L', '1', 'kid'))).toContain('"at"')
  })

  it('a pass restored straight after arriving is not a moment', () => {
    const { result, update } = setup()
    update({ passed: true, eligible: true })
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('typing restarts the idle wait', () => {
    const { result, update } = setup()
    passNow(update)
    advance(afterPassMs - 100)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    })
    advance(200)
    expect(result.current.visible).toBe(false)
    advance(idleMs)
    expect(result.current.visible).toBe(true)
  })

  it('waits for a Run to finish and for a badge celebration to go', () => {
    const { result, update } = setup()
    passNow(update)
    update({ running: true })
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
    update({ running: false, blocked: true })
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
    update({ blocked: false })
    expect(result.current.visible).toBe(true)
    // A celebration arriving later hides it while it plays, then it is back.
    update({ blocked: true })
    expect(result.current.visible).toBe(false)
    update({ blocked: false })
    expect(result.current.visible).toBe(true)
  })

  it('a pass where quests are not offered (sandbox, broadcast) never queues it', () => {
    const { result, update } = setup()
    advance(arrivalGraceMs + 10)
    update({ running: true })
    update({ running: false, passed: true, eligible: false })
    advance(10)
    update({ eligible: true })
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('Not now closes it for good; a second pass on the task does not bring it back', () => {
    const { result, update } = setup({ persist: false })
    passNow(update)
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
    update({ passed: false, eligible: false })
    update({ passed: true, eligible: true })
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('Try it opens the quest and closes the card', () => {
    const { result, update, openQuest } = setup()
    passNow(update)
    advance(afterPassMs + idleMs)
    act(() => result.current.tryQuest(0))
    expect(openQuest).toHaveBeenCalledWith(0)
    expect(result.current.visible).toBe(false)
  })

  it('opening a quest from the strip ends the offer too', () => {
    const { result, update } = setup()
    passNow(update)
    advance(afterPassMs + idleMs)
    update({ questOpen: true, eligible: false })
    update({ questOpen: false, eligible: true })
    expect(result.current.visible).toBe(false)
  })

  it('an offer saved on this device is not repeated', () => {
    localStorage.setItem(sideQuestOfferStorageKey('L', '1', 'kid'), JSON.stringify({ at: 1 }))
    const { result, update } = setup()
    passNow(update)
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('never shows on a task with no quests', () => {
    const { result, update } = setup({ quests: [] })
    passNow(update)
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('blocked storage still works for this visit', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result, update } = setup()
    passNow(update)
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(true)
    setItem.mockRestore()
  })

  it('a pass with no Run pressed in this view (a slow restore) is not a moment', () => {
    const { result, update } = setup()
    advance(arrivalGraceMs + 10)
    update({ passed: true, eligible: true })
    advance(passBannerCapMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('opening a quest from the strip while the card is pending cancels it', () => {
    const { result, update } = setup()
    passNow(update)
    advance(10)
    update({ questOpen: true, eligible: false })
    advance(passBannerCapMs + idleMs)
    update({ questOpen: false, eligible: true })
    advance(passBannerCapMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it.each([
    ['left on screen', () => {}],
    ['Not now', (result) => act(() => result.current.dismiss())],
    ['Try it', (result) => act(() => result.current.tryQuest(0))],
  ])('never reshows after %s, then Next and Back', (_label, action) => {
    const { result, update } = setup({ persist: false })
    passNow(update)
    advance(afterPassMs + idleMs)
    expect(result.current.visible).toBe(true)
    action(result)
    update({ taskId: 2, passed: false, eligible: false })
    advance(10)
    update({ taskId: 1, passed: true, eligible: true })
    advance(passBannerCapMs + idleMs)
    expect(result.current.visible).toBe(false)
  })

  it('waits while the pass banner is up and shows once it goes on its own', () => {
    const { result, update } = setup({ passBannerUp: true })
    passNow(update)
    advance(5000)
    expect(result.current.visible).toBe(false)
    update({ passBannerUp: false })
    expect(result.current.visible).toBe(false)
    advance(idleMs + 10)
    expect(result.current.visible).toBe(true)
  })

  it('shows at the cap even if the pass banner is still up', () => {
    const { result, update } = setup({ passBannerUp: true })
    passNow(update)
    advance(passBannerCapMs - 50)
    expect(result.current.visible).toBe(false)
    advance(100)
    expect(result.current.visible).toBe(true)
  })

  it('not while the output iframe has focus; shows once focus leaves it', () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    try {
      const { result, update } = setup()
      passNow(update)
      frame.focus()
      expect(document.activeElement).toBe(frame)
      advance(afterPassMs + idleMs + 1000)
      expect(result.current.visible).toBe(false)
      frame.blur()
      document.body.focus()
      advance(1000)
      expect(result.current.visible).toBe(true)
    } finally {
      frame.remove()
    }
  })

  it('not while the tab is hidden, and not saved as offered until it really shows', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    try {
      const { result, update } = setup()
      passNow(update)
      advance(passBannerCapMs + idleMs + 1000)
      expect(result.current.visible).toBe(false)
      expect(localStorage.getItem(sideQuestOfferStorageKey('L', '1', 'kid'))).toBeNull()
      hidden.mockReturnValue(false)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      advance(1000)
      expect(result.current.visible).toBe(true)
      expect(localStorage.getItem(sideQuestOfferStorageKey('L', '1', 'kid'))).not.toBeNull()
    } finally {
      hidden.mockRestore()
    }
  })
})
