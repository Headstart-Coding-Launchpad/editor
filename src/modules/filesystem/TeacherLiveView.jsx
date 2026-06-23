import React from 'react'
import FilesystemTask from './FilesystemTask.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'

export default function FilesystemTeacherLiveView({ task, lesson, displayState, readOnly, onChange }) {
  return (
    <FilesystemTask
      fs={displayState}
      onFsChange={onChange}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      assets={lesson?.assets}
      disabled={readOnly}
    />
  )
}
