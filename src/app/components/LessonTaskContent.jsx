import React, { useState } from 'react'
import Banner from '../../shared/Banner'
import { getLessonModule } from '../../modules/registry'
import SplitPane from '../../shared/SplitPane'
import ExplainerPanel from './ExplainerPanel'
import InformationTask from './InformationTask'
import QuizTask from './QuizTask'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import TaskSlideTransition from './TaskSlideTransition'
import { CollapsedPanelRail, CollapseTabButton } from './CollapsiblePanelControls'
import SupportStagePanel from './SupportStagePanel'
import { getRevealableStages } from '../../shared/taskUtils'

const SIDE_EXPLAINER_TYPES = ['python', 'arcade', 'html', 'scratch', 'electronics']

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
  isTeacherEditing,
  teacherLiveCode,
  teacherLiveFiles,
  teacherLiveArcadeDesign,
  canOfferNextStage,
  canOfferCompletePreview,
  canOfferCompleteSolution,
  canOfferPersonalSandbox,
  explainerShowsComplete,
  presenterLayout = 'both',
  onNeedHelp,
  onTopicOpen,
  onTopicClose,
  openTopicId,
}) {
  const [explainerCollapsed, setExplainerCollapsed] = useState(false)
  const lessonMod = getLessonModule(lesson.type)
  const StudentWorkspace = lessonMod?.StudentWorkspace
  const modStyles = lessonMod?.getLayoutStyles(isMobile) ?? {}
  const supportsSideExplainer = SIDE_EXPLAINER_TYPES.includes(lessonMod?.type ?? lesson.type)
  const showsCompleteCode = !!explainerShowsComplete && !!task?.completeCode
  const hasTaskExplainer = (!!task?.explainer || showsCompleteCode) && !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask
  const useFluidWorkspace = supportsSideExplainer && !isMobile && !isQuizTask && !isInformationTask
  const useSideExplainer = hasTaskExplainer && useFluidWorkspace
  const showExplainerPane = presenterLayout !== 'code'
  const showCodePane = presenterLayout !== 'explainer'
  const supportsStageReveal = ['python', 'html'].includes(lessonMod?.type ?? lesson.type)
  const activeSupportStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && supportsStageReveal && cs.activeSupportStageIndex != null
    ? getRevealableStages(task).find(({ index }) => index === cs.activeSupportStageIndex) ?? null
    : null
  const completeReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.completePreviewShown && lesson.type === 'python' && task?.completeCode
    ? { label: 'Complete solution', code: task.completeCode }
    : null
  const targetedReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.targetedPreviewStageIndex != null
    ? task?.codeStages?.[cs.targetedPreviewStageIndex] ?? null
    : null
  const displayedReferenceStage = completeReferenceStage ?? targetedReferenceStage ?? activeSupportStage
  const targetedOfferStage = cs.targetedStageOffer ? task?.codeStages?.[cs.targetedStageOffer.stageIndex] ?? null : null
  const genericNextStage = !targetedOfferStage && cs.offeredSupportStageIndex == null && canOfferNextStage
    ? task?.codeStages?.[cs.offeredStageIndex + 1] ?? null
    : null

  const taskContentStyle = (!isSandbox && isQuizTask)
    ? s.taskContentQuiz
    : (!isSandbox && isInformationTask)
    ? s.taskContentInfo
    : (modStyles.taskContentStyle ?? s.taskContentFallback)

  const editorAreaStyle = (!isSandbox && isQuizTask)
    ? s.editorAreaQuiz
    : (!isSandbox && isInformationTask)
    ? s.editorAreaInfo
    : (modStyles.editorAreaStyle ?? s.editorAreaFallback)

  const transitionStyle = useFluidWorkspace
    ? { ...taskContentStyle, ...s.fluidTaskContent }
    : taskContentStyle

  const taskExplainer = hasTaskExplainer ? (
    <div style={useSideExplainer ? s.sideExplainerShell : undefined}>
      {useSideExplainer && (
        <CollapseTabButton
          onClick={() => setExplainerCollapsed(true)}
          direction="left"
          title="Collapse Explainer"
          ariaLabel="Collapse Explainer"
          style={s.sideExplainerCollapse}
        />
      )}
      <ExplainerPanel
        title={showsCompleteCode ? 'Complete Code' : task.title}
        content={showsCompleteCode ? '```python\n' + task.completeCode + '\n```' : task.explainer}
        topicType={lesson.type}
        onTopicOpen={onTopicOpen}
        onTopicClose={onTopicClose}
        openTopicId={openTopicId}
        disableCopy
        fill={useSideExplainer}
        collapsible={!useSideExplainer}
        markdownTextScale={useSideExplainer ? 1.08 : 1}
      />
    </div>
  ) : null

  const shouldShowFeedbackBanner = !cs.stagePromptAccepted && !isSandbox && !cs.inPersonalSandbox && (
    ((task?.check || isAutoEvaluatedQuiz) && displayCheckAttempted) || cs.offeredSupportStageIndex != null
  )
  const feedbackBanner = shouldShowFeedbackBanner ? (
    <CheckFeedbackBanner
      passed={cs.offeredSupportStageIndex != null ? false : displayCheckPassed}
      failureMessage={isQuizTask ? 'Not quite right, try again.' : undefined}
      suggestion={displayCheckSuggestion}
      onShowCodeStage={targetedOfferStage
        ? (cs.targetedStageOffer.action === 'replace' ? cs.handleAcceptTargetedStage : cs.handlePreviewTargetedStage)
        : cs.offeredSupportStageIndex != null
        ? cs.handleRevealOfferedSupportStage
        : canOfferNextStage ? () => {
        const nextStageIndex = cs.offeredStageIndex + 1
        cs.handleAcceptGenericNextStage(nextStageIndex)
      } : undefined}
      stageActionLabel={targetedOfferStage
        ? (cs.targetedStageOffer.action === 'replace' ? `Try ${targetedOfferStage.label || 'guided stage'}` : `Show ${targetedOfferStage.label || 'reference'}`)
        : cs.offeredSupportStageIndex != null ? 'Show reference'
        : genericNextStage ? `Use ${genericNextStage.label || 'next stage'}` : undefined}
      stageActionConfirm={targetedOfferStage?.action === 'replace'
        ? `This will replace your current work with “${targetedOfferStage.label || 'this stage'}”. Continue?`
        : genericNextStage
          ? `This will replace your current work with “${genericNextStage.label || 'the next stage'}”. Continue?`
        : undefined}
      onPreviewCompleteCode={canOfferCompletePreview ? cs.handlePreviewCompleteCode : undefined}
      onShowCompleteCode={canOfferCompleteSolution ? cs.handleShowCompleteCode : undefined}
      onGoPersonalSandbox={canOfferPersonalSandbox ? cs.handleEnterPersonalSandbox : undefined}
      onNeedHelp={onNeedHelp}
    />
  ) : null

  const workspaceContent = (
    <>
      {isSandbox && sandboxExplainer && (
        <ExplainerPanel title="Instructions" content={sandboxExplainer} topicType={lesson.type} disableCopy />
      )}

      {displayedReferenceStage && (() => {
        const reveal = completeReferenceStage || targetedReferenceStage ? null : cs.supportStageReveals?.[activeSupportStage?.index]
        const sourceLabel = completeReferenceStage
          ? 'Complete reference'
          : targetedReferenceStage
            ? 'Shown for your feedback'
          : reveal?.source === 'teacher'
            ? 'Opened by your teacher'
            : 'Shown after a failed attempt'
        return (
          <SupportStagePanel
            stage={completeReferenceStage ?? targetedReferenceStage ?? activeSupportStage.stage}
            lessonType={lesson.type}
            revealed={completeReferenceStage || targetedReferenceStage ? true : revealed}
            sourceLabel={sourceLabel}
          />
        )
      })()}

      {!isSandbox && isInformationTask ? (
        <InformationTask task={task} lesson={lesson} fill disableCopy />
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
      ) : StudentWorkspace ? (
        <StudentWorkspace
          lesson={lesson}
          task={task}
          cs={cs}
          lessonId={lessonId}
          identityId={identityId}
          viewingTaskId={viewingTaskId}
          currentTaskId={currentTaskId}
          isSandbox={isSandbox}
          isViewingPrev={isViewingPrev}
          isForcedTeacherLive={isForcedTeacherLive}
          isMobile={isMobile}
          activeStudentView={activeStudentView}
          previewMode={previewMode}
          displayCode={displayCode}
          displayFiles={displayFiles}
          displayActiveFile={displayActiveFile}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displaySelection={displaySelection}
          displayFs={displayFs}
          isTeacherEditing={isTeacherEditing}
          teacherLiveCode={teacherLiveCode}
          teacherLiveFiles={teacherLiveFiles}
          teacherLiveArcadeDesign={teacherLiveArcadeDesign}
        />
      ) : (
        <Banner accent="#dc2626" color="#991b1b" style={{ borderRadius: 8 }}>
          Unable to load this task - unrecognised lesson type "{lesson.type}".
        </Banner>
      )}
    </>
  )

  const editorArea = (
    <div
      style={useFluidWorkspace ? { ...editorAreaStyle, ...s.fluidWorkspace } : editorAreaStyle}
      className={isForcedTeacherLive ? 'live-view-active' : undefined}
    >
      {workspaceContent}
    </div>
  )

  return (
    <TaskSlideTransition transitionKey={transitionKey} style={transitionStyle}>
      {previewMode && task && !isSandbox && (
        <Banner accent="#0ea5e9" color="#0369a1" style={{ padding: '5px 16px', fontSize: 12, fontWeight: 600 }}>
          {task.taskMode === 'live'
            ? 'Live sessions only'
            : task.taskMode === 'solo'
            ? 'Solo mode only'
            : 'Live + Solo'}
        </Banner>
      )}

      {feedbackBanner}

      {useSideExplainer && showExplainerPane && showCodePane ? (
        <SplitPane
          style={s.sideBySideLayout}
          defaultSplit={25}
          leftCollapsed={explainerCollapsed}
          collapsedLeftWidth={44}
          collapsedLeft={
            <CollapsedPanelRail
              onClick={() => setExplainerCollapsed(false)}
              label="Explainer"
              direction="right"
              title="Show Explainer"
              ariaLabel="Show Explainer"
            />
          }
          left={taskExplainer}
          right={editorArea}
        />
      ) : (
        <>
          {showExplainerPane && taskExplainer}
          {showCodePane && editorArea}
        </>
      )}
    </TaskSlideTransition>
  )
}

const s = {
  taskContentFallback: {
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
    overflow: 'visible',
  },
  taskContentInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaFallback: {
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
    overflow: 'auto',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  fluidTaskContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sideBySideLayout: {
    flex: 1,
    minHeight: 0,
    gap: 12,
    overflow: 'hidden',
  },
  sideExplainerShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  sideExplainerCollapse: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 3,
    width: 28,
    height: 28,
    alignSelf: 'auto',
    color: '#fff',
  },
  fluidWorkspace: {
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
}
