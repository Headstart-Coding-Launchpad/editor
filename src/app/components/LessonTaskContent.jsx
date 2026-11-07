import React, { useEffect, useRef, useState } from 'react'
import Banner from '../../shared/Banner'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition, getModuleTypesWithCapability } from '../../modules/definitions'
import SplitPane from '../../shared/SplitPane'
import ExplainerPanel from './ExplainerPanel'
import InformationTask from './InformationTask'
import { SURFACE_KINDS, surfaceId } from '../liveInk/liveInkData'
import LessonCompleteScreen from './LessonCompleteScreen'
import { getModuleHostedActivityUi } from '../../activities/registry.js'
import { getActivityDefinition } from '../../activities/registry.pure.js'
import { getActivityId } from '../../activities/resolve.js'
import ActivityHost from '../../activities/ActivityHost.jsx'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import CarryHoldNotice from './CarryHoldNotice'
import TaskSlideTransition from './TaskSlideTransition'
import ReviewNotesControl from './ReviewNotesControl'
import { CollapsedPanelRail, CollapseTabButton } from './CollapsiblePanelControls'
import PanelTabs from './PanelTabs'
import SupportStagePanel from './SupportStagePanel'
import TaskHintBox from './TaskHintBox'
import { CalmAsideSlot, useCalmAside } from './calmAside'
import {
  getCompleteStage,
  getEffectiveTaskMode,
  getRevealableStages,
  getStarterStage,
} from '../../shared/taskUtils'
import { chooseChangeBase, stageShowsChange } from '../../shared/stageChange'
import { getStageLineHints } from '../../shared/lineHints'
import { getTaskLockSets } from '../../shared/lockedLines'
import {
  TEACHER_LIVE_REFERENCE_TYPES,
  teacherLiveReferenceDisplayState,
} from '../studentLiveDisplay'
import { useElementSize } from '../../shared/useElementSize'
import { firstViewKey } from '../../shared/motion'
import { useBadgeSignals } from '../../shared/badgeSignalsContext'
import { loadLayoutTab, saveLayoutTab } from '../studentStorage'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { NARROW_BREAKPOINT as SCRATCH_CODE_WIDE_WIDTH } from '../../modules/scratch/ScratchWorkspace'
import {
  SCRATCH_CALM_STACK_BREAKPOINT,
  calmExplainerWidth,
  paletteStartsOpen,
  createPaletteCategoryMemory,
} from '../../modules/scratch/calm/calmPalette.js'

// Brief "your teacher changed your answer" note, shown when a teacher edits
// this student's quiz answer, activity or Code Arrange tiles from StudentModal.
function TeacherAnswerNotice({ at }) {
  const [visibleAt, setVisibleAt] = React.useState(null)
  React.useEffect(() => {
    if (!at) return undefined
    setVisibleAt(at)
    const timer = setTimeout(() => setVisibleAt(null), 5000)
    return () => clearTimeout(timer)
  }, [at])
  if (!visibleAt) return null
  return (
    <div role="status" data-testid="teacher-answer-notice" style={teacherAnswerNoticeStyle}>
      ✏️ Your teacher updated your answer
    </div>
  )
}

const teacherAnswerNoticeStyle = {
  margin: '0 0 8px',
  padding: '6px 12px',
  borderRadius: 8,
  background: '#ede9fe',
  color: '#4c1d95',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  fontWeight: 600,
}

// What a failed check is compared against to tell whether the student has changed their code since:
// a string as is, anything else (Scratch's serialised state, a files object) by its JSON, so an
// equal object sent again is no change.
function codeFingerprint(code) {
  if (code == null || typeof code === 'string') return code ?? null
  try {
    return JSON.stringify(code)
  } catch {
    return code
  }
}

// Registered in the capture phase: CodeMirror's own copy/cut/dragstart handlers
// (on its content element, below this wrapper) write the selection to the
// clipboard themselves, so cancelling the event after it bubbles back out is
// too late. Stopping it on the way down means CodeMirror never sees it.
function blockClipboardEvent(event) {
  event.preventDefault()
  event.stopPropagation()
}

// Clipboard traffic in a CodeMirror editor (not a text input, quiz box, etc.).
function codeEditorClipboardText(event) {
  if (!event.target?.closest?.('.cm-editor')) return null
  return event.clipboardData?.getData('text/plain') || window.getSelection?.()?.toString() || ''
}

// Adapts Presentation View's independent live-reference broadcast
// (sessions/{lessonId}/teacherLiveReference — separate from teacherLive, which drives
// the all-or-nothing "Go Live" force takeover) into the {label, code|files|fs} shape
// SupportStagePanel's stageToText expects per lesson type: a files module's files, else the
// module's work under its code-stage field (`workSlot.stageField`, e.g. filesystem's `fs`),
// `code` by default.
function teacherLiveReferenceStageFrom(teacherLive, lessonType) {
  const displayState = teacherLiveReferenceDisplayState(teacherLive, lessonType)
  if (displayState == null) return null
  const definition = getModuleDefinition(lessonType)
  if (definition?.wire.sandboxChannel === 'files') {
    return { label: "Teacher's live code", files: displayState.files }
  }
  const shapeKey = definition?.workSlot?.stageField ?? 'code'
  return { label: "Teacher's live code", [shapeKey]: displayState }
}

// Lesson types whose explainer renders as a side rail beside the workspace (others use the
// accordion above it) — each module's `capabilities.sideExplainer`.
const SIDE_EXPLAINER_TYPES = getModuleTypesWithCapability('sideExplainer')
// Lesson types whose module StudentWorkspace reports its own visiblePanes (a togglable
// pane/tab/run-state that's meaningful to show on the teacher's student list) via the
// generic `modulePanes` state below, rather than the Scratch-specific plumbing — each
// module's `capabilities.modulePanes`.
const MODULE_PANES_TYPES = getModuleTypesWithCapability('modulePanes')
// Scratch's explainer is a fixed, non-resizable width (no drag-to-resize) rather than a
// percentage split — Scratch explainers often carry block-pill images/markdown that need
// real width, and a fixed size is simpler and more predictable than a shrinking one.
const EXPLAINER_FIXED_WIDTH = 320
// The side explainer's collapse arrow (s.sideExplainerCollapse: 28px wide, 4px from the right)
// plus a gap, kept clear at the end of the title bar so the title never runs into it.
const SIDE_COLLAPSE_INSET = 4 + 28 + 6
// Gap between the explainer and code columns (s.scratchFixedSplit) — must be included in
// the threshold below, or the code area ends up ~12px short of SCRATCH_CODE_WIDE_WIDTH
// right at the boundary, letting ScratchWorkspace's own Blocks/Stage tabs sneak in a hair
// before Instructions would have tabbed away instead.
const SCRATCH_SPLIT_GAP = 12
// Instructions tabs away *before* the code area (editor+stage) would otherwise be
// squeezed under ScratchWorkspace's own "wide" width (SCRATCH_CODE_WIDE_WIDTH, imported
// from ScratchWorkspace.jsx so the two never drift apart) — i.e. as soon as a fixed
// 400px explainer would leave the code area under 1000px, Instructions gives up its
// space entirely instead of leaving Blocks/Stage to squeeze into their own compact tabs.
// Only once the *whole* panel is under that combined width does Code, now with the full
// panel to itself, still end up compact — at which point Stage tabs away from Blocks as
// the final fallback (see ScratchWorkspace.jsx's own `compact`).
const TASK_PANEL_TABS_SURFACE = 'task_panel'

