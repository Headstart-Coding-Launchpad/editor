// Live badges data in useSession: badge decisions (write-if-absent transactions), badge settings,
// the student signals (first-occurrence and per-run), attemptLog.error, pasteLog.firstAt and the
// teacher-sandbox archive (docs/agents/runtime-model.md, "Badge data").
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'
import { ARCHIVE_TRUNCATION_MARKER } from '../../../badges/sessionArchive.js'

const SERVER_TIME = { '.sv': 'timestamp' }

// A tiny in-memory store for transactions, so write-if-absent can be exercised for real.
const store = new Map()

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  onValue: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  push: vi.fn(),
  onDisconnect: vi.fn(() => ({
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  })),
  get: vi.fn(() => Promise.resolve({ val: () => null })),
  runTransaction: vi.fn(),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => firebaseMocks.ref(...args),
  onValue: (...args) => firebaseMocks.onValue(...args),
  set: (...args) => firebaseMocks.set(...args),
  update: (...args) => firebaseMocks.update(...args),
  remove: (...args) => firebaseMocks.remove(...args),
  push: (...args) => firebaseMocks.push(...args),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
  onDisconnect: (...args) => firebaseMocks.onDisconnect(...args),
  get: (...args) => firebaseMocks.get(...args),
  runTransaction: (...args) => firebaseMocks.runTransaction(...args),
}))

vi.mock('../../../shared/firebase', () => ({ db: {} }))

const LESSON = 'lesson-1'
const STUDENT = 'student-abc'
let sessionCallback = null
let pushCount = 0

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  sessionCallback = null
  pushCount = 0
  firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
  firebaseMocks.set.mockResolvedValue(undefined)
  firebaseMocks.update.mockResolvedValue(undefined)
  firebaseMocks.remove.mockResolvedValue(undefined)
  firebaseMocks.get.mockResolvedValue({ val: () => null })
  firebaseMocks.push.mockImplementation((parentRef) => {
    pushCount += 1
    return { path: `${parentRef.path}/push-${pushCount}`, key: `push-${pushCount}` }
  })
  firebaseMocks.runTransaction.mockImplementation(async (refObj, apply) => {
    const next = apply(store.has(refObj.path) ? store.get(refObj.path) : null)
    if (next === undefined) {
      return { committed: false, snapshot: { val: () => store.get(refObj.path) ?? null } }
    }
    store.set(refObj.path, next)
    return { committed: true, snapshot: { val: () => next } }
  })
  firebaseMocks.onValue.mockImplementation((refObj, callback) => {
    if (!refObj.path.startsWith('.info/')) sessionCallback = callback
    return vi.fn()
  })
})

function renderSession(data) {
  const hook = renderHook(() => useSession(LESSON))
  if (data !== undefined) fireSession(data)
  return hook
}

function fireSession(data) {
  act(() => {
    sessionCallback?.({ exists: () => data !== null, val: () => data })
  })
}

const setCallsTo = (path) => firebaseMocks.set.mock.calls.filter(([r]) => r.path === path)
const updateCallsTo = (path) => firebaseMocks.update.mock.calls.filter(([r]) => r.path === path)

