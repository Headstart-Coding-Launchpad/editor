import React, { useEffect } from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'
import TaskSlideTransition from '../../../app/components/TaskSlideTransition'

const mountCount = vi.fn()
const externalStateSpy = vi.fn()
const mockMountBehaviour = { reportPassOnMount: false }
vi.mock('../ScratchWorkspace', () => ({
  // Empty-deps effect fires once per actual mount (new `key` => new instance),
  // unlike a call in the render body which would also fire on every re-render.
  default: function MockScratchWorkspace({ initialState, externalState, onCheckResult }) {
    useEffect(() => {
      mountCount()
      // Mirror the real component's contract: initialState is a thunk resolved on mount.
      initialState?.()
      // Mirrors the real mount-time after_block_placed evaluation of already-passing saved blocks.
      if (mockMountBehaviour.reportPassOnMount) onCheckResult?.(true, {})
    }, [])
    externalStateSpy(externalState)
    return <div>scratch-workspace</div>
  },
}))
vi.mock('../../../app/studentTaskContent', () => ({
  selectScratchInitialProject: vi.fn(({ readSavedCode }) => {
    readSavedCode?.()
    return null
  }),
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
        displayCode="updated"
        displaySpriteState={null}
        displayCursor={null}
        displayBlockDrag={null}
        isForcedTeacherLive
      />
    )
    expect(mountCount).toHaveBeenCalledTimes(1)
    expect(cs.readSavedTaskCode).toHaveBeenCalledTimes(1)

    // Broadcast ends: workspace must remount and re-read the student's saved state,
    // instead of keeping the leftover broadcast blocks in the live Blockly object.
    rerender(
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
        isForcedTeacherLive={false}
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
        isForcedTeacherLive={false}
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
        displayCode='{"a":1}'
        displaySpriteState={null}
        displayCursor={{ target: 'stage', x: 1, y: 2, at: Date.now() }}
        displayBlockDrag={null}
        isForcedTeacherLive
      />
    )
    const second = externalStateSpy.mock.calls.at(-1)[0]
    expect(second).toBe(first)

    // A genuine broadcast update: displayCode actually changes.
    rerender(
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
        displayCode='{"a":2}'
        displaySpriteState={null}
        displayCursor={null}
        displayBlockDrag={null}
        isForcedTeacherLive
      />
    )
    const third = externalStateSpy.mock.calls.at(-1)[0]
    expect(third).not.toBe(first)
  })
})

describe('Scratch StudentWorkspace inside a task slide transition', () => {
  // TaskSlideTransition remounts the previous task's element tree in its leaving panel, with
  // that task's stale callbacks. A workspace whose saved blocks already pass an
  // after_block_placed check re-reports "passed" on mount — which previously landed on the
  // newly-entered task and showed it complete with no action (scratch-1-4 task 18 -> 19).
  it('does not report check results (or save/broadcast) from the leaving panel', () => {
    vi.useFakeTimers()
    mockMountBehaviour.reportPassOnMount = true
    try {
      const staleCs = { ...cs, handleScratchCheck: vi.fn(), handleScratchChange: vi.fn() }
      const nextCs = { ...cs, handleScratchCheck: vi.fn(), handleScratchChange: vi.fn() }
      const renderTask = (taskId, taskCs) => (
        <TaskSlideTransition transitionKey={taskId}>
          <StudentWorkspace
            lesson={lesson}
            task={task}
            cs={taskCs}
            lessonId="lesson-1"
            identityId="student-1"
            activeStudentView={null}
            viewingTaskId={null}
            currentTaskId={taskId}
            isSandbox={false}
            isViewingPrev={false}
            isTeacherEditing={false}
            teacherLiveCode=""
            displayCode=""
            displaySpriteState={null}
            displayCursor={null}
            displayBlockDrag={null}
          />
        </TaskSlideTransition>
      )

      const { rerender } = render(renderTask('task-18', staleCs))
      expect(staleCs.handleScratchCheck).toHaveBeenCalledTimes(1)
      staleCs.handleScratchCheck.mockClear()
      mountCount.mockClear()

      rerender(renderTask('task-19', nextCs))
      // Both panels mounted: the leaving (task-18) snapshot and the entering task-19 workspace.
      expect(mountCount).toHaveBeenCalledTimes(2)
      expect(staleCs.handleScratchCheck).not.toHaveBeenCalled()
      expect(nextCs.handleScratchCheck).toHaveBeenCalledTimes(1)

      act(() => {
        vi.runAllTimers()
      })
      expect(staleCs.handleScratchCheck).not.toHaveBeenCalled()
    } finally {
      mockMountBehaviour.reportPassOnMount = false
      vi.useRealTimers()
    }
  })
})
