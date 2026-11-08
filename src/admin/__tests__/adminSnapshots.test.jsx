import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({ onSnapshot: vi.fn() }))
vi.mock('../../shared/firebase', () => ({ firestore: {}, auth: { name: 'auth' } }))
// The app's own auth state stream: tests drive it by hand.
let authListener = null
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    authListener = cb
    return () => {}
  }),
}))

import { onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { renderHook } from '@testing-library/react'
import {
  ADMIN_SNAPSHOT_LINGER_MS,
  resetAdminSnapshots,
  useAdminSnapshot,
  useLoadMore,
  watchAdminSnapshotsAuth,
} from '../adminSnapshots'

const signIn = (uid) => authListener(uid ? { uid } : null)

let fire
let unsubscribe
let fires
let unsubscribes

function Names({ sourceKey = 'things', family, label = 'a' }) {
  const { data, loading, error, retry } = useAdminSnapshot(
    sourceKey,
    () => ({ ref: sourceKey }),
    (snap) => snap.docs.map((d) => d.id),
    { family }
  )
  if (error)
    return (
      <p>
        {`${label}: error ${error}`}
        <button onClick={retry}>{`retry ${label}`}</button>
      </p>
    )
  if (loading) return <p>{`${label}: loading${sourceKey == null ? ' (disabled)' : ''}`}</p>
  return <p>{`${label}: ${data == null ? 'off' : data.join(',')}`}</p>
}

describe('useAdminSnapshot (one shared listener per Admin source)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAdminSnapshots()
    vi.clearAllMocks()
    unsubscribe = vi.fn()
    fires = {}
    unsubscribes = {}
    onSnapshot.mockImplementation((ref, next, onError) => {
      fire = { next, onError }
      fires[ref.ref] = fire
      const stopOne = vi.fn(() => unsubscribe())
      unsubscribes[ref.ref] = stopOne
      return stopOne
    })
  })

  afterEach(() => {
    resetAdminSnapshots()
    vi.useRealTimers()
  })

  it('shares one listener between panels that need the same source', () => {
    render(
      <>
        <Names label="a" />
        <Names label="b" />
      </>
    )
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    act(() => fire.next({ docs: [{ id: 'x' }, { id: 'y' }] }))
    expect(screen.getByText('a: x,y')).toBeInTheDocument()
    expect(screen.getByText('b: x,y')).toBeInTheDocument()
  })

  it('keeps the data when a tab is switched away and back, without downloading again', () => {
    const first = render(<Names />)
    act(() => fire.next({ docs: [{ id: 'x' }] }))
    first.unmount()
    act(() => vi.advanceTimersByTime(60 * 1000))

    render(<Names />)
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
    expect(screen.getByText('a: x')).toBeInTheDocument()
  })

  it('stops listening a while after the last panel using it closes', () => {
    const view = render(<Names />)
    view.unmount()
    act(() => vi.advanceTimersByTime(ADMIN_SNAPSHOT_LINGER_MS + 1))
    expect(unsubscribe).toHaveBeenCalledTimes(1)

    render(<Names />)
    expect(onSnapshot).toHaveBeenCalledTimes(2)
  })

  it('reports a listener error to every panel', () => {
    render(<Names />)
    act(() => fire.onError(new Error('denied')))
    expect(screen.getByText('a: error denied')).toBeInTheDocument()
  })

  it('does not listen at all while the source key is null, and is not loading', () => {
    render(<Names sourceKey={null} />)
    expect(onSnapshot).not.toHaveBeenCalled()
    expect(screen.getByText('a: off')).toBeInTheDocument()
  })

  it('lingers only 2 minutes after the last panel closes (a lingering lessons listener still bills edits)', () => {
    expect(ADMIN_SNAPSHOT_LINGER_MS).toBe(2 * 60 * 1000)
  })

  it("watches the app's auth state once, however often the Admin shell mounts", () => {
    watchAdminSnapshotsAuth()
    watchAdminSnapshotsAuth()
    expect(onAuthStateChanged.mock.calls.length).toBeLessThanOrEqual(1)
    expect(authListener).toEqual(expect.any(Function))
  })

  it("drops every cached source when a different user signs in, so they never see the last user's data", () => {
    watchAdminSnapshotsAuth()
    signIn('tutor-a')
    const view = render(<Names />)
    act(() => fire.next({ docs: [{ id: 'secret' }] }))
    view.unmount()

    signIn('tutor-a') // a token refresh reports the same user: nothing changes
    expect(unsubscribe).not.toHaveBeenCalled()

    signIn('tutor-b')
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    render(<Names />)
    expect(screen.getByText('a: loading')).toBeInTheDocument()
    expect(onSnapshot).toHaveBeenCalledTimes(2)
  })

  it('drops every cached source on any sign-out (session expiry, another tab), not just the Sign out button', () => {
    watchAdminSnapshotsAuth()
    signIn('tutor-a')
    const view = render(<Names />)
    act(() => fire.next({ docs: [{ id: 'secret' }] }))
    view.unmount()

    signIn(null)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    signIn('tutor-a')
    render(<Names />)
    expect(screen.getByText('a: loading')).toBeInTheDocument()
  })

  it('restarts a source a mounted panel still uses when the user changes, instead of orphaning it', () => {
    watchAdminSnapshotsAuth()
    signIn('tutor-a')
    render(<Names />)
    act(() => fire.next({ docs: [{ id: 'secret' }] }))
    act(() => signIn(null))
    expect(screen.getByText('a: loading')).toBeInTheDocument()
    expect(onSnapshot).toHaveBeenCalledTimes(1) // no listener while nobody is signed in
    act(() => signIn('tutor-b'))
    expect(onSnapshot).toHaveBeenCalledTimes(2)
    act(() => fire.next({ docs: [{ id: 'mine' }] }))
    expect(screen.getByText('a: mine')).toBeInTheDocument()
  })

  it('opens no listener while signed out, stays idle, and starts when a user signs in', () => {
    watchAdminSnapshotsAuth()
    act(() => signIn(null))
    render(<Names />)
    expect(onSnapshot).not.toHaveBeenCalled()
    expect(screen.getByText('a: off')).toBeTruthy()
    act(() => signIn('teacher-1'))
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    act(() => fire.next({ docs: [{ id: 'x' }] }))
    expect(screen.getByText('a: x')).toBeTruthy()
  })

  it('shows an error (not loading forever) when mapping a snapshot throws', () => {
    render(<Names sourceKey="bad" />)
    act(() => fires.bad.next({ docs: null }))
    expect(screen.getByText(/a: error/)).toBeTruthy()
    expect(screen.getByText('retry a')).toBeTruthy()
  })

  it('stops the smaller page at once when a panel moves to a bigger one (Load more)', () => {
    const view = render(<Names sourceKey="reports:20" family="reports" />)
    view.rerender(<Names sourceKey="reports:40" family="reports" />)
    expect(unsubscribes['reports:20']).toHaveBeenCalledTimes(1)
    expect(unsubscribes['reports:40']).not.toHaveBeenCalled()
  })

  it('keeps the smaller page open while another panel still uses it', () => {
    const view = render(
      <>
        <Names sourceKey="reports:20" family="reports" label="a" />
        <Names sourceKey="reports:20" family="reports" label="b" />
      </>
    )
    view.rerender(
      <>
        <Names sourceKey="reports:40" family="reports" label="a" />
        <Names sourceKey="reports:20" family="reports" label="b" />
      </>
    )
    expect(unsubscribes['reports:20']).not.toHaveBeenCalled()
  })

  it('starts a failed source again when a new panel opens it, instead of reusing the dead one', () => {
    render(<Names label="a" />)
    act(() => fire.onError(new Error('denied')))
    render(<Names label="b" />)
    expect(onSnapshot).toHaveBeenCalledTimes(2)
    expect(screen.getByText('a: loading')).toBeInTheDocument()
    act(() => fire.next({ docs: [{ id: 'x' }] }))
    expect(screen.getByText('a: x')).toBeInTheDocument()
    expect(screen.getByText('b: x')).toBeInTheDocument()
  })

  it('Retry starts a failed source again', () => {
    render(<Names />)
    act(() => fire.onError(new Error('denied')))
    act(() => screen.getByRole('button', { name: 'retry a' }).click())
    expect(onSnapshot).toHaveBeenCalledTimes(2)
    act(() => fire.next({ docs: [{ id: 'x' }] }))
    expect(screen.getByText('a: x')).toBeInTheDocument()
  })
})