describe('badge decisions', () => {
  const path = `sessions/${LESSON}/badges/${STUDENT}/bug_hunter`

  it('writes a decision only when none exists (two tabs cannot both award)', async () => {
    const { result } = renderSession({ state: 'active' })
    let first, second
    await act(async () => {
      first = await result.current.decideBadge(STUDENT, 'bug_hunter', {
        status: 'awarded',
        source: 'auto',
        reason: 'First to fix the bug in “Task 6”',
        taskId: 6,
      })
      second = await result.current.decideBadge(STUDENT, 'bug_hunter', {
        status: 'dismissed',
        source: 'rule',
      })
    })
    expect(first.committed).toBe(true)
    expect(first.decision).toEqual({
      status: 'awarded',
      source: 'auto',
      reason: 'First to fix the bug in “Task 6”',
      taskId: 6,
      announce: true,
      bulkId: null,
      decidedAt: SERVER_TIME,
    })
    expect(second.committed).toBe(false)
    expect(second.decision.status).toBe('awarded')
    expect(store.get(path).status).toBe('awarded')
  })

  it('lets a later decision replace only the statuses it names', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.decideBadge(STUDENT, 'bug_hunter', {
        status: 'dismissed',
        source: 'rule',
      })
    })
    let award
    await act(async () => {
      award = await result.current.decideBadge(
        STUDENT,
        'bug_hunter',
        { status: 'awarded', source: 'manual', announce: false },
        { replaceStatuses: ['dismissed'] }
      )
    })
    expect(award.committed).toBe(true)
    expect(store.get(path)).toMatchObject({ status: 'awarded', source: 'manual', announce: false })
  })

  it("stores a catalogue badge's display snapshot on the decision", async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.decideBadge(STUDENT, 'star_helper', {
        status: 'awarded',
        source: 'manual',
        badge: { emoji: '🌟', title: 'Star Helper', blurb: 'Helped out.' },
      })
      await result.current.decideBadge(STUDENT, 'bug_hunter', {
        status: 'awarded',
        source: 'manual',
        badge: null,
      })
    })
    expect(store.get(`sessions/${LESSON}/badges/${STUDENT}/star_helper`).badge).toEqual({
      emoji: '🌟',
      title: 'Star Helper',
      blurb: 'Helped out.',
    })
    expect(store.get(path)).not.toHaveProperty('badge')
  })

  it('revokes an awarded badge and leaves anything else alone', async () => {
    const { result } = renderSession({ state: 'active' })
    let missing, revoked
    await act(async () => {
      missing = await result.current.revokeBadge(STUDENT, 'bug_hunter')
      await result.current.decideBadge(STUDENT, 'bug_hunter', { status: 'awarded', source: 'rule' })
      revoked = await result.current.revokeBadge(STUDENT, 'bug_hunter')
    })
    expect(missing.committed).toBe(false)
    expect(revoked.committed).toBe(true)
    expect(store.get(path)).toMatchObject({ status: 'revoked', revokedAt: SERVER_TIME })
  })

  it('updates only the badge settings given', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.setBadgeSettings({ autoAward: 1 })
      await result.current.setBadgeSettings({})
    })
    expect(firebaseMocks.update).toHaveBeenCalledTimes(1)
    expect(firebaseMocks.update).toHaveBeenCalledWith(
      { path: `sessions/${LESSON}/badgeSettings` },
      { autoAward: true }
    )
  })
})

describe('session lifetime', () => {
  it('createSession clears badges, badge settings, signals and the sandbox archive', async () => {
    const { result } = renderSession(null)
    await act(async () => {
      await result.current.createSession()
    })
    expect(setCallsTo(`sessions/${LESSON}`)[0][1]).toMatchObject({
      badges: null,
      badgeSettings: null,
      studentSignals: null,
      sandboxEnteredAt: null,
    })
    expect(firebaseMocks.remove).toHaveBeenCalledWith({ path: `sessionArchive/${LESSON}` })
  })

  it('endSession keeps badges and signals', async () => {
    const { result } = renderSession({ state: 'active', badges: { [STUDENT]: {} } })
    await act(async () => {
      await result.current.endSession()
    })
    const [[, updates]] = updateCallsTo(`sessions/${LESSON}`)
    expect(updates.state).toBe('ended')
    expect(updates).not.toHaveProperty('badges')
    expect(updates).not.toHaveProperty('studentSignals')
    expect(updates).not.toHaveProperty('badgeSettings')
  })

  it('ending from the sandbox closes the open archive visit at endedAt', async () => {
    const { result } = renderSession({ state: 'sandbox', sandboxEnteredAt: 1000 })
    await act(async () => {
      await result.current.endSession()
    })
    const [[, visit]] = updateCallsTo(`sessionArchive/${LESSON}/visits/1000`)
    const [[, session]] = updateCallsTo(`sessions/${LESSON}`)
    expect(visit.exitedAt).toBe(session.endedAt)
    expect(session.sandboxEnteredAt).toBe(null)
  })
})

