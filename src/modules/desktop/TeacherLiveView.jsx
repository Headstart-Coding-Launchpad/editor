import React, { useMemo } from 'react'
import Desktop from './Desktop.jsx'
import FileManagerApp from './apps/fileManager/FileManagerApp.jsx'
import { normaliseDesktop } from './desktopState.js'
import { resolveAssetsPath } from '../../shared/assetPaths'

export default function DesktopTeacherLiveView({ task, lesson, displayState, readOnly, onChange }) {
  const availableApps = task?.availableApps ?? ['fileManager']
  const desktop = normaliseDesktop(displayState)

  const apps = useMemo(() => ({
    fileManager: {
      title: 'File Manager',
      icon: '🗂️',
      render: (props) => (
        <FileManagerApp
          {...props}
          assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
          assets={lesson?.assets}
          startsInDir={task?.startsInDir ?? '/'}
        />
      ),
    },
  }), [lesson, task])

  return (
    <Desktop
      state={desktop}
      onStateChange={readOnly ? undefined : onChange}
      apps={apps}
      availableApps={availableApps}
      disabled={readOnly}
    />
  )
}
