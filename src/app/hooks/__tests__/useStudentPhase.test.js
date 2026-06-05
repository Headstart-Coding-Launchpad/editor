import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudentPhase } from '../useStudentPhase'

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
    createIdentity: vi.fn((displayName, ts) => ({ anonymousId: 'anon-1', displayName, lastSessionTimestamp: ts })),
    updateTimestamp: vi.fn(),
    joinSession: vi.fn().mockResolvedValue(undefined),
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

    it('goes to waiting when no session and not soloMode', async () => {
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session: null, soloMode: false })))
      await waitFor(() => expect(result.current.phase).toBe('waiting'))
    })

    it('goes to solo when no session and soloMode', async () => {
      const { result } = renderHook(() => useStudentPhase(defaultProps({ session: null, soloMode: true })))
      await waitFor(() => expect(result.current.phase).toBe('solo'))
    })

    it('calls createIdentity when soloMode with no identity', async () => {
      const createIdentity = vi.fn(() => ({ anonymousId: 'solo-id', displayName: 'Solo', lastSessionTimestamp: 0 }))
      const props = defaultProps({ session: null, soloMode: true, identity: null, createIdentity })
      renderHook(() => useStudentPhase(props))
      await waitFor(() => expect(createIdentity).toHaveBeenCalledWith('Solo', expect.any(Number)))
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

    it('goes to waiting from loading phase when session is ended and not soloMode', async () => {
      const session = makeSession({ state: 'ended' })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, identity: null, identityLoaded: true, soloMode: false }))
      )
      await waitFor(() => expect(result.current.phase).toBe('waiting'))
    })

    it('goes to solo from loading phase when session is ended and soloMode', async () => {
      const createIdentity = vi.fn(() => ({ anonymousId: 'solo', displayName: 'Solo', lastSessionTimestamp: 0 }))
      const session = makeSession({ state: 'ended' })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, identity: null, identityLoaded: true, soloMode: true, createIdentity }))
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

  describe('name entry handlers', () => {
    it('handleGoSolo creates solo identity and sets phase to solo', async () => {
      const createIdentity = vi.fn(() => ({ anonymousId: 'solo', displayName: 'Solo', lastSessionTimestamp: 0 }))
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null, createIdentity }))
      )
      await waitFor(() => expect(result.current.phase).toBe('waiting'))

      act(() => result.current.handleGoSolo())
      expect(createIdentity).toHaveBeenCalledWith('Solo', expect.any(Number))
      expect(result.current.phase).toBe('solo')
    })

    it('handleWaitForTeacher sets phase to waiting when no active session', async () => {
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session: null }))
      )
      await waitFor(() => expect(result.current.phase).toBe('waiting'))

      // manually set to a different phase to verify the handler
      act(() => result.current.setPhase('solo'))
      act(() => result.current.handleWaitForTeacher())
      expect(result.current.phase).toBe('waiting')
    })

    it('handleNameSubmit calls joinSession and transitions to lesson', async () => {
      const joinSession = vi.fn().mockResolvedValue(undefined)
      const createIdentity = vi.fn(() => ({ anonymousId: 'a1', displayName: 'Bob', lastSessionTimestamp: 1000 }))
      const session = makeSession({ state: 'active', currentTaskId: 2 })
      const { result } = renderHook(() =>
        useStudentPhase(defaultProps({ session, joinSession, createIdentity, identity: null, identityLoaded: true }))
      )
      await waitFor(() => expect(result.current.phase).toBe('name-entry'))

      await act(async () => { await result.current.handleNameSubmit('Bob') })

      expect(joinSession).toHaveBeenCalledWith('a1', 'Bob')
      expect(result.current.phase).toBe('lesson')
      expect(result.current.currentTaskId).toBe(2)
    })
  })
})
