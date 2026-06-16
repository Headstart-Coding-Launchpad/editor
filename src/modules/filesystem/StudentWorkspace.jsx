import React from 'react'
import FilesystemTask from '../../app/components/FilesystemTask'
import { normaliseDirPath } from '../../shared/filesystem'
import { resolveAssetsPath } from '../../shared/assetPaths'

export default function StudentWorkspace({
  lesson, task, cs,
  viewingTaskId, currentTaskId,
  isViewingPrev, isForcedTeacherLive,
  displayFs,
}) {
  return (
    <FilesystemTask
      key={`filesystem-${viewingTaskId ?? currentTaskId}`}
      initialDir={
        task?.carryFsFrom
          ? (cs.fsInteraction?.currentDir ?? (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/'))
          : (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')
      }
      fs={displayFs}
      onFsChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsChange}
      onInteraction={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsInteraction}
      assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
      assets={lesson.assets}
      disabled={isViewingPrev || isForcedTeacherLive}
    />
  )
}
