import React, { useEffect, useState, useRef, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSession } from '../hooks/useSession'
import { findTaskById, flattenTasks, filterTasksByMode } from '../../shared/taskUtils'
import {
  applyLessonOverride,
  publishLessonTasks,
  saveSessionReport,
} from '../../shared/lessonService'
import { prepareClassroomLesson } from '../studentTaskContent'
import { listJoiningStudents } from '../joiningStudents'
import { attachTeacherFeedback, buildSessionReport } from '../../shared/lessonReport'
import { decodeLessonFromFirestore } from '../../shared/lessonBlocksCodec'
import EditLessonModal from '../components/EditLessonModal'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import ExplainerPanel from '../components/ExplainerPanel'
import TaskSlideTransition from '../components/TaskSlideTransition'
import { usePreloadNeighbourImages } from '../../shared/preloadImages'
import StudentGrid from '../components/StudentGrid'
import TeacherTimers from '../components/TeacherTimers'
import TeacherSessionControls from '../components/TeacherSessionControls'
import TeacherPreviewBanner from '../components/TeacherPreviewBanner'
import TeacherSandboxBanner from '../components/TeacherSandboxBanner'
import TeacherEndSessionModal from '../components/TeacherEndSessionModal'
import TeacherFeedbackModal from '../components/TeacherFeedbackModal'
import TeacherReportModal from '../components/TeacherReportModal'
import TeacherReportsPanel from '../components/TeacherReportsPanel'
import CheckConditionsPanel from './teacher/CheckConditionsPanel'
import TaskRatingPanel from './teacher/TaskRatingPanel'
import BadgeSuggestionsPanel from './teacher/BadgeSuggestionsPanel'
import TeacherEditorPanel from './teacher/TeacherEditorPanel'
import { cloneFiles } from '../../shared/workspaceData'
import {
  cloneSandboxWork,
  hasSandboxWork,
  initialSandboxWorkByKind,
  onSandboxFilesChannel,
  readSessionSandboxWork,
  restoreSandboxWork,
  sandboxCodeFor,
  sandboxStarterWork,
  sandboxWireFields,
  sandboxWorkKind,
  taskStarterWork,
} from '../teacherSandboxWork'
import {
  getEffectiveLessonForModule,
  getEffectiveLessonForTask,
  getLessonModules,
  getTaskModuleId,
  isCodeTask,
  isComposedLesson,
} from '../../shared/composedLesson'
import {
  allowsStudentBroadcast,
  getTaskActivity,
  isHostedActivityTask,
} from '../../activities/registry.pure.js'
import { useTopicLibrary } from '../../shared/topicLibrary'
import { buildStudentLivePayload } from '../teacherLivePayload'
import { getModuleDefinition } from '../../modules/definitions'
import PaneFocusDropdown from '../components/student-modal/PaneFocusDropdown'
import SharedWorkspaceViewer from '../components/SharedWorkspaceViewer'
import { describeShareError } from '../sharedWorkspacePayload'
import { useSandboxArchiveSnapshots } from '../hooks/useSandboxArchiveSnapshots'
import { useBadgeAutoAward, useBadgeSuggestions } from '../hooks/useBadgeSuggestions'
import { useBadgeCatalogue } from '../hooks/useBadgeCatalogue'
import { firstViewKey } from '../../shared/motion'

function canRecordAdvanceOverride(task) {
  if (!task || task.taskType === 'information') return false
  // An activity that is never marked (a confidence rating, an unmarked short answer, the
  // unknown-activity fallback) has nothing to advance past.
  const activity = getTaskActivity(task)
  if (activity && (activity.completion === 'none' || !activity.isGraded(task))) return false
  return true
}

