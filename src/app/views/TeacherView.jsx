import React, { useEffect, useState, useRef } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSession } from '../hooks/useSession'
import { flattenTasks, filterTasksByMode } from '../../shared/taskUtils'
import { getLessonLinks } from '../../shared/lessonLinks'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import ScratchWorkspace from '../components/ScratchWorkspace'
import ExplainerPanel from '../components/ExplainerPanel'
import InformationTask from '../components/InformationTask'
import StudentGrid from '../components/StudentGrid'
import QuizTask from '../components/QuizTask'
import LiveActivityToast from '../components/LiveActivityToast'
import TeacherTimers from '../components/TeacherTimers'
import TeacherSessionControls from '../components/TeacherSessionControls'
import TeacherCodeTabs from '../components/TeacherCodeTabs'
import TeacherPreviewBanner from '../components/TeacherPreviewBanner'
import TeacherSandboxBanner from '../components/TeacherSandboxBanner'
import TeacherEndSessionModal from '../components/TeacherEndSessionModal'
import TeacherFeedbackModal from '../components/TeacherFeedbackModal'
import FilesystemTask from '../components/FilesystemTask'
import { DEFAULT_FS } from '../../shared/filesystem'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { cloneFiles, cloneScratchState } from '../../shared/workspaceData'
import { useTopicLibrary } from '../../shared/topicLibrary'
import { buildStudentLivePayload } from '../teacherLivePayload'
import {
  getSandboxConfiguredCode,
  getSandboxConfiguredFiles,
  getSandboxConfiguredScratch,
  getSandboxConfiguredFs,
  getSandboxStarterCode,
  getSandboxStarterFiles,
  getSandboxStarterScratch,
  getSandboxStarterFs,
} from '../teacherSandboxContent'

