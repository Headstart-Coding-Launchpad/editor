import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

// index.js is CommonJS and calls initializeApp() on load, so stub the firebase modules it requires.
const authMock = {
  getUser: vi.fn(),
  createUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}
const docMock = { set: vi.fn(), update: vi.fn(), delete: vi.fn() }
const dbMock = {
  collection: () => ({ doc: () => docMock, where: () => ({ get: async () => ({ docs: [] }) }) }),
}
class HttpsError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
const stubs = {
  'firebase-admin/app': { initializeApp: () => {} },
  'firebase-admin/auth': { getAuth: () => authMock },
  'firebase-admin/firestore': {
    getFirestore: () => dbMock,
    FieldValue: { serverTimestamp: () => 'ts', delete: () => 'del' },
  },
  'firebase-functions/v2/https': { onCall: (_opts, fn) => fn, HttpsError },
  'firebase-functions/v2/scheduler': { onSchedule: (_opts, fn) => fn },
}
const origLoad = Module._load
Module._load = function (request, ...rest) {
  return stubs[request] ?? origLoad.call(this, request, ...rest)
}
const fns = require('../index.js')
Module._load = origLoad

const admin = { uid: 'admin1', token: { role: 'admin' } }
const call = (fn, data, auth = admin) => fns[fn]({ data, auth })

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ disabled: false, customClaims: { role: 'admin' } })
  authMock.createUser.mockResolvedValue({ uid: 'new1' })
  authMock.deleteUser.mockResolvedValue(undefined)
})

describe('requireAdmin checks the live account, not just the token claim', () => {
  it('refuses a disabled admin whose token still says admin', async () => {
    authMock.getUser.mockResolvedValue({ disabled: true, customClaims: { role: 'admin' } })
    await expect(call('enableAccount', { uid: 'x' })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('refuses an admin who has been demoted since the token was issued', async () => {
    authMock.getUser.mockResolvedValue({ disabled: false, customClaims: { role: 'teacher' } })
    await expect(call('enableAccount', { uid: 'x' })).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('still refuses a non-admin token without reading the account', async () => {
    await expect(
      call('enableAccount', { uid: 'x' }, { uid: 't', token: { role: 'teacher' } })
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(authMock.getUser).not.toHaveBeenCalled()
  })

  it('lets a live admin through', async () => {
    await call('enableAccount', { uid: 'x' })
    expect(authMock.updateUser).toHaveBeenCalledWith('x', { disabled: false })
  })
})

describe('setUserRole', () => {
  it('refuses to change your own role', async () => {
    await expect(call('setUserRole', { uid: 'admin1', role: 'teacher' })).rejects.toMatchObject({
      code: 'invalid-argument',
    })
    expect(authMock.setCustomUserClaims).not.toHaveBeenCalled()
  })
})

describe('updateAccountPassword', () => {
  it('revokes the target account sessions after the change', async () => {
    await call('updateAccountPassword', { uid: 'u2', password: 'longenough1' })
    expect(authMock.updateUser).toHaveBeenCalledWith('u2', { password: 'longenough1' })
    expect(authMock.revokeRefreshTokens).toHaveBeenCalledWith('u2')
  })
})

describe('createAccount input checks', () => {
  const good = { email: 'a@b.co', password: 'longenough1', role: 'teacher', displayName: 'Sam' }

  it('rejects a numeric password', async () => {
    await expect(call('createAccount', { ...good, password: 12345678901 })).rejects.toMatchObject({
      code: 'invalid-argument',
    })
    expect(authMock.createUser).not.toHaveBeenCalled()
  })

  it('rejects a non-string or over-long displayName', async () => {
    await expect(call('createAccount', { ...good, displayName: 5 })).rejects.toMatchObject({
      code: 'invalid-argument',
    })
    await expect(
      call('createAccount', { ...good, displayName: 'x'.repeat(101) })
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('rejects missing data instead of throwing a TypeError', async () => {
    await expect(call('createAccount', undefined)).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  it('rolls back the Auth user if setting the role claim fails', async () => {
    authMock.setCustomUserClaims.mockRejectedValue(new Error('boom'))
    await expect(call('createAccount', good)).rejects.toMatchObject({ code: 'internal' })
    expect(authMock.deleteUser).toHaveBeenCalledWith('new1')
  })
})
