import React, { useMemo, useRef, useState, useEffect } from 'react'
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
  displayCode, displaySpriteState, displayCursor, displayBlockDrag,
  onVisiblePanesChange, highlightedPanes, forcedPaneCommand,
}) {
  const forcedPane = forcedPaneCommand?.panes?.find(p => p === 'blocks' || p === 'stage') ?? null
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
  // Memoized so an unrelated re-render (e.g. a live-view activity notice firing
  // mid-drag) doesn't hand ScratchWorkspace a new array reference — that would
  // re-trigger its toolbox-rebuild effect (Blockly's updateToolbox) and disrupt
  // whatever flyout drag is in progress.
  const { predefinedBlocks, prebuiltStacks } = useMemo(() => selectScratchToolboxSnippets({
    task,
    activeStageIndex: cs.scratchActiveStageIndex,
    disabled: cs.inPersonalSandbox,
  }), [task, cs.scratchActiveStageIndex, cs.inPersonalSandbox])

  // Teacher broadcast loads directly into the live Blockly workspace object
  // (loadWorkspace mutates it in place, unlike the plain-prop code/circuit used
  // by python/electronics), so the workspace still physically holds the
  // teacher's blocks after the broadcast ends. Force a remount on that
  // true->false edge so the workspace rebuilds fresh from the student's own
  // saved state instead of saving the leftover teacher blocks on the next edit.
  const wasForcedTeacherLiveRef = useRef(isForcedTeacherLive)
  const [liveEndEpoch, setLiveEndEpoch] = useState(0)
  useEffect(() => {
    if (wasForcedTeacherLiveRef.current && !isForcedTeacherLive) {
      setLiveEndEpoch(epoch => epoch + 1)
    }
    wasForcedTeacherLiveRef.current = isForcedTeacherLive
  }, [isForcedTeacherLive])

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
        key={`scratch-${viewingTaskId ?? currentTaskId}-${isSandbox ? 'sandbox' : cs.inPersonalSandbox ? 'personal-sandbox' : 'task'}-${liveEndEpoch}`}
        task={cs.inPersonalSandbox ? null : task}
        predefinedBlocks={predefinedBlocks}
        prebuiltStacks={prebuiltStacks}
        respectStudentEditable={!cs.inPersonalSandbox}
        readOnly={isViewingPrev || isForcedTeacherLive || isTeacherEditing}
        unrestricted={isSandbox || cs.inPersonalSandbox}
        assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
        initialState={initialProject}
        onStateChange={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchChange}
        onActivity={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchActivity}
        onSpriteStatesChange={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchSpriteState}
        onCursorMove={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchCursor}
        onBlockDragMove={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : cs.handleScratchBlockDrag}
        onCheckResult={isViewingPrev || isForcedTeacherLive || isTeacherEditing || cs.inPersonalSandbox ? undefined : cs.handleScratchCheck}
        externalState={isTeacherEditing ? parseScratchState(teacherLiveCode) : isForcedTeacherLive ? parseScratchState(displayCode) : isSandbox ? cs.scratchSandboxProject : cs.inPersonalSandbox ? personalSandboxScratchState : cs.scratchExternalState}
        externalSpriteState={isForcedTeacherLive ? displaySpriteState : null}
        externalCursor={isForcedTeacherLive ? displayCursor : null}
        externalBlockDrag={isForcedTeacherLive ? displayBlockDrag : null}
        syncNowKey={activeStudentView === identityId ? activeStudentView : null}
        onVisiblePanesChange={isViewingPrev || isForcedTeacherLive || isTeacherEditing ? undefined : onVisiblePanesChange}
        highlightedPanes={highlightedPanes}
        forcedPane={forcedPane}
        forcedPaneToken={forcedPaneCommand?.pushedAt ?? null}
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
