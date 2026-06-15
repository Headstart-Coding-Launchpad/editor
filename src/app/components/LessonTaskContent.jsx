import React from 'react'
import Banner from '../../shared/Banner'
import { getLessonModule } from '../../modules/registry'
import ExplainerPanel from './ExplainerPanel'
import InformationTask from './InformationTask'
import QuizTask from './QuizTask'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import TaskSlideTransition from './TaskSlideTransition'

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
  canOfferNextStage,
  canOfferCompleteSolution,
  canOfferPersonalSandbox,
  onNeedHelp,
  onTopicOpen,
  onTopicClose,
  openTopicId,
}) {
  const lessonMod = getLessonModule(lesson.type)
  const modStyles = lessonMod?.getLayoutStyles(isMobile) ?? {}

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

  return (
    <TaskSlideTransition transitionKey={transitionKey} style={taskContentStyle}>
      {previewMode && task && !isSandbox && (
        <Banner accent="#0ea5e9" color="#0369a1" style={{ padding: '5px 16px', fontSize: 12, fontWeight: 600 }}>
          {task.taskMode === 'live'
            ? 'Live sessions only'
            : task.taskMode === 'solo'
            ? 'Solo mode only'
            : 'Live + Solo'}
        </Banner>
      )}

      {task?.explainer && !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && (
        <ExplainerPanel title={task.title} content={task.explainer} topicType={lesson.type} onTopicOpen={onTopicOpen} onTopicClose={onTopicClose} openTopicId={openTopicId} />
      )}

      <div style={editorAreaStyle} className={isForcedTeacherLive ? 'live-view-active' : undefined}>
        {!isSandbox && !cs.inPersonalSandbox && (task?.check || isAutoEvaluatedQuiz) && displayCheckAttempted && (
          <CheckFeedbackBanner
            passed={displayCheckPassed}
            failureMessage={isQuizTask ? 'Not quite right, try again.' : undefined}
            suggestion={displayCheckSuggestion}
            onShowCodeStage={canOfferNextStage ? () => cs.handleShowCodeStage(cs.offeredStageIndex + 1) : undefined}
            onShowCompleteCode={canOfferCompleteSolution ? cs.handleShowCompleteCode : undefined}
            onGoPersonalSandbox={canOfferPersonalSandbox ? cs.handleEnterPersonalSandbox : undefined}
            onNeedHelp={onNeedHelp}
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
        ) : lessonMod && (
          <lessonMod.StudentWorkspace
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
          />
        )}
      </div>
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
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
}
