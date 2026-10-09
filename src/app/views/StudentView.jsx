import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { useLessonLoader } from '../hooks/useLessonLoader'
import { applyLessonOverride, findSoloCompanion } from '../../shared/lessonService'
import { prepareClassroomLesson } from '../studentTaskContent'
import { useStudentPhase } from '../hooks/useStudentPhase'
import { useStudentCodeState } from '../hooks/useStudentCodeState'
import { useCrossTabPresence } from '../hooks/useCrossTabPresence'
import {
  flattenTasks,
  filterTasksByMode,
  findTaskById,
  getRevealableStages,
  makeExplainerPseudoTask,
  isExplainerPseudoTaskId,
  insertPseudoTaskBefore,
  makeCompletionPseudoTask,
  isCompletionPseudoTaskId,
  isSharingAllowed,
} from '../../shared/taskUtils'
import { PLAYGROUND_LESSON_TYPES, getTaskModuleType, isCodeTask } from '../../shared/composedLesson'
import { deriveStudentLiveDisplay, teacherLiveToSnapshot } from '../studentLiveDisplay'
import {
  getTaskActivity,
  isHostedActivityTask,
  isLegacyQuizTask,
  isModuleHostedActivityTask,
} from '../../activities/registry.pure.js'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import ChoiceScreen from '../components/ChoiceScreen'
import VideoCallPrompt from '../components/VideoCallPrompt'
import RecordingWidget from '../components/RecordingWidget'
import TaskProgressDots from '../components/TaskProgressDots'
import TeacherMessageToast from '../components/TeacherMessageToast'
import { NudgeBanner, NudgePermissionPrompt } from '../components/NudgeBanner'
import useNudgeAlert from '../hooks/useNudgeAlert'
import useThumbsUp from '../hooks/useThumbsUp'
import ThumbsUpToast from '../components/ThumbsUpToast'
import useClassCountdown from '../hooks/useClassCountdown'
import ClassCountdownPill from '../components/ClassCountdownPill'
import TimesUpBanner from '../components/TimesUpBanner'
import useVideoCallPrompt, { VIDEO_CALL_PROMPT_PHASES } from '../hooks/useVideoCallPrompt'
import useBadgeCelebrations from '../hooks/useBadgeCelebrations'
import BadgeCelebration from '../components/badges/BadgeCelebration'
import BadgeClassToast from '../components/badges/BadgeClassToast'
import CodingMomentsPill from '../components/badges/CodingMomentsPill'
import SoundsToggleButton from '../components/SoundsToggleButton'
import useCompleteChime from '../hooks/useCompleteChime'
import { resolveBadge } from '../../badges/badgeDisplay'
import { listMyMoments } from '../../badges/celebration'
import LoadingScreen from '../components/LoadingScreen'
import SessionEndedScreen from '../components/SessionEndedScreen'
import StudentStatusBanners from '../components/StudentStatusBanners'
import ClassPollCard from '../components/polls/ClassPollCard'
import { PollTaskClassContext } from '../components/quiz/PollTaskClassContext'
import { getActivePoll, getStudentPollChoice, tallyPoll } from '../../shared/classPolls'
import LessonTaskContent from '../components/LessonTaskContent'
import { usePreloadNeighbourImages } from '../../shared/preloadImages'
import SoloNav from '../components/SoloNav'
import SharedWorkspacePanel from '../components/SharedWorkspacePanel'
import { applySharedWorkspaceCopy, describeShareError } from '../sharedWorkspacePayload'
import SharedWorkspaceViewer from '../components/SharedWorkspaceViewer'
import StudentLivePanelBar from '../components/StudentLivePanelBar'
import { usePeerHelp } from '../hooks/usePeerHelp'
import HelpRequestButton from '../components/peerHelp/HelpRequestButton'
import PeerHelpAskBubble from '../components/peerHelp/PeerHelpAskBubble'
import HelperPromiseDialog from '../components/peerHelp/HelperPromiseDialog'
import PeerHelpOfferToast from '../components/peerHelp/PeerHelpOfferToast'
import PeerHelperWorkspace from '../components/peerHelp/PeerHelperWorkspace'
import PeerHelpInbox from '../components/peerHelp/PeerHelpInbox'
import { applyPeerEdit, visiblePeerHelpOffers } from '../../shared/peerHelp'
import { supportsPeerHelp } from '../peerHelpAnchors'
import { useSideQuests } from '../hooks/useSideQuests'
import SideQuestPrompt from '../components/sideQuests/SideQuestPrompt'
import SideQuestWorkspace from '../components/sideQuests/SideQuestWorkspace'
import { createLaunchpadCodeFile, downloadLaunchpadCodeFile } from '../../shared/launchpadCodeFile'
import {
  getSavedNonPythonTaskCount,
  getSavedPythonTasks,
  isPythonCodeTask,
} from '../studentCodeExports'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { decodeFileKey } from '../../shared/fileKeys'
import { getModuleDefinition } from '../../modules/definitions'
import { decodeSessionFiles } from '../../shared/workspaceData'
import { BadgeSignalsContext } from '../../shared/badgeSignalsContext'
import LiveInkProvider from '../liveInk/LiveInkProvider'

