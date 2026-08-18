import React, { useMemo } from 'react'
import Desktop from './Desktop.jsx'
import FileManagerApp from './apps/fileManager/FileManagerApp.jsx'
import TextEditorApp from './apps/textEditor/TextEditorApp.jsx'
import ImageViewerApp from './apps/imageViewer/ImageViewerApp.jsx'
import BrowserApp from './apps/browser/BrowserApp.jsx'
import { normaliseSiteGraph } from './apps/browser/siteGraph.js'
import { makeDefaultDesktop, normaliseDesktop, openWindow, isWindowDirty } from './desktopState.js'
import { normaliseDirPath, parentPath, entryName } from '../filesystem/filesystem.js'
import { isImage } from '../filesystem/FilesystemTask.jsx'
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

  const siteGraph = useMemo(() => normaliseSiteGraph(task?.siteGraph), [task?.siteGraph])

  const startsInDir = task?.carryDesktopFrom
    ? (cs.desktopInteraction?.currentDir ?? (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/'))
    : (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')

  // Opening a file always launches a Text Editor/Image Viewer window, even if the task's
  // availableApps doesn't list that app for standalone icon-launch — availableApps only
  // gates which icons appear on the desktop, not whether an opened file can be viewed.
  function handleOpenFile(path) {
    if (disabled) return
    const appId = isImage(path) ? 'imageViewer' : 'textEditor'
    const overrides = appId === 'textEditor' ? { filePath: path, draftContent: desktop.fs[path]?.content ?? '' } : { filePath: path }
    cs.handleDesktopChange(openWindow(desktop, appId, overrides))
    cs.handleDesktopInteraction?.({ currentDir: parentPath(path), openFile: path })
  }

  const apps = useMemo(() => ({
    fileManager: {
      title: 'File Manager',
      icon: '🗂️',
      render: (props) => (
        <FileManagerApp
          {...props}
          onInteraction={disabled ? undefined : cs.handleDesktopInteraction}
          onOpenFile={disabled ? undefined : handleOpenFile}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          assets={lesson.assets}
          startsInDir={startsInDir}
        />
      ),
    },
    textEditor: {
      title: 'Text Editor',
      icon: '📝',
      windowTitle: (win, state) => `${win.filePath ? entryName(win.filePath) : 'Untitled'}${isWindowDirty(win, state.fs) ? ' •' : ''} — Text Editor`,
      render: (props) => (
        <TextEditorApp {...props} onInteraction={disabled ? undefined : cs.handleDesktopInteraction} />
      ),
    },
    imageViewer: {
      title: 'Image Viewer',
      icon: '🖼️',
      windowTitle: (win) => win.filePath ? `${entryName(win.filePath)} — Image Viewer` : 'Image Viewer',
      render: (props) => (
        <ImageViewerApp
          {...props}
          onInteraction={disabled ? undefined : cs.handleDesktopInteraction}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          assets={lesson.assets}
        />
      ),
    },
    browser: {
      title: 'Browser',
      icon: '🌐',
      windowTitle: (win) => {
        if (win.pageId) return `${siteGraph.pages[win.pageId]?.title ?? 'Browser'} — Browser`
        if (win.searchQuery) return `"${win.searchQuery}" — Browser`
        return 'Browser'
      },
      render: (props) => (
        <BrowserApp
          {...props}
          siteGraph={siteGraph}
          onInteraction={disabled ? undefined : cs.handleDesktopInteraction}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [disabled, cs.handleDesktopInteraction, cs.handleDesktopChange, lesson.assetsPath, lesson.assets, startsInDir, desktop, siteGraph])

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
