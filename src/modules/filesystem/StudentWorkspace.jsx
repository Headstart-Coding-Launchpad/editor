import React from 'react'
import FilesystemTask from './FilesystemTask'
import { DEFAULT_FS, normaliseDirPath } from './filesystem'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { resolveSavedCarrySource } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  lesson, task, cs,
  viewingTaskId, currentTaskId,
  isViewingPrev, isForcedTeacherLive,
  displayFs,
}) {
  const viewedFs = isViewingPrev ? cs.readSavedTaskFs(viewingTaskId) : null
  const viewedCarry = isViewingPrev && viewedFs == null
    ? resolveSavedCarrySource({
      tasks: lesson.tasks,
      taskId: viewingTaskId,
      carryFromId: task?.carryFsFrom,
      carryField: 'carryFsFrom',
      readSavedState: cs.readSavedTaskFs,
      hasSavedState: saved => saved != null,
    })
    : null
  const fs = isViewingPrev ? (viewedFs ?? viewedCarry?.saved ?? task?.starterFs ?? DEFAULT_FS) : displayFs
  return (
    <div style={s.filesystemStudentWorkspace}>
      <FilesystemTask
        key={`filesystem-${viewingTaskId ?? currentTaskId}`}
        initialDir={
          task?.carryFsFrom
            ? (cs.fsInteraction?.currentDir ?? (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/'))
            : (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')
        }
        fs={fs}
        onFsChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsChange}
        onInteraction={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsInteraction}
        assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
        assets={lesson.assets}
        disabled={isViewingPrev || isForcedTeacherLive}
      />
    </div>
  )
}

const s = {
  filesystemStudentWorkspace: {
    flex: '0 0 auto',
    minHeight: 420,
    height: '70vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
