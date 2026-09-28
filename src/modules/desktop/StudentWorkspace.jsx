import React, { useCallback, useMemo, useRef } from 'react'
import Desktop from './Desktop.jsx'
import FileManagerApp from './apps/fileManager/FileManagerApp.jsx'
import TextEditorApp from './apps/textEditor/TextEditorApp.jsx'
import ImageViewerApp from './apps/imageViewer/ImageViewerApp.jsx'
import PaintApp from './apps/paint/PaintApp.jsx'
import BrowserApp from './apps/browser/BrowserApp.jsx'
import { normaliseSiteGraph } from './apps/browser/siteGraph.js'
import { makeDefaultDesktop, normaliseDesktop, openWindow, isWindowDirty } from './desktopState.js'
import { normaliseDirPath, parentPath, entryName } from '../filesystem/filesystem.js'
import { isImage } from '../filesystem/FilesystemTask.jsx'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { resolveSavedCarrySource } from '../../app/studentTaskContent'
import { useSurfaceInputRecorder } from '../../shared/input/useSurfaceInputRecorder.js'
import { inputChecksOf, inputSummaryCapFor } from '../../shared/input/checks.js'

// Menu/toolbar clipboard commands and the keyboard shortcut each stands in for.
const COMMAND_COMBOS = { copy: 'mod+c', cut: 'mod+x', paste: 'mod+v' }

export default function StudentWorkspace({
  lesson,
  task,
  cs,
  viewingTaskId,
  currentTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  displayDesktop,
}) {
  const availableApps = task?.availableApps ?? ['fileManager']
  const disabled = isViewingPrev || isForcedTeacherLive

  // ── Input recording (input_* checks) ─────────────────────────────────────────
  // Only tasks with an input check record anything. The summary rides on the desktop
  // interaction (in memory, like currentDir/openFile — never persisted or synced), so it reaches
  // the checks through the hook's existing interaction → check-context path. Every interaction
  // report re-sends the latest summary because the hook replaces the interaction wholesale.
  const surfaceRef = useRef(null)
  const inputRef = useRef(null)
  const interactionRef = useRef(cs.desktopInteraction)
  interactionRef.current = cs.desktopInteraction
  const handleDesktopInteractionRef = useRef(cs.handleDesktopInteraction)
  handleDesktopInteractionRef.current = cs.handleDesktopInteraction
  const recordsInput = !disabled && inputChecksOf(task).length > 0
  // Per current task: glancing at a previous task (read-only) keeps this task's evidence.
  const taskKey = currentTaskId

  const reportInteraction = useCallback((interaction) => {
    interactionRef.current = interaction
    handleDesktopInteractionRef.current?.(
      inputRef.current ? { ...interaction, input: inputRef.current } : interaction
    )
  }, [])

  const recordCommand = useSurfaceInputRecorder(surfaceRef, {
    enabled: recordsInput,
    cap: inputSummaryCapFor(task),
    resetKey: taskKey,
    onSummary: (summary) => {
      inputRef.current = summary
      reportInteraction(interactionRef.current ?? { currentDir: '/', openFile: null })
    },
  })
  // A new task starts without input evidence.
  const inputTaskRef = useRef(taskKey)
  if (inputTaskRef.current !== taskKey) {
    inputTaskRef.current = taskKey
    inputRef.current = null
  }
  const handleCommand = useCallback(
    (command) => {
      if (COMMAND_COMBOS[command]) recordCommand(COMMAND_COMBOS[command], 'menu')
    },
    [recordCommand]
  )
  const onInteraction = cs.handleDesktopInteraction ? reportInteraction : undefined

  const viewedDesktop = isViewingPrev ? cs.readSavedTaskDesktop(viewingTaskId) : null
  const viewedCarry =
    isViewingPrev && viewedDesktop == null
      ? resolveSavedCarrySource({
          tasks: lesson.tasks,
          taskId: viewingTaskId,
          carryFromId: task?.carryDesktopFrom,
          carryField: 'carryDesktopFrom',
          readSavedState: cs.readSavedTaskDesktop,
          hasSavedState: (saved) => saved != null,
        })
      : null
  const desktop = isViewingPrev
    ? normaliseDesktop(
        viewedDesktop ??
          viewedCarry?.saved ??
          task?.starterDesktop ??
          makeDefaultDesktop(availableApps)
      )
    : normaliseDesktop(displayDesktop)

  const siteGraph = useMemo(() => normaliseSiteGraph(task?.siteGraph), [task?.siteGraph])

  const startsInDir = task?.carryDesktopFrom
    ? (cs.desktopInteraction?.currentDir ??
      (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/'))
    : task?.startsInDir
      ? normaliseDirPath(task.startsInDir)
      : '/'

  // Opening a file always launches a Text Editor/Image Viewer window, even if the task's
  // availableApps doesn't list that app for standalone icon-launch — availableApps only
  // gates which icons appear on the desktop, not whether an opened file can be viewed.
  function handleOpenFile(path) {
    if (disabled) return
    const appId = isImage(path) ? 'imageViewer' : 'textEditor'
    const overrides =
      appId === 'textEditor'
        ? { filePath: path, draftContent: desktop.fs[path]?.content ?? '' }
        : { filePath: path }
    cs.handleDesktopChange(openWindow(desktop, appId, overrides))
    onInteraction?.({ currentDir: parentPath(path), openFile: path })
  }

  const apps = useMemo(
    () => ({
      fileManager: {
        title: 'File Manager',
        icon: '🗂️',
        render: (props) => (
          <FileManagerApp
            {...props}
            onInteraction={disabled ? undefined : onInteraction}
            onOpenFile={disabled ? undefined : handleOpenFile}
            onCommand={recordsInput ? handleCommand : undefined}
            assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
            assets={lesson.assets}
            startsInDir={startsInDir}
          />
        ),
      },
      textEditor: {
        title: 'Text Editor',
        icon: '📝',
        windowTitle: (win, state) =>
          `${win.filePath ? entryName(win.filePath) : 'Untitled'}${isWindowDirty(win, state.fs) ? ' •' : ''} — Text Editor`,
        render: (props) => (
          <TextEditorApp {...props} onInteraction={disabled ? undefined : onInteraction} />
        ),
      },
      imageViewer: {
        title: 'Image Viewer',
        icon: '🖼️',
        windowTitle: (win) =>
          win.filePath ? `${entryName(win.filePath)} — Image Viewer` : 'Image Viewer',
        render: (props) => (
          <ImageViewerApp
            {...props}
            onInteraction={disabled ? undefined : onInteraction}
            assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
            assets={lesson.assets}
          />
        ),
      },
      paint: {
        title: 'Paint',
        icon: '🎨',
        windowTitle: (win, state) =>
          `${win.filePath ? entryName(win.filePath) : 'Untitled'}${isWindowDirty(win, state.fs) ? ' •' : ''} — Paint`,
        render: (props) => (
          <PaintApp {...props} onInteraction={disabled ? undefined : onInteraction} />
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
            onInteraction={disabled ? undefined : onInteraction}
          />
        ),
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [
      disabled,
      onInteraction,
      recordsInput,
      handleCommand,
      cs.handleDesktopChange,
      lesson.assetsPath,
      lesson.assets,
      startsInDir,
      desktop,
      siteGraph,
    ]
  )

  return (
    <div
      ref={surfaceRef}
      style={s.desktopStudentWorkspace}
      key={`desktop-${viewingTaskId ?? currentTaskId}`}
    >
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
