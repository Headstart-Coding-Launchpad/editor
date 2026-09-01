import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { useLessonLoader } from '../hooks/useLessonLoader'
import { applyLessonOverride } from '../../shared/lessonService'
import { useStudentPhase } from '../hooks/useStudentPhase'
import { useStudentCodeState } from '../hooks/useStudentCodeState'
import { useCrossTabPresence } from '../hooks/useCrossTabPresence'
import { flattenTasks, filterTasksByMode, getCompleteStage, getRevealableStages } from '../../shared/taskUtils'
import { deriveStudentLiveDisplay } from '../studentLiveDisplay'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import LiveActivityToast from '../components/LiveActivityToast'
import TeacherMessageToast from '../components/TeacherMessageToast'
import LoadingScreen from '../components/LoadingScreen'
import SessionEndedScreen from '../components/SessionEndedScreen'
import StudentStatusBanners from '../components/StudentStatusBanners'
import LessonTaskContent from '../components/LessonTaskContent'
import SoloNav from '../components/SoloNav'
import { createLaunchpadCodeFile, downloadLaunchpadCodeFile } from '../../shared/launchpadCodeFile'
import { getSavedNonPythonTaskCount, getSavedPythonTasks, isPythonCodeTask } from '../studentCodeExports'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { decodeFileKey } from '../../shared/fileKeys'
import { decodeSessionFiles } from '../../shared/workspaceData'

