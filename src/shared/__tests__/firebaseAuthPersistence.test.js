import { describe, it, expect, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  initializeAuth: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  setPersistence: vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }))
vi.mock('firebase/database', () => ({ getDatabase: vi.fn(() => ({})) }))
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({})) }))
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(() => ({})) }))
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }))
vi.mock('firebase/auth', () => ({
  ...authMocks,
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
  indexedDBLocalPersistence: 'indexedDB',
}))

describe('shared/firebase auth persistence', () => {
  it('keeps sign-in in localStorage first, so opening a tab never bounces other tabs to /login', async () => {
    vi.resetModules()
    await import('../../shared/firebase')

    // Regression guard (HSC Audit item 8): getAuth() puts IndexedDB first, so each new tab
    // migrated the user out of localStorage and back, firing a sign-out storage event in
    // every other open tab.
    expect(authMocks.getAuth).not.toHaveBeenCalled()
    expect(authMocks.setPersistence).not.toHaveBeenCalled()
    expect(authMocks.initializeAuth).toHaveBeenCalledTimes(1)
    const { persistence } = authMocks.initializeAuth.mock.calls[0][1]
    expect(persistence[0]).toBe('local')
    expect(persistence.indexOf('indexedDB')).toBe(persistence.length - 1)
  })
})