describe('useLoadMore', () => {
  const live = (data) => ({ data, loading: false, error: null })

  it('offers more only when the page came back full', () => {
    const { result, rerender } = renderHook((props) => useLoadMore(props), {
      initialProps: { source: live([]), size: 19, count: 20, pageSize: 20 },
    })
    expect(result.current.hasMore).toBe(false)
    rerender({ source: live([]), size: 20, count: 20, pageSize: 20 })
    expect(result.current.hasMore).toBe(true)
  })

  it('keeps Load more after a deletion shrinks a full page', () => {
    const { result, rerender } = renderHook((props) => useLoadMore(props), {
      initialProps: { source: live([]), size: 20, count: 20, pageSize: 20 },
    })
    rerender({ source: live([]), size: 19, count: 20, pageSize: 20 })
    expect(result.current.hasMore).toBe(true)
  })

  it('keeps the button (as Retry) when the bigger page fails', () => {
    const { result, rerender } = renderHook((props) => useLoadMore(props), {
      initialProps: { source: live([]), size: 20, count: 20, pageSize: 20 },
    })
    rerender({
      source: { data: null, loading: true, error: null },
      size: 0,
      count: 40,
      pageSize: 20,
    })
    expect(result.current).toMatchObject({ hasMore: true, failed: false })
    rerender({
      source: { data: null, loading: false, error: 'denied' },
      size: 0,
      count: 40,
      pageSize: 20,
    })
    expect(result.current).toMatchObject({ hasMore: true, failed: true })
  })
})
