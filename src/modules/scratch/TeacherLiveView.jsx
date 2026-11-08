import React from 'react'
import ScratchWorkspace from './ScratchWorkspace.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'

// Read-only view used by the teacher dashboard's "watch one student" modal
// (StudentWorkspaceBody.jsx). Always renders the compact Blocks/Stage tab layout
// (`forceCompact`) regardless of the modal's own width, so it shows the same
// predictable layout every time instead of depending on the teacher's own window size —
// unlike the interactive student/presentation surfaces, which measure their container
// and only go compact when genuinely cramped (see ScratchWorkspace.jsx's `compact` state).
// `compact={false}` (the StudentModal on a PC screen) lets it measure like the student's own
// workspace, so the tutor sees the blocks and the Stage side by side as the student does.
export default function ScratchTeacherLiveView({
  task,
  lesson,
  readOnly = true,
  scratchState,
  spriteState,
  cursorState,
  blockDragState,
  isSessionSandbox = false,
  compact = true,
  forcedPane = null,
  forcedPaneToken = null,
}) {
  return (
    <ScratchWorkspace
      task={task}
      readOnly={readOnly}
      forceCompact={compact}
      watchView
      forcedPane={forcedPane}
      forcedPaneToken={forcedPaneToken}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      initialState={scratchState}
      externalState={scratchState}
      externalSpriteState={spriteState}
      externalCursor={cursorState}
      externalBlockDrag={blockDragState}
      unrestricted={isSessionSandbox}
      remoteSelectedSpriteId={spriteState?.selectedSpriteId ?? null}
    />
  )
}
