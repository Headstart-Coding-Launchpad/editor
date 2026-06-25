import React from 'react'
import ScratchWorkspace from '../../app/components/ScratchWorkspace'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { loadSavedCode, loadPersonalSandboxCode } from '../../app/studentStorage'
import { selectScratchInitialProject, selectScratchToolboxSnippets } from '../../app/studentTaskContent'
import { parseScratchState } from '../../shared/workspaceData'

export default function StudentWorkspace({
  lesson, task, cs, lessonId, identityId,
  activeStudentView, viewingTaskId, currentTaskId,
  isSandbox, isViewingPrev, isForcedTeacherLive, previewMode,
  isTeacherEditing, teacherLiveCode,
}) {
  const personalSandboxScratchState = cs.inPersonalSandbox
    ? (loadPersonalSandboxCode(lessonId, identityId)?.state ?? lesson.sandboxStarter ?? null)
    : null
  const initialProject = cs.inPersonalSandbox ? null : selectScratchInitialProject({
    task,
    taskId: viewingTaskId ?? currentTaskId,
    readSavedCode: previewMode ? () => null : sourceTaskId => loadSavedCode(lessonId, sourceTaskId, identityId),
  })
  const { predefinedBlocks, prebuiltStacks } = selectScratchToolboxSnippets({
    task,
    activeStageIndex: cs.scratchActiveStageIndex,
    disabled: cs.inPersonalSandbox,
  })

  return (
    <>
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
      />
    </>
  )
}

const s = {
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