describe('teacher-sandbox archive', () => {
  it('enterSandbox opens a visit with the task it followed and the first push', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    const { result } = renderSession({ state: 'active', currentTaskId: 7 })
    await act(async () => {
      await result.current.enterSandbox({ code: 'print(1)', previousTaskId: 4 })
    })
    expect(updateCallsTo(`sessions/${LESSON}`)[0][1]).toMatchObject({
      state: 'sandbox',
      sandboxEnteredAt: 5000,
    })
    expect(setCallsTo(`sessionArchive/${LESSON}/visits/5000`)[0][1]).toEqual({
      enteredAt: 5000,
      exitedAt: null,
      previousTaskId: 4,
      explainer: null,
    })
    expect(setCallsTo(`sessionArchive/${LESSON}/visits/5000/pushes/push-1`)[0][1]).toEqual({
      at: 5000,
      code: 'print(1)',
    })
    vi.restoreAllMocks()
  })

  it('archives pushes, the explainer and file pushes with encoded keys while in the sandbox', async () => {
    const { result } = renderSession({ state: 'sandbox', sandboxEnteredAt: 1000 })
    await act(async () => {
      await result.current.pushSandboxCode('x = 1')
      await result.current.pushSandboxFiles([{ name: 'index.html', content: '<p>' }])
      await result.current.pushSandboxExplainer('Try a loop')
    })
    const pushes = firebaseMocks.set.mock.calls
      .filter(([r]) => r.path.startsWith(`sessionArchive/${LESSON}/visits/1000/pushes/`))
      .map(([, value]) => value)
    expect(pushes).toEqual([
      expect.objectContaining({ code: 'x = 1' }),
      expect.objectContaining({ files: { index__dot__html: '<p>' } }),
      expect.objectContaining({ explainer: 'Try a loop' }),
    ])
    expect(updateCallsTo(`sessionArchive/${LESSON}/visits/1000`)[0][1]).toEqual({
      explainer: 'Try a loop',
    })
  })

  it('archives nothing for a push outside the sandbox', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.pushSandboxCode('x = 1')
    })
    expect(firebaseMocks.set).not.toHaveBeenCalled()
  })

  it('exitSandbox records the exit time', async () => {
    const { result } = renderSession({ state: 'sandbox', sandboxEnteredAt: 1000 })
    await act(async () => {
      await result.current.exitSandbox()
    })
    expect(updateCallsTo(`sessionArchive/${LESSON}/visits/1000`)[0][1]).toHaveProperty('exitedAt')
    expect(updateCallsTo(`sessions/${LESSON}`)[0][1].sandboxEnteredAt).toBe(null)
  })

  it('caps a student snapshot at 20 KB with a truncation marker', async () => {
    const { result } = renderSession({ state: 'sandbox', sandboxEnteredAt: 1000 })
    await act(async () => {
      await result.current.archiveSandboxStudentSnapshot(STUDENT, {
        code: 'x'.repeat(30 * 1024),
        at: 1234,
      })
    })
    const [[, snapshot]] = setCallsTo(
      `sessionArchive/${LESSON}/visits/1000/studentSnapshots/${STUDENT}`
    )
    expect(snapshot.at).toBe(1234)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.code.endsWith(ARCHIVE_TRUNCATION_MARKER)).toBe(true)
  })

  it('a failed archive write never breaks the sandbox', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    firebaseMocks.set.mockRejectedValue(new Error('PERMISSION_DENIED'))
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.enterSandbox({ code: 'x' })
    })
    expect(updateCallsTo(`sessions/${LESSON}`)[0][1].state).toBe('sandbox')
    warn.mockRestore()
  })

  it('readSessionArchive reads once and fills a missing exit from endedAt', async () => {
    firebaseMocks.get.mockResolvedValue({
      val: () => ({ visits: { 1000: { enteredAt: 1000, previousTaskId: 3 } } }),
    })
    const { result } = renderSession({ state: 'sandbox', sandboxEnteredAt: 1000 })
    let archive
    await act(async () => {
      archive = await result.current.readSessionArchive({ endedAt: 4000 })
    })
    expect(firebaseMocks.get).toHaveBeenCalledWith({ path: `sessionArchive/${LESSON}` })
    expect(archive.visits[0]).toMatchObject({ exitedAt: 4000, durationMs: 3000, previousTaskId: 3 })
  })
})

