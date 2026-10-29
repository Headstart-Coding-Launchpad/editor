import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTutorRoom } from '../useTutorRoom'

const fb = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  disconnectRemove: vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => fb.ref(...args),
  set: (...args) => fb.set(...args),
  remove: (...args) => fb.remove(...args),
  onDisconnect: (target) => ({ remove: () => fb.disconnectRemove(target) }),
}))
vi.mock('../../../shared/firebase', () => ({ db: {} }))

const live = { handle: 'sam', lessonId: 'abc123', sessionKey: 'abc123~sam', state: 'active' }

describe('useTutorRoom', () => {
  beforeEach(() => vi.clearAllMocks())

  it('points rooms/<handle> at the live lesson and arms the disconnect cleanup', () => {
    renderHook(() => useTutorRoom(live))
    expect(fb.disconnectRemove).toHaveBeenCalledWith({ path: 'rooms/sam' })
    expect(fb.set).toHaveBeenCalledWith(
      { path: 'rooms/sam' },
      expect.objectContaining({ lessonId: 'abc123', sessionKey: 'abc123~sam' })
    )
  })

  it('also opens the room while the session is waiting', () => {
    renderHook(() => useTutorRoom({ ...live, state: 'waiting' }))
    expect(fb.set).toHaveBeenCalledTimes(1)
  })

  it('closes the room when the session ends or the view goes', () => {
    const { rerender, unmount } = renderHook((props) => useTutorRoom(props), {
      initialProps: live,
    })
    rerender({ ...live, state: 'ended' })
    expect(fb.remove).toHaveBeenCalledWith({ path: 'rooms/sam' })
    fb.remove.mockClear()
    const second = renderHook(() => useTutorRoom(live))
    second.unmount()
    expect(fb.remove).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does nothing for a tutor with no handle, or with no live session', () => {
    renderHook(() => useTutorRoom({ ...live, handle: null }))
    renderHook(() => useTutorRoom({ ...live, handle: 'a b/c' }))
    renderHook(() => useTutorRoom({ ...live, state: undefined }))
    expect(fb.set).not.toHaveBeenCalled()
  })
})
