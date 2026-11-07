import React, { useEffect, useRef, useState, useMemo } from 'react'
import { exampleOpenCount } from '../../shared/exampleOpens'
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
import {
  TEACHER_LIVE_REVEAL_KEY,
  formatStageLabel,
  getTeacherLivePin,
} from '../../shared/taskStages.js'
import { scrubResultOf } from '../scrubResult'
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
// Export work (tutor-only download / share link); loaded on first open.
const ExportWorkDialog = React.lazy(() => import('./student-modal/ExportWorkDialog'))
import { OverrideItems, OverrideFailModal } from './student-modal/OverrideDropdown'
import OneTapAwardButton from './badges/OneTapAwardButton'
import TipButton from './TipButton'
import { PaneFocusControls } from './student-modal/PaneFocusDropdown'
import {
  ControlHighlightControls,
  hasControlHighlightTargets,
} from './student-modal/ControlHighlightMenu'
import { highlightScopeForTask } from '../../shared/controlHighlight'
import StudentWorkspaceBody from './student-modal/StudentWorkspaceBody'
import StudentHintPanel from './student-modal/StudentHintPanel'
import ShareRequestPanel from './student-modal/ShareRequestPanel'
import StudentSideQuestView, { SideQuestViewToggle } from './student-modal/StudentSideQuestView'
import { studentOpenSideQuest } from '../../shared/sideQuests'
import TileHighlightBar from './student-modal/TileHighlightBar'
import { HIGHLIGHT_EMOJI_OPTIONS } from './student-modal/constants'
import { countShownLineHints, getMirrorLineHintSets } from './student-modal/mirrorLineHints'
import { formatTaskItemProgress, getTaskItemProgress } from '../taskItemProgress'
import {
  allowsStudentBroadcast,
  isModuleHostedActivityTask,
} from '../../activities/registry.pure.js'
import { readActivityAnswer, readStudentActivityState } from '../../activities/state.js'
import {
  activeTileHighlights,
  listTileHighlights,
  supportsTileHighlights,
  tileHighlightIdsForTarget,
} from '../../shared/tutorTileHighlights.js'
import ActivityDeviceBadge from '../../activities/ui/ActivityDeviceBadge.jsx'
import BadgeAwardDialog from './badges/BadgeAwardDialog'
import CopyCodeEditDialog from './CopyCodeEditDialog'
import { effectiveCopyCode } from '../../shared/copyCodeOverrides'
import { heldBadgeIds } from '../../badges/badgeDisplay'
import { formatTimeAgo } from '../../shared/timeAgo'
import { describeActivityDevice } from '../../activities/device.js'
import { readStudentHint } from '../studentHints.js'
import ModalStrip from './student-modal/ModalStrip'
import StudentModalLeftColumn from './student-modal/StudentModalLeftColumn'

// Modes match AUTO_REVEAL_MODES (src/shared/taskStages.js); null turns it off.
const AUTO_REVEAL_OPTIONS = [
  { mode: null, label: 'Off' },
  { mode: 'first', label: 'First hint' },
  { mode: 'support', label: 'All hints (no solution)' },
  { mode: 'solution', label: 'Solution' },
]

