import React from 'react'
import InformationTask from '../../components/InformationTask'
import TeacherCodeTabs from '../../components/TeacherCodeTabs'
import { getLessonModule } from '../../../modules/registry'
import { ActivityView } from '../../../activities/ActivityHost.jsx'
import { getTaskActivity, isHostedActivityTask } from '../../../activities/registry.pure.js'
import { getModuleHostedActivityUi } from '../../../activities/registry.js'
import { solutionOrInitialState } from '../../../activities/state.js'
import { resolveAssetsPath } from '../../../shared/assetPaths'
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
  // Dashboard Go Live: the tutor demos live, so the editor is editable and shows the live copy.
  liveDemo = false,
  // The Badge Summary task's class wall (see InformationTask).
  badgeWall = null,
  // Names the task shown (`firstViewKey(lessonId, taskId)`) for its first-view entrances.
  entranceKey = null,
}) {
  const mod = getLessonModule(lesson?.type)
  const usesUnifiedStages = !!mod?.capabilities?.teacherUnifiedStageTabs

  if (!isInSandbox && isInformationTask) {
    // A size container: the tutor's centre column can be narrow (a tablet with the students
    // panel open), so the recap and image layouts follow its width, not the window's (see
    // `.information-task-host` in index.css; HSC Audit, Visual Review 02).
    return (
      <div className="information-task-host" data-testid="teacher-information-host">
        <InformationTask
          task={task}
          lesson={lesson}
          fill
          badgeWall={badgeWall}
          entranceKey={entranceKey}
        />
      </div>
    )
  }
  // Activities show their answers read-only; quizzes (previewState 'initial') show just the
  // question, since the teacher's screen is often projected.
  if (!isInSandbox && isHostedActivityTask(task)) {
    const activity = getTaskActivity(task)
    const showsAnswers = activity.previewState !== 'initial' && !!activity.solutionState
    const activityView = (
      <ActivityView
        task={task}
        state={showsAnswers ? solutionOrInitialState(activity, task) : activity.initialState(task)}
        teacher
        readOnly
        lessonType={lesson?.type}
        assetsPath={resolveAssetsPath(lesson?.assetsPath)}
        entranceKey={entranceKey}
      />
    )
    if (!showsAnswers) return activityView
    // The finished state ("✓ Correct", "All done") is the answer key, not the class's progress:
    // say so, since the students' cards beside it may all say "Not started" (HSC Audit, Visual
    // Review 14).
    return (
      <>
        <div style={styles.answerKeyNote} data-testid="teacher-answer-key-note">
          <span aria-hidden="true">🔑</span> Answer key: what a finished task looks like. Only you
          see this; each student&apos;s progress is on their card.
        </div>
        {activityView}
      </>
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
  const isLiveTab = !isInSandbox && !liveDemo && teacherCodeTab === 'live'
  const shownTab = liveDemo ? 'starter' : teacherCodeTab
  const displayState = isLiveTab
    ? (teacherLiveReferenceDisplayState(teacherLiveReference, mod.type) ??
      mod.getDisplayState(task, activeTeacherStage, liveState, 'starter'))
    : mod.getDisplayState(task, activeTeacherStage, liveState, shownTab)
  const readOnly = !isInSandbox && !liveDemo
  const LiveView = mod.TeacherLiveView
  // Modules whose complete solution lives in the unified code stages answer false.
  const showCompleteTab = mod.lifecycle.teacherCompleteTab(task)

  // In a scrolling centre column the stack must not shrink below its content:
  // with `minHeight: 0` it collapsed when a sibling panel (originally the inline
  // task-rating panel, now a top-bar popover; still CheckConditionsPanel and the
  // collapsible BadgeSuggestionsPanel) grew, and the editor (which keeps its own
  // minHeight) spilled out over that panel, hiding its fields and swallowing
  // their clicks. Only fill-height layouts, whose centre column clips rather than
  // scrolls, need the stack to shrink to fit.
  const codeWorkspaceStack = fillHeight
    ? styles.codeWorkspaceStack
    : { ...styles.codeWorkspaceStack, minHeight: 'auto' }
  const wrapStyle =
    isInSandbox && mod.capabilities?.teacherSandboxRow ? styles.sandboxRow : codeWorkspaceStack

  return (
    <div style={wrapStyle}>
      {!isInSandbox && !liveDemo && (
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
      {liveDemo && (
        <div style={styles.readOnlyNote} data-testid="teacher-panel-live-note">
          🔴 Live: students see what you type. This doesn&apos;t change the lesson.
        </div>
      )}
      {readOnly && (
        // Explains the editor's pale red read-only border (HSC Audit, Visual Review 05).
        <div style={styles.readOnlyNote} data-testid="teacher-panel-readonly-note">
          <span aria-hidden="true">🔒</span>{' '}
          {isLiveTab
            ? 'Read-only: your live code from the presentation window.'
            : 'Read-only: the code students get at this stage. Edit it in Edit Lesson or the sandbox.'}
        </div>
      )}
      <LiveView
        key={`teacher-${displayTaskId}-${isInSandbox ? 'sandbox' : liveDemo ? 'live-demo' : teacherCodeTab}`}
        task={task}
        lesson={lesson}
        displayState={displayState}
        liveState={liveState}
        readOnly={readOnly}
        onChange={onChange}
        onActivity={onActivity}
        isInSandbox={isInSandbox || liveDemo}
        activeStage={activeTeacherStage}
      />
    </div>
  )
}

const styles = {
  answerKeyNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 6,
    padding: '6px 10px',
    marginBottom: 8,
  },
  readOnlyNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    color: 'var(--colour-muted)',
    padding: '4px 8px',
    flexShrink: 0,
  },
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