export default function LessonTaskContent({
  lesson,
  task,
  cs,
  lessonId,
  identityId,
  sandboxExplainer,
  activeStudentView,
  viewingTaskId,
  currentTaskId,
  transitionKey,
  // The displayed task's flat index, so the task slide knows forward from back.
  transitionOrder,
  previewMode,
  showPreviewBanner = true,
  // Classroom preview only (not the Builder pane): the admin's Feedback button on the strip.
  showReviewNotes = false,
  isSandbox,
  isViewingPrev,
  isForcedTeacherLive,
  isLiveCopyBlocked = false,
  isMobile,
  // Legacy quiz tasks are hosted activities too (isActivityTask); isQuizTask only keeps their
  // feedback-banner rule (banner for a check or an auto-evaluated match / fill-in-the-gaps).
  isQuizTask,
  isAutoEvaluatedQuiz,
  isInformationTask,
  // The Badge Summary task's class wall (see InformationTask); null outside a live lesson.
  badgeWall = null,
  // Hosted activity (taskType 'activity' or a quiz): a full-width surface rendered by
  // ActivityHost. displayAnswer is the teacher's broadcast activity state while forced-live.
  isActivityTask = false,
  displayAnswer = null,
  isViewingExplainerSlide,
  isViewingCompletionScreen,
  onOpenPlayground,
  soloCompanion,
  onTrySoloChallenge,
  onReplayLesson,
  isCodeArrangeTask,
  displayCode,
  displayArcadeDesign,
  displayTurtleResult,
  displayVariablesPanel = null,
  displayStage = null,
  displayPythonSlowMo = null,
  displaySpriteState,
  displayCursor,
  displayBlockDrag,
  displayCodeArrangeSlots,
  displayCodeArrangeCursor,
  displayFiles,
  displayActiveFile,
  displayOutput,
  displayRunStatus,
  displayOutputCollapsed,
  displayCheckPassed,
  displayCheckAttempted,
  displayCheckSuggestion,
  displaySelection,
  displayFs,
  displayDesktop,
  isTeacherEditing,
  teacherLiveCode,
  teacherLiveFiles,
  teacherLiveActiveFile,
  teacherLiveWorkspace,
  teacherLiveArcadeDesign,
  teacherLiveReferencePayload,
  canOfferNextStage,
  canOfferCompletePreview,
  canOfferCompleteSolution,
  canOfferPersonalSandbox,
  explainerShowsComplete,
  presenterLayout = 'both',
  onTopicOpen,
  onTopicClose,
  openTopicId,
  onVisiblePanesChange,
  highlightedPanes,
  forcedPaneCommand,
  // The bonus quest card is up (StudentView; only at its 10s cap while a pass banner shows): a
  // pass banner still on screen closes so the two never stack.
  closePassBanner = false,
  // Told whether a pass banner is on screen, so the bonus quest card waits for it to go.
  onPassBannerChange,
}) {
  const badgeSignals = useBadgeSignals()
  // Cross-lesson carry (src/shared/roster/crossLessonCarry.js): the student's own task is held
  // until the tutor's client finds their work from the earlier lesson. Only the student's own
  // live task holds: never a reviewed earlier task, a broadcast, the teacher's edit or a sandbox
  // (the presentation window and Builder preview never resolve to a hold).
  const carryHold =
    cs.crossLessonCarry?.state === 'hold' &&
    String(cs.crossLessonCarry.taskId) === String(currentTaskId) &&
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    !previewMode
  const [explainerCollapsed, setExplainerCollapsed] = useState(false)
  // Which stage's change view is on screen (SupportStagePanel), as `${task id}:${stage index}`:
  // when it is the stage the load button loads, the button says "Replace my code with this", as
  // the student sees only part of what it loads.
  const [stageChangeViewKey, setStageChangeViewKey] = useState(null)
  // Bumped by "Load complete code" so the change view reopens against the replaced code.
  const [completeLoads, setCompleteLoads] = useState(0)
  // Tracks the explainer's own accordion collapse (used whenever `!useSideExplainer` —
  // i.e. lesson types outside SIDE_EXPLAINER_TYPES like Filesystem, and the mobile
  // fallback for every type) so its open/closed state can feed visiblePanes below just
  // like the side-rail's explainerCollapsed does.
  const [accordionExplainerCollapsed, setAccordionExplainerCollapsed] = useState(false)
  const [taskPanelTab, setTaskPanelTab] = useState(
    () => loadLayoutTab(TASK_PANEL_TABS_SURFACE) || 'code'
  )
  const [taskPanelSizeRef, taskPanelSize] = useElementSize()
  // Scratch's Instructions/Code (desktop-compact, below) and, inside ScratchWorkspace
  // itself, Blocks/Stage are the only panes that hide via this shared explainer/code
  // split, so they get their own dedicated state. Other module-internal togglable state
  // (Electronics' Breadboard/Code tab, Python's console, Arcade's tab+running, HTML's
  // active file+preview) is reported by each module's own StudentWorkspace into the
  // generic `modulePanes` state instead — see MODULE_PANES_TYPES above.
  const [scratchCodePanes, setScratchCodePanes] = useState(['blocks', 'stage'])
  const [modulePanes, setModulePanes] = useState([])
  // Quizzes and activities share the no-workspace layout: no explainer rail, no stage
  // references, no module StudentWorkspace.
  const isQuizLike = isQuizTask || isActivityTask
  // An activity hosted by this module (code_arrange, isCodeArrangeTask): its ModuleWorkspace
  // replaces the module's StudentWorkspace and drives the module's work slot and Run via `cs`.
  const moduleHostedActivity = isCodeArrangeTask ? getModuleHostedActivityUi(task) : null
  const ModuleActivityWorkspace = moduleHostedActivity?.ModuleWorkspace ?? null
  // The activity sits inside the module's own StudentWorkspace (a Turtle or Stage arrangement),
  // which lays out and scrolls its own panes like a code task.
  const activityUsesHostWorkspace = !!moduleHostedActivity?.usesHostWorkspace?.(task)
  const lessonMod = getLessonModule(lesson.type)
  const StudentWorkspace = lessonMod?.StudentWorkspace
  const modStyles = lessonMod?.getLayoutStyles(isMobile) ?? {}
  const supportsSideExplainer = SIDE_EXPLAINER_TYPES.includes(lessonMod?.type ?? lesson.type)
  const moduleCaps = getModuleDefinition(lessonMod?.type ?? lesson.type)?.capabilities ?? null
  // Scratch's layout (capabilities.fixedExplainer): a fixed-width explainer column that tabs
  // away behind Instructions/Code tabs when the task panel is narrow, with the workspace's own
  // Blocks/Stage panes reported through the dedicated scratchCodePanes state below. On the calm
  // Scratch screen (capabilities.calmScratch) the Instructions/Code tabs and the fixed-width
  // column below are never rendered (no other module sets fixedExplainer today); that branch is
  // kept, with its tests, as the generic fixedExplainer path. The scratchCodePanes reporting is
  // still live (the calm screen reports blocks + stage through it).
  const isFixedExplainerLesson = !!moduleCaps?.fixedExplainer
  // The calm code screen (capabilities.calmCodeScreen; Python): one "What to change" box that
  // folds after a passing Run, the hint docked beside the task, and the Topic library chip in the
  // workspace's code row. Other modules keep the check popup and their own panels.
  const calmScreen = !!moduleCaps?.calmCodeScreen
  const supportsModulePanes = MODULE_PANES_TYPES.includes(lessonMod?.type ?? lesson.type)
  const taskPanelMeasured = taskPanelSize.width > 0
  // Width-only: giving Code its own tab doesn't add height (explainer and code already
  // share the same row's height), so a short-but-wide window is left to ScratchWorkspace's
  // own compact detection (which checks height too) rather than tabbing Instructions away
  // for no benefit.
  // The calm Scratch screen (capabilities.calmScratch) never tabs the explainer away.
  const isCalmScratchModule = !!moduleCaps?.calmScratch
  const taskPanelCompact =
    isFixedExplainerLesson &&
    !isCalmScratchModule &&
    taskPanelMeasured &&
    taskPanelSize.width < EXPLAINER_FIXED_WIDTH + SCRATCH_SPLIT_GAP + SCRATCH_CODE_WIDE_WIDTH
  const showsCompleteCode = !!explainerShowsComplete && !!task?.completeCode
  // A teacher-started sandbox's pushed instructions take the task explainer's place, so
  // they get the same side-by-side/collapsible layout rather than stacking above the code.
  const hasSandboxExplainer = isSandbox && !!sandboxExplainer?.trim()
  // Names the task shown for its first-view entrances (explainer drop-in, bullets, answers).
  // Keyed by task id, not content, so a Builder edit or a revisit never replays them.
  const taskEntranceKey = firstViewKey(lessonId, task?.id)
  const hasTaskExplainer =
    hasSandboxExplainer ||
    ((!!task?.explainer || showsCompleteCode) &&
      !isSandbox &&
      !cs.inPersonalSandbox &&
      !isQuizLike &&
      !isInformationTask &&
      !isViewingExplainerSlide &&
      !isViewingCompletionScreen)
  // Sandbox always shows the code workspace, even when the session is parked on a quiz or
  // information task, so it keeps the fluid layout those tasks opt out of.
  const useFluidWorkspace =
    supportsSideExplainer &&
    !isMobile &&
    (isSandbox ||
      (!isQuizLike && !isInformationTask && !isViewingExplainerSlide && !isViewingCompletionScreen))
  const useSideExplainer = hasTaskExplainer && useFluidWorkspace
  // The calm Scratch screen: the explainer card (collapsing only to its one-line title strip) and
  // the docked hint stay beside the blocks at every size: a column at the left from a 1024px
  // tablet up; beside the stage pinned above the blocks on a portrait tablet (stacked).
  const calmScratch = isCalmScratchModule && useFluidWorkspace
  const calmStacked =
    calmScratch && taskPanelMeasured && taskPanelSize.width < SCRATCH_CALM_STACK_BREAKPOINT
  // A tutor forcing "instructions" opens a collapsed card again (a fresh, open panel).
  const [calmExplainerOpenings, setCalmExplainerOpenings] = useState(0)
  // The calm palette's last category, for this view (ScratchWorkspace `calm.categoryMemory`).
  const [paletteCategoryMemory] = useState(createPaletteCategoryMemory)

  // The "What to change" box (calm screen) is open on a task's first view and folds to one line
  // ONCE per task view: on the first pass (a task with a check or tests: the check passing;
  // otherwise a Run without an error) that follows a Run started in this view. Never after a
  // failed Run, never for a pass that arrives without a Run here (a task passed before, restored
  // late), and never again once it has folded: after that only the student's tap folds or reopens
  // it, so a box they reopened stays open through later fails and passes.
  const calmTaskKey = String(task?.id ?? '')
  const [whatToChangeFoldedFor, setWhatToChangeFoldedFor] = useState(null)
  const whatToChangeFolded = calmScreen && whatToChangeFoldedFor === calmTaskKey
  const calmRunPassed =
    task?.check || task?.tests?.length > 0 ? !!cs.checkPassed : cs.runStatus === 'success'
  const calmRunning = !!(cs.running || cs.runningTests)
  // Per task view: whether a Run has started here, and whether the one auto-fold has happened.
  const calmFoldRef = useRef({ taskKey: calmTaskKey, ran: false, autoFolded: false })
  const lastCalmPassedRef = useRef({ taskKey: calmTaskKey, passed: calmRunPassed })
  // A new task view starts both halves of the fold state together (the auto-fold record and the
  // folded box), so going A -> B -> A opens A again rather than showing a stale fold.
  useEffect(() => {
    if (calmFoldRef.current.taskKey !== calmTaskKey) {
      calmFoldRef.current = { taskKey: calmTaskKey, ran: false, autoFolded: false }
      setWhatToChangeFoldedFor(null)
    }
    if (calmRunning) calmFoldRef.current.ran = true
  }, [calmTaskKey, calmRunning])
  useEffect(() => {
    const fold = calmFoldRef.current
    const last = lastCalmPassedRef.current
    lastCalmPassedRef.current = { taskKey: calmTaskKey, passed: calmRunPassed }
    if (!calmScreen || fold.taskKey !== calmTaskKey || !fold.ran || fold.autoFolded) return
    if (last.taskKey === calmTaskKey && !last.passed && calmRunPassed) {
      fold.autoFolded = true
      setWhatToChangeFoldedFor(calmTaskKey)
    }
  }, [calmScreen, calmTaskKey, calmRunPassed])
  function toggleWhatToChange() {
    setWhatToChangeFoldedFor((current) => (current === calmTaskKey ? null : calmTaskKey))
  }
  // The Topic library chip moves to the code row (calm screen, side explainer): a tap opens the
  // explainer if it is folded away, then asks its library to open (libraryRequest). Only where
  // that row actually renders (the module's StudentWorkspace, with its editable header: not an
  // earlier task, a broadcast, the tutor's edit, a carry hold or the explainer-only layout);
  // otherwise the chip stays on the task card, so it is never missing.
  const [libraryRequest, setLibraryRequest] = useState(0)
  const libraryInCodeRow =
    calmScreen &&
    useSideExplainer &&
    presenterLayout !== 'code' &&
    presenterLayout !== 'explainer' &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    !carryHold &&
    !isActivityTask &&
    !ModuleActivityWorkspace &&
    !hasSandboxExplainer &&
    !showsCompleteCode &&
    (moduleCaps?.topicLibrary ?? true)
  function openTopicLibrary() {
    setExplainerCollapsed(false)
    setLibraryRequest((count) => count + 1)
  }

  // What's actually on screen right now, for the teacher's student list — see the
  // `scratchCodePanes` comment above for why Scratch and the other modules compute this
  // differently. `hasTaskExplainer` gates this off entirely for tasks with no explainer
  // to show at all (quizzes, information tasks, sandbox), where compact/useSideExplainer
  // would otherwise report a phantom always-visible instructions pane.
  // The presenter's layout ('code' / 'explainer') leaves the other pane out entirely, so it is
  // never reported as visible.
  const showExplainerPane = presenterLayout !== 'code'
  const showCodePane = presenterLayout !== 'explainer'
  const instructionsPaneVisible =
    !hasTaskExplainer || !showExplainerPane
      ? false
      : calmScratch
        ? !accordionExplainerCollapsed
        : taskPanelCompact
          ? taskPanelTab === 'instructions'
          : useSideExplainer
            ? !explainerCollapsed
            : !accordionExplainerCollapsed
  const codePaneVisible = showCodePane && (!taskPanelCompact || taskPanelTab === 'code')
  // Information and quiz/activity tasks have no explainer/workspace panes at all (outside a
  // sandbox, which always shows the workspace). They report an explicit empty list so the
  // previous task's panes are cleared on the teacher's card rather than left behind —
  // modulePanes/scratchCodePanes still hold the last code task's state here, and in a
  // composed lesson the module flags below resolve to nothing on these tasks.
  const hasNoPanes = (isQuizLike || isInformationTask) && !isSandbox
  const visiblePanes = hasNoPanes
    ? []
    : isFixedExplainerLesson
      ? [
          ...(instructionsPaneVisible ? ['instructions'] : []),
          ...(codePaneVisible ? scratchCodePanes : []),
        ]
      : supportsModulePanes
        ? [...(instructionsPaneVisible ? ['instructions'] : []), ...modulePanes]
        : hasTaskExplainer
          ? instructionsPaneVisible
            ? ['instructions']
            : []
          : null
  const visiblePanesKey = visiblePanes?.join(',') ?? ''
  const instructionsHighlighted = !!highlightedPanes?.includes('instructions')

  useEffect(() => {
    if (hasNoPanes || isFixedExplainerLesson || supportsModulePanes || hasTaskExplainer)
      onVisiblePanesChange?.(visiblePanes)
    // visiblePanes is rebuilt every render; visiblePanesKey is its stable dependency.
    // task?.id re-reports on every task change: the teacher's setTaskId wipes visiblePanes,
    // so an unchanged list (e.g. Python -> Python) still has to be written again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasNoPanes,
    isFixedExplainerLesson,
    supportsModulePanes,
    hasTaskExplainer,
    visiblePanesKey,
    task?.id,
    onVisiblePanesChange,
  ])

  // Teacher "force" push for the instructions/explainer pane — applied once per distinct
  // forcedPaneCommand (guarded by its pushedAt token) via the same collapse/tab state a
  // manual click would use, so the student is free to close it again right after. The
  // module-specific half of a force command (e.g. Electronics' breadboard/code,
  // Scratch's blocks/stage) is applied inside each module's own StudentWorkspace instead —
  // see forcedPaneCommand passed to StudentWorkspace below.
  const lastAppliedForceTokenRef = useRef(null)
  useEffect(() => {
    if (
      !forcedPaneCommand ||
      !hasTaskExplainer ||
      lastAppliedForceTokenRef.current === forcedPaneCommand.pushedAt
    )
      return
    lastAppliedForceTokenRef.current = forcedPaneCommand.pushedAt
    const wantsInstructions = forcedPaneCommand.panes.includes('instructions')
    if (calmScratch) {
      // The calm card is never hidden; forcing "instructions" opens it if it is a strip.
      if (wantsInstructions && accordionExplainerCollapsed) setCalmExplainerOpenings((n) => n + 1)
    } else if (useSideExplainer) {
      setExplainerCollapsed(!wantsInstructions)
      if (taskPanelCompact) handleTaskPanelTabChange(wantsInstructions ? 'instructions' : 'code')
    } else {
      setAccordionExplainerCollapsed(!wantsInstructions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedPaneCommand, hasTaskExplainer, useSideExplainer, taskPanelCompact, calmScratch])

  function handleTaskPanelTabChange(id) {
    setTaskPanelTab(id)
    saveLayoutTab(TASK_PANEL_TABS_SURFACE, id)
  }
  // Modules on the unified code-stage model show a revealed support stage as a reference.
  const supportsStageReveal = !!moduleCaps?.unifiedStages
  const activeSupportStage =
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isQuizLike &&
    !isInformationTask &&
    !isViewingExplainerSlide &&
    !isViewingCompletionScreen &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    supportsStageReveal &&
    cs.activeSupportStageIndex != null
      ? (getRevealableStages(task).find(({ index }) => index === cs.activeSupportStageIndex) ??
        null)
      : null
  const supportsTeacherLiveReference = TEACHER_LIVE_REFERENCE_TYPES.includes(
    lessonMod?.type ?? lesson.type
  )
  const teacherLiveReferenceStage =
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isQuizLike &&
    !isInformationTask &&
    !isViewingExplainerSlide &&
    !isViewingCompletionScreen &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    supportsTeacherLiveReference &&
    cs.teacherLiveReferenceActive
      ? teacherLiveReferenceStageFrom(teacherLiveReferencePayload, lesson.type)
      : null
  const authoredCompleteStage = getCompleteStage(task)?.stage
  const completeReferenceStage =
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isQuizLike &&
    !isInformationTask &&
    !isViewingExplainerSlide &&
    !isViewingCompletionScreen &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    cs.completePreviewShown &&
    getModuleDefinition(lesson.type)?.capabilities.stageReveal === 'progressive' &&
    (authoredCompleteStage || task?.completeCode || task?.completeFiles?.length)
      ? (authoredCompleteStage ??
        (getModuleDefinition(lesson.type).wire.sandboxChannel === 'files'
          ? {
              label: 'Complete solution',
              files: task.completeFiles ?? [],
              entryFile: task.completeEntryFile ?? task.entryFile,
            }
          : { label: 'Complete solution', code: task.completeCode }))
      : null
  const targetedReferenceStage =
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isQuizLike &&
    !isInformationTask &&
    !isViewingExplainerSlide &&
    !isViewingCompletionScreen &&
    !isViewingPrev &&
    !isForcedTeacherLive &&
    !isTeacherEditing &&
    cs.targetedPreviewStageIndex != null
      ? (task?.codeStages?.[cs.targetedPreviewStageIndex] ?? null)
      : null
  // The one stage the reference panel shows (SupportStagePanel), worked out once here for both the
  // panel and the calm screen's one-box rule, so the two can never disagree: the stage, whether it
  // is revealed, its source label, and whether the tutor put it there.
  const shownReference = (() => {
    const stage =
      completeReferenceStage ??
      targetedReferenceStage ??
      teacherLiveReferenceStage ??
      activeSupportStage?.stage ??
      null
    if (!stage) return null
    // Which source won, in the order above (two can be the same stage object).
    const kind = completeReferenceStage
      ? 'complete'
      : targetedReferenceStage
        ? 'targeted'
        : teacherLiveReferenceStage
          ? 'live'
          : 'support'
    const reveal =
      kind === 'support' ? (cs.supportStageReveals?.[activeSupportStage?.index] ?? null) : null
    // The Complete preview says who opened it this time ('teacher' from the tutor's reveal or
    // auto-reveal, true from the student's own See complete code), so a stale tutor reveal
    // recorded on the stage's index never relabels the student's own preview.
    const openedByTutor =
      kind === 'complete'
        ? cs.completePreviewShown === 'teacher'
        : reveal?.source === 'teacher' || reveal?.source === 'teacher-auto'
    const sourceLabel =
      kind === 'complete'
        ? openedByTutor
          ? 'Opened by your teacher'
          : 'Complete reference'
        : kind === 'targeted'
          ? 'Shown for your feedback'
          : kind === 'live'
            ? cs.teacherLiveReferencePinned
              ? "📌 Live from your teacher's screen"
              : "Live from your teacher's screen"
            : openedByTutor
              ? 'Opened by your teacher'
              : 'Shown after a failed attempt'
    return {
      stage,
      kind,
      // A support stage shows once revealed; the others are shown by being chosen.
      revealed: kind !== 'support' || !!reveal,
      sourceLabel,
      // The tutor put it on the student's screen (a live push, a stage they opened): the
      // student's own pass never folds it away.
      fromTutor: kind === 'live' || openedByTutor,
    }
  })()
  // A change view (a revealed Complete stage with `show: 'change'`) is on screen: on the calm
  // screen that one box takes the Type this out's place.
  const changeViewOnScreen =
    calmScreen &&
    !!shownReference?.revealed &&
    !!moduleCaps?.stageChangeView &&
    stageShowsChange(shownReference.stage)
  const targetedOfferStage = cs.targetedStageOffer
    ? (task?.codeStages?.[cs.targetedStageOffer.stageIndex] ?? null)
    : null
  const genericNextStage =
    !targetedOfferStage && cs.offeredSupportStageIndex == null && canOfferNextStage
      ? (task?.codeStages?.[cs.offeredStageIndex + 1] ?? null)
      : null

  const taskContentStyle =
    !isSandbox && isQuizLike
      ? s.taskContentQuiz
      : !isSandbox && (isInformationTask || isViewingExplainerSlide || isViewingCompletionScreen)
        ? s.taskContentInfo
        : (modStyles.taskContentStyle ?? s.taskContentFallback)

  const editorAreaStyle =
    !isSandbox && isQuizLike
      ? s.editorAreaQuiz
      : !isSandbox && (isInformationTask || isViewingExplainerSlide || isViewingCompletionScreen)
        ? s.editorAreaInfo
        : (modStyles.editorAreaStyle ?? s.editorAreaFallback)

  // s.fluidTaskContent's overflow:'hidden' + minHeight:0 applies to every fluid-workspace
  // type, Scratch included: scratchTaskPanelWrap carries no height floor of its own to
  // protect (ScratchWorkspace scales its stage down to fit whatever height it's given —
  // see computeStageScale there), so there's nothing here that needs to grow past its
  // flex-allotted space or stay visible while doing so.
  const transitionStyle = useFluidWorkspace
    ? { ...taskContentStyle, ...s.fluidTaskContent }
    : taskContentStyle

  // The explainer is copy-blocked alongside the workspace while watching a
  // broadcast: it can carry a pushed sandbox explainer or the complete-code reveal.
  const taskExplainer = hasTaskExplainer ? (
    <div
      data-testid="task-instructions"
      style={
        calmScratch ? s.calmExplainerShell : useSideExplainer ? s.sideExplainerShell : undefined
      }
      className={isLiveCopyBlocked ? 'live-copy-blocked' : undefined}
      onCopyCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
      onCutCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
      onDragStartCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
    >
      {useSideExplainer && !calmScratch && (
        <CollapseTabButton
          onClick={() => setExplainerCollapsed(true)}
          direction="left"
          title="Collapse Explainer"
          ariaLabel="Collapse Explainer"
          style={s.sideExplainerCollapse}
          highlighted={instructionsHighlighted}
        />
      )}
      <ExplainerPanel
        // Calm: each task opens its card fresh, and a tutor's force reopens a folded one.
        key={calmScratch ? `calm-${task?.id ?? ''}-${calmExplainerOpenings}` : undefined}
        title={
          hasSandboxExplainer ? 'Instructions' : showsCompleteCode ? 'Complete Code' : task.title
        }
        content={
          hasSandboxExplainer
            ? sandboxExplainer
            : showsCompleteCode
              ? '```python\n' + task.completeCode + '\n```'
              : task.explainer
        }
        topicType={lesson.type}
        showLibrary={moduleCaps?.topicLibrary ?? true}
        libraryButton={!libraryInCodeRow}
        libraryRequest={libraryInCodeRow ? libraryRequest : 0}
        onLibraryRequestHandled={() => setLibraryRequest(0)}
        onTopicOpen={onTopicOpen}
        onTopicClose={onTopicClose}
        openTopicId={openTopicId}
        disableCopy
        fill={useSideExplainer}
        // Clear of the collapse arrow laid over the title bar's right end (s.sideExplainerCollapse).
        titleEndInset={useSideExplainer && !calmScratch ? SIDE_COLLAPSE_INSET : 0}
        // The calm card collapses to its one-line title strip (never a rail or a tab).
        collapsible={!useSideExplainer || calmScratch}
        markdownTextScale={useSideExplainer ? 1.08 : 1}
        onCollapsedChange={
          !useSideExplainer || calmScratch ? setAccordionExplainerCollapsed : undefined
        }
        highlighted={(!useSideExplainer || calmScratch) && instructionsHighlighted}
        entranceKey={hasSandboxExplainer ? null : taskEntranceKey}
        // Presentation annotations cover the task's own explainer only (not a pushed sandbox
        // explainer or the complete-code reveal).
        inkSurfaceId={
          !hasSandboxExplainer && !showsCompleteCode && task?.id != null
            ? surfaceId(SURFACE_KINDS.explainer, task.id)
            : null
        }
        // "See example" opens are logged for the tutor from the task's own explainer only
        // (src/shared/exampleOpens.js); the reporter is a no-op outside a live lesson.
        onExampleOpen={
          !hasSandboxExplainer && !showsCompleteCode && badgeSignals?.reportExampleOpen
            ? (index) => badgeSignals.reportExampleOpen(index, task?.id)
            : undefined
        }
      />
    </div>
  ) : null

  // The tutor's "Send hint" shows on this same banner, as a 💡 note from the tutor, with no check
  // result behind it (live lesson only: a teacher's forced live view shows their own screen).
  // On the calm screen the student can put a tutor's hint away ("Got it"), on this task, where the
  // dock shows it; it stays away until the tutor sends another (a new `at`). See tutorHintPutAway.
  const [dismissedTutorHint, setDismissedTutorHint] = useState(null)
  const quietActivityPass =
    isActivityTask &&
    !isQuizTask &&
    displayCheckPassed &&
    getActivityDefinition(getActivityId(task))?.quietPass === true
  // The calm screens' hint (the Python code screen and the calm Scratch screen), docked beside the
  // task in place of the popup, on the student's own code task (not a broadcast, an earlier task,
  // the tutor's edit, a sandbox or a Code Arrange board, which keep the popup or none).
  const calmHintShown =
    (calmScreen || calmScratch) &&
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isForcedTeacherLive &&
    !isViewingPrev &&
    !isTeacherEditing &&
    !isQuizLike &&
    !isInformationTask &&
    !isViewingExplainerSlide &&
    !isViewingCompletionScreen &&
    !isCodeArrangeTask &&
    !carryHold
  // Where the docked hint goes in the layout actually rendered below ('left': under the task
  // card; 'editor': under the editor), or null where it has no place (then the popup shows, so a
  // failed check, a tutor's hint or a stage offer is never lost).
  const showsSideBySide = useSideExplainer && showExplainerPane && showCodePane
  // The calm Scratch hint sits under the explainer card in its column ('aside'), which renders only
  // with both the card and the blocks on screen (not the presenter's explainer-only or code-only
  // layout: there the popup shows).
  // The column's own DOM node (calmAside.jsx). Orphaned (no slot on screen yet, e.g. the
  // workspace still loading in the stacked layout): the card shows inline and the hint as the popup.
  const calmAsideWanted = calmScratch && showCodePane && hasTaskExplainer && showExplainerPane
  const calmAsideHost = useCalmAside(calmAsideWanted)
  const calmHintSlot = !calmHintShown
    ? null
    : calmScratch
      ? calmAsideWanted && !calmAsideHost.orphaned
        ? 'aside'
        : null
      : showsSideBySide
        ? isFixedExplainerLesson
          ? null
          : explainerCollapsed
            ? 'editor'
            : 'left'
        : showCodePane
          ? 'editor'
          : showExplainerPane && hasTaskExplainer
            ? 'left'
            : null
  const calmHintDocked = calmHintSlot != null
  // A tutor's hint put away with "Got it" stays away only on the task it was put away on, and only
  // in the dock: where the layout has no dock, the popup still shows it.
  const tutorHintPutAway =
    calmHintDocked &&
    cs.teacherHint?.at != null &&
    dismissedTutorHint?.at === cs.teacherHint.at &&
    dismissedTutorHint?.taskKey === calmTaskKey
  const sentHintText = tutorHintPutAway ? '' : (cs.teacherHint?.text ?? '')
  const bannerPassed =
    cs.offeredSupportStageIndex != null || sentHintText ? false : !!displayCheckPassed
  const shouldShowFeedbackBanner =
    !quietActivityPass &&
    !cs.stagePromptAccepted &&
    !isSandbox &&
    !cs.inPersonalSandbox &&
    !isForcedTeacherLive &&
    (((task?.check || isAutoEvaluatedQuiz || (isActivityTask && !isQuizTask)) &&
      displayCheckAttempted) ||
      cs.offeredSupportStageIndex != null ||
      !!sentHintText)
  const hintToneNow = !shouldShowFeedbackBanner
    ? 'nudge'
    : sentHintText
      ? 'tutor'
      : bannerPassed
        ? 'pass'
        : 'fail'
  // A failed check's hint goes gentle (blue, still readable, never dismissed) once the student
  // moves on: the code changes from what was checked, or a new Run starts. The code at the fail is
  // noted when the fail first shows (render-time state, like SupportStagePanel's base).
  const calmFailKey =
    calmHintDocked && hintToneNow === 'fail'
      ? `${currentTaskId}|${cs.checkFailCount ?? ''}|${displayCheckSuggestion ?? ''}|${cs.offeredSupportStageIndex ?? ''}`
      : null
  // The key is not unique per fail (checkFailCount goes back to 0 on a pass and on Reset Code), so
  // the noted fail is forgotten as soon as no fail shows: the next fail is new, and amber.
  const [failSeen, setFailSeen] = useState(null)
  if (calmFailKey != null && failSeen?.key !== calmFailKey) {
    setFailSeen({ key: calmFailKey, code: codeFingerprint(cs.code) })
  } else if (calmFailKey == null && failSeen != null) {
    setFailSeen(null)
  }
  const failSettled =
    calmFailKey != null &&
    (calmRunning || (failSeen?.key === calmFailKey && failSeen.code !== codeFingerprint(cs.code)))
  const feedbackBanner = shouldShowFeedbackBanner ? (
    <CheckFeedbackBanner
      // Remounts (resetting the popup's own auto-dismiss timer and any manual dismissal)
      // only when a genuinely new check/stage event happens, not on every unrelated
      // re-render of this component.
      key={`${currentTaskId}-${displayCheckPassed}-${cs.checkFailCount}-${cs.offeredSupportStageIndex}-${cs.teacherHint?.at ?? ''}`}
      passed={bannerPassed}
      docked={calmHintDocked}
      settled={failSettled}
      onDismiss={
        calmHintDocked && cs.teacherHint?.at != null
          ? () => setDismissedTutorHint({ at: cs.teacherHint.at, taskKey: calmTaskKey })
          : undefined
      }
      failureMessage={isQuizLike ? 'Not quite right, try again.' : undefined}
      successMessage={
        isActivityTask && !isQuizTask
          ? (getActivityDefinition(getActivityId(task))?.passMessage ?? undefined)
          : undefined
      }
      suggestion={sentHintText || displayCheckSuggestion}
      fromTutor={!!sentHintText}
      onShowCodeStage={
        targetedOfferStage
          ? cs.handlePreviewTargetedStage
          : cs.offeredSupportStageIndex != null
            ? cs.handleRevealOfferedSupportStage
            : canOfferNextStage
              ? () => {
                  const nextStageIndex = cs.offeredStageIndex + 1
                  cs.handleAcceptGenericNextStage(nextStageIndex)
                }
              : undefined
      }
      stageActionLabel={
        // The prompt reads "Want a hint?", so the action says "hint" too (not "reference").
        targetedOfferStage
          ? targetedOfferStage.label
            ? `Show hint: ${targetedOfferStage.label}`
            : 'Show me a hint'
          : cs.offeredSupportStageIndex != null
            ? 'Show me a hint'
            : genericNextStage
              ? `Use ${genericNextStage.label || 'next stage'}`
              : undefined
      }
      stageActionConfirm={
        targetedOfferStage?.action === 'replace'
          ? `This will replace your current work with “${targetedOfferStage.label || 'this stage'}”. Continue?`
          : genericNextStage
            ? `This will replace your current work with “${genericNextStage.label || 'the next stage'}”. Continue?`
            : undefined
      }
      onPreviewCompleteCode={canOfferCompletePreview ? cs.handlePreviewCompleteCode : undefined}
      onShowCompleteCode={
        canOfferCompleteSolution
          ? () => {
              cs.handleShowCompleteCode()
              setCompleteLoads((count) => count + 1)
            }
          : undefined
      }
      showCompleteCodeLabel={
        stageChangeViewKey != null &&
        stageChangeViewKey === `${task?.id ?? ''}:${getCompleteStage(task)?.index ?? -1}`
          ? 'Replace my code with this'
          : undefined
      }
      onGoPersonalSandbox={canOfferPersonalSandbox ? cs.handleEnterPersonalSandbox : undefined}
      closeIfPassed={closePassBanner}
      onPassShownChange={onPassBannerChange}
    />
  ) : null

  const hintTone = failSettled ? 'nudge' : hintToneNow
  const hasGreenLine =
    changeViewOnScreen || (typeof task?.copyCode === 'string' && !!task.copyCode.trim())
  const hintNudge = calmScratch
    ? 'Have a go, then tap the green flag to see what happens.'
    : task?.interactionMode === 'submit'
      ? 'Have a go, then tap Submit.'
      : hasGreenLine
        ? 'Stuck? Look at the green line, then tap Run to try it.'
        : 'Have a go, then tap Run to see what happens.'
  const hintBox = calmHintDocked ? (
    <TaskHintBox
      banner={feedbackBanner}
      tone={hintTone}
      nudge={hintNudge}
      style={
        calmHintSlot === 'aside'
          ? s.calmHint
          : calmHintSlot === 'left'
            ? s.hintInLeftColumn
            : s.hintBelowEditor
      }
    />
  ) : null
  // The calm Scratch explainer column (card + docked hint): at the left, or beside the pinned
  // stage (stacked). Only with the blocks on screen (the presenter's explainer-only layout shows
  // the card on its own below). It renders into one DOM node (calmAsideHost) that moves between
  // the two slots, so crossing SCRATCH_CALM_STACK_BREAKPOINT (a tablet turned round) never remounts
  // the card or the hint: a folded card stays folded and a scrolled one keeps its place.
  const calmAside = calmAsideWanted ? (
    <>
      {taskExplainer}
      {calmHintSlot === 'aside' && hintBox}
    </>
  ) : null

  const workspaceContent = (
    <>
      {shownReference &&
        (() => {
          const referenceStage = shownReference.stage
          // Authored stages show their line hints; the teacher's live code has none.
          const referenceStageIndex = task?.codeStages?.indexOf(referenceStage) ?? -1
          const lineHintsFor =
            referenceStageIndex >= 0
              ? (file) => getStageLineHints(task, referenceStageIndex, file)
              : shownReference.kind === 'complete'
                ? (file) => getStageLineHints(task, 'complete', file)
                : undefined
          const changeViewKey = `${task?.id ?? ''}:${referenceStageIndex}`
          return (
            <SupportStagePanel
              // One panel per task and stage, and a new one after "Load complete code": the change
              // view reads the student's code when the stage is revealed.
              key={`${changeViewKey}:${shownReference.kind === 'live' ? 'live' : 'stage'}:${completeLoads}`}
              changeBase={chooseChangeBase(
                displayCode,
                getStarterStage(task)?.stage?.code ?? task?.starterCode
              )}
              // Each panel sets or clears only its own key, so a panel unmounting after a newer
              // one has opened leaves the newer one's value alone.
              onChangeViewShown={(shown) =>
                setStageChangeViewKey((current) =>
                  shown ? changeViewKey : current === changeViewKey ? null : current
                )
              }
              stage={referenceStage}
              calm={calmScreen}
              // What the tutor put on screen keeps its own fold (only a tap), never the one the
              // student's pass folds.
              folded={shownReference.fromTutor ? undefined : whatToChangeFolded}
              onToggleFolded={shownReference.fromTutor ? undefined : toggleWhatToChange}
              lineHintsFor={lineHintsFor}
              lockSets={getTaskLockSets(task)}
              lessonType={lesson.type}
              revealed={shownReference.revealed}
              sourceLabel={shownReference.sourceLabel}
            />
          )
        })()}

      {!isSandbox && isViewingCompletionScreen ? (
        <LessonCompleteScreen
          lessonTitle={lesson?.title}
          onOpenPlayground={onOpenPlayground}
          soloCompanion={soloCompanion}
          onTrySoloChallenge={onTrySoloChallenge}
          onReplayLesson={onReplayLesson}
        />
      ) : !isSandbox && (isInformationTask || isViewingExplainerSlide) ? (
        <InformationTask
          task={task}
          lesson={lesson}
          fill
          disableCopy
          badgeWall={badgeWall}
          entranceKey={taskEntranceKey}
        />
      ) : !isSandbox && isActivityTask && !carryHold ? (
        <>
          <TeacherAnswerNotice at={isViewingPrev ? null : cs.teacherAnswerNoticeAt} />
          <ActivityHost
            task={task}
            activity={cs.activity}
            broadcastAnswer={isForcedTeacherLive ? (displayAnswer ?? null) : undefined}
            reviewing={isViewingPrev}
            lessonType={lesson.type}
            assetsPath={resolveAssetsPath(lesson.assetsPath)}
            lessonId={lessonId}
            entranceKey={taskEntranceKey}
            tileHighlights={cs.tileHighlights}
            onDismissTileHighlights={cs.dismissTileHighlights}
            history={cs.typingHistory}
            topicLibrary={
              (moduleCaps?.topicLibrary ?? true) ? { onTopicOpen, onTopicClose, openTopicId } : null
            }
            result={
              isForcedTeacherLive
                ? { submitted: displayRunStatus === 'submitted', passed: displayCheckPassed }
                : { submitted: cs.runStatus === 'submitted', passed: cs.checkPassed }
            }
          />
        </>
      ) : !isSandbox && ModuleActivityWorkspace ? (
        <>
          <TeacherAnswerNotice at={isViewingPrev ? null : cs.teacherAnswerNoticeAt} />
          <ModuleActivityWorkspace
            task={task}
            cs={cs}
            viewingTaskId={viewingTaskId}
            currentTaskId={currentTaskId}
            isViewingPrev={isViewingPrev}
            isForcedTeacherLive={isForcedTeacherLive}
            isTeacherEditing={isTeacherEditing}
            displayCode={displayCode}
            displayFiles={displayFiles}
            displayOutput={displayOutput}
            displayRunStatus={displayRunStatus}
            displayCheckPassed={displayCheckPassed}
            displayCheckAttempted={displayCheckAttempted}
            displayCodeArrangeSlots={displayCodeArrangeSlots}
            displayCodeArrangeCursor={displayCodeArrangeCursor}
            teacherLiveCode={teacherLiveCode}
            teacherLiveFiles={teacherLiveFiles}
            // For an activity inside the module's own StudentWorkspace (usesHostWorkspace).
            lesson={lesson}
            lessonId={lessonId}
            identityId={identityId}
            isMobile={isMobile}
            displayTurtleResult={displayTurtleResult}
            displayVariablesPanel={displayVariablesPanel}
            displayStage={displayStage}
            displayPythonSlowMo={displayPythonSlowMo}
            displayOutputCollapsed={displayOutputCollapsed}
            displaySelection={displaySelection}
            onVisiblePanesChange={
              activityUsesHostWorkspace && supportsModulePanes ? setModulePanes : undefined
            }
          />
        </>
      ) : carryHold ? (
        <CarryHoldNotice
          sourceLabel={cs.crossLessonCarry.sourceLabel}
          slot={cs.crossLessonCarry.carry?.kind === 'activity_slot'}
        />
      ) : StudentWorkspace ? (
        <StudentWorkspace
          lesson={lesson}
          task={task}
          cs={cs}
          lessonId={lessonId}
          identityId={identityId}
          viewingTaskId={viewingTaskId}
          currentTaskId={currentTaskId}
          isSandbox={isSandbox}
          isViewingPrev={isViewingPrev}
          isForcedTeacherLive={isForcedTeacherLive}
          isMobile={isMobile}
          activeStudentView={activeStudentView}
          previewMode={previewMode}
          displayCode={displayCode}
          displayArcadeDesign={displayArcadeDesign}
          displayTurtleResult={displayTurtleResult}
          displayVariablesPanel={displayVariablesPanel}
          displayStage={displayStage}
          displayPythonSlowMo={displayPythonSlowMo}
          displaySpriteState={displaySpriteState}
          displayCursor={displayCursor}
          displayBlockDrag={displayBlockDrag}
          displayFiles={displayFiles}
          displayActiveFile={displayActiveFile}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayOutputCollapsed={displayOutputCollapsed}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displaySelection={displaySelection}
          displayFs={displayFs}
          displayDesktop={displayDesktop}
          isTeacherEditing={isTeacherEditing}
          teacherLiveCode={teacherLiveCode}
          teacherLiveFiles={teacherLiveFiles}
          teacherLiveActiveFile={teacherLiveActiveFile}
          teacherLiveWorkspace={teacherLiveWorkspace}
          teacherLiveArcadeDesign={teacherLiveArcadeDesign}
          onVisiblePanesChange={
            isFixedExplainerLesson
              ? setScratchCodePanes
              : supportsModulePanes
                ? setModulePanes
                : undefined
          }
          highlightedPanes={highlightedPanes}
          forcedPaneCommand={forcedPaneCommand}
          calm={
            calmScratch
              ? {
                  stacked: calmStacked,
                  aside:
                    calmStacked && calmAside ? (
                      <CalmAsideSlot aside={calmAsideHost.aside} style={s.calmStackedSlot} />
                    ) : null,
                  categoryMemory: paletteCategoryMemory,
                  paletteStartsOpen: paletteStartsOpen(lesson),
                }
              : undefined
          }
          whatToChange={
            calmScreen
              ? {
                  folded: whatToChangeFolded,
                  onToggle: toggleWhatToChange,
                  hideCopyCode: changeViewOnScreen,
                }
              : undefined
          }
          onOpenTopicLibrary={libraryInCodeRow ? openTopicLibrary : undefined}
        />
      ) : (
        <Banner accent="#dc2626" color="#991b1b" style={{ borderRadius: 8 }}>
          Unable to load this task - unrecognised lesson type "{lesson.type}".
        </Banner>
      )}
    </>
  )

  // code_arrange isn't a SplitPane-managed workspace with its own internal per-pane
  // scrolling like the other fluid-workspace types (python/html/scratch/electronics/arcade
  // editors) — it's plain flowing content (program lines + tile pool) that can outgrow the
  // available height, so it needs the editor area itself to scroll instead of clipping it.
  // While a student is watching a broadcast the workspace goes unselectable, so the
  // teacher's (or a pinned peer's) code can't be lifted out of it. CSS user-select alone
  // doesn't cover CodeMirror: its content stays contenteditable while read-only, so
  // Ctrl+A / Ctrl+C still builds a real selection the browser will happily copy.
  // Cancelling copy/cut/dragstart on their way into the workspace (capture phase,
  // before CodeMirror's own handlers fill the clipboard) closes that route (and
  // right-click Copy) in one place, silently, rather than per module.
  // Large pastes into a code editor are flagged to the teacher (cs.handleEditorPaste);
  // copies/cuts from the student's own editor are remembered so moving their own
  // code around isn't flagged.
  function handleOwnCopy(event) {
    const text = codeEditorClipboardText(event)
    if (text) cs.handleEditorCopy?.(text)
  }
  function handleWorkspacePaste(event) {
    const text = codeEditorClipboardText(event)
    if (text) cs.handleEditorPaste?.(text)
  }

  const editorArea = (
    <div
      data-testid="task-workspace"
      style={
        useFluidWorkspace
          ? {
              ...editorAreaStyle,
              ...s.fluidWorkspace,
              ...(isCodeArrangeTask && !activityUsesHostWorkspace ? { overflow: 'auto' } : {}),
            }
          : editorAreaStyle
      }
      className={
        [
          isForcedTeacherLive ? 'live-view-active' : null,
          isLiveCopyBlocked ? 'live-copy-blocked' : null,
        ]
          .filter(Boolean)
          .join(' ')
          .trim() || undefined
      }
      onCopyCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
      onCutCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
      onDragStartCapture={isLiveCopyBlocked ? blockClipboardEvent : undefined}
      onCopy={isLiveCopyBlocked ? undefined : handleOwnCopy}
      onCut={isLiveCopyBlocked ? undefined : handleOwnCopy}
      onPaste={isLiveCopyBlocked ? undefined : handleWorkspacePaste}
    >
      {workspaceContent}
    </div>
  )

  // The calm hint docks under the task card (left column) or under the editor. On the calm screen
  // both columns are ALWAYS wrapped, hint or not, and only the hint moves between them: swapping
  // the wrapper in and out would remount the workspace below (CodeMirror's focus, cursor and
  // scroll, More keys, slow-mo, the output tab) whenever the explainer folds or the hint changes.
  const leftPane = calmScreen ? (
    <div style={s.calmColumn}>
      {taskExplainer}
      {calmHintSlot === 'left' && hintBox}
    </div>
  ) : (
    taskExplainer
  )
  const editorPane = calmScreen ? (
    <div style={s.calmColumn}>
      {editorArea}
      {calmHintSlot === 'editor' && hintBox}
    </div>
  ) : (
    editorArea
  )

  return (
    <TaskSlideTransition
      transitionKey={transitionKey}
      order={transitionOrder}
      style={transitionStyle}
    >
      {previewMode && showPreviewBanner && task && !isSandbox && (
        <Banner
          accent="#0ea5e9"
          color="#0369a1"
          style={{
            padding: '5px 16px',
            fontSize: 12,
            fontWeight: 600,
            // The admin's open note box grows the strip; the label stays level with Feedback.
            ...(showReviewNotes ? { alignItems: 'baseline' } : null),
          }}
        >
          {getEffectiveTaskMode(task) === 'live'
            ? 'Live sessions only'
            : getEffectiveTaskMode(task) === 'solo'
              ? 'Solo mode only'
              : 'Live + Solo'}
          {/* Only in the Classroom preview, which students are redirected away from (LessonRoute);
              the control itself checks for an admin and renders nothing for a tutor. */}
          {showReviewNotes && (
            <ReviewNotesControl lessonId={lessonId} lesson={lesson} task={task} />
          )}
        </Banner>
      )}

      {!calmHintDocked && feedbackBanner}

      {calmScratch && showCodePane ? (
        // The calm Scratch screen. The code pane stays the second child in both layouts, so the
        // workspace (and every Blockly workspace in it) is never re-injected when the panel
        // crosses SCRATCH_CALM_STACK_BREAKPOINT; stacked, the explainer column moves into the
        // workspace beside its pinned stage (StudentWorkspace's `calm.aside`).
        <div ref={taskPanelSizeRef} style={s.scratchTaskPanelWrap}>
          <div style={s.scratchFixedSplit}>
            {calmAside && !calmStacked ? (
              <CalmAsideSlot
                aside={calmAsideHost.aside}
                testId="scratch-calm-aside"
                style={{ ...s.calmAsideColumn, width: calmExplainerWidth(taskPanelSize.width) }}
              />
            ) : calmAside && calmAsideHost.orphaned ? (
              // The stacked slot is not on screen (the workspace is still loading): the card shows
              // here instead, never in a detached node.
              <div
                data-testid="scratch-calm-aside-inline"
                style={{ ...s.calmAsideColumn, width: calmExplainerWidth(taskPanelSize.width) }}
              >
                {calmAside}
              </div>
            ) : null}
            <div style={s.scratchCodeFlex}>{editorArea}</div>
          </div>
        </div>
      ) : useSideExplainer && showExplainerPane && showCodePane && isFixedExplainerLesson ? (
        // Explainer and code panes are ALWAYS the same two divs, in the same tree
        // position, in both compact (tabbed) and split (fixed-width) modes — only their
        // `style` (and, for the explainer, whether it shows the rail) changes between
        // modes. This is deliberate: if the two modes rendered structurally different
        // trees here (e.g. PanelTabPanel-wrapped vs plain divs), React would unmount and
        // remount everything below on every threshold crossing — destroying and
        // re-injecting every Blockly workspace inside ScratchWorkspace each time,
        // which can leave its own compact-detection mid-remeasurement and stuck.
        <div ref={taskPanelSizeRef} style={s.scratchTaskPanelWrap}>
          {taskPanelCompact && (
            <PanelTabs
              label="Task panel"
              tabs={[
                { id: 'instructions', label: 'Instructions' },
                { id: 'code', label: 'Code' },
              ]}
              activeId={taskPanelTab}
              onChange={handleTaskPanelTabChange}
              highlightedIds={highlightedPanes}
            />
          )}
          <div style={s.scratchFixedSplit}>
            <div
              role={taskPanelCompact ? 'tabpanel' : undefined}
              id={taskPanelCompact ? 'panel-tabpanel-instructions' : undefined}
              aria-labelledby={taskPanelCompact ? 'panel-tab-instructions' : undefined}
              hidden={taskPanelCompact ? taskPanelTab !== 'instructions' : undefined}
              style={
                taskPanelCompact
                  ? {
                      ...s.scratchCodeFlex,
                      display: taskPanelTab === 'instructions' ? 'flex' : 'none',
                    }
                  : explainerCollapsed
                    ? s.scratchExplainerRail
                    : s.scratchExplainerFixed
              }
            >
              {!taskPanelCompact && explainerCollapsed ? (
                <CollapsedPanelRail
                  onClick={() => setExplainerCollapsed(false)}
                  label="Explainer"
                  direction="right"
                  title="Show Explainer"
                  ariaLabel="Show Explainer"
                  highlighted={instructionsHighlighted}
                />
              ) : (
                taskExplainer
              )}
            </div>
            <div
              role={taskPanelCompact ? 'tabpanel' : undefined}
              id={taskPanelCompact ? 'panel-tabpanel-code' : undefined}
              aria-labelledby={taskPanelCompact ? 'panel-tab-code' : undefined}
              hidden={taskPanelCompact ? taskPanelTab !== 'code' : undefined}
              style={
                taskPanelCompact
                  ? { ...s.scratchCodeFlex, display: taskPanelTab === 'code' ? 'flex' : 'none' }
                  : s.scratchCodeFlex
              }
            >
              {editorArea}
            </div>
          </div>
        </div>
      ) : useSideExplainer && showExplainerPane && showCodePane ? (
        <SplitPane
          style={s.sideBySideLayout}
          // 25% put the explainer - the thing a student has to read to know what to do -
          // in a ~310px column wrapping at five or six words, while the editor beside it
          // held ~900px for a 40-character line. Prose was in the narrow column and code
          // had the wide one. 26% keeps the explainer's measure readable while giving the
          // workspace noticeably more room than the previous 32% did.
          defaultSplit={26}
          leftCollapsed={explainerCollapsed}
          collapsedLeftWidth={44}
          collapsedLeft={
            <CollapsedPanelRail
              onClick={() => setExplainerCollapsed(false)}
              label="Explainer"
              direction="right"
              title="Show Explainer"
              ariaLabel="Show Explainer"
              highlighted={instructionsHighlighted}
            />
          }
          left={leftPane}
          right={editorPane}
        />
      ) : (
        <>
          {showExplainerPane && (calmHintSlot === 'left' ? leftPane : taskExplainer)}
          {showCodePane && editorPane}
        </>
      )}

      {/* After the layout, so the slot has taken the host before the card's own effects run. */}
      {calmAsideHost.portal(calmAside)}
    </TaskSlideTransition>
  )
}

const s = {
  taskContentFallback: {
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
    overflow: 'visible',
  },
  taskContentInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaFallback: {
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
    overflow: 'auto',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  fluidTaskContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sideBySideLayout: {
    flex: 1,
    minHeight: 0,
    gap: 12,
    overflow: 'hidden',
  },
  scratchTaskPanelWrap: {
    flex: 1,
    minWidth: 0,
    // No minHeight floor here (deliberately): a growing sibling (e.g. a banner, or the
    // completion banner wrapping onto extra lines) is free to shrink this panel however far
    // it needs to — ScratchWorkspace scales its own stage down to fit whatever height it's
    // given (see computeStageScale there) rather than needing a reserved floor, and its
    // stagePane keeps its own `overflow: auto` as a last resort if it's ever squeezed
    // tighter than that scaling can absorb.
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
  },
  // Scratch's explainer is a fixed width, not a draggable split — see EXPLAINER_FIXED_WIDTH.
  scratchFixedSplit: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    gap: 12,
    overflow: 'hidden',
  },
  scratchExplainerFixed: {
    width: EXPLAINER_FIXED_WIDTH,
    minWidth: EXPLAINER_FIXED_WIDTH,
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scratchExplainerRail: {
    width: 44,
    minWidth: 44,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  scratchCodeFlex: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // Calm Scratch: the explainer column (card, then the docked hint), 220-320px wide.
  calmAsideColumn: {
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden',
  },
  // The card sizes to its content and scrolls inside when long (ExplainerPanel `fill`).
  calmExplainerShell: {
    flex: '0 1 auto',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  calmHint: { maxHeight: '45%' },
  // The stacked layout's slot beside the pinned stage (ScratchWorkspace's aside cell).
  calmStackedSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  sideExplainerShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  sideExplainerCollapse: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 3,
    width: 28,
    height: 28,
    alignSelf: 'auto',
    color: '#fff',
  },
  // The calm screen's two columns (task card or editor, then the docked hint, TaskHintBox): one
  // style for both. In the left column the hint sits at the bottom, capped at about half.
  calmColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
  },
  hintInLeftColumn: { marginTop: 'auto', maxHeight: '50%' },
  hintBelowEditor: { maxHeight: '30vh' },
  fluidWorkspace: {
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
}
