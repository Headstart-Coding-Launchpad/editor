import React from 'react'
import InformationTask from '../../components/InformationTask'
import TeacherCodeTabs, { SendStageToAllButton } from '../../components/TeacherCodeTabs'
import TeacherQuizAnswer from './TeacherQuizAnswer'
import StageTargetPreview from './StageTargetPreview'
import {
  expectedOutputOf,
  extraStageTabs,
  stagePictureCode,
  teacherAnswerKind,
} from './teacherAnswer'
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
  // The Answer panel (calm teacher view): whether a quiz or activity shows its answer (else the
  // question only, as students see it), and the editor tab that holds a code task's model
  // answer (teacherAnswer.js answerTabFor; null without one).
  answerShown = true,
  answerTab = null,
  // The session's students and the task the class is on: a quiz's per-option counts and
  // responses only show for that task.
  students = [],
  classTaskId = null,
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
  // Multiple-choice and short-answer quizzes: the real options with the right one ticked and the
  // class's votes, or the model answer and the class's answers (TeacherQuizAnswer). The tutor
  // teaches from the presentation window, so this screen shows the answer first; "Question
  // only" shows the task as students see it.
  const answerKind = teacherAnswerKind(task)
  if (!isInSandbox && answerShown && (answerKind === 'choice' || answerKind === 'short')) {
    return (
      <div style={styles.answerBody}>
        <AnswerNote>
          {answerKind === 'choice'
            ? 'the correct option is ticked; the counts are how the class voted.'
            : 'what the answer check accepts, and the class’s answers.'}
        </AnswerNote>
        <TeacherQuizAnswer
          task={task}
          students={students}
          classIsHere={classTaskId != null && String(classTaskId) === String(task?.id)}
        />
      </div>
    )
  }
  // Other activities show their finished state read-only as the answer key (or the starting
  // state with "Question only").
  if (!isInSandbox && isHostedActivityTask(task)) {
    const activity = getTaskActivity(task)
    const showsAnswers = answerShown && !!activity.solutionState
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
  // The sandbox and a live demo always show the tutor's own work (liveState): there is no tab
  // row there, and an answer tab would show the model answer (or nothing) instead.
  const shownTab = liveDemo || isInSandbox ? 'starter' : teacherCodeTab
  const displayState = isLiveTab
    ? (teacherLiveReferenceDisplayState(teacherLiveReference, mod.type) ??
      mod.getDisplayState(task, activeTeacherStage, liveState, 'starter'))
    : mod.getDisplayState(task, activeTeacherStage, liveState, shownTab)
  const readOnly = !isInSandbox && !liveDemo
  const LiveView = mod.TeacherLiveView
  // Modules whose complete solution lives in the unified code stages answer false.
  const showCompleteTab = mod.lifecycle.teacherCompleteTab(task)
  // The Answer / Starter toggle (TeacherAnswerCard in TeacherView) covers the starter and the
  // model answer; the tab row only shows when there is more (support stages, the Live tab).
  const showingAnswer =
    !isInSandbox && !liveDemo && answerTab != null && teacherCodeTab === answerTab
  const showTabRow =
    !isInSandbox &&
    !liveDemo &&
    (liveReferenceAvailable || extraStageTabs(task, answerTab).length > 0 || answerTab == null)
  const expectedOutput = showingAnswer ? expectedOutputOf(task) : null
  const pictureCode =
    showingAnswer && mod.runResult?.stage === true
      ? stagePictureCode(task, typeof displayState === 'string' ? displayState : '')
      : null
  const sendButton =
    !showTabRow && hasStudents && onSendStageToAll && !isInSandbox && !liveDemo ? (
      <SendStageToAllButton
        activeTab={teacherCodeTab}
        stages={taskCodeStages}
        starterLabel={mod.stageLabels?.starterLabel}
        completeLabel={mod.stageLabels?.completeLabel}
        onSendToAll={onSendStageToAll}
        style={styles.noteAction}
      />
    ) : null

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
      {showTabRow && (
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
      {readOnly &&
        (showingAnswer ? (
          <AnswerNote action={sendButton}>
            {mod.capabilities?.run === 'preview'
              ? 'the model page and the code behind it.'
              : pictureCode
                ? 'the model solution, the picture it draws and what it prints.'
                : 'the model solution.'}
          </AnswerNote>
        ) : (
          // Explains the editor's pale red read-only border (HSC Audit, Visual Review 05).
          <div style={styles.readOnlyNote} data-testid="teacher-panel-readonly-note">
            <span aria-hidden="true">🔒</span>{' '}
            {isLiveTab
              ? 'Read-only: your live code from the presentation window.'
              : 'Read-only: the code students get at this stage. Edit it in Edit Lesson or the sandbox.'}
            {sendButton}
          </div>
        ))}
      {pictureCode ? (
        <div style={styles.answerRow}>
          <div style={styles.answerCode}>{liveView()}</div>
          <div style={styles.answerAside}>
            <StageTargetPreview code={pictureCode} />
            {expectedOutput != null && <ExpectedOutput value={expectedOutput} stacked />}
          </div>
        </div>
      ) : (
        <>
          {liveView()}
          {expectedOutput != null && <ExpectedOutput value={expectedOutput} />}
        </>
      )}
    </div>
  )

  function liveView() {
    return (
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
    )
  }
}

// The green "✓ ANSWER" line over the model answer: students never see this panel.
function AnswerNote({ children, action = null }) {
  return (
    <div style={styles.answerNote} data-testid="teacher-answer-note">
      <strong>✓ ANSWER</strong> · {children} Students never see this panel.
      {action}
    </div>
  )
}

function ExpectedOutput({ value, stacked = false }) {
  return (
    <div
      style={stacked ? styles.expectedStacked : styles.expectedRow}
      data-testid="teacher-expected-output"
    >
      <span style={styles.expectedLabel}>Expected output</span>
      <pre style={styles.expectedValue}>{value}</pre>
    </div>
  )
}

const styles = {
  answerBody: { display: 'flex', flexDirection: 'column', minHeight: 'auto' },
  answerNote: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#166534',
    background: '#ecfdf5',
    borderBottom: '1px solid #bbf7d0',
    padding: '6px 12px',
    flexShrink: 0,
  },
  noteAction: { marginLeft: 'auto' },
  answerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(200px, 260px)',
    gap: 12,
    alignItems: 'start',
  },
  answerCode: { minWidth: 0, display: 'flex', flexDirection: 'column' },
  answerAside: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  expectedRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '8px 12px',
    flexShrink: 0,
  },
  expectedStacked: { display: 'flex', flexDirection: 'column', gap: 4 },
  expectedLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  expectedValue: {
    margin: 0,
    padding: '3px 8px',
    borderRadius: 6,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.8rem',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
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
