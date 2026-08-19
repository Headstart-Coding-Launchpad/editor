import React from 'react'
import ScratchWorkspace from './ScratchWorkspace.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'

// Read-only view used by the teacher dashboard's "watch one student" modal
// (StudentWorkspaceBody.jsx). Always renders the compact Blocks/Stage tab layout
// (`forceCompact`) regardless of the modal's own width, so it shows the same
// predictable layout every time instead of depending on the teacher's own window size —
// unlike the interactive student/presentation surfaces, which measure their container
// and only go compact when genuinely cramped (see ScratchWorkspace.jsx's `compact` state).
export default function ScratchTeacherLiveView({
  task,
  lesson,
  readOnly = true,
  scratchState,
  spriteState,
  cursorState,
  blockDragState,
  isSessionSandbox = false,
}) {
  return (
    <ScratchWorkspace
      task={task}
      readOnly={readOnly}
      forceCompact
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      initialState={scratchState}
      externalState={scratchState}
      externalSpriteState={spriteState}
      externalCursor={cursorState}
      externalBlockDrag={blockDragState}
      unrestricted={isSessionSandbox}
    />
  )
}