describe('attemptLog error and pasteLog firstAt', () => {
  it('stores the error on a new attempt, null when there was none', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.logAttempt(STUDENT, 3, {
        submission: 'a',
        passed: false,
        error: 'NameError',
      })
      await result.current.logAttempt(STUDENT, 4, { submission: 'b', passed: true })
    })
    const values = firebaseMocks.set.mock.calls.map(([, value]) => value)
    expect(values[0].error).toBe('NameError')
    expect(values[1].error).toBe(null)
  })

  it('flags the latest logged attempt when an error arrives late', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.logAttempt(STUDENT, 3, { submission: 'a', passed: true })
      await result.current.flagAttemptError(STUDENT, 3, 'TypeError')
      await result.current.flagAttemptError(STUDENT, 9, true)
    })
    expect(firebaseMocks.update).toHaveBeenCalledTimes(1)
    expect(firebaseMocks.update).toHaveBeenCalledWith(
      { path: `sessions/${LESSON}/attemptLog/${STUDENT}/3/push-1` },
      { error: 'TypeError' }
    )
  })

  it('sets pasteLog.firstAt on the first paste only', async () => {
    const { result } = renderSession({ state: 'active', students: { [STUDENT]: {} } })
    await act(async () => {
      await result.current.recordStudentPaste(STUDENT, 3, { chars: 200 })
      await result.current.recordStudentPaste(STUDENT, 3, { chars: 100 })
    })
    const [first, second] = firebaseMocks.update.mock.calls.map(([, value]) => value)
    expect(first.firstAt).toEqual(SERVER_TIME)
    expect(second).not.toHaveProperty('firstAt')
  })

  it('does not reset firstAt once the snapshot has it', async () => {
    const { result } = renderSession({
      state: 'active',
      students: { [STUDENT]: { pasteLog: { 3: { count: 1, chars: 10, firstAt: 1 } } } },
    })
    await act(async () => {
      await result.current.recordStudentPaste(STUDENT, 3, { chars: 200 })
    })
    expect(firebaseMocks.update.mock.calls[0][1]).not.toHaveProperty('firstAt')
  })
})

