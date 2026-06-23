import React from 'react'
import ScratchWorkspace from './ScratchWorkspace.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'

export default function ScratchTeacherLiveView({ task, lesson, displayState, readOnly, onChange, isInSandbox, activeStage }) {
  const predefinedBlocks = !isInSandbox ? [
    ...(task?.predefinedBlocks ?? []),
    ...(activeStage?.predefinedBlocks ?? []),
  ] : null
  const prebuiltStacks = !isInSandbox ? [
    ...(task?.prebuiltStacks ?? []),
    ...(activeStage?.prebuiltStacks ?? []),
  ] : null

  return (
    <ScratchWorkspace
      task={task}
      predefinedBlocks={predefinedBlocks}
      prebuiltStacks={prebuiltStacks}
      unrestricted={isInSandbox}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      initialState={displayState}
      externalState={displayState}
      readOnly={readOnly}
      hideStage
      onStateChange={onChange}
    />
  )
}
