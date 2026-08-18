import React, { useMemo } from 'react'
import Desktop from './Desktop.jsx'
import FileManagerApp from './apps/fileManager/FileManagerApp.jsx'
import TextEditorApp from './apps/textEditor/TextEditorApp.jsx'
import ImageViewerApp from './apps/imageViewer/ImageViewerApp.jsx'
import PaintApp from './apps/paint/PaintApp.jsx'
import BrowserApp from './apps/browser/BrowserApp.jsx'
import { normaliseSiteGraph } from './apps/browser/siteGraph.js'
import { normaliseDesktop, openWindow, isWindowDirty } from './desktopState.js'
import { parentPath, entryName } from '../filesystem/filesystem.js'
import { isImage } from '../filesystem/FilesystemTask.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'

export default function DesktopTeacherLiveView({ task, lesson, displayState, readOnly, onChange }) {
  const availableApps = task?.availableApps ?? ['fileManager']
  const desktop = normaliseDesktop(displayState)
  const siteGraph = normaliseSiteGraph(task?.siteGraph)

  function handleOpenFile(path) {
    if (readOnly) return
    const appId = isImage(path) ? 'imageViewer' : 'textEditor'
    const overrides = appId === 'textEditor' ? { filePath: path, draftContent: desktop.fs[path]?.content ?? '' } : { filePath: path }
    onChange(openWindow(desktop, appId, overrides))
  }

  const apps = useMemo(() => ({
    fileManager: {
      title: 'File Manager',
      icon: '🗂️',
      render: (props) => (
        <FileManagerApp
          {...props}
          onOpenFile={readOnly ? undefined : handleOpenFile}
          assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
          assets={lesson?.assets}
          startsInDir={task?.startsInDir ?? '/'}
        />
      ),
    },
    textEditor: {
      title: 'Text Editor',
      icon: '📝',
      windowTitle: (win, state) => `${win.filePath ? entryName(win.filePath) : 'Untitled'}${isWindowDirty(win, state.fs) ? ' •' : ''} — Text Editor`,
      render: (props) => <TextEditorApp {...props} />,
    },
    imageViewer: {
      title: 'Image Viewer',
      icon: '🖼️',
      windowTitle: (win) => win.filePath ? `${entryName(win.filePath)} — Image Viewer` : 'Image Viewer',
      render: (props) => (
        <ImageViewerApp
          {...props}
          assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
          assets={lesson?.assets}
        />
      ),
    },
    paint: {
      title: 'Paint',
      icon: '🎨',
      windowTitle: (win, state) => `${win.filePath ? entryName(win.filePath) : 'Untitled'}${isWindowDirty(win, state.fs) ? ' •' : ''} — Paint`,
      render: (props) => <PaintApp {...props} />,
    },
    browser: {
      title: 'Browser',
      icon: '🌐',
      windowTitle: (win) => {
        if (win.pageId) return `${siteGraph.pages[win.pageId]?.title ?? 'Browser'} — Browser`
        if (win.searchQuery) return `"${win.searchQuery}" — Browser`
        return 'Browser'
      },
      render: (props) => <BrowserApp {...props} siteGraph={siteGraph} />,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lesson, task, readOnly, desktop, siteGraph])

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
