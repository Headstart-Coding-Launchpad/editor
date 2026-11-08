import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({ onSnapshot: vi.fn() }))
vi.mock('../../shared/firebase', () => ({ firestore: {} }))

import { onSnapshot } from 'firebase/firestore'
import { ADMIN_SNAPSHOT_LINGER_MS, resetAdminSnapshots, useAdminSnapshot } from '../adminSnapshots'

let fire
let unsubscribe

function Names({ sourceKey = 'things', label = 'a' }) {
  const { data, loading, error } = useAdminSnapshot(
    sourceKey,
    () => ({ ref: sourceKey }),
    (snap) => snap.docs.map((d) => d.id)
  )
  if (error) return <p>{`${label}: error ${error}`}</p>
  if (loading) return <p>{`${label}: loading`}</p>
  return <p>{`${label}: ${data.join(',')}`}</p>
}

describe('useAdminSnapshot (one shared listener per Admin source)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAdminSnapshots()
    vi.clearAllMocks()
    unsubscribe = vi.fn()
    onSnapshot.mockImplementation((_ref, next, onError) => {
      fire = { next, onError }
      return unsubscribe
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

  it('does not listen at all while the source key is null', () => {
    render(<Names sourceKey={null} />)
    expect(onSnapshot).not.toHaveBeenCalled()
  })
})
