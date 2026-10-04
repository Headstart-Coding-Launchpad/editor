import React, { useEffect, useRef, useState, useMemo } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { useLatestRef } from '../hooks/useLatestRef'
import { decodeFileKey } from '../../shared/fileKeys'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import {
  findTaskById,
  deriveTaskContext,
  buildStageOptions,
  getCompleteStage,
  getRevealableStages,
} from '../../shared/taskUtils'
import { TEACHER_LIVE_REVEAL_KEY } from '../../shared/taskStages.js'
import PresenceBadge from './PresenceBadge'
import ScratchWorkspace from '../../modules/scratch/ScratchWorkspace.jsx'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { TEACHER_LIVE_REFERENCE_TYPES } from '../studentLiveDisplay'
import DropdownMenu from './student-modal/DropdownMenu'
import TeacherPeerHelpStudentPanel from './peerHelp/TeacherPeerHelpStudentPanel'
import MessageCompose from './student-modal/MessageCompose'
import OverrideDropdown from './student-modal/OverrideDropdown'
import { PaneFocusControls } from './student-modal/PaneFocusDropdown'
import StudentWorkspaceBody from './student-modal/StudentWorkspaceBody'
import ShareRequestPanel from './student-modal/ShareRequestPanel'
import { HIGHLIGHT_EMOJI_OPTIONS } from './student-modal/constants'
import { countShownLineHints, getMirrorLineHintSets } from './student-modal/mirrorLineHints'
import { formatTaskItemProgress, getTaskItemProgress } from '../taskItemProgress'
import {
  allowsStudentBroadcast,
  isModuleHostedActivityTask,
} from '../../activities/registry.pure.js'
import { readActivityAnswer } from '../../activities/state.js'
import ActivityDeviceBadge from '../../activities/ui/ActivityDeviceBadge.jsx'
import BadgeAwardDialog from './badges/BadgeAwardDialog'
import { heldBadgeIds } from '../../badges/badgeDisplay'

// Modes match AUTO_REVEAL_MODES (src/shared/taskStages.js); null turns it off.
const AUTO_REVEAL_OPTIONS = [
  { mode: null, label: 'Off' },
  { mode: 'first', label: 'First hint' },
  { mode: 'support', label: 'All hints (no solution)' },
  { mode: 'solution', label: 'Solution' },
]

