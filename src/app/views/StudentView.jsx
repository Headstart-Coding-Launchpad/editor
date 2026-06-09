import React, { useCallback, useEffect, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { useLessonLoader } from '../hooks/useLessonLoader'
import { useStudentPhase } from '../hooks/useStudentPhase'
import { useStudentCodeState } from '../hooks/useStudentCodeState'
import { flattenTasks, findTaskById, filterTasksByMode } from '../../shared/taskUtils'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS, normaliseDirPath } from '../../shared/filesystem'
import { loadSavedCode, loadPersonalSandboxCode } from '../studentStorage'
import { selectScratchInitialProject } from '../studentTaskContent'
import { deriveStudentLiveDisplay } from '../studentLiveDisplay'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import ExplainerPanel from '../components/ExplainerPanel'
import InformationTask from '../components/InformationTask'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import CollapsibleIframePreview from '../components/CollapsibleIframePreview'
import ScratchWorkspace from '../components/ScratchWorkspace'
import QuizTask from '../components/QuizTask'
import FilesystemTask from '../components/FilesystemTask'
import CheckFeedbackBanner from '../components/CheckFeedbackBanner'
import LiveActivityToast from '../components/LiveActivityToast'
import SplitPane from '../../shared/SplitPane'
import TaskSlideTransition from '../components/TaskSlideTransition'
import StudentEditorHeader from '../components/StudentEditorHeader'
import LoadingScreen from '../components/LoadingScreen'

