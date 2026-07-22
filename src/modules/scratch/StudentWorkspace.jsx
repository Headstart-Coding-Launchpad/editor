import React from 'react'
import ScratchWorkspace from './ScratchWorkspace'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { loadPersonalSandboxCode } from '../../app/studentStorage'
import { selectScratchInitialProject, selectScratchToolboxSnippets } from '../../app/studentTaskContent'
import { parseScratchState } from '../../shared/workspaceData'

export default function StudentWorkspace({
  lesson, task, cs, lessonId, identityId,
  activeStudentView, viewingTaskId, currentTaskId,
  isSandbox, isViewingPrev, isForcedTeacherLive,
  isTeacherEditing, teacherLiveCode,
}) {
  const personalSandboxScratchState = cs.inPersonalSandbox
    ? (loadPersonalSandboxCode(lessonId, identityId)?.state ?? lesson.sandboxStarter ?? null)
    : null
  // Passed as a thunk: ScratchWorkspace resolves it inside its init effect, after
  // the previous task's workspace has unmounted and flushed its pending save.
  const initialProject = cs.inPersonalSandbox ? null : () => selectScratchInitialProject({
    tasks: lesson.tasks,
    task,
    taskId: viewingTaskId ?? currentTaskId,
    readSavedCode: cs.readSavedTaskCode,
    onCarryFallback: cs.recordCarryFallback,
  })
  const { predefinedBlocks, prebuiltStacks } = selectScratchToolboxSnippets({
    task,
    activeStageIndex: cs.scratchActiveStageIndex,
    disabled: cs.inPersonalSandbox,
  })

  return (
    <div style={s.scratchStudentWorkspace}>
      {!isViewingPrev && !isSandbox && !cs.inPersonalSandbox && !isForcedTeacherLive && !isTeacherEditing && (
        <div style={{ display: 'flex', flexShrink: 0, paddingBottom: 4 }}>
          <button
            className="btn-ghost-outline"
            style={s.resetBtn}
            onClick={cs.handleResetCode}
            title="Reset blocks to the starter blocks for this task"
          >
            Reset Blocks
          </button>
        </div>
      )}
      <ScratchWorkspace
        key={`scratch-${viewingTaskId ?? currentTaskId}-${isSandbox ? 'sandbox' : cs.inPersonalSandbox ? 'personal-sandbox' : 'task'}`}
        task={cs.inPersonalSandbox ? null : task}
        predefinedBlocks={predefinedBlocks}
        prebuiltStacks={prebuiltStacks}
        respectStudentEditable={!cs.inPersonalSandbox}
        readOnly={isViewingPrev || isForcedTeacherLive || isTeacherEditing}
        unrestricted={isSandbox || cs.inPersonalSandbox}
        assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
        initialState={initialProject}
        onStateChange={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchChange}
        onCheckResult={isViewingPrev || isForcedTeacherLive || isTeacherEditing || cs.inPersonalSandbox ? undefined : cs.handleScratchCheck}
        externalState={isTeacherEditing ? parseScratchState(teacherLiveCode) : isSandbox ? cs.scratchSandboxProject : cs.inPersonalSandbox ? personalSandboxScratchState : cs.scratchExternalState}
        syncNowKey={activeStudentView === identityId ? activeStudentView : null}
        preferStageSidePanel
      />
    </div>
  )
}

const s = {
  scratchStudentWorkspace: {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: 'auto',
    overflow: 'hidden',
  },
  resetBtn: {
    fontSize: 14,
    padding: '9px 20px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
}
