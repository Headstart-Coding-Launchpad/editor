import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDE_QUEST_OFFER_TIMING, useSideQuestOffer } from '../useSideQuestOffer'
import { sideQuestOfferStorageKey } from '../../studentStorage'

const QUESTS = [{ index: 0, title: 'Make it spin', kind: 'challenge' }]
const { arrivalGraceMs, afterPassMs, idleMs } = SIDE_QUEST_OFFER_TIMING

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

// A pass the student watched: after the arrival grace, and the quests become eligible with it.
function passNow(update) {
  advance(arrivalGraceMs + 10)
  update({ passed: true, eligible: true })
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
    update({ passed: true, eligible: false })
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
})
