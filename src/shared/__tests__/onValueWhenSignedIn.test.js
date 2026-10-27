// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

let authCallback = null
const unsubAuth = vi.fn()
const unsubValue = vi.fn()
const onValue = vi.fn(() => unsubValue)

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    authCallback = cb
    return unsubAuth
  },
}))
vi.mock('firebase/database', () => ({ onValue: (...args) => onValue(...args) }))
vi.mock('../firebase', () => ({ auth: {} }))

const { onValueWhenSignedIn } = await vi.importActual('../onValueWhenSignedIn.js')

describe('onValueWhenSignedIn (#288)', () => {
  beforeEach(() => {
    authCallback = null
    onValue.mockClear()
    unsubAuth.mockClear()
    unsubValue.mockClear()
  })

  it('waits for a signed-in user before attaching the listener', () => {
    const cb = vi.fn()
    onValueWhenSignedIn('ref', cb)
    authCallback(null)
    expect(onValue).not.toHaveBeenCalled()
    authCallback({ uid: 'student-1' })
    expect(onValue).toHaveBeenCalledWith('ref', cb)
  })

  it('attaches once, however often the auth state fires', () => {
    onValueWhenSignedIn('ref', vi.fn())
    authCallback({ uid: 'a' })
    authCallback({ uid: 'a' })
    expect(onValue).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes both, and never attaches after unsubscribing', () => {
    const stop = onValueWhenSignedIn('ref', vi.fn())
    stop()
    authCallback({ uid: 'a' })
    expect(onValue).not.toHaveBeenCalled()
    expect(unsubAuth).toHaveBeenCalled()

    const stop2 = onValueWhenSignedIn('ref', vi.fn())
    authCallback({ uid: 'a' })
    stop2()
    expect(unsubValue).toHaveBeenCalled()
  })
})
