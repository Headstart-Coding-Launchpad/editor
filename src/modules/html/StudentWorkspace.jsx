import React, { useEffect, useMemo } from 'react'
import HtmlEditor from './HtmlEditor'
import CollapsibleIframePreview from '../../app/components/CollapsibleIframePreview'
import SplitPane from '../../shared/SplitPane'
import StudentEditorHeader from '../../app/components/StudentEditorHeader'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { buildIframeSrc } from './iframe'
import { selectHtmlTaskFiles } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  lesson, task, cs, isSandbox,
  viewingTaskId, isViewingPrev, isForcedTeacherLive, isMobile,
  displayFiles, displayActiveFile, displayRunStatus, displaySelection,
  isTeacherEditing, teacherLiveFiles = [], teacherLiveActiveFile,
  onVisiblePanesChange,
}) {
  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets('html')
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(
    lesson?.isPlayground ? null : lesson.id,
    lesson.storageAssets ?? [],
  )
  const htmlSharedAssetNames = lesson.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const htmlStorageAssets = [
    ...lessonStorageAssets.filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]
  const viewedFiles = isViewingPrev
    ? selectHtmlTaskFiles({
      tasks: lesson.tasks,
      task,
      taskId: viewingTaskId,
      phase: 'solo',
      readSavedFile: cs.readSavedTaskFile,
    })
    : null
  const files = isTeacherEditing ? teacherLiveFiles : (viewedFiles ?? displayFiles)
  const activeFile = isTeacherEditing
    ? (teacherLiveActiveFile ?? teacherLiveFiles[0]?.name ?? displayActiveFile)
    : isViewingPrev
      ? (files.find(file => file.name === task?.entryFile)?.name ?? files[0]?.name ?? '')
      : displayActiveFile
  const viewedFilesKey = files.map(file => `${file.name}\u0000${file.content}`).join('\u0001')
  const viewedAssetsKey = [
    ...(lesson.assets ?? []),
    ...htmlStorageAssets.map(asset => `${asset.name}\u0000${asset.url ?? ''}`),
  ].join('\u0001')
  const viewedIframeSrc = useMemo(() => isViewingPrev
    ? buildIframeSrc(files, task?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath) || '',
      storageAssets: htmlStorageAssets,
    })
    : null,
  // Rebuild only when the selected task's file content or entry point changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [isViewingPrev, viewedFilesKey, viewedAssetsKey, task?.entryFile, lesson.assetsPath])
  const previewSrc = isForcedTeacherLive ? cs.teacherLiveIframeSrc : (isViewingPrev ? viewedIframeSrc : cs.iframeSrc)
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const showCopyCode = !isSandbox && !cs.inPersonalSandbox && typeof task?.copyCode === 'string' && !!task.copyCode.trim()
  const errorLine = !readOnly && cs.htmlErrorLocation?.file === activeFile ? cs.htmlErrorLocation.line : null
  // Preview is never rendered at all in submit-mode tasks (rightCollapsed forced, width 0
  // below), so it's never meaningfully "visible" there regardless of htmlPreviewCollapsed.
  const previewPaneVisible = task?.interactionMode !== 'submit' && !cs.htmlPreviewCollapsed

  useEffect(() => {
    onVisiblePanesChange?.([...(activeFile ? [activeFile] : []), ...(previewPaneVisible ? ['preview'] : [])])
  }, [activeFile, previewPaneVisible, onVisiblePanesChange])

  if (isMobile) {
    return (
      <div style={s.htmlMobile}>
        <div style={s.htmlLeft}>
          {showCopyCode && <CopyCodePanel code={task.copyCode} language="html" />}
          {!readOnly && (
            <StudentEditorHeader
              task={task}
              running={cs.running}
              onRun={cs.handleRun}
              onSubmit={cs.handleSubmit}
              onReset={cs.handleResetCode}
            />
          )}
          <HtmlEditor
            files={files}
            activeFile={activeFile}
            onTabChange={readOnly ? undefined : cs.handleFileTabChange}
            onFileChange={readOnly ? undefined : cs.handleFileChange}
            onSelectionChange={readOnly ? undefined : cs.handleEditorSelection}
            onActivity={readOnly ? undefined : cs.handleEditorActivity}
            remoteSelection={isForcedTeacherLive && displaySelection?.file === activeFile ? displaySelection : null}
            teacherHighlights={readOnly ? [] : cs.teacherHighlights}
            onHighlightDismiss={readOnly ? undefined : cs.dismissHighlight}
            readOnly={readOnly}
            assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
            assets={lesson.assets}
            storageAssets={htmlStorageAssets}
            errorLine={errorLine}
          />
        </div>
        {task?.interactionMode !== 'submit' && (
          <div style={s.htmlMobilePreview}>
            <CollapsibleIframePreview
              src={previewSrc}
              iframeRef={cs.iframeRef}
              fill
              collapsed={cs.htmlPreviewCollapsed}
              onToggle={() => cs.setHtmlPreviewCollapsed(v => !v)}
              onConsoleError={readOnly ? undefined : cs.handleHtmlRuntimeError}
              animate
            />
          </div>
        )}
        {displayRunStatus === 'submitted' && !task?.check && (
          <div style={s.submitBanner}>Code submitted</div>
        )}
      </div>
    )
  }

  return (
    <>
      <SplitPane
        style={s.htmlSplitPane}
        rightCollapsed={task?.interactionMode === 'submit' || cs.htmlPreviewCollapsed}
        collapsedRightWidth={task?.interactionMode === 'submit' ? 0 : 44}
        collapsedRight={
          task?.interactionMode === 'submit' ? null : (
            <CollapsibleIframePreview
              src={previewSrc}
              iframeRef={cs.iframeRef}
              collapsed
              onToggle={() => cs.setHtmlPreviewCollapsed(false)}
              onConsoleError={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleHtmlRuntimeError}
            />
          )
        }
        left={
          <div style={s.htmlLeft}>
            {showCopyCode && <CopyCodePanel code={task.copyCode} language="html" />}
            {!readOnly && (
              <StudentEditorHeader
                task={task}
                running={cs.running}
                onRun={cs.handleRun}
                onSubmit={cs.handleSubmit}
                onReset={cs.handleResetCode}
              />
            )}
            <HtmlEditor
              files={files}
              activeFile={activeFile}
              onTabChange={readOnly ? undefined : cs.handleFileTabChange}
              onFileChange={readOnly ? undefined : cs.handleFileChange}
              onSelectionChange={readOnly ? undefined : cs.handleEditorSelection}
              onActivity={readOnly ? undefined : cs.handleEditorActivity}
              remoteSelection={isForcedTeacherLive && displaySelection?.file === activeFile ? displaySelection : null}
              readOnly={readOnly}
              assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
              assets={lesson.assets}
              storageAssets={htmlStorageAssets}
              errorLine={errorLine}
            />
          </div>
        }
        right={
          <CollapsibleIframePreview
            src={previewSrc}
            iframeRef={cs.iframeRef}
            fill
            collapsed={false}
            onToggle={() => cs.setHtmlPreviewCollapsed(true)}
            onConsoleError={readOnly ? undefined : cs.handleHtmlRuntimeError}
            animate
          />
        }
      />
      {displayRunStatus === 'submitted' && !task?.check && (
        <div style={s.submitBanner}>Code submitted</div>
      )}
    </>
  )
}

const s = {
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
    gap: 0,
    paddingBottom: 4,
  },
  htmlMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
    height: 'auto',
    overflow: 'hidden',
  },
  htmlMobilePreview: {
    minHeight: 300,
    height: 300,
    display: 'flex',
    flexDirection: 'column',
  },
  htmlSplitPane: {
    flex: '1 1 auto',
    minHeight: 0,
    height: 'auto',
    overflow: 'hidden',
  },
  submitBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#1e40af',
    fontWeight: 600,
  },
}
