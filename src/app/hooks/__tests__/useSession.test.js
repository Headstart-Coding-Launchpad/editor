import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useSession } from '../useSession'

const firebaseMocks = vi.hoisted(() => ({
  ref:         vi.fn((_db, path) => ({ path })),
  onValue:     vi.fn(),
  set:         vi.fn(() => Promise.resolve()),
  update:      vi.fn(() => Promise.resolve()),
  remove:      vi.fn(() => Promise.resolve()),
  onDisconnect: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })),
}))

vi.mock('firebase/database', () => ({
  ref:          (...args) => firebaseMocks.ref(...args),
  onValue:      (...args) => firebaseMocks.onValue(...args),
  set:          (...args) => firebaseMocks.set(...args),
  update:       (...args) => firebaseMocks.update(...args),
  remove:       (...args) => firebaseMocks.remove(...args),
  serverTimestamp: vi.fn(),
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
})