export default function StudentView({ lessonId: lessonIdProp, soloMode = false, lesson: lessonProp = null, teacherPresentation = false, allowUnrestrictedTaskNavigation = false, previewMode = false, initialTaskId = null, onTaskChange = null }) {
  const lessonId = lessonIdProp ?? lessonProp?.id ?? 'preview'

  // ─── Core hooks ───────────────────────────────────────────────────────────

  const useRealtimeSession = !soloMode || teacherPresentation
  const {
    session, loading: sessionLoading, connected, registerPresence, joinSession, registerJoining, unregisterJoining,
    writeStudentRun, logAttempt, writeStudentAnswer, writeStudentCode, writeStudentArcadeDesign, writeStudentSpriteState, writeStudentCursor, writeStudentBlockDrag, writeStudentCodeArrangeSlots, writeStudentFiles, writeStudentOutput, writeStudentInteraction, recordStudentCarryFallback, recordSupportStageReveal, writeStudentPersonalSandbox, writeStudentPresence,
    setTaskId, setTeacherLive, updateTeacherLive, removeStudent, requestHelp, setStudentTopic,
    acceptTeacherEdit, declineTeacherEdit, acceptTeacherStage, declineTeacherStage,
    removeTeacherHighlight,
  } = useSession(useRealtimeSession ? lessonId : null, { enabled: useRealtimeSession })
  const { identity, loaded: identityLoaded, authError, retrySignIn, createIdentity, updateTimestamp, updateDisplayName } = useIdentity()
  const effectiveIdentity = teacherPresentation ? { anonymousId: 'teacher-presenter', displayName: 'Teacher' } : identity

  const { lesson: baseLesson, lessonLoading, firstTaskId: baseFirstTaskId } = useLessonLoader(lessonId, lessonProp, initialTaskId)
  const lesson = useMemo(
    () => applyLessonOverride(baseLesson, session?.lessonOverrideTasks),
    [baseLesson, session?.lessonOverrideTasks]
  )
  // Derive firstTaskId from the post-override lesson so solo-mode students start on a valid task.
  // If an explicit initialTaskId was provided (e.g. builder preview), honour it over the lesson's first task.
  const firstTaskId = useMemo(
    () => initialTaskId ?? (lesson ? (flattenTasks(lesson.tasks)[0]?.id ?? baseFirstTaskId) : baseFirstTaskId),
    [lesson, baseFirstTaskId, initialTaskId]
  )

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
    joinError,
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
  const activeLesson = useMemo(
    () => getEffectiveLessonForTask(lesson, currentTaskId),
    [lesson, currentTaskId],
  )

  // ─── Code / editor state ───────────────────────────────────────────────────

  const cs = useStudentCodeState({
    lessonId, lesson: activeLesson, currentTaskId, viewingTaskId, phase,
    effectiveIdentity, identity, session, connected,
    teacherPresentation, previewMode,
    writeStudentRun, logAttempt, writeStudentAnswer, writeStudentCode, writeStudentArcadeDesign, writeStudentSpriteState, writeStudentCursor, writeStudentBlockDrag, writeStudentCodeArrangeSlots, writeStudentFiles, writeStudentOutput,
    writeStudentInteraction, recordStudentCarryFallback, recordSupportStageReveal, writeStudentPersonalSandbox, writeStudentPresence,
    registerPresence, removeStudent,
    updateTeacherLive, setTeacherLive,
    removeTeacherHighlight,
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
  const currentPythonTask = useMemo(() => {
    if (activeLesson?.type !== 'python') return null
    const task = flattenTasks(lesson.tasks).find(item => item.id === currentTaskId)
    return isPythonCodeTask(task) ? task : null
  }, [lesson, activeLesson?.type, currentTaskId])
  // Only shown on the session-ended screen — gating on phase avoids rescanning localStorage
  // on every keystroke while the student is still working.
  const savedPythonTasks = useMemo(() => {
    if (phase !== 'ended') return []
    return getSavedPythonTasks({ lesson, anonymousId: teacherPresentation ? null : identity?.anonymousId })
  }, [phase, lesson, identity?.anonymousId, teacherPresentation])
  const savedOtherTaskCount = useMemo(() => {
    if (phase !== 'ended') return 0
    return getSavedNonPythonTaskCount({ lesson, anonymousId: teacherPresentation ? null : identity?.anonymousId })
  }, [phase, lesson, identity?.anonymousId, teacherPresentation])
  const [otherTabDismissed, setOtherTabDismissed] = useState(false)
  const [fullscreenDismissedAt, setFullscreenDismissedAt] = useState(null)
  const otherTabOpen = useCrossTabPresence(lessonId, teacherPresentation ? null : identity?.anonymousId) && !otherTabDismissed
  const fullscreenRequestedAt = session?.fullscreenRequestedAt ?? null
  const fullscreenPromptVisible = !teacherPresentation && !!fullscreenRequestedAt && fullscreenRequestedAt !== fullscreenDismissedAt

  function handleGoFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {})
    setFullscreenDismissedAt(fullscreenRequestedAt)
  }

  // Fullscreen only makes sense while the lesson is live — drop out automatically
  // once the session ends rather than leaving the student stuck in fullscreen.
  useEffect(() => {
    if (phase !== 'ended') return
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [phase])

  function downloadTasks(tasks, filename) {
    if (tasks.length === 0) return
    downloadLaunchpadCodeFile(createLaunchpadCodeFile(tasks), filename)
  }

  function handleDownloadCurrentCode() {
    if (!currentPythonTask) return
    cs.saveCurrentWork()
    downloadTasks([{ id: currentPythonTask.id, title: currentPythonTask.title, code: cs.code }], currentPythonTask.title)
  }

  function handleDownloadAllCode() {
    cs.saveCurrentWork()
    const latestTasks = getSavedPythonTasks({ lesson, anonymousId: identity?.anonymousId })
    downloadTasks(latestTasks, `${lesson?.title || 'my'}-python-code`)
  }

  function handleDownloadLessonSandboxCode() {
    downloadTasks([{ id: 'sandbox', title: 'Python sandbox', code: cs.code }], 'python-sandbox')
  }

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

  // ─── Topic library tracking ────────────────────────────────────────────────

  const [openTopicId, setOpenTopicId] = useState(null)
  const [pendingTopicId, setPendingTopicId] = useState(null)
  // Presenter-only layout toggle: which panes the presentation popup shows ('both' | 'explainer' | 'code')
  const [presenterLayout, setPresenterLayout] = useState('both')
  const sentToTopicPushedAt = session?.students?.[identity?.anonymousId]?.sentToTopicPushedAt

  useEffect(() => {
    if (!sentToTopicPushedAt) return
    const sentId = session?.students?.[identity?.anonymousId]?.sentToTopicId
    if (sentId) setPendingTopicId(sentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentToTopicPushedAt])

  function handleTopicOpen(topicId) {
    if (identity?.anonymousId && phase === 'lesson') setStudentTopic?.(identity.anonymousId, topicId || null)
  }

  function handleTopicClose() {
    setOpenTopicId(null)
    if (identity?.anonymousId && phase === 'lesson') setStudentTopic?.(identity.anonymousId, null)
  }

  // Lets the teacher's student list show what a student can currently see (e.g. Scratch's
  // Instructions/Code and Blocks/Stage tabs) — see LessonTaskContent's visiblePanes comment.
  // Gated like writeStudentPresence's windowFocused/lastActivityAt writes in
  // useStudentCodeState.js: real students in a live/sandbox session only, never the
  // teacher's own presentation screen.
  const lastVisiblePanesRef = useRef(null)
  const handleVisiblePanesChange = useCallback((panes) => {
    if (teacherPresentation || !identity?.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    const key = panes?.join(',') ?? ''
    if (lastVisiblePanesRef.current === key) return
    lastVisiblePanesRef.current = key
    writeStudentPresence?.(identity.anonymousId, { visiblePanes: panes })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, identity?.anonymousId, phase])

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
    if (phase === 'solo' && !allowUnrestrictedTaskNavigation) {
      const targetIdx = flatTasks.findIndex(t => t.id === taskId)
      const currIdx = flatTasks.findIndex(t => t.id === currentTaskId)
      if (targetIdx > currIdx) {
        if (targetIdx > currIdx + 1) return
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
        joinError={joinError}
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
    return (
      <SessionEndedScreen
        savedCodeTaskCount={savedPythonTasks.length}
        savedOtherTaskCount={savedOtherTaskCount}
        onDownloadAllCode={handleDownloadAllCode}
        onContinueSolo={() => setPhase('solo')}
      />
    )
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
    displayArcadeDesign,
    displaySpriteState,
    displayCursor,
    displayBlockDrag,
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
  const displayedLesson = getEffectiveLessonForTask(lesson, displayedTaskId)
  const displayFs = isForcedTeacherLive && displayedLesson.type === 'filesystem'
    ? (() => { try { return JSON.parse(session?.teacherLive?.code ?? '') } catch { return cs.fsState } })()
    : cs.fsState
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'
  const isQuizTask = task?.taskType === 'quiz'
  const isAutoEvaluatedQuiz = isQuizTask && (task?.quizType === 'match' || task?.quizType === 'fill_blank')
  const isInformationTask = task?.taskType === 'information'
  const isCodeArrangeTask = task?.taskType === 'code_arrange'
  const canNavigateNextSolo = allowUnrestrictedTaskNavigation || isSolo
  const unifiedCompleteStage = getCompleteStage(task)?.stage
  const hasCompleteSolution = displayedLesson.type === 'python' || displayedLesson.type === 'arcade'
    ? !!(unifiedCompleteStage?.code ?? task?.completeCode)
    : displayedLesson.type === 'scratch'
    ? !!task?.completeBlocks
    : displayedLesson.type === 'filesystem'
    ? !!task?.completeFs
    : displayedLesson.type === 'electronics'
    ? !!task?.completeCircuit
    : (unifiedCompleteStage?.files?.length > 0 || task?.completeFiles?.length > 0)
  const taskCodeStages = task?.codeStages ?? []
  const hasUnifiedCodeStages = ['python', 'html'].includes(displayedLesson.type) && taskCodeStages.some(stage => ['starter', 'complete'].includes(stage?.role))
  const revealableStages = getRevealableStages(task)
  const hasProgressiveReferences = ['python', 'html'].includes(displayedLesson.type) && revealableStages.length > 0
  const nextStageIndex = cs.offeredStageIndex + 1
  const canOfferNextStage = isSolo && !['python', 'html'].includes(displayedLesson.type) && !hasProgressiveReferences && !displayCheckPassed && cs.checkFailCount >= 2 && nextStageIndex < taskCodeStages.length
  const revealedSupportStageIndexes = Object.keys(cs.supportStageReveals ?? {}).map(Number)
  const allReferencesRevealed = revealableStages.every(({ index }) => revealedSupportStageIndexes.includes(index))
  const stagesExhausted = isSolo && hasCompleteSolution && !displayCheckPassed && cs.checkFailCount >= 2 && (
    hasUnifiedCodeStages || hasProgressiveReferences ? allReferencesRevealed : nextStageIndex >= taskCodeStages.length
  )
  // Python previews the complete solution read-only in the reference area before offering
  // to load it into the editor. Other lesson types have no such preview yet, so they
  // keep the original single-step "load complete solution" offer.
  const canOfferCompletePreview = ['python', 'html'].includes(displayedLesson.type) && stagesExhausted && !cs.completePreviewShown
  const canOfferCompleteSolution = ['python', 'html'].includes(displayedLesson.type) ? (stagesExhausted && cs.completePreviewShown) : stagesExhausted
  const explainerShowsComplete = false
  const hasPersonalSandbox = activeLesson.type === 'python' || activeLesson.type === 'arcade'
    ? true
    : activeLesson.type === 'html'
    ? !!(activeLesson.sandboxStarterFiles?.length > 0)
    : activeLesson.type === 'scratch'
    ? !!(activeLesson.sandboxStarter != null)
    : activeLesson.type === 'filesystem'
    ? !!(activeLesson.sandboxStarterFs != null)
    : activeLesson.type === 'electronics'
    ? !!(activeLesson.sandboxStarterCircuit != null)
    : false
  const canOfferPersonalSandbox = (phase === 'lesson' || isSolo) && hasPersonalSandbox && !isQuizTask && displayCheckPassed && !cs.inPersonalSandbox && !isForcedTeacherLive

  const isPaused = !isForcedTeacherLive && (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  const myStudentTeacherEdit = session?.students?.[identity?.anonymousId]
  const canTeacherEditType = activeLesson?.type === 'python' || activeLesson?.type === 'html' || activeLesson?.type === 'arcade' || activeLesson?.type === 'scratch' || activeLesson?.type === 'electronics'
  const isTeacherEditing = !teacherPresentation && !!myStudentTeacherEdit?.teacherEditAcceptedAt && canTeacherEditType && (phase === 'lesson' || phase === 'solo')
  const showTeacherEditConsent = !teacherPresentation && !!myStudentTeacherEdit?.teacherEditRequestedAt && !myStudentTeacherEdit?.teacherEditAcceptedAt && canTeacherEditType
  const showStageChangeConsent = !teacherPresentation && !!myStudentTeacherEdit?.teacherStageRequestedAt && !myStudentTeacherEdit?.teacherStageAcceptedAt
  const teacherLiveCode = myStudentTeacherEdit?.teacherLiveCode ?? ''
  const teacherLiveFiles = decodeSessionFiles(myStudentTeacherEdit?.teacherLiveFiles, decodeFileKey, 'html')
  const teacherLiveActiveFile = myStudentTeacherEdit?.teacherLiveActiveFile ?? null
  const teacherLiveWorkspace = myStudentTeacherEdit?.teacherLiveWorkspace ?? null
  const teacherLiveArcadeDesign = myStudentTeacherEdit?.teacherLiveArcadeDesign ?? null

  const taskProgressControl = !isSandbox ? (
    <TaskProgressDots
      tasks={visibleTasks}
      currentTaskId={currentTaskId}
      viewingTaskId={viewingTaskId}
      isSolo={isSolo}
      canSelectTask={id => {
        if (!isSolo) return true
        const idIdx = flatTasks.findIndex(t => t.id === id)
        return allowUnrestrictedTaskNavigation || idIdx <= currentIndex || idIdx === currentIndex + 1
      }}
      onDotClick={id => {
        if (isSolo) {
          if (id !== currentTaskId) handleSoloNavigate(id)
        } else if (id < currentTaskId) {
          setViewingTaskId(id === currentTaskId ? null : id)
        }
      }}
    />
  ) : null

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
      <div style={s.presenterLayoutGroup} role="group" aria-label="Presentation layout">
        {[
          { key: 'explainer', label: 'Explainer only' },
          { key: 'both', label: 'Both' },
          { key: 'code', label: 'Code only' },
        ].map(opt => (
          <button
            key={opt.key}
            type="button"
            className="btn-ghost"
            style={{ ...s.presentationBtn, ...(presenterLayout === opt.key ? s.presenterLayoutBtnActive : {}) }}
            aria-pressed={presenterLayout === opt.key}
            onClick={() => setPresenterLayout(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ) : (
    isSandbox && activeLesson.type === 'python' ? (
      <button className="btn-ghost" style={s.downloadCodeBtn} onClick={handleDownloadLessonSandboxCode}>
        Download sandbox code
      </button>
    ) : !isSandbox && (
      <div style={s.topBarTaskControls}>
        {taskProgressControl}
        {!isSolo && !isForcedTeacherLive && currentPythonTask && (
          <button className="btn-ghost" style={s.downloadCodeBtn} onClick={handleDownloadCurrentCode}>
            Download code
          </button>
        )}
        {isSolo && (
          <SoloNav
            flatTasks={flatTasks}
            currentIndex={currentIndex}
            cs={cs}
            canNavigateNextSolo={canNavigateNextSolo}
            onNavigate={handleSoloNavigate}
            compact
          />
        )}
      </div>
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
      {!teacherPresentation && (
        <TeacherMessageToast
          message={session?.students?.[identity?.anonymousId]?.teacherMessage}
          pushedAt={session?.students?.[identity?.anonymousId]?.teacherMessagePushedAt}
        />
      )}
      {showTeacherEditConsent && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={s.consentHeader}>
              <span style={s.consentIcon}>✏️</span>
              <span style={s.consentTitle}>Your teacher wants to help</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>{activeLesson?.type === 'scratch' ? 'Your teacher would like to edit your Scratch blocks to help you. You will see their changes live.' : activeLesson?.type === 'electronics' ? 'Your teacher would like to edit your breadboard to help you. You will see their changes live.' : 'Your teacher would like to edit your code to help you. They will type in your editor and you will see their changes live.'}</p>
            </div>
            <div style={s.consentFooter}>
              <button
                className="btn-ghost-outline"
                style={{ fontSize: 13 }}
                onClick={() => declineTeacherEdit?.(identity?.anonymousId)}
              >
                No thanks
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 13 }}
                onClick={() => acceptTeacherEdit?.(identity?.anonymousId)}
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
      {showStageChangeConsent && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={{ ...s.consentHeader, background: 'var(--colour-primary)' }}>
              <span style={s.consentIcon}>📋</span>
              <span style={s.consentTitle}>Your teacher wants to update your code</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>Your teacher would like to set your code to a different stage. Your current work will be replaced.</p>
            </div>
            <div style={s.consentFooter}>
              <button
                className="btn-ghost-outline"
                style={{ fontSize: 13 }}
                onClick={() => declineTeacherStage?.(identity?.anonymousId)}
              >
                No thanks
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 13 }}
                onClick={() => acceptTeacherStage?.(identity?.anonymousId)}
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingTopicId && !teacherPresentation && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={s.consentHeader}>
              <span style={s.consentIcon}>📚</span>
              <span style={s.consentTitle}>Your teacher has a resource for you</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>Your teacher would like you to read a topic article.</p>
            </div>
            <div style={s.consentFooter}>
              <button
                className="btn-ghost-outline"
                style={{ fontSize: 13 }}
                onClick={() => setPendingTopicId(null)}
              >
                Not now
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 13 }}
                onClick={() => { setOpenTopicId(pendingTopicId); setPendingTopicId(null) }}
              >
                Open it
              </button>
            </div>
          </div>
        </div>
      )}
      {fullscreenPromptVisible && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={{ ...s.consentHeader, background: '#0284c7' }}>
              <span style={s.consentIcon}>⛶</span>
              <span style={s.consentTitle}>Your teacher would like you to go fullscreen</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>Going fullscreen hides your browser's address bar and tabs.</p>
            </div>
            <div style={s.consentFooter}>
              <button
                className="btn-ghost-outline"
                style={{ fontSize: 13 }}
                onClick={() => setFullscreenDismissedAt(fullscreenRequestedAt)}
              >
                Not now
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 13 }}
                onClick={handleGoFullscreen}
              >
                Go Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
      <StudentStatusBanners
        isForcedTeacherLive={isForcedTeacherLive}
        isPresentationStudentViewer={isPresentationStudentViewer}
        isStudentGoLiveViewer={isStudentGoLiveViewer}
        teacherLiveSourceStudentName={session?.teacherLive?.sourceStudentName}
        isViewingPrev={isViewingPrev}
        onReturnToCurrentTask={() => setViewingTaskId(null)}
        inPersonalSandbox={cs.inPersonalSandbox}
        onLeavePersonalSandbox={cs.handleLeavePersonalSandbox}
        isTeacherEditing={isTeacherEditing}
        otherTabOpen={otherTabOpen}
        onDismissOtherTab={() => setOtherTabDismissed(true)}
        authError={!teacherPresentation && authError}
        onRetrySignIn={retrySignIn}
      />
      <div style={isSolo && !isSandbox && (isQuizTask || isInformationTask) ? { ...s.body, overflow: 'hidden' } : s.body}>
        <LessonTaskContent
          lesson={displayedLesson}
          task={task}
          cs={cs}
          lessonId={lessonId}
          identityId={effectiveIdentity?.anonymousId}
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
          isCodeArrangeTask={isCodeArrangeTask}
          displayCode={displayCode}
          displayArcadeDesign={displayArcadeDesign}
          displaySpriteState={displaySpriteState}
          displayCursor={displayCursor}
          displayBlockDrag={displayBlockDrag}
          displayFiles={displayFiles}
          displayActiveFile={displayActiveFile}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displayCheckSuggestion={displayCheckSuggestion}
          displaySelection={displaySelection}
          displayFs={displayFs}
          isTeacherEditing={isTeacherEditing}
          teacherLiveCode={teacherLiveCode}
          teacherLiveFiles={teacherLiveFiles}
          teacherLiveActiveFile={teacherLiveActiveFile}
          teacherLiveWorkspace={teacherLiveWorkspace}
          teacherLiveArcadeDesign={teacherLiveArcadeDesign}
          canOfferNextStage={canOfferNextStage}
          canOfferCompletePreview={canOfferCompletePreview}
          canOfferCompleteSolution={canOfferCompleteSolution}
          canOfferPersonalSandbox={canOfferPersonalSandbox}
          explainerShowsComplete={explainerShowsComplete}
          presenterLayout={teacherPresentation ? presenterLayout : 'both'}
          onNeedHelp={phase === 'lesson' && identity?.anonymousId ? () => requestHelp(identity.anonymousId) : undefined}
          onTopicOpen={phase === 'lesson' ? handleTopicOpen : undefined}
          onTopicClose={phase === 'lesson' ? handleTopicClose : undefined}
          openTopicId={phase === 'lesson' ? openTopicId : null}
          onVisiblePanesChange={handleVisiblePanesChange}
        />
      </div>
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
    padding: '8px 16px',
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
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  presentationTaskLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    minWidth: 72,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  presenterLayoutGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
    paddingLeft: 8,
    borderLeft: '1px solid rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  presenterLayoutBtnActive: {
    background: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  topBarTaskControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  downloadCodeBtn: {
    fontSize: 13,
    padding: '5px 10px',
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
  consentOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  consentModal: {
    background: 'var(--ui-surface)',
    borderRadius: 10,
    width: 'min(420px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    fontFamily: 'var(--font-body)',
  },
  consentHeader: {
    background: '#0f766e',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: '10px 10px 0 0',
  },
  consentIcon: { fontSize: '1.2rem', lineHeight: 1 },
  consentTitle: {
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
  },
  consentBody: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  consentText: {
    color: 'var(--colour-text)',
    fontSize: '0.95rem',
    lineHeight: 1.55,
    margin: 0,
  },
  consentFooter: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid var(--ui-border)',
    borderRadius: '0 0 10px 10px',
  },
}
