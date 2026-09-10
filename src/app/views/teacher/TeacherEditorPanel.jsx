import React from 'react'
import InformationTask from '../../components/InformationTask'
import QuizTask from '../../components/QuizTask'
import CodeArrangeTask from '../../components/CodeArrangeTask'
import TeacherCodeTabs from '../../components/TeacherCodeTabs'
import { getLessonModule } from '../../../modules/registry'
import { buildSolutionSlotState } from '../../../shared/codeArrange'
import {
  TEACHER_LIVE_REFERENCE_TYPES,
  teacherLiveReferenceDisplayState,
} from '../../studentLiveDisplay'

export default function TeacherEditorPanel({
  lesson,
  task,
  displayTaskId,
  isInSandbox,
  isInformationTask,
  activeTeacherStage,
  taskCodeStages,
  teacherCodeTab,
  setTeacherCodeTab,
  hasStudents,
  onSendStageToAll,
  liveState,
  onChange,
  onActivity,
  teacherLiveReference,
  teacherLiveReferenceVisibleToAll,
  onToggleLiveReference,
}) {
  const mod = getLessonModule(lesson?.type)
  const usesUnifiedStages = mod?.type === 'python' || mod?.type === 'html'

  if (!isInSandbox && isInformationTask) return <InformationTask task={task} lesson={lesson} fill />
  if (!isInSandbox && task?.taskType === 'quiz')
    return <QuizTask task={task} showQuestion disabled />
  // Arrange tasks assemble from drag-and-drop tiles, not starter/stage code —
  // showing the authored solution as a read-only tile board (mirroring how
  // other task types show their Complete state) instead of falling through to
  // the module's code editor, which would just show an empty starter box.
  if (!isInSandbox && task?.taskType === 'code_arrange')
    return (
      <CodeArrangeTask
        task={task}
        moduleType={mod?.type === 'html' ? 'html' : 'python'}
        selectedAnswer={buildSolutionSlotState(task)}
        disabled
        showQuestion={false}
      />
    )
  if (!mod?.TeacherLiveView) return null

  // Presentation View's live-reference broadcast, shown read-only via the "Live" tab —
  // only offered while it's actually broadcasting this task (see useTeacherLivePublish.js).
  const liveReferenceAvailable =
    TEACHER_LIVE_REFERENCE_TYPES.includes(mod.type) &&
    !!teacherLiveReference?.active &&
    teacherLiveReference?.taskId === task?.id
  const isLiveTab = !isInSandbox && teacherCodeTab === 'live'
  const displayState = isLiveTab
    ? (teacherLiveReferenceDisplayState(teacherLiveReference, mod.type) ??
      mod.getDisplayState(task, activeTeacherStage, liveState, 'starter'))
    : mod.getDisplayState(task, activeTeacherStage, liveState, teacherCodeTab)
  const readOnly = !isInSandbox
  const LiveView = mod.TeacherLiveView
  const showCompleteTab =
    !usesUnifiedStages &&
    (mod.type === 'python' ||
      mod.type === 'html' ||
      (mod.type === 'scratch' && task?.completeBlocks != null) ||
      (mod.type === 'filesystem' && !!task?.completeFs) ||
      (mod.type === 'electronics' && !!task?.completeCircuit))

  const wrapStyle =
    mod.type === 'scratch' || mod.type === 'html'
      ? isInSandbox
        ? styles.scratchWrap
        : styles.codeWorkspaceStack
      : styles.codeWorkspaceStack

  return (
    <div style={wrapStyle}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={(i) => setTeacherCodeTab(`stage_${i}`)}
          onComplete={showCompleteTab ? () => setTeacherCodeTab('complete') : undefined}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
          starterLabel={mod.stageLabels?.starterLabel}
          completeLabel={mod.stageLabels?.completeLabel}
          unifiedStages={usesUnifiedStages}
          showLiveTab={liveReferenceAvailable}
          onLive={() => setTeacherCodeTab('live')}
          liveReferenceVisibleToAll={!!teacherLiveReferenceVisibleToAll}
          onToggleLiveReference={onToggleLiveReference}
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
