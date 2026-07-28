import React from 'react'
import InformationTask from '../../components/InformationTask'
import QuizTask from '../../components/QuizTask'
import TeacherCodeTabs from '../../components/TeacherCodeTabs'
import { getLessonModule } from '../../../modules/registry'

export default function TeacherEditorPanel({
  lesson, task, displayTaskId,
  isInSandbox, isInformationTask,
  activeTeacherStage, taskCodeStages,
  teacherCodeTab, setTeacherCodeTab,
  hasStudents, onSendStageToAll,
  liveState, onChange, onActivity,
}) {
  const mod = getLessonModule(lesson?.type)
  const usesUnifiedStages = mod?.type === 'python' || mod?.type === 'html'

  if (!isInSandbox && isInformationTask) return <InformationTask task={task} lesson={lesson} fill />
  if (!isInSandbox && task?.taskType === 'quiz') return <QuizTask task={task} showQuestion disabled />
  if (!mod?.TeacherLiveView) return null

  const displayState = mod.getDisplayState(task, activeTeacherStage, liveState, teacherCodeTab)
  const readOnly = !isInSandbox
  const LiveView = mod.TeacherLiveView
  const showCompleteTab = !usesUnifiedStages && (mod.type === 'python' || mod.type === 'html'
    || (mod.type === 'scratch' && task?.completeBlocks != null)
    || (mod.type === 'filesystem' && !!task?.completeFs)
    || (mod.type === 'electronics' && !!task?.completeCircuit))

  const wrapStyle = mod.type === 'scratch' || mod.type === 'html'
    ? (isInSandbox ? styles.scratchWrap : styles.codeWorkspaceStack)
    : styles.codeWorkspaceStack

  return (
    <div style={wrapStyle}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={i => setTeacherCodeTab(`stage_${i}`)}
          onComplete={showCompleteTab ? () => setTeacherCodeTab('complete') : undefined}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
          starterLabel={mod.stageLabels?.starterLabel}
          completeLabel={mod.stageLabels?.completeLabel}
          unifiedStages={usesUnifiedStages}
        />
      )}
      <LiveView
        key={`teacher-${displayTaskId}-${isInSandbox ? 'sandbox' : teacherCodeTab}`}
        task={task}
        lesson={lesson}
        displayState={displayState}
        liveState={liveState}
        readOnly={readOnly}
        onChange={onChange}
        onActivity={onActivity}
        isInSandbox={isInSandbox}
        activeStage={activeTeacherStage}
      />
    </div>
  )
}

const styles = {
  scratchWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  codeWorkspaceStack: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 0,
  },
}
