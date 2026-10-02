import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeerHelp } from '../usePeerHelp'

// Paths and values only: what each role may actually write is pinned by the emulator tests in
// tests/rules/peerHelp.rules.test.js.
const fb = vi.hoisted(() => ({
  values: {},
  ref: vi.fn((_db, path) => ({ path: path ?? '' })),
  onValue: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  push: vi.fn((parent) => ({ path: `${parent.path}/pushed`, key: 'pushed' })),
  get: vi.fn(() => Promise.resolve({ val: () => null })),
}))

vi.mock('firebase/database', () => ({
  ref: (...a) => fb.ref(...a),
  onValue: (...a) => fb.onValue(...a),
  set: (...a) => fb.set(...a),
  update: (...a) => fb.update(...a),
  remove: (...a) => fb.remove(...a),
  push: (...a) => fb.push(...a),
  get: (...a) => fb.get(...a),
}))
vi.mock('../../../shared/firebase', () => ({ db: {} }))

const L = 'lesson-1'

beforeEach(() => {
  vi.clearAllMocks()
  fb.values = {}
  fb.onValue.mockImplementation((r, cb) => {
    cb({ val: () => fb.values[r.path] ?? null })
    return () => {}
  })
})

const render = (props) =>
  renderHook((p) => usePeerHelp(p), {
    initialProps: { lessonId: L, session: { currentTaskId: 2 }, ...props },
  })

describe('usePeerHelp as the stuck student', () => {
  it('asks with a snapshot and an opt-in under a random request id, in one update', async () => {
    const { result } = render({ identityId: 's1', role: 'student' })
    await act(() =>
      result.current.requestPeerHelp({
        taskId: 2,
        lessonType: 'html',
        code: '',
        files: { 'a.html': 'x' },
      })
    )
    const [, updates] = fb.update.mock.calls[0]
    expect(updates[`peerHelp/${L}/pushed/stuckId`]).toBe('s1')
    expect(updates[`peerHelp/${L}/pushed/snapshot`]).toMatchObject({
      lessonType: 'html',
      files: { a__dot__html: 'x' },
    })
    expect(updates[`peerHelpRequests/${L}/s1`]).toMatchObject({ requestId: 'pushed', taskId: 2 })
  })

  it('"Not OK" responds, stamps the alert, ends the help and clears the request', async () => {
    fb.values[`peerHelpRequests/${L}/s1`] = { requestId: 'r1' }
    const { result } = render({
      identityId: 's1',
      role: 'student',
      session: { currentTaskId: 2, peerHelpOffers: { r1: { offeredAt: 1 } } },
    })
    await act(() => result.current.flagNotOk('item-1'))
    expect(fb.update).toHaveBeenCalledWith(
      { path: `peerHelp/${L}/r1/inbox/item-1` },
      expect.objectContaining({ response: 'not_ok' })
    )
    const ending = fb.update.mock.calls.find(([r]) => r.path === '')[1]
    expect(ending).toMatchObject({
      [`peerHelp/${L}/r1/state/endedBy`]: 'stuck',
      [`sessions/${L}/peerHelpOffers/r1/endedAt`]: expect.any(Number),
    })
    expect(ending[`peerHelp/${L}/r1/state/notOkAt`]).toEqual(expect.any(Number))
    expect(fb.remove).toHaveBeenCalledWith({ path: `peerHelpRequests/${L}/s1` })
  })
})

