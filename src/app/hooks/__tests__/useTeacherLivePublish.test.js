import { useRef, useState } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useTeacherLivePublish } from '../useTeacherLivePublish'

// Scratch never routes edits through the generic `code` state (it publishes
// directly from handleScratchChange instead — see useStudentCodeState.js's
// scratch branch of loadTaskContent). Regression test for the bug this caused:
// starting a broadcast (or switching the live task) published whatever stale/
// empty `code` was left over from the generic state, wiping the watching
// mirror's Blockly workspace until the presenter's next real edit resynced it
// a second later — which is why a block dragged right after "Go Live" never
// visibly moved on its first drag.
function useHarness({
  initialSession,
  lesson,
  currentTaskId,
  code,
  scratchCode,
  updateTeacherLive,
  teacherPresentation = true,
  setTeacherLiveReference,
}) {
  const identityRef = useRef(null)
  const sessionRef = useRef(initialSession)
  const lessonRef = useRef(lesson)
  const currentTaskIdRef = useRef(currentTaskId)
  const codeRef = useRef(code)
  const scratchCodeRef = useRef(scratchCode)
  const arcadeDesignRef = useRef(null)
  const filesRef = useRef([])
  const activeFileRef = useRef('')
  const outputRef = useRef('')
  const runStatusRef = useRef(null)
  const fsStateRef = useRef(null)
  const editorSelectionRef = useRef(null)
  const editorActivityRef = useRef(null)

  const [session, setSession] = useState(initialSession)
  sessionRef.current = session

  const publish = useTeacherLivePublish({
    teacherPresentation,
    identityRef,
    sessionRef,
    lessonRef,
    currentTaskIdRef,
    codeRef,
    scratchCodeRef,
    arcadeDesignRef,
    filesRef,
    activeFileRef,
    outputRef,
    runStatusRef,
    fsStateRef,
    editorSelectionRef,
    editorActivityRef,
    lesson,
    session,
    identity: null,
    currentTaskId,
    code,
    files: [],
    activeFile: '',
    output: '',
    runStatus: null,
    checkPassed: false,
    checkAttempted: false,
    checkSuggestion: null,
    fsState: null,
    updateTeacherLive,
    setTeacherLiveReference,
  })

  return { ...publish, setSession, scratchCodeRef, codeRef }
}

describe('useTeacherLivePublish — Scratch code source', () => {
  it('publishes the scratch workspace JSON, not the stale generic `code` state, the moment a broadcast starts', () => {
    const updateTeacherLive = vi.fn()
    const scratchJson = JSON.stringify({ sprite1: { blocks: [{ id: 'b1' }] } })
    const lesson = { type: 'scratch', tasks: [{ id: 1 }] }

    const { result } = renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null },
        lesson,
        currentTaskId: 1,
        code: '', // generic `code` state is never populated for Scratch tasks
        scratchCode: scratchJson,
        updateTeacherLive,
      })
    )

    act(() => {
      result.current.setSession({ teacherLive: { active: true, source: 'teacher' } })
    })

    expect(updateTeacherLive).toHaveBeenCalled()
    const lastPayload = updateTeacherLive.mock.calls.at(-1)[0]
    expect(lastPayload.code).toBe(scratchJson)
  })

  it('still uses the generic `code` state for a non-Scratch lesson', () => {
    const updateTeacherLive = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    const { result } = renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null },
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive,
      })
    )

    act(() => {
      result.current.setSession({ teacherLive: { active: true, source: 'teacher' } })
    })

    const lastPayload = updateTeacherLive.mock.calls.at(-1)[0]
    expect(lastPayload.code).toBe('print("hi")')
  })
})

describe('useTeacherLivePublish — soft support-reference channel', () => {
  it('publishes to setTeacherLiveReference while Presentation is open, independent of teacherLive', () => {
    const setTeacherLiveReference = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null }, // Go Live is off
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive: vi.fn(),
        setTeacherLiveReference,
      })
    )

    expect(setTeacherLiveReference).toHaveBeenCalled()
    const lastPayload = setTeacherLiveReference.mock.calls.at(-1)[0]
    expect(lastPayload.code).toBe('print("hi")')
    expect(lastPayload.taskId).toBe(1)
  })

  it('does not publish when Presentation View is not open', () => {
    const setTeacherLiveReference = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null },
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive: vi.fn(),
        teacherPresentation: false,
        setTeacherLiveReference,
      })
    )

    expect(setTeacherLiveReference).not.toHaveBeenCalled()
  })

  it('clears the reference channel when Presentation View unmounts', () => {
    const setTeacherLiveReference = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    const { unmount } = renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null },
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive: vi.fn(),
        setTeacherLiveReference,
      })
    )

    setTeacherLiveReference.mockClear()
    unmount()

    expect(setTeacherLiveReference).toHaveBeenCalledWith(null)
  })
})

describe('useTeacherLivePublish — publishOutputCollapsed', () => {
  it('merge-updates just outputCollapsed while a broadcast is active', () => {
    const updateTeacherLive = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    const { result } = renderHook(() =>
      useHarness({
        initialSession: { teacherLive: { active: true, source: 'teacher' } },
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive,
      })
    )

    updateTeacherLive.mockClear()
    act(() => {
      result.current.publishOutputCollapsed(true)
    })

    expect(updateTeacherLive).toHaveBeenCalledWith({ outputCollapsed: true })
  })

  it('does nothing when there is no active broadcast to publish to', () => {
    const updateTeacherLive = vi.fn()
    const lesson = { type: 'python', tasks: [{ id: 1 }] }

    const { result } = renderHook(() =>
      useHarness({
        initialSession: { teacherLive: null },
        lesson,
        currentTaskId: 1,
        code: 'print("hi")',
        scratchCode: '',
        updateTeacherLive,
      })
    )

    act(() => {
      result.current.publishOutputCollapsed(true)
    })

    expect(updateTeacherLive).not.toHaveBeenCalled()
  })
})
