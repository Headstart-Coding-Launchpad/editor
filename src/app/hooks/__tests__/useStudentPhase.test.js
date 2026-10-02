import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { END_SCREEN_RESTORE_MS, useStudentPhase } from '../useStudentPhase'

// Prevent window.close() from actually closing the jsdom window and breaking subsequent tests
vi.stubGlobal('close', vi.fn())

function makeSession(overrides = {}) {
  return {
    state: 'active',
    createdAt: 1000,
    currentTaskId: 1,
    students: {},
    ...overrides,
  }
}

function makeIdentity(overrides = {}) {
  return {
    anonymousId: 'anon-1',
    displayName: 'Alice',
    lastSessionTimestamp: 1000,
    ...overrides,
  }
}

function defaultProps(overrides = {}) {
  return {
    session: null,
    sessionLoading: false,
    identity: null,
    identityLoaded: true,
    lessonId: 'lesson-1',
    lessonLoading: false,
    soloMode: false,
    teacherPresentation: false,
    firstTaskId: 1,
    onBeforeTaskChange: vi.fn(),
    onPersonalSandboxExit: vi.fn(),
    onTaskReset: vi.fn(),
    createIdentity: vi.fn((displayName, ts) => ({
      anonymousId: 'anon-1',
      displayName,
      lastSessionTimestamp: ts,
    })),
    updateTimestamp: vi.fn(),
    joinSession: vi.fn().mockResolvedValue(undefined),
    registerJoining: vi.fn().mockResolvedValue(undefined),
    unregisterJoining: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useStudentPhase', () => {
  describe('initial phase determination', () => {
    it('starts loading while sessionLoading is true', () => {
      const { result } = renderHook(() => useStudentPhase(defaultProps({ sessionLoading: true })))
      expect(result.current.phase).toBe('loading')
    })

    it('starts loading while lessonLoading is true', () => {
      const { result } = renderHook(() => useStudentPhase(defaultProps({ lessonLoading: true })))
      expect(result.current.phase).toBe('loading')
    })

    it('goes to choice when no session and not soloMode', async () => {
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null, soloMode: false }))
      )
      await waitFor(() => expect(result.current.phase).toBe('choice'))
    })

    it('goes to solo when no session and soloMode', async () => {
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null, soloMode: true }))
      )
      await waitFor(() => expect(result.current.phase).toBe('solo'))
    })

    it('calls createIdentity when soloMode with no identity', async () => {
      const createIdentity = vi.fn(() => ({
        anonymousId: 'solo-id',
        displayName: 'Solo',
        lastSessionTimestamp: 0,
      }))
      const props = defaultProps({ session: null, soloMode: true, identity: null, createIdentity })
      renderHook(() => useStudentPhase(props))
      await waitFor(() => expect(createIdentity).toHaveBeenCalledWith('Solo', expect.any(Number)))
    })
  })

  describe('choice phase transitions', () => {
    it('transitions from choice to name-entry when a waiting session appears (fresh arrival)', async () => {
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session: null, identity: null }),
      })
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      rerender(defaultProps({ session: makeSession({ state: 'waiting' }), identity: null }))

      await waitFor(() => expect(result.current.phase).toBe('name-entry'))
    })

    it('transitions from choice to name-entry when an active session appears with no matching identity', async () => {
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session: null, identity: null }),
      })
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      rerender(
        defaultProps({ session: makeSession({ state: 'active', createdAt: 1000 }), identity: null })
      )

      await waitFor(() => expect(result.current.phase).toBe('name-entry'))
    })

    it('transitions from choice straight to lesson when an active session appears matching a returning identity', async () => {
      const identity = makeIdentity({ lastSessionTimestamp: 1000 })
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session: null, identity }),
      })
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      rerender(
        defaultProps({
          session: makeSession({ state: 'active', createdAt: 1000, currentTaskId: 4 }),
          identity,
        })
      )

      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(result.current.currentTaskId).toBe(4)
    })
  })

  describe('live session', () => {
    it('goes to lesson when returning student with active session', async () => {
      const identity = makeIdentity({ lastSessionTimestamp: 1000 })
      const session = makeSession({ state: 'active', createdAt: 1000, currentTaskId: 3 })
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session, identity })))

      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(result.current.currentTaskId).toBe(3)
    })

    it('goes to sandbox when session state is sandbox', async () => {
      const identity = makeIdentity({ lastSessionTimestamp: 1000 })
      const session = makeSession({ state: 'sandbox', createdAt: 1000 })
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session, identity })))

      await waitFor(() => expect(result.current.phase).toBe('sandbox'))
    })

    it('goes to name-entry for new student with waiting session', async () => {
      const session = makeSession({ state: 'waiting', createdAt: 1000 })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, identity: null, identityLoaded: true }))
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))
    })

    it('goes to name-entry for unrecognised identity when session is active', async () => {
      const identity = makeIdentity({ lastSessionTimestamp: 999 }) // different timestamp
      const session = makeSession({ state: 'active', createdAt: 1000 })
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session, identity })))

      await waitFor(() => expect(result.current.phase).toBe('name-entry'))
    })

    it('calls updateTimestamp for returning students', async () => {
      const updateTimestamp = vi.fn()
      const identity = makeIdentity({ lastSessionTimestamp: 1000 })
      const session = makeSession({ state: 'active', createdAt: 1000 })
      renderHook(() => useStudentPhase(defaultProps({ session, identity, updateTimestamp })))

      await waitFor(() => expect(updateTimestamp).toHaveBeenCalledWith(1000))
    })

    it('records one rejoin when a returning student reloads into the lesson', async () => {
      const recordStudentReturn = vi.fn().mockResolvedValue(undefined)
      const identity = makeIdentity({ lastSessionTimestamp: 1000 })
      const props = (session) => defaultProps({ session, identity, recordStudentReturn })
      const { result, rerender } = renderHook((p) => useStudentPhase(p), {
        initialProps: props(makeSession({ state: 'active', createdAt: 1000, currentTaskId: 1 })),
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(recordStudentReturn).toHaveBeenCalledTimes(1)
      expect(recordStudentReturn).toHaveBeenCalledWith('anon-1')

      // Effect reruns (teacher moves on, sandbox and back) are not new returns.
      rerender(props(makeSession({ state: 'active', createdAt: 1000, currentTaskId: 2 })))
      await waitFor(() => expect(result.current.currentTaskId).toBe(2))
      rerender(props(makeSession({ state: 'sandbox', createdAt: 1000, currentTaskId: 2 })))
      await waitFor(() => expect(result.current.phase).toBe('sandbox'))
      rerender(props(makeSession({ state: 'active', createdAt: 1000, currentTaskId: 2 })))
      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(recordStudentReturn).toHaveBeenCalledTimes(1)
    })

    it('records no rejoin for a name submit (joinSession logs that) or a new student', async () => {
      const recordStudentReturn = vi.fn()
      const joinSession = vi.fn().mockResolvedValue(undefined)
      const createIdentity = vi.fn((displayName, ts) => ({
        anonymousId: 'anon-1',
        displayName,
        lastSessionTimestamp: ts,
      }))
      const session = makeSession({ state: 'active', createdAt: 1000 })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({
            session,
            identity: null,
            identityLoaded: true,
            recordStudentReturn,
            joinSession,
            createIdentity,
          })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))
      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })
      expect(result.current.phase).toBe('lesson')
      expect(joinSession).toHaveBeenCalledWith('anon-1', 'Bob')
      expect(recordStudentReturn).not.toHaveBeenCalled()
    })

    it('goes to choice from loading phase when session is ended and not soloMode', async () => {
      const session = makeSession({ state: 'ended' })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({ session, identity: null, identityLoaded: true, soloMode: false })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('choice'))
    })

    it('goes to solo from loading phase when session is ended and soloMode', async () => {
      const createIdentity = vi.fn(() => ({
        anonymousId: 'solo',
        displayName: 'Solo',
        lastSessionTimestamp: 0,
      }))
      const session = makeSession({ state: 'ended' })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({
            session,
            identity: null,
            identityLoaded: true,
            soloMode: true,
            createIdentity,
          })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('solo'))
    })
  })

  describe('teacher presentation', () => {
    it('goes to waiting when no session in presentation mode', async () => {
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null, teacherPresentation: true }))
      )
      await waitFor(() => expect(result.current.phase).toBe('waiting'))
    })

    it('goes to lesson and sets currentTaskId from session in presentation mode', async () => {
      const session = makeSession({ state: 'active', currentTaskId: 5 })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, teacherPresentation: true, identityLoaded: false }))
      )
      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(result.current.currentTaskId).toBe(5)
    })

    it('returns a student who reloads their own recently ended session to the end screen', async () => {
      const session = makeSession({ state: 'ended', endedAt: Date.now() - 60_000 })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, identity: makeIdentity() }))
      )
      await waitFor(() => expect(result.current.phase).toBe('ended'))
    })

    it('offers the choice screen for a session that ended long ago or that the student was not in', async () => {
      const old = makeSession({ state: 'ended', endedAt: Date.now() - END_SCREEN_RESTORE_MS - 1 })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: old, identity: makeIdentity() }))
      )
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      const other = makeSession({ state: 'ended', endedAt: Date.now() })
      const { result: stranger } = renderHook(() =>
        useStudentPhase(
          defaultProps({ session: other, identity: makeIdentity({ lastSessionTimestamp: 5 }) })
        )
      )
      await waitFor(() => expect(stranger.current.phase).toBe('choice'))
    })

    it('goes to ended when session state is ended in presentation mode', async () => {
      const session = makeSession({ state: 'ended' })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, teacherPresentation: true, identityLoaded: false }))
      )
      await waitFor(() => expect(result.current.phase).toBe('ended'))
    })
  })

  describe('task navigation', () => {
    it('provides setCurrentTaskId and setViewingTaskId', async () => {
      const identity = makeIdentity()
      const session = makeSession({ state: 'active' })
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session, identity })))

      await waitFor(() => expect(result.current.phase).toBe('lesson'))

      act(() => result.current.setCurrentTaskId(5))
      expect(result.current.currentTaskId).toBe(5)

      act(() => result.current.setViewingTaskId(3))
      expect(result.current.viewingTaskId).toBe(3)
    })
  })

  describe('teacher-forced task change', () => {
    it('calls onBeforeTaskChange, onPersonalSandboxExit, and onTaskReset when teacher advances task', async () => {
      const onBeforeTaskChange = vi.fn()
      const onPersonalSandboxExit = vi.fn()
      const onTaskReset = vi.fn()
      const identity = makeIdentity()
      const session = makeSession({ state: 'active', currentTaskId: 1 })
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({
          session,
          identity,
          onBeforeTaskChange,
          onPersonalSandboxExit,
          onTaskReset,
        }),
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))

      rerender(
        defaultProps({
          session: makeSession({ state: 'active', currentTaskId: 2 }),
          identity,
          onBeforeTaskChange,
          onPersonalSandboxExit,
          onTaskReset,
        })
      )

      await waitFor(() => expect(result.current.currentTaskId).toBe(2))
      expect(onBeforeTaskChange).toHaveBeenCalled()
      expect(onPersonalSandboxExit).toHaveBeenCalled()
      expect(onTaskReset).toHaveBeenCalled()
    })

    it('calls onBeforeClassAdvance first, while the leaving task is still current', async () => {
      const calls = []
      let currentTaskIdAtAutoCheck = null
      const identity = makeIdentity()
      let hookResult = null
      const onBeforeClassAdvance = vi.fn(() => {
        calls.push('autoCheck')
        currentTaskIdAtAutoCheck = hookResult?.current.currentTaskId
      })
      const onPersonalSandboxExit = vi.fn(() => calls.push('sandboxExit'))
      const onBeforeTaskChange = vi.fn(() => calls.push('save'))
      const onTaskReset = vi.fn(() => calls.push('reset'))
      const props = (session) =>
        defaultProps({
          session,
          identity,
          onBeforeClassAdvance,
          onPersonalSandboxExit,
          onBeforeTaskChange,
          onTaskReset,
        })
      const { result, rerender } = renderHook((p) => useStudentPhase(p), {
        initialProps: props(makeSession({ state: 'active', currentTaskId: 1 })),
      })
      hookResult = result
      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(onBeforeClassAdvance).not.toHaveBeenCalled()

      rerender(props(makeSession({ state: 'active', currentTaskId: 2 })))

      await waitFor(() => expect(result.current.currentTaskId).toBe(2))
      expect(onBeforeClassAdvance).toHaveBeenCalledTimes(1)
      expect(currentTaskIdAtAutoCheck).toBe(1)
      expect(calls).toEqual(['autoCheck', 'sandboxExit', 'save', 'reset'])
    })

    it('does not call onBeforeClassAdvance when the session ends', async () => {
      const onBeforeClassAdvance = vi.fn()
      const identity = makeIdentity()
      const { result, rerender } = renderHook((p) => useStudentPhase(p), {
        initialProps: defaultProps({
          session: makeSession({ state: 'active', currentTaskId: 1 }),
          identity,
          onBeforeClassAdvance,
        }),
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))

      rerender(
        defaultProps({
          session: makeSession({ state: 'ended', currentTaskId: 1, endedAt: 2000 }),
          identity,
          onBeforeClassAdvance,
        })
      )

      await waitFor(() => expect(result.current.phase).toBe('ended'))
      expect(onBeforeClassAdvance).not.toHaveBeenCalled()
    })
  })

  describe('session-end callbacks', () => {
    it('calls onPersonalSandboxExit when session disappears while in lesson phase', async () => {
      const onPersonalSandboxExit = vi.fn()
      const identity = makeIdentity()
      const session = makeSession({ state: 'active', currentTaskId: 1 })
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session, identity, onPersonalSandboxExit }),
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))

      rerender(defaultProps({ session: null, identity, onPersonalSandboxExit }))

      await waitFor(() => expect(result.current.phase).toBe('ended'))
      expect(onPersonalSandboxExit).toHaveBeenCalled()
    })

    it('calls onPersonalSandboxExit when session state becomes ended while in lesson phase', async () => {
      const onPersonalSandboxExit = vi.fn()
      const identity = makeIdentity()
      const session = makeSession({ state: 'active', currentTaskId: 1 })
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session, identity, onPersonalSandboxExit }),
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))

      rerender(
        defaultProps({ session: makeSession({ state: 'ended' }), identity, onPersonalSandboxExit })
      )

      await waitFor(() => expect(result.current.phase).toBe('ended'))
      expect(onPersonalSandboxExit).toHaveBeenCalled()
    })
  })

  describe('firstTaskId correction', () => {
    it('does not overwrite a session-driven currentTaskId when firstTaskId resolves', async () => {
      const identity = makeIdentity()
      const session = makeSession({ state: 'active', currentTaskId: 3 })
      const { result, rerender } = renderHook((props) => useStudentPhase(props), {
        initialProps: defaultProps({ session, identity, firstTaskId: null }),
      })
      await waitFor(() => expect(result.current.currentTaskId).toBe(3))
      expect(result.current.phase).toBe('lesson')

      // firstTaskId resolves to 1 after lesson loads — must not overwrite task 3
      rerender(defaultProps({ session, identity, firstTaskId: 1 }))

      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(result.current.currentTaskId).toBe(3)
    })
  })

  describe('name entry handlers', () => {
    it('handleGoSolo creates solo identity and sets phase to solo', async () => {
      const createIdentity = vi.fn(() => ({
        anonymousId: 'solo',
        displayName: 'Solo',
        lastSessionTimestamp: 0,
      }))
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null, createIdentity }))
      )
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      act(() => result.current.handleGoSolo())
      expect(createIdentity).toHaveBeenCalledWith('Solo', expect.any(Number))
      expect(result.current.phase).toBe('solo')
    })

    it('handleWaitForTeacher sets phase to waiting when no active session', async () => {
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session: null })))
      await waitFor(() => expect(result.current.phase).toBe('choice'))

      // manually set to a different phase to verify the handler
      act(() => result.current.setPhase('solo'))
      act(() => result.current.handleWaitForTeacher())
      expect(result.current.phase).toBe('waiting')
    })

    it('handleNameSubmit calls joinSession and transitions to lesson', async () => {
      const joinSession = vi.fn().mockResolvedValue(undefined)
      const createIdentity = vi.fn(() => ({
        anonymousId: 'a1',
        displayName: 'Bob',
        lastSessionTimestamp: 1000,
      }))
      const session = makeSession({ state: 'active', currentTaskId: 2 })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({
            session,
            joinSession,
            createIdentity,
            identity: null,
            identityLoaded: true,
          })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))

      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })

      expect(joinSession).toHaveBeenCalledWith('a1', 'Bob')
      expect(result.current.phase).toBe('lesson')
      expect(result.current.currentTaskId).toBe(2)
    })

    it('handleNameSubmit sets joinError and stays on name-entry when joinSession rejects', async () => {
      const joinSession = vi.fn().mockRejectedValue(new Error('permission_denied'))
      const createIdentity = vi.fn(() => ({
        anonymousId: 'a1',
        displayName: 'Bob',
        lastSessionTimestamp: 1000,
      }))
      const session = makeSession({ state: 'active', currentTaskId: 2 })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({
            session,
            joinSession,
            createIdentity,
            identity: null,
            identityLoaded: true,
          })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))

      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })

      expect(result.current.phase).toBe('name-entry')
      expect(result.current.joinError).toBeTruthy()
    })

    it('handleNameSubmit clears a prior joinError on a fresh attempt', async () => {
      const joinSession = vi
        .fn()
        .mockRejectedValueOnce(new Error('permission_denied'))
        .mockResolvedValueOnce(undefined)
      const createIdentity = vi.fn(() => ({
        anonymousId: 'a1',
        displayName: 'Bob',
        lastSessionTimestamp: 1000,
      }))
      const session = makeSession({ state: 'active', currentTaskId: 2 })
      const { result } = renderHook(() =>
        useStudentPhase(
          defaultProps({
            session,
            joinSession,
            createIdentity,
            identity: null,
            identityLoaded: true,
          })
        )
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))

      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })
      expect(result.current.joinError).toBeTruthy()

      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })
      expect(result.current.joinError).toBeNull()
      expect(result.current.phase).toBe('lesson')
    })
  })

  describe('joining marker: typed name and teacher admit', () => {
    // Captures the marker listener so tests can play the teacher's admit write.
    function markerHarness() {
      const listeners = new Map()
      const subscribeJoiningMarker = vi.fn((tempId, cb) => {
        listeners.set(tempId, cb)
        return () => listeners.delete(tempId)
      })
      return {
        subscribeJoiningMarker,
        fire: (marker) => {
          for (const cb of [...listeners.values()]) cb(marker)
        },
        listenerCount: () => listeners.size,
      }
    }

    async function renderNameEntry(overrides = {}) {
      const harness = markerHarness()
      const joinSession = vi.fn().mockResolvedValue(undefined)
      const createIdentity = vi.fn((displayName, ts) => ({
        anonymousId: 'a1',
        displayName,
        lastSessionTimestamp: ts,
      }))
      const props = defaultProps({
        session: makeSession({ state: 'active', currentTaskId: 2 }),
        identity: null,
        joinSession,
        createIdentity,
        subscribeJoiningMarker: harness.subscribeJoiningMarker,
        setJoiningTypedName: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      })
      const hook = renderHook((p) => useStudentPhase(p), { initialProps: props })
      await waitFor(() => expect(hook.result.current.phase).toBe('name-entry'))
      await waitFor(() => expect(harness.listenerCount()).toBe(1))
      return { ...hook, props, harness }
    }

    it('writes the typed name to its own marker, trimmed and capped', async () => {
      const { result, props } = await renderNameEntry()
      const tempId = props.registerJoining.mock.calls[0][0]
      act(() => result.current.reportTypedName('  Jamie  '))
      expect(props.setJoiningTypedName).toHaveBeenLastCalledWith(tempId, 'Jamie')
      act(() => result.current.reportTypedName('x'.repeat(50)))
      expect(props.setJoiningTypedName).toHaveBeenLastCalledWith(tempId, 'x'.repeat(30))
    })

    it('does not write a typed name once the student has left name entry', async () => {
      const { result, props } = await renderNameEntry()
      await act(async () => {
        await result.current.handleNameSubmit('Bob')
      })
      expect(result.current.phase).toBe('lesson')
      props.setJoiningTypedName.mockClear()
      act(() => result.current.reportTypedName('Bob'))
      expect(props.setJoiningTypedName).not.toHaveBeenCalled()
    })

    it('a teacher admit joins the student with that name exactly once', async () => {
      const { result, props, harness } = await renderNameEntry()
      const marker = { joinedAt: 5000, admit: { name: 'Jamie', at: 6000 } }
      await act(async () => {
        harness.fire(marker)
        harness.fire({ ...marker, typedName: 'Jam' })
      })
      await waitFor(() => expect(result.current.phase).toBe('lesson'))
      expect(props.joinSession).toHaveBeenCalledTimes(1)
      expect(props.joinSession).toHaveBeenCalledWith('a1', 'Jamie')
      expect(props.createIdentity).toHaveBeenCalledWith('Jamie', 1000)
      expect(props.unregisterJoining).toHaveBeenCalled()
      expect(result.current.currentTaskId).toBe(2)
    })

    it('suffixes an admitted name that is already taken, like a typed one', async () => {
      const { props, harness } = await renderNameEntry({
        session: makeSession({ students: { s1: { displayName: 'Jamie' } } }),
      })
      await act(async () => {
        harness.fire({ joinedAt: 5000, admit: { name: 'Jamie', at: 6000 } })
      })
      await waitFor(() => expect(props.joinSession).toHaveBeenCalledWith('a1', 'Jamie-2'))
    })

    it('admitted into a waiting session goes to the waiting room', async () => {
      const { result, harness } = await renderNameEntry({
        session: makeSession({ state: 'waiting' }),
      })
      await act(async () => {
        harness.fire({ joinedAt: 5000, admit: { name: 'Jamie', at: 6000 } })
      })
      await waitFor(() => expect(result.current.phase).toBe('waiting'))
    })

    it('ignores admits older than the marker, without a name, or without a time', async () => {
      const { result, props, harness } = await renderNameEntry()
      await act(async () => {
        harness.fire({ joinedAt: 5000, admit: { name: 'Jamie', at: 4000 } })
        harness.fire({ joinedAt: 5000, admit: { name: '   ', at: 6000 } })
        harness.fire({ joinedAt: 5000, admit: { name: 'Jamie' } })
        harness.fire({ joinedAt: 5000, typedName: 'Jamie' })
        harness.fire(null)
      })
      expect(props.joinSession).not.toHaveBeenCalled()
      expect(result.current.phase).toBe('name-entry')
    })

    it('ignores an admit while the student’s own Join is in flight', async () => {
      let resolveJoin
      const joinSession = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveJoin = resolve
          })
      )
      const { result, harness } = await renderNameEntry({ joinSession })
      let submitting
      act(() => {
        submitting = result.current.handleNameSubmit('Bob')
      })
      await act(async () => {
        harness.fire({ joinedAt: 5000, admit: { name: 'Jamie', at: 6000 } })
      })
      await act(async () => {
        resolveJoin()
        await submitting
      })
      expect(joinSession).toHaveBeenCalledTimes(1)
      expect(joinSession).toHaveBeenCalledWith('a1', 'Bob')
      expect(result.current.phase).toBe('lesson')
    })
  })
})