// The strip's "▶ Last run 12s ago": its own clock, so only this chip re-renders as it ages.
function LastRunAgo({ at }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [at])
  return <>▶ Last run {formatTimeAgo(at, now)?.replace('Just now', 'just now')}</>
}

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
  onSendHint,
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
  onSetCopyCodeOverride,
  onPushTeacherControlHighlight,
  onTeacherAnswerEdit,
  // Tutor tile highlights (useSession push/remove/clearTeacherTileHighlights).
  onPushTileHighlight,
  onRemoveTileHighlights,
  onClearTileHighlights,
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
  // The rules' pending badge suggestions (BadgeSuggestion[]), ranked at the top of the picker.
  badgeSuggestions = [],
  // Truthy (a fresh value each time) to show the student's side-quest rather than the task.
  sideQuestViewRequest = null,
  // Tutor-only: the class-list name this student is matched to (src/shared/roster/), or null.
  rosterName = null,
  // Tutor-only: the matched student's saved typing entries, newest first (useTypingHistory).
  typingEntries = null,
  // Held on a cross-lesson carry task (src/shared/roster/crossLessonCarry.js), and the tutor's
  // "Use the starter" override for this student.
  carryWaiting = false,
  onUseCarryStarter = null,
  // Where this student is in the grid's order ("3/9" between the arrows); both or neither.
  position = null,
  total = null,
  // The hints two or more students are seeing on this task (summariseCommonHints), offered
  // under the Hint button's caret.
  commonHints = null,
}) {
  const iframeRef = useRef(null)
  const [showTopicLibrary, setShowTopicLibrary] = useState(false)
  const [answerEditing, setAnswerEditing] = useState(false)
  // Tile highlight mode: a tap on the student's board highlights that blank for them.
  const [tileHighlightMode, setTileHighlightMode] = useState(false)
  const [tileHighlightNote, setTileHighlightNote] = useState('')
  const [remoteRunSent, setRemoteRunSent] = useState(false)
  // Editing is per student + task: switching student (Prev/Next) or the class
  // moving on must never leave the next board silently editable.
  useEffect(() => {
    setAnswerEditing(false)
    setTileHighlightMode(false)
    setTileHighlightNote('')
  }, [student.anonymousId, session?.currentTaskId])
  // 'main' or 'sideQuest' (StudentSideQuestView); a side-quest chip or the side-quest panel
  // opens the modal on the side-quest (sideQuestViewRequest changes each time).
  const [bodyView, setBodyView] = useState(sideQuestViewRequest ? 'sideQuest' : 'main')
  useEffect(() => {
    if (sideQuestViewRequest) setBodyView('sideQuest')
  }, [sideQuestViewRequest])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [fullscreenRequested, setFullscreenRequested] = useState(false)
  const [nudged, setNudged] = useState(false)
  const [thumbsUpSent, setThumbsUpSent] = useState(false)
  const [markFailOpen, setMarkFailOpen] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [showBadgeDialog, setShowBadgeDialog] = useState(false)
  const [showCopyCodeDialog, setShowCopyCodeDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  // A class hint picked from the Hint caret, to start the hint box from.
  const [hintPrefill, setHintPrefill] = useState('')
  // The left column (instructions, hint, Type this out) folded to a rail.
  const [leftCollapsed, setLeftCollapsed] = useState(false)

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
    setShowExportDialog(false)
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
  // Where the Highlight menu's targets come from: `activity:<id>` on a hosted activity (request
  // 133: the Keyboard's keys), else the task's effective module type.
  const highlightScope = isActivity ? highlightScopeForTask(task, null) : taskLesson?.type
  const activityState = isActivity ? readActivityAnswer(task, student.currentAnswer) : null
  const itemProgress = isSessionSandbox ? null : getTaskItemProgress(task, student)
  // Match / Fill in the Gaps / Code Arrange: the teacher can edit the
  // student's answer directly (pushed live, see pushTeacherAnswerEdit).
  const supportsAnswerEdit =
    !!onTeacherAnswerEdit && (!!itemProgress || (isActivity && !!activity?.teacherEditable))
  // Tutor tile highlights (src/shared/tutorTileHighlights.js): the activity says which boards
  // have them (code_arrange slot mode, Match, Fill in the Gaps drag mode).
  const supportsTileHighlight =
    !!onPushTileHighlight &&
    (isActivity || isCodeArrangeTask) &&
    session?.currentTaskId != null &&
    supportsTileHighlights(task)
  const tileHighlightList = useMemo(
    () =>
      supportsTileHighlight
        ? listTileHighlights(student.teacherTileHighlights, session?.currentTaskId)
        : [],
    [supportsTileHighlight, student.teacherTileHighlights, session?.currentTaskId]
  )
  // Drawn against the student's mirrored board: a highlight whose tile has moved is gone.
  const shownTileHighlights = useMemo(
    () =>
      tileHighlightList.length
        ? activeTileHighlights(tileHighlightList, readStudentActivityState(task, student))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tileHighlightList, task, student.currentAnswer, student.currentCodeArrangeSlots]
  )
  const shownTileHighlightCount = shownTileHighlights ? Object.keys(shownTileHighlights).length : 0

  // A tap on a blank in highlight mode: removes its highlight, or highlights the tile in it
  // (replacing any older entry on that blank) with the note typed so far.
  function handleTileHighlightTap(targetId, tileId) {
    const ids = tileHighlightIdsForTarget(tileHighlightList, targetId)
    if (shownTileHighlights?.[targetId]) {
      onRemoveTileHighlights?.(student.anonymousId, ids)
      return
    }
    onPushTileHighlight?.(student.anonymousId, {
      taskId: session?.currentTaskId,
      targetId,
      tileId,
      note: tileHighlightNote,
      replaceIds: ids,
    })
    setTileHighlightNote('')
  }

  function handleClearTileHighlights() {
    onClearTileHighlights?.(student.anonymousId)
  }
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
  // The student's open side-quest (StudentSideQuestView): a "Main task / Side-quest" switch.
  const sideQuestInfo = studentOpenSideQuest({ student, moduleType: taskLesson?.type, task })
  const showSideQuestView = bodyView === 'sideQuest' && !!sideQuestInfo

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
  // "See example" fences opened in this task's explainer (src/shared/exampleOpens.js).
  const examplesOpened = exampleOpenCount(session, student.anonymousId, task?.id)
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
  // The per-student value is three-way (getTeacherLivePin): a pin time, `false` (hidden for
  // this student while the class pin is on) or null (follows the class pin). The menu and
  // header chip show what the student actually gets, class pin included.
  const studentLivePin = student.teacherLiveReferenceVisible
  const teacherLiveReferencePinnedForClass = !!session?.teacherLiveReferenceVisibleToAll
  const teacherLiveReferenceHiddenForStudent =
    studentLivePin === false && teacherLiveReferencePinnedForClass
  const teacherLiveReferencePinned = !!getTeacherLivePin(
    studentLivePin,
    session?.teacherLiveReferenceVisibleToAll
  )
  const teacherLiveReferencePinnedForStudent = !!studentLivePin
  const teacherLiveReferenceRevealed = !!revealedSupportStages[TEACHER_LIVE_REVEAL_KEY]
  const teacherLiveReferenceMatchesTask =
    !!session?.teacherLiveReference?.active && session?.teacherLiveReference?.taskId === task?.id

  // Read through a ref: the listener is bound once, and handleClose → handleCommitEdit
  // must see the teacher's latest typed code/files, not the values from when it was bound.
  // Escape closes the export dialog or badge picker first, then the modal.
  const handleCloseRef = useLatestRef(() =>
    showExportDialog
      ? setShowExportDialog(false)
      : showCopyCodeDialog
        ? setShowCopyCodeDialog(false)
        : showBadgeDialog
          ? setShowBadgeDialog(false)
          : handleClose()
  )
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCloseRef])

  // ─── What the header, strip and Tools menu offer ─────────────────────────────
  const studentName = student.displayName
  const hasEdit = !!(
    teacherEditState === 'idle' &&
    onRequestTeacherEdit &&
    supportsTeacherEdit &&
    !isInformation &&
    !isQuiz
  )
  const hasTopic = !!(onSendToTopic && topics?.length > 0)
  const hasCopyCodeEdit = !!(
    onSetCopyCodeOverride &&
    task &&
    lessonModule?.supportsCopyCode === true &&
    !isInformation &&
    !isQuiz
  )
  const hasVideoCall = !!onSendVideoCallLink
  // A teacher cannot build the snapshot themselves: currentCode is only fresh while
  // activeStudentView matches. So this asks the student's own device for one, then reuses the
  // same preview and Approve step as a student-initiated share.
  const hasShare =
    !!onRequestShareSnapshot &&
    !isInformation &&
    !isQuizLike &&
    student.shareRequestedAt == null &&
    student.shareSnapshotRequestedAt == null
  const hasFullscreen = !!onRequestFullscreen
  const hasSupport = canReveal || (canSetStage && stageRequestState !== 'requesting')
  const hasRunOnStudent = supportsRemoteRun
  const hasAnswerEditItem = supportsAnswerEdit && !answerEditing
  const hasTileItem = supportsTileHighlight && !tileHighlightMode
  const hasMarkOverride = !!(onOverrideCheck && task?.check != null)
  // Export work: the dialog finds the tasks with work itself.
  const hasExport = !!lesson?.tasks?.length
  const hasNudge = !!onNudge && student.online
  // Broadcasting a student's work is not offered on quiz or activity tasks (teacher-only
  // broadcasts there).
  const canBroadcast = !!onGoLiveForAll && !isInformation && allowsStudentBroadcast(task)
  const hasGoLiveForAll = canBroadcast && !isLiveForAll
  const hasFocus = !!onPushTeacherPaneCommand && !isInformation && !isQuizLike
  // A hosted activity with its own targets (the Keyboard's keys) is offered too.
  const hasControlHighlight =
    !!onPushTeacherControlHighlight &&
    !isInformation &&
    (!isQuizLike || isActivity) &&
    hasControlHighlightTargets(highlightScope, isActivity ? task : null)
  const showEditModes = !!onRequestTeacherEdit && supportsTeacherEdit && !isInformation && !isQuiz
  const hasHint = !!onSendHint && !isInformation && !isSessionSandbox
  const classHints = hasHint ? (commonHints ?? []) : []

  // Where the class is in the lesson: "Task 2 · Move the cat" and a dot per task (short lessons).
  const lessonTasks = lesson?.tasks ?? []
  const taskIndex = task ? lessonTasks.findIndex((t) => String(t?.id) === String(task.id)) : -1
  const taskLabel = task
    ? taskIndex >= 0
      ? `Task ${taskIndex + 1} · ${task.title ?? ''}`
      : (task.title ?? '')
    : ''
  const showTaskDots = taskIndex >= 0 && lessonTasks.length > 1 && lessonTasks.length <= 12

  // ─── The "Only you see" strip, in priority order ─────────────────────────────
  const hint = isSessionSandbox ? null : readStudentHint(student, session?.currentTaskId)
  const pasted = student.pasteLog?.[task?.id]
  const scrubResult = isSessionSandbox ? null : scrubResultOf(student)
  const openTopic = student.currentTopicId
    ? topics?.find((t) => t.id === student.currentTopicId)
    : null
  const hasLastRun = typeof student.lastRunAt === 'number'
  const stripChips = [
    student.needsHelp && {
      key: 'help',
      tone: 'help',
      content: (
        <>
          🙋 Help needed
          <button
            type="button"
            style={s.helpedButton}
            onClick={() => onDismissHelp?.(student.anonymousId)}
            title="Mark as helped"
          >
            Helped ✓
          </button>
        </>
      ),
    },
    student.lastRunStatus === 'error' &&
      student.lastRunError && {
        key: 'error',
        tone: 'error',
        title: student.lastRunError,
        content: `⚠ ${student.lastRunError}`,
      },
    hint?.failStreak > 1 && {
      key: 'fail-streak',
      tone: 'info',
      title: 'Checks failed this many times in a row on this task',
      content: `💬 Failed ${hint.failStreak} in a row`,
    },
    shownLineHintCount > 0 &&
      teacherEditState !== 'editing' && {
        key: 'line-hints',
        tone: 'info',
        testId: 'modal-line-hint-count',
        title:
          "The lesson's 💡 line hints still on this student's code (hints on lines the student has changed are gone)",
        content: `💡 ${shownLineHintCount} line ${shownLineHintCount === 1 ? 'hint' : 'hints'} left in their code`,
      },
    carryWaiting && {
      key: 'carry',
      tone: 'info',
      testId: 'modal-carry-waiting',
      title:
        'Their task is held until their work from the earlier lesson is found. Match them to the class list, or start them from the starter.',
      content: (
        <>
          ⏳ Waiting for earlier work
          {onUseCarryStarter && (
            <button type="button" style={s.chipButton} onClick={() => onUseCarryStarter()}>
              Use the starter
            </button>
          )}
        </>
      ),
    },
    isLive &&
      isLiveForAll && {
        key: 'live',
        tone: 'live',
        content: `📡 ${isLiveForAllPanel ? 'SHOWN TO CLASS' : 'LIVE FOR ALL'}`,
      },
    declinedNotice &&
      showEditModes && {
        key: 'declined',
        tone: 'error',
        content: 'Student declined',
      },
    stageDeclinedNotice && {
      key: 'stage-declined',
      tone: 'error',
      content: 'Declined the stage change',
    },
    nudged && { key: 'nudged', tone: 'good', content: '✓ Nudged' },
    hasLastRun && {
      key: 'last-run',
      tone: 'muted',
      title: 'When the student last pressed Run',
      content: <LastRunAgo at={student.lastRunAt} />,
    },
    rosterName && {
      key: 'roster',
      tone: 'muted',
      testId: 'modal-roster-name',
      title: 'Matched on the class list (only you see this)',
      content: `👥 ${rosterName}`,
    },
    pasted?.count > 0 && {
      key: 'pasted',
      tone: 'muted',
      title: `Pasted ${pasted.chars} characters into the editor on this task`,
      content: `📋 Pasted ×${pasted.count}`,
    },
    student.checkPassed &&
      !isSessionSandbox && { key: 'passed', tone: 'good', content: '✅ Check passed' },
    scrubResult !== null && {
      key: 'scrub',
      tone: 'muted',
      testId: 'modal-scrub-result',
      title: "What the checks said after the student's last scrub (cleared by their next Run)",
      content: scrubResult ? '✓ Passes after scrub' : '✕ Fails after scrub',
    },
    itemProgress && {
      key: 'items',
      tone: 'muted',
      testId: 'item-progress',
      title: 'Items the student has filled in (and got right, where marked per item)',
      content: `🧩 ${formatTaskItemProgress(itemProgress)}`,
    },
    hasOverride && {
      key: 'override',
      tone: 'muted',
      content: student.checkOverridePassed ? 'Overridden: Passed' : 'Overridden: Failed',
    },
    badgeCount > 0 && {
      key: 'badges',
      tone: 'muted',
      testId: 'modal-badge-count',
      title: 'Badges awarded this lesson (only you see this)',
      content: `🏅 ${badgeCount}`,
    },
    teacherAssisted && {
      key: 'assisted',
      tone: 'muted',
      title: "You edited this student's answer on this task — the report marks it teacher assisted",
      content: '✏️ Teacher assisted',
    },
    isActivity &&
      describeActivityDevice(activityState) && {
        key: 'device',
        tone: 'muted',
        content: <ActivityDeviceBadge state={activityState} />,
      },
    autoRevealStage && {
      key: 'every-task',
      tone: 'info',
      title: 'A reference opens automatically for this student on every task',
      content: `📖 Every task: ${AUTO_REVEAL_OPTIONS.find((o) => o.mode === autoRevealStage)?.label}`,
    },
    teacherLiveReferencePinned && {
      key: 'live-code',
      tone: 'info',
      title: teacherLiveReferencePinnedForStudent
        ? 'Your live code shows for this student on every task until you turn it off'
        : 'Your live code shows for the whole class on every task until you turn it off',
      content: '📌 Live code: kept on',
    },
    teacherLiveReferenceHiddenForStudent && {
      key: 'live-code-hidden',
      tone: 'info',
      title: 'Your live code is pinned for the class but hidden for this student',
      content: '📌 Live code: hidden for this student',
    },
    Object.keys(revealedSupportStages).length > 0 && {
      key: 'reference',
      tone: 'info',
      title: 'Student has opened a stage reference',
      content: 'Reference opened',
    },
    examplesOpened > 0 && {
      key: 'examples',
      tone: 'info',
      testId: 'modal-example-opened',
      title: "Student has opened the worked example in this task's explainer",
      content: `🔍 Opened example${examplesOpened > 1 ? ` (${examplesOpened})` : ''}`,
    },
    student.currentTopicId && {
      key: 'topic',
      tone: 'info',
      title: `Student has topic "${openTopic?.title ?? student.currentTopicId}" open`,
      content: `📖 ${openTopic?.title ?? student.currentTopicId}`,
    },
  ].filter(Boolean)

  // A mode takes the strip over while it is on, so it can always be switched off.
  const modeRow =
    canSetStage && stageRequestState === 'requesting' ? (
      <>
        <span>Waiting for {studentName}…</span>
        <span style={s.modeNote}>They accept the stage change on their screen</span>
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.modeButton}
          onClick={handleCancelStage}
        >
          Cancel
        </button>
      </>
    ) : showEditModes && teacherEditState === 'requesting' ? (
      <>
        <span>Waiting for {studentName}…</span>
        <span style={s.modeNote}>They accept your edit on their screen</span>
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.modeButton}
          onClick={handleCancelEdit}
        >
          Cancel
        </button>
      </>
    ) : showEditModes && teacherEditState === 'editing' ? (
      <>
        <span>✏ You are editing {studentName}&apos;s work</span>
        <span style={s.modeNote}>They see each change live</span>
        <button
          type="button"
          className="btn-primary"
          style={{ ...s.modeButton, background: '#0f766e', borderColor: '#0f766e' }}
          onClick={handleCommitEdit}
        >
          Done Editing
        </button>
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.modeButton}
          onClick={handleCancelEdit}
        >
          Cancel
        </button>
      </>
    ) : supportsAnswerEdit && answerEditing ? (
      <>
        <span>✏️ Editing {studentName}&apos;s answers</span>
        <span style={s.modeNote}>Their screen updates live</span>
        <button
          type="button"
          className="btn-primary"
          style={s.modeButton}
          onClick={() => setAnswerEditing(false)}
        >
          Done editing
        </button>
      </>
    ) : supportsTileHighlight && tileHighlightMode ? (
      <>
        <span>👀 Tap a tile to outline it for {studentName}</span>
        <button
          type="button"
          className="btn-primary"
          style={s.modeButton}
          onClick={() => setTileHighlightMode(false)}
          aria-pressed={true}
          data-testid="tile-highlight-toggle"
        >
          Done highlighting
        </button>
      </>
    ) : null

  // ─── The Tools menu: every occasional action, in three columns ────────────────
  const renderSupport = (close) => (
    <>
      {canReveal && (
        <>
          <div style={s.menuHeadingFirst}>Reveal</div>
          {canRevealLiveReference && (
            <button
              style={sTo.toolBtn}
              disabled={!teacherLiveReferenceMatchesTask || teacherLiveReferenceRevealed}
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
              {teacherLiveReferenceRevealed ? 'Opened: live code' : 'Reveal live code'}
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
                onRemoteReset?.(student.anonymousId, `reveal_stage_${completeStage.index}`)
              }}
            >
              {/* "Reveal solution", or "Reveal solution: Answer" for a named one; never
                  "Reveal solution: Complete". */}
              {formatStageLabel(completeStage.stage, completeStage.index).replace(
                /^Complete(?=:|$)/i,
                'Reveal solution'
              )}
            </button>
          )}
          {canSetAutoReveal && (
            <>
              <div style={s.autoRevealHeading}>Show on every task</div>
              <div style={s.segs}>
                {AUTO_REVEAL_OPTIONS.map(({ mode, label }) => (
                  <button
                    key={mode ?? 'off'}
                    style={autoRevealStage === mode ? sTo.segOn : sTo.seg}
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
              </div>
            </>
          )}
          {canShowLiveReference && (
            <>
              {!canSetAutoReveal && <div style={s.autoRevealHeading}>Show on every task</div>}
              <button
                style={sTo.toolBtn}
                aria-pressed={teacherLiveReferencePinned}
                disabled={
                  !teacherLiveReferencePinned &&
                  !teacherLiveReferenceHiddenForStudent &&
                  !teacherLiveReferenceMatchesTask
                }
                title={
                  teacherLiveReferencePinned
                    ? teacherLiveReferencePinnedForClass
                      ? 'Hide your live code for this student (it stays on for the rest of the class)'
                      : 'Stop showing your live code to this student'
                    : teacherLiveReferenceHiddenForStudent
                      ? 'Show your class-pinned live code to this student again'
                      : teacherLiveReferenceMatchesTask
                        ? 'Keep showing your live code on every task until you turn it off'
                        : "Will work once you're presenting this task in Presentation View"
                }
                onClick={() => {
                  close()
                  // On → off (written as `false` while the class pin is on); hidden → follow
                  // the class pin again (null); off → pin.
                  onSetTeacherLiveReference(
                    student.anonymousId,
                    teacherLiveReferencePinned
                      ? false
                      : teacherLiveReferenceHiddenForStudent
                        ? null
                        : true
                  )
                }}
              >
                {teacherLiveReferencePinned
                  ? '📌 Live code: kept on'
                  : teacherLiveReferenceHiddenForStudent
                    ? '📌 Show class live code again'
                    : '📌 Keep showing live code'}
              </button>
            </>
          )}
        </>
      )}
      {canSetStage && stageRequestState !== 'requesting' && (
        <>
          <div style={canReveal ? s.autoRevealHeading : s.menuHeadingFirst}>Set stage</div>
          <div style={s.menuHint}>{studentName} is asked first</div>
          {stageDeclinedNotice && (
            <div style={s.menuNote}>The student declined the last change.</div>
          )}
          <div style={s.segs}>
            {stageOptions.map((opt) => (
              <button
                key={opt.value}
                style={sTo.seg}
                onClick={() => {
                  close()
                  handleRequestStage(opt.value, opt.label)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )

  const toolColumns = (close) =>
    [
      [
        hasNudge && {
          key: 'encourage',
          heading: 'Encourage',
          body: (
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
          ),
        },
        (hasGoLiveForAll || hasShare) && {
          key: 'show',
          heading: 'Show the class',
          body: (
            <>
              {hasGoLiveForAll && (
                <button
                  style={sTo.toolBtn}
                  onClick={() => {
                    close()
                    onGoLiveForAll()
                  }}
                  title="Put this student's work on every screen, live. The class watches until you press Stop Live."
                >
                  📡 Take over every screen (Go Live for All)
                </button>
              )}
              {hasShare && (
                <button
                  style={sTo.toolBtn}
                  onClick={() => {
                    close()
                    onRequestShareSnapshot(student.anonymousId)
                  }}
                  title="Take a copy of this student's work as it is now. You check it, then classmates can open the copy."
                >
                  📤 Share a copy with the class
                </button>
              )}
            </>
          ),
        },
        (hasEdit || hasCopyCodeEdit || hasTopic || hasVideoCall || hasFullscreen) && {
          key: 'help',
          heading: 'Help this student',
          body: (
            <>
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
              {hasCopyCodeEdit && (
                <button
                  style={sTo.toolBtn}
                  onClick={() => {
                    close()
                    setShowCopyCodeDialog(true)
                  }}
                  title="Change the Type this out text for this student or the whole class"
                  data-testid="edit-copy-code"
                >
                  ⌨️ Edit Type this out
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
            </>
          ),
        },
      ],
      [
        hasMarkOverride && {
          key: 'mark',
          heading: 'Mark the task',
          region: 'Mark the task',
          body: (
            <OverrideItems
              student={student}
              task={task}
              onOverrideCheck={onOverrideCheck}
              onFail={() => setMarkFailOpen(true)}
              close={close}
            />
          ),
        },
        (hasRunOnStudent || hasAnswerEditItem || hasTileItem) && {
          key: 'screen',
          heading: 'Their screen and answers',
          body: (
            <>
              {hasRunOnStudent && (
                <button
                  style={sTo.toolBtn}
                  disabled={!student.online}
                  onClick={() => {
                    close()
                    handleRemoteRun()
                  }}
                  title={
                    student.online
                      ? "Run this student's code on their own screen"
                      : 'Student is offline'
                  }
                >
                  {remoteRunSent ? 'Run sent ✓' : '▶ Run on student'}
                </button>
              )}
              {hasAnswerEditItem && (
                <button
                  style={sTo.toolBtn}
                  onClick={() => {
                    close()
                    setAnswerEditing(true)
                    setTileHighlightMode(false)
                  }}
                  title="Change this student's answers — updates their screen live"
                >
                  ✏️ Edit answers
                </button>
              )}
              {hasTileItem && (
                <button
                  style={sTo.toolBtn}
                  onClick={() => {
                    close()
                    setTileHighlightMode(true)
                    setAnswerEditing(false)
                  }}
                  title="Tap a tile on the student's board to outline it on their screen: look again"
                >
                  👀 Highlight tiles
                </button>
              )}
            </>
          ),
        },
        hasExport && {
          key: 'work',
          heading: 'Their work',
          body: (
            <button
              style={sTo.toolBtn}
              onClick={() => {
                close()
                setShowExportDialog(true)
              }}
              title="Download this student's work, or make a name-hidden share link"
            >
              🎁 Export work
            </button>
          ),
        },
        // Highlight/force a tab or the Instructions pane on this student's screen.
        hasFocus && {
          key: 'focus',
          heading: 'Point at their screen',
          region: 'Focus',
          body: (
            <PaneFocusControls
              lessonType={taskLesson?.type}
              onHighlight={(panes) =>
                onPushTeacherPaneCommand(student.anonymousId, { mode: 'highlight', panes })
              }
              onForce={(panes) =>
                onPushTeacherPaneCommand(student.anonymousId, { mode: 'force', panes })
              }
              onDone={close}
            />
          ),
        },
      ],
      [
        hasSupport && {
          key: 'support',
          heading: stageDeclinedNotice ? 'Support · declined' : 'Support',
          region: 'Support',
          body: renderSupport(close),
        },
        // Pulse one control (Run, the green flag, a category…) on this student's screen
        // (src/shared/controlHighlight.js).
        hasControlHighlight && {
          key: 'pulse',
          region: 'Highlight',
          body: (
            <ControlHighlightControls
              lessonType={highlightScope}
              task={isActivity ? task : null}
              onHighlight={(target) =>
                onPushTeacherControlHighlight(student.anonymousId, target, task?.id ?? null)
              }
              onDone={close}
            />
          ),
        },
      ],
    ]
      .map((column) => column.filter(Boolean))
      .filter((column) => column.length > 0)

  const hasAnyTool = toolColumns(() => {}).length > 0 || !!onDecideBadge

  // ─── Body: instructions on the left, the workspace, Output on the right ───────
  const workspaceCopyCode =
    lessonModule?.supportsCopyCode === true
      ? effectiveCopyCode(
          task,
          session?.copyCodeOverrides,
          session?.students?.[student.anonymousId]?.copyCodeOverrides
        )
      : null
  const showLeftColumn =
    !!task &&
    !!mirror &&
    !isSessionSandbox &&
    !isInformation &&
    !isQuizLike &&
    !isCodeArrangeTask &&
    !showShareRequest &&
    !showSideQuestView
  const contentBaseStyle = isInformation
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
  const contentStyle = showLeftColumn
    ? {
        ...contentBaseStyle,
        ...s.bodyInColumns,
        ...(mirror === 'code' ? { flexDirection: 'row' } : null),
      }
    : contentBaseStyle

  return (
    <div className="ui-modal-backdrop" style={s.overlay} role="dialog" aria-modal="true">
      <div style={s.modal}>
        {/* Header: one 48px line. Who and where on the left; the common actions as grouped
            buttons; everything occasional in Tools. Tutor-only facts live in the strip below. */}
        <div style={s.header} data-testid="student-modal-header">
          <div style={s.who} data-testid="student-modal-status">
            <span style={s.name}>{studentName}</span>
            <PresenceBadge student={student} session={session} />
          </div>
          <div style={s.nav}>
            <TipButton
              style={{ ...s.navBtn, opacity: hasPrev ? 1 : 0.35 }}
              disabled={!hasPrev}
              onClick={onPrev}
              label="Previous student"
            >
              ‹
            </TipButton>
            {position != null && total != null && (
              <span style={s.navCount}>
                {position}/{total}
              </span>
            )}
            <TipButton
              style={{ ...s.navBtn, opacity: hasNext ? 1 : 0.35 }}
              disabled={!hasNext}
              onClick={onNext}
              label="Next student"
            >
              ›
            </TipButton>
          </div>
          {taskLabel && (
            <span style={s.taskLabel} title={taskLabel}>
              {taskLabel}
            </span>
          )}
          {showTaskDots && (
            <span style={s.dots} aria-hidden="true">
              {lessonTasks.map((t, i) => (
                <span
                  key={t?.id ?? i}
                  style={i < taskIndex ? s.dotDone : i === taskIndex ? s.dotCurrent : s.dot}
                />
              ))}
            </span>
          )}
          <span style={s.spacer} />

          {(onDecideBadge || (onThumbsUp && student.online) || canBroadcast) && (
            <div style={s.group}>
              {onDecideBadge && (
                <OneTapAwardButton
                  student={student}
                  suggestions={badgeSuggestions}
                  decisions={session?.badges ?? {}}
                  catalogueBadges={catalogueBadges}
                  currentTaskId={session?.currentTaskId ?? null}
                  onDecideBadge={onDecideBadge}
                  onRevokeBadge={onRevokeBadge}
                  onOpenPicker={() => setShowBadgeDialog(true)}
                  variant="header"
                  showOther={false}
                  headerClassName=""
                  headerStyle={s.groupButtonAward}
                />
              )}
              {onThumbsUp && student.online && (
                <button
                  type="button"
                  style={s.groupButton}
                  disabled={thumbsUpSent}
                  onClick={() => {
                    onThumbsUp(student.anonymousId)
                    setThumbsUpSent(true)
                    setTimeout(() => setThumbsUpSent(false), 2000)
                  }}
                  title="Send a 👍: tells this student they're on the right track"
                  aria-label={`Send ${studentName} a thumbs up`}
                >
                  {thumbsUpSent ? '✓ Sent' : '👍 Thumbs up'}
                </button>
              )}
              {canBroadcast && !isLiveForAll && (
                <button
                  type="button"
                  style={s.groupButton}
                  onClick={() => onGoLiveForAll('panel')}
                  title="Offer this student's work to the class, live: everyone keeps coding and can watch it or try a copy"
                >
                  📺 Show to class
                </button>
              )}
            </div>
          )}
          {hasHint && (
            <div style={s.group}>
              <button
                type="button"
                style={s.groupButton}
                onClick={() => setShowHintModal(true)}
                title="Put your own hint on this student's hint banner, without marking the task passed or failed"
                data-testid="send-hint-button"
              >
                <span aria-hidden="true">💡</span> Hint
              </button>
              {classHints.length > 0 && (
                <DropdownMenu
                  label=""
                  ariaLabel="More hints"
                  title="Hints the class is seeing"
                  buttonClassName=""
                  buttonStyle={s.caretButton}
                  panelStyle={s.smallMenu}
                >
                  {(close) => (
                    <>
                      <div style={s.menuHeadingFirst}>Hints the class is seeing</div>
                      {classHints.map((entry) => (
                        <button
                          key={entry.group}
                          style={sTo.toolBtn}
                          onClick={() => {
                            close()
                            setHintPrefill(entry.markdown ?? entry.text)
                            setShowHintModal(true)
                          }}
                          title={`${entry.studentIds.length} students see this`}
                        >
                          💬 {entry.text}
                        </button>
                      ))}
                    </>
                  )}
                </DropdownMenu>
              )}
            </div>
          )}
          {onSendMessage && (
            <div style={s.group}>
              <button
                type="button"
                style={s.groupButton}
                onClick={() => setShowMessageModal(true)}
                title="Send this student a pop-up message"
              >
                ✉ Message
              </button>
              {(hasTopic || hasVideoCall) && (
                <DropdownMenu
                  label=""
                  ariaLabel="More ways to message"
                  buttonClassName=""
                  buttonStyle={s.caretButton}
                  panelStyle={s.smallMenu}
                >
                  {(close) => (
                    <>
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
                    </>
                  )}
                </DropdownMenu>
              )}
            </div>
          )}
          {hasNudge && (
            <button
              type="button"
              style={s.squareButton}
              onClick={handleNudge}
              aria-label={`Nudge ${studentName}`}
              title="Nudge: flash this student's tab and play a chime"
            >
              {nudged ? '✓' : '🔔'}
            </button>
          )}
          {/* A running broadcast can always be stopped from the header. */}
          {!isInformation && isLiveForAll ? (
            <button type="button" style={s.stopLive} onClick={onStopLive}>
              <span aria-hidden="true">■</span> Stop Live
            </button>
          ) : (
            hasGoLiveForAll && (
              <DropdownMenu
                label={
                  <>
                    <span style={s.liveDot} aria-hidden="true" />
                    Live
                  </>
                }
                buttonClassName=""
                buttonStyle={s.liveButton}
                panelStyle={s.smallMenu}
              >
                {(close) => (
                  <>
                    <button
                      style={sTo.toolBtn}
                      onClick={() => {
                        close()
                        onGoLiveForAll()
                      }}
                      title="Put this student's work on every screen, live. The class watches until you press Stop Live."
                    >
                      📡 Take over every screen (Go Live for All)
                    </button>
                    <button
                      style={sTo.toolBtn}
                      onClick={() => {
                        close()
                        onGoLiveForAll('panel')
                      }}
                      title="Offer this student's work to the class, live: everyone keeps coding and can watch it or try a copy"
                    >
                      📺 Show to class, they keep coding
                    </button>
                  </>
                )}
              </DropdownMenu>
            )
          )}
          {hasAnyTool && (
            <DropdownMenu
              label="Tools"
              buttonClassName=""
              buttonStyle={s.toolsButton}
              panelStyle={s.toolsPanel}
            >
              {(close) => {
                const columns = toolColumns(close)
                return (
                  <div
                    style={{
                      ...s.toolsGrid,
                      gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`,
                    }}
                    data-testid="student-modal-tools"
                  >
                    {columns.map((column, c) => (
                      <div key={c} style={s.toolsColumn}>
                        {column.map((section, i) => {
                          const heading = section.heading && (
                            <div style={i === 0 ? s.menuHeadingFirst : s.menuHeading}>
                              {section.heading}
                            </div>
                          )
                          return section.region ? (
                            <section
                              key={section.key}
                              aria-label={section.region}
                              style={s.menuSection}
                            >
                              {heading}
                              {section.body}
                            </section>
                          ) : (
                            <React.Fragment key={section.key}>
                              {heading}
                              {section.body}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    ))}
                    {onDecideBadge && (
                      <div style={s.toolsFooter}>
                        <button
                          style={{ ...sTo.toolBtn, width: 'auto' }}
                          onClick={() => {
                            close()
                            setShowBadgeDialog(true)
                          }}
                          data-testid="award-other-badge"
                        >
                          🏅 Award a different badge…
                        </button>
                      </div>
                    )}
                  </div>
                )
              }}
            </DropdownMenu>
          )}
          <button type="button" style={s.closeButton} onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>
        {markFailOpen && (
          <OverrideFailModal
            onCancel={() => setMarkFailOpen(false)}
            onApply={(failHint) => {
              onOverrideCheck(student.anonymousId, false, failHint || null, task?.id)
              setMarkFailOpen(false)
            }}
          />
        )}

        <ModalStrip chips={stripChips} mode={modeRow} />

        {peerHelp && (
          <TeacherPeerHelpStudentPanel
            student={student}
            session={session}
            lesson={lesson}
            peerHelp={peerHelp}
          />
        )}
        {sideQuestInfo && !showShareRequest && (
          <SideQuestViewToggle
            view={showSideQuestView ? 'sideQuest' : 'main'}
            onChange={setBodyView}
            quest={sideQuestInfo.quest}
            total={sideQuestInfo.total}
          />
        )}
        {/* A pending share takes over the body. Showing the frozen snapshot and the live
            workspace at once invited approving one while looking at the other — they are
            different content, and only the snapshot is what the class would actually receive. */}
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
        ) : showSideQuestView ? (
          <StudentSideQuestView
            student={student}
            session={session}
            lesson={taskLesson}
            task={task}
          />
        ) : (
          <>
            {(!showLeftColumn || leftCollapsed) && (
              <StudentHintPanel
                student={student}
                session={session}
                isSessionSandbox={isSessionSandbox}
              />
            )}
            {supportsTileHighlight && (
              <TileHighlightBar
                active={tileHighlightMode}
                count={shownTileHighlightCount}
                note={tileHighlightNote}
                onNoteChange={setTileHighlightNote}
                onClearAll={handleClearTileHighlights}
                onDone={() => setTileHighlightMode(false)}
              />
            )}
            <div style={showLeftColumn ? s.bodyColumns : s.bodyPlain}>
              {showLeftColumn && (
                <StudentModalLeftColumn
                  task={task}
                  lessonType={taskLesson?.type}
                  student={student}
                  session={session}
                  isSessionSandbox={isSessionSandbox}
                  copyCode={workspaceCopyCode}
                  collapsed={leftCollapsed}
                  onCollapsedChange={setLeftCollapsed}
                />
              )}
              <div style={contentStyle}>
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
                    tileHighlights={shownTileHighlights}
                    typingHistory={session?.typingHistory?.[student.anonymousId] ?? null}
                    typingEntries={typingEntries}
                    onTileTargetTap={
                      supportsTileHighlight && tileHighlightMode && !answerEditing
                        ? handleTileHighlightTap
                        : null
                    }
                    outputColumn={showLeftColumn}
                    wideScratch={showLeftColumn}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Topic library dialog */}
      {showTopicLibrary && topics?.length > 0 && (
        <TopicLibraryDialog
          topics={topics}
          topicType={taskLesson?.type}
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

      {showCopyCodeDialog && onSetCopyCodeOverride && task && (
        <CopyCodeEditDialog
          studentName={student.displayName}
          taskTitle={task.title ?? 'This task'}
          language={lessonModule?.meta?.language ?? 'python'}
          initialText={
            effectiveCopyCode(
              task,
              session?.copyCodeOverrides,
              session?.students?.[student.anonymousId]?.copyCodeOverrides
            ) ?? ''
          }
          hasOwnOverride={
            typeof session?.students?.[student.anonymousId]?.copyCodeOverrides?.[task.id] ===
            'string'
          }
          onSave={(scope, text) => {
            onSetCopyCodeOverride(scope === 'class' ? 'class' : student.anonymousId, task.id, text)
            // A class text must also replace any version this student already has of their own.
            if (scope === 'class') onSetCopyCodeOverride(student.anonymousId, task.id, null)
            setShowCopyCodeDialog(false)
          }}
          onClearStudent={() => {
            onSetCopyCodeOverride(student.anonymousId, task.id, null)
            setShowCopyCodeDialog(false)
          }}
          onClose={() => setShowCopyCodeDialog(false)}
        />
      )}

      {showBadgeDialog && onDecideBadge && (
        <BadgeAwardDialog
          students={[{ anonymousId: student.anonymousId, displayName: student.displayName }]}
          decisions={session?.badges ?? {}}
          catalogueBadges={catalogueBadges}
          suggestions={badgeSuggestions}
          taskId={session?.currentTaskId ?? null}
          onDecideBadge={onDecideBadge}
          onRevokeBadge={onRevokeBadge}
          onClose={() => setShowBadgeDialog(false)}
        />
      )}

      {showExportDialog && (
        <React.Suspense fallback={null}>
          <ExportWorkDialog
            student={student}
            lesson={lesson}
            session={session}
            onClose={() => setShowExportDialog(false)}
          />
        </React.Suspense>
      )}

      {onSendHint && (
        <MessageCompose
          variant="hint"
          student={student}
          onSendMessage={(id, text) => onSendHint(id, text, task?.id)}
          isOpen={showHintModal}
          initialText={hintPrefill}
          onClose={() => {
            setShowHintModal(false)
            setHintPrefill('')
          }}
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

// Brand colours and fonts: HSC Hub/Specs/LaunchPad Style.md (primary #6222cc, Quicksand body,
// Montserrat titles). The header is one 48px line; buttons in it are 34px, grouped on a lighter
// band so the tutor reads them as a few groups rather than a row of separate pills.
const headerButton = {
  height: 34,
  padding: '0 9px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: 'none',
  background: 'transparent',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 12.5,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  minHeight: 0,
  borderRadius: 0,
}

const menuHeadingBase = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const dotBase = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  border: '1.5px solid #fff',
  boxSizing: 'border-box',
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
    padding: 12,
  },
  // Nearly the whole screen: the tutor is here to see the student's work at its real size.
  modal: {
    background: '#f5f5f5',
    borderRadius: 10,
    width: 'calc(100vw - 24px)',
    height: 'calc(100vh - 24px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(20,10,50,0.35)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '0 8px 0 12px',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    flexShrink: 0,
    gap: 8,
    whiteSpace: 'nowrap',
  },
  who: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'nowrap' },
  name: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: 15,
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  navBtn: {
    width: 30,
    height: 34,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  navCount: { fontWeight: 600, fontSize: 12.5, padding: '0 4px' },
  taskLabel: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 700,
    fontSize: 13,
  },
  dots: { display: 'flex', gap: 3, flexShrink: 0 },
  dot: dotBase,
  dotDone: { ...dotBase, background: '#fff' },
  dotCurrent: {
    ...dotBase,
    borderColor: 'var(--colour-secondary, #fba504)',
    background: 'var(--colour-secondary, #fba504)',
  },
  spacer: { flex: 1, minWidth: 4 },
  group: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  groupButton: { ...headerButton, borderRight: '1px solid rgba(255,255,255,0.22)' },
  groupButtonAward: {
    ...headerButton,
    maxWidth: 200,
    borderRight: '1px solid rgba(255,255,255,0.22)',
  },
  caretButton: {
    ...headerButton,
    width: 24,
    padding: 0,
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.12)',
  },
  squareButton: {
    ...headerButton,
    width: 34,
    padding: 0,
    justifyContent: 'center',
    fontSize: 17,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    flexShrink: 0,
  },
  liveButton: {
    ...headerButton,
    padding: '0 11px',
    gap: 6,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.6)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#fca5a5',
    display: 'inline-block',
  },
  stopLive: {
    ...headerButton,
    padding: '0 12px',
    gap: 6,
    borderRadius: 8,
    background: '#dc2626',
    border: '1px solid #fecaca',
    boxShadow: '0 0 0 2px rgba(220,38,38,0.35)',
    flexShrink: 0,
  },
  toolsButton: {
    ...headerButton,
    padding: '0 11px',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-primary)',
  },
  closeButton: {
    ...headerButton,
    width: 34,
    padding: 0,
    justifyContent: 'center',
    fontSize: 18,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    flexShrink: 0,
  },
  smallMenu: { minWidth: 260, maxWidth: 360, whiteSpace: 'normal' },
  toolsPanel: {
    width: 'min(820px, calc(100vw - 48px))',
    maxHeight: 'calc(100vh - 96px)',
    overflowY: 'auto',
    padding: 12,
    borderRadius: 12,
    border: '1px solid #d9d0ee',
    boxShadow: '0 16px 40px rgba(40,22,78,0.28)',
    whiteSpace: 'normal',
  },
  toolsGrid: { display: 'grid', gap: 12, color: 'var(--colour-text)' },
  toolsColumn: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  toolsFooter: {
    gridColumn: '1 / -1',
    borderTop: '1px solid #eee',
    paddingTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  footerNote: { fontSize: 12, fontWeight: 600, color: '#6b7280' },
  menuSection: { display: 'flex', flexDirection: 'column', gap: 4 },
  menuHeadingFirst: { ...menuHeadingBase, padding: '0 2px 2px' },
  menuHeading: { ...menuHeadingBase, marginTop: 8, padding: '0 2px 2px' },
  autoRevealHeading: {
    ...menuHeadingBase,
    marginTop: 6,
    padding: '0 2px 2px',
    fontSize: 11.5,
    textTransform: 'none',
  },
  menuHint: { fontSize: 11.5, fontWeight: 600, color: '#6b7280', padding: '0 2px' },
  menuNote: { fontSize: 12, color: 'var(--colour-error-text)', padding: '0 2px' },
  segs: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  helpedButton: {
    height: 26,
    marginRight: -9,
    borderRadius: 999,
    background: '#fff',
    color: '#3b2200',
    border: '1px solid #92400e',
    padding: '0 10px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  chipButton: {
    height: 24,
    marginRight: -8,
    borderRadius: 999,
    background: '#fff',
    color: 'var(--colour-primary)',
    border: '1px solid #cdbdec',
    padding: '0 8px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  modeNote: { fontWeight: 600, color: '#6b7280', fontSize: 12.5 },
  modeButton: { fontSize: 13, padding: '4px 12px', minHeight: 30, whiteSpace: 'nowrap' },
  // The body: instructions, workspace and Output side by side on the grey page, like the
  // student's own screen.
  bodyColumns: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    gap: 12,
    padding: 12,
  },
  bodyPlain: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
  },
  bodyInColumns: { flex: 1, minWidth: 0, minHeight: 0, padding: 0 },
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
    background: '#fff',
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

const segBase = {
  minHeight: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid #cdbdec',
  background: '#fff',
  color: 'var(--colour-primary)',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 11.5,
  cursor: 'pointer',
}

const sTo = {
  toolBtn: {
    width: '100%',
    minHeight: 32,
    padding: '6px 9px',
    background: '#f5f0ff',
    color: '#4c1d95',
    border: '1px solid #e4d8fa',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 12.5,
    cursor: 'pointer',
    textAlign: 'left',
  },
  seg: segBase,
  segOn: {
    ...segBase,
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
}