export default function TeacherView({ lessonId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    session, loading,
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode, pushSandboxFiles, pushSandboxExplainer,
    setPaused, setActiveStudentView, setTeacherLive, renameStudent, removeStudent, pushResetToStudent, overrideStudentCheck, dismissHelp,
    sendToTopic,
  } = useSession(lessonId)

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const { topics } = useTopicLibrary(lesson?.type, !!lesson)
  const [lessonError, setLessonError]     = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(1)
  // previewTaskId: non-null while the teacher is previewing a task locally without moving students
  const [previewTaskId, setPreviewTaskId]   = useState(null)
  const [showEndModal, setShowEndModal]         = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [sandboxStaging, setSandboxStaging] = useState(false)
  const [scratchState, setScratchState] = useState(null)
  const [fsState, setFsState] = useState(DEFAULT_FS)
  const [teacherCodeTab, setTeacherCodeTab] = useState('starter')
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [copiedLink, setCopiedLink] = useState(null) // 'live' | 'solo' | null
  const [activeCompleteFile, setActiveCompleteFile] = useState('')
  const [editorActivity, setEditorActivity] = useState(null)
  const sandboxDraftRef = useRef({ code: null, files: null, scratchState: null, fs: null })
  const presentationWindowRef = useRef(null)

  // Load lesson from Firestore
  useEffect(() => {
    getDoc(doc(firestore, 'lessons', lessonId))
      .then(snap => {
        if (snap.exists()) {
          setLesson(snap.data())
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

  function loadCurrentTaskContent(taskId) {
    if (!lesson) return
    const task = flattenTasks(lesson?.tasks ?? []).find(t => t.id === taskId)
    if (!task) return
    if (task.taskType === 'quiz' || task.taskType === 'information') {
      setCode('')
      setFiles([])
      setActiveFile('')
      setScratchState(null)
    } else
    if (lesson.type === 'python') {
      setCode(task.starterCode ?? '')
    } else if (lesson.type === 'scratch') {
      setScratchState(task.starterBlocks ?? null)
    } else if (lesson.type === 'filesystem') {
      setFsState(task.starterFs ?? DEFAULT_FS)
    } else {
      const taskFiles = task.starterFiles ?? []
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  // Load task content when displayed task changes (preview or session task)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sandboxStaging || session?.state === 'sandbox') return
    loadCurrentTaskContent(previewTaskId ?? currentTaskId)
  }, [currentTaskId, previewTaskId, lesson, sandboxStaging, session?.state])

  // If the teacher opens/reloads while the sandbox is already live, show the
  // live sandbox payload instead of the normal task starter.
  useEffect(() => {
    if (!lesson || sandboxStaging || session?.state !== 'sandbox') return
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode({
        lesson, taskId: currentTaskId, session,
        draftCode: sandboxDraftRef.current.code, currentCode: code,
      }))
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch({
        lesson, taskId: currentTaskId, session,
        draftState: sandboxDraftRef.current.scratchState, currentState: scratchState,
      }))
    } else if (lesson.type === 'filesystem') {
      setFsState(getSandboxStarterFs({
        lesson, taskId: currentTaskId, session,
        draftFs: sandboxDraftRef.current.fs, currentFs: fsState,
      }))
    } else {
      const starterFiles = getSandboxStarterFiles({
        lesson, taskId: currentTaskId, session,
        draftFiles: sandboxDraftRef.current.files, currentFiles: files,
      })
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, sandboxStaging, session?.state, session?.sandboxCodePushedAt, session?.sandboxFilesUpdatedAt])

  // Reset complete code tab when displayed task changes
  useEffect(() => {
    setTeacherCodeTab('starter')
  }, [currentTaskId, previewTaskId])

  async function handleTaskChange(taskId) {
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
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode({
        lesson, taskId: currentTaskId, session,
        draftCode: sandboxDraftRef.current.code, currentCode: code,
      }))
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch({
        lesson, taskId: currentTaskId, session,
        draftState: sandboxDraftRef.current.scratchState, currentState: scratchState,
      }))
    } else if (lesson.type === 'filesystem') {
      setFsState(getSandboxStarterFs({
        lesson, taskId: currentTaskId, session,
        draftFs: sandboxDraftRef.current.fs, currentFs: fsState,
      }))
    } else {
      const starterFiles = getSandboxStarterFiles({
        lesson, taskId: currentTaskId, session,
        draftFiles: sandboxDraftRef.current.files, currentFiles: files,
      })
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
    setSandboxStaging(true)
  }

  function handleCancelSandbox() {
    setSandboxStaging(false)
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleGoLiveSandbox() {
    if (lesson.type === 'python') {
      sandboxDraftRef.current.code = code
      await enterSandbox({ code })
    } else if (lesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
      await enterSandbox({ code: JSON.stringify(scratchState ?? {}) })
    } else if (lesson.type === 'filesystem') {
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(fsState))
      await enterSandbox({ code: JSON.stringify(fsState) })
    } else {
      sandboxDraftRef.current.files = cloneFiles(files)
      await enterSandbox({ files })
    }
    setSandboxStaging(false)
  }

  async function handlePushSandbox() {
    if (lesson.type === 'python') {
      sandboxDraftRef.current.code = code
      await pushSandboxCode(code)
    } else if (lesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
      await pushSandboxCode(JSON.stringify(scratchState ?? {}))
    } else if (lesson.type === 'filesystem') {
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(fsState))
      await pushSandboxCode(JSON.stringify(fsState))
    } else {
      sandboxDraftRef.current.files = cloneFiles(files)
      await pushSandboxFiles(files)
    }
  }

  async function handleResetSandboxStarter() {
    if (lesson.type === 'python') {
      const starterCode = getSandboxConfiguredCode({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.code = starterCode
      setCode(starterCode)
      if (isSandbox) await pushSandboxCode(starterCode)
    } else if (lesson.type === 'scratch') {
      const starterScratch = getSandboxConfiguredScratch({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.scratchState = cloneScratchState(starterScratch)
      setScratchState(starterScratch)
      if (isSandbox) await pushSandboxCode(JSON.stringify(starterScratch ?? {}))
    } else if (lesson.type === 'filesystem') {
      const starterFs = getSandboxConfiguredFs({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.fs = JSON.parse(JSON.stringify(starterFs))
      setFsState(starterFs)
      if (isSandbox) await pushSandboxCode(JSON.stringify(starterFs))
    } else {
      const starterFiles = getSandboxConfiguredFiles({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.files = cloneFiles(starterFiles)
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
      if (isSandbox) await pushSandboxFiles(starterFiles)
    }
  }

  async function handleDeactivateSandbox() {
    if (lesson.type === 'python') sandboxDraftRef.current.code = code
    else if (lesson.type === 'scratch') sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
    else sandboxDraftRef.current.files = cloneFiles(files)
    setSandboxStaging(false)
    await exitSandbox()
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleEndSession(goHome) {
    await endSession()
    presentationWindowRef.current?.close()
    presentationWindowRef.current = null
    setShowEndModal(false)
    if (goHome) navigate('/')
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

  async function handleCopyLink(type) {
    const url = getLessonLinks(lessonId)[type]
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
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
  const currentTask = flatTasks.find(t => t.id === (session?.currentTaskId ?? currentTaskId))
  const displayIndex = flatTasks.findIndex(t => t.id === displayTaskId)
  const showingComplete = teacherCodeTab === 'complete' && !isInSandbox
  const teacherStageMatch = teacherCodeTab.match(/^stage_(\d+)$/)
  const teacherActiveStageIndex = teacherStageMatch ? parseInt(teacherStageMatch[1], 10) : null
  const isShowingStage = teacherActiveStageIndex !== null && !isInSandbox
  const taskCodeStages = task?.codeStages ?? []
  const activeTeacherStage = isShowingStage ? (taskCodeStages[teacherActiveStageIndex] ?? null) : null
  const isInformationTask = task?.taskType === 'information'
  const students = session ? Object.entries(session.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id })) : []
  const joiningCount = Object.keys(session?.joiningStudents ?? {}).length
  const isPreviewing = previewTaskId !== null && !isInSandbox

  async function handleSendStageToAll(action) {
    const studentIds = Object.keys(session?.students ?? {})
    await Promise.all(studentIds.map(id => pushResetToStudent(id, action)))
  }

  const onCodeChange = (showingComplete || isShowingStage || !isInSandbox) ? undefined
    : value => { setCode(value); sandboxDraftRef.current.code = value }

  const onFilesChange = (showingComplete || isShowingStage || !isInSandbox) ? undefined
    : (name, content) => setFiles(prev => {
      const next = prev.map(f => f.name === name ? { ...f, content } : f)
      sandboxDraftRef.current.files = cloneFiles(next)
      return next
    })

  const onScratchChange = !isInSandbox ? undefined
    : state => { setScratchState(state); sandboxDraftRef.current.scratchState = cloneScratchState(state) }

  const onFsChange = !isInSandbox ? undefined
    : newFs => { setFsState(newFs); sandboxDraftRef.current.fs = newFs }

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
          <TeacherSessionControls
            session={session}
            isInSandbox={isInSandbox}
            displayIndex={displayIndex}
            taskCount={flatTasks.length}
            links={getLessonLinks(lessonId)}
            copiedLink={copiedLink}
            showSharePanel={showSharePanel}
            onPreviousTask={() => {
              if (displayIndex > 0) handlePreviewTask(flatTasks[displayIndex - 1].id)
            }}
            onNextTask={() => {
              if (displayIndex < flatTasks.length - 1) handlePreviewTask(flatTasks[displayIndex + 1].id)
            }}
            onOpenPresentationWindow={handleOpenPresentationWindow}
            onOpenFeedback={() => setShowFeedbackModal(true)}
            onToggleSharePanel={() => setShowSharePanel(v => !v)}
            onCloseSharePanel={() => setShowSharePanel(false)}
            onCopyLink={handleCopyLink}
            onStartSession={startSession}
            onTogglePaused={() => setPaused(!session?.isPaused)}
            onEndSession={() => setShowEndModal(true)}
            onRestartSession={restartSession}
          />
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
        <main style={{ ...s.centre, ...(isInformationTask || lesson.type === 'html' || lesson.type === 'scratch' || lesson.type === 'filesystem' ? { overflow: 'hidden' } : {}) }}>
          {task?.explainer && !isInSandbox && task?.taskType !== 'quiz' && !isInformationTask && (
            <ExplainerPanel title={task.title} content={task.explainer} topicType={lesson.type} />
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
            <TeacherSandboxBanner
              staging={sandboxStaging}
              onCancel={handleCancelSandbox}
              onReset={handleResetSandboxStarter}
              onGoLive={handleGoLiveSandbox}
              onPush={handlePushSandbox}
              onDeactivate={handleDeactivateSandbox}
              sandboxExplainer={session?.sandboxExplainer ?? ''}
              onPushExplainer={pushSandboxExplainer}
              lessonType={lesson.type}
            />
          )}

          <TeacherEditorPanel
            lesson={lesson}
            task={task}
            displayTaskId={displayTaskId}
            isInSandbox={isInSandbox}
            isInformationTask={isInformationTask}
            showingComplete={showingComplete}
            isShowingStage={isShowingStage}
            activeTeacherStage={activeTeacherStage}
            taskCodeStages={taskCodeStages}
            teacherCodeTab={teacherCodeTab}
            setTeacherCodeTab={setTeacherCodeTab}
            hasStudents={students.length > 0}
            onSendStageToAll={handleSendStageToAll}
            code={code}
            onCodeChange={onCodeChange}
            files={files}
            onFilesChange={onFilesChange}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            activeCompleteFile={activeCompleteFile}
            setActiveCompleteFile={setActiveCompleteFile}
            scratchState={scratchState}
            onScratchChange={onScratchChange}
            fsState={fsState}
            onFsChange={onFsChange}
            onActivity={setEditorActivity}
          />
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
    </div>
  )
}

// ─── Teacher editor panel (lesson.type dispatch) ─────────────────────────────

function TeacherEditorPanel({
  lesson, task, displayTaskId,
  isInSandbox, isInformationTask,
  showingComplete, isShowingStage, activeTeacherStage, taskCodeStages,
  teacherCodeTab, setTeacherCodeTab,
  hasStudents, onSendStageToAll,
  code, onCodeChange,
  files, onFilesChange,
  activeFile, setActiveFile,
  activeCompleteFile, setActiveCompleteFile,
  scratchState, onScratchChange,
  fsState, onFsChange,
  onActivity,
}) {
  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets(lesson.type === 'html' ? 'html' : null)
  const htmlSharedAssetNames = lesson.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const htmlStorageAssets = [
    ...(lesson.storageAssets ?? []).filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !(lesson.storageAssets ?? []).some(b => b.name === a.name)),
  ]

  if (!isInSandbox && isInformationTask) return <InformationTask task={task} lesson={lesson} fill />
  if (!isInSandbox && task?.taskType === 'quiz') return <QuizTask task={task} showQuestion disabled />

  if (lesson.type === 'python') return (
    <div style={!isInSandbox ? s.codeWorkspaceStack : undefined}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={i => setTeacherCodeTab(`stage_${i}`)}
          onComplete={() => { setTeacherCodeTab('complete'); setActiveCompleteFile(task?.completeFiles?.[0]?.name ?? '') }}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
        />
      )}
      <PythonEditor
        code={showingComplete ? (task?.completeCode ?? '') : isShowingStage ? (activeTeacherStage?.code ?? '') : code}
        onChange={onCodeChange}
        onActivity={onActivity}
        readOnly={showingComplete || isShowingStage || !isInSandbox}
        pyodideStatus="idle"
        editorStyle={isInSandbox ? undefined : s.attachedCodeEditor}
      />
    </div>
  )

  if (lesson.type === 'scratch') return (
    <div style={!isInSandbox ? s.codeWorkspaceStack : s.scratchWrap}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={i => setTeacherCodeTab(`stage_${i}`)}
          onComplete={task?.completeBlocks ? () => setTeacherCodeTab('complete') : undefined}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
          starterLabel="Starter blocks"
          completeLabel="Complete blocks"
        />
      )}
      <div style={s.scratchWrap}>
        <ScratchWorkspace
          key={`teacher-scratch-${displayTaskId}-${isInSandbox ? 'sandbox' : 'task'}`}
          task={task}
          unrestricted={isInSandbox}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          initialState={scratchState}
          externalState={isInSandbox ? scratchState : showingComplete ? (task?.completeBlocks ?? null) : isShowingStage ? (activeTeacherStage?.blocks ?? null) : (task?.starterBlocks ?? null)}
          readOnly={!isInSandbox}
          hideStage
          onStateChange={onScratchChange}
        />
      </div>
    </div>
  )

  if (lesson.type === 'filesystem') return (
    <div style={!isInSandbox ? s.codeWorkspaceStack : undefined}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={i => setTeacherCodeTab(`stage_${i}`)}
          onComplete={task?.completeFs ? () => setTeacherCodeTab('complete') : undefined}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
          starterLabel="Starter folders"
          completeLabel="Complete folders"
        />
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FilesystemTask
          key={`teacher-fs-${displayTaskId}-${isInSandbox ? 'sandbox' : teacherCodeTab}`}
          fs={isInSandbox ? fsState : showingComplete ? (task?.completeFs ?? DEFAULT_FS) : isShowingStage ? (activeTeacherStage?.fs ?? DEFAULT_FS) : (task?.starterFs ?? DEFAULT_FS)}
          onFsChange={onFsChange}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          assets={lesson.assets}
          disabled={!isInSandbox}
        />
      </div>
    </div>
  )

  return (
    <div style={!isInSandbox ? s.codeWorkspaceStack : s.htmlLeft}>
      {!isInSandbox && (
        <TeacherCodeTabs
          activeTab={teacherCodeTab}
          stages={taskCodeStages}
          onStarter={() => setTeacherCodeTab('starter')}
          onStage={i => setTeacherCodeTab(`stage_${i}`)}
          onComplete={() => { setTeacherCodeTab('complete'); setActiveCompleteFile(task?.completeFiles?.[0]?.name ?? '') }}
          onSendToAll={onSendStageToAll}
          hasStudents={hasStudents}
        />
      )}
      <div style={s.htmlLeft}>
        <HtmlEditor
          files={showingComplete ? (task?.completeFiles ?? []) : isShowingStage ? (activeTeacherStage?.files ?? []) : files}
          activeFile={showingComplete ? activeCompleteFile : activeFile}
          onTabChange={showingComplete ? setActiveCompleteFile : setActiveFile}
          onFileChange={onFilesChange}
          onActivity={onActivity}
          readOnly={showingComplete || isShowingStage || !isInSandbox}
          assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
          assets={lesson.assets}
          storageAssets={htmlStorageAssets}
          attachedTop={!isInSandbox}
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
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 0,
  },
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
  attachedCodeEditor: {
    borderRadius: '0 0 8px 8px',
  },
  previewBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    borderRadius: 8,
    padding: '10px 14px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  previewBannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#1e40af',
  },
  previewBannerBtn: {
    fontSize: 13,
    padding: '5px 12px',
  },
  sandboxBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '10px 14px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  sandboxBannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#92400e',
  },
  sandboxBannerBtn: {
    fontSize: 13,
    padding: '5px 12px',
  },
  right: {
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    overflow: 'auto',
  },
}
