import React from 'react'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { normaliseDirPath } from '../../shared/filesystem'
import { loadSavedCode, loadPersonalSandboxCode } from '../studentStorage'
import { selectScratchInitialProject } from '../studentTaskContent'
import ExplainerPanel from './ExplainerPanel'
import InformationTask from './InformationTask'
import PythonEditor from './PythonEditor'
import HtmlEditor from './HtmlEditor'
import OutputPanel from './OutputPanel'
import CollapsibleIframePreview from './CollapsibleIframePreview'
import ScratchWorkspace from './ScratchWorkspace'
import QuizTask from './QuizTask'
import FilesystemTask from './FilesystemTask'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import SplitPane from '../../shared/SplitPane'
import TaskSlideTransition from './TaskSlideTransition'
import StudentEditorHeader from './StudentEditorHeader'

export default function LessonTaskContent({
  lesson,
  task,
  cs,
  lessonId,
  identityId,
  sandboxExplainer,
  activeStudentView,
  viewingTaskId,
  currentTaskId,
  transitionKey,
  previewMode,
  isSandbox,
  isViewingPrev,
  isForcedTeacherLive,
  isMobile,
  isQuizTask,
  isAutoEvaluatedQuiz,
  isInformationTask,
  displayCode,
  displayFiles,
  displayActiveFile,
  displayOutput,
  displayRunStatus,
  displayCheckPassed,
  displayCheckAttempted,
  displayCheckSuggestion,
  displaySelection,
  displayFs,
  canOfferCompleteSolution,
  canOfferPersonalSandbox,
}) {
  const taskContentStyle = (!isSandbox && isQuizTask)
    ? s.taskContentQuiz
    : (!isSandbox && isInformationTask)
    ? s.taskContentInfo
    : lesson.type === 'python' || lesson.type === 'html'
    ? s.taskContentScroll
    : s.taskContent

  const editorAreaStyle = (!isSandbox && isQuizTask)
    ? s.editorAreaQuiz
    : (!isSandbox && isInformationTask)
    ? s.editorAreaInfo
    : lesson.type === 'scratch'
    ? s.editorAreaScratch
    : lesson.type === 'python' || lesson.type === 'html'
    ? s.editorAreaScroll
    : s.editorArea

  return (
    <TaskSlideTransition transitionKey={transitionKey} style={taskContentStyle}>
      {previewMode && task && !isSandbox && (
        <div style={s.previewTaskModeBanner}>
          {task.taskMode === 'live'
            ? 'Live sessions only'
            : task.taskMode === 'solo'
            ? 'Solo mode only'
            : 'Live + Solo'}
        </div>
      )}

      {task?.explainer && !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && (
        <ExplainerPanel title={task.title} content={task.explainer} topicType={lesson.type} />
      )}

      <div style={editorAreaStyle} className={isForcedTeacherLive ? 'live-view-active' : undefined}>
        {!isSandbox && !cs.inPersonalSandbox && (task?.check || isAutoEvaluatedQuiz) && displayCheckAttempted && (
          <CheckFeedbackBanner
            passed={displayCheckPassed}
            failureMessage={isQuizTask ? 'Not quite right, try again.' : undefined}
            suggestion={displayCheckSuggestion}
            onShowCompleteCode={canOfferCompleteSolution ? cs.handleShowCompleteCode : undefined}
            onGoPersonalSandbox={canOfferPersonalSandbox ? cs.handleEnterPersonalSandbox : undefined}
          />
        )}
        {isSandbox && sandboxExplainer && (
          <ExplainerPanel title="Instructions" content={sandboxExplainer} topicType={lesson.type} />
        )}

        {!isSandbox && isInformationTask ? (
          <InformationTask task={task} lesson={lesson} fill />
        ) : !isSandbox && isQuizTask ? (
          <QuizTask
            task={task}
            showQuestion
            selectedAnswer={cs.selectedAnswer}
            onSelectAnswer={isViewingPrev ? undefined : cs.handleQuizSelect}
            submitted={cs.runStatus === 'submitted'}
            checkPassed={cs.checkPassed}
            disabled={isViewingPrev}
            showResult={false}
          />
        ) : lesson.type === 'filesystem' ? (
          <FilesystemTask
            key={`filesystem-${viewingTaskId ?? currentTaskId}`}
            initialDir={task?.carryFsFrom ? (cs.fsInteraction?.currentDir ?? (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')) : (task?.startsInDir ? normaliseDirPath(task.startsInDir) : '/')}
            fs={displayFs}
            onFsChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsChange}
            onInteraction={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleFsInteraction}
            assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
            assets={lesson.assets}
            disabled={isViewingPrev || isForcedTeacherLive}
          />
        ) : lesson.type === 'scratch' ? (
          <ScratchContent
            lesson={lesson}
            task={task}
            cs={cs}
            lessonId={lessonId}
            identityId={identityId}
            activeStudentView={activeStudentView}
            viewingTaskId={viewingTaskId}
            currentTaskId={currentTaskId}
            isSandbox={isSandbox}
            isViewingPrev={isViewingPrev}
            isForcedTeacherLive={isForcedTeacherLive}
            previewMode={previewMode}
          />
        ) : lesson.type === 'python' ? (
          <PythonContent
            task={task}
            cs={cs}
            lessonId={lessonId}
            identityId={identityId}
            viewingTaskId={viewingTaskId}
            isViewingPrev={isViewingPrev}
            isForcedTeacherLive={isForcedTeacherLive}
            displayCode={displayCode}
            displayOutput={displayOutput}
            displayRunStatus={displayRunStatus}
            displayCheckPassed={displayCheckPassed}
            displayCheckAttempted={displayCheckAttempted}
            displaySelection={displaySelection}
          />
        ) : isMobile ? (
          <HtmlMobileContent
            lesson={lesson}
            task={task}
            cs={cs}
            isViewingPrev={isViewingPrev}
            isForcedTeacherLive={isForcedTeacherLive}
            displayFiles={displayFiles}
            displayActiveFile={displayActiveFile}
            displayRunStatus={displayRunStatus}
            displaySelection={displaySelection}
          />
        ) : (
          <HtmlDesktopContent
            lesson={lesson}
            task={task}
            cs={cs}
            isViewingPrev={isViewingPrev}
            isForcedTeacherLive={isForcedTeacherLive}
            displayFiles={displayFiles}
            displayActiveFile={displayActiveFile}
            displayRunStatus={displayRunStatus}
            displaySelection={displaySelection}
          />
        )}
      </div>
    </TaskSlideTransition>
  )
}

// ─── Python task ──────────────────────────────────────────────────────────────

function PythonContent({ task, cs, lessonId, identityId, viewingTaskId, isViewingPrev, isForcedTeacherLive, displayCode, displayOutput, displayRunStatus, displayCheckPassed, displayCheckAttempted, displaySelection }) {
  return (
    <>
      {!isViewingPrev && !isForcedTeacherLive && (
        <div style={s.studentEditorHeader} className="ui-tabs ui-tabs--editor">
          <span style={s.studentEditorTitle}>Code</span>
          <div style={s.studentEditorActions}>
            {task?.interactionMode === 'submit' ? (
              <button className="btn-primary" style={s.studentEditorPrimaryBtn} onClick={cs.handleSubmit}>
                Submit
              </button>
            ) : (
              <>
                <button
                  className={cs.running || cs.runningTests ? 'btn-danger' : 'btn-primary'}
                  style={s.studentEditorPrimaryBtn}
                  onClick={cs.running || cs.runningTests ? cs.handleStop : cs.handleRun}
                  disabled={!cs.running && !cs.runningTests && cs.pyodideStatus === 'loading'}
                >
                  {cs.running || cs.runningTests ? 'Stop' : cs.pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                </button>
                {task?.tests?.length > 0 && (
                  <button
                    className="btn-primary"
                    style={s.studentEditorPrimaryBtn}
                    onClick={cs.runningTests ? undefined : cs.handleRunTests}
                    disabled={cs.running || cs.pyodideStatus === 'loading' || cs.runningTests}
                  >
                    {cs.runningTests ? 'Running tests…' : 'Run Tests'}
                  </button>
                )}
              </>
            )}
            <button
              className="btn-ghost-outline"
              style={s.resetBtn}
              onClick={cs.handleResetCode}
              disabled={cs.running}
              title="Reset code to the starter code for this task"
            >
              Reset Code
            </button>
          </div>
        </div>
      )}
      <PythonEditor
        code={isForcedTeacherLive ? displayCode : isViewingPrev ? (loadSavedCode(lessonId, viewingTaskId, identityId)?.code ?? '') : cs.code}
        readOnly={isViewingPrev || isForcedTeacherLive}
        onChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleCodeChange}
        onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorSelection}
        onActivity={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleEditorActivity}
        remoteSelection={isForcedTeacherLive ? displaySelection : null}
        pyodideStatus={cs.pyodideStatus}
      />
      {!isViewingPrev && !isForcedTeacherLive && (
        task?.interactionMode === 'submit' ? (
          <>
            {cs.runStatus === 'submitted' && !task?.check && (
              <div style={s.submitBanner}>Code submitted</div>
            )}
          </>
        ) : (
          <>
            <OutputPanel
              output={cs.output}
              runStatus={cs.runStatus}
              inputPrompt={cs.inputPrompt}
              onInputSubmit={cs.handleInputSubmit}
              checkPassed={cs.checkPassed}
              hasCheck={!!task?.check || task?.tests?.length > 0}
              running={cs.running || cs.runningTests}
            />
            {cs.testResults !== null && (
              <div style={s.testResultsPanel}>
                {cs.testResults.map((r, i) => (
                  <span key={r.id ?? i} style={{ ...s.testResultBadge, background: r.passed ? '#dcfce7' : '#fef3c7', color: r.passed ? '#15803d' : '#b45309' }}>
                    {r.passed ? '✓' : '✗'} {r.name || `Test ${i + 1}`}
                  </span>
                ))}
              </div>
            )}
          </>
        )
      )}
      {isForcedTeacherLive && (
        <OutputPanel
          output={displayOutput}
          runStatus={displayRunStatus}
          checkPassed={displayCheckPassed}
          hasCheck={!!task?.check}
          checkAttempted={displayCheckAttempted}
        />
      )}
      {isViewingPrev && (
        <OutputPanel
          output={loadSavedCode(lessonId, viewingTaskId, identityId)?.output ?? ''}
          runStatus={loadSavedCode(lessonId, viewingTaskId, identityId)?.runStatus ?? null}
          checkPassed={false}
          hasCheck={false}
          checkAttempted={false}
        />
      )}
    </>
  )
}

// ─── Scratch task ─────────────────────────────────────────────────────────────

function ScratchContent({ lesson, task, cs, lessonId, identityId, activeStudentView, viewingTaskId, currentTaskId, isSandbox, isViewingPrev, isForcedTeacherLive, previewMode }) {
  const personalSandboxScratchState = cs.inPersonalSandbox
    ? (loadPersonalSandboxCode(lessonId, identityId)?.state ?? lesson.sandboxStarterCode ?? null)
    : null
  const initialProject = cs.inPersonalSandbox ? null : selectScratchInitialProject({
    task,
    taskId: viewingTaskId ?? currentTaskId,
    readSavedCode: previewMode ? () => null : sourceTaskId => loadSavedCode(lessonId, sourceTaskId, identityId),
  })

  return (
    <>
      {!isViewingPrev && !isSandbox && !cs.inPersonalSandbox && !isForcedTeacherLive && (
        <div style={{ display: 'flex', flexShrink: 0, paddingBottom: 4 }}>
          <button
            className="btn-ghost-outline"
            style={s.resetBtn}
            onClick={cs.handleResetCode}
            title="Reset blocks to the starter blocks for this task"
          >
            Reset Blocks
          </button>
        </div>
      )}
      <ScratchWorkspace
        key={`scratch-${viewingTaskId ?? currentTaskId}-${isSandbox ? 'sandbox' : cs.inPersonalSandbox ? 'personal-sandbox' : 'task'}`}
        task={cs.inPersonalSandbox ? null : task}
        predefinedBlocks={cs.inPersonalSandbox ? null : task?.predefinedBlocks ?? null}
        readOnly={isViewingPrev || isForcedTeacherLive}
        unrestricted={isSandbox || cs.inPersonalSandbox}
        assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
        initialState={initialProject}
        onStateChange={isViewingPrev || isForcedTeacherLive ? undefined : cs.handleScratchChange}
        onCheckResult={isViewingPrev || isForcedTeacherLive || cs.inPersonalSandbox ? undefined : cs.handleScratchCheck}
        externalState={isSandbox ? cs.scratchSandboxProject : cs.inPersonalSandbox ? personalSandboxScratchState : cs.scratchExternalState}
        syncNowKey={activeStudentView === identityId ? activeStudentView : null}
      />
    </>
  )
}

// ─── HTML mobile task ─────────────────────────────────────────────────────────

function HtmlMobileContent({ lesson, task, cs, isViewingPrev, isForcedTeacherLive, displayFiles, displayActiveFile, displayRunStatus, displaySelection }) {
  return (
    <div style={s.htmlMobile}>
      <div style={s.htmlLeft}>
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
          storageAssets={(lesson.storageAssets ?? []).filter(a => a.showInEditor)}
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

// ─── HTML desktop task ────────────────────────────────────────────────────────

function HtmlDesktopContent({ lesson, task, cs, isViewingPrev, isForcedTeacherLive, displayFiles, displayActiveFile, displayRunStatus, displaySelection }) {
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
            />
          )
        }
        left={
          <div style={s.htmlLeft}>
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
              storageAssets={(lesson.storageAssets ?? []).filter(a => a.showInEditor)}
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
  taskContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'visible',
  },
  taskContentQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'hidden',
  },
  taskContentInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  taskContentScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'visible',
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  editorAreaQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editorAreaScratch: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  previewTaskModeBanner: {
    background: 'rgba(14,165,233,0.08)',
    borderBottom: '1px solid rgba(14,165,233,0.2)',
    padding: '5px 16px',
    fontSize: 12,
    color: '#0369a1',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    flexShrink: 0,
  },
  studentEditorHeader: {
    flexShrink: 0,
  },
  studentEditorTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: 'var(--colour-primary)',
    padding: '0 10px',
  },
  studentEditorActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    flexWrap: 'wrap',
  },
  studentEditorPrimaryBtn: {
    padding: '7px 18px',
    fontSize: 13,
    flexShrink: 0,
  },
  resetBtn: {
    fontSize: 14,
    padding: '9px 20px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 420,
    overflow: 'visible',
    gap: 0,
    paddingBottom: 4,
  },
  htmlMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
  },
  htmlMobilePreview: {
    minHeight: 300,
    height: 300,
    display: 'flex',
    flexDirection: 'column',
  },
  htmlSplitPane: {
    flex: '0 0 auto',
    minHeight: 520,
    height: 520,
    overflow: 'visible',
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
  testResultsPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  testResultBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    borderRadius: 999,
    padding: '3px 10px',
    border: '1px solid transparent',
  },
}
