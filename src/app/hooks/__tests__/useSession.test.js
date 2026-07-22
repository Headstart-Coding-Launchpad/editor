import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useSession } from '../useSession'

const firebaseMocks = vi.hoisted(() => ({
  ref:         vi.fn((_db, path) => ({ path })),
  onValue:     vi.fn(),
  set:         vi.fn(() => Promise.resolve()),
  update:      vi.fn(() => Promise.resolve()),
  remove:      vi.fn(() => Promise.resolve()),
  push:        vi.fn(parentRef => ({ path: `${parentRef.path}/mockHighlightId`, key: 'mockHighlightId' })),
  onDisconnect: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })),
}))

vi.mock('firebase/database', () => ({
  ref:          (...args) => firebaseMocks.ref(...args),
  onValue:      (...args) => firebaseMocks.onValue(...args),
  set:          (...args) => firebaseMocks.set(...args),
  update:       (...args) => firebaseMocks.update(...args),
  remove:       (...args) => firebaseMocks.remove(...args),
  push:         (...args) => firebaseMocks.push(...args),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
  onDisconnect: (...args) => firebaseMocks.onDisconnect(...args),
}))

vi.mock('../../../shared/firebase', () => ({
  db: {},
}))

describe('useSession', () => {
  let sessionCallback = null
  let connCallback    = null

  beforeEach(() => {
    vi.clearAllMocks()
    sessionCallback = null
    connCallback    = null

    firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
    firebaseMocks.set.mockResolvedValue(undefined)
    firebaseMocks.update.mockResolvedValue(undefined)
    firebaseMocks.remove.mockResolvedValue(undefined)

    firebaseMocks.onValue.mockImplementation((refObj, callback) => {
      if (refObj.path === '.info/connected') {
        connCallback = callback
      } else {
        sessionCallback = callback
      }
      return vi.fn() // unsubscribe
    })
  })

  function fireSession(data) {
    act(() => {
      sessionCallback?.({
        exists: () => data !== null,
        val:    () => data,
      })
    })
  }

  // ─── Disabled mode ──────────────────────────────────────────────────────────

  it('does not subscribe to Realtime Database when disabled', () => {
    const { result } = renderHook(() => useSession('python-1-1', { enabled: false }))
    expect(result.current.session).toBe(null)
    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(null)
    expect(firebaseMocks.ref).not.toHaveBeenCalled()
    expect(firebaseMocks.onValue).not.toHaveBeenCalled()
  })

  // ─── Session state sync ─────────────────────────────────────────────────────

  describe('session state sync', () => {
    it('exposes the session object after onValue fires', () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({ state: 'waiting', currentTaskId: 1, isPaused: false })
      expect(result.current.session).toMatchObject({ state: 'waiting', currentTaskId: 1 })
    })

    it('reflects state: "waiting" from the snapshot', () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({ state: 'waiting', currentTaskId: 1, isPaused: false })
      expect(result.current.session?.state).toBe('waiting')
    })

    it('reflects isPaused: true from the snapshot', () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({ state: 'active', currentTaskId: 1, isPaused: true })
      expect(result.current.session?.isPaused).toBe(true)
    })

    it('sets session to null when the snapshot has no data', () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession(null)
      expect(result.current.session).toBeNull()
    })

    it('clears loading after the first snapshot arrives', () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      expect(result.current.loading).toBe(true)
      fireSession({ state: 'active', currentTaskId: 1, isPaused: false })
      expect(result.current.loading).toBe(false)
    })
  })

  // ─── Teacher commands ───────────────────────────────────────────────────────

  describe('startSession', () => {
    it('writes state: "active" and timestamps via firebase update', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.startSession() })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ state: 'active', startedAt: expect.any(Number) }),
      )
    })
  })

  describe('setTaskId', () => {
    it('writes currentTaskId and currentTaskStartedAt via firebase update', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.setTaskId(3) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ currentTaskId: 3, currentTaskStartedAt: expect.any(Number) }),
      )
    })

    it('resets explainerShowComplete to false on task change', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.setTaskId(3) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ explainerShowComplete: false }),
      )
    })
  })

  describe('setExplainerShowComplete', () => {
    it('writes explainerShowComplete: true via firebase update', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.setExplainerShowComplete(true) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        { explainerShowComplete: true },
      )
    })

    it('coerces truthy/falsy values to booleans', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.setExplainerShowComplete(0) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        { explainerShowComplete: false },
      )
    })
  })

  describe('endSession', () => {
    it('writes state: "ended" via firebase update', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.endSession() })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ state: 'ended', endedAt: expect.any(Number) }),
      )
    })

    it('clears any session-only lesson override so a restart starts from the published lesson', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.endSession() })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ lessonOverrideTasks: null }),
      )
    })
  })

  describe('createSession', () => {
    it('initialises lessonOverrideTasks to null', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.createSession() })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ lessonOverrideTasks: null }),
      )
    })

    it('initialises explainerShowComplete to false', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.createSession() })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({ explainerShowComplete: false }),
      )
    })
  })

  describe('setTeacherLive', () => {
    it('encodes dotted file keys before writing, so HTML lessons do not break Realtime Database key rules', async () => {
      const { result } = renderHook(() => useSession('html-1-1'))
      await act(async () => {
        await result.current.setTeacherLive({
          source: 'teacher',
          taskId: 1,
          files: { 'index.html': '<main />', 'style.css': 'body {}' },
        })
      })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/html-1-1/teacherLive' },
        expect.objectContaining({
          files: { index__dot__html: '<main />', style__dot__css: 'body {}' },
        }),
      )
    })

    it('clears the teacherLive node when called with null', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.setTeacherLive(null) })
      expect(firebaseMocks.set).toHaveBeenCalledWith({ path: 'sessions/lesson-1/teacherLive' }, null)
    })
  })

  describe('updateTeacherLive', () => {
    it('encodes dotted file keys before writing via update', async () => {
      const { result } = renderHook(() => useSession('html-2-1'))
      await act(async () => {
        await result.current.updateTeacherLive({ files: { 'index.html': '<main />' } })
      })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/html-2-1/teacherLive' },
        expect.objectContaining({ files: { index__dot__html: '<main />' } }),
      )
    })

    it('leaves payloads without a files map untouched', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.updateTeacherLive({ output: 'hi' }) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/teacherLive' },
        expect.objectContaining({ output: 'hi' }),
      )
    })
  })

  describe('pushLessonOverride', () => {
    it('writes the tasks array to the session lessonOverrideTasks path', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      const tasks = [{ id: 1, title: 'Edited' }]
      await act(async () => { await result.current.pushLessonOverride(tasks) })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/lessonOverrideTasks' },
        tasks,
      )
    })
  })

  describe('clearLessonOverride', () => {
    it('clears the lessonOverrideTasks path back to null', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.clearLessonOverride() })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/lessonOverrideTasks' },
        null,
      )
    })
  })

  describe('renameStudent', () => {
    it('writes the new name to the student displayName path', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.renameStudent('student-123', 'Alex') })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-123/displayName' },
        'Alex',
      )
    })
  })

  // ─── Student sync ───────────────────────────────────────────────────────────

  describe('overrideStudentCheck', () => {
    it('records override metadata when a teacher manually passes a failed student', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({
        currentTaskId: 1,
        students: { 'student-abc': { checkPassed: false } },
        attemptLog: {
          'student-abc': {
            1: {
              k1: { attemptNumber: 1, retries: 2, passed: false },
            },
          },
        },
      })

      await act(async () => {
        await result.current.overrideStudentCheck('student-abc', true, null, 1)
      })

      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        expect.objectContaining({
          'students/student-abc/checkOverridePassed': true,
          'students/student-abc/checkOverrideHint': null,
          'students/student-abc/checkOverridePushedAt': expect.any(Number),
          'overrideLog/student-abc/1': {
            taskId: 1,
            overriddenAt: { '.sv': 'timestamp' },
            attemptNumber: 3,
            previousCheckState: 'failed',
          },
        }),
      )
    })

    it('does not record override metadata when the teacher applies a fail override', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({ currentTaskId: 1, students: { 'student-abc': { checkPassed: false } } })

      await act(async () => {
        await result.current.overrideStudentCheck('student-abc', false, 'Try again', 1)
      })

      const [, updates] = firebaseMocks.update.mock.calls.at(-1)
      expect(updates).toMatchObject({
        'students/student-abc/checkOverridePassed': false,
        'students/student-abc/checkOverrideHint': 'Try again',
      })
      expect(updates).not.toHaveProperty('overrideLog/student-abc/1')
    })
  })

  describe('recordClassAdvanceOverrides', () => {
    it('records overrides for students who have not passed the task being left', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({
        currentTaskId: 1,
        students: {
          alice: { checkPassed: false },
          bob: { checkPassed: true },
          cara: { checkPassed: false },
          dana: { checkOverridePassed: true },
        },
        attemptLog: {
          alice: {
            1: {
              k1: { attemptNumber: 1, retries: 0, passed: false },
              k2: { attemptNumber: 2, retries: 1, passed: false },
            },
          },
        },
      })

      await act(async () => {
        await result.current.recordClassAdvanceOverrides(1)
      })

      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1' },
        {
          'overrideLog/alice/1': {
            taskId: 1,
            overriddenAt: { '.sv': 'timestamp' },
            attemptNumber: 3,
            previousCheckState: 'failed',
          },
          'overrideLog/cara/1': {
            taskId: 1,
            overriddenAt: { '.sv': 'timestamp' },
            attemptNumber: 0,
            previousCheckState: 'unattempted',
          },
        },
      )
    })

    it('does nothing when every student has already passed or been manually passed', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      fireSession({
        currentTaskId: 1,
        students: {
          alice: { checkPassed: true },
          bob: { checkOverridePassed: true },
        },
      })

      await act(async () => {
        await result.current.recordClassAdvanceOverrides(1)
      })

      expect(firebaseMocks.update).not.toHaveBeenCalled()
    })
  })

  describe('writeStudentCode', () => {
    it('writes code to the student currentCode path', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.writeStudentCode('student-abc', 'print("hi")') })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-abc/currentCode' },
        'print("hi")',
      )
    })

    it('writes to whichever student ID is provided — the activeStudentView guard lives at the call site', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.writeStudentCode('watched-student', 'x = 1') })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/watched-student/currentCode' },
        'x = 1',
      )
    })
  })

  // ─── Remote reset ───────────────────────────────────────────────────────────

  describe('pushResetToStudent', () => {
    it('writes remoteResetAction and remoteResetPushedAt to the student node', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.pushResetToStudent('student-xyz', 'complete') })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-xyz' },
        expect.objectContaining({
          remoteResetAction:   'complete',
          remoteResetPushedAt: expect.any(Number),
        }),
      )
    })
  })

  describe('pushTeacherHighlight', () => {
    it('encodes the file key and writes a new entry under a push()-generated id', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => {
        await result.current.pushTeacherHighlight('student-xyz', {
          file: 'index.html', from: 12, to: 34, emoji: '✅', note: 'Nice work',
        })
      })
      expect(firebaseMocks.push).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-xyz/teacherHighlights' },
      )
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-xyz/teacherHighlights/mockHighlightId', key: 'mockHighlightId' },
        expect.objectContaining({
          file: 'index__dot__html',
          from: 12,
          to: 34,
          emoji: '✅',
          note: 'Nice work',
          createdAt: expect.any(Number),
        }),
      )
    })

    it('defaults a missing note to null', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => {
        await result.current.pushTeacherHighlight('student-xyz', { file: '', from: 0, to: 4, emoji: '❓' })
      })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ note: null }),
      )
    })
  })

  describe('logAttempt', () => {
    it('pushes a new attempt entry on first submission for a task', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => {
        await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false, suggestion: 'try again' })
      })
      expect(firebaseMocks.push).toHaveBeenCalledWith({ path: 'sessions/lesson-1/attemptLog/student-abc/1' })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/attemptLog/student-abc/1/mockHighlightId', key: 'mockHighlightId' },
        expect.objectContaining({
          submission: 'code v1', passed: false, suggestion: 'try again', attemptNumber: 1, retries: 0,
        }),
      )
    })

    it('bumps retries instead of pushing a new entry when the submission is unchanged', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => {
        await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false })
      })
      firebaseMocks.push.mockClear()
      firebaseMocks.update.mockClear()
      await act(async () => {
        await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false })
      })
      expect(firebaseMocks.push).not.toHaveBeenCalled()
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/attemptLog/student-abc/1/mockHighlightId' },
        { retries: 1 },
      )
    })

    it('pushes a new entry with an incremented attempt number when the submission changes', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false }) })
      firebaseMocks.push.mockClear()
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v2', passed: true }) })
      expect(firebaseMocks.push).toHaveBeenCalledWith({ path: 'sessions/lesson-1/attemptLog/student-abc/1' })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ submission: 'code v2', passed: true, attemptNumber: 2, retries: 0 }),
      )
    })

    it('marks the cached entry passed instead of pushing when a retried submission later passes', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false }) })
      firebaseMocks.update.mockClear()
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: true }) })
      expect(firebaseMocks.update).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/attemptLog/student-abc/1/mockHighlightId' },
        expect.objectContaining({ retries: 1, passed: true }),
      )
    })

    it('stamps passedAt the moment an attempt first becomes passed', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: false }) })
      firebaseMocks.update.mockClear()
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: true }) })
      const [, updates] = firebaseMocks.update.mock.calls.at(-1)
      expect(Object.keys(updates)).toContain('passedAt')
    })

    it('stamps passedAt on a first-submission pass', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => {
        await result.current.logAttempt('student-xyz', 1, { submission: 'code v1', passed: true })
      })
      const [, entry] = firebaseMocks.set.mock.calls.at(-1)
      expect(Object.keys(entry)).toContain('passedAt')
    })

    it('stops logging further attempts once a task has been passed', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v1', passed: true }) })
      firebaseMocks.push.mockClear()
      firebaseMocks.update.mockClear()
      firebaseMocks.set.mockClear()
      await act(async () => { await result.current.logAttempt('student-abc', 1, { submission: 'code v2', passed: false }) })
      expect(firebaseMocks.push).not.toHaveBeenCalled()
      expect(firebaseMocks.update).not.toHaveBeenCalled()
      expect(firebaseMocks.set).not.toHaveBeenCalled()
    })
  })

  describe('removeTeacherHighlight', () => {
    it('clears a single highlight entry by id', async () => {
      const { result } = renderHook(() => useSession('lesson-1'))
      await act(async () => { await result.current.removeTeacherHighlight('student-xyz', 'highlight-1') })
      expect(firebaseMocks.set).toHaveBeenCalledWith(
        { path: 'sessions/lesson-1/students/student-xyz/teacherHighlights/highlight-1' },
        null,
      )
    })
  })
})