export default function StudentView({ lessonId: lessonIdProp, soloMode = false, lesson: lessonProp = null, teacherPresentation = false, allowUnrestrictedTaskNavigation = false, previewMode = false, initialTaskId = null }) {
  const lessonId = lessonIdProp ?? lessonProp?.id ?? 'preview'

  // ─── Core hooks ───────────────────────────────────────────────────────────

  const useRealtimeSession = !soloMode || teacherPresentation
  const {
    session, loading: sessionLoading, connected, registerPresence, joinSession, registerJoining, unregisterJoining,
    writeStudentRun, writeStudentAnswer, writeStudentCode, writeStudentFiles, writeStudentOutput, writeStudentInteraction, writeStudentPersonalSandbox,
    setTaskId, setTeacherLive, updateTeacherLive, removeStudent,
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

  // ─── Navigation handlers (cross-hook coordination) ─────────────────────────

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
    return (
      <div style={styles.centreScreen}>
        <h2 style={styles.title}>Session ended</h2>
        <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
          Great work today! Your progress has been saved.
        </p>
        <p style={{ color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: 24 }}>
          Want to keep practising on your own?
        </p>
        <button
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: 15 }}
          onClick={() => setPhase('solo')}
        >
          Continue Solo
        </button>
      </div>
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
  const taskContentStyle = (!isSandbox && isQuizTask)
    ? styles.taskContentQuiz
    : (!isSandbox && isInformationTask)
    ? styles.taskContentInfo
    : lesson.type === 'python' || lesson.type === 'html'
    ? styles.taskContentScroll
    : styles.taskContent
  const editorAreaStyle = (!isSandbox && isQuizTask)
    ? styles.editorAreaQuiz
    : (!isSandbox && isInformationTask)
    ? styles.editorAreaInfo
    : lesson.type === 'scratch'
    ? styles.editorAreaScratch
    : lesson.type === 'python' || lesson.type === 'html'
      ? styles.editorAreaScroll
      : styles.editorArea

  const isPaused = !isForcedTeacherLive && (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  const topBarRight = teacherPresentation ? (
    <div style={styles.presentationControls}>
      <button
        className="btn-ghost"
        style={styles.presentationBtn}
        disabled={currentIndex <= 0}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
      >
        Previous
      </button>
      <span style={styles.presentationTaskLabel}>Task {currentIndex + 1} / {flatTasks.length}</span>
      <button
        className="btn-ghost"
        style={styles.presentationBtn}
        disabled={currentIndex >= flatTasks.length - 1}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
      >
        Next
      </button>
      <button
        className={isTeacherLiveActive ? 'btn-danger' : 'btn-primary'}
        style={styles.presentationBtn}
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

  return (
    <div style={{ ...styles.page, background: isForcedTeacherLive ? '#dde0e5' : '#f5f5f5' }}>
      {isPaused && (
        <div style={styles.pauseOverlay}>
          <span style={styles.pauseIcon}>⏸</span>
          <h2 style={styles.pauseTitle}>Coding Paused</h2>
          <p style={styles.pauseSubtitle}>Your teacher will resume the session shortly</p>
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

      {isForcedTeacherLive && (
        <div style={styles.teacherLiveBanner}>
          <span className="live-dot" />
          {isPresentationStudentViewer || isStudentGoLiveViewer
            ? `Watching ${session.teacherLive.sourceStudentName ?? 'a student'}'s screen — your work is saved`
            : 'Watching teacher — your own work is saved and will return when live view ends'}
        </div>
      )}



      {isViewingPrev && (
        <div style={styles.prevBanner}>
          You are viewing a previous task — return to current task to continue.
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={() => setViewingTaskId(null)}
          >
            Back to Current Task
          </button>
        </div>
      )}

      {cs.inPersonalSandbox && (
        <div style={styles.personalSandboxBanner}>
          <span>Personal Sandbox — your lesson progress is saved</span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={cs.handleLeavePersonalSandbox}
          >
            Close Sandbox
          </button>
        </div>
      )}

      <div style={isSolo && !isSandbox && (isQuizTask || isInformationTask) ? { ...styles.body, overflow: 'hidden' } : styles.body}>
        <TaskSlideTransition
          transitionKey={`${phase}-${cs.inPersonalSandbox ? 'personal-sandbox' : (viewingTaskId ?? currentTaskId)}`}
          style={taskContentStyle}
        >
          {previewMode && task && !isSandbox && (
            <div style={styles.previewTaskModeBanner}>
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
          {isSandbox && session?.sandboxExplainer && (
            <ExplainerPanel title="Instructions" content={session.sandboxExplainer} topicType={lesson.type} />
          )}
          {!isSandbox && isInformationTask ? (
            <InformationTask task={task} lesson={lesson} fill />
          ) : !isSandbox && task?.taskType === 'quiz' ? (
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
          ) : lesson.type === 'scratch' ? (() => {
            const personalSandboxScratchState = cs.inPersonalSandbox
              ? (loadPersonalSandboxCode(lessonId, identity?.anonymousId)?.state ?? lesson.sandboxStarterCode ?? null)
              : null
            const initialProject = cs.inPersonalSandbox ? null : selectScratchInitialProject({
              task,
              taskId: viewingTaskId ?? currentTaskId,
              readSavedCode: previewMode ? () => null : sourceTaskId => loadSavedCode(lessonId, sourceTaskId, identity?.anonymousId),
            })
            return (
              <>
                {!isViewingPrev && !isSandbox && !cs.inPersonalSandbox && !isForcedTeacherLive && (
                  <div style={{ display: 'flex', flexShrink: 0, paddingBottom: 4 }}>
                    <button
                      className="btn-ghost-outline"
                      style={styles.resetBtn}
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
                  syncNowKey={session?.activeStudentView === identity?.anonymousId ? session?.activeStudentView : null}
                />
              </>
            )
          })()
          : lesson.type === 'python' ? (
            <>
              {!isViewingPrev && !isForcedTeacherLive && (
                <div style={styles.studentEditorHeader} className="ui-tabs ui-tabs--editor">
                  <span style={styles.studentEditorTitle}>Code</span>
                  <div style={styles.studentEditorActions}>
                    {task?.interactionMode === 'submit' ? (
                      <button
                        className="btn-primary"
                        style={styles.studentEditorPrimaryBtn}
                        onClick={cs.handleSubmit}
                      >
                        Submit
                      </button>
                    ) : (
                      <>
                        <button
                          className={cs.running || cs.runningTests ? 'btn-danger' : 'btn-primary'}
                          style={styles.studentEditorPrimaryBtn}
                          onClick={cs.running || cs.runningTests ? cs.handleStop : cs.handleRun}
                          disabled={!cs.running && !cs.runningTests && cs.pyodideStatus === 'loading'}
                        >
                          {cs.running || cs.runningTests ? 'Stop' : cs.pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                        </button>
                        {task?.tests?.length > 0 && (
                          <button
                            className="btn-primary"
                            style={styles.studentEditorPrimaryBtn}
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
                      style={styles.resetBtn}
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
                code={isForcedTeacherLive ? displayCode : isViewingPrev ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.code ?? '') : cs.code}
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
                    {cs.runStatus === 'submitted' && (
                      task?.check
                        ? null
                        : <div style={styles.submitBanner}>Code submitted</div>
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
                      <div style={styles.testResultsPanel}>
                        {cs.testResults.map((r, i) => (
                          <span key={r.id ?? i} style={{ ...styles.testResultBadge, background: r.passed ? '#dcfce7' : '#fef3c7', color: r.passed ? '#15803d' : '#b45309' }}>
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
                  output={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.output ?? ''}
                  runStatus={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.runStatus ?? null}
                  checkPassed={false}
                  hasCheck={false}
                  checkAttempted={false}
                />
              )}
            </>
          ) : isMobile ? (
            <div style={styles.htmlMobile}>
              <div style={styles.htmlLeft}>
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
                <div style={styles.htmlMobilePreview}>
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
                <div style={styles.submitBanner}>Code submitted</div>
              )}
            </div>
          ) : (
            <>
            <SplitPane
              style={styles.htmlSplitPane}
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
                <div style={styles.htmlLeft}>
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
              <div style={styles.submitBanner}>Code submitted</div>
            )}
            </>
          )}

          {false && isSolo && (
            <div style={styles.soloNav}>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentIndex <= 0}
                onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
              >
                ← Previous
              </button>
              <span style={styles.soloNavLabel}>
                Task {currentIndex + 1} of {flatTasks.length}
              </span>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentIndex >= flatTasks.length - 1}
                onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        </TaskSlideTransition>
      </div>
      {isSolo && (
        <div style={styles.soloNav}>
          {!cs.inPersonalSandbox && (
            <button
              className="btn-secondary"
              style={styles.soloNavBtn}
              disabled={currentIndex <= 0}
              onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
            >
              Previous
            </button>
          )}
          {cs.inPersonalSandbox ? (
            <span style={styles.soloNavLabel}>Personal Sandbox</span>
          ) : (
            <span style={styles.soloNavLabel}>
              Task {currentIndex + 1} of {flatTasks.length}
            </span>
          )}
          {cs.inPersonalSandbox ? null : hasPersonalSandbox && !isQuizTask && !isInformationTask && (
            <button
              className="btn-ghost-outline"
              style={{ ...styles.soloNavBtn, fontSize: 14 }}
              onClick={cs.handleEnterPersonalSandbox}
              title="Open your personal sandbox to experiment freely"
            >
              Open Sandbox
            </button>
          )}
          {!cs.inPersonalSandbox && (
            <button
              className={`btn-secondary${cs.checkPassed && currentIndex < flatTasks.length - 1 ? ' btn-next-success' : ''}`}
              style={{
                ...styles.soloNavBtn,
                ...(canNavigateNextSolo && currentIndex < flatTasks.length - 1
                  ? { fontSize: 18, padding: '14px 36px' }
                  : {}),
              }}
              disabled={currentIndex >= flatTasks.length - 1 || !canNavigateNextSolo}
              onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
              title={!canNavigateNextSolo ? 'Pass the completion check before moving on' : 'Next task'}
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
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
  teacherLiveBanner: {
    background: 'var(--colour-primary)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1.15rem',
    padding: '16px 20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    letterSpacing: '0.01em',
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
  taskContentScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'visible',
  },
  editorAreaScratch: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 0',
    flexShrink: 0,
  },
  htmlMobileButtonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    margin: '0 0 4px',
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
  centreScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  taskTitleHeader: {
    background: 'var(--colour-primary-dark)',
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    padding: '10px 16px',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  prevBanner: {
    background: 'rgba(239,68,68,0.08)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
  },
  personalSandboxBanner: {
    background: 'rgba(124,58,237,0.08)',
    borderBottom: '1px solid rgba(124,58,237,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#5b21b6',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    flexShrink: 0,
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
  soloNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px 16px',
    borderTop: '2px solid #e5e7eb',
    background: '#f5f5f5',
    flexShrink: 0,
  },
  soloNavBtn: {
    fontSize: 16,
    padding: '12px 28px',
    fontWeight: 600,
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
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
  submitCheckPass: {
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  submitCheckFail: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
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
