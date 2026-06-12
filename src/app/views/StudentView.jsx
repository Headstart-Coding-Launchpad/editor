import React, { useCallback, useEffect, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { useLessonLoader } from '../hooks/useLessonLoader'
import { useStudentPhase } from '../hooks/useStudentPhase'
import { useStudentCodeState } from '../hooks/useStudentCodeState'
import { flattenTasks, findTaskById, filterTasksByMode } from '../../shared/taskUtils'
import { deriveStudentLiveDisplay } from '../studentLiveDisplay'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import LiveActivityToast from '../components/LiveActivityToast'
import LoadingScreen from '../components/LoadingScreen'
import SessionEndedScreen from '../components/SessionEndedScreen'
import StudentStatusBanners from '../components/StudentStatusBanners'
import LessonTaskContent from '../components/LessonTaskContent'
import SoloNav from '../components/SoloNav'

export default function StudentView({ lessonId: lessonIdProp, soloMode = false, lesson: lessonProp = null, teacherPresentation = false, allowUnrestrictedTaskNavigation = false, previewMode = false, initialTaskId = null, onTaskChange = null }) {
  const lessonId = lessonIdProp ?? lessonProp?.id ?? 'preview'

  // ─── Core hooks ───────────────────────────────────────────────────────────

  const useRealtimeSession = !soloMode || teacherPresentation
  const {
    session, loading: sessionLoading, connected, registerPresence, joinSession, registerJoining, unregisterJoining,
    writeStudentRun, writeStudentAnswer, writeStudentCode, writeStudentFiles, writeStudentOutput, writeStudentInteraction, writeStudentPersonalSandbox,
    setTaskId, setTeacherLive, updateTeacherLive, removeStudent, requestHelp,
  } = useSession(useRealtimeSession ? lessonId : null, { enabled: useRealtimeSession })
  const { identity, loaded: identityLoaded, createIdentity, updateTimestamp, updateDisplayName } = useIdentity()
  const effectiveIdentity = teacherPresentation ? { anonymousId: 'teacher-presenter', displayName: 'Teacher' } : identity

  const { lesson, lessonLoading, firstTaskId } = useLessonLoader(lessonId, lessonProp, initialTaskId)

  // ─── Stable callback refs wired to code-state after it initialises ─────────

  const saveWorkRef = useRef(null)
  const exitSandboxRef = useRef(null)
  const resetForTaskRef = useRef(null)
  const onBeforeTaskChange = useCallback(() => saveWorkRef.current?.(), [])
  const onPersonalSandboxExit = useCallback(() => exitSandboxRef.current?.(), [])
  const onTaskReset = useCallback(() => resetForTaskRef.current?.(), [])

  // ─── Phase state machine ───────────────────────────────────────────────────

  const {
    phase, setPhase,
    currentTaskId, setCurrentTaskId,
    viewingTaskId, setViewingTaskId,
    handleNameSubmit, handleWaitForTeacher, handleGoSolo,
  } = useStudentPhase({
    session, sessionLoading,
    identity, identityLoaded,
    lessonId, lessonLoading,
    soloMode, teacherPresentation,
    firstTaskId,
    onBeforeTaskChange,
    onPersonalSandboxExit,
    onTaskReset,
    createIdentity, updateTimestamp, joinSession, registerJoining, unregisterJoining,
  })

  // ─── Code / editor state ───────────────────────────────────────────────────

  const cs = useStudentCodeState({
    lessonId, lesson, currentTaskId, viewingTaskId, phase,
    effectiveIdentity, identity, session, connected,
    teacherPresentation, previewMode,
    writeStudentRun, writeStudentAnswer, writeStudentCode, writeStudentFiles, writeStudentOutput,
    writeStudentInteraction, writeStudentPersonalSandbox,
    registerPresence, removeStudent,
    updateTeacherLive, setTeacherLive,
  })

  // Wire phase callbacks to latest code-state functions each render
  saveWorkRef.current = cs.saveCurrentWork
  exitSandboxRef.current = cs.exitPersonalSandbox
  resetForTaskRef.current = cs.resetForTaskChange

  useEffect(() => {
    onTaskChange?.(viewingTaskId ?? currentTaskId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingTaskId, currentTaskId])

  const isMobile = useIsMobile()

  // ─── Cross-hook coordination ───────────────────────────────────────────────

  // Sync identity rename from Firebase to local state
  useEffect(() => {
    if (!identity?.anonymousId || !session?.students) return
    const firebaseName = session.students[identity.anonymousId]?.displayName
    if (firebaseName && firebaseName !== identity.displayName) {
      updateDisplayName(firebaseName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.students?.[identity?.anonymousId]?.displayName])

  // ─── Navigation handlers ───────────────────────────────────────────────────

  function handleSoloNavigate(taskId) {
    if (teacherPresentation) {
      if (!flatTasks.some(t => t.id === taskId)) return
      setTaskId(taskId)
      setCurrentTaskId(taskId)
      setViewingTaskId(null)
      cs.resetForTaskChange()
      updateTeacherLive({ taskId, output: '', runStatus: null, checkPassed: false, checkAttempted: false })
      return
    }
    if (!identity) return
    const currentTask = findTaskById(lesson?.tasks, currentTaskId)
    if (phase === 'solo' && !allowUnrestrictedTaskNavigation) {
      const targetIdx = flatTasks.findIndex(t => t.id === taskId)
      const currIdx = flatTasks.findIndex(t => t.id === currentTaskId)
      if (targetIdx > currIdx) {
        const hasCompletion = !!currentTask?.check || currentTask?.tests?.length > 0
        const canAdvance = !hasCompletion || currentTask?.taskType === 'information' || cs.checkPassed
        if (!canAdvance || targetIdx > currIdx + 1) return
      }
    }
    cs.saveCurrentWork()
    setViewingTaskId(null)
    cs.resetForTaskChange()
    setCurrentTaskId(taskId)
  }

  async function handleToggleTeacherLive() {
    if (!teacherPresentation) return
    if (session?.teacherLive?.active) {
      await setTeacherLive(null)
      return
    }
    await setTeacherLive(cs.currentTeacherLivePayload())
  }

  // ─── Phase guards ──────────────────────────────────────────────────────────

  if (phase === 'loading' || (!soloMode && sessionLoading) || lessonLoading || (!teacherPresentation && !identityLoaded)) {
    return <LoadingScreen message="Loading…" />
  }

  if (!lesson) {
    return <LoadingScreen message={`Lesson "${lessonId}" not found.`} />
  }

  if (phase === 'name-entry') {
    return (
      <NameEntry
        lessonTitle={lesson.title}
        existingNames={session ? Object.values(session.students ?? {}).map(s => s.displayName) : []}
        onSubmit={handleNameSubmit}
        onGoSolo={handleGoSolo}
        waitingForSession={session?.state === 'waiting'}
      />
    )
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        lessonTitle={lesson.title}
        lessonDescription={lesson.description}
      />
    )
  }

  if (phase === 'ended') {
    return <SessionEndedScreen onContinueSolo={() => setPhase('solo')} />
  }

  // ─── Lesson / sandbox / solo render ───────────────────────────────────────

  const taskDisplayMode = previewMode ? null : (phase === 'solo' ? 'solo' : phase === 'lesson' ? 'live' : null)
  const visibleTasks = filterTasksByMode(lesson.tasks, taskDisplayMode)
  const flatTasks = flattenTasks(visibleTasks)
  const currentIndex = flatTasks.findIndex(t => t.id === currentTaskId)
  const {
    isPresentationStudentViewer,
    isStudentGoLiveViewer,
    isTeacherLiveActive,
    isForcedTeacherLive,
    displayedTaskId,
    displayCode,
    displayFiles,
    displayActiveFile,
    displayOutput,
    displayRunStatus,
    displayCheckPassed,
    displayCheckAttempted,
    displayCheckSuggestion,
    displaySelection,
    displayActivity,
  } = deriveStudentLiveDisplay({
    teacherPresentation,
    phase,
    teacherLive: session?.teacherLive,
    identityId: identity?.anonymousId,
    currentTaskId,
    viewingTaskId,
    code: cs.code,
    files: cs.files,
    activeFile: cs.activeFile,
    output: cs.output,
    runStatus: cs.runStatus,
    checkPassed: cs.checkPassed,
    checkAttempted: cs.checkAttempted,
    checkSuggestion: cs.checkSuggestion,
    editorActivity: cs.editorActivity,
  })
  const task = flatTasks.find(t => t.id === displayedTaskId)
  const displayFs = isForcedTeacherLive && lesson.type === 'filesystem'
    ? (() => { try { return JSON.parse(session?.teacherLive?.code ?? '') } catch { return cs.fsState } })()
    : cs.fsState
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'
  const isQuizTask = task?.taskType === 'quiz'
  const isAutoEvaluatedQuiz = isQuizTask && (task?.quizType === 'match' || task?.quizType === 'fill_blank')
  const isInformationTask = task?.taskType === 'information'
  const currentTask = flatTasks.find(t => t.id === currentTaskId)
  const currentTaskIsAutoEvaluated = currentTask?.taskType === 'quiz' && (currentTask?.quizType === 'match' || currentTask?.quizType === 'fill_blank')
  const currentTaskHasCompletion = !!currentTask?.check || currentTask?.tests?.length > 0 || currentTaskIsAutoEvaluated
  const canAdvanceSolo = !currentTaskHasCompletion || currentTask?.taskType === 'information' || cs.checkPassed
  const canNavigateNextSolo = allowUnrestrictedTaskNavigation || canAdvanceSolo
  const hasCompleteSolution = lesson.type === 'python'
    ? !!task?.completeCode
    : lesson.type === 'scratch'
    ? !!task?.completeBlocks
    : lesson.type === 'filesystem'
    ? !!task?.completeFs
    : (task?.completeFiles?.length > 0)
  const canOfferCompleteSolution = isSolo && hasCompleteSolution && !displayCheckPassed && cs.repeatedSuggestionCount >= 2
  const hasPersonalSandbox = lesson.type === 'python'
    ? !!(lesson.sandboxStarterCode != null)
    : lesson.type === 'html'
    ? !!(lesson.sandboxStarterFiles?.length > 0)
    : lesson.type === 'scratch'
    ? !!(lesson.sandboxStarterCode != null)
    : lesson.type === 'filesystem'
    ? !!(lesson.sandboxStarterFs != null)
    : false
  const canOfferPersonalSandbox = (phase === 'lesson' || isSolo) && hasPersonalSandbox && displayCheckPassed && !cs.inPersonalSandbox && !isForcedTeacherLive

  const isPaused = !isForcedTeacherLive && (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  const topBarRight = teacherPresentation ? (
    <div style={s.presentationControls}>
      <button
        className="btn-ghost"
        style={s.presentationBtn}
        disabled={currentIndex <= 0}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
      >
        Previous
      </button>
      <span style={s.presentationTaskLabel}>Task {currentIndex + 1} / {flatTasks.length}</span>
      <button
        className="btn-ghost"
        style={s.presentationBtn}
        disabled={currentIndex >= flatTasks.length - 1}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
      >
        Next
      </button>
      <button
        className={isTeacherLiveActive ? 'btn-danger' : 'btn-primary'}
        style={s.presentationBtn}
        onClick={handleToggleTeacherLive}
      >
        {isTeacherLiveActive ? 'Stop Live to Students' : 'Go Live to Students'}
      </button>
    </div>
  ) : (
    !isSandbox && (
      <TaskProgressDots
        tasks={visibleTasks}
        currentTaskId={currentTaskId}
        viewingTaskId={viewingTaskId}
        isSolo={isSolo}
        canSelectTask={id => {
          if (!isSolo) return true
          const idIdx = flatTasks.findIndex(t => t.id === id)
          return allowUnrestrictedTaskNavigation || idIdx <= currentIndex || (idIdx === currentIndex + 1 && canAdvanceSolo)
        }}
        onDotClick={id => {
          if (isSolo) {
            if (id !== currentTaskId) handleSoloNavigate(id)
          } else if (id < currentTaskId) {
            setViewingTaskId(id === currentTaskId ? null : id)
          }
        }}
      />
    )
  )

  const transitionKey = `${phase}-${cs.inPersonalSandbox ? 'personal-sandbox' : (viewingTaskId ?? currentTaskId)}`

  return (
    <div style={{ ...s.page, background: isForcedTeacherLive ? '#dde0e5' : '#f5f5f5' }}>
      {isPaused && (
        <div style={s.pauseOverlay}>
          <span style={s.pauseIcon}>⏸</span>
          <h2 style={s.pauseTitle}>Coding Paused</h2>
          <p style={s.pauseSubtitle}>Your teacher will resume the session shortly</p>
        </div>
      )}
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        displayName={isPresentationStudentViewer ? `Other Student — ${session.teacherLive.sourceStudentName ?? 'Student'}` : teacherPresentation ? 'Presentation' : identity?.displayName}
        isSandbox={isSandbox}
        isSolo={teacherPresentation ? undefined : isSolo}
        right={topBarRight}
      />
      <LiveActivityToast activity={displayActivity} showClicks={isForcedTeacherLive} />
      <StudentStatusBanners
        isForcedTeacherLive={isForcedTeacherLive}
        isPresentationStudentViewer={isPresentationStudentViewer}
        isStudentGoLiveViewer={isStudentGoLiveViewer}
        teacherLiveSourceStudentName={session?.teacherLive?.sourceStudentName}
        isViewingPrev={isViewingPrev}
        onReturnToCurrentTask={() => setViewingTaskId(null)}
        inPersonalSandbox={cs.inPersonalSandbox}
        onLeavePersonalSandbox={cs.handleLeavePersonalSandbox}
      />
      <div style={isSolo && !isSandbox && (isQuizTask || isInformationTask) ? { ...s.body, overflow: 'hidden' } : s.body}>
        <LessonTaskContent
          lesson={lesson}
          task={task}
          cs={cs}
          lessonId={lessonId}
          identityId={identity?.anonymousId}
          sandboxExplainer={session?.sandboxExplainer}
          activeStudentView={session?.activeStudentView}
          viewingTaskId={viewingTaskId}
          currentTaskId={currentTaskId}
          transitionKey={transitionKey}
          previewMode={previewMode}
          isSandbox={isSandbox}
          isViewingPrev={isViewingPrev}
          isForcedTeacherLive={isForcedTeacherLive}
          isMobile={isMobile}
          isQuizTask={isQuizTask}
          isAutoEvaluatedQuiz={isAutoEvaluatedQuiz}
          isInformationTask={isInformationTask}
          displayCode={displayCode}
          displayFiles={displayFiles}
          displayActiveFile={displayActiveFile}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displayCheckSuggestion={displayCheckSuggestion}
          displaySelection={displaySelection}
          displayFs={displayFs}
          canOfferCompleteSolution={canOfferCompleteSolution}
          canOfferPersonalSandbox={canOfferPersonalSandbox}
          onNeedHelp={phase === 'lesson' && identity?.anonymousId ? () => requestHelp(identity.anonymousId) : undefined}
        />
      </div>
      {isSolo && (
        <SoloNav
          flatTasks={flatTasks}
          currentIndex={currentIndex}
          cs={cs}
          hasPersonalSandbox={hasPersonalSandbox}
          isQuizTask={isQuizTask}
          isInformationTask={isInformationTask}
          canNavigateNextSolo={canNavigateNextSolo}
          onNavigate={handleSoloNavigate}
        />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#f5f5f5',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
    minHeight: 0,
  },
  presentationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  presentationBtn: {
    fontSize: 13,
    padding: '5px 12px',
  },
  presentationTaskLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    minWidth: 72,
    textAlign: 'center',
  },
  pauseOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--colour-primary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 999,
  },
  pauseIcon: {
    fontSize: '3rem',
    lineHeight: 1,
    color: '#fff',
    opacity: 0.8,
  },
  pauseTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '2rem',
    color: '#fff',
    margin: 0,
  },
  pauseSubtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
    margin: 0,
  },
}