function getModuleDisplayState(module, raw) {
  if (!module) return null
  if (raw != null && raw !== '') return module.deserializeState ? module.deserializeState(raw) : raw
  return module.defaultState ?? null
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function StudentModal({
  student,
  lesson,
  session,
  topics,
  isLive,
  isLiveForAll,
  isLiveForAllPanel = false,
  onGoLive,
  onGoLiveForAll,
  onStopLive,
  onClose,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onRemoteReset,
  onOverrideCheck,
  onDismissHelp,
  // usePeerHelp (teacher): this student's peer help request and helper switch.
  peerHelp = null,
  onSendToTopic,
  onSendTopicToAll,
  onSendMessage,
  onSendVideoCallLink,
  onRequestTeacherEdit,
  onPushTeacherLiveCode,
  onCommitTeacherEdit,
  onCancelTeacherEdit,
  onRequestTeacherStage,
  onClearTeacherStage,
  onAddHighlight,
  onRemoveHighlight,
  onRevealSupportStage,
  onSetTeacherLiveReference,
  onPushTeacherPaneCommand,
  onTeacherAnswerEdit,
  onRemoteRun,
  onReadPendingShare,
  onApproveShare,
  onDeclineShare,
  onRequestShareSnapshot,
  onRequestFullscreen,
  onNudge,
  onThumbsUp,
  onSetAutoReveal,
  onDecideBadge,
  onRevokeBadge,
  catalogueBadges = [],
}) {
  const overlayRef = useRef(null)
  const iframeRef = useRef(null)
  const [showTopicLibrary, setShowTopicLibrary] = useState(false)
  const [answerEditing, setAnswerEditing] = useState(false)
  const [remoteRunSent, setRemoteRunSent] = useState(false)
  // Editing is per student + task: switching student (Prev/Next) or the class
  // moving on must never leave the next board silently editable.
  useEffect(() => {
    setAnswerEditing(false)
  }, [student.anonymousId, session?.currentTaskId])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [fullscreenRequested, setFullscreenRequested] = useState(false)
  const [nudged, setNudged] = useState(false)
  const [thumbsUpSent, setThumbsUpSent] = useState(false)
  const [showBadgeDialog, setShowBadgeDialog] = useState(false)

  // Teacher highlight: select a range in the mirrored view, tag it, send it
  const [pendingHighlight, setPendingHighlight] = useState(null) // {from, to} | null
  const [highlightEmoji, setHighlightEmoji] = useState(HIGHLIGHT_EMOJI_OPTIONS[0])
  const [highlightNote, setHighlightNote] = useState('')

  // Teacher live-edit state machine
  const [teacherEditState, setTeacherEditState] = useState('idle') // 'idle' | 'requesting' | 'editing'
  const [teacherCode, setTeacherCode] = useState('')
  const [teacherFiles, setTeacherFiles] = useState([])
  const [teacherArcadeDesign, setTeacherArcadeDesign] = useState(null)
  const [teacherWorkspace, setTeacherWorkspace] = useState('code')
  const [teacherScratchState, setTeacherScratchState] = useState(null)
  const [declinedNotice, setDeclinedNotice] = useState(false)
  const pushDebounceRef = useRef(null)
  useEffect(() => () => clearTimeout(pushDebounceRef.current), [])

  // Teacher stage-change state machine
  const [stageRequestState, setStageRequestState] = useState('idle') // 'idle' | 'requesting'
  const [stagePendingAction, setStagePendingAction] = useState(null)
  const [stageDeclinedNotice, setStageDeclinedNotice] = useState(false)

  // React to student accepting or declining
  useEffect(() => {
    if (teacherEditState === 'requesting') {
      if (student.teacherEditAcceptedAt) {
        const initialCode = student.currentCode ?? ''
        setTeacherCode(initialCode)
        setTeacherFiles(files)
        setTeacherArcadeDesign(student.currentArcadeDesign ?? null)
        setTeacherWorkspace(teacherEditor?.workspace ?? 'code')
        if (teacherEditor?.surface === 'blocks') {
          setTeacherScratchState(parseScratchState(initialCode))
        }
        setTeacherEditState('editing')
        setDeclinedNotice(false)
        onPushTeacherLiveCode?.(
          student.anonymousId,
          teacherEditor?.surface === 'files'
            ? { files, activeFile: files[0]?.name ?? null }
            : {
                code: initialCode,
                ...(teacherEditor?.design
                  ? { arcadeDesign: student.currentArcadeDesign ?? null }
                  : {}),
                ...(teacherEditor?.workspace ? { workspace: teacherEditor.workspace } : {}),
              }
        )
      } else if (!student.teacherEditRequestedAt) {
        setTeacherEditState('idle')
        setDeclinedNotice(true)
        setTimeout(() => setDeclinedNotice(false), 4000)
      }
    }
    if (
      teacherEditState === 'editing' &&
      !student.teacherEditAcceptedAt &&
      !student.teacherEditRequestedAt
    ) {
      setTeacherEditState('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.teacherEditRequestedAt, student.teacherEditAcceptedAt])

  // React to student accepting or declining stage change
  useEffect(() => {
    if (stageRequestState === 'requesting') {
      if (student.teacherStageAcceptedAt) {
        onRemoteReset(student.anonymousId, stagePendingAction)
        onClearTeacherStage?.(student.anonymousId)
        setStageRequestState('idle')
        setStagePendingAction(null)
      } else if (!student.teacherStageRequestedAt) {
        setStageRequestState('idle')
        setStagePendingAction(null)
        setStageDeclinedNotice(true)
        setTimeout(() => setStageDeclinedNotice(false), 4000)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.teacherStageRequestedAt, student.teacherStageAcceptedAt])

  // Clean up edit state when navigating to a different student
  useEffect(() => {
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherFiles([])
    setTeacherArcadeDesign(null)
    setTeacherWorkspace('code')
    setTeacherScratchState(null)
    setDeclinedNotice(false)
    setStageRequestState('idle')
    setStagePendingAction(null)
    setStageDeclinedNotice(false)
    setShowMessageModal(false)
    setShowBadgeDialog(false)
    setPendingHighlight(null)
    setHighlightNote('')
  }, [student.anonymousId])

  function handleTeacherCodeChange(newCode) {
    setTeacherCode(newCode)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { code: newCode })
    }, 120)
  }

  function handleScratchStateChange(workspaceStates) {
    setTeacherScratchState(workspaceStates)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { code: JSON.stringify(workspaceStates) })
    }, 300)
  }

  function handleTeacherFileChange(filename, content) {
    const nextFiles = teacherFiles.map((file) =>
      file.name === filename ? { ...file, content } : file
    )
    setTeacherFiles(nextFiles)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { files: nextFiles })
    }, 120)
  }

  function handleTeacherHtmlTabChange(activeFile) {
    onPushTeacherLiveCode?.(student.anonymousId, { activeFile })
  }

  function handleTeacherWorkspaceChange(workspace) {
    setTeacherWorkspace(workspace)
    onPushTeacherLiveCode?.(student.anonymousId, { workspace })
  }

  function handleTeacherArcadeDesignChange(nextDesign) {
    setTeacherArcadeDesign(nextDesign)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { arcadeDesign: nextDesign })
    }, 300)
  }

  function handleStartEdit() {
    onRequestTeacherEdit?.(student.anonymousId)
    setTeacherEditState('requesting')
    setDeclinedNotice(false)
  }

  function handleCommitEdit() {
    clearTimeout(pushDebounceRef.current)
    if (teacherEditor?.surface === 'blocks') {
      onCommitTeacherEdit?.(student.anonymousId, { code: JSON.stringify(teacherScratchState) })
      setTeacherScratchState(null)
    } else if (teacherEditor?.surface === 'files') {
      onCommitTeacherEdit?.(student.anonymousId, { files: teacherFiles })
      setTeacherFiles([])
    } else if (teacherEditor?.design) {
      onCommitTeacherEdit?.(student.anonymousId, {
        code: teacherCode,
        arcadeDesign: teacherArcadeDesign,
      })
      setTeacherArcadeDesign(null)
    } else {
      onCommitTeacherEdit?.(student.anonymousId, { code: teacherCode })
    }
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherWorkspace('code')
  }

  function handleCancelEdit() {
    clearTimeout(pushDebounceRef.current)
    onCancelTeacherEdit?.(student.anonymousId)
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherFiles([])
    setTeacherArcadeDesign(null)
    setTeacherWorkspace('code')
    setTeacherScratchState(null)
  }

  function handleRequestStage(action) {
    onRequestTeacherStage?.(student.anonymousId, action)
    setStagePendingAction(action)
    setStageRequestState('requesting')
    setStageDeclinedNotice(false)
  }

  function handleRevealSupportStage(stageIndex, stage) {
    if (!task?.id) return
    onRevealSupportStage?.(student.anonymousId, task.id, stageIndex, {
      source: 'teacher',
      stageLabel: stage?.label || `Stage ${stageIndex + 1}`,
    })
  }

  // One-off "Reveal live code": logged like a stage reveal, which is also what shows it on the
  // student's screen — for this task only, so it drops off on the next task.
  function handleRevealTeacherLiveReference() {
    if (!task?.id) return
    onRevealSupportStage?.(student.anonymousId, task.id, TEACHER_LIVE_REVEAL_KEY, {
      source: 'teacher',
      stageLabel: "Teacher's live code",
    })
  }

  function handleCancelStage() {
    onClearTeacherStage?.(student.anonymousId)
    setStageRequestState('idle')
    setStagePendingAction(null)
  }

  function handleClose() {
    // Closing while actively editing must not silently discard the teacher's
    // in-progress work — commit it the same as clicking "Done Editing".
    // Only a still-pending edit *request* (nothing typed yet) has nothing to
    // save, so that path still cancels.
    if (teacherEditState === 'editing') handleCommitEdit()
    else if (teacherEditState === 'requesting') handleCancelEdit()
    if (stageRequestState !== 'idle') handleCancelStage()
    onClose?.()
  }

  function handleMirrorSelectionChange({ from, to }) {
    setPendingHighlight(from === to ? null : { from, to })
  }

  function handleSendHighlight(activeFile) {
    if (!pendingHighlight) return
    onAddHighlight?.(student.anonymousId, {
      file: activeFile,
      from: pendingHighlight.from,
      to: pendingHighlight.to,
      emoji: highlightEmoji,
      note: highlightNote.trim() || null,
    })
    setPendingHighlight(null)
    setHighlightNote('')
  }

  function handleCancelHighlight() {
    setPendingHighlight(null)
    setHighlightNote('')
  }

  function handleDismissHighlight(highlightId) {
    onRemoveHighlight?.(student.anonymousId, highlightId)
  }

  function handleNudge() {
    onNudge?.(student.anonymousId)
    setNudged(true)
    setTimeout(() => setNudged(false), 2000)
  }

  function handleRequestFullscreen() {
    onRequestFullscreen?.(student.anonymousId)
    setFullscreenRequested(true)
    setTimeout(() => setFullscreenRequested(false), 2000)
  }

  const files = decodeSessionFiles(student.currentFiles, decodeFileKey, 'html')
  const badgeCount = heldBadgeIds(session?.badges, student.anonymousId).length
  const task = findTaskById(lesson?.tasks, session?.currentTaskId)
  const taskLesson = getEffectiveLessonForTask(lesson, task)
  const {
    moduleType,
    isQuiz,
    isInformation,
    isActivity: isActivityTask,
    activity,
    isSessionSandbox,
  } = deriveTaskContext(taskLesson, task, session)
  // The task's module (null on a hosted activity outside a session sandbox): its capabilities
  // gate the teacher controls below.
  const moduleDefinition = getModuleDefinition(moduleType)
  const moduleCaps = moduleDefinition?.capabilities ?? null
  // How the student's work is mirrored (capabilities.studentMirror): see StudentWorkspaceBody.
  const mirror = moduleCaps?.studentMirror ?? null
  // What the teacher live-edits in (capabilities.teacherEditor); null = no live edit.
  const teacherEditor = moduleCaps?.teacherEditor ?? null
  // A module-hosted activity (code_arrange) shows its board, not the module's mirror.
  const isCodeArrangeTask = isModuleHostedActivityTask(task) && !isSessionSandbox
  // Hosted activity tasks show the activity (read-only, or editable via Edit answers) in place
  // of a workspace; quiz-like everywhere else in the header (no reveal, pane focus or share).
  const isActivity = isActivityTask && !isSessionSandbox
  const isQuizLike = isQuiz || isActivity
  const activityState = isActivity ? readActivityAnswer(task, student.currentAnswer) : null
  const itemProgress = isSessionSandbox ? null : getTaskItemProgress(task, student)
  // Match / Fill in the Gaps / Code Arrange: the teacher can edit the
  // student's answer directly (pushed live, see pushTeacherAnswerEdit).
  const supportsAnswerEdit =
    !!onTeacherAnswerEdit && (!!itemProgress || (isActivity && !!activity?.teacherEditable))
  // Runs the student's current code on the student's own device: any module with a Run
  // (capabilities.run is not 'none').
  const supportsRemoteRun =
    !!onRemoteRun &&
    !isQuiz &&
    !isInformation &&
    task?.interactionMode !== 'submit' &&
    !!moduleCaps &&
    moduleCaps.run !== 'none'

  function handleRemoteRun() {
    onRemoteRun?.(student.anonymousId)
    setRemoteRunSent(true)
    setTimeout(() => setRemoteRunSent(false), 2000)
  }
  const teacherAssisted =
    student.teacherAssistedTaskId != null &&
    String(student.teacherAssistedTaskId) === String(session?.currentTaskId)
  // Turtle edits go through the plain code editor below and commit as { code }.
  const supportsTeacherEdit = !!teacherEditor
  const lessonModule = getLessonModule(taskLesson?.type)
  // The module's own TeacherLiveView renders the 'blocks' and 'view' mirrors and the 'files'
  // and 'view' live-edit surfaces.
  const ModuleTeacherLiveView = lessonModule?.TeacherLiveView ?? null
  // Memoized on the raw code string: `student` is a live RTDB-fed object that
  // updates on every throttled cursor/block-drag tick while a Scratch student is
  // being watched, far more often than currentCode itself changes. Without this,
  // ScratchWorkspace's "load external state" effect (keyed on object identity)
  // reloads the mirrored workspace on every one of those renders, stomping the
  // live block-drag mirror's in-progress moveTo() with a stale reload.
  const isBlocksMirror = mirror === 'blocks'
  const scratchState = useMemo(
    () => (isBlocksMirror ? parseScratchState(student.currentCode) : null),
    [isBlocksMirror, student.currentCode]
  )
  const spriteState = isBlocksMirror ? (student.currentSpriteState ?? null) : null
  const cursorState = isBlocksMirror ? (student.currentCursor ?? null) : null
  const blockDragState = isBlocksMirror ? (student.currentBlockDrag ?? null) : null
  const moduleDisplayState =
    mirror === 'view' && ModuleTeacherLiveView
      ? getModuleDisplayState(lessonModule, student.currentCode)
      : null
  const iframeSrc =
    mirror === 'files' && !isQuiz && files.length
      ? lessonModule.runtime.buildPreviewSrc(
          { files, entryFile: task?.entryFile ?? 'index.html' },
          task
        )
      : null

  const [activeFile, setActiveFile] = useState(task?.entryFile ?? files[0]?.name ?? '')
  const activeFileObj = files.find((f) => f.name === activeFile) ?? files[0]

  // While a share is pending, the modal shows only the frozen snapshot the
  // class would receive — not this student's live workspace.
  const awaitingShareSnapshot =
    student.shareSnapshotRequestedAt != null && student.shareRequestedAt == null
  const showShareRequest =
    !!onReadPendingShare && (student.shareRequestedAt != null || awaitingShareSnapshot)

  // The task's 💡 line hints still on the watched student's code (the count the mirrored editor
  // shows in StudentWorkspaceBody); null when the task has none or the body shows no code.
  const mirrorLineHintSets =
    isInformation || isQuizLike || isCodeArrangeTask || showShareRequest
      ? null
      : getMirrorLineHintSets(task, {
          mirror,
          file: activeFileObj?.name ?? null,
          isSessionSandbox,
        })
  const mirroredHintCode =
    mirror === 'files'
      ? activeFileObj?.content
      : mirror === 'view'
        ? moduleDisplayState
        : student.currentCode
  const shownLineHintCount =
    mirrorLineHintSets && typeof mirroredHintCode === 'string'
      ? countShownLineHints(mirroredHintCode, mirrorLineHintSets)
      : null

  const hasOverride = !!student.checkOverridePushedAt
  const remoteSelection =
    !isLive || (mirror !== 'code' && student.currentSelection?.file !== activeFile)
      ? null
      : student.currentSelection

  const canHighlight =
    isLive &&
    !isInformation &&
    !isQuiz &&
    !isCodeArrangeTask &&
    !!moduleCaps?.highlights &&
    teacherEditState === 'idle'
  const highlightsForActiveFile = useMemo(() => {
    const raw = student.teacherHighlights
    if (!raw) return []
    return Object.entries(raw)
      .filter(([, h]) => (mirror === 'code' ? true : decodeFileKey(h.file) === activeFile))
      .map(([id, h]) => ({ id, from: h.from, to: h.to, emoji: h.emoji, note: h.note }))
  }, [student.teacherHighlights, mirror, activeFile])

  useEffect(() => {
    const liveFile =
      student.currentActiveFile ?? student.currentSelection?.file ?? student.currentActivity?.file
    if (!isLive || !liveFile || !files.some((file) => file.name === liveFile)) return
    setActiveFile(liveFile)
  }, [
    isLive,
    student.currentActiveFile,
    student.currentSelection?.file,
    student.currentActivity?.file,
  ])

  const stageOptions = buildStageOptions(task, taskLesson?.type)
  // The Reveal menu's support / complete stages (capabilities.teacherStageReveal).
  const supportsStageReveal = !!moduleCaps?.teacherStageReveal
  const revealableStages =
    !isInformation && !isQuizLike && supportsStageReveal ? getRevealableStages(task) : []
  const completeStage =
    !isInformation && !isQuizLike && supportsStageReveal ? getCompleteStage(task) : null
  const revealedSupportStages = session?.supportRevealLog?.[student.anonymousId]?.[task?.id] ?? {}
  // "Every task" reference: re-applied by the student's client on each task.
  const canSetAutoReveal = !!onSetAutoReveal && supportsStageReveal
  const autoRevealStage = student.autoRevealStage ?? null

  const supportsTeacherLiveReference = TEACHER_LIVE_REFERENCE_TYPES.includes(taskLesson?.type)
  // The Support menu's two sections.
  const canShowLiveReference =
    !!onSetTeacherLiveReference && !isInformation && !isQuizLike && supportsTeacherLiveReference
  const canRevealLiveReference = canShowLiveReference && !!onRevealSupportStage
  const canReveal =
    (!!onRevealSupportStage && revealableStages.length > 0) ||
    canSetAutoReveal ||
    canShowLiveReference
  const canSetStage = !!onRemoteReset && !isInformation && !isQuiz && stageOptions.length > 0
  // Live code has two modes: pinned ("Keep showing", every task until turned off) and a
  // one-off reveal for this task only (a supportRevealLog entry, like a stage reveal).
  const teacherLiveReferencePinned = !!student.teacherLiveReferenceVisible
  const teacherLiveReferencePinnedForClass = !!session?.teacherLiveReferenceVisibleToAll
  const teacherLiveReferenceRevealed = !!revealedSupportStages[TEACHER_LIVE_REVEAL_KEY]
  const teacherLiveReferenceMatchesTask =
    !!session?.teacherLiveReference?.active && session?.teacherLiveReference?.taskId === task?.id

  // Read through a ref: the listener is bound once, and handleClose → handleCommitEdit
  // must see the teacher's latest typed code/files, not the values from when it was bound.
  // Escape closes the badge picker first, then the modal.
  const handleCloseRef = useLatestRef(() =>
    showBadgeDialog ? setShowBadgeDialog(false) : handleClose()
  )
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCloseRef])

  return (
    <div
      ref={overlayRef}
      className="ui-modal-backdrop"
      style={s.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div style={s.modal}>
        {/* Modal header: one fixed-height line. Name and small status chips on the left (they
            scroll sideways rather than wrap); student switching, Support, Run, More and close on
            the right. Occasional actions (Nudge, Focus, Go Live for All, Award badge, …) live in
            More so the line never wraps at common widths. */}
        <div style={s.header}>
          <div style={s.headerLeft} data-testid="student-modal-status">
            <span style={s.name}>{student.displayName}</span>
            <PresenceBadge student={student} session={session} />
            {isLive && (
              <span style={s.liveBadge}>
                ● {isLiveForAll ? (isLiveForAllPanel ? 'SHOWN TO CLASS' : 'LIVE FOR ALL') : 'LIVE'}
              </span>
            )}
            {/* Teacher-only badge count; never shown on student screens. */}
            {badgeCount > 0 && (
              <span
                style={s.overrideBadge}
                title="Badges awarded this lesson (only you see this)"
                data-testid="modal-badge-count"
              >
                🏅 {badgeCount}
              </span>
            )}
            {nudged && <span style={s.overrideBadge}>✓ Nudged</span>}
            {student.checkPassed && !isSessionSandbox && <span style={s.checkBadge}>✅</span>}
            {teacherAssisted && (
              <span
                style={s.overrideBadge}
                title="You edited this student's answer on this task — the report marks it teacher assisted"
              >
                ✏️ Teacher assisted
              </span>
            )}
            {isActivity && <ActivityDeviceBadge state={activityState} />}
            {itemProgress && (
              <span
                style={s.overrideBadge}
                title="Items the student has filled in (and got right, where marked per item)"
                data-testid="item-progress"
              >
                🧩 {formatTaskItemProgress(itemProgress)}
              </span>
            )}
            {hasOverride && (
              <span style={s.overrideBadge}>
                {student.checkOverridePassed ? 'Overridden: Passed' : 'Overridden: Failed'}
              </span>
            )}
            {student.needsHelp && (
              <button
                style={s.helpedBtn}
                onClick={() => onDismissHelp?.(student.anonymousId)}
                title="Mark as helped"
              >
                Help Needed — Helped ✓
              </button>
            )}
            {student.pasteLog?.[task?.id]?.count > 0 && (
              <span
                style={s.supportBadge}
                title={`Pasted ${student.pasteLog[task.id].chars} characters into the editor on this task`}
              >
                📋 Pasted ×{student.pasteLog[task.id].count}
              </span>
            )}
            {autoRevealStage && (
              <span
                style={s.supportBadge}
                title="A reference opens automatically for this student on every task"
              >
                📖 Every task: {AUTO_REVEAL_OPTIONS.find((o) => o.mode === autoRevealStage)?.label}
              </span>
            )}
            {shownLineHintCount != null && teacherEditState !== 'editing' && (
              <span
                style={s.supportBadge}
                title="The lesson's 💡 line hints still on this student's code (hints on lines the student has changed are gone)"
                data-testid="modal-line-hint-count"
              >
                💡 {shownLineHintCount} {shownLineHintCount === 1 ? 'hint' : 'hints'} showing
              </span>
            )}
            {(teacherLiveReferencePinned || teacherLiveReferencePinnedForClass) && (
              <span
                style={s.supportBadge}
                title={
                  teacherLiveReferencePinned
                    ? 'Your live code shows for this student on every task until you turn it off'
                    : 'Your live code shows for the whole class on every task until you turn it off'
                }
              >
                📌 Live code: kept on
              </span>
            )}
            {Object.keys(revealedSupportStages).length > 0 && (
              <span style={s.supportBadge} title="Student has opened a stage reference">
                Reference opened
              </span>
            )}
            {student.currentTopicId &&
              (() => {
                const topic = topics?.find((t) => t.id === student.currentTopicId)
                return (
                  <span
                    style={s.topicBadge}
                    title={`Student has topic "${topic?.title ?? student.currentTopicId}" open`}
                  >
                    📖 {topic?.title ?? student.currentTopicId}
                  </span>
                )
              })()}
          </div>
          <div style={s.headerRight}>
            <div style={s.navButtons}>
              <button
                style={{ ...s.navBtn, opacity: hasPrev ? 1 : 0.35 }}
                disabled={!hasPrev}
                onClick={onPrev}
                title="Previous student"
              >
                ←
              </button>
              <button
                style={{ ...s.navBtn, opacity: hasNext ? 1 : 0.35 }}
                disabled={!hasNext}
                onClick={onNext}
                title="Next student"
              >
                →
              </button>
            </div>

            {/* A stage request waits on the student's consent. */}
            {canSetStage && stageRequestState === 'requesting' && (
              <>
                <span style={sEd.waitingText}>Waiting for {student.displayName}…</span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: '5px 10px' }}
                  onClick={handleCancelStage}
                >
                  Cancel
                </button>
              </>
            )}

            {/* Support: the Reveal references and Set Stage, in labelled sections. */}
            {(canReveal || (canSetStage && stageRequestState !== 'requesting')) && (
              <DropdownMenu
                label={stageDeclinedNotice ? 'Support · declined' : 'Support'}
                buttonClassName="btn-ghost"
                buttonStyle={
                  stageDeclinedNotice ? { color: '#fca5a5', borderColor: '#fca5a5' } : undefined
                }
                title={
                  stageDeclinedNotice
                    ? 'The student declined your last stage change'
                    : 'Reveal a reference or set this student’s code stage'
                }
                panelStyle={s.menuPanel}
              >
                {(close) => (
                  <>
                    {canReveal && (
                      <>
                        <div style={s.menuHeadingFirst}>Reveal</div>
                        {canRevealLiveReference && (
                          <button
                            style={sTo.toolBtn}
                            disabled={
                              !teacherLiveReferenceMatchesTask || teacherLiveReferenceRevealed
                            }
                            title={
                              teacherLiveReferenceMatchesTask
                                ? 'Show your live code for this task only'
                                : "Will work once you're presenting this task in Presentation View"
                            }
                            onClick={() => {
                              close()
                              handleRevealTeacherLiveReference()
                            }}
                          >
                            {teacherLiveReferenceRevealed
                              ? 'Opened: live code'
                              : 'Reveal live code'}
                          </button>
                        )}
                        {revealableStages.map(({ stage, index }) => {
                          const alreadyRevealed = !!revealedSupportStages[index]
                          return (
                            <button
                              key={index}
                              style={sTo.toolBtn}
                              disabled={alreadyRevealed}
                              onClick={() => {
                                close()
                                handleRevealSupportStage(index, stage)
                              }}
                            >
                              {alreadyRevealed ? 'Opened: ' : 'Reveal: '}
                              {stage.label || `Stage ${index + 1}`}
                            </button>
                          )
                        })}
                        {completeStage && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              handleRevealSupportStage(completeStage.index, completeStage.stage)
                              onRemoteReset?.(
                                student.anonymousId,
                                `reveal_stage_${completeStage.index}`
                              )
                            }}
                          >
                            Reveal solution: {completeStage.stage.label || 'Complete'}
                          </button>
                        )}
                        {canSetAutoReveal && (
                          <>
                            <div style={s.autoRevealHeading}>Show on every task</div>
                            {AUTO_REVEAL_OPTIONS.map(({ mode, label }) => (
                              <button
                                key={mode ?? 'off'}
                                style={sTo.toolBtn}
                                aria-pressed={autoRevealStage === mode}
                                onClick={() => {
                                  close()
                                  onSetAutoReveal(student.anonymousId, mode)
                                }}
                              >
                                {autoRevealStage === mode ? '✓ ' : ''}
                                {label}
                              </button>
                            ))}
                          </>
                        )}
                        {canShowLiveReference && (
                          <>
                            {!canSetAutoReveal && (
                              <div style={s.autoRevealHeading}>Show on every task</div>
                            )}
                            <button
                              style={sTo.toolBtn}
                              aria-pressed={teacherLiveReferencePinned}
                              disabled={
                                !teacherLiveReferencePinned && !teacherLiveReferenceMatchesTask
                              }
                              title={
                                teacherLiveReferencePinned
                                  ? 'Stop showing your live code to this student'
                                  : teacherLiveReferenceMatchesTask
                                    ? 'Keep showing your live code on every task until you turn it off'
                                    : "Will work once you're presenting this task in Presentation View"
                              }
                              onClick={() => {
                                close()
                                onSetTeacherLiveReference(
                                  student.anonymousId,
                                  !teacherLiveReferencePinned
                                )
                              }}
                            >
                              {teacherLiveReferencePinned
                                ? '📌 Live code: kept on'
                                : '📌 Keep showing live code'}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {canSetStage && stageRequestState !== 'requesting' && (
                      <>
                        <div style={canReveal ? s.menuHeading : s.menuHeadingFirst}>Set stage</div>
                        {stageDeclinedNotice && (
                          <div style={s.menuNote}>The student declined the last change.</div>
                        )}
                        {stageOptions.map((opt) => (
                          <button
                            key={opt.value}
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              handleRequestStage(opt.value, opt.label)
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </DropdownMenu>
            )}

            {supportsRemoteRun && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 13, padding: '5px 12px', whiteSpace: 'nowrap' }}
                onClick={handleRemoteRun}
                disabled={!student.online}
                title={
                  student.online
                    ? "Run this student's code on their own screen"
                    : 'Student is offline'
                }
              >
                {remoteRunSent ? 'Run sent ✓' : '▶ Run on student'}
              </button>
            )}

            {supportsAnswerEdit && (
              <button
                type="button"
                className={answerEditing ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize: 13, padding: '5px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setAnswerEditing((editing) => !editing)}
                title="Change this student's answers — updates their screen live"
              >
                {answerEditing ? 'Done editing' : '✏️ Edit answers'}
              </button>
            )}

            {/* Override dropdown */}
            {onOverrideCheck && task?.check != null && (
              <OverrideDropdown student={student} task={task} onOverrideCheck={onOverrideCheck} />
            )}

            {/* Active edit states (shown outside More dropdown while in progress) */}
            {onRequestTeacherEdit &&
              supportsTeacherEdit &&
              !isInformation &&
              !isQuiz &&
              teacherEditState === 'editing' && (
                <>
                  <button
                    className="btn-primary"
                    style={{
                      fontSize: 13,
                      padding: '5px 12px',
                      background: '#0f766e',
                      borderColor: '#0f766e',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={handleCommitEdit}
                  >
                    Done Editing
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13, padding: '5px 10px' }}
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                </>
              )}
            {onRequestTeacherEdit &&
              supportsTeacherEdit &&
              !isInformation &&
              !isQuiz &&
              teacherEditState === 'requesting' && (
                <>
                  <span style={sEd.waitingText}>Waiting for {student.displayName}…</span>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13, padding: '5px 10px' }}
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                </>
              )}

            {/* Declined notice */}
            {onRequestTeacherEdit &&
              supportsTeacherEdit &&
              !isInformation &&
              !isQuiz &&
              declinedNotice && <span style={sEd.declinedNotice}>Student declined</span>}

            {/* A running broadcast can always be stopped from the header. */}
            {!isInformation && isLiveForAll && (
              <button
                className="btn-danger"
                style={{ fontSize: 13, padding: '5px 14px', whiteSpace: 'nowrap' }}
                onClick={onStopLive}
              >
                Stop Live
              </button>
            )}

            {/* A transient 👍 "on the right track" toast on the student's screen. */}
            {onThumbsUp && student.online && (
              <button
                className="btn-ghost"
                style={{ fontSize: 13, padding: '5px 10px', whiteSpace: 'nowrap' }}
                disabled={thumbsUpSent}
                onClick={() => {
                  onThumbsUp(student.anonymousId)
                  setThumbsUpSent(true)
                  setTimeout(() => setThumbsUpSent(false), 2000)
                }}
                title="Send a 👍: tells this student they're on the right track"
                aria-label={`Send ${student.displayName} a thumbs up`}
              >
                {thumbsUpSent ? '✓ Sent' : '👍'}
              </button>
            )}

            {/* More: badge, nudge, broadcast, topic, message, edit code, focus — grouped when idle */}
            {teacherEditState === 'idle' &&
              (() => {
                const hasEdit = !!(
                  onRequestTeacherEdit &&
                  supportsTeacherEdit &&
                  !isInformation &&
                  !isQuiz
                )
                const hasTopic = !!(onSendToTopic && topics?.length > 0)
                const hasMessage = !!onSendMessage
                const hasVideoCall = !!onSendVideoCallLink
                // A teacher cannot build the snapshot themselves: currentCode is
                // only fresh while activeStudentView matches. So this asks the
                // student's own device for one, then reuses the same preview and
                // Approve step as a student-initiated share.
                const hasShare =
                  !!onRequestShareSnapshot &&
                  !isInformation &&
                  !isQuizLike &&
                  student.shareRequestedAt == null &&
                  student.shareSnapshotRequestedAt == null
                const hasFullscreen = !!onRequestFullscreen
                const hasBadge = !!onDecideBadge
                const hasNudge = !!onNudge && student.online
                // Broadcasting a student's work is not offered on quiz or activity tasks
                // (teacher-only broadcasts there).
                const hasGoLiveForAll =
                  !!onGoLiveForAll &&
                  !isInformation &&
                  !isLiveForAll &&
                  allowsStudentBroadcast(task)
                const hasFocus = !!onPushTeacherPaneCommand && !isInformation && !isQuizLike
                if (
                  !hasBadge &&
                  !hasNudge &&
                  !hasGoLiveForAll &&
                  !hasEdit &&
                  !hasTopic &&
                  !hasMessage &&
                  !hasVideoCall &&
                  !hasShare &&
                  !hasFullscreen &&
                  !hasFocus
                )
                  return null
                return (
                  <DropdownMenu label="More" buttonClassName="btn-ghost" panelStyle={s.menuPanel}>
                    {(close) => (
                      <>
                        {hasBadge && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              setShowBadgeDialog(true)
                            }}
                          >
                            🏅 Award badge
                          </button>
                        )}
                        {hasNudge && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              handleNudge()
                            }}
                            title="Nudge: flash this student's tab and play a chime"
                          >
                            🔔 Nudge
                          </button>
                        )}
                        {hasGoLiveForAll && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              onGoLiveForAll()
                            }}
                            title="Show this student's work on every screen"
                          >
                            📡 Go Live for All
                          </button>
                        )}
                        {hasGoLiveForAll && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              onGoLiveForAll('panel')
                            }}
                            title="Offer this student's work to the class: everyone keeps coding and can watch it or try a copy"
                          >
                            📺 Show to class (keep coding)
                          </button>
                        )}
                        {hasEdit && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              handleStartEdit()
                            }}
                          >
                            ✏ {moduleDefinition?.meta.teacherEditCopy?.action}
                          </button>
                        )}
                        {hasTopic && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              setShowTopicLibrary(true)
                            }}
                          >
                            📖 Send Topic
                          </button>
                        )}
                        {hasMessage && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              setShowMessageModal(true)
                            }}
                          >
                            ✉ Message
                          </button>
                        )}
                        {hasVideoCall && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              onSendVideoCallLink(student.anonymousId)
                            }}
                          >
                            📹 Send Video Call Link
                          </button>
                        )}
                        {hasShare && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              onRequestShareSnapshot(student.anonymousId)
                            }}
                          >
                            📤 Share this with the class
                          </button>
                        )}
                        {hasFullscreen && (
                          <button
                            style={sTo.toolBtn}
                            onClick={() => {
                              close()
                              handleRequestFullscreen()
                            }}
                            title="Each student must click a prompt to accept — this can't force it"
                          >
                            {fullscreenRequested ? '✓ Requested' : '⛶ Ask to go fullscreen'}
                          </button>
                        )}
                        {/* Highlight/force a tab or the Instructions pane on this student's screen */}
                        {hasFocus && (
                          <section aria-label="Focus" style={s.menuSection}>
                            <div style={s.menuHeading}>Focus</div>
                            <PaneFocusControls
                              lessonType={taskLesson?.type}
                              onHighlight={(panes) =>
                                onPushTeacherPaneCommand(student.anonymousId, {
                                  mode: 'highlight',
                                  panes,
                                })
                              }
                              onForce={(panes) =>
                                onPushTeacherPaneCommand(student.anonymousId, {
                                  mode: 'force',
                                  panes,
                                })
                              }
                              onDone={close}
                            />
                          </section>
                        )}
                      </>
                    )}
                  </DropdownMenu>
                )
              })()}
          </div>
          <button
            className="btn-ghost"
            style={s.closeBtnHeader}
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* A pending share takes over the body. Showing the frozen snapshot and
            the live workspace at once invited approving one while looking at
            the other — they are different content, and only the snapshot is
            what the class would actually receive. */}
        {peerHelp && (
          <TeacherPeerHelpStudentPanel
            student={student}
            session={session}
            lesson={lesson}
            peerHelp={peerHelp}
          />
        )}
        {showShareRequest ? (
          <ShareRequestPanel
            student={student}
            lesson={taskLesson}
            fill
            onReadPendingShare={onReadPendingShare}
            onApprove={onApproveShare}
            onDecline={onDeclineShare}
            awaitingSnapshot={awaitingShareSnapshot}
          />
        ) : (
          <>
            {/* Content */}
            <div
              style={
                isInformation
                  ? s.bodyInformation
                  : (isQuiz && !isSessionSandbox) || isActivity
                    ? s.bodyQuiz
                    : isCodeArrangeTask
                      ? s.bodyCodeArrange
                      : mirror === 'code'
                        ? s.bodyPython
                        : mirror === 'blocks'
                          ? s.bodyScratch
                          : mirror === 'view' && ModuleTeacherLiveView
                            ? s.bodyFilesystem
                            : s.bodyHtml
              }
            >
              {teacherEditState === 'editing' && teacherEditor?.surface === 'blocks' ? (
                <ScratchWorkspace
                  key={`teacher-edit-scratch-${student.anonymousId}-${session?.currentTaskId}`}
                  task={task}
                  readOnly={false}
                  assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
                  initialState={parseScratchState(student.currentCode)}
                  onStateChange={handleScratchStateChange}
                />
              ) : teacherEditState === 'editing' &&
                teacherEditor?.surface === 'files' &&
                ModuleTeacherLiveView ? (
                <ModuleTeacherLiveView
                  lesson={taskLesson}
                  displayState={{ files: teacherFiles }}
                  readOnly={false}
                  onChange={handleTeacherFileChange}
                  onTabChange={handleTeacherHtmlTabChange}
                />
              ) : teacherEditState === 'editing' &&
                teacherEditor?.surface === 'view' &&
                ModuleTeacherLiveView ? (
                // The module's own view over the code string. Arcade reads the design and its
                // workspace tab (activeWorkspace / onWorkspaceChange); Electronics reports its
                // Breadboard/MicroPython tab through onTabChange.
                <ModuleTeacherLiveView
                  task={task}
                  student={student}
                  displayState={teacherCode}
                  design={teacherArcadeDesign}
                  activeWorkspace={teacherWorkspace}
                  readOnly={false}
                  onChange={handleTeacherCodeChange}
                  onDesignChange={handleTeacherArcadeDesignChange}
                  onWorkspaceChange={handleTeacherWorkspaceChange}
                  onTabChange={handleTeacherWorkspaceChange}
                />
              ) : teacherEditState === 'editing' ? (
                <div style={s.editorWrap}>
                  <CodeEditor
                    value={teacherCode}
                    language="python"
                    readOnly={false}
                    onChange={handleTeacherCodeChange}
                    style={{ height: '100%' }}
                  />
                </div>
              ) : (
                <StudentWorkspaceBody
                  lesson={taskLesson}
                  task={task}
                  student={student}
                  session={session}
                  isInformation={isInformation}
                  isQuiz={isQuiz}
                  isActivity={isActivity}
                  activityState={activityState}
                  isSessionSandbox={isSessionSandbox}
                  mirror={mirror}
                  isCodeArrangeTask={isCodeArrangeTask}
                  ModuleTeacherLiveView={ModuleTeacherLiveView}
                  moduleDisplayState={moduleDisplayState}
                  files={files}
                  activeFile={activeFile}
                  setActiveFile={setActiveFile}
                  activeFileObj={activeFileObj}
                  remoteSelection={remoteSelection}
                  scratchState={scratchState}
                  spriteState={spriteState}
                  cursorState={cursorState}
                  blockDragState={blockDragState}
                  iframeSrc={iframeSrc}
                  iframeRef={iframeRef}
                  canHighlight={canHighlight}
                  pendingHighlight={pendingHighlight}
                  highlights={highlightsForActiveFile}
                  onMirrorSelectionChange={handleMirrorSelectionChange}
                  onDismissHighlight={handleDismissHighlight}
                  highlightEmoji={highlightEmoji}
                  onHighlightEmojiChange={setHighlightEmoji}
                  highlightNote={highlightNote}
                  onHighlightNoteChange={setHighlightNote}
                  onSendHighlight={() => handleSendHighlight(activeFile)}
                  onCancelHighlight={handleCancelHighlight}
                  answerEditing={supportsAnswerEdit && answerEditing}
                  onEditAnswer={(payload) => onTeacherAnswerEdit?.(student.anonymousId, payload)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Topic library dialog */}
      {showTopicLibrary && topics?.length > 0 && (
        <TopicLibraryDialog
          topics={topics}
          topicType={lesson?.type}
          renderMarkdown={({ content, textScale, topicType: tt }) => (
            <MarkdownRenderer content={content} textScale={textScale} topicType={tt} />
          )}
          onClose={() => setShowTopicLibrary(false)}
          studentName={student.displayName}
          onSendToStudent={(topicId) => {
            onSendToTopic?.(student.anonymousId, topicId)
            setShowTopicLibrary(false)
          }}
          onSendToAll={
            onSendTopicToAll
              ? (topicId) => {
                  onSendTopicToAll(topicId)
                  setShowTopicLibrary(false)
                }
              : undefined
          }
        />
      )}

      {showBadgeDialog && onDecideBadge && (
        <BadgeAwardDialog
          students={[{ anonymousId: student.anonymousId, displayName: student.displayName }]}
          decisions={session?.badges ?? {}}
          catalogueBadges={catalogueBadges}
          taskId={session?.currentTaskId ?? null}
          onDecideBadge={onDecideBadge}
          onRevokeBadge={onRevokeBadge}
          onClose={() => setShowBadgeDialog(false)}
        />
      )}

      {/* Message compose modal */}
      {onSendMessage && (
        <MessageCompose
          student={student}
          onSendMessage={onSendMessage}
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />
      )}
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(1200px, 92vw)',
    height: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '0 14px',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    flexShrink: 0,
    gap: 8,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: '1 1 0',
    flexWrap: 'nowrap',
    // Many chips at once scroll sideways instead of wrapping the header.
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  menuPanel: { minWidth: 220, maxHeight: '70vh', overflowY: 'auto' },
  menuSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  menuHeadingFirst: {
    padding: '0 2px 2px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  menuHeading: {
    borderTop: '1px solid #e5e7eb',
    marginTop: 4,
    padding: '6px 2px 2px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  menuNote: { fontSize: 12, color: 'var(--colour-error-text)', padding: '0 2px' },
  closeBtnHeader: { flexShrink: 0, fontSize: 13, padding: '5px 10px' },
  navButtons: {
    display: 'flex',
    gap: 2,
    marginRight: 4,
  },
  navBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 30,
    height: 28,
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'background 0.15s',
  },
  name: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
    whiteSpace: 'nowrap',
  },
  liveBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#86efac',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  checkBadge: { fontSize: '1rem', flexShrink: 0 },
  autoRevealHeading: {
    borderTop: '1px solid #e5e7eb',
    marginTop: 4,
    padding: '6px 10px 2px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  nudgeBtn: {
    fontSize: '0.75rem',
    padding: '2px 8px',
    color: '#fff',
    background: 'rgba(255,255,255,0.18)',
    whiteSpace: 'nowrap',
  },
  helpedBtn: {
    background: '#f59e0b',
    border: 'none',
    borderRadius: 5,
    padding: '3px 10px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#fff',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  overrideBadge: {
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.75)',
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.12)',
    padding: '2px 7px',
    borderRadius: 999,
  },
  topicBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.75rem',
    color: '#bae6fd',
    padding: '3px 8px',
    background: 'rgba(14,165,233,0.2)',
    border: '1px solid rgba(14,165,233,0.4)',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  supportBadge: {
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    color: '#bfdbfe',
    whiteSpace: 'nowrap',
    background: 'rgba(37,99,235,0.24)',
    border: '1px solid rgba(191,219,254,0.45)',
    padding: '2px 7px',
    borderRadius: 999,
  },
  bodyPython: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bodyCodeArrange: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  bodyHtml: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    gap: 0,
  },
  bodyFilesystem: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  bodyScratch: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
  },
  bodyQuiz: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    alignItems: 'flex-start',
  },
  bodyInformation: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  editorWrap: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}

const sEd = {
  waitingText: {
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
  },
  declinedNotice: {
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: '#fca5a5',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
  },
}

const sTo = {
  toolBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
