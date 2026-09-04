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
    teacherPresentation: true,
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