export default function StudentView({
  lessonId: lessonIdProp,
  forceSolo = false,
  lesson: lessonProp = null,
  teacherPresentation = false,
  allowUnrestrictedTaskNavigation = false,
  previewMode = false,
  initialTaskId = null,
  onTaskChange = null,
}) {
  const lessonId = lessonIdProp ?? lessonProp?.id ?? 'preview'

  // ─── Core hooks ───────────────────────────────────────────────────────────

  // Lesson loads first so an authored soloOnly flag can be folded into soloMode before
  // deciding whether to subscribe to the realtime session at all.
  const {
    lesson: baseLesson,
    lessonLoading,
    firstTaskId: baseFirstTaskId,
  } = useLessonLoader(lessonId, lessonProp, initialTaskId)
  const soloMode = forceSolo || !!baseLesson?.soloOnly

  const useRealtimeSession = !soloMode || teacherPresentation
  const {
    session,
    loading: sessionLoading,
    connected,
    serverTimeOffset,
    registerPresence,
    joinSession,
    recordStudentReturn,
    registerJoining,
    unregisterJoining,
    setJoiningTypedName,
    subscribeJoiningMarker,
    writeStudentRun,
    writeStudentHintState,
    logAttempt,
    flagAttemptError,
    writeStudentAnswer,
    writeStudentDraft,
    writeStudentCode,
    writeStudentArcadeDesign,
    writeStudentTurtleResult,
    writeStudentSpriteState,
    writeStudentCursor,
    writeStudentBlockDrag,
    writeStudentCodeArrangeSlots,
    writeStudentFiles,
    writeStudentOutput,
    writeStudentInputState,
    writeStudentInteraction,
    recordStudentCarryFallback,
    recordSupportStageReveal,
    recordStudentPaste,
    recordStudentTyping,
    recordStudentTileMiss,
    recordTopicOpenSignal,
    recordShortcutSignal,
    recordAutocompleteSignal,
    recordFirstEditSignal,
    recordCompleteShownSignal,
    recordSandboxRunSignal,
    flagSandboxRunError,
    addSandboxTimeSignal,
    writeStudentPersonalSandbox,
    writeSideQuestOpen,
    recordSideQuestOpened,
    recordSideQuestRun,
    setSideQuestDone,
    writeStudentPresence,
    setTaskId,
    setTeacherLive,
    updateTeacherLive,
    setTeacherLiveReference,
    removeStudent,
    requestHelp,
    answerPoll,
    requestWorkspaceShare,
    cancelWorkspaceShare,
    readSharedWorkspace,
    setStudentTopic,
    acceptTeacherEdit,
    declineTeacherEdit,
    acceptTeacherStage,
    declineTeacherStage,
    removeTeacherHighlight,
    clearTeacherAnswerEdit,
    clearRemoteRun,
    pushClassPaneCommand,
    subscribeLiveInk,
    createLiveInkWriter,
  } = useSession(useRealtimeSession ? lessonId : null, { enabled: useRealtimeSession })
  const {
    identity,
    loaded: identityLoaded,
    authError,
    retrySignIn,
    createIdentity,
    updateTimestamp,
    updateDisplayName,
  } = useIdentity()
  const effectiveIdentity = teacherPresentation
    ? { anonymousId: 'teacher-presenter', displayName: 'Teacher' }
    : identity

  const lesson = useMemo(
    () => prepareClassroomLesson(applyLessonOverride(baseLesson, session?.lessonOverrideTasks)),
    [baseLesson, session?.lessonOverrideTasks]
  )
  // Derive firstTaskId from the post-override lesson so solo-mode students start on a valid task.
  // If an explicit initialTaskId was provided (e.g. builder preview), honour it over the lesson's first task.
  const firstTaskId = useMemo(
    () =>
      initialTaskId ??
      (lesson ? (flattenTasks(lesson.tasks)[0]?.id ?? baseFirstTaskId) : baseFirstTaskId),
    [lesson, baseFirstTaskId, initialTaskId]
  )

  // ─── Stable callback refs wired to code-state after it initialises ─────────

  const saveWorkRef = useRef(null)
  const exitSandboxRef = useRef(null)
  const resetForTaskRef = useRef(null)
  const autoCheckOnLeaveRef = useRef(null)
  const onBeforeTaskChange = useCallback(() => saveWorkRef.current?.(), [])
  const onBeforeClassAdvance = useCallback(() => autoCheckOnLeaveRef.current?.(), [])
  const onPersonalSandboxExit = useCallback(() => exitSandboxRef.current?.(), [])
  const onTaskReset = useCallback(() => resetForTaskRef.current?.(), [])

  // ─── Phase state machine ───────────────────────────────────────────────────

  const {
    phase,
    setPhase,
    currentTaskId,
    setCurrentTaskId,
    viewingTaskId,
    setViewingTaskId,
    joinError,
    handleNameSubmit,
    handleWaitForTeacher,
    handleGoSolo,
    reportTypedName,
  } = useStudentPhase({
    session,
    sessionLoading,
    identity,
    identityLoaded,
    lessonId,
    lessonLoading,
    soloMode,
    teacherPresentation,
    firstTaskId,
    onBeforeTaskChange,
    onBeforeClassAdvance,
    onPersonalSandboxExit,
    onTaskReset,
    createIdentity,
    updateTimestamp,
    joinSession,
    recordStudentReturn,
    registerJoining,
    unregisterJoining,
    setJoiningTypedName,
    subscribeJoiningMarker,
  })
  const activeLesson = useMemo(
    () => getEffectiveLessonForTask(lesson, currentTaskId),
    [lesson, currentTaskId]
  )

  // ─── Code / editor state ───────────────────────────────────────────────────

  const cs = useStudentCodeState({
    lessonId,
    lesson: activeLesson,
    currentTaskId,
    viewingTaskId,
    phase,
    effectiveIdentity,
    identity,
    session,
    connected,
    teacherPresentation,
    previewMode,
    writeStudentRun,
    writeStudentHintState,
    logAttempt,
    writeStudentAnswer,
    writeStudentDraft,
    writeStudentCode,
    writeStudentArcadeDesign,
    writeStudentTurtleResult,
    writeStudentSpriteState,
    writeStudentCursor,
    writeStudentBlockDrag,
    writeStudentCodeArrangeSlots,
    writeStudentFiles,
    writeStudentOutput,
    writeStudentInputState,
    writeStudentInteraction,
    recordStudentCarryFallback,
    recordSupportStageReveal,
    recordStudentPaste,
    recordStudentTyping,
    recordStudentTileMiss,
    writeStudentPersonalSandbox,
    writeStudentPresence,
    registerPresence,
    removeStudent,
    updateTeacherLive,
    setTeacherLive,
    setTeacherLiveReference,
    clearTeacherAnswerEdit,
    clearRemoteRun,
    removeTeacherHighlight,
    flagAttemptError,
    // Read through a ref inside useStudentBadgeSignals, so a new object each render is fine.
    badgeSignalWriters: {
      recordTopicOpenSignal,
      recordShortcutSignal,
      recordAutocompleteSignal,
      recordFirstEditSignal,
      recordCompleteShownSignal,
      recordSandboxRunSignal,
      flagSandboxRunError,
      addSandboxTimeSignal,
    },
  })
  // Live badge reporters for the shared editor, Blockly and Topic Library components below
  // (they read BadgeSignalsContext). The reporters are stable, so this value is too.
  const badgeSignalsContextValue = useMemo(
    () => ({
      reportUserEdit: cs.badgeSignals.reportUserEdit,
      reportAutocomplete: cs.badgeSignals.reportAutocomplete,
      reportTopicOpen: cs.badgeSignals.reportTopicOpen,
      // Session report typing measures (useStudentTypingStats), from the shared CodeEditor.
      reportTyping: cs.typingStats.reportTyping,
    }),
    [
      cs.badgeSignals.reportUserEdit,
      cs.badgeSignals.reportAutocomplete,
      cs.badgeSignals.reportTopicOpen,
      cs.typingStats.reportTyping,
    ]
  )

  // Wire phase callbacks to latest code-state functions each render
  saveWorkRef.current = cs.saveCurrentWork
  autoCheckOnLeaveRef.current = cs.autoCheckOnLeave
  exitSandboxRef.current = cs.exitPersonalSandbox
  resetForTaskRef.current = cs.resetForTaskChange

  useEffect(() => {
    onTaskChange?.(viewingTaskId ?? currentTaskId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingTaskId, currentTaskId])

  const isMobile = useIsMobile()
  // The current task when its module's code can be downloaded as a .launchpad file
  // (capabilities.downloadCode: python).
  const activeModuleCaps = getModuleDefinition(activeLesson?.type)?.capabilities ?? null
  const canDownloadCode = !!activeModuleCaps?.downloadCode
  const currentDownloadableTask = useMemo(() => {
    if (!canDownloadCode) return null
    const task = flattenTasks(lesson.tasks).find((item) => item.id === currentTaskId)
    return isPythonCodeTask(task) ? task : null
  }, [lesson, canDownloadCode, currentTaskId])
  // Only shown on the session-ended screen — gating on phase avoids rescanning localStorage
  // on every keystroke while the student is still working.
  const savedPythonTasks = useMemo(() => {
    if (phase !== 'ended') return []
    return getSavedPythonTasks({
      lesson,
      anonymousId: teacherPresentation ? null : identity?.anonymousId,
    })
  }, [phase, lesson, identity?.anonymousId, teacherPresentation])
  const savedOtherTaskCount = useMemo(() => {
    if (phase !== 'ended') return 0
    return getSavedNonPythonTaskCount({
      lesson,
      anonymousId: teacherPresentation ? null : identity?.anonymousId,
    })
  }, [phase, lesson, identity?.anonymousId, teacherPresentation])
  const [otherTabDismissed, setOtherTabDismissed] = useState(false)
  const [fullscreenDismissedAt, setFullscreenDismissedAt] = useState(null)
  const otherTabOpen =
    useCrossTabPresence(lessonId, teacherPresentation ? null : identity?.anonymousId) &&
    !otherTabDismissed
  // Whichever request is more recent wins — a class-wide "Fullscreen All" and a
  // per-student ask (see requestFullscreenForStudent) share the same one-click
  // prompt, just at different broadcast scopes.
  const fullscreenRequestedAt =
    Math.max(
      session?.fullscreenRequestedAt ?? 0,
      session?.students?.[identity?.anonymousId]?.fullscreenRequestedAt ?? 0
    ) || null
  const fullscreenPromptVisible =
    !teacherPresentation &&
    !!fullscreenRequestedAt &&
    fullscreenRequestedAt !== fullscreenDismissedAt

  // Teacher nudges (tab flash, chime, OS notification) — live lessons only.
  const nudgeEnabled =
    (phase === 'lesson' || phase === 'sandbox') && !teacherPresentation && !!identity?.anonymousId
  const { nudgeBannerVisible, dismissNudge } = useNudgeAlert({
    ready: !!session,
    enabled: nudgeEnabled,
    studentPushedAt: session?.students?.[identity?.anonymousId]?.nudgePushedAt ?? null,
    classPushedAt: session?.nudgeAwayPushedAt ?? null,
  })
  // The teacher's transient 👍 "on the right track" toast — same live-only gate as nudges.
  const { thumbsUpAt } = useThumbsUp({
    ready: !!session,
    enabled: nudgeEnabled,
    pushedAt: session?.students?.[identity?.anonymousId]?.thumbsUpPushedAt ?? null,
    soundsOff: !!session?.badgeSettings?.soundsOff,
  })

  // The teacher's class countdown: a pill in the top bar (large on the presentation window) and
  // a "Time's up" banner at zero, with a chime on the student's own screen only. It survives
  // task changes and locks nothing.
  const classCountdownVisible =
    !previewMode &&
    (session?.state === 'active' || session?.state === 'sandbox') &&
    (teacherPresentation || phase === 'lesson' || phase === 'sandbox')
  const classCountdown = classCountdownVisible ? (session?.classCountdown ?? null) : null
  const { timesUpAt } = useClassCountdown({
    countdown: classCountdown,
    serverTimeOffset,
    enabled: classCountdownVisible,
    playSound: !teacherPresentation,
    soundsOff: !!session?.badgeSettings?.soundsOff,
  })

  // Live badges: the recipient's card and Coding moments pill, and the class toasts (the
  // presentation window gets the toasts only). Awards stored before this load aren't replayed.
  const badgeCelebrations = useBadgeCelebrations({
    ready: !!session,
    enabled: phase === 'lesson' || phase === 'sandbox',
    decisions: session?.badges,
    viewerId: teacherPresentation ? null : (identity?.anonymousId ?? null),
    students: session?.students,
    soundsOff: !!session?.badgeSettings?.soundsOff,
  })
  // The success chime when the student's checks pass on a task, solo or live. Never on the
  // presentation window or a preview, nor in the personal sandbox.
  const completeChime = useCompleteChime({
    enabled:
      (phase === 'lesson' || phase === 'solo') &&
      !teacherPresentation &&
      !previewMode &&
      !cs.inPersonalSandbox,
    passed: cs.checkPassed,
    // The task on screen: a live student looking back at an earlier task sees that task's result.
    taskKey:
      (viewingTaskId ?? currentTaskId) == null
        ? null
        : `${lessonId}:${viewingTaskId ?? currentTaskId}`,
    soundsOff: !!session?.badgeSettings?.soundsOff,
  })
  // "Show complete" fills in the answer, which passes the checks: that pass isn't celebrated.
  // (cs is a new object every render, so this wrapper costs nothing extra.)
  const taskCs = {
    ...cs,
    handleShowCompleteCode: () => {
      completeChime.skipTask()
      cs.handleShowCompleteCode()
    },
  }
  // The session-end screen reads the kept `badges` node, so it survives a reload of that screen.
  const endScreenMoments = useMemo(
    () =>
      phase === 'ended' && !teacherPresentation
        ? listMyMoments(session?.badges, identity?.anonymousId)
        : [],
    [phase, teacherPresentation, session?.badges, identity?.anonymousId]
  )
  // The Badge Summary task's wall in a live session: the student's own moments then the class,
  // or the class only on the presentation window. Solo skips the task; a preview shows its note.
  const badgeWall = useMemo(
    () =>
      phase === 'lesson' && !previewMode
        ? {
            decisions: session?.badges ?? {},
            students: session?.students ?? {},
            viewerId: teacherPresentation ? null : (identity?.anonymousId ?? null),
            variant: teacherPresentation ? 'presentation' : 'student',
          }
        : null,
    [
      phase,
      previewMode,
      teacherPresentation,
      session?.badges,
      session?.students,
      identity?.anonymousId,
    ]
  )

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
    if (!currentDownloadableTask) return
    cs.saveCurrentWork()
    downloadTasks(
      [{ id: currentDownloadableTask.id, title: currentDownloadableTask.title, code: cs.code }],
      currentDownloadableTask.title
    )
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

  // Declared with the other view state: everything below the phase early
  // returns runs conditionally, so a hook there would break hook ordering.
  const [shareError, setShareError] = useState(null)
  // The shared workspace this student is currently looking at, if any:
  // { entry, snapshot }. Local only — opening a share never touches their work.
  const [activeShare, setActiveShare] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  // A "Show to class (keep coding)" broadcast: whether this student chose to watch it, and the
  // throwaway copy they opened ({ entry, snapshot }), if any. Both reset per broadcast.
  const [watchingStudentPanel, setWatchingStudentPanel] = useState(false)
  const [livePanelCopy, setLivePanelCopy] = useState(null)
  const livePanelKey =
    session?.teacherLive?.active && session.teacherLive.mode === 'panel'
      ? `${session.teacherLive.sourceStudentId}:${session.teacherLive.taskId}`
      : null
  useEffect(() => {
    setWatchingStudentPanel(false)
    setLivePanelCopy(null)
  }, [livePanelKey])
  // Tells the teacher's roster when this student is looking at (or trying) the broadcast:
  // students/{id}/watchingLive, written only when it changes (see src/app/studentActivity.js).
  const watchingLive = livePanelCopy ? 'try' : watchingStudentPanel ? 'look' : null
  const reportedWatchingLiveRef = useRef(null)
  useEffect(() => {
    const id = identity?.anonymousId
    if (!id || teacherPresentation || previewMode) return
    if (reportedWatchingLiveRef.current === watchingLive) return
    reportedWatchingLiveRef.current = watchingLive
    writeStudentInteraction?.(id, { watchingLive })
  }, [watchingLive, identity?.anonymousId, teacherPresentation, previewMode])

  // Peer help (src/shared/peerHelp.js): this student's own request, and the request they help
  // with. Live lessons only; never in solo, preview or the Presentation window.
  const peerHelp = usePeerHelp({
    lessonId,
    session,
    identityId: identity?.anonymousId,
    role: !soloMode && !previewMode && !teacherPresentation ? 'student' : null,
  })
  // The stuck student's client answers a helper's "Get latest" with this.
  peerHelp.setSnapshotBuilder(() => cs.buildShareSnapshot())
  const [peerHelperOpen, setPeerHelperOpen] = useState(true)
  const [peerPromiseFor, setPeerPromiseFor] = useState(null)
  const [dismissedPeerOffers, setDismissedPeerOffers] = useState(() => new Set())
  const [peerClaimBusy, setPeerClaimBusy] = useState(false)
  const [peerClaimError, setPeerClaimError] = useState(null)
  const [peerHelpError, setPeerHelpError] = useState(null)
  // "Can a classmate help too?", asked right after ✋ Help where peer help is possible.
  const [peerAskOpen, setPeerAskOpen] = useState(false)
  useEffect(() => {
    if (peerHelp.helpingRequestId) setPeerHelperOpen(true)
  }, [peerHelp.helpingRequestId])

  // Side-quests (src/shared/sideQuests.js): unchecked extras on the current task once the
  // student has passed it, while the class is still on it (or solo). They run in their own
  // throwaway workspace and never touch the task's code.
  const sideQuests = useSideQuests({
    task: lesson ? findTaskById(lesson.tasks, currentTaskId) : null,
    moduleType: activeLesson?.type ?? null,
    identity,
    session,
    phase,
    checkPassed: cs.checkPassed,
    isViewingPrev: viewingTaskId != null && viewingTaskId !== currentTaskId,
    inPersonalSandbox: cs.inPersonalSandbox,
    teacherPresentation,
    previewMode,
    writeSideQuestOpen,
    recordSideQuestOpened,
    recordSideQuestRun,
    setSideQuestDone,
  })
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

  // ─── Teacher-sent video call link ──────────────────────────────────────────

  // Per-student send or class-wide "Send to all"; also shown on the name and waiting screens.
  const { videoCallPromptVisible, dismissVideoCallPrompt } = useVideoCallPrompt({
    ready: !!session,
    enabled: !teacherPresentation && VIDEO_CALL_PROMPT_PHASES.includes(phase),
    phase,
    link: session?.videoCallLink,
    studentPushedAt: session?.students?.[identity?.anonymousId]?.videoCallLinkPushedAt ?? null,
    broadcastAt: session?.videoCallBroadcastAt ?? null,
  })
  const videoCallPrompt = videoCallPromptVisible ? (
    <VideoCallPrompt videoCallLink={session.videoCallLink} onDismiss={dismissVideoCallPrompt} />
  ) : null
  const withVideoCallPrompt = (screen) => (
    <>
      {screen}
      {videoCallPrompt}
    </>
  )

  // ─── Teacher-requested share snapshot ──────────────────────────────────────
  // The teacher can put a student's work in front of the class without them
  // asking. They still cannot build the snapshot (currentCode is only fresh for
  // the watched student), so their request lands here and this device answers
  // with a fresh one. Silent to the student: no prompt, no consent step.
  const shareSnapshotRequestedAt =
    session?.students?.[identity?.anonymousId]?.shareSnapshotRequestedAt
  const answeredSnapshotRequestRef = useRef(null)

  useEffect(() => {
    if (!shareSnapshotRequestedAt || !identity?.anonymousId) return
    if (answeredSnapshotRequestRef.current === shareSnapshotRequestedAt) return
    answeredSnapshotRequestRef.current = shareSnapshotRequestedAt
    requestWorkspaceShare(identity.anonymousId, cs.buildShareSnapshot(), 'teacher').catch(() => {
      // Nothing to show the student — the teacher sees the request stall and
      // can try again.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareSnapshotRequestedAt, identity?.anonymousId])

  function handleTopicOpen(topicId) {
    if (identity?.anonymousId && phase === 'lesson')
      setStudentTopic?.(identity.anonymousId, topicId || null)
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
  // Tagged with the task that reported it: on a task change this still holds the previous
  // task's panes (e.g. an information task's empty list) until the new task reports, and
  // reading that stale list made the Scratch explainer look hidden on arrival.
  const [reportedVisiblePanes, setReportedVisiblePanes] = useState(null)
  const localVisiblePanes =
    reportedVisiblePanes?.taskId === currentTaskId ? reportedVisiblePanes.panes : null
  const handleVisiblePanesChange = useCallback(
    (panes) => {
      setReportedVisiblePanes({ taskId: currentTaskId, panes })
      if (teacherPresentation || !identity?.anonymousId) return
      if (phase !== 'lesson' && phase !== 'sandbox') return
      // Keyed per task: the teacher's setTaskId wipes visiblePanes, so the same list on the
      // next task (e.g. Python -> Python) must still be written again.
      const key = `${currentTaskId}|${panes?.join(',') ?? ''}`
      if (lastVisiblePanesRef.current === key) return
      lastVisiblePanesRef.current = key
      writeStudentPresence?.(identity.anonymousId, { visiblePanes: panes })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [teacherPresentation, identity?.anonymousId, phase, currentTaskId]
  )

  // Scratch solo: when the current task's explainer is hidden (either the manual
  // rail-collapse or the automatic width-driven tab-away — both already folded into
  // localVisiblePanes lacking 'instructions', see LessonTaskContent's instructionsPaneVisible),
  // show it as a "pseudo-task" slide in the nav, positioned right before the task it explains.
  // This lookup re-derives the current task from `lesson` directly (rather than reusing the
  // `task`/`isQuizTask`/`isInformationTask` variables computed further below) because hooks
  // must run unconditionally above this component's phase-guard early-returns, while those
  // variables are only computed after them.
  const explainerPseudoCandidateTask = lesson ? findTaskById(lesson.tasks, currentTaskId) : null
  // Composed lessons carry a per-task module type (task.moduleType), not a single
  // lesson.type — activeLesson is already the effective, composed-aware lesson for
  // currentTaskId (see getEffectiveLessonForTask), same as everything else in this
  // component that needs to know the current task's real module type.
  // Only the fixed-width explainer (capabilities.fixedExplainer: Scratch) tabs away like this.
  const rawExplainerHidden =
    phase === 'solo' &&
    !!activeModuleCaps?.fixedExplainer &&
    !!explainerPseudoCandidateTask?.explainer &&
    explainerPseudoCandidateTask?.taskType !== 'information' &&
    !isHostedActivityTask(explainerPseudoCandidateTask) &&
    viewingTaskId === null &&
    localVisiblePanes != null &&
    !localVisiblePanes.includes('instructions')
  const [explainerPseudoActive, setExplainerPseudoActive] = useState(false)
  useEffect(() => {
    if (!rawExplainerHidden) {
      setExplainerPseudoActive(false)
      return
    }
    // Debounced so dragging the window across the auto-shrink breakpoint doesn't flicker
    // the nav; a manual collapse-click pays the same small delay for simplicity.
    const timer = setTimeout(() => setExplainerPseudoActive(true), 400)
    return () => clearTimeout(timer)
  }, [rawExplainerHidden])
  const [viewingExplainerSlide, setViewingExplainerSlide] = useState(false)
  // Synthetic "lesson complete" screen shown after Next off the last solo task — like
  // the explainer slide, this never touches currentTaskId (which stays pinned to the
  // real last task) so it can't interfere with persistence, Firebase, or checks.
  const [viewingCompletionScreen, setViewingCompletionScreen] = useState(false)

  // Looked up once per lesson so the completion screen can offer a linked solo
  // challenge lesson (see `companionOf` in the lesson schema) regardless of whether
  // this student finished the lesson live or solo.
  const [soloCompanion, setSoloCompanion] = useState(null)
  useEffect(() => {
    let cancelled = false
    setSoloCompanion(null)
    findSoloCompanion(lessonId).then((companion) => {
      if (!cancelled) setSoloCompanion(companion)
    })
    return () => {
      cancelled = true
    }
  }, [lessonId])
  function handleTrySoloChallenge() {
    window.location.hash = `#/lesson/${soloCompanion.id}?solo=true`
  }
  function handleReplayLesson() {
    handleSoloNavigate(flatTasks[0]?.id)
  }

  // Auto-open the explainer slide on arrival at a task whose explainer is (already)
  // hidden — landing on the task shows the explainer first, and the student proceeds
  // via the normal Next/dot controls (which then land on the real task) rather than
  // being dropped straight into the code. Deliberately "arrival only": resizing the
  // window smaller while already sitting on a task must never yank the student back
  // to the explainer mid-work, so this is edge-triggered on currentTaskId changing
  // (including the very first task on load), not level-triggered on rawExplainerHidden.
  // pendingAutoShowTaskIdRef marks a task as "owed a decision" on every real
  // navigation, then a separate effect consumes (clears) it the first time
  // rawExplainerHidden has a real answer for that task — after which it's consumed
  // for good, so a later live resize on the same task can't reopen it.
  const pendingAutoShowTaskIdRef = useRef(null)
  useEffect(() => {
    pendingAutoShowTaskIdRef.current = currentTaskId
  }, [currentTaskId])
  useEffect(() => {
    if (pendingAutoShowTaskIdRef.current !== currentTaskId) return
    if (localVisiblePanes == null) return // not reported for this render pass yet — wait
    pendingAutoShowTaskIdRef.current = null
    if (rawExplainerHidden) setViewingExplainerSlide(true)
  }, [currentTaskId, localVisiblePanes, rawExplainerHidden])

  // Teacher-pushed "highlight this tab/panel" or "force this tab/panel" command — either
  // targeted at this one student (session.students.{id}.teacherPaneCommand) or the whole
  // class (session.teacherClassPaneCommand). Whichever was pushed more recently wins.
  // Dismissal (per "clears when the student looks at it") is tracked purely client-side —
  // the whole-class command is a single shared Firebase node, so one student looking at it
  // must not clear it for everyone else, and there's no reason to treat the per-student
  // case differently from that.
  const rawStudentPaneCommand =
    session?.students?.[effectiveIdentity?.anonymousId]?.teacherPaneCommand ?? null
  const rawClassPaneCommand = session?.teacherClassPaneCommand ?? null
  const [dismissedPaneCommandAt, setDismissedPaneCommandAt] = useState({
    student: null,
    class: null,
  })
  useEffect(() => {
    if (!localVisiblePanes) return
    setDismissedPaneCommandAt((prev) => {
      const seenAll = (panes) => panes.every((pane) => localVisiblePanes.includes(pane))
      const nextStudent =
        rawStudentPaneCommand &&
        prev.student !== rawStudentPaneCommand.pushedAt &&
        seenAll(rawStudentPaneCommand.panes)
          ? rawStudentPaneCommand.pushedAt
          : prev.student
      const nextClass =
        rawClassPaneCommand &&
        prev.class !== rawClassPaneCommand.pushedAt &&
        seenAll(rawClassPaneCommand.panes)
          ? rawClassPaneCommand.pushedAt
          : prev.class
      return nextStudent === prev.student && nextClass === prev.class
        ? prev
        : { student: nextStudent, class: nextClass }
    })
  }, [localVisiblePanes, rawStudentPaneCommand, rawClassPaneCommand])
  const studentPaneCommand =
    rawStudentPaneCommand && rawStudentPaneCommand.pushedAt !== dismissedPaneCommandAt.student
      ? rawStudentPaneCommand
      : null
  const classPaneCommand =
    rawClassPaneCommand && rawClassPaneCommand.pushedAt !== dismissedPaneCommandAt.class
      ? rawClassPaneCommand
      : null
  const effectivePaneCommand = !studentPaneCommand
    ? classPaneCommand
    : !classPaneCommand
      ? studentPaneCommand
      : (classPaneCommand.pushedAt ?? 0) >= (studentPaneCommand.pushedAt ?? 0)
        ? classPaneCommand
        : studentPaneCommand
  const highlightedPanes =
    effectivePaneCommand?.mode === 'highlight' ? effectivePaneCommand.panes : null
  const forcedPaneCommand = effectivePaneCommand?.mode === 'force' ? effectivePaneCommand : null

  // ─── Navigation handlers ───────────────────────────────────────────────────

  function handleSoloNavigate(taskId) {
    // The explainer pseudo-task is a read-only view over the current task's content,
    // not a real task — never touch currentTaskId/cs for it. Clicking it opens the
    // slide; navigating "back" onto the current task's own id (its dot, or Next off
    // the pseudo entry) closes it.
    if (isExplainerPseudoTaskId(taskId)) {
      setViewingExplainerSlide(true)
      setViewingTaskId(null)
      return
    }
    if (isCompletionPseudoTaskId(taskId)) {
      setViewingCompletionScreen(true)
      setViewingTaskId(null)
      return
    }
    if (taskId === currentTaskId) {
      setViewingExplainerSlide(false)
      setViewingCompletionScreen(false)
      return
    }
    if (teacherPresentation) {
      if (!flatTasks.some((t) => t.id === taskId)) return
      setTaskId(taskId)
      setCurrentTaskId(taskId)
      setViewingTaskId(null)
      setViewingExplainerSlide(false)
      cs.resetForTaskChange()
      updateTeacherLive({
        taskId,
        output: '',
        runStatus: null,
        checkPassed: false,
        checkAttempted: false,
        codeArrangeSlots: null,
        codeArrangeCursor: null,
        // An activity state belongs to one task; the new task's activity publishes its own.
        answer: null,
      })
      return
    }
    if (!identity) return
    if (phase === 'solo' && !allowUnrestrictedTaskNavigation) {
      const targetIdx = flatTasks.findIndex((t) => t.id === taskId)
      const currIdx = flatTasks.findIndex((t) => t.id === currentTaskId)
      if (targetIdx > currIdx) {
        if (targetIdx > currIdx + 1) return
      }
    }
    cs.saveCurrentWork()
    setViewingTaskId(null)
    setViewingExplainerSlide(false)
    setViewingCompletionScreen(false)
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

  const taskDisplayMode = previewMode
    ? null
    : phase === 'solo'
      ? 'solo'
      : phase === 'lesson'
        ? 'live'
        : null

  // Images for the tasks either side of this one load in the background, so Next / Back don't
  // show them popping in after the slide.
  const preloadFlatTasks = useMemo(
    () => (lesson ? flattenTasks(filterTasksByMode(lesson.tasks, taskDisplayMode)) : []),
    [lesson, taskDisplayMode]
  )
  usePreloadNeighbourImages(
    lesson,
    preloadFlatTasks,
    preloadFlatTasks.findIndex((t) => t.id === currentTaskId)
  )

  // ─── Phase guards ──────────────────────────────────────────────────────────

  if (
    phase === 'loading' ||
    (!soloMode && sessionLoading) ||
    lessonLoading ||
    (!teacherPresentation && !identityLoaded)
  ) {
    return <LoadingScreen message="Loading…" />
  }

  if (!lesson) {
    return <LoadingScreen message={`Lesson "${lessonId}" not found.`} />
  }

  // Computed independently of `phase` (unlike the main lastCodeTaskType/canOpenPlayground
  // below, which reflect whichever taskDisplayMode the student is currently in) because the
  // "Session ended" screen renders from an early return, before the live/solo task-filtering
  // below runs, and always reflects a lesson the student was doing live.
  const liveFlatTasks = flattenTasks(filterTasksByMode(lesson.tasks, 'live'))
  const lastLiveCodeTask = [...liveFlatTasks].reverse().find(isCodeTask)
  const lastLiveCodeTaskType = lastLiveCodeTask ? getTaskModuleType(lesson, lastLiveCodeTask) : null
  const canOpenPlaygroundAtEnd = PLAYGROUND_LESSON_TYPES.includes(lastLiveCodeTaskType)
  function handleOpenPlaygroundAtEnd() {
    window.location.hash = `#/playground/${lastLiveCodeTaskType}`
  }

  if (phase === 'choice') {
    return (
      <ChoiceScreen
        lessonTitle={lesson.title}
        lessonDescription={lesson.description}
        onJoinLive={handleWaitForTeacher}
        onGoSolo={handleGoSolo}
      />
    )
  }

  if (phase === 'name-entry') {
    return withVideoCallPrompt(
      <NameEntry
        lessonTitle={lesson.title}
        existingNames={
          session ? Object.values(session.students ?? {}).map((s) => s.displayName) : []
        }
        onSubmit={handleNameSubmit}
        onNameTyping={reportTypedName}
        onGoSolo={handleGoSolo}
        waitingForSession={session?.state === 'waiting'}
        joinError={joinError}
      />
    )
  }

  if (phase === 'waiting') {
    return withVideoCallPrompt(
      <WaitingRoom
        lessonTitle={lesson.title}
        lessonDescription={lesson.description}
        videoCallLink={session?.videoCallLink}
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
        soloCompanion={soloCompanion}
        onTrySoloChallenge={soloCompanion ? handleTrySoloChallenge : undefined}
        onOpenPlayground={canOpenPlaygroundAtEnd ? handleOpenPlaygroundAtEnd : undefined}
        moments={endScreenMoments}
      />
    )
  }

  // ─── Lesson / sandbox / solo render ───────────────────────────────────────

  const visibleTasks = filterTasksByMode(lesson.tasks, taskDisplayMode)
  const flatTasks = flattenTasks(visibleTasks)
  const currentIndex = flatTasks.findIndex((t) => t.id === currentTaskId)
  const {
    isPresentationStudentViewer,
    isStudentGoLiveViewer,
    isStudentPanelBroadcast,
    isTeacherLiveActive,
    isForcedTeacherLive,
    displayedTaskId,
    displayCode,
    displayArcadeDesign,
    displayTurtleResult,
    displaySpriteState,
    displayCursor,
    displayBlockDrag,
    displayCodeArrangeSlots,
    displayCodeArrangeCursor,
    displayFiles,
    displayActiveFile,
    displayOutput,
    displayRunStatus,
    displayCheckPassed,
    displayCheckAttempted,
    displayCheckSuggestion,
    displaySelection,
    displayAnswer,
    displayOutputCollapsed,
    isLiveCopyBlocked,
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
    watchingStudentPanel,
  })
  const task = flatTasks.find((t) => t.id === displayedTaskId)
  const displayedLesson = getEffectiveLessonForTask(lesson, displayedTaskId)
  const displayedModule = getModuleDefinition(displayedLesson.type)
  // A forced teacher-live broadcast of a filesystem / desktop module carries its state as JSON.
  const forcedLiveKind = isForcedTeacherLive ? displayedModule?.capabilities.sandboxState : null
  const forcedLiveState = (kind, fallback) => {
    if (forcedLiveKind !== kind) return fallback
    try {
      return JSON.parse(session?.teacherLive?.code ?? '')
    } catch {
      return fallback
    }
  }
  const displayFs = forcedLiveState('fs', cs.fsState)
  const displayDesktop = forcedLiveState('desktop', cs.desktopState)
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'
  // Need Help is a persistent, always-accessible control in the top bar whenever a teacher
  // is on the other end — a live lesson or the sandbox they started. Solo and presentation
  // have no teacher to help.
  const canRequestHelp =
    (phase === 'lesson' || phase === 'sandbox') && !teacherPresentation && !!identity?.anonymousId
  const myNeedsHelp = !!session?.students?.[identity?.anonymousId]?.needsHelp
  const handleNeedHelp = () => requestHelp(identity.anonymousId)

  // ─── Workspace sharing ────────────────────────────────────────────────────
  // Opt-in per task via `allowSharing`. Live lessons only: solo, sandbox,
  // builder preview, and teacher presentation have no class to share with.
  const myStudentNode = session?.students?.[identity?.anonymousId]
  const sharePending = myStudentNode?.shareRequestedAt != null
  const canShareWorkspace =
    phase === 'lesson' &&
    !!identity?.anonymousId &&
    !teacherPresentation &&
    !isForcedTeacherLive &&
    isSharingAllowed(task)

  // The gallery is available in a live lesson whether or not this particular
  // task allows sharing — shares outlive the task they came from.
  const canSeeSharedWork =
    (phase === 'lesson' || phase === 'sandbox') &&
    !teacherPresentation &&
    !isForcedTeacherLive &&
    !!identity?.anonymousId

  async function handleShareWorkspace() {
    setShareError(null)
    try {
      await requestWorkspaceShare(identity.anonymousId, cs.buildShareSnapshot())
    } catch (err) {
      setShareError(describeShareError(err))
    }
  }

  async function handleOpenSharedWorkspace(entry) {
    setShareError(null)
    setShareLoading(true)
    try {
      const snapshot = await readSharedWorkspace(entry.shareId)
      if (!snapshot) {
        setShareError('That shared workspace is no longer available.')
        return
      }
      setActiveShare({ entry, snapshot })
      // Lets the teacher's roster show who currently has a share open, live —
      // separate from the throwaway viewer state itself, which never reaches
      // Firebase by design (see SharedWorkspaceViewer).
      if (identity?.anonymousId) {
        writeStudentInteraction(identity.anonymousId, { viewingShareId: entry.shareId })
      }
    } catch (err) {
      setShareError(describeShareError(err))
    } finally {
      setShareLoading(false)
    }
  }

  function handleCloseSharedWorkspace() {
    setActiveShare(null)
    if (identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { viewingShareId: null })
    }
  }

  // The one deliberate bridge from a shared workspace into the student's own
  // work. Routed through the normal change handlers so it persists exactly like
  // their own typing would; everything else in the viewer is throwaway.
  function handleCopySharedWorkspace(copy) {
    applySharedWorkspaceCopy(copy, cs)
    handleCloseSharedWorkspace()
  }

  async function handleCancelShare() {
    setShareError(null)
    try {
      await cancelWorkspaceShare(identity.anonymousId)
    } catch {
      // Withdrawing is best-effort; the teacher can still decline it.
    }
  }
  // Quizzes are hosted activities; isQuizTask keeps their few quiz-only rules. Match and
  // fill-in-the-gaps mark themselves when complete (completion 'auto').
  const isQuizTask = isLegacyQuizTask(task)
  const isAutoEvaluatedQuiz = isQuizTask && getTaskActivity(task)?.completion === 'auto'
  const isInformationTask = task?.taskType === 'information'
  // An activity hosted by the task's workspace module (code_arrange): still a code task (Run,
  // sandbox, share), with the activity's ModuleWorkspace in place of the module's workspace.
  const isCodeArrangeTask = isModuleHostedActivityTask(task)
  // Hosted activities (taskType 'activity' and quizzes) are not code tasks: no Run, personal
  // sandbox, share or carry. ActivityHost renders them (see LessonTaskContent).
  const isActivityTask = isHostedActivityTask(task)

  // ─── Side-quests ──────────────────────────────────────────────────────────
  // Only on a code task's own screen: not over a teacher broadcast, a classmate's work, peer
  // help, or the solo explainer / completion slides.
  const sideQuestsVisible =
    sideQuests.available &&
    !isQuizTask &&
    !isInformationTask &&
    !isActivityTask &&
    !isCodeArrangeTask &&
    !isForcedTeacherLive &&
    !viewingExplainerSlide &&
    !viewingCompletionScreen
  const openSideQuest =
    sideQuestsVisible && sideQuests.openIndex != null
      ? (sideQuests.quests.find((quest) => quest.index === sideQuests.openIndex) ?? null)
      : null

  // ─── Peer help ────────────────────────────────────────────────────────────
  const peerHelpAvailable =
    phase === 'lesson' &&
    !teacherPresentation &&
    !!identity?.anonymousId &&
    !isQuizTask &&
    !isInformationTask &&
    !isActivityTask &&
    !isCodeArrangeTask &&
    supportsPeerHelp(displayedLesson.type)
  const ownPeerOffer = peerHelp.ownRequestId
    ? (session?.peerHelpOffers?.[peerHelp.ownRequestId] ?? null)
    : null
  const peerOffers =
    phase === 'lesson' && !teacherPresentation && !peerHelp.helpingRequestId
      ? visiblePeerHelpOffers({
          session,
          identityId: identity?.anonymousId,
          ownRequestId: peerHelp.ownRequestId,
        }).filter((offer) => !dismissedPeerOffers.has(offer.requestId))
      : []
  const isHelpingClassmate = !!peerHelp.helpingRequestId && phase === 'lesson'
  const showPeerHelperWorkspace = isHelpingClassmate && peerHelperOpen && !activeShare

  // ✋ Help is one tap; where a classmate could help, a bubble then asks.
  async function handleHelpTap() {
    await handleNeedHelp()
    if (peerHelpAvailable && !peerHelp.ownRequestId) setPeerAskOpen(true)
  }

  async function handleClassmateCanHelp() {
    setPeerAskOpen(false)
    setPeerHelpError(null)
    try {
      await peerHelp.requestPeerHelp(cs.buildShareSnapshot())
    } catch (err) {
      setPeerHelpError(err?.message ?? 'Could not ask a classmate. Your teacher is still coming.')
    }
  }

  async function claimPeerOffer(requestId) {
    setPeerClaimBusy(true)
    setPeerClaimError(null)
    const ok = await peerHelp.claimOffer(requestId)
    setPeerClaimBusy(false)
    if (!ok) {
      setPeerClaimError('Someone else is already helping. Thank you!')
      setDismissedPeerOffers((set) => new Set(set).add(requestId))
    }
  }

  async function handleHelpOut(requestId) {
    if (!peerHelp.hasPromised) {
      setPeerPromiseFor(requestId)
      return
    }
    await claimPeerOffer(requestId)
  }

  // Applies a teacher-approved change to the student's own work, through the normal change
  // handlers so it saves like their typing. False when it can't be applied safely.
  async function handleAcceptPeerEdit(item) {
    if (isViewingPrev || isForcedTeacherLive || cs.inPersonalSandbox) return false
    if (item.file) {
      const file = (cs.files ?? []).find((f) => f.name === item.file)
      if (!file) return false
      const next = applyPeerEdit(file.content, item.edits)
      if (next == null) return false
      cs.handleFileChange(item.file, next)
      return true
    }
    const next = applyPeerEdit(cs.code, item.edits)
    if (next == null) return false
    cs.handleCodeChange(next)
    return true
  }

  const canNavigateNextSolo = allowUnrestrictedTaskNavigation || isSolo
  // Also present (bypassing the debounce) whenever the slide is actually being viewed —
  // e.g. just after an arrival auto-opened it, before the debounce has had time to settle —
  // so SoloNav's index (below) always has a real pseudo entry to point at while the slide
  // is open, rather than briefly falling back to the real task's own index.
  const explainerPseudoTask =
    (explainerPseudoActive || viewingExplainerSlide) && task ? makeExplainerPseudoTask(task) : null
  // Solo mode only — a live/presentation session ends when the teacher ends it, not when
  // the student runs out of tasks, so there's nothing to append there. Only present once
  // the student has actually reached the last real task, so Next can step past it; SoloNav's
  // displayTotal (below) keeps the "Task X of Y" label reading the real count until then.
  const completionPseudoTask =
    isSolo && (currentIndex === flatTasks.length - 1 || viewingCompletionScreen)
      ? makeCompletionPseudoTask()
      : null
  const flatTasksForNav = [
    ...(explainerPseudoTask
      ? insertPseudoTaskBefore(flatTasks, currentTaskId, explainerPseudoTask)
      : flatTasks),
    ...(completionPseudoTask ? [completionPseudoTask] : []),
  ]
  // SoloNav's Previous/Next step relative to a single index, so while the slide (or the
  // completion screen) is showing, that index must point at the pseudo entry itself
  // rather than the real task's own slot — otherwise Next would skip past it entirely.
  // The completion pseudo task is always last, so its index is just the array length.
  const currentIndexForNav = viewingCompletionScreen
    ? flatTasksForNav.length - 1
    : explainerPseudoTask
      ? flatTasksForNav.findIndex(
          (t) => t.id === (viewingExplainerSlide ? explainerPseudoTask.id : currentTaskId)
        )
      : currentIndex
  // Composed lessons can mix module types, so the lesson's own `.type` (or the type of
  // whichever task the student happens to be on) isn't a reliable answer to "what
  // playground should this lead to." Resolve it from the last *code* task instead —
  // the module the student actually finished the lesson working in — skipping any
  // trailing information/quiz tasks that have no module of their own.
  const lastCodeTask = [...flatTasks].reverse().find(isCodeTask)
  const lastCodeTaskType = lastCodeTask ? getTaskModuleType(lesson, lastCodeTask) : null
  const canOpenPlayground = isSolo && PLAYGROUND_LESSON_TYPES.includes(lastCodeTaskType)
  function handleOpenPlayground() {
    window.location.hash = `#/playground/${lastCodeTaskType}`
  }
  // Each module's lifecycle.hasComplete decides; a non-module type (e.g. a composed lesson's
  // information task) keeps the historical files-based rule, which is HTML's.
  const hasCompleteSolution = (
    displayedModule ?? getModuleDefinition('html')
  ).lifecycle.hasComplete(task)
  const taskCodeStages = task?.codeStages ?? []
  // capabilities.stageReveal: 'progressive' modules (python, html) reveal support stages as
  // read-only references and preview the complete solution before offering to load it; the
  // others ('offer') offer the next stage to load after two failed checks.
  const revealsProgressively = displayedModule?.capabilities.stageReveal === 'progressive'
  const hasUnifiedCodeStages =
    revealsProgressively &&
    taskCodeStages.some((stage) => ['starter', 'complete'].includes(stage?.role))
  const revealableStages = getRevealableStages(task)
  const hasProgressiveReferences = revealsProgressively && revealableStages.length > 0
  const nextStageIndex = cs.offeredStageIndex + 1
  const canOfferNextStage =
    isSolo &&
    !revealsProgressively &&
    !hasProgressiveReferences &&
    !displayCheckPassed &&
    cs.checkFailCount >= 2 &&
    nextStageIndex < taskCodeStages.length
  const revealedSupportStageIndexes = Object.keys(cs.supportStageReveals ?? {}).map(Number)
  const allReferencesRevealed = revealableStages.every(({ index }) =>
    revealedSupportStageIndexes.includes(index)
  )
  const stagesExhausted =
    isSolo &&
    hasCompleteSolution &&
    !displayCheckPassed &&
    cs.checkFailCount >= 2 &&
    (hasUnifiedCodeStages || hasProgressiveReferences
      ? allReferencesRevealed
      : nextStageIndex >= taskCodeStages.length)
  // Python previews the complete solution read-only in the reference area before offering
  // to load it into the editor. Other lesson types have no such preview yet, so they
  // keep the original single-step "load complete solution" offer.
  const canOfferCompletePreview =
    revealsProgressively && stagesExhausted && !cs.completePreviewShown
  const canOfferCompleteSolution = revealsProgressively
    ? stagesExhausted && cs.completePreviewShown
    : stagesExhausted
  const explainerShowsComplete = false
  const activeModule = getModuleDefinition(activeLesson.type)
  const hasPersonalSandbox = !!activeModule?.lifecycle.hasPersonalSandbox(activeLesson)
  const canOfferPersonalSandbox =
    (phase === 'lesson' || isSolo) &&
    hasPersonalSandbox &&
    !isActivityTask &&
    displayCheckPassed &&
    !cs.inPersonalSandbox &&
    !isForcedTeacherLive

  const isPaused =
    !isForcedTeacherLive && (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  // The teacher's live class poll (src/shared/classPolls.js): a corner card on live lesson
  // screens, read-only on the presentation window. Results are tallied here only for showing
  // once the teacher shows them (and the presentation's answer count).
  const activePoll =
    (phase === 'lesson' || phase === 'sandbox') && (teacherPresentation || identity?.anonymousId)
      ? getActivePoll(session)
      : null
  const activePollTally =
    activePoll && (teacherPresentation || activePoll.showResults)
      ? tallyPoll(session, activePoll.pollId)
      : null
  // Poll tasks in the lesson show the class split from the live session (PollQuiz).
  const pollTaskClass =
    phase === 'lesson' && (teacherPresentation || identity?.anonymousId)
      ? {
          session,
          anonymousId: teacherPresentation ? null : identity?.anonymousId,
          presentation: !!teacherPresentation,
        }
      : null
  const myPollChoice =
    activePoll && !teacherPresentation
      ? getStudentPollChoice(session, identity?.anonymousId, activePoll.pollId)
      : null

  const myStudentTeacherEdit = session?.students?.[identity?.anonymousId]
  // Modules a teacher can live-edit declare capabilities.teacherEditor (and its consent copy).
  const canTeacherEditType = !!activeModuleCaps?.teacherEditor
  const isTeacherEditing =
    !teacherPresentation &&
    !!myStudentTeacherEdit?.teacherEditAcceptedAt &&
    canTeacherEditType &&
    (phase === 'lesson' || phase === 'solo')
  const showTeacherEditConsent =
    !teacherPresentation &&
    !!myStudentTeacherEdit?.teacherEditRequestedAt &&
    !myStudentTeacherEdit?.teacherEditAcceptedAt &&
    canTeacherEditType
  const showStageChangeConsent =
    !teacherPresentation &&
    !!myStudentTeacherEdit?.teacherStageRequestedAt &&
    !myStudentTeacherEdit?.teacherStageAcceptedAt
  const teacherLiveCode = myStudentTeacherEdit?.teacherLiveCode ?? ''
  const teacherLiveFiles = decodeSessionFiles(
    myStudentTeacherEdit?.teacherLiveFiles,
    decodeFileKey,
    'html'
  )
  const teacherLiveActiveFile = myStudentTeacherEdit?.teacherLiveActiveFile ?? null
  const teacherLiveWorkspace = myStudentTeacherEdit?.teacherLiveWorkspace ?? null
  const teacherLiveArcadeDesign = myStudentTeacherEdit?.teacherLiveArcadeDesign ?? null

  const taskProgressControl = !isSandbox ? (
    <TaskProgressDots
      compact
      tasks={visibleTasks}
      currentTaskId={currentTaskId}
      viewingTaskId={viewingTaskId}
      isSolo={isSolo}
      pseudoTask={
        explainerPseudoTask
          ? {
              id: explainerPseudoTask.id,
              title: explainerPseudoTask.title,
              beforeTaskId: currentTaskId,
            }
          : null
      }
      canSelectTask={(id) => {
        if (!isSolo) return true
        const idIdx = flatTasks.findIndex((t) => t.id === id)
        return (
          allowUnrestrictedTaskNavigation || idIdx <= currentIndex || idIdx === currentIndex + 1
        )
      }}
      onDotClick={(id) => {
        if (isSolo) {
          if (id !== currentTaskId || viewingExplainerSlide) handleSoloNavigate(id)
        } else if (id < currentTaskId) {
          setViewingTaskId(id === currentTaskId ? null : id)
        }
      }}
    />
  ) : null

  const topBarRight = teacherPresentation ? (
    <div style={s.presentationControls}>
      <ClassCountdownPill
        countdown={classCountdown}
        serverTimeOffset={serverTimeOffset}
        variant="presentation"
      />
      <button
        className="btn-ghost"
        style={s.presentationBtn}
        disabled={currentIndex <= 0}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
        aria-label="Previous"
        title="Previous task"
      >
        ‹ Prev
      </button>
      <span style={s.presentationTaskLabel}>
        Task {currentIndex + 1} / {flatTasks.length}
      </span>
      <button
        className="btn-ghost"
        style={s.presentationBtn}
        disabled={currentIndex >= flatTasks.length - 1}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
        aria-label="Next"
        title="Next task"
      >
        Next ›
      </button>
      <button
        className={isTeacherLiveActive ? 'btn-danger' : 'btn-primary'}
        style={s.presentationBtn}
        onClick={handleToggleTeacherLive}
        aria-label={isTeacherLiveActive ? 'Stop Live to Students' : 'Go Live to Students'}
        title={isTeacherLiveActive ? 'Stop Live to Students' : 'Go Live to Students'}
      >
        {isTeacherLiveActive ? '■ Stop Live' : '📡 Go Live'}
      </button>
      <div style={s.presenterLayoutGroup} role="group" aria-label="Presentation layout">
        {[
          { key: 'explainer', label: 'Explainer', full: 'Explainer only' },
          { key: 'both', label: 'Both', full: 'Explainer and code' },
          { key: 'code', label: 'Code', full: 'Code only' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            className="btn-ghost"
            style={s.presentationBtn}
            aria-pressed={presenterLayout === opt.key}
            title={opt.full}
            onClick={() => setPresenterLayout(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div style={s.topBarTaskControls}>
      <ClassCountdownPill countdown={classCountdown} serverTimeOffset={serverTimeOffset} />
      {!previewMode && <SoundsToggleButton soundsOff={!!session?.badgeSettings?.soundsOff} />}
      {(phase === 'lesson' || phase === 'sandbox') && (
        <CodingMomentsPill
          moments={badgeCelebrations.moments}
          muted={badgeCelebrations.muted}
          onMutedChange={badgeCelebrations.setMuted}
          soundsOff={!!session?.badgeSettings?.soundsOff}
        />
      )}
      {canRequestHelp && (
        <HelpRequestButton
          requested={myNeedsHelp}
          onAskTeacher={handleHelpTap}
          style={s.needHelpBtn}
        />
      )}
      {canShareWorkspace && (
        <button
          type="button"
          className="btn-ghost"
          style={s.needHelpBtn}
          onClick={sharePending ? handleCancelShare : handleShareWorkspace}
          title={
            sharePending
              ? 'Waiting for your teacher to check it — click to withdraw'
              : 'Offer your work to the class (your teacher approves it first)'
          }
          aria-label={sharePending ? 'Waiting for teacher' : 'Share with class'}
        >
          {sharePending ? '⏳ Waiting' : '📤 Share'}
        </button>
      )}
      {canSeeSharedWork && (
        <SharedWorkspacePanel
          sharedWorkspaces={session?.sharedWorkspaces}
          viewerId={identity?.anonymousId}
          onOpen={handleOpenSharedWorkspace}
        />
      )}
      {shareError && (
        <span style={s.shareError} role="alert" title={shareError}>
          {shareError}
        </span>
      )}
      {taskProgressControl}
      {isSandbox && canDownloadCode ? (
        <button
          className="btn-ghost"
          style={s.downloadCodeBtn}
          onClick={handleDownloadLessonSandboxCode}
        >
          Download sandbox code
        </button>
      ) : (
        !isSolo &&
        !isForcedTeacherLive &&
        currentDownloadableTask && (
          <button
            className="btn-ghost"
            style={s.downloadCodeBtn}
            onClick={handleDownloadCurrentCode}
          >
            Download code
          </button>
        )
      )}
      {isSolo && (
        <SoloNav
          flatTasks={flatTasksForNav}
          currentIndex={currentIndexForNav}
          displayTotal={
            flatTasksForNav.length - (completionPseudoTask && !viewingCompletionScreen ? 1 : 0)
          }
          cs={cs}
          canNavigateNextSolo={canNavigateNextSolo}
          onNavigate={handleSoloNavigate}
          compact
        />
      )}
    </div>
  )

  const transitionKey = `${phase}-${cs.inPersonalSandbox ? 'personal-sandbox' : (viewingTaskId ?? currentTaskId)}`
  // The slide's direction: moving to an earlier task slides back. The personal sandbox has no
  // place in the lesson, so entering or leaving it slides forward.
  const transitionTaskIndex = cs.inPersonalSandbox
    ? -1
    : flatTasks.findIndex((t) => t.id === (viewingTaskId ?? currentTaskId))
  const transitionOrder = transitionTaskIndex >= 0 ? transitionTaskIndex : null

  const page = (
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
        lessonNumber={lesson.lessonNumber}
        displayName={
          isPresentationStudentViewer
            ? `Other Student — ${session.teacherLive.sourceStudentName ?? 'Student'}`
            : teacherPresentation
              ? 'Presentation'
              : identity?.displayName
        }
        isSandbox={isSandbox}
        isSolo={teacherPresentation ? undefined : isSolo}
        right={topBarRight}
        singleRow
      />
      {!teacherPresentation && (
        <TeacherMessageToast
          message={session?.students?.[identity?.anonymousId]?.teacherMessage}
          pushedAt={session?.students?.[identity?.anonymousId]?.teacherMessagePushedAt}
        />
      )}
      {!teacherPresentation && (
        <BadgeCelebration
          award={badgeCelebrations.card}
          badge={
            badgeCelebrations.card
              ? resolveBadge(badgeCelebrations.card.badgeId, [], badgeCelebrations.card.decision)
              : null
          }
          onDone={badgeCelebrations.cardDone}
        />
      )}
      <BadgeClassToast
        toast={badgeCelebrations.toast}
        badge={
          badgeCelebrations.toast
            ? resolveBadge(badgeCelebrations.toast.badgeId, [], {
                badge: badgeCelebrations.toast.badge,
              })
            : null
        }
        presentation={teacherPresentation}
        onDone={badgeCelebrations.toastDone}
      />
      {nudgeBannerVisible && <NudgeBanner onDismiss={dismissNudge} />}
      <ThumbsUpToast shownAt={thumbsUpAt} />
      <TimesUpBanner shownAt={timesUpAt} presentation={teacherPresentation} />
      {nudgeEnabled && <NudgePermissionPrompt />}
      {showTeacherEditConsent && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={s.consentHeader}>
              <span style={s.consentIcon}>✏️</span>
              <span style={s.consentTitle}>Your teacher wants to help</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>{activeModule?.meta.teacherEditCopy?.consent}</p>
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
              <p style={s.consentText}>
                Your teacher would like to set your code to a different stage. Your current work
                will be replaced.
              </p>
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
                onClick={() => {
                  cs.badgeSignals.reportTopicOpen(pendingTopicId, {
                    source: 'teacher',
                    via: 'teacher',
                  })
                  setOpenTopicId(pendingTopicId)
                  setPendingTopicId(null)
                }}
              >
                Open it
              </button>
            </div>
          </div>
        </div>
      )}
      {videoCallPrompt}
      {isSolo && !teacherPresentation && lesson.recordingUrl && (
        <RecordingWidget recordingUrl={lesson.recordingUrl} />
      )}
      {fullscreenPromptVisible && (
        <div style={s.consentOverlay}>
          <div style={s.consentModal}>
            <div style={{ ...s.consentHeader, background: '#0284c7' }}>
              <span style={s.consentIcon}>⛶</span>
              <span style={s.consentTitle}>Your teacher would like you to go fullscreen</span>
            </div>
            <div style={s.consentBody}>
              <p style={s.consentText}>
                Going fullscreen hides your browser's address bar and tabs.
              </p>
            </div>
            <div style={s.consentFooter}>
              <button
                className="btn-ghost-outline"
                style={{ fontSize: 13 }}
                onClick={() => setFullscreenDismissedAt(fullscreenRequestedAt)}
              >
                Not now
              </button>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={handleGoFullscreen}>
                Go Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
      {activePoll && (
        <ClassPollCard
          poll={activePoll}
          choice={myPollChoice}
          tally={activePollTally}
          presentation={teacherPresentation}
          onAnswer={
            teacherPresentation
              ? undefined
              : (index) =>
                  answerPoll(identity.anonymousId, activePoll.pollId, index).catch((err) =>
                    console.warn('Could not save the poll answer:', err)
                  )
          }
        />
      )}
      <StudentStatusBanners
        // A "Show to class" broadcast has its own bar (StudentLivePanelBar) while watching.
        isForcedTeacherLive={isForcedTeacherLive && !isStudentPanelBroadcast}
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
      {isHelpingClassmate && !peerHelperOpen && (
        <div style={s.peerHelpingBar} role="status">
          <span>🤝 Helping a classmate</span>
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={() => setPeerHelperOpen(true)}
          >
            Open
          </button>
        </div>
      )}
      {peerHelpError && (
        <div style={s.peerHelpingBar} role="alert">
          <span>{peerHelpError}</span>
          <button
            type="button"
            className="btn-ghost-outline"
            onClick={() => setPeerHelpError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {peerAskOpen && peerHelpAvailable && !peerHelp.ownRequestId && (
        <PeerHelpAskBubble onYes={handleClassmateCanHelp} onNo={() => setPeerAskOpen(false)} />
      )}
      {peerOffers.length > 0 && !peerHelp.ownRequestId && (
        <PeerHelpOfferToast
          offer={peerOffers[0]}
          busy={peerClaimBusy}
          error={peerClaimError}
          onHelp={() => handleHelpOut(peerOffers[0].requestId)}
          onDismiss={() =>
            setDismissedPeerOffers((set) => new Set(set).add(peerOffers[0].requestId))
          }
        />
      )}
      {peerPromiseFor && (
        <HelperPromiseDialog
          onCancel={() => setPeerPromiseFor(null)}
          onAgree={async () => {
            const requestId = peerPromiseFor
            setPeerPromiseFor(null)
            try {
              await peerHelp.makeHelperPromise()
              await claimPeerOffer(requestId)
            } catch {
              setPeerClaimError('Could not start helping. Try again in a moment.')
            }
          }}
        />
      )}
      {peerHelp.ownRequestId && phase === 'lesson' && !teacherPresentation && (
        <PeerHelpInbox
          offer={ownPeerOffer}
          state={peerHelp.ownState}
          inbox={peerHelp.ownInbox}
          snapshot={peerHelp.ownSnapshot}
          lessonType={peerHelp.ownSnapshot?.lessonType ?? displayedLesson.type}
          task={task}
          onRespond={(itemId, response) => peerHelp.respondToItem(itemId, response).catch(() => {})}
          onAcceptEdit={handleAcceptPeerEdit}
          onNotOk={(itemId) => peerHelp.flagNotOk(itemId).catch(() => {})}
          onEnd={() => peerHelp.endOwnRequest().catch(() => {})}
          onClose={() => peerHelp.endOwnRequest().catch(() => {})}
        />
      )}
      {sideQuestsVisible &&
        !openSideQuest &&
        !showPeerHelperWorkspace &&
        !activeShare &&
        !(isStudentPanelBroadcast && livePanelCopy) && (
          <SideQuestPrompt
            quests={sideQuests.quests}
            isDone={sideQuests.isDone}
            onOpen={sideQuests.openQuest}
          />
        )}
      {isStudentPanelBroadcast && !activeShare && (
        <StudentLivePanelBar
          sourceStudentName={session?.teacherLive?.sourceStudentName}
          watching={watchingStudentPanel}
          copyOpen={!!livePanelCopy}
          onWatch={() => setWatchingStudentPanel(true)}
          onStopWatching={() => setWatchingStudentPanel(false)}
          onTryCopy={() => {
            setWatchingStudentPanel(false)
            setLivePanelCopy({
              entry: {
                shareId: `live-${session.teacherLive.updatedAt ?? Date.now()}`,
                sharerName: session.teacherLive.sourceStudentName,
              },
              snapshot: teacherLiveToSnapshot(session.teacherLive),
            })
          }}
        />
      )}
      <div
        style={
          isSolo &&
          !isSandbox &&
          (isQuizTask || isInformationTask || viewingExplainerSlide || viewingCompletionScreen)
            ? { ...s.body, overflow: 'hidden' }
            : s.body
        }
        // Keyboard Wizard: listed shortcuts pressed on the lesson work area (the editor, Blockly
        // or the Desktop surface; see workAreaSurfaceOf). Capture phase, so an editor keymap
        // that handles the key can't hide it.
        onKeyDownCapture={cs.badgeSignals.handleWorkAreaKeyDown}
      >
        {showPeerHelperWorkspace ? (
          <PeerHelperWorkspace
            lesson={lesson}
            requestId={peerHelp.helpingRequestId}
            snapshot={peerHelp.helpingSnapshot}
            state={peerHelp.helpingState}
            inbox={peerHelp.helpingInbox}
            review={peerHelp.helpingReview}
            notesEnabled={!!session?.peerHelpSettings?.notesEnabled}
            isMobile={isMobile}
            onRequestLatest={() => peerHelp.requestLatestSnapshot().catch(() => {})}
            onFinish={() => peerHelp.finishHelping().catch(() => {})}
            onMark={peerHelp.sendMark}
            onHint={peerHelp.sendHint}
            onSubmitEdit={peerHelp.submitEdit}
            onSubmitNote={peerHelp.submitNote}
          />
        ) : activeShare ? (
          <SharedWorkspaceViewer
            lesson={lesson}
            entry={activeShare.entry}
            snapshot={activeShare.snapshot}
            copyTargetTaskId={currentTaskId}
            isMobile={isMobile}
            onClose={handleCloseSharedWorkspace}
            onCopyToMyEditor={handleCopySharedWorkspace}
          />
        ) : isStudentPanelBroadcast && livePanelCopy ? (
          // A throwaway, runnable copy of the work on show: nothing is saved and nothing can
          // be copied out of it into the student's own editor.
          <SharedWorkspaceViewer
            lesson={lesson}
            entry={livePanelCopy.entry}
            snapshot={livePanelCopy.snapshot}
            isMobile={isMobile}
            title={`▶ ${livePanelCopy.entry.sharerName ?? 'A classmate'}’s work`}
            subtitle="Try it! Your own code is safe."
            copyBlocked
            onClose={() => setLivePanelCopy(null)}
          />
        ) : openSideQuest ? (
          // A side-quest in its own throwaway workspace: the task's code stays as it was.
          <SideQuestWorkspace
            key={`${sideQuests.taskId}#${openSideQuest.index}`}
            lesson={displayedLesson}
            lessonId={lessonId}
            task={task}
            quest={openSideQuest}
            questCount={sideQuests.quests.length}
            moduleType={displayedLesson.type}
            anonymousId={identity?.anonymousId ?? null}
            persist={sideQuests.persist}
            done={sideQuests.isDone(openSideQuest.index)}
            isMobile={isMobile}
            onToggleDone={() => sideQuests.toggleDone(openSideQuest.index)}
            onClose={sideQuests.closeQuest}
            onRun={({ error }) => sideQuests.reportRun(openSideQuest.index, { error })}
          />
        ) : (
          <PollTaskClassContext.Provider value={pollTaskClass}>
            <LessonTaskContent
              lesson={displayedLesson}
              task={task}
              cs={taskCs}
              lessonId={lessonId}
              identityId={effectiveIdentity?.anonymousId}
              sandboxExplainer={session?.sandboxExplainer}
              activeStudentView={session?.activeStudentView}
              viewingTaskId={viewingTaskId}
              currentTaskId={currentTaskId}
              transitionKey={transitionKey}
              transitionOrder={transitionOrder}
              previewMode={previewMode}
              isSandbox={isSandbox}
              isViewingPrev={isViewingPrev}
              isForcedTeacherLive={isForcedTeacherLive}
              isMobile={isMobile}
              isQuizTask={isQuizTask}
              isAutoEvaluatedQuiz={isAutoEvaluatedQuiz}
              isInformationTask={isInformationTask}
              badgeWall={badgeWall}
              isActivityTask={isActivityTask}
              displayAnswer={displayAnswer}
              isViewingExplainerSlide={viewingExplainerSlide}
              isViewingCompletionScreen={viewingCompletionScreen}
              onOpenPlayground={canOpenPlayground ? handleOpenPlayground : undefined}
              soloCompanion={soloCompanion}
              onTrySoloChallenge={soloCompanion ? handleTrySoloChallenge : undefined}
              onReplayLesson={handleReplayLesson}
              isCodeArrangeTask={isCodeArrangeTask}
              displayCode={displayCode}
              displayArcadeDesign={displayArcadeDesign}
              displayTurtleResult={displayTurtleResult}
              displaySpriteState={displaySpriteState}
              displayCursor={displayCursor}
              displayBlockDrag={displayBlockDrag}
              displayCodeArrangeSlots={displayCodeArrangeSlots}
              displayCodeArrangeCursor={displayCodeArrangeCursor}
              displayFiles={displayFiles}
              displayActiveFile={displayActiveFile}
              displayOutput={displayOutput}
              displayRunStatus={displayRunStatus}
              displayCheckPassed={displayCheckPassed}
              displayCheckAttempted={displayCheckAttempted}
              displayCheckSuggestion={displayCheckSuggestion}
              displaySelection={displaySelection}
              displayOutputCollapsed={displayOutputCollapsed}
              isLiveCopyBlocked={isLiveCopyBlocked}
              displayFs={displayFs}
              displayDesktop={displayDesktop}
              isTeacherEditing={isTeacherEditing}
              teacherLiveCode={teacherLiveCode}
              teacherLiveFiles={teacherLiveFiles}
              teacherLiveActiveFile={teacherLiveActiveFile}
              teacherLiveWorkspace={teacherLiveWorkspace}
              teacherLiveArcadeDesign={teacherLiveArcadeDesign}
              teacherLiveReferencePayload={session?.teacherLiveReference}
              canOfferNextStage={canOfferNextStage}
              canOfferCompletePreview={canOfferCompletePreview}
              canOfferCompleteSolution={canOfferCompleteSolution}
              canOfferPersonalSandbox={canOfferPersonalSandbox}
              explainerShowsComplete={explainerShowsComplete}
              presenterLayout={teacherPresentation ? presenterLayout : 'both'}
              onTopicOpen={phase === 'lesson' ? handleTopicOpen : undefined}
              onTopicClose={phase === 'lesson' ? handleTopicClose : undefined}
              openTopicId={phase === 'lesson' ? openTopicId : null}
              onVisiblePanesChange={handleVisiblePanesChange}
              highlightedPanes={highlightedPanes}
              forcedPaneCommand={forcedPaneCommand}
            />
          </PollTaskClassContext.Provider>
        )}
      </div>
    </div>
  )

  // Presentation annotations (src/app/liveInk): the Presentation window draws, students in the
  // live lesson see it. Solo, preview and the sandbox phase stay inert.
  const liveInkRole = teacherPresentation
    ? 'teacher'
    : !soloMode && !previewMode && phase === 'lesson' && identity?.anonymousId
      ? 'student'
      : null

  return (
    <BadgeSignalsContext.Provider value={badgeSignalsContextValue}>
      <LiveInkProvider
        lessonId={lessonId}
        role={liveInkRole}
        subscribe={subscribeLiveInk}
        createWriter={createLiveInkWriter}
        // Annotating a code task's explainer opens it for students who have it collapsed,
        // through the existing whole-class pane command.
        onExplainerAnnotate={() =>
          pushClassPaneCommand?.({ mode: 'force', panes: ['instructions'] })
        }
      >
        {page}
      </LiveInkProvider>
    </BadgeSignalsContext.Provider>
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
    gap: 6,
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  presentationBtn: {
    fontSize: 13,
    padding: '5px 10px',
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
  // One row that never wraps (the top bar keeps a fixed height): the task dots shrink or scroll
  // inside the space that's left, and every other control keeps its natural width.
  topBarTaskControls: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  downloadCodeBtn: {
    fontSize: 13,
    padding: '5px 10px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  peerHelpingBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    background: 'rgba(13, 148, 136, 0.10)',
    color: 'var(--colour-text)',
    borderBottom: '2px solid #0d9488',
    flexShrink: 0,
  },
  needHelpBtn: {
    fontSize: 13,
    padding: '5px 10px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  shareError: {
    fontSize: 12,
    color: 'var(--colour-danger)',
    maxWidth: 180,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexShrink: 1,
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