describe('student signals', () => {
  const signals = `sessions/${LESSON}/studentSignals/${STUDENT}`

  it('writes each first-occurrence signal once', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordFirstEditSignal(STUDENT, 3, 4200.6)
      await result.current.recordFirstEditSignal(STUDENT, 3, 9000)
      await result.current.recordShortcutSignal(STUDENT, 'run', { context: 'task', taskId: 3 })
      await result.current.recordShortcutSignal(STUDENT, 'run', { context: 'sandbox' })
      await result.current.recordAutocompleteSignal(STUDENT, { context: 'personal' })
      await result.current.recordAutocompleteSignal(STUDENT, { context: 'task', taskId: 3 })
      await result.current.recordCompleteShownSignal(STUDENT, 3, 'preview')
      await result.current.recordCompleteShownSignal(STUDENT, 3, 'show')
    })
    expect(setCallsTo(`${signals}/firstEdits/3`)).toEqual([
      [{ path: `${signals}/firstEdits/3` }, { elapsedMs: 4201, at: SERVER_TIME }],
    ])
    expect(setCallsTo(`${signals}/shortcuts/run`)).toEqual([
      [
        { path: `${signals}/shortcuts/run` },
        { firstUsedAt: SERVER_TIME, context: 'task', taskId: 3 },
      ],
    ])
    expect(setCallsTo(`${signals}/autocomplete`)).toEqual([
      [
        { path: `${signals}/autocomplete` },
        { firstUsedAt: SERVER_TIME, context: 'personal', taskId: null },
      ],
    ])
    expect(setCallsTo(`${signals}/completeShown/3`)).toEqual([
      [{ path: `${signals}/completeShown/3` }, { at: SERVER_TIME, via: 'preview' }],
    ])
  })

  it('skips a signal already in the session snapshot (e.g. after a reload)', async () => {
    const { result } = renderSession({
      state: 'active',
      studentSignals: { [STUDENT]: { firstEdits: { 3: { elapsedMs: 1 } } } },
    })
    await act(async () => {
      await result.current.recordFirstEditSignal(STUDENT, 3, 5000)
    })
    expect(firebaseMocks.set).not.toHaveBeenCalled()
  })

  it('treats a refused write (another tab got there first) as done', async () => {
    firebaseMocks.set.mockRejectedValueOnce(new Error('PERMISSION_DENIED'))
    const { result } = renderSession({ state: 'active' })
    let wrote
    await act(async () => {
      wrote = await result.current.recordShortcutSignal(STUDENT, 'undo')
    })
    expect(wrote).toBe(false)
  })

  it('records a topic open per context, task and topic, with RTDB-safe keys', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordTopicOpenSignal(STUDENT, {
        context: 'task',
        taskId: 3,
        topicId: 'python.loops',
        via: 'link',
      })
      await result.current.recordTopicOpenSignal(STUDENT, {
        context: 'sandbox',
        taskId: 3,
        topicId: 'python.loops',
        via: 'list',
      })
      await result.current.recordTopicOpenSignal(STUDENT, {
        context: 'nowhere',
        taskId: 3,
        topicId: 'x',
      })
    })
    expect(setCallsTo(`${signals}/topics/task/3/python__dot__loops`)[0][1]).toEqual({
      openedAt: SERVER_TIME,
      source: 'student',
      via: 'link',
    })
    expect(setCallsTo(`${signals}/topics/sandbox/3/python__dot__loops`)).toHaveLength(1)
    expect(firebaseMocks.set).toHaveBeenCalledTimes(2)
  })

  it("records the student's own open of a topic the teacher sent", async () => {
    const { result } = renderSession({
      state: 'active',
      studentSignals: {
        [STUDENT]: { topics: { task: { 3: { loops: { openedAt: 1, source: 'teacher' } } } } },
      },
    })
    await act(async () => {
      await result.current.recordTopicOpenSignal(STUDENT, {
        taskId: 3,
        topicId: 'loops',
        source: 'teacher',
      })
      await result.current.recordTopicOpenSignal(STUDENT, { taskId: 3, topicId: 'loops' })
    })
    expect(setCallsTo(`${signals}/topics/task/3/loops`)).toHaveLength(1)
    expect(setCallsTo(`${signals}/topics/task/3/loops`)[0][1].source).toBe('student')
  })

  it('counts sandbox runs in a transaction on the right node', async () => {
    const { result } = renderSession({ state: 'sandbox' })
    await act(async () => {
      await result.current.recordSandboxRunSignal(STUDENT, 'session', {
        error: 'NameError',
        submissionHash: 'a',
      })
      await result.current.recordSandboxRunSignal(STUDENT, 'session', { submissionHash: 'b' })
      await result.current.addSandboxTimeSignal(STUDENT, 'session', 4000)
      await result.current.recordSandboxRunSignal(STUDENT, 'elsewhere', {})
    })
    expect(store.get(`${signals}/sandbox/session`)).toMatchObject({
      runs: 2,
      errorRuns: 1,
      fixes: 1,
      timeMs: 4000,
    })
    expect(store.get(`${signals}/sandbox/session`).runsLog[0]).toEqual({
      at: SERVER_TIME,
      error: 'NameError',
      submissionHash: 'a',
    })
    expect(firebaseMocks.runTransaction).toHaveBeenCalledTimes(3)
  })

  it('marks a late sandbox error on the latest run', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordSandboxRunSignal(STUDENT, 'personal', { submissionHash: 'a' })
      await result.current.flagSandboxRunError(STUDENT, 'personal', 'TypeError')
    })
    expect(store.get(`${signals}/sandbox/personal`)).toMatchObject({ runs: 1, errorRuns: 1 })
  })
})
