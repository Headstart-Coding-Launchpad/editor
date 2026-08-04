import React, { useMemo } from 'react'
import Desktop from './Desktop.jsx'
import FileManagerApp from './apps/fileManager/FileManagerApp.jsx'
import { makeDefaultDesktop, normaliseDesktop } from './desktopState.js'
import { normaliseDirPath } from '../filesystem/filesystem.js'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { resolveSavedCarrySource } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  lesson, task, cs,
  viewingTaskId, currentTaskId,
  isViewingPrev, isForcedTeacherLive,
  displayDesktop,
}) {
  const availableApps = task?.availableApps ?? ['fileManager']
  const disabled = isViewingPrev || isForcedTeacherLive

  const viewedDesktop = isViewingPrev ? cs.readSavedTaskDesktop(viewingTaskId) : null
  const viewedCarry = isViewingPrev && viewedDesktop == null
    ? resolveSavedCarrySource({
      tasks: lesson.tasks,
      taskId: viewingTaskId,
      carryFromId: task?.carryDesktopFrom,
      carryField: 'carryDesktopFrom',
      readSavedState: cs.readSavedTaskDesktop,
      hasSavedState: saved => saved != null,
    })
    : null
  const desktop = isViewingPrev
    ? normaliseDesktop(viewedDesktop ?? viewedCarry?.saved ?? task?.starterDesktop ?? makeDefaultDesktop(availableApps))
    : normaliseDesktop(displayDesktop)

  const startsInDir = task?.carryDesktopFrom
    ? (cs.desktopInteraction?.currentDir ?? (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/'))
    : (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')

  const apps = useMemo(() => ({
    fileManager: {
      title: 'File Manager',
      icon: '🗂️',
      render: (props) => (
        <FileManagerApp
          {...props}
          onInteraction={disabled ? undefined : cs.handleDesktopInteraction}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          assets={lesson.assets}
          startsInDir={startsInDir}
        />
      ),
    },
  }), [disabled, cs.handleDesktopInteraction, lesson.assetsPath, lesson.assets, startsInDir])

  return (
    <div style={s.desktopStudentWorkspace} key={`desktop-${viewingTaskId ?? currentTaskId}`}>
      <Desktop
        state={desktop}
        onStateChange={disabled ? undefined : cs.handleDesktopChange}
        apps={apps}
        availableApps={availableApps}
        disabled={disabled}
      />
    </div>
  )
}

const s = {
  desktopStudentWorkspace: {
    flex: '0 0 auto',
    minHeight: 460,
    height: '72vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