describe('usePeerHelp as a helper', () => {
  it('claims with helperId, the offer stamp and its own pointer together', async () => {
    const { result } = render({ identityId: 'h1', role: 'student' })
    let ok
    await act(async () => {
      ok = await result.current.claimOffer('r1')
    })
    expect(ok).toBe(true)
    expect(fb.update.mock.calls[0][1]).toEqual({
      [`peerHelp/${L}/r1/helperId`]: 'h1',
      [`sessions/${L}/peerHelpOffers/r1/claimedAt`]: expect.any(Number),
      [`peerHelpHelping/${L}/h1`]: 'r1',
    })
  })

  it('reports a lost race as false', async () => {
    fb.update.mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
    const { result } = render({ identityId: 'h1', role: 'student' })
    let ok
    await act(async () => {
      ok = await result.current.claimOffer('r1')
    })
    expect(ok).toBe(false)
  })

  it('sends thumbs and hints to the inbox, edits and notes to review', async () => {
    fb.values[`peerHelpHelping/${L}/h1`] = 'r1'
    const { result } = render({ identityId: 'h1', role: 'student' })
    await act(() => result.current.sendMark({ line: 2, verdict: 'down' }))
    await act(() => result.current.sendHint({ line: 2, hintId: 'py-colon' }))
    await act(() =>
      result.current.submitEdit({
        edits: [{ line: 2, op: 'replace', text: 'if x:', before: 'if x' }],
      })
    )
    await act(() => result.current.submitNote({ line: 2, text: 'nope', blockedReason: 'language' }))
    const writes = fb.set.mock.calls.map(([r, v]) => [r.path, v])
    expect(writes[0]).toEqual([
      `peerHelp/${L}/r1/inbox/pushed`,
      expect.objectContaining({ kind: 'mark', verdict: 'down' }),
    ])
    expect(writes[1]).toEqual([
      `peerHelp/${L}/r1/inbox/pushed`,
      expect.objectContaining({ kind: 'hint', hintId: 'py-colon' }),
    ])
    expect(writes[2][0]).toBe(`peerHelp/${L}/r1/review/pushed`)
    expect(writes[2][1]).toMatchObject({
      kind: 'edit',
      status: 'pending',
      edits: { 0: { line: 2, op: 'replace', text: 'if x:', before: 'if x' } },
    })
    expect(writes[3][1]).toMatchObject({
      kind: 'note',
      status: 'blocked',
      blockedReason: 'language',
    })
  })
})

describe('usePeerHelp as the teacher', () => {
  it('offers with the session’s own task id and no names', async () => {
    fb.values[`peerHelpRequests/${L}`] = { s1: { requestId: 'r1', taskId: 2 } }
    fb.values[`peerHelp/${L}`] = { r1: { stuckId: 's1', snapshot: { lessonType: 'python' } } }
    const { result } = render({ role: 'teacher' })
    await act(() => result.current.offerToClass('s1'))
    expect(fb.set).toHaveBeenCalledWith(
      { path: `sessions/${L}/peerHelpOffers/r1` },
      { taskId: 2, lessonType: 'python', offeredAt: expect.any(Number) }
    )
  })

  it('approves by copying the item into the inbox and marking it approved', async () => {
    fb.values[`peerHelp/${L}`] = {
      r1: { review: { i1: { kind: 'note', status: 'pending', line: 3, text: 'Try a colon' } } },
    }
    const { result } = render({ role: 'teacher' })
    await act(() => result.current.approveItem('r1', 'i1'))
    const updates = fb.update.mock.calls.at(-1)[1]
    expect(updates[`peerHelp/${L}/r1/inbox/pushed`]).toMatchObject({
      kind: 'note',
      text: 'Try a colon',
      line: 3,
      reviewItemId: 'i1',
    })
    expect(updates[`peerHelp/${L}/r1/review/i1/status`]).toBe('approved')
  })

  it('"End all peer help" pauses claims and ends every open request', async () => {
    fb.values[`peerHelp/${L}`] = { r1: {}, r2: { state: { endedAt: 1 } } }
    const { result } = render({
      role: 'teacher',
      session: {
        currentTaskId: 2,
        peerHelpOffers: { r1: { taskId: 2 }, r2: { taskId: 2, endedAt: 1 } },
      },
    })
    await act(() => result.current.pauseAllPeerHelp())
    const updates = fb.update.mock.calls.at(-1)[1]
    expect(updates[`sessions/${L}/peerHelpSettings/pausedAt`]).toEqual(expect.any(Number))
    expect(updates[`sessions/${L}/peerHelpOffers/r1/endedAt`]).toEqual(expect.any(Number))
    expect(updates[`peerHelp/${L}/r1/state/endedBy`]).toBe('teacher')
    expect(updates).not.toHaveProperty(`peerHelp/${L}/r2/state/endedBy`)
    expect(updates[`peerHelpRequests/${L}`]).toBeNull()
  })

  it('ends requests from an earlier task when the class moves on', () => {
    fb.values[`peerHelpRequests/${L}`] = { s1: { requestId: 'r1', taskId: 1 } }
    fb.values[`peerHelp/${L}`] = { r1: {} }
    render({
      role: 'teacher',
      session: { currentTaskId: 2, peerHelpOffers: { r1: { taskId: 1 } } },
    })
    const updates = fb.update.mock.calls.at(-1)[1]
    expect(updates[`peerHelp/${L}/r1/state/endedBy`]).toBe('task_changed')
    expect(updates[`sessions/${L}/peerHelpOffers/r1/endedAt`]).toEqual(expect.any(Number))
    expect(updates[`peerHelpRequests/${L}/s1`]).toBeNull()
  })
})