export default function TeacherView({ lessonId }) {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const {
    session,
    loading,
    createSession,
    restartSession,
    startSession,
    endSession,
    setTaskId,
    enterSandbox,
    exitSandbox,
    pushSandboxCode,
    pushSandboxFiles,
    pushSandboxExplainer,
    pushLessonOverride,
    clearLessonOverride,
    setPaused,
    requestFullscreenForAll,
    requestFullscreenForStudent,
    nudgeStudent,
    sendThumbsUp,
    showResponse,
    hideResponse,
    setShownResponseName,
    nudgeAwayStudents,
    admitJoiningStudent,
    setAutoRevealStage,
    setActiveStudentView,
    setTeacherLive,
    renameStudent,
    removeStudent,
    pushResetToStudent,
    pushTeacherAnswerEdit,
    pushRemoteRun,
    overrideStudentCheck,
    recordClassAdvanceOverrides,
    dismissHelp,
    readPendingShare,
    approveWorkspaceShare,
    declineWorkspaceShare,
    requestShareSnapshot,
    removeSharedWorkspace,
    removeAllSharedWorkspaces,
    readSharedWorkspace,
    sendToTopic,
    sendMessageToStudent,
    updateVideoCallLink,
    sendVideoCallLink,
    broadcastVideoCallLink,
    serverTimeOffset,
    startClassCountdown,
    addClassCountdownTime,
    clearClassCountdown,
    launchPoll,
    closePoll,
    setPollShowResults,
    dismissPoll,
    requestTeacherEdit,
    pushTeacherLiveCode,
    commitTeacherEdit,
    cancelTeacherEdit,
    requestTeacherStage,
    clearTeacherStage,
    pushTeacherHighlight,
    removeTeacherHighlight,
    recordSupportStageReveal,
    setTaskRating,
    setTeacherLiveReferenceForStudent,
    setTeacherLiveReferenceForClass,
    pushTeacherPaneCommand,
    pushClassPaneCommand,
    archiveSandboxStudentSnapshot,
    readSessionArchive,
    decideBadge,
    revokeBadge,
    setBadgeSettings,
  } = useSession(lessonId)

  // While the class is in the teacher sandbox, each student's latest sandbox run is copied into
  // the session archive for the report (the sandbox is no longer thrown away).
  useSandboxArchiveSnapshots({ session, archiveSandboxStudentSnapshot })

  const [baseLesson, setBaseLesson] = useState(null)
  // The authored lesson (with any session override) is what the Edit Lesson modal edits and
  // saves; everything else uses the classroom copy with line-hint markers stripped.
  const authoredLesson = useMemo(
    () => applyLessonOverride(baseLesson, session?.lessonOverrideTasks),
    [baseLesson, session?.lessonOverrideTasks]
  )
  const lesson = useMemo(() => prepareClassroomLesson(authoredLesson), [authoredLesson])
  const [lessonLoading, setLessonLoading] = useState(true)
  const { topics } = useTopicLibrary(isComposedLesson(lesson) ? null : lesson?.type, !!lesson)
  // Live badge suggestions, recomputed from the session (never stored), and the tutor's
  // auto-award toggle. The suggestions panel and card counts read `badgeSuggestions`.
  const badgeSuggestions = useBadgeSuggestions({ session, lesson, topics })
  useBadgeAutoAward({
    suggestions: badgeSuggestions.suggestions,
    settings: session?.badgeSettings,
    decideBadge,
  })
  // The Admin badge catalogue (manual-only badges), read once: the picker, cards, Badge Summary
  // wall and report resolve catalogue badge ids through it.
  const catalogueBadges = useBadgeCatalogue(!!user)
  // The Badge Summary task's class wall, on the teacher's screen.
  const teacherBadgeWall = useMemo(
    () => ({
      decisions: session?.badges ?? {},
      students: session?.students ?? {},
      variant: 'teacher',
      catalogueBadges,
    }),
    [session?.badges, session?.students, catalogueBadges]
  )
  // The suggestions panel's open state lives here so the grid's 🏅 Suggestions button can open
  // and focus it (bumping badgePanelFocus).
  const [badgePanelOpen, setBadgePanelOpen] = useState(false)
  const [badgePanelFocus, setBadgePanelFocus] = useState(0)
  const [lessonError, setLessonError] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(1)
  // previewTaskId: non-null while the teacher is previewing a task locally without moving students
  const [previewTaskId, setPreviewTaskId] = useState(null)
  const [showEndModal, setShowEndModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showEditLessonModal, setShowEditLessonModal] = useState(false)
  const [lastReport, setLastReport] = useState(null)
  const [showReportsPanel, setShowReportsPanel] = useState(false)
  // The teacher-sandbox archive for the in-progress report, read once each time the Reports
  // panel opens during a session (null until it loads; the preview leaves the sandbox out).
  const [liveReportArchive, setLiveReportArchive] = useState(null)
  const liveReportOpen =
    showReportsPanel && (session?.state === 'active' || session?.state === 'sandbox')
  useEffect(() => {
    if (!liveReportOpen) return undefined
    let cancelled = false
    setLiveReportArchive(null)
    readSessionArchive()
      .then((archive) => {
        if (!cancelled) setLiveReportArchive(archive)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // Read once per opening; readSessionArchive changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveReportOpen])
  // The teacher's own read-only look at an approved share — same gallery students get,
  // opened from TeacherSessionControls' "Shared work" dropdown.
  const [openTeacherShare, setOpenTeacherShare] = useState(null)
  const [teacherShareError, setTeacherShareError] = useState(null)
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 860)
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1100)
  // The work the teacher's editor shows, one value per sandbox kind
  // (`capabilities.sandboxState`: 'code', 'blocks', 'fs', 'desktop', 'files'), each in the
  // module's stored-work form — see ../teacherSandboxWork.js.
  const [workByKind, setWorkByKind] = useState(initialSandboxWorkByKind)
  const [sandboxStaging, setSandboxStaging] = useState(false)
  const [teacherCodeTab, setTeacherCodeTab] = useState('starter')
  const [sandboxModuleId, setSandboxModuleId] = useState(null)
  // The teacher's sandbox work per kind, kept across staging, going live and leaving (absent =
  // none yet).
  const sandboxDraftRef = useRef({})
  const presentationWindowRef = useRef(null)

  // Load lesson from Firestore
  useEffect(() => {
    let cancelled = false
    getDoc(doc(firestore, 'lessons', lessonId))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          setBaseLesson(decodeLessonFromFirestore(snap.data()))
        } else {
          setLessonError(true)
        }
        setLessonLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLessonError(true)
          setLessonLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
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
    const task = flattenTasks(lesson?.tasks ?? []).find((t) => t.id === taskId)
    if (!task) return
    const taskLesson = getEffectiveLessonForTask(lesson, task)
    // The displayed task's Starter-tab work, in its module's sandbox kind: workSlot.teacherStarter
    // (electronics shows `starterCircuit`, not a starter stage's circuit).
    if (task.taskType === 'information' || isHostedActivityTask(task)) {
      setKindWork({ code: '', files: [], blocks: null })
    } else {
      const definition = getModuleDefinition(taskLesson.type)
      setKindWork({ [sandboxWorkKind(definition)]: taskStarterWork(definition, task) })
    }
  }

  function setKindWork(updates) {
    setWorkByKind((prev) => ({ ...prev, ...updates }))
  }

  // The sandbox module's effective lesson, definition and work kind. A composed lesson resolves
  // the module (getEffectiveLessonForModule), never the raw lesson type.
  function sandboxDefinitionFor(moduleId) {
    const activeSandboxLesson = getEffectiveLessonForModule(lesson, moduleId) ?? lesson
    const definition = getModuleDefinition(activeSandboxLesson.type)
    return { activeSandboxLesson, definition, kind: sandboxWorkKind(definition) }
  }

  // Load task content when displayed task changes (preview or session task)
  useEffect(() => {
    if (sandboxStaging || session?.state === 'sandbox') return
    loadCurrentTaskContent(previewTaskId ?? currentTaskId)
  }, [currentTaskId, previewTaskId, lesson, sandboxStaging, session?.state])

  // Restore sandbox state when teacher opens/reloads while sandbox is live.
  // Also used when entering sandbox — see applySandboxStarterState() below.
  function applySandboxStarterState(moduleId = sandboxModuleId) {
    const task = flattenTasks(lesson?.tasks ?? []).find((t) => t.id === currentTaskId)
    const resolvedModuleId =
      moduleId ?? getTaskModuleId(lesson, task) ?? getLessonModules(lesson)[0]?.id ?? null
    const { activeSandboxLesson, definition, kind } = sandboxDefinitionFor(resolvedModuleId)
    // The teacher's draft, else the live session's work, else the configured starter.
    const work =
      [sandboxDraftRef.current[kind], readSessionSandboxWork(definition, session)].find(
        (candidate) => hasSandboxWork(definition, candidate)
      ) ?? sandboxStarterWork(definition, activeSandboxLesson, task)
    setKindWork({ [kind]: restoreSandboxWork(definition, work) })
  }

  useEffect(() => {
    if (!lesson || sandboxStaging || session?.state !== 'sandbox') return
    applySandboxStarterState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lesson,
    sandboxStaging,
    session?.state,
    session?.sandboxCodePushedAt,
    session?.sandboxFilesUpdatedAt,
  ])

  // Reset complete code tab when displayed task changes
  useEffect(() => {
    setTeacherCodeTab('starter')
  }, [currentTaskId, previewTaskId])

  // Fall back off the Live tab if Presentation View's broadcast for the displayed task ends
  // (window closed, task changed there, etc.) — the tab itself disappears once this happens,
  // so staying on 'live' would otherwise leave the editor showing a stale/empty snapshot.
  useEffect(() => {
    if (teacherCodeTab !== 'live') return
    const displayedTaskId = previewTaskId ?? currentTaskId
    const stillLive =
      session?.teacherLiveReference?.active &&
      session.teacherLiveReference.taskId === displayedTaskId
    if (!stillLive) setTeacherCodeTab('starter')
  }, [
    teacherCodeTab,
    previewTaskId,
    currentTaskId,
    session?.teacherLiveReference?.active,
    session?.teacherLiveReference?.taskId,
  ])

  async function handleTaskChange(taskId) {
    const leavingTaskId = session?.currentTaskId ?? currentTaskId
    const leavingTask = flatTasks.find((t) => t.id === leavingTaskId)
    if (
      session?.state === 'active' &&
      taskId !== leavingTaskId &&
      canRecordAdvanceOverride(leavingTask)
    ) {
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
    const currentTask = flattenTasks(lesson?.tasks ?? []).find((task) => task.id === currentTaskId)
    const initialModuleId = isComposedLesson(lesson)
      ? (getTaskModuleId(lesson, currentTask) ?? getLessonModules(lesson)[0]?.id ?? null)
      : null
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
    const { definition, kind } = sandboxDefinitionFor(sandboxModuleId)
    const sandboxTask = isComposedLesson(lesson)
      ? flattenTasks(lesson?.tasks ?? []).find(
          (task) => getTaskModuleId(lesson, task) === sandboxModuleId && isCodeTask(task)
        )
      : null
    if (sandboxTask && sandboxTask.id !== currentTaskId) {
      setCurrentTaskId(sandboxTask.id)
      await setTaskId(sandboxTask.id)
    }
    const work = workByKind[kind]
    sandboxDraftRef.current[kind] = cloneSandboxWork(definition, work)
    await enterSandbox({ ...sandboxWireFields(definition, work), previousTaskId })
    setSandboxStaging(false)
  }

  // Writes the work to the session on the module's wire channel (sandboxCode / sandboxFiles).
  async function pushSandboxWork(definition, work) {
    if (onSandboxFilesChannel(definition)) await pushSandboxFiles(work)
    else await pushSandboxCode(sandboxCodeFor(definition, work))
  }

  async function handlePushSandbox() {
    const { definition, kind } = sandboxDefinitionFor(sandboxModuleId)
    const work = workByKind[kind]
    sandboxDraftRef.current[kind] = cloneSandboxWork(definition, work)
    await pushSandboxWork(definition, work)
  }

  async function handleResetSandboxStarter() {
    const { activeSandboxLesson, definition, kind } = sandboxDefinitionFor(sandboxModuleId)
    const task = flattenTasks(lesson?.tasks ?? []).find((t) => t.id === currentTaskId)
    const configured = sandboxStarterWork(definition, activeSandboxLesson, task)
    sandboxDraftRef.current[kind] = cloneSandboxWork(definition, configured)
    setKindWork({ [kind]: restoreSandboxWork(definition, configured) })
    if (isSandbox) await pushSandboxWork(definition, configured)
  }

  async function handleDeactivateSandbox() {
    const { definition, kind } = sandboxDefinitionFor(sandboxModuleId)
    sandboxDraftRef.current[kind] = cloneSandboxWork(definition, workByKind[kind])
    setSandboxStaging(false)
    const restoredTaskId = session?.sandboxPreviousTaskId ?? currentTaskId
    await exitSandbox()
    setCurrentTaskId(restoredTaskId)
    loadCurrentTaskContent(restoredTaskId)
  }

  // The report's live-badge inputs besides the session: the suggestions still pending (counted
  // in badgeSummary) and the Topic Library's titles.
  function sessionReportInputs(sessionArchive = null) {
    return {
      session,
      lesson,
      sessionArchive,
      pendingSuggestions: badgeSuggestions.suggestions,
      topics,
      catalogueBadges,
    }
  }

  async function handleEndSession(goHome) {
    // The teacher-sandbox archive is read before the report is built, and the report is saved
    // before endSession wipes the live data. A failed archive read leaves the sandbox out rather
    // than losing the report.
    let report = null
    if (session?.startedAt) {
      const sessionArchive = await readSessionArchive({ endedAt: Date.now() }).catch(() => null)
      report = buildSessionReport(sessionReportInputs(sessionArchive))
    }
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
    if (updatedReport !== lastReport)
      await saveSessionReport(lessonId, updatedReport.sessionId, updatedReport)
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
    setBaseLesson((prev) => ({ ...prev, tasks }))
    if (rtdbResult.status === 'rejected') {
      throw new Error(
        'Lesson saved — but failed to update the live session: ' + rtdbResult.reason?.message
      )
    }
  }

  async function handleResetLessonOverride() {
    await clearLessonOverride()
  }

  async function handleGoLiveForMe(studentId) {
    await setTeacherLive(null)
    await setActiveStudentView(studentId)
  }

  // mode 'panel' shows the work to the class without locking anyone's editor.
  async function handleGoLiveForAll(student, mode) {
    // Quiz and activity tasks only allow the teacher's own broadcast (Presentation View).
    const liveTask = findTaskById(lesson?.tasks, session?.currentTaskId ?? currentTaskId)
    if (!allowsStudentBroadcast(liveTask)) return
    await setActiveStudentView(student.anonymousId)
    await setTeacherLive(
      buildStudentLivePayload({
        student,
        lesson,
        taskId: session?.currentTaskId ?? currentTaskId,
        entryFileTaskId: session?.currentTaskId,
        mode,
      })
    )
  }

  async function handleStopStudentLive() {
    await setTeacherLive(null)
    await setActiveStudentView(null)
  }

  function handleOpenPresentationWindow() {
    const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    presentationWindowRef.current = window.open(
      `${base}?teacher=true&present=true`,
      `headstart-present-${lessonId}`,
      'popup=yes,width=1280,height=800'
    )
  }

  async function handleOpenTeacherShare(entry) {
    setTeacherShareError(null)
    try {
      const snapshot = await readSharedWorkspace(entry.shareId)
      if (!snapshot) {
        setTeacherShareError('That shared workspace is no longer available.')
        return
      }
      setOpenTeacherShare({ entry, snapshot })
    } catch (err) {
      setTeacherShareError(describeShareError(err))
    }
  }

  const isSandbox = session?.state === 'sandbox'
  const isInSandbox = isSandbox || sandboxStaging
  const visibleTasks = filterTasksByMode(lesson?.tasks ?? [], 'live')
  const flatTasks = flattenTasks(visibleTasks)
  // displayTaskId: what the teacher's centre panel is currently showing
  const displayTaskId = previewTaskId ?? currentTaskId
  const task = flatTasks.find((t) => t.id === displayTaskId)
  const displayedLesson = getEffectiveLessonForTask(lesson, displayTaskId)
  const lessonModules = getLessonModules(lesson)
  const activeSandboxModuleId =
    sandboxModuleId ?? getTaskModuleId(lesson, task) ?? lessonModules[0]?.id ?? null
  const sandboxLesson = getEffectiveLessonForModule(lesson, activeSandboxModuleId)
  const editorLesson = isInSandbox ? sandboxLesson : displayedLesson
  const currentTask = flatTasks.find((t) => t.id === (session?.currentTaskId ?? currentTaskId))
  const displayIndex = flatTasks.findIndex((t) => t.id === displayTaskId)
  // Next / Back in the teacher's navigator find the neighbouring tasks' images already loaded.
  usePreloadNeighbourImages(lesson, flatTasks, displayIndex)
  const teacherStageMatch = teacherCodeTab.match(/^stage_(\d+)$/)
  const teacherActiveStageIndex = teacherStageMatch ? parseInt(teacherStageMatch[1], 10) : null
  const taskCodeStages = task?.codeStages ?? []
  const activeTeacherStage =
    teacherActiveStageIndex !== null && !isInSandbox
      ? (taskCodeStages[teacherActiveStageIndex] ?? null)
      : null
  const isInformationTask = task?.taskType === 'information'
  const students = session
    ? Object.entries(session.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id }))
    : []
  const joiningStudents = useMemo(
    () => listJoiningStudents(session?.joiningStudents),
    [session?.joiningStudents]
  )
  const isPreviewing = previewTaskId !== null && !isInSandbox

  async function handleSendStageToAll(action) {
    const studentIds = Object.keys(session?.students ?? {})
    await Promise.all(studentIds.map((id) => pushResetToStudent(id, action)))
  }

  async function handleSendTopicToAll(topicId) {
    const studentIds = Object.keys(session?.students ?? {})
    await Promise.all(studentIds.map((id) => sendToTopic(id, topicId)))
  }

  async function handleSendToIndividual(topicId, studentId) {
    await sendToTopic(studentId, topicId)
  }

  // What the teacher's editor shows and edits: the editor module's work (a files module's with
  // the displayed task's entry file). In the sandbox every edit is also the draft.
  const editorDefinition = getModuleDefinition(editorLesson?.type)
  const editorKind = sandboxWorkKind(editorDefinition)
  const editorOnFilesChannel = onSandboxFilesChannel(editorDefinition)
  const liveState = editorOnFilesChannel
    ? { files: workByKind[editorKind], entryFile: task?.entryFile ?? 'index.html' }
    : workByKind[editorKind]

  const onChange = !isInSandbox
    ? undefined
    : editorOnFilesChannel
      ? (name, content) =>
          setWorkByKind((prev) => {
            const next = prev[editorKind].map((f) => (f.name === name ? { ...f, content } : f))
            sandboxDraftRef.current[editorKind] = cloneFiles(next)
            return { ...prev, [editorKind]: next }
          })
      : (value) => {
          setKindWork({ [editorKind]: value })
          sandboxDraftRef.current[editorKind] = cloneSandboxWork(editorDefinition, value)
        }

  if (lessonLoading) {
    return (
      <div style={s.centre}>
        <p>Loading…</p>
      </div>
    )
  }
  if (lessonError || !lesson) {
    return (
      <div style={s.centre}>
        <p>Lesson &ldquo;{lessonId}&rdquo; not found.</p>
      </div>
    )
  }

  // Fill-height module workspaces (capabilities.teacherFillHeight) are sized to the centre
  // column, which clips instead of scrolling. Everything else scrolls the column,
  // and the editor must then keep its own minimum height rather than collapsing
  // under the panels around it (BadgeSuggestionsPanel, CheckConditionsPanel) — see
  // TeacherEditorPanel's `fillHeight` prop.
  const centreFillsHeight =
    (isInformationTask ||
      !!getModuleDefinition(displayedLesson.type)?.capabilities.teacherFillHeight) &&
    !(currentTask?.check != null && !isInSandbox)

  return (
    <div style={s.page}>
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        isSandbox={isSandbox}
        right={
          <>
            {/* A popover from the top bar, not a panel in <main>, so it never resizes the
                task workspace (see TaskRatingPanel). */}
            {task && !isInformationTask && !isInSandbox && (
              <TaskRatingPanel
                taskId={task.id}
                taskTitle={task.title}
                existingRating={session?.taskRatingLog?.[task.id] ?? null}
                onSave={setTaskRating}
              />
            )}
            {/* Information and activity/quiz tasks have no explainer or workspace panes to
                focus (a sandbox parked on an activity still shows the workspace). */}
            {session && !isInformationTask && (isInSandbox || !isHostedActivityTask(task)) && (
              <PaneFocusDropdown
                label="Focus Class"
                lessonType={editorLesson?.type}
                onHighlight={(panes) => pushClassPaneCommand({ mode: 'highlight', panes })}
                onForce={(panes) => pushClassPaneCommand({ mode: 'force', panes })}
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
              onBroadcastVideoCallLink={broadcastVideoCallLink}
              onRemoveSharedWorkspace={removeSharedWorkspace}
              onRemoveAllSharedWorkspaces={removeAllSharedWorkspaces}
              onOpenSharedWorkspace={handleOpenTeacherShare}
              serverTimeOffset={serverTimeOffset}
              onStartClassCountdown={startClassCountdown}
              onAddClassCountdownTime={addClassCountdownTime}
              onClearClassCountdown={clearClassCountdown}
              onLaunchPoll={launchPoll}
              onClosePoll={closePoll}
              onSetPollShowResults={setPollShowResults}
              onDismissPoll={dismissPoll}
            />
          </>
        }
      />
      <TeacherTimers
        session={session}
        task={currentTask}
        tasks={visibleTasks}
        serverTimeOffset={serverTimeOffset}
      />

      <div
        style={{
          ...s.body,
          gridTemplateColumns: `${leftCollapsed ? '40px' : '220px'} 1fr ${rightCollapsed ? '40px' : '280px'}`,
        }}
      >
        {/* Left — Task Navigator */}
        <aside style={s.left}>
          <TaskNavigator
            tasks={visibleTasks}
            currentTaskId={currentTaskId}
            previewTaskId={previewTaskId}
            session={session}
            students={students}
            onTaskSelect={handlePreviewTask}
            onSandbox={
              isSandbox
                ? handleDeactivateSandbox
                : sandboxStaging
                  ? handleCancelSandbox
                  : handleEnterSandbox
            }
            isSandbox={isSandbox}
            sandboxStaging={sandboxStaging}
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed((v) => !v)}
          />
        </aside>

        {/* Centre — Teacher Editor */}
        <main style={{ ...s.centre, ...(centreFillsHeight ? { overflow: 'hidden' } : {}) }}>
          {/* Only the explainer slides: it's presentational, so the leaving copy is an inert
              snapshot. The editor, broadcast and panels below have side effects and swap in place. */}
          {task?.explainer && !isInSandbox && !isHostedActivityTask(task) && !isInformationTask && (
            <TaskSlideTransition
              transitionKey={`teacher-explainer-${displayTaskId}`}
              order={displayIndex}
              style={s.explainerSlide}
            >
              <ExplainerPanel
                title={task.title}
                content={task.explainer}
                topicType={displayedLesson.type}
                entranceKey={firstViewKey(lessonId, task.id)}
              />
            </TaskSlideTransition>
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
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#eef2ff',
                    fontSize: '0.88rem',
                  }}
                >
                  Sandbox module
                  <select
                    value={activeSandboxModuleId ?? ''}
                    onChange={(event) => {
                      const moduleId = event.target.value || null
                      setSandboxModuleId(moduleId)
                      applySandboxStarterState(moduleId)
                    }}
                  >
                    {lessonModules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title || module.id} ({module.type})
                      </option>
                    ))}
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

          {session &&
            (session.state === 'active' ||
              session.state === 'sandbox' ||
              badgeSuggestions.suggestions.length > 0) && (
              <BadgeSuggestionsPanel
                suggestions={badgeSuggestions.suggestions}
                students={students}
                settings={session.badgeSettings ?? null}
                onDecideBadge={decideBadge}
                onSetBadgeSettings={setBadgeSettings}
                open={badgePanelOpen}
                onOpenChange={setBadgePanelOpen}
                focusRequest={badgePanelFocus}
              />
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
            teacherLiveReference={session?.teacherLiveReference}
            teacherLiveReferenceVisibleToAll={session?.teacherLiveReferenceVisibleToAll}
            onToggleLiveReference={setTeacherLiveReferenceForClass}
            fillHeight={centreFillsHeight}
            badgeWall={teacherBadgeWall}
            entranceKey={firstViewKey(lessonId, task?.id)}
          />
          {task?.check != null && !isInSandbox && (
            <CheckConditionsPanel check={task.check} taskTitle={task.title} />
          )}
        </main>

        {/* Right — Student Grid */}
        <aside style={s.right}>
          <StudentGrid
            students={students}
            joiningStudents={joiningStudents}
            onAdmitJoining={admitJoiningStudent}
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
            onTeacherAnswerEdit={pushTeacherAnswerEdit}
            onRemoteRun={pushRemoteRun}
            onReadPendingShare={readPendingShare}
            onApproveShare={approveWorkspaceShare}
            onDeclineShare={declineWorkspaceShare}
            onRequestShareSnapshot={requestShareSnapshot}
            onRevealSupportStage={recordSupportStageReveal}
            onSetTeacherLiveReference={setTeacherLiveReferenceForStudent}
            onTogglePaused={() => setPaused(!session?.isPaused)}
            onRequestFullscreenAll={requestFullscreenForAll}
            onRequestFullscreenStudent={requestFullscreenForStudent}
            onNudgeStudent={nudgeStudent}
            onThumbsUpStudent={sendThumbsUp}
            onShowResponse={showResponse}
            onHideResponse={hideResponse}
            onSetShownResponseName={setShownResponseName}
            onNudgeAway={nudgeAwayStudents}
            onSetAutoReveal={setAutoRevealStage}
            badgeSuggestions={badgeSuggestions}
            onOpenBadgeSuggestions={() => setBadgePanelFocus((n) => n + 1)}
            onDecideBadge={decideBadge}
            onRevokeBadge={revokeBadge}
            catalogueBadges={catalogueBadges}
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((v) => !v)}
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
          liveReport={
            session?.state === 'active' || session?.state === 'sandbox'
              ? buildSessionReport(sessionReportInputs(liveReportArchive))
              : null
          }
          onClose={() => setShowReportsPanel(false)}
        />
      )}

      {showEditLessonModal && (
        <EditLessonModal
          lesson={authoredLesson}
          role={role}
          currentTaskId={session?.currentTaskId ?? currentTaskId}
          onApplySession={handleApplySessionLessonEdit}
          onSavePermanent={handleSavePermanentLessonEdit}
          onResetToOriginal={handleResetLessonOverride}
          onClose={() => setShowEditLessonModal(false)}
        />
      )}

      {teacherShareError && !openTeacherShare && (
        <div style={s.teacherShareErrorToast} role="alert">
          {teacherShareError}
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.teacherShareErrorDismiss}
            onClick={() => setTeacherShareError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Teacher's own read-only look at an approved share — no onCopyToMyEditor,
          since a teacher has no editor of their own to copy into. */}
      {openTeacherShare && (
        <div style={s.teacherShareOverlay}>
          <div style={s.teacherShareModal}>
            <SharedWorkspaceViewer
              lesson={lesson}
              entry={openTeacherShare.entry}
              snapshot={openTeacherShare.snapshot}
              onClose={() => setOpenTeacherShare(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  teacherShareOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  teacherShareModal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(1100px, 92vw)',
    height: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  teacherShareErrorToast: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    background: '#fff',
    border: '1px solid var(--colour-error, #dc2626)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
  },
  teacherShareErrorDismiss: { fontSize: 12, padding: '2px 6px' },
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
  explainerSlide: {
    flexShrink: 0,
  },
  right: {
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    overflow: 'auto',
  },
}
