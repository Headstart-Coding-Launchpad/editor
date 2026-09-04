import React, { useEffect } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

const mountCount = vi.fn()
const externalStateSpy = vi.fn()
vi.mock('../ScratchWorkspace', () => ({
  // Empty-deps effect fires once per actual mount (new `key` => new instance),
  // unlike a call in the render body which would also fire on every re-render.
  default: ({ initialState, externalState }) => {
    useEffect(() => {
      mountCount()
      // Mirror the real component's contract: initialState is a thunk resolved on mount.
      initialState?.()
    }, [])
    externalStateSpy(externalState)
    return <div>scratch-workspace</div>
  },
}))
vi.mock('../../../app/studentTaskContent', () => ({
  selectScratchInitialProject: vi.fn(({ readSavedCode }) => { readSavedCode?.(); return null }),
  selectScratchToolboxSnippets: vi.fn(() => ({ predefinedBlocks: [], prebuiltStacks: [] })),
}))
vi.mock('../../../app/studentStorage', () => ({
  loadPersonalSandboxCode: vi.fn(() => null),
}))

const lesson = { tasks: [], assetsPath: null }
const task = {}
const cs = {
  inPersonalSandbox: false,
  scratchActiveStageIndex: 0,
  readSavedTaskCode: vi.fn(),
  recordCarryFallback: vi.fn(),
  handleScratchChange: vi.fn(),
  handleScratchActivity: vi.fn(),
  handleScratchSpriteState: vi.fn(),
  handleScratchCursor: vi.fn(),
  handleScratchBlockDrag: vi.fn(),
  handleScratchCheck: vi.fn(),
  handleResetCode: vi.fn(),
  scratchExternalState: null,
  scratchSandboxProject: null,
}

function renderWorkspace(props) {
  return render(
    <StudentWorkspace
      lesson={lesson}
      task={task}
      cs={cs}
      lessonId="lesson-1"
      identityId="student-1"
      activeStudentView={null}
      viewingTaskId={null}
      currentTaskId="task-1"
      isSandbox={false}
      isViewingPrev={false}
      isTeacherEditing={false}
      teacherLiveCode=""
      displayCode=""
      displaySpriteState={null}
      displayCursor={null}
      displayBlockDrag={null}
      {...props}
    />
  )
}

describe('Scratch StudentWorkspace teacher-live-broadcast remount', () => {
  it('remounts the workspace when a teacher broadcast ends, so it rebuilds from the saved state instead of the leftover broadcast blocks', () => {
    mountCount.mockClear()
    cs.readSavedTaskCode.mockClear()

    const { rerender } = renderWorkspace({ isForcedTeacherLive: true })
    expect(mountCount).toHaveBeenCalledTimes(1)
    expect(cs.readSavedTaskCode).toHaveBeenCalledTimes(1)

    // Broadcast still active: no remount, no extra re-read of saved state.
    rerender(
      <StudentWorkspace
        lesson={lesson} task={task} cs={cs} lessonId="lesson-1" identityId="student-1"
        activeStudentView={null} viewingTaskId={null} currentTaskId="task-1"
        isSandbox={false} isViewingPrev={false} isTeacherEditing={false}
        teacherLiveCode="" displayCode="updated" displaySpriteState={null}
        displayCursor={null} displayBlockDrag={null} isForcedTeacherLive
      />
    )
    expect(mountCount).toHaveBeenCalledTimes(1)
    expect(cs.readSavedTaskCode).toHaveBeenCalledTimes(1)

    // Broadcast ends: workspace must remount and re-read the student's saved state,
    // instead of keeping the leftover broadcast blocks in the live Blockly object.
    rerender(
      <StudentWorkspace
        lesson={lesson} task={task} cs={cs} lessonId="lesson-1" identityId="student-1"
        activeStudentView={null} viewingTaskId={null} currentTaskId="task-1"
        isSandbox={false} isViewingPrev={false} isTeacherEditing={false}
        teacherLiveCode="" displayCode="" displaySpriteState={null}
        displayCursor={null} displayBlockDrag={null} isForcedTeacherLive={false}
      />
    )
    expect(mountCount).toHaveBeenCalledTimes(2)
    expect(cs.readSavedTaskCode).toHaveBeenCalledTimes(2)
  })

  it('does not remount on unrelated re-renders while never having gone live', () => {
    mountCount.mockClear()
    const { rerender } = renderWorkspace({ isForcedTeacherLive: false })
    expect(mountCount).toHaveBeenCalledTimes(1)

    rerender(
      <StudentWorkspace
        lesson={lesson} task={task} cs={cs} lessonId="lesson-1" identityId="student-1"
        activeStudentView={null} viewingTaskId={null} currentTaskId="task-1"
        isSandbox={false} isViewingPrev={false} isTeacherEditing={false}
        teacherLiveCode="" displayCode="" displaySpriteState={null}
        displayCursor={null} displayBlockDrag={null} isForcedTeacherLive={false}
        highlightedPanes={['blocks']}
      />
    )
    expect(mountCount).toHaveBeenCalledTimes(1)
  })
})

describe('Scratch StudentWorkspace externalState memoization', () => {
  // A watching mirror re-renders on every throttled live cursor/block-drag tick
  // (far more often than the broadcast code itself changes). ScratchWorkspace's
  // "load external state" effect is keyed on object identity, so a fresh object
  // every render would fully reload the mirrored Blockly workspace on each tick —
  // stomping the live block-drag mirror's in-progress moveTo() with a stale reload.
  it('keeps the same externalState reference across renders while displayCode is unchanged, and only recomputes when it changes', () => {
    externalStateSpy.mockClear()
    const { rerender } = renderWorkspace({ isForcedTeacherLive: true, displayCode: '{"a":1}' })
    const first = externalStateSpy.mock.calls.at(-1)[0]

    // Unrelated re-render (e.g. a live cursor tick) with the same displayCode.
    rerender(
      <StudentWorkspace
        lesson={lesson} task={task} cs={cs} lessonId="lesson-1" identityId="student-1"
        activeStudentView={null} viewingTaskId={null} currentTaskId="task-1"
        isSandbox={false} isViewingPrev={false} isTeacherEditing={false}
        teacherLiveCode="" displayCode='{"a":1}' displaySpriteState={null}
        displayCursor={{ target: 'stage', x: 1, y: 2, at: Date.now() }} displayBlockDrag={null} isForcedTeacherLive
      />
    )
    const second = externalStateSpy.mock.calls.at(-1)[0]
    expect(second).toBe(first)

    // A genuine broadcast update: displayCode actually changes.
    rerender(
      <StudentWorkspace
        lesson={lesson} task={task} cs={cs} lessonId="lesson-1" identityId="student-1"
        activeStudentView={null} viewingTaskId={null} currentTaskId="task-1"
        isSandbox={false} isViewingPrev={false} isTeacherEditing={false}
        teacherLiveCode="" displayCode='{"a":2}' displaySpriteState={null}
        displayCursor={null} displayBlockDrag={null} isForcedTeacherLive
      />
    )
    const third = externalStateSpy.mock.calls.at(-1)[0]
    expect(third).not.toBe(first)
  })
})
