import React from 'react'
import InformationTask from '../../components/InformationTask'
import TeacherCodeTabs from '../../components/TeacherCodeTabs'
import { getLessonModule } from '../../../modules/registry'
import { ActivityView } from '../../../activities/ActivityHost.jsx'
import { getTaskActivity, isHostedActivityTask } from '../../../activities/registry.pure.js'
import { getModuleHostedActivityUi } from '../../../activities/registry.js'
import { solutionOrInitialState } from '../../../activities/state.js'
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
  fillHeight = false,
}) {
  const mod = getLessonModule(lesson?.type)
  const usesUnifiedStages = !!mod?.capabilities?.teacherUnifiedStageTabs

  if (!isInSandbox && isInformationTask) return <InformationTask task={task} lesson={lesson} fill />
  // Activities show their answers read-only; quizzes (previewState 'initial') show just the
  // question, since the teacher's screen is often projected.
  if (!isInSandbox && isHostedActivityTask(task)) {
    const activity = getTaskActivity(task)
    return (
      <ActivityView
        task={task}
        state={
          activity.previewState === 'initial'
            ? activity.initialState(task)
            : solutionOrInitialState(activity, task)
        }
        teacher
        readOnly
        lessonType={lesson?.type}
      />
    )
  }
  // Module-hosted activities (Arrange tasks) assemble from drag-and-drop tiles,
  // not starter/stage code — showing the authored solution as a read-only tile
  // board (mirroring how other task types show their Complete state) instead
  // of falling through to the module's code editor, which would just show an
  // empty starter box.
  const moduleActivity = isInSandbox ? null : getModuleHostedActivityUi(task)
  if (moduleActivity?.StudentView) {
    const ModuleActivityView = moduleActivity.StudentView
    return (
      <ModuleActivityView
        task={task}
        state={solutionOrInitialState(moduleActivity, task)}
        readOnly
        lessonType={mod?.type}
      />
    )
  }
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
  // Modules whose complete solution lives in the unified code stages answer false.
  const showCompleteTab = mod.lifecycle.teacherCompleteTab(task)

  // In a scrolling centre column the stack must not shrink below its content:
  // with `minHeight: 0` it collapsed when TaskRatingPanel expanded, and the
  // editor (which keeps its own minHeight) spilled out over the panel, hiding
  // its fields and swallowing their clicks. Only fill-height layouts, whose
  // centre column clips rather than scrolls, need the stack to shrink to fit.
  const codeWorkspaceStack = fillHeight
    ? styles.codeWorkspaceStack
    : { ...styles.codeWorkspaceStack, minHeight: 'auto' }
  const wrapStyle =
    isInSandbox && mod.capabilities?.teacherSandboxRow ? styles.sandboxRow : codeWorkspaceStack

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
  sandboxRow: {
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
