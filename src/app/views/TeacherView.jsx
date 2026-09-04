import React, { useEffect, useState, useRef, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSession } from '../hooks/useSession'
import { flattenTasks, filterTasksByMode, getStarterStage } from '../../shared/taskUtils'
import { applyLessonOverride, publishLessonTasks, saveSessionReport } from '../../shared/lessonService'
import { attachTeacherFeedback, buildSessionReport } from '../../shared/lessonReport'
import { decodeLessonBlocksFromFirestore } from '../../shared/lessonBlocksCodec'
import EditLessonModal from '../components/EditLessonModal'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import ExplainerPanel from '../components/ExplainerPanel'
import StudentGrid from '../components/StudentGrid'
import LiveActivityToast from '../components/LiveActivityToast'
import TeacherTimers from '../components/TeacherTimers'
import TeacherSessionControls from '../components/TeacherSessionControls'
import TeacherPreviewBanner from '../components/TeacherPreviewBanner'
import TeacherSandboxBanner from '../components/TeacherSandboxBanner'
import TeacherEndSessionModal from '../components/TeacherEndSessionModal'
import TeacherFeedbackModal from '../components/TeacherFeedbackModal'
import TeacherReportModal from '../components/TeacherReportModal'
import TeacherReportsPanel from '../components/TeacherReportsPanel'
import CheckConditionsPanel from './teacher/CheckConditionsPanel'
import TeacherEditorPanel from './teacher/TeacherEditorPanel'
import { DEFAULT_FS } from '../../modules/filesystem'
import { DEFAULT_CIRCUIT, serializeCircuit } from '../../modules/electronics/circuit'
import { cloneFiles, cloneScratchState, decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { getEffectiveLessonForModule, getEffectiveLessonForTask, getLessonModules, getTaskModuleId, isComposedLesson } from '../../shared/composedLesson'
import { decodeFileKey } from '../../shared/fileKeys'
import { useTopicLibrary } from '../../shared/topicLibrary'
import { buildStudentLivePayload } from '../teacherLivePayload'
import { getLessonModule } from '../../modules/registry'
import PaneFocusDropdown from '../components/student-modal/PaneFocusDropdown'

function canRecordAdvanceOverride(task) {
  if (!task || task.taskType === 'information') return false
  if (task.taskType === 'quiz' && task.quizType === 'confidence') return false
  if (task.taskType === 'quiz' && task.quizType === 'short_answer' && task.check == null) return false
  return true
}

export default function TeacherView({ lessonId }) {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const {
    session, loading,
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode, pushSandboxFiles, pushSandboxExplainer,
    pushLessonOverride, clearLessonOverride,
    setPaused, requestFullscreenForAll, setExplainerShowComplete, setActiveStudentView, setTeacherLive, renameStudent, removeStudent, pushResetToStudent, overrideStudentCheck, recordClassAdvanceOverrides, dismissHelp,
    sendToTopic, sendMessageToStudent, updateVideoCallLink, sendVideoCallLink,
    requestTeacherEdit, pushTeacherLiveCode, commitTeacherEdit, cancelTeacherEdit,
    requestTeacherStage, clearTeacherStage,
    pushTeacherHighlight, removeTeacherHighlight, recordSupportStageReveal,
    pushTeacherPaneCommand, pushClassPaneCommand,
  } = useSession(lessonId)

  const [baseLesson, setBaseLesson]     = useState(null)
  const lesson = useMemo(
    () => applyLessonOverride(baseLesson, session?.lessonOverrideTasks),
    [baseLesson, session?.lessonOverrideTasks]
  )
  const [lessonLoading, setLessonLoading] = useState(true)
  const { topics } = useTopicLibrary(isComposedLesson(lesson) ? null : lesson?.type, !!lesson)
  const [lessonError, setLessonError]     = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(1)
  // previewTaskId: non-null while the teacher is previewing a task locally without moving students
  const [previewTaskId, setPreviewTaskId]   = useState(null)
  const [showEndModal, setShowEndModal]         = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showEditLessonModal, setShowEditLessonModal] = useState(false)
  const [lastReport, setLastReport]             = useState(null)
  const [showReportsPanel, setShowReportsPanel] = useState(false)
  const [leftCollapsed, setLeftCollapsed]   = useState(() => window.innerWidth < 860)
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1100)
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [sandboxStaging, setSandboxStaging] = useState(false)
  const [scratchState, setScratchState] = useState(null)
  const [fsState, setFsState] = useState(DEFAULT_FS)
  const [teacherCodeTab, setTeacherCodeTab] = useState('starter')
  const [sandboxModuleId, setSandboxModuleId] = useState(null)
  const [editorActivity, setEditorActivity] = useState(null)
  const sandboxDraftRef = useRef({ code: null, files: null, scratchState: null, fs: null })
  const presentationWindowRef = useRef(null)

  // Load lesson from Firestore
  useEffect(() => {
    getDoc(doc(firestore, 'lessons', lessonId))
      .then(snap => {
        if (snap.exists()) {
          setBaseLesson(decodeLessonBlocksFromFirestore(snap.data()))
        } else {
          setLessonError(true)
        }
        setLessonLoading(false)
      })
      .catch(() => { setLessonError(true); setLessonLoading(false) })
  }, [lessonId])

  // Create session only if none exists — don't auto-restart an ended session
  useEffect(() => {
    if (loading || !lesson) return
    if (!session) createSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson])

  useEffect(() => {
    if (!session?.currentTaskId || sandboxStaging) return
    if (session.currentTaskId !== currentTaskId) {
      setCurrentTaskId(session.currentTaskId)
    }
  }, [session?.currentTaskId, currentTaskId, sandboxStaging])

  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 860) setLeftCollapsed(true)
      if (window.innerWidth < 1100) setRightCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function loadCurrentTaskContent(taskId) {
    if (!lesson) return
    const task = flattenTasks(lesson?.tasks ?? []).find(t => t.id === taskId)
    if (!task) return
    const taskLesson = getEffectiveLessonForTask(lesson, task)
    if (task.taskType === 'quiz' || task.taskType === 'information') {
      setCode('')
      setFiles([])
      setScratchState(null)
    } else if (taskLesson.type === 'python' || taskLesson.type === 'arcade') {
      setCode(getStarterStage(task)?.stage?.code ?? task.starterCode ?? '')
    } else if (taskLesson.type === 'scratch') {
      setScratchState(task.starterBlocks ?? null)
    } else if (taskLesson.type === 'filesystem') {
      setFsState(task.starterFs ?? DEFAULT_FS)
    } else if (taskLesson.type === 'electronics') {
      setCode(serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT))
    } else {
      setFiles(getStarterStage(task)?.stage?.files ?? task.starterFiles ?? [])
    }
  }

  // Load task content when displayed task changes (preview or session task)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sandboxStaging || session?.state === 'sandbox') return
    loadCurrentTaskContent(previewTaskId ?? currentTaskId)
  }, [currentTaskId, previewTaskId, lesson, sandboxStaging, session?.state])

  // Restore sandbox state when teacher opens/reloads while sandbox is live.
  // Also used when entering sandbox — see applySandboxStarterState() below.
  function applySandboxStarterState(moduleId = sandboxModuleId) {
    const task = flattenTasks(lesson?.tasks ?? []).find(t => t.id === currentTaskId)
    const resolvedModuleId = moduleId ?? getTaskModuleId(lesson, task) ?? getLessonModules(lesson)[0]?.id ?? null
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, resolvedModuleId) ?? lesson
    const mod = getLessonModule(activeSandboxLesson.type)
    const configured = mod.getSandboxState(activeSandboxLesson, task)
    const draft = sandboxDraftRef.current
    const sessionHasCode = session?.state === 'sandbox' && session.sandboxCode != null

    if (activeSandboxLesson.type === 'python' || activeSandboxLesson.type === 'arcade' || activeSandboxLesson.type === 'electronics') {
      setCode(draft.code ?? (sessionHasCode ? session.sandboxCode : null) ?? configured)
    } else if (activeSandboxLesson.type === 'scratch') {
      setScratchState(draft.scratchState ?? (sessionHasCode ? parseScratchState(session.sandboxCode) : null) ?? configured)
    } else if (activeSandboxLesson.type === 'filesystem') {
      setFsState(draft.fs ?? (sessionHasCode ? mod.deserializeState(session.sandboxCode) : null) ?? configured)
    } else {
      const sessionFiles = isSandbox ? decodeSessionFiles(session?.sandboxFiles, decodeFileKey) : []
      const starterFiles = draft.files?.length ? cloneFiles(draft.files) : sessionFiles.length ? cloneFiles(sessionFiles) : cloneFiles(configured.files ?? [])
      setFiles(starterFiles)
    }
  }

  useEffect(() => {
    if (!lesson || sandboxStaging || session?.state !== 'sandbox') return
    applySandboxStarterState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, sandboxStaging, session?.state, session?.sandboxCodePushedAt, session?.sandboxFilesUpdatedAt])

  // Reset complete code tab when displayed task changes
  useEffect(() => {
    setTeacherCodeTab('starter')
  }, [currentTaskId, previewTaskId])

  async function handleTaskChange(taskId) {
    const leavingTaskId = session?.currentTaskId ?? currentTaskId
    const leavingTask = flatTasks.find(t => t.id === leavingTaskId)
    if (session?.state === 'active' && taskId !== leavingTaskId && canRecordAdvanceOverride(leavingTask)) {
      await recordClassAdvanceOverrides(leavingTaskId)
    }
    setPreviewTaskId(null)
    setCurrentTaskId(taskId)
    await setTeacherLive(null)
    await setTaskId(taskId)
  }

  // Preview a task locally without moving students
  function handlePreviewTask(taskId) {
    if (taskId === currentTaskId) {
      setPreviewTaskId(null)
    } else {
      setPreviewTaskId(taskId)
    }
  }

  function handleEnterSandbox() {
    setPreviewTaskId(null)
    const currentTask = flattenTasks(lesson?.tasks ?? []).find(task => task.id === currentTaskId)
    const initialModuleId = isComposedLesson(lesson) ? (getTaskModuleId(lesson, currentTask) ?? getLessonModules(lesson)[0]?.id ?? null) : null
    setSandboxModuleId(initialModuleId)
    applySandboxStarterState(initialModuleId)
    setSandboxStaging(true)
  }

  function handleCancelSandbox() {
    setSandboxStaging(false)
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleGoLiveSandbox() {
    const previousTaskId = currentTaskId
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, sandboxModuleId) ?? lesson
    const sandboxTask = isComposedLesson(lesson)
      ? flattenTasks(lesson?.tasks ?? []).find(task => getTaskModuleId(lesson, task) === sandboxModuleId && task.taskType !== 'information' && task.taskType !== 'quiz')
      : null
    if (sandboxTask && sandboxTask.id !== currentTaskId) {
      setCurrentTaskId(sandboxTask.id)
      await setTaskId(sandboxTask.id)
    }
    if (activeSandboxLesson.type === 'python' || activeSandboxLesson.type === 'arcade' || activeSandboxLesson.type === 'electronics') {
      sandboxDraftRef.current.code = code
      await enterSandbox({ code, previousTaskId })
    } else if (activeSandboxLesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
      await enterSandbox({ code: JSON.stringify(scratchState ?? {}), previousTaskId })
    } else if (activeSandboxLesson.type === 'filesystem') {
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(fsState))
      await enterSandbox({ code: JSON.stringify(fsState), previousTaskId })
    } else {
      sandboxDraftRef.current.files = cloneFiles(files)
      await enterSandbox({ files, previousTaskId })
    }
    setSandboxStaging(false)
  }

  async function handlePushSandbox() {
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, sandboxModuleId) ?? lesson
    if (activeSandboxLesson.type === 'python' || activeSandboxLesson.type === 'arcade' || activeSandboxLesson.type === 'electronics') {
      sandboxDraftRef.current.code = code
      await pushSandboxCode(code)
    } else if (activeSandboxLesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
      await pushSandboxCode(JSON.stringify(scratchState ?? {}))
    } else if (activeSandboxLesson.type === 'filesystem') {
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(fsState))
      await pushSandboxCode(JSON.stringify(fsState))
    } else {
      sandboxDraftRef.current.files = cloneFiles(files)
      await pushSandboxFiles(files)
    }
  }

  async function handleResetSandboxStarter() {
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, sandboxModuleId) ?? lesson
    const mod = getLessonModule(activeSandboxLesson.type)
    const task = flattenTasks(lesson?.tasks ?? []).find(t => t.id === currentTaskId)
    const configured = mod.getSandboxState(activeSandboxLesson, task)

    if (activeSandboxLesson.type === 'python' || activeSandboxLesson.type === 'arcade' || activeSandboxLesson.type === 'electronics') {
      sandboxDraftRef.current.code = configured
      setCode(configured)
      if (isSandbox) await pushSandboxCode(configured)
    } else if (activeSandboxLesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(configured)
      setScratchState(configured)
      if (isSandbox) await pushSandboxCode(JSON.stringify(configured ?? {}))
    } else if (activeSandboxLesson.type === 'filesystem') {
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(configured))
      setFsState(configured)
      if (isSandbox) await pushSandboxCode(JSON.stringify(configured))
    } else {
      const starterFiles = cloneFiles(configured.files ?? [])
      sandboxDraftRef.current.files = starterFiles
      setFiles(starterFiles)
      if (isSandbox) await pushSandboxFiles(starterFiles)
    }
  }

  async function handleDeactivateSandbox() {
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, sandboxModuleId) ?? lesson
    if (activeSandboxLesson.type === 'python' || activeSandboxLesson.type === 'arcade' || activeSandboxLesson.type === 'electronics') sandboxDraftRef.current.code = code
    else if (activeSandboxLesson.type === 'scratch') sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
    else if (activeSandboxLesson.type === 'filesystem') sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(fsState))
    else sandboxDraftRef.current.files = cloneFiles(files)
    setSandboxStaging(false)
    const restoredTaskId = session?.sandboxPreviousTaskId ?? currentTaskId
    await exitSandbox()
    setCurrentTaskId(restoredTaskId)
    loadCurrentTaskContent(restoredTaskId)
  }

  async function handleEndSession(goHome) {
    const report = session?.startedAt ? buildSessionReport({ session, lesson }) : null
    if (report) await saveSessionReport(lessonId, report.sessionId, report)
    await endSession()
    presentationWindowRef.current?.close()
    presentationWindowRef.current = null
    setShowEndModal(false)
    if (report && !goHome) setLastReport(report)
    if (goHome) navigate('/')
  }

  async function handleSaveSessionFeedback(feedback) {
    const updatedReport = attachTeacherFeedback(lastReport, feedback)
    if (updatedReport !== lastReport) await saveSessionReport(lessonId, updatedReport.sessionId, updatedReport)
    setLastReport(updatedReport)
  }

  async function handleApplySessionLessonEdit(tasks) {
    await pushLessonOverride(tasks)
  }

  async function handleSavePermanentLessonEdit(tasks) {
    const [firestoreResult, rtdbResult] = await Promise.allSettled([
      publishLessonTasks(lessonId, tasks),
      pushLessonOverride(tasks),
    ])
    if (firestoreResult.status === 'rejected') throw firestoreResult.reason
    setBaseLesson(prev => ({ ...prev, tasks }))
    if (rtdbResult.status === 'rejected') {
      throw new Error('Lesson saved — but failed to update the live session: ' + rtdbResult.reason?.message)
    }
  }

  async function handleResetLessonOverride() {
    await clearLessonOverride()
  }

  async function handleGoLiveForMe(studentId) {
    await setTeacherLive(null)
    await setActiveStudentView(studentId)
  }

  async function handleGoLiveForAll(student) {
    await setActiveStudentView(student.anonymousId)
    await setTeacherLive(buildStudentLivePayload({
      student,
      lesson,
      taskId: session?.currentTaskId ?? currentTaskId,
      entryFileTaskId: session?.currentTaskId,
    }))
  }

  async function handleStopStudentLive() {
    await setTeacherLive(null)
    await setActiveStudentView(null)
  }

  function handleOpenPresentationWindow() {
    const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    presentationWindowRef.current = window.open(`${base}?teacher=true&present=true`, `headstart-present-${lessonId}`, 'popup=yes,width=1280,height=800')
  }

  const isSandbox = session?.state === 'sandbox'
  const isInSandbox = isSandbox || sandboxStaging
  const visibleTasks = filterTasksByMode(lesson?.tasks ?? [], 'live')
  const flatTasks = flattenTasks(visibleTasks)
  // displayTaskId: what the teacher's centre panel is currently showing
  const displayTaskId = previewTaskId ?? currentTaskId
  const task = flatTasks.find(t => t.id === displayTaskId)
  const displayedLesson = getEffectiveLessonForTask(lesson, displayTaskId)
  const lessonModules = getLessonModules(lesson)
  const activeSandboxModuleId = sandboxModuleId ?? getTaskModuleId(lesson, task) ?? lessonModules[0]?.id ?? null
  const sandboxLesson = getEffectiveLessonForModule(lesson, activeSandboxModuleId)
  const editorLesson = isInSandbox ? sandboxLesson : displayedLesson
  const currentTask = flatTasks.find(t => t.id === (session?.currentTaskId ?? currentTaskId))
  const displayIndex = flatTasks.findIndex(t => t.id === displayTaskId)
  const teacherStageMatch = teacherCodeTab.match(/^stage_(\d+)$/)
  const teacherActiveStageIndex = teacherStageMatch ? parseInt(teacherStageMatch[1], 10) : null
  const taskCodeStages = task?.codeStages ?? []
  const activeTeacherStage = teacherActiveStageIndex !== null && !isInSandbox
    ? (taskCodeStages[teacherActiveStageIndex] ?? null)
    : null
  const isInformationTask = task?.taskType === 'information'
  const students = session ? Object.entries(session.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id })) : []
  const joiningCount = Object.keys(session?.joiningStudents ?? {}).length
  const isPreviewing = previewTaskId !== null && !isInSandbox

  async function handleSendStageToAll(action) {
    const studentIds = Object.keys(session?.students ?? {})
    await Promise.all(studentIds.map(id => pushResetToStudent(id, action)))
  }

  async function handleSendTopicToAll(topicId) {
    const studentIds = Object.keys(session?.students ?? {})
    await Promise.all(studentIds.map(id => sendToTopic(id, topicId)))
  }

  async function handleSendToIndividual(topicId, studentId) {
    await sendToTopic(studentId, topicId)
  }

  const liveState = editorLesson?.type === 'python' || editorLesson?.type === 'arcade' ? code
    : editorLesson?.type === 'scratch' ? scratchState
    : editorLesson?.type === 'filesystem' ? fsState
    : editorLesson?.type === 'electronics' ? code
    : { files, entryFile: task?.entryFile ?? 'index.html' }

  const onChange = !isInSandbox ? undefined
    : editorLesson?.type === 'python' || editorLesson?.type === 'arcade'
      ? value => { setCode(value); sandboxDraftRef.current.code = value }
    : editorLesson?.type === 'scratch'
      ? state => { setScratchState(state); sandboxDraftRef.current.scratchState = cloneScratchState(state) }
        : editorLesson?.type === 'filesystem'
        ? newFs => { setFsState(newFs); sandboxDraftRef.current.fs = newFs }
          : editorLesson?.type === 'electronics'
          ? value => { setCode(value); sandboxDraftRef.current.code = value }
        : (name, content) => setFiles(prev => {
              const next = prev.map(f => f.name === name ? { ...f, content } : f)
              sandboxDraftRef.current.files = cloneFiles(next)
              return next
            })

  if (lessonLoading) {
    return <div style={s.centre}><p>Loading…</p></div>
  }
  if (lessonError || !lesson) {
    return <div style={s.centre}><p>Lesson &ldquo;{lessonId}&rdquo; not found.</p></div>
  }

  return (
    <div style={s.page}>
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        isSandbox={isSandbox}
        right={
          <>
            {session && !isInformationTask && (
              <PaneFocusDropdown
                label="Focus Class"
                lessonType={editorLesson?.type}
                onHighlight={panes => pushClassPaneCommand({ mode: 'highlight', panes })}
                onForce={panes => pushClassPaneCommand({ mode: 'force', panes })}
              />
            )}
            <TeacherSessionControls
              session={session}
              onOpenPresentationWindow={handleOpenPresentationWindow}
              onOpenFeedback={() => setShowFeedbackModal(true)}
              onOpenReports={() => setShowReportsPanel(true)}
              onOpenEditLesson={() => setShowEditLessonModal(true)}
              onStartSession={startSession}
              onEndSession={() => setShowEndModal(true)}
              onRestartSession={restartSession}
              onReturnToAdmin={() => navigate('/admin')}
              onUpdateVideoCallLink={updateVideoCallLink}
            />
          </>
        }
      />
      <TeacherTimers session={session} task={currentTask} tasks={visibleTasks} />
      <LiveActivityToast activity={editorActivity} showClicks={false} />



      <div style={{ ...s.body, gridTemplateColumns: `${leftCollapsed ? '40px' : '220px'} 1fr ${rightCollapsed ? '40px' : '280px'}` }}>
        {/* Left — Task Navigator */}
        <aside style={s.left}>
          <TaskNavigator
            tasks={visibleTasks}
            currentTaskId={currentTaskId}
            previewTaskId={previewTaskId}
            session={session}
            students={students}
            onTaskSelect={handlePreviewTask}
            onSandbox={isSandbox ? handleDeactivateSandbox : sandboxStaging ? handleCancelSandbox : handleEnterSandbox}
            isSandbox={isSandbox}
            sandboxStaging={sandboxStaging}
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed(v => !v)}
          />
        </aside>

        {/* Centre — Teacher Editor */}
        <main style={{ ...s.centre, ...((isInformationTask || displayedLesson.type === 'html' || displayedLesson.type === 'scratch' || displayedLesson.type === 'filesystem' || displayedLesson.type === 'electronics') && !(currentTask?.check != null && !isInSandbox) ? { overflow: 'hidden' } : {}) }}>
          {task?.explainer && !isInSandbox && task?.taskType !== 'quiz' && !isInformationTask && (
            <ExplainerPanel title={task.title} content={task.explainer} topicType={displayedLesson.type} />
          )}

          {false && displayedLesson.type === 'python' && !!task?.completeCode && !isInSandbox && task?.taskType !== 'quiz' && !isInformationTask && (
            <div style={sc.explainerToggleRow}>
              <button
                type="button"
                style={{ ...sc.explainerToggleBtn, ...(session?.explainerShowComplete ? sc.explainerToggleBtnActive : {}) }}
                onClick={() => setExplainerShowComplete(!session?.explainerShowComplete)}
              >
                {session?.explainerShowComplete ? 'Showing complete code in students’ explainer — click to revert' : 'Show complete code in students’ explainer'}
              </button>
            </div>
          )}

          {isPreviewing && (
            <TeacherPreviewBanner
              taskNumber={displayIndex + 1}
              taskTitle={task?.title}
              onCancel={() => setPreviewTaskId(null)}
              onConfirm={() => handleTaskChange(previewTaskId)}
            />
          )}

          {isInSandbox && (
            <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              {lessonModules.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eef2ff', fontSize: '0.88rem' }}>
                  Sandbox module
                  <select
                    value={activeSandboxModuleId ?? ''}
                    onChange={event => {
                      const moduleId = event.target.value || null
                      setSandboxModuleId(moduleId)
                      applySandboxStarterState(moduleId)
                    }}
                  >
                    {lessonModules.map(module => <option key={module.id} value={module.id}>{module.title || module.id} ({module.type})</option>)}
                  </select>
                </label>
              )}
              <TeacherSandboxBanner
                staging={sandboxStaging}
                onCancel={handleCancelSandbox}
                onReset={handleResetSandboxStarter}
                onGoLive={handleGoLiveSandbox}
                onPush={handlePushSandbox}
                onDeactivate={handleDeactivateSandbox}
                sandboxExplainer={session?.sandboxExplainer ?? ''}
                onPushExplainer={pushSandboxExplainer}
                lessonType={editorLesson.type}
              />
            </div>
          )}

          <TeacherEditorPanel
            lesson={editorLesson}
            task={task}
            displayTaskId={displayTaskId}
            isInSandbox={isInSandbox}
            isInformationTask={isInformationTask}
            activeTeacherStage={activeTeacherStage}
            taskCodeStages={taskCodeStages}
            teacherCodeTab={teacherCodeTab}
            setTeacherCodeTab={setTeacherCodeTab}
            hasStudents={students.length > 0}
            onSendStageToAll={handleSendStageToAll}
            liveState={liveState}
            onChange={onChange}
            onActivity={setEditorActivity}
          />
          {task?.check != null && !isInSandbox && (
            <CheckConditionsPanel check={task.check} taskTitle={task.title} />
          )}
        </main>

        {/* Right — Student Grid */}
        <aside style={s.right}>
          <StudentGrid
            students={students}
            joiningCount={joiningCount}
            lesson={lesson}
            lessonId={lessonId}
            session={session}
            topics={topics}
            onRename={renameStudent}
            onRemove={removeStudent}
            onGoLive={handleGoLiveForMe}
            onGoLiveForAll={handleGoLiveForAll}
            onStopLive={handleStopStudentLive}
            onRemoteReset={pushResetToStudent}
            onOverrideCheck={overrideStudentCheck}
            onDismissHelp={dismissHelp}
            onSendToTopic={sendToTopic}
            onSendVideoCallLink={session?.videoCallLink ? sendVideoCallLink : undefined}
            onSendTopicToAll={handleSendTopicToAll}
            onSendToIndividual={handleSendToIndividual}
            onSendMessage={sendMessageToStudent}
            onRequestTeacherEdit={requestTeacherEdit}
            onPushTeacherLiveCode={pushTeacherLiveCode}
            onCommitTeacherEdit={commitTeacherEdit}
            onCancelTeacherEdit={cancelTeacherEdit}
            onRequestTeacherStage={requestTeacherStage}
            onClearTeacherStage={clearTeacherStage}
            onAddHighlight={pushTeacherHighlight}
            onRemoveHighlight={removeTeacherHighlight}
            onPushTeacherPaneCommand={pushTeacherPaneCommand}
            onRevealSupportStage={recordSupportStageReveal}
            onTogglePaused={() => setPaused(!session?.isPaused)}
            onRequestFullscreenAll={requestFullscreenForAll}
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed(v => !v)}
          />
        </aside>
      </div>

      {showEndModal && (
        <TeacherEndSessionModal
          onClose={() => setShowEndModal(false)}
          onEnd={() => handleEndSession(false)}
          onEndAndGoHome={() => handleEndSession(true)}
        />
      )}

      {showFeedbackModal && (
        <TeacherFeedbackModal
          lessonId={lessonId}
          lessonTitle={lesson?.title ?? ''}
          currentTaskId={displayTaskId}
          currentTaskTitle={task?.title ?? null}
          teacherEmail={user?.email ?? ''}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {lastReport && (
        <TeacherReportModal
          report={lastReport}
          onClose={() => setLastReport(null)}
          onSaveFeedback={handleSaveSessionFeedback}
        />
      )}

      {showReportsPanel && (
        <TeacherReportsPanel
          lessonId={lessonId}
          liveReport={(session?.state === 'active' || session?.state === 'sandbox') ? buildSessionReport({ session, lesson }) : null}
          onClose={() => setShowReportsPanel(false)}
        />
      )}

      {showEditLessonModal && (
        <EditLessonModal
          lesson={lesson}
          role={role}
          currentTaskId={session?.currentTaskId ?? currentTaskId}
          onApplySession={handleApplySessionLessonEdit}
          onSavePermanent={handleSavePermanentLessonEdit}
          onResetToOriginal={handleResetLessonOverride}
          onClose={() => setShowEditLessonModal(false)}
        />
      )}
    </div>
  )
}

const sc = {
  explainerToggleRow: { flexShrink: 0 },
  explainerToggleBtn: {
    fontSize: 12,
    padding: '5px 12px',
    background: '#fff',
    color: 'var(--colour-primary)',
    border: '1px solid rgba(124,58,237,0.35)',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  explainerToggleBtnActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
    borderColor: 'var(--colour-primary)',
  },
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr 280px',
    overflow: 'hidden',
    gap: 0,
  },
  left: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  centre: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    gap: 10,
    overflow: 'auto',
    background: '#f5f5f5',
  },
  right: {
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    overflow: 'auto',
  },
}
