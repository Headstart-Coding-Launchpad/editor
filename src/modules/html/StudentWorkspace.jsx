import React from 'react'
import HtmlEditor from './HtmlEditor'
import CollapsibleIframePreview from '../../app/components/CollapsibleIframePreview'
import SplitPane from '../../shared/SplitPane'
import StudentEditorHeader from '../../app/components/StudentEditorHeader'
import CopyCodePanel from '../../app/components/CopyCodePanel'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'

export default function StudentWorkspace({
  lesson, task, cs, isSandbox,
  isViewingPrev, isForcedTeacherLive, isMobile,
  displayFiles, displayActiveFile, displayRunStatus, displaySelection,
}) {
  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets('html')
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(lesson.id, lesson.storageAssets ?? [])
  const htmlSharedAssetNames = lesson.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const htmlStorageAssets = [
    ...lessonStorageAssets.filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]
  const showCopyCode = !isSandbox && !cs.inPersonalSandbox && typeof task?.copyCode === 'string' && !!task.copyCode.trim()

  if (isMobile) {
    return (
      <div style={s.htmlMobile}>
        <div style={s.htmlLeft}>
          {showCopyCode && <CopyCodePanel code={task.copyCode} language="html" />}
          {!isViewingPrev && !isForcedTeacherLive && (
            <StudentEditorHeader
              task={task}
              running={cs.running}
              onRun={cs.handleRun}
              onSubmit={cs.handleSubmit}
              onReset={cs.handleResetCode}
            />
          )}
          <HtmlEditor
            files={displayFiles}
            activeFile={displayActiveFile}
            onTabChange={isForcedTeacherLive ? undefined : cs.handleFileTabChange}
            onFileChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFileChange}
            onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorSelection}
            onActivity={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorActivity}
            remoteSelection={isForcedTeacherLive && displaySelection?.file === displayActiveFile ? displaySelection : null}
            teacherHighlights={isViewingPrev || isForcedTeacherLive ? [] : cs.teacherHighlights}
            onHighlightDismiss={isViewingPrev || isForcedTeacherLive ? undefined : cs.dismissHighlight}
            readOnly={isViewingPrev || isForcedTeacherLive}
            assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
            assets={lesson.assets}
            storageAssets={htmlStorageAssets}
          />
        </div>
        {task?.interactionMode !== 'submit' && (
          <div style={s.htmlMobilePreview}>
            <CollapsibleIframePreview
              src={isForcedTeacherLive ? cs.teacherLiveIframeSrc : cs.iframeSrc}
              iframeRef={cs.iframeRef}
              fill
              collapsed={cs.htmlPreviewCollapsed}
              onToggle={() => cs.setHtmlPreviewCollapsed(v => !v)}
              onConsoleError={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleHtmlRuntimeError}
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
              src={isForcedTeacherLive ? cs.teacherLiveIframeSrc : cs.iframeSrc}
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
            {!isViewingPrev && !isForcedTeacherLive && (
              <StudentEditorHeader
                task={task}
                running={cs.running}
                onRun={cs.handleRun}
                onSubmit={cs.handleSubmit}
                onReset={cs.handleResetCode}
              />
            )}
            <HtmlEditor
              files={displayFiles}
              activeFile={displayActiveFile}
              onTabChange={isForcedTeacherLive ? undefined : cs.handleFileTabChange}
              onFileChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFileChange}
              onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorSelection}
              onActivity={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorActivity}
              remoteSelection={isForcedTeacherLive && displaySelection?.file === displayActiveFile ? displaySelection : null}
              readOnly={isViewingPrev || isForcedTeacherLive}
              assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
              assets={lesson.assets}
              storageAssets={htmlStorageAssets}
            />
          </div>
        }
        right={
          <CollapsibleIframePreview
            src={isForcedTeacherLive ? cs.teacherLiveIframeSrc : cs.iframeSrc}
            iframeRef={cs.iframeRef}
            fill
            collapsed={false}
            onToggle={() => cs.setHtmlPreviewCollapsed(true)}
            onConsoleError={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleHtmlRuntimeError}
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
