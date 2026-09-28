import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  FEEDBACK_TIMING,
  checkAllowedForSubmit,
  evaluateCheck,
  evaluateCheckWithCode,
  evaluateCheckWithFeedback,
  getStageOfferMatchThreshold,
  normalizeChecks,
  normalizeFeedbackChecks,
  evaluateSingleCheck,
  isCodeCheck,
  resolveTestCheck,
} from '../../modules/checks'
import {
  flattenTasks,
  findTaskById,
  getCompleteStage,
  getNextRevealableStage,
  getRevealableStages,
  getStageRole,
  getStarterStage,
  isRevealableStage,
} from '../../shared/taskUtils'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS, normaliseDirPath } from '../../modules/filesystem/filesystem'
import { DEFAULT_CIRCUIT } from '../../modules/electronics/circuit'
import { makeDefaultDesktop } from '../../modules/desktop/desktopState'
import { decodeFileKey } from '../../shared/fileKeys'
import {
  savePersonalSandboxCode,
  loadPersonalSandboxFile,
  savePersonalSandboxFile,
  clearEphemeralStorage,
} from '../studentStorage'
import {
  resolveRemoteResetTarget,
  resolveSavedCarrySource,
  selectHtmlTaskFiles,
  selectPythonTaskCode,
} from '../studentTaskContent'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { resolveIframeErrorLocation } from '../../modules/html/iframe'
import { buildCodeCheckContext } from '../codeCheckContext'
import { useCheckFeedback } from './useCheckFeedback'
import { useLatestRef } from './useLatestRef'
import { useSandboxCodePush } from './useSandboxCodePush'
import { useStudentPresenceReporting } from './useStudentPresenceReporting'
import { createStudentPersistence } from './createStudentPersistence'
import { useTeacherLivePublish } from './useTeacherLivePublish'
import { useActivityState } from './useActivityState'
import { isHostedActivityTask } from '../../activities/registry.pure.js'
import { buildSharedWorkspaceSnapshot } from '../sharedWorkspacePayload'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions.js'
import { cloneArcadeDesign } from '../../modules/arcade/design'
import { runWithRuntime } from './runWithRuntime'

// The generic work slot before any module has loaded work into it.
const EMPTY_WORK = Object.freeze({ moduleType: null, taskId: null, value: null })
// A work-slot module's interaction before its workspace has reported one.
const DEFAULT_INTERACTION = Object.freeze({ currentDir: '/', openFile: null })

// The module definition when `type` is on the generic work slot (declares `workSlot`), else null.
function workSlotDefinition(type) {
  const definition = getModuleDefinition(type)
  return definition?.workSlot ? definition : null
}

// Whether a work-slot module's work is code the student edits (it has a code language: python,
// turtle, arcade, electronics) rather than a structured state (filesystem, desktop).
function isCodeWork(definition) {
  return definition?.meta.language != null
}

// The `code` alias: the code of whichever code module the slot holds (html and scratch tasks
// keep seeing the last code module's code, as they did the old `code` state), '' otherwise.
function codeOfSlot(slot) {
  const definition = workSlotDefinition(slot.moduleType)
  return isCodeWork(definition) ? definition.workSlot.stored(slot.value).work : ''
}

/**
 * Owns all student editor/code workspace state: code, files, output, checks, personal sandbox,
 * Pyodide lifecycle, iframe, run handlers, and localStorage persistence.
 *
 * Receives currentTaskId, viewingTaskId, phase, and session write callbacks from the caller.
 */
export function useStudentCodeState({
  lessonId,
  lesson,
  currentTaskId,
  viewingTaskId,
  phase,
  effectiveIdentity,
  identity,
  session,
  connected,
  teacherPresentation,
  previewMode,
  // Session write commands
  writeStudentRun,
  logAttempt,
  writeStudentAnswer,
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
  writeStudentPersonalSandbox,
  writeStudentPresence,
  registerPresence,
  removeStudent,
  updateTeacherLive,
  setTeacherLive,
  setTeacherLiveReference,
  removeTeacherHighlight,
  clearTeacherAnswerEdit,
  clearRemoteRun,
}) {
  const [files, setFiles] = useState([])
  const [activeFile, setActiveFile] = useState('')
  const [output, setOutput] = useState('')
  const [runStatus, setRunStatus] = useState(null)
  // Turtle module only: the { state, commands, calls } snapshot from the most recent run,
  // used by TurtleStudentWorkspace to redraw its canvas. Ephemeral/in-memory only (Phase 1) —
  // not persisted or synced to teacher-live yet, so it resets wherever output does.
  const [turtleResult, setTurtleResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [runningTests, setRunningTests] = useState(false)
  const [iframeSrc, setIframeSrc] = useState(null)
  const [inputPrompt, setInputPrompt] = useState(null)
  const [scratchSandboxProject, setScratchSandboxProject] = useState(null)
  const [scratchExternalState, setScratchExternalState] = useState(null)
  const [scratchActiveStageIndex, setScratchActiveStageIndex] = useState(null)
  // Generic work slot (module contract v2, plan steps 4.3–4.4) for modules whose definition
  // declares `workSlot` + `checking` (python, turtle, arcade, electronics, filesystem,
  // desktop): the work value tagged with the module and task it belongs to — a code string,
  // Arcade's `{ code, arcadeDesign }`, a filesystem tree or a desktop state. Readers only trust
  // `value` for the module named in `moduleType` (see workValueFor), so a composed lesson
  // switching modules can never publish, save or check the previous module's work. The old
  // `code` / `arcadeDesign` names are derived from it (codeOfSlot). `interactions` keeps each
  // module's latest workspace interaction ({ currentDir, openFile }) — carry keeps the directory.
  const [work, setWorkState] = useState(EMPTY_WORK)
  const [interactions, setInteractionsState] = useState({})
  const [editorSelection, setEditorSelection] = useState(null)
  const [editorActivity, setEditorActivity] = useState(null)
  // Runtime error-line highlight (see src/shared/CodeEditor.jsx errorLineField).
  // errorLine: Python's failing line number (single-file editor).
  // htmlErrorLocation: { file, line } — HTML/JS has multiple files/tabs, so the
  // errored file name travels with the line number; the workspace only shows
  // the highlight while that file's tab is active.
  const [errorLine, setErrorLine] = useState(null)
  const [htmlErrorLocation, setHtmlErrorLocation] = useState(null)
  const [inPersonalSandbox, setInPersonalSandbox] = useState(false)
  const [localSupportStageReveals, setLocalSupportStageReveals] = useState({})
  const [supportStageVisibility, setSupportStageVisibility] = useState({})
  const [supportStageOffers, setSupportStageOffers] = useState({})
  const [targetedStageOffer, setTargetedStageOffer] = useState(null)
  const [targetedPreviewStageIndex, setTargetedPreviewStageIndex] = useState(null)
  const targetedStageOfferMatchCountsRef = useRef({})

  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)
  // Set by handleRun while a program is running: echoes a submitted input()
  // line into the output and mirrors it in one write (see handleInputSubmit).
  const submitInputEchoRef = useRef(null)
  const outputMirrorRef = useRef(null)
  // Tasks this tab has had a teacher edit the answer on (StudentModal "Edit
  // answers"): their logged attempts carry teacherAssisted for the report.
  const teacherAssistedTaskIdsRef = useRef(new Set())
  const appliedTeacherAnswerEditAtRef = useRef(null)
  const [teacherCodeArrangeEdit, setTeacherCodeArrangeEdit] = useState(null)
  const [teacherAnswerNoticeAt, setTeacherAnswerNoticeAt] = useState(null)
  // Bumped when the teacher presses Run for this student; each module
  // workspace reacts via useRemoteRunTrigger with its own Run action.
  const [remoteRunToken, setRemoteRunToken] = useState(null)
  // Latest in-progress input() state, kept regardless of whether a teacher is
  // watching, so opening StudentModal mid-prompt can publish it immediately.
  const inputPromptRef = useRef(null)
  const inputValueRef = useRef('')
  const lastRuntimeCodeWriteRef = useRef(0)
  const outputRafIdRef = useRef(null)
  const runtimeCodeRafIdRef = useRef(null)
  const pendingRuntimeCodeRef = useRef(null)
  const idleFeedbackTimerRef = useRef(null)
  const htmlSupportAttemptsRef = useRef(new Map())
  // Latest code_arrange tile-placement state (owned by CodeArrangeTaskContainer,
  // mirrored here purely so the "teacher starts watching" effect below can
  // publish it immediately — see handleCodeArrangeSlotsChange.
  const codeArrangeSlotStateRef = useRef({})

  const IDLE_FEEDBACK_DELAY_MS = 900

  // Stable refs for stale-closure-safe reads inside async handlers and callbacks
  const identityRef = useLatestRef(identity)
  const lessonRef = useLatestRef(lesson)
  const currentTaskIdRef = useLatestRef(currentTaskId)
  const phaseRef = useLatestRef(phase)
  // Scratch never routes through the generic `code` state (see loadTaskContent's
  // scratch branch) — handleScratchChange stashes the latest Blockly JSON here
  // instead, so the teacher-live payload publishes real block state rather than
  // whatever `code` happens to be left over from a previous non-Scratch task.
  const scratchCodeRef = useRef('')
  // Turtle module only — mirrors turtleResult so currentTeacherLivePayload (built inside
  // useTeacherLivePublish, which only receives refs) can read the latest snapshot without
  // a stale closure. See setTurtleResult(result.turtle ?? null) below: it's set in the same
  // handler/render pass as setRunStatus, so the "publish on tracked value change" effect
  // (keyed on runStatus) always sees the fresh value the next time it fires.
  const turtleResultRef = useLatestRef(turtleResult)
  const arcadeDesignWriteTimerRef = useRef(null)
  const spriteStateLastSentRef = useRef(0)
  const spriteStatePendingTimerRef = useRef(null)
  const filesRef = useLatestRef(files)
  const outputRef = useLatestRef(output)
  const runStatusRef = useLatestRef(runStatus)
  const sessionRef = useLatestRef(session)
  const activeStudentViewRef = useLatestRef(session?.activeStudentView)
  const editorSelectionRef = useLatestRef(editorSelection)
  const editorActivityRef = useLatestRef(editorActivity)
  const inPersonalSandboxRef = useLatestRef(inPersonalSandbox)
  const activeFileRef = useLatestRef(activeFile)
  // Updated synchronously by setWork / setInteraction (not on render), so a handler that runs
  // straight after another in the same event — e.g. Desktop opening a file calls
  // handleDesktopChange then handleDesktopInteraction, or a MicroPython run rewriting the
  // circuit — sees the work it just set.
  const workRef = useRef(work)
  const interactionsRef = useRef(interactions)
  // The old `codeRef`, now read through the slot (always as fresh as workRef): handed to
  // useTeacherLivePublish and read by handlers that still speak in code strings.
  const [codeRef] = useState(() => ({
    get current() {
      return codeOfSlot(workRef.current)
    },
  }))
  // Each module's fallback work, created once per hook instance (a stable reference, like the
  // old per-module useState initialisers).
  const defaultWorkRef = useRef({})

  function defaultWorkFor(moduleType) {
    const slot = getModuleDefinition(moduleType)?.workSlot
    if (!slot) return null
    if (!Object.hasOwn(defaultWorkRef.current, moduleType)) {
      defaultWorkRef.current[moduleType] = slot.empty()
    }
    return defaultWorkRef.current[moduleType]
  }

  // The latest work for `moduleType`, or that module's default when the slot holds another
  // module's (or no) work.
  function workValueFor(moduleType) {
    const current = workRef.current
    return current.moduleType === moduleType ? current.value : defaultWorkFor(moduleType)
  }

  // workValueFor for render: from the rendered `work` state rather than the ref.
  function renderedWorkFor(moduleType) {
    return work.moduleType === moduleType ? work.value : defaultWorkFor(moduleType)
  }

  function setWork(moduleType, value) {
    const current = workRef.current
    const taskId = currentTaskIdRef.current ?? null
    if (current.moduleType === moduleType && current.value === value && current.taskId === taskId)
      return
    const next = { moduleType, taskId, value }
    workRef.current = next
    setWorkState(next)
  }

  // An information or activity task has no work: the slot forgets the code it held.
  function clearWork() {
    if (workRef.current === EMPTY_WORK) return
    workRef.current = EMPTY_WORK
    setWorkState(EMPTY_WORK)
  }

  // Restored work (load, reset, stage, complete, sandbox, teacher edit and push) goes through
  // the module's normalise; the student's own edits are stored as the workspace reported them.
  // Returns the value set.
  function restoreWork(moduleType, value) {
    const restored = getModuleDefinition(moduleType).workSlot.normalise(value)
    setWork(moduleType, restored)
    return restored
  }

  // A module's work as its storage and wire hooks take it: `{ work, meta }` (Arcade: the code,
  // plus `{ arcadeDesign }`).
  function storedWork(moduleType, value = workValueFor(moduleType)) {
    return getModuleDefinition(moduleType).workSlot.stored(value)
  }

  // The work with `code` as its storage/wire work, the rest (Arcade's design) kept from `base`.
  function withCode(moduleType, code, base = workValueFor(moduleType)) {
    return getModuleDefinition(moduleType).workSlot.fromStored({ work: code, meta: {} }, base)
  }

  // Code modules treat the run as part of the code: restoring their work clears it.
  function clearRunFor(moduleType) {
    if (getModuleDefinition(moduleType).workSlot.kind !== 'code') return
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
  }

  // Saves restored work (show stage, show complete, a persisting remote reset, the Reset
  // button of a state module): code modules save the cleared run alongside the code, the
  // shape savePythonCode wrote; state modules save the work through their storage adapter.
  function persistRestoredWork(moduleType, value) {
    const { workSlot } = getModuleDefinition(moduleType)
    const { work: stored, meta } = workSlot.stored(value)
    const actorId = effectiveIdentity?.anonymousId
    if (workSlot.kind === 'code') {
      persistence.saveRunRecord(moduleType, actorId, currentTaskId, stored, {
        output: '',
        runStatus: null,
        ...meta,
      })
    } else {
      persistence.saveWork(moduleType, actorId, currentTaskId, stored, meta)
    }
  }

  function interactionFor(moduleType) {
    return interactionsRef.current[moduleType] ?? DEFAULT_INTERACTION
  }

  function setInteraction(moduleType, interaction) {
    const next = { ...interactionsRef.current, [moduleType]: interaction }
    interactionsRef.current = next
    setInteractionsState(next)
  }

  // Render-time names derived from the slot: the old `code` state, and the current module's
  // stored work (null off the slot), which useTeacherLivePublish tracks as a publish trigger.
  const code = codeOfSlot(work)
  const renderedStoredWork = workSlotDefinition(lesson?.type)
    ? storedWork(lesson.type, renderedWorkFor(lesson.type)).work
    : null

  // ─── Runtime status ───────────────────────────────────────────────────────

  const [pyodideStatus, setPyodideStatus] = useState('idle')

  useEffect(() => {
    const mod = getLessonModule(lesson?.type)
    if (!lesson || !mod?.runtime?.init || mod.runtime.isReady()) return
    // No progress callback — nothing currently displays the raw progress text (the
    // loading banner just shows a static message), and passing one here previously
    // clobbered pyodideStatus's 'loading'/'ready'/'error' enum with human-readable
    // progress strings for most of the load, breaking the banner and Run-button state.
    setPyodideStatus('loading')
    mod.runtime
      .init()
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson])

  async function initRuntimeIfNeeded() {
    const mod = getLessonModule(lesson?.type)
    if (!mod?.runtime?.isReady || mod.runtime.isReady()) return
    setPyodideStatus('loading')
    await mod.runtime.init()
    setPyodideStatus('ready')
  }

  // ─── Sub-hooks ────────────────────────────────────────────────────────────

  // Keep HTML assets available for a teacher-live HTML task even when this
  // student is currently editing a different module in a composed lesson.
  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets('html')
  const { storageAssets: lessonStorageAssets } = useLessonStorageAssets(
    lesson?.isPlayground ? null : (lesson?.id ?? lessonId),
    lesson?.storageAssets ?? []
  )
  const htmlSharedAssetNames = lesson?.sharedAssetNames ?? null
  const htmlIncludedTypeAssets =
    htmlSharedAssetNames !== null
      ? htmlTypeAssets.filter((a) => htmlSharedAssetNames.includes(a.name))
      : htmlTypeAssets
  const htmlIframeStorageAssets = [
    ...lessonStorageAssets.filter((a) => a.showInEditor),
    ...htmlIncludedTypeAssets.filter((a) => !lessonStorageAssets.some((b) => b.name === a.name)),
  ]

  const myStudentData = session?.students?.[identity?.anonymousId]
  const supportStageReveals = useMemo(
    () => ({
      ...(session?.supportRevealLog?.[effectiveIdentity?.anonymousId]?.[currentTaskId] ?? {}),
      ...(localSupportStageReveals[currentTaskId] ?? {}),
    }),
    [
      session?.supportRevealLog,
      effectiveIdentity?.anonymousId,
      currentTaskId,
      localSupportStageReveals,
    ]
  )
  const activeSupportStageIndex = useMemo(() => {
    const visibility = supportStageVisibility[currentTaskId]
    if (visibility !== undefined) return visibility
    const revealedIndexes = Object.keys(supportStageReveals).map(Number).filter(Number.isInteger)
    return revealedIndexes.length ? Math.max(...revealedIndexes) : null
  }, [currentTaskId, supportStageReveals, supportStageVisibility])
  const offeredSupportStageIndex = supportStageOffers[currentTaskId] ?? null

  // Teacher-live-code support reference: Presentation View's independent
  // teacherLiveReference broadcast (separate from teacherLive, which drives
  // the all-or-nothing "Go Live" force takeover) shown as a dismissible
  // reference. Deriving this reactively — rather than via an explicit
  // "clear" write — is what makes it auto-clear the instant Presentation
  // closes or moves to a different task.
  const teacherLiveReferenceRequested =
    !!myStudentData?.teacherLiveReferenceVisible || !!session?.teacherLiveReferenceVisibleToAll
  const teacherLiveReferenceActive =
    teacherLiveReferenceRequested &&
    !!session?.teacherLiveReference?.active &&
    session?.teacherLiveReference?.taskId === currentTaskId

  // Log the first time this becomes visible for this task, matching the
  // existing "note the reveal happened once" semantics used for authored
  // stage reveals — recordSupportStageReveal already no-ops on repeats.
  useEffect(() => {
    if (!teacherLiveReferenceActive) return
    if (teacherPresentation || phase !== 'lesson') return
    if (!effectiveIdentity?.anonymousId) return
    recordSupportStageReveal?.(effectiveIdentity.anonymousId, currentTaskId, 'teacherLive', {
      source: 'teacher',
      stageLabel: "Teacher's live code",
    })
  }, [
    teacherLiveReferenceActive,
    teacherPresentation,
    phase,
    effectiveIdentity?.anonymousId,
    currentTaskId,
    recordSupportStageReveal,
  ])

  const teacherHighlights = useMemo(() => {
    const raw = myStudentData?.teacherHighlights
    if (!raw) return []
    return Object.entries(raw)
      .filter(([, h]) => decodeFileKey(h.file) === activeFile)
      .map(([id, h]) => ({ id, from: h.from, to: h.to, emoji: h.emoji, note: h.note }))
  }, [myStudentData?.teacherHighlights, activeFile])

  const dismissHighlight = useCallback(
    (highlightId) => {
      if (!identity?.anonymousId) return
      removeTeacherHighlight?.(identity.anonymousId, highlightId)
    },
    [identity, removeTeacherHighlight]
  )

  const {
    checkPassed,
    setCheckPassed,
    checkAttempted,
    setCheckAttempted,
    checkSuggestion,
    setCheckSuggestion,
    repeatedSuggestionCount,
    checkFailCount,
    testResults,
    setTestResults,
    checkPassedRef,
    offeredStageIndex,
    setOfferedStageIndex,
    completePreviewShown,
    setCompletePreviewShown,
    stagePromptAccepted,
    markStagePromptAccepted,
    resetRunFeedback,
    resetCheckFeedback,
    applyCheckFeedback,
  } = useCheckFeedback({ myStudentData })

  const sandboxModuleId = lesson?.lessonModule?.id ?? null
  const activityLivePayloadRef = useRef(null)
  const persistence = createStudentPersistence({
    lessonId,
    teacherPresentation,
    previewMode,
    inPersonalSandboxRef,
    sandboxModuleId,
  })

  const {
    teacherLiveIframeSrc,
    htmlPreviewCollapsed,
    setHtmlPreviewCollapsed,
    canPublishTeacherLive,
    currentTeacherLivePayload,
    publishTeacherLive,
    publishOutputCollapsed,
  } = useTeacherLivePublish({
    teacherPresentation,
    identityRef,
    sessionRef,
    lessonRef,
    currentTaskIdRef,
    codeRef,
    scratchCodeRef,
    turtleResultRef,
    filesRef,
    activeFileRef,
    outputRef,
    runStatusRef,
    // Generic work slot: read at payload time (refs), and its stored work (the code string for
    // code modules, so an Arcade design edit adds no publish) as the publish trigger.
    readWorkValue: workValueFor,
    editorSelectionRef,
    editorActivityRef,
    lesson,
    session,
    identity,
    currentTaskId,
    code,
    files,
    activeFile,
    output,
    runStatus,
    checkPassed,
    checkAttempted,
    checkSuggestion,
    workValue: renderedStoredWork,
    iframeStorageAssets: htmlIframeStorageAssets,
    extraPayloadRef: activityLivePayloadRef,
    updateTeacherLive,
    setTeacherLiveReference,
  })

  // Hosted activity tasks (taskType 'activity' and legacy quizzes): state, persistence, live
  // sync, grading, reset and teacher edits. See useActivityState.js for the write rules.
  const activity = useActivityState({
    lesson,
    currentTaskId,
    viewingTaskId,
    phase,
    teacherPresentation,
    identity,
    effectiveIdentity,
    session,
    myStudentData,
    persistence,
    writeStudentAnswer,
    writeStudentRun,
    logAttempt,
    clearTeacherAnswerEdit,
    applyCheckFeedback,
    resetCheckFeedback,
    setRunStatus,
    canPublishTeacherLive,
    publishTeacherLive,
    teacherAssistedTaskIdsRef,
    onTeacherAnswerApplied: setTeacherAnswerNoticeAt,
    livePayloadRef: activityLivePayloadRef,
  })

  const isAlreadySolved = () => checkPassedRef.current && !inPersonalSandboxRef.current

  function clearIdleFeedbackTimer() {
    if (idleFeedbackTimerRef.current !== null) {
      clearTimeout(idleFeedbackTimerRef.current)
      idleFeedbackTimerRef.current = null
    }
  }

  function scheduleIdleFeedback(contextBuilder, options = {}) {
    clearIdleFeedbackTimer()
    if (isAlreadySolved() || inPersonalSandboxRef.current) return
    idleFeedbackTimerRef.current = setTimeout(() => {
      idleFeedbackTimerRef.current = null
      const currentLesson = lessonRef.current
      const taskId = currentTaskIdRef.current
      const task = findTaskById(currentLesson?.tasks, taskId)
      if (!task?.feedbackChecks && !task?.incorrectChecks) return
      const feedbackChecks = normalizeFeedbackChecks(task).filter((check) =>
        options.feedbackFilter ? options.feedbackFilter(check, task) : true
      )
      if (feedbackChecks.length === 0) return
      const feedbackTask = {
        ...task,
        feedbackChecks,
        incorrectChecks: null,
      }
      const context = contextBuilder()
      const completionPassed = task?.check ? evaluateCheck(task.check, null, context) : false
      const evaluation = evaluateCheckWithFeedback(feedbackTask, '', context, {
        completionPassed,
        feedbackTiming: FEEDBACK_TIMING.ON_IDLE,
      })
      const matchedIdleFeedback = evaluation.feedbackResults.find((result) => result.passed)
      if (matchedIdleFeedback && !isAlreadySolved()) {
        applyCheckFeedback(evaluation.passed, evaluation.suggestion)
        updateTargetedStageOffer(task, evaluation, evaluation.passed)
      }
    }, IDLE_FEEDBACK_DELAY_MS)
  }

  useEffect(
    () => () => {
      if (idleFeedbackTimerRef.current !== null) {
        clearTimeout(idleFeedbackTimerRef.current)
        idleFeedbackTimerRef.current = null
      }
    },
    [lesson?.type, currentTaskId]
  )

  useEffect(
    () => () => {
      if (arcadeDesignWriteTimerRef.current !== null)
        clearTimeout(arcadeDesignWriteTimerRef.current)
    },
    []
  )

  // Presentation/preview persist to an in-memory store (see createStudentPersistence);
  // start each such session clean so stale state from a previous preview can't leak in.
  useEffect(() => {
    if (teacherPresentation || previewMode) clearEphemeralStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── localStorage snapshot helpers ────────────────────────────────────────

  function saveCurrentWorkSnapshot() {
    const id = effectiveIdentity
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!id || !currentLesson) return
    if (inPersonalSandboxRef.current) return

    const task = flattenTasks(currentLesson.tasks).find((t) => t.id === taskId)
    if (task?.taskType === 'information') return
    // Activities (quizzes included) save every change themselves (useActivityState).
    if (isHostedActivityTask(task)) return

    if (workSlotDefinition(currentLesson.type)) {
      // The storage adapter picks the record fields: python/turtle keep the run, Arcade adds
      // its design, electronics/filesystem/desktop save the work alone.
      const { work: stored, meta } = storedWork(currentLesson.type)
      persistence.saveWork(currentLesson.type, id.anonymousId, taskId, stored, {
        output: outputRef.current,
        runStatus: runStatusRef.current,
        ...meta,
      })
    } else if (currentLesson.type === 'html') {
      persistence.saveHtmlFiles(id.anonymousId, taskId, filesRef.current)
    }
    // Scratch: blocks are saved immediately in handleScratchChange — no snapshot needed
  }

  function savePersonalSandboxSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    if (!id || teacherPresentation || !currentLesson) return
    const slotDefinition = workSlotDefinition(currentLesson.type)
    if (slotDefinition) {
      // Written directly (not persistence.saveSandboxWork, which also skips builder preview) to
      // keep this snapshot's existing preview behaviour. Arcade's sandbox record keeps its design.
      const { work: stored, meta } = storedWork(currentLesson.type)
      savePersonalSandboxCode(
        lessonId,
        id.anonymousId,
        slotDefinition.storage.toSandboxRecord(stored, meta),
        currentLesson.lessonModule?.id ?? null
      )
    } else if (currentLesson.type === 'html') {
      filesRef.current.forEach((f) =>
        savePersonalSandboxFile(
          lessonId,
          f.name,
          id.anonymousId,
          f.content,
          currentLesson.lessonModule?.id ?? null
        )
      )
    }
    // Scratch: saves incrementally via handleScratchChange
  }

  function recordCarryFallback(fallback) {
    const id = identityRef.current
    if (
      !fallback ||
      teacherPresentation ||
      previewMode ||
      phaseRef.current !== 'lesson' ||
      !id?.anonymousId
    )
      return
    if (sessionRef.current?.carryFallbackLog?.[id.anonymousId]?.[fallback.taskId]) return
    recordStudentCarryFallback?.(id.anonymousId, fallback.taskId, fallback)
  }

  // ─── Task content loading ──────────────────────────────────────────────────

  function loadTaskContent(taskId) {
    const activeIdentity = effectiveIdentity
    if (!lesson || !activeIdentity) return
    const task = flattenTasks(lesson.tasks).find((t) => t.id === taskId)
    if (!task) return
    if (task.taskType === 'information' || isHostedActivityTask(task)) {
      // No code for an information or activity task (the old `setCode('')`); a state module's
      // work (filesystem, desktop) is left as it was.
      if (isCodeWork(workSlotDefinition(workRef.current.moduleType))) clearWork()
      setFiles([])
      setActiveFile('')
      resetCheckFeedback()
      return
    }
    if (workSlotDefinition(lesson.type)) {
      loadWorkSlotTask(task, taskId, activeIdentity)
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
      setScratchActiveStageIndex(null)
      scratchCodeRef.current = ''
      resetCheckFeedback()
    } else {
      const taskFiles = selectHtmlTaskFiles({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedFile: (sourceTaskId, filename) =>
          persistence.readSavedFile(activeIdentity.anonymousId, sourceTaskId, filename),
        onCarryFallback: recordCarryFallback,
      })
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  // Loads a work-slot module's work for a task, per its workSlot.kind:
  // - 'code' (python, turtle, arcade): the own save only in solo, else carry-through
  //   (carryCodeFrom), else the starter — selectPythonTaskCode, which the HTML loader mirrors.
  //   The module's extras (Arcade's design) come from the task's own record in any phase, else
  //   the starter's. Check feedback and HTML files are left alone.
  // - 'state' (electronics, filesystem, desktop): the own save, else the carry source when the
  //   task carries (carryThroughField), else the starter; the interaction keeps the previous
  //   directory only when carrying; HTML files are cleared and check feedback reset.
  function loadWorkSlotTask(task, taskId, activeIdentity) {
    const moduleType = lesson.type
    const definition = workSlotDefinition(moduleType)
    const { workSlot } = definition
    const readStored = (sourceTaskId) =>
      persistence.readWork(moduleType, activeIdentity.anonymousId, sourceTaskId)
    if (workSlot.kind === 'code') {
      const code = selectPythonTaskCode({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedCode: (sourceTaskId) =>
          persistence.readSavedCode(activeIdentity.anonymousId, sourceTaskId),
        onCarryFallback: recordCarryFallback,
      })
      const own = readStored(taskId)
      restoreWork(
        moduleType,
        workSlot.fromStored({ work: code, meta: own?.meta ?? {} }, workSlot.starter(task))
      )
      return
    }
    const carryField = definition.carryThroughField
    const readSavedWork = (sourceTaskId) => readStored(sourceTaskId)?.work ?? null
    const carryId = task[carryField] ?? null
    const ownSaved = readSavedWork(taskId)
    const carried = resolveSavedCarrySource({
      tasks: lesson.tasks,
      taskId,
      carryFromId: carryId,
      carryField,
      readSavedState: readSavedWork,
      hasSavedState: (saved) => saved != null,
    })
    if (ownSaved == null) recordCarryFallback(carried.fallback)
    const starter = workSlot.starter(task)
    const initialWork =
      carryId != null ? (ownSaved ?? carried.saved ?? starter) : (ownSaved ?? starter)
    restoreWork(moduleType, initialWork)
    const defaultDir = task.startsInDir ? normaliseDirPath(task.startsInDir) : '/'
    setInteraction(moduleType, {
      currentDir: carryId ? (interactionFor(moduleType).currentDir ?? defaultDir) : defaultDir,
      openFile: null,
    })
    setFiles([])
    setActiveFile('')
    resetCheckFeedback()
  }

  // Exposed to StudentView for coordination (save before task change, navigation)
  function resetForTaskChange() {
    // A python/electronics run left mid-flight (e.g. a loop or input() wait) must not
    // keep executing once the student has moved to a different task.
    if (running || runningTests) {
      getLessonModule(lesson?.type)?.runtime?.stop()
    }
    setRunning(false)
    setRunningTests(false)
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setErrorLine(null)
    setHtmlErrorLocation(null)
    resetCheckFeedback()
    setTargetedStageOffer(null)
    setTargetedPreviewStageIndex(null)
    targetedStageOfferMatchCountsRef.current = {}
    setIframeSrc(null)
    // Clear any pushed scratch state (reset/stage/solution/teacher edit) so it
    // can't overwrite the next task's initial blocks after the workspace remounts.
    setScratchExternalState(null)
  }

  function updateTargetedStageOffer(task, evaluation, passed) {
    if (passed || !evaluation?.stageOffer) {
      setTargetedStageOffer(null)
      if (passed) {
        setTargetedPreviewStageIndex(null)
        targetedStageOfferMatchCountsRef.current = {}
      }
      return
    }
    const stageIndex = Number(evaluation.stageOffer.stageIndex)
    if (!Number.isInteger(stageIndex) || !task?.codeStages?.[stageIndex]) {
      setTargetedStageOffer(null)
      return
    }
    // Do not interrupt a reference already on screen. A repeat of the same
    // targeted reference is the one exception: next time, offer its code as a
    // recovery copy rather than merely showing it again.
    if (targetedPreviewStageIndex != null) {
      if (targetedPreviewStageIndex !== stageIndex) {
        setTargetedStageOffer(null)
        return
      }
      setTargetedStageOffer({ ...evaluation.stageOffer, stageIndex, action: 'replace' })
      return
    }
    if (activeSupportStageIndex != null) {
      setTargetedStageOffer(null)
      return
    }
    const feedbackIndex = evaluation.feedbackResults?.indexOf(evaluation.matchedFeedback) ?? -1
    const matchKey = `${currentTaskId}:${feedbackIndex}`
    const matchCount = (targetedStageOfferMatchCountsRef.current[matchKey] ?? 0) + 1
    targetedStageOfferMatchCountsRef.current[matchKey] = matchCount
    if (matchCount < getStageOfferMatchThreshold(evaluation.stageOffer)) {
      setTargetedStageOffer(null)
      return
    }
    setTargetedStageOffer({ ...evaluation.stageOffer, stageIndex })
  }

  function exitPersonalSandbox() {
    if (!inPersonalSandboxRef.current) return
    savePersonalSandboxSnapshot()
    inPersonalSandboxRef.current = false
    setInPersonalSandbox(false)
    const id = identityRef.current
    if (id?.anonymousId) writeStudentPersonalSandbox(id.anonymousId, false)
  }

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (lesson?.type === 'html') setHtmlPreviewCollapsed(true)
  }, [lesson?.type, currentTaskId])

  // Load task content when task or phase changes.
  // lesson is intentionally excluded: a lesson override push (lessonOverrideTasks) produces a new
  // lesson reference but should not reload the student's current work mid-task.
  useEffect(() => {
    if ((phase === 'lesson' || phase === 'solo') && effectiveIdentity && lesson) {
      loadTaskContent(currentTaskId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTaskId, effectiveIdentity?.anonymousId])

  // When phase leaves lesson/solo, exit personal sandbox silently
  useEffect(() => {
    if (phase === 'lesson' || phase === 'solo') return
    if (!inPersonalSandboxRef.current) return
    savePersonalSandboxSnapshot()
    setInPersonalSandbox(false)
    if (identity?.anonymousId) writeStudentPersonalSandbox(identity.anonymousId, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useStudentPresenceReporting({
    phase,
    identity,
    session,
    connected,
    teacherPresentation,
    registerPresence,
    writeStudentPresence,
    removeStudent,
  })

  useSandboxCodePush({
    phase,
    lesson,
    session,
    // useSandboxCodePush keeps its per-module setters until plan step 4.6 routes it via `wire`.
    // The pushed code replaces the code module's code; Arcade keeps its current design.
    setCode: (pushed) => restoreWork(lesson.type, withCode(lesson.type, pushed)),
    setFiles,
    setActiveFile,
    setFsState: (fs) => restoreWork('filesystem', fs),
    setDesktopState: (desktop) => restoreWork('desktop', desktop),
    setScratchSandboxProject,
  })

  // When teacher starts live-viewing this student, publish the current in-memory editor state
  useEffect(() => {
    if (teacherPresentation) return
    if (!identity?.anonymousId || session?.activeStudentView !== identity.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    if (!lesson || viewingTaskId !== null) return
    // Activity and quiz tasks flush their own state (useActivityState); there is no code to
    // mirror. In a session sandbox the student works in the lesson's workspace whatever task
    // the session is parked on, so its code is still flushed there.
    if (phase !== 'sandbox' && isHostedActivityTask(findTaskById(lesson.tasks, currentTaskId)))
      return

    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition) {
      writeStudentCode(
        identity.anonymousId,
        slotDefinition.wire.toCode(storedWork(lesson.type).work)
      )
      // Modules checked on Run also mirror the run: its output and any pending input() prompt.
      // Modules checked on every change (filesystem, desktop) have no run to mirror.
      if (slotDefinition.checking.trigger !== 'change') {
        writeStudentOutput(identity.anonymousId, output)
        writeStudentInputState(identity.anonymousId, {
          prompt: inputPromptRef.current,
          value: inputPromptRef.current !== null ? inputValueRef.current : '',
        })
      }
    } else if (lesson.type === 'html') {
      writeStudentFiles(
        identity.anonymousId,
        Object.fromEntries(files.map((f) => [f.name, f.content]))
      )
    } else if (lesson.type === 'scratch') {
      const saved = persistence.readSavedCode(identity.anonymousId, currentTaskId)
      if (saved?.state) writeStudentCode(identity.anonymousId, JSON.stringify(saved.state))
    }
    // code_arrange is a taskType flag layered on python/html, not its own
    // lesson.type, so it needs its own branch here too — without it, a
    // teacher opening the modal mid-arrangement sees a blank board (no
    // currentCodeArrangeSlots has ever been written for this student/task
    // yet) that then jumps straight to whatever the student had already
    // placed the moment they drop their next tile, instead of reflecting
    // their in-progress board right away.
    if (findTaskById(lesson.tasks, currentTaskId)?.taskType === 'code_arrange') {
      writeStudentCodeArrangeSlots?.(identity.anonymousId, codeArrangeSlotStateRef.current)
    }
    writeStudentInteraction(identity.anonymousId, {
      selection: editorSelectionRef.current,
      activeFile: lesson.type === 'html' ? activeFile : undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // React to teacher remotely resetting or completing this student's code. Which content
  // the action maps to is resolveRemoteResetTarget's job; this only applies the result.
  useEffect(() => {
    if (!myStudentData?.remoteResetPushedAt || (phase !== 'lesson' && phase !== 'solo')) return
    const action = myStudentData.remoteResetAction
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task || !action) return
    // Activity resets are applied by useActivityState.
    if (isHostedActivityTask(task)) return

    const revealMatch = action.match(/^reveal_stage_(\d+)$/)
    if (revealMatch) {
      const stageIndex = parseInt(revealMatch[1], 10)
      const stage = task.codeStages?.[stageIndex]
      if (getStageRole(stage) === 'support') handleRevealSupportStage(stageIndex, 'teacher')
      else if (getStageRole(stage) === 'complete') setCompletePreviewShown(true)
      return
    }

    const target = resolveRemoteResetTarget(task, action, lesson.type, {
      fs: DEFAULT_FS,
      circuit: DEFAULT_CIRCUIT,
      desktop: makeDefaultDesktop(task.availableApps),
    })
    if (!target) return

    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition) {
      const restored = restoreWork(
        lesson.type,
        slotDefinition.workSlot.fromResetTarget(target, task, action)
      )
      // Only a module whose extras have no other save on reset (Arcade's design) persists the
      // reset and, while watched, mirrors the extras; everyone else's record is left until the
      // next edit or snapshot.
      if (slotDefinition.workSlot.remoteResetPersists) {
        persistRestoredWork(lesson.type, restored)
        const { meta } = storedWork(lesson.type, restored)
        if (
          Object.hasOwn(meta, 'arcadeDesign') &&
          identity?.anonymousId &&
          sessionRef.current?.activeStudentView === identity.anonymousId
        )
          writeStudentArcadeDesign?.(identity.anonymousId, meta.arcadeDesign)
      }
      clearRunFor(lesson.type)
      resetCheckFeedback()
    } else if (lesson.type === 'html') {
      setFiles(target.files.map((f) => ({ ...f })))
      setActiveFile(target.entryFile ?? target.files[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'scratch') {
      setScratchActiveStageIndex(target.stageIndex)
      setScratchExternalState(target.blocks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // Apply a teacher's edit to this student's Code Arrange tiles (StudentModal "Edit answers").
  // Quiz and activity answer edits are applied by useActivityState, so marking, the Firebase
  // mirror and the attempt log behave exactly as if the student had answered — the only
  // difference is the teacherAssisted flag on the logged attempt.
  useEffect(() => {
    const edit = myStudentData?.teacherAnswerEdit
    if (!edit?.at || teacherPresentation || !lesson) return
    // Wait until the student is actually in the lesson on a loaded task —
    // applying earlier would skip the Firebase/attempt-log writes and then
    // never retry, since the edit is marked applied below.
    if (phase !== 'lesson' || currentTaskId == null) return
    if (appliedTeacherAnswerEditAtRef.current === edit.at) return
    appliedTeacherAnswerEditAtRef.current = edit.at
    if (edit.taskId != null && String(edit.taskId) !== String(currentTaskIdRef.current)) return
    if (viewingTaskId !== null) return
    const task = findTaskById(lesson.tasks, currentTaskId)
    if (task?.taskType === 'code_arrange' && edit.codeArrangeSlots) {
      teacherAssistedTaskIdsRef.current.add(currentTaskId)
      setTeacherCodeArrangeEdit({ slots: edit.codeArrangeSlots, at: edit.at })
      setTeacherAnswerNoticeAt(edit.at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherAnswerEdit?.at, lesson, phase, currentTaskId])

  // Teacher pressed Run for this student (StudentModal). Consumed (cleared in
  // Firebase) as soon as it's handed to the workspace, so it runs once.
  useEffect(() => {
    const pushedAt = myStudentData?.remoteRunPushedAt
    if (!pushedAt || teacherPresentation || !lesson || !identity?.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    if (viewingTaskId !== null || currentTaskId == null) return
    const requestedTaskId = myStudentData?.remoteRunTaskId
    clearRemoteRun?.(identity.anonymousId)
    if (requestedTaskId != null && String(requestedTaskId) !== String(currentTaskId)) return
    setRemoteRunToken(pushedAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteRunPushedAt, lesson, phase, currentTaskId, viewingTaskId])

  function supersedeTeacherAnswerEdit() {
    if (!identity?.anonymousId || !myStudentData?.teacherAnswerEdit) return
    clearTeacherAnswerEdit?.(identity.anonymousId)
  }

  // Apply teacher-committed work when teacher finishes a live edit.
  useEffect(() => {
    if (!myStudentData?.teacherEditAppliedAt) return
    const newCode = myStudentData?.teacherEditApplyCode
    const newFiles = myStudentData?.teacherEditApplyFiles
    const newArcadeDesign = myStudentData?.teacherEditApplyArcadeDesign
    if (lesson?.type === 'html' && newFiles) {
      const nextFiles = decodeSessionFiles(newFiles, decodeFileKey, 'html')
      setFiles(nextFiles)
      setActiveFile((current) =>
        nextFiles.some((file) => file.name === current) ? current : (nextFiles[0]?.name ?? '')
      )
      setOutput('')
      setTurtleResult(null)
      setRunStatus(null)
      resetCheckFeedback()
      if (effectiveIdentity?.anonymousId) {
        persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, nextFiles)
      }
    } else if (newCode !== undefined && isCodeWork(workSlotDefinition(lesson?.type))) {
      // The teacher edited code: a code module takes it (Arcade also the design the teacher
      // sent, else keeps its own); state modules (filesystem, desktop) never apply teacher edits.
      const { workSlot } = workSlotDefinition(lesson.type)
      const restored = restoreWork(
        lesson.type,
        workSlot.fromStored(
          { work: newCode ?? '', meta: { arcadeDesign: newArcadeDesign } },
          workValueFor(lesson.type)
        )
      )
      setOutput('')
      setTurtleResult(null)
      setRunStatus(null)
      resetCheckFeedback()
      if (effectiveIdentity?.anonymousId) {
        const { work: stored, meta } = storedWork(lesson.type, restored)
        persistence.saveRunRecord(
          lesson.type,
          effectiveIdentity.anonymousId,
          currentTaskId,
          stored,
          {
            output: '',
            runStatus: null,
            ...meta,
          }
        )
      }
    } else if (newCode !== undefined && lesson?.type === 'scratch') {
      const newState = parseScratchState(newCode)
      setScratchExternalState(newState)
      resetCheckFeedback()
      if (effectiveIdentity?.anonymousId && newState) {
        persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, newState)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherEditAppliedAt])

  // ─── Personal sandbox ──────────────────────────────────────────────────────

  function handleEnterPersonalSandbox() {
    if (!identity || teacherPresentation || !lesson) return
    const id = identity.anonymousId
    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition) {
      // The saved sandbox work (Arcade: with its saved design), else the lesson's sandbox starter.
      const { workSlot } = slotDefinition
      const saved = persistence.readSandboxWork(lesson.type, id)
      restoreWork(lesson.type, workSlot.fromStored(saved, workSlot.sandbox(lesson)))
    } else if (lesson.type === 'html') {
      const starterFiles = lesson.sandboxStarterFiles ?? []
      const sandboxFiles = starterFiles.map((f) => {
        const savedContent = loadPersonalSandboxFile(lessonId, f.name, id, sandboxModuleId)
        return { ...f, content: savedContent ?? f.content }
      })
      const withContent =
        sandboxFiles.length > 0 ? sandboxFiles : starterFiles.map((f) => ({ ...f }))
      setFiles(withContent)
      setActiveFile(withContent[0]?.name ?? '')
    }
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setIframeSrc(null)
    resetCheckFeedback()
    setInPersonalSandbox(true)
    if (session) writeStudentPersonalSandbox(id, true)
  }

  function handleLeavePersonalSandbox() {
    if (!identity) return
    savePersonalSandboxSnapshot()
    setInPersonalSandbox(false)
    if (session) writeStudentPersonalSandbox(identity.anonymousId, false)
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setIframeSrc(null)
    resetCheckFeedback()
    loadTaskContent(currentTaskId)
  }

  // ─── Run / Stop / Tests ────────────────────────────────────────────────────

  async function handleRun() {
    const actor = effectiveIdentity
    if (!actor || running) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const moduleType = lesson?.type
    const mod = getLessonModule(moduleType)
    const definition = getModuleDefinition(moduleType)
    const isWatched = session?.activeStudentView === actor.anonymousId
    // Checked live on every mirror write, not captured once at run start: a
    // teacher can open (or close) StudentModal while the program is running.
    const isWatchedNow = () =>
      !teacherPresentation && activeStudentViewRef.current === actor.anonymousId
    const alreadySolved = isAlreadySolved()
    // Dispatch on the module's declared run capability. 'workspace' modules (Arcade, Scratch)
    // run inside their own workspace and 'none' modules (Filesystem, Desktop) have nothing to
    // run, so bail out before touching `running`; a 'preview' module needs its preview builder.
    const runKind = definition?.capabilities.run ?? 'none'
    const runsHere =
      runKind === 'runtime' ||
      (runKind === 'preview' && typeof mod?.runtime?.buildPreviewSrc === 'function')
    if (!runsHere) return

    setRunning(true)
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setTestResults(null)
    setErrorLine(null)
    setHtmlErrorLocation(null)
    if (!alreadySolved) resetRunFeedback()

    if (runKind === 'runtime') {
      await runWithRuntime({
        actor,
        task,
        definition,
        runtime: mod.runtime,
        startCode: storedWork(moduleType).work,
        currentTaskId,
        isWatched,
        isWatchedNow,
        alreadySolved,
        teacherPresentation,
        // Through the slot, so a MicroPython update is visible to the next read at once.
        readCode: () => storedWork(moduleType).work,
        setCode: (nextCode) => setWork(moduleType, withCode(moduleType, nextCode)),
        refs: {
          outputRafIdRef,
          outputMirrorRef,
          inputPromptRef,
          inputValueRef,
          submitInputEchoRef,
          appendOutputRef,
          runtimeCodeRafIdRef,
          pendingRuntimeCodeRef,
          lastRuntimeCodeWriteRef,
          currentTaskIdRef,
          phaseRef,
          inPersonalSandboxRef,
          teacherAssistedTaskIdsRef,
        },
        setters: {
          setOutput,
          setInputPrompt,
          setErrorLine,
          setRunStatus,
          setTurtleResult,
          setRunning,
        },
        writers: {
          writeStudentInputState,
          writeStudentOutput,
          writeStudentCode,
          writeStudentRun,
          writeStudentTurtleResult,
          logAttempt,
        },
        live: {
          canPublishTeacherLive,
          updateTeacherLive,
          currentTeacherLivePayload,
          publishTeacherLive,
        },
        feedback: { applyCheckFeedback, updateTargetedStageOffer, updateSupportStageForAttempt },
        saveRunRecord: (taskId, runCode, fields) =>
          persistence.saveRunRecord(moduleType, actor.anonymousId, taskId, runCode, fields),
      })
      return
    }

    // 'preview' (HTML) — build the iframe
    setHtmlPreviewCollapsed(false)
    const currentFiles = filesRef.current
    const src = mod.runtime.buildPreviewSrc(
      { files: currentFiles, entryFile: task?.entryFile ?? 'index.html' },
      task,
      {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
        storageAssets: htmlIframeStorageAssets,
      }
    )
    htmlSupportAttemptsRef.current.clear()
    htmlSupportAttemptsRef.current.set(src, {
      hasError: false,
      outcomeApplied: false,
      passed: false,
    })
    setIframeSrc(src)
    setRunStatus('success')

    const taskIdAtRunTime = currentTaskIdRef.current
    mod.runtime.waitForPreviewText().then((text) => {
      let passed,
        suggestion = ''
      if (!alreadySolved) {
        const codeStr = currentFiles.map((f) => f.content).join('\n')
        const iframeDoc = iframeRef.current?.contentDocument ?? null
        const evaluation = evaluateCheckWithFeedback(task, text, { code: codeStr, iframeDoc })
        passed = evaluation.passed
        suggestion = task?.check ? evaluation.suggestion : ''
        updateTargetedStageOffer(task, evaluation, passed)
        if (task?.check) applyCheckFeedback(passed, suggestion)
        const supportAttempt = htmlSupportAttemptsRef.current.get(src)
        const supportPassed = !supportAttempt?.hasError && (!task?.check || passed)
        if (supportAttempt) {
          supportAttempt.outcomeApplied = true
          supportAttempt.passed = supportPassed
        }
        updateSupportStageForAttempt(supportPassed)
      } else {
        passed = true
      }
      if (canPublishTeacherLive()) {
        publishTeacherLive({
          runStatus: 'success',
          checkPassed: passed,
          checkAttempted: !alreadySolved && !!task?.check,
          checkSuggestion: suggestion,
          files: Object.fromEntries(currentFiles.map((f) => [f.name, f.content])),
        })
      }
      if (
        !teacherPresentation &&
        (phaseRef.current === 'lesson' ||
          phaseRef.current === 'sandbox' ||
          inPersonalSandboxRef.current ||
          isWatched)
      ) {
        if (taskIdAtRunTime === currentTaskIdRef.current) {
          const filesMap = Object.fromEntries(currentFiles.map((f) => [f.name, f.content]))
          writeStudentRun(actor.anonymousId, {
            files: filesMap,
            status: 'success',
            checkPassed: passed,
          })
        }
      }
      if (
        !teacherPresentation &&
        phaseRef.current === 'lesson' &&
        !alreadySolved &&
        task?.check &&
        taskIdAtRunTime === currentTaskIdRef.current
      ) {
        const filesMap = Object.fromEntries(currentFiles.map((f) => [f.name, f.content]))
        logAttempt(actor.anonymousId, taskIdAtRunTime, {
          submission: filesMap,
          passed,
          suggestion,
          teacherAssisted: teacherAssistedTaskIdsRef.current.has(taskIdAtRunTime),
        })
      }
      persistence.saveHtmlFiles(actor.anonymousId, taskIdAtRunTime, currentFiles)
      setRunning(false)
    })
  }

  function handleStop() {
    getLessonModule(lesson?.type)?.runtime?.stop()
  }

  function handleInputSubmit(value) {
    inputPromptRef.current = null
    inputValueRef.current = ''
    setInputPrompt(null)
    if (submitInputEchoRef.current) {
      submitInputEchoRef.current(value)
    } else {
      appendOutputRef.current?.(value + '\n')
      if (identity && session?.activeStudentView === identity.anonymousId) {
        writeStudentInputState(identity.anonymousId, { prompt: null, value: '' })
      }
    }
    getLessonModule(lesson?.type)?.runtime?.provideInput(value)
  }

  // Mirrors the student's not-yet-submitted input() text to a watching
  // teacher, per keystroke — same activeStudentView gating AGENTS.md
  // requires for any per-keystroke Firebase write (see handleCodeChange).
  function handleInputChange(value) {
    inputValueRef.current = value
    if (identity && session?.activeStudentView === identity.anonymousId) {
      writeStudentInputState(identity.anonymousId, { prompt: inputPrompt, value })
    }
  }

  async function handleRunTests() {
    const actor = effectiveIdentity
    if (!actor || runningTests) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task?.tests?.length) return
    const isWatched = session?.activeStudentView === actor.anonymousId
    if (isAlreadySolved()) return

    setRunningTests(true)
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setTestResults(null)
    resetRunFeedback()

    const results = []
    const mod = getLessonModule(lesson?.type)
    try {
      await initRuntimeIfNeeded()

      for (const test of task.tests) {
        const inputQueue = (test.inputs ?? []).map((inp) => inp.value ?? '')
        let accumulated = ''
        const result = await mod.runtime.run(code, task, {
          onOutput: (text) => {
            accumulated += text
          },
          onInputRequired: () => {
            mod.runtime.provideInput(inputQueue.shift() ?? '')
          },
        })
        const resolvedCheck = resolveTestCheck(test.check, test.inputs ?? [])
        const checks = normalizeChecks(resolvedCheck)
        const checkContext = { status: result.status, code, variables: result.variables ?? {} }
        const passed =
          result.status !== 'error' &&
          checks.length > 0 &&
          checks.every((c) => evaluateSingleCheck(c, accumulated, checkContext))
        results.push({
          id: test.id,
          name: test.name || `Test ${results.length + 1}`,
          passed,
          output: accumulated,
          status: result.status,
        })
        if (result.status === 'stopped') break
      }

      const allPassed = results.length > 0 && results.every((r) => r.passed)
      const finalStatus = results.some((r) => r.status === 'error')
        ? 'error'
        : results.some((r) => r.status === 'stopped')
          ? 'stopped'
          : 'success'
      const displayedOutput =
        results.find((r) => !r.passed)?.output ?? results[results.length - 1]?.output ?? ''
      // A stop triggered by navigating away must not overwrite the freshly reset
      // state for the task the student moved to.
      if (finalStatus !== 'stopped' || currentTaskId === currentTaskIdRef.current) {
        setTestResults(results)
        setOutput(displayedOutput)
        setRunStatus(finalStatus)
      }
      if (finalStatus !== 'stopped') applyCheckFeedback(allPassed)
      if (finalStatus !== 'stopped') updateSupportStageForAttempt(allPassed)

      if (canPublishTeacherLive()) {
        publishTeacherLive({
          output: displayedOutput,
          runStatus: finalStatus,
          checkPassed: allPassed,
          checkAttempted: true,
        })
      }
      persistence.savePythonCode(actor.anonymousId, currentTaskId, {
        code,
        output: displayedOutput,
        runStatus: finalStatus,
      })
      if (
        !teacherPresentation &&
        (phaseRef.current === 'lesson' ||
          phaseRef.current === 'sandbox' ||
          inPersonalSandboxRef.current ||
          isWatched)
      ) {
        await writeStudentRun(actor.anonymousId, {
          code,
          output: displayedOutput,
          status: finalStatus,
          checkPassed: allPassed,
        })
      }
      if (!teacherPresentation && phaseRef.current === 'lesson' && finalStatus !== 'stopped') {
        const failedTestNames = results
          .filter((r) => !r.passed)
          .map((r) => r.name)
          .join(', ')
        logAttempt(actor.anonymousId, currentTaskId, {
          submission: code,
          passed: allPassed,
          suggestion: failedTestNames,
        })
      }
    } catch {
      getLessonModule(lesson?.type)?.runtime?.stop()
      setRunStatus('error')
      updateSupportStageForAttempt(false)
    } finally {
      setRunningTests(false)
    }
  }

  // ─── Editor change handlers ────────────────────────────────────────────────

  // The code editor's change handler (python, turtle, arcade, electronics — the latter sends
  // its serialised circuit): the new code replaces the code module's code, keeping the rest of
  // its work (Arcade's design), through the work-slot pipeline.
  function handleCodeChange(newCode) {
    if (errorLine != null) setErrorLine(null)
    const moduleType = lesson?.type
    if (!isCodeWork(workSlotDefinition(moduleType))) return
    handleWorkChange(withCode(moduleType, newCode), { moduleType })
  }

  // Arcade's sprite/sound design editor. The design is part of Arcade's work; it is saved with
  // the code and published at once, but mirrored to a watching teacher on its own debounced
  // channel (writeStudentArcadeDesign) rather than with the code.
  function handleArcadeDesignChange(nextDesign) {
    const next = cloneArcadeDesign(nextDesign)
    const value = { ...workValueFor('arcade'), arcadeDesign: next }
    setWork('arcade', value)
    if (effectiveIdentity) {
      const { work: stored, meta } = storedWork('arcade', value)
      persistence.saveRunRecord('arcade', effectiveIdentity.anonymousId, currentTaskId, stored, {
        output: outputRef.current,
        runStatus: runStatusRef.current,
        ...meta,
      })
    }
    if (canPublishTeacherLive()) publishTeacherLive({ arcadeDesign: next })
    if (!teacherPresentation && identity && session?.activeStudentView === identity.anonymousId) {
      if (arcadeDesignWriteTimerRef.current !== null)
        clearTimeout(arcadeDesignWriteTimerRef.current)
      arcadeDesignWriteTimerRef.current = setTimeout(() => {
        writeStudentArcadeDesign?.(identity.anonymousId, next)
        arcadeDesignWriteTimerRef.current = null
      }, 600)
    }
  }

  // A 'workspace'-run module on the work slot (Arcade: "Run game") reports a run it made in
  // its own iframe. There is no captured text output, so on a run only the task's generic code
  // checks can be evaluated; other check types saved on the task are ignored here (the Builder
  // warns about them) rather than failing every attempt.
  function handleWorkspaceRun(runCode) {
    const actor = effectiveIdentity
    const moduleType = lesson?.type
    const definition = workSlotDefinition(moduleType)
    if (!actor || definition?.capabilities.run !== 'workspace') return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const alreadySolved = isAlreadySolved()
    const codeChecks = normalizeChecks(task?.check).filter(isCodeCheck)
    const checkTask = task
      ? {
          ...task,
          check: codeChecks.length > 0 ? codeChecks : null,
          feedbackChecks: normalizeFeedbackChecks(task).filter(isCodeCheck),
          incorrectChecks: null,
        }
      : null
    const hasCheck = !!checkTask?.check

    if (!alreadySolved) resetRunFeedback()
    setRunStatus('success')

    let passed = alreadySolved
    let suggestion = ''
    if (!alreadySolved) {
      if (hasCheck) {
        const context = definition.checking.buildContext(runCode, { status: 'success' })
        const evaluation = evaluateCheckWithFeedback(checkTask, '', context)
        passed = evaluation.passed
        suggestion = evaluation.suggestion
        updateTargetedStageOffer(task, evaluation, passed)
        applyCheckFeedback(passed, suggestion)
      }
      updateSupportStageForAttempt(!hasCheck || passed)
    }

    if (canPublishTeacherLive()) {
      publishTeacherLive({
        code: runCode,
        runStatus: 'success',
        checkPassed: passed,
        checkAttempted: !alreadySolved && hasCheck,
        checkSuggestion: suggestion,
      })
    }
    persistence.saveRunRecord(moduleType, actor.anonymousId, currentTaskId, runCode, {
      output: outputRef.current,
      runStatus: 'success',
      ...storedWork(moduleType).meta,
    })
    const isWatched = session?.activeStudentView === actor.anonymousId
    if (
      !teacherPresentation &&
      (phaseRef.current === 'lesson' ||
        phaseRef.current === 'sandbox' ||
        inPersonalSandboxRef.current ||
        isWatched)
    ) {
      writeStudentRun(actor.anonymousId, {
        code: runCode,
        output: '',
        status: 'success',
        checkPassed: passed,
      })
    }
    if (!teacherPresentation && phaseRef.current === 'lesson' && !alreadySolved && hasCheck) {
      logAttempt(actor.anonymousId, currentTaskId, { submission: runCode, passed, suggestion })
    }
  }

  function handleEditorSelection(selection, filename = null) {
    const nextSelection = { ...selection, ...(filename ? { file: filename } : {}) }
    editorSelectionRef.current = nextSelection
    setEditorSelection(nextSelection)
    if (canPublishTeacherLive()) publishTeacherLive({ selection: nextSelection })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { selection: nextSelection })
    }
  }

  function handleEditorActivity(activity, filename = null) {
    const nextActivity = { ...activity, ...(filename ? { file: filename } : {}) }
    editorActivityRef.current = nextActivity
    setEditorActivity(nextActivity)
    if (canPublishTeacherLive()) publishTeacherLive({ activity: nextActivity })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { activity: nextActivity })
    }
  }

  function handleScratchActivity(activity) {
    const nextActivity = { ...activity }
    editorActivityRef.current = nextActivity
    setEditorActivity(nextActivity)
    if (canPublishTeacherLive()) publishTeacherLive({ activity: nextActivity })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { activity: nextActivity })
    }
  }

  function handleFileTabChange(filename) {
    setActiveFile(filename)
    editorSelectionRef.current = null
    setEditorSelection(null)
    if (canPublishTeacherLive()) publishTeacherLive({ activeFile: filename, selection: null })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { selection: null, activeFile: filename })
    }
  }

  function handleFileChange(filename, content) {
    const nextFiles = filesRef.current.map((f) => (f.name === filename ? { ...f, content } : f))
    setFiles(nextFiles)
    if (htmlErrorLocation?.file === filename) setHtmlErrorLocation(null)
    if (canPublishTeacherLive()) {
      publishTeacherLive({
        files: Object.fromEntries(nextFiles.map((f) => [f.name, f.content])),
        activeFile: filename,
      })
    }
    if (effectiveIdentity && lesson?.type === 'html') {
      persistence.saveHtmlFile(effectiveIdentity.anonymousId, currentTaskId, filename, content)
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      const filesMap = Object.fromEntries(
        filesRef.current.map((f) => [f.name, f.name === filename ? content : f.content])
      )
      writeStudentFiles(identity.anonymousId, filesMap)
    }
    if (lesson?.type === 'html') {
      scheduleIdleFeedback(
        () => ({
          code: nextFiles.map((f) => f.content).join('\n'),
          output: outputRef.current,
          iframeDoc: iframeRef.current?.contentDocument ?? null,
        }),
        { feedbackFilter: checkAllowedForSubmit }
      )
    }
  }

  function handleScratchChange(workspaceStates) {
    const serialized = JSON.stringify(workspaceStates)
    scratchCodeRef.current = serialized
    if (canPublishTeacherLive()) publishTeacherLive({ code: serialized })
    if (!effectiveIdentity) return
    persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, workspaceStates)
    if (identity && activeStudentViewRef.current === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, serialized)
    }
  }

  const SPRITE_STATE_THROTTLE_MS = 120

  function handleScratchSpriteState(spriteStates, cloneStates, backdropName, selectedSpriteId) {
    if (!identity) return
    const payload = {
      spriteStates,
      cloneStates,
      backdropName,
      selectedSpriteId: selectedSpriteId ?? null,
      updatedAt: Date.now(),
    }
    const flush = () => {
      spriteStateLastSentRef.current = Date.now()
      if (canPublishTeacherLive()) publishTeacherLive({ spriteState: payload })
      if (!teacherPresentation && session?.activeStudentView === identity.anonymousId) {
        writeStudentSpriteState?.(identity.anonymousId, payload)
      }
    }
    const elapsed = Date.now() - spriteStateLastSentRef.current
    if (elapsed >= SPRITE_STATE_THROTTLE_MS) {
      clearTimeout(spriteStatePendingTimerRef.current)
      spriteStatePendingTimerRef.current = null
      flush()
    } else if (!spriteStatePendingTimerRef.current) {
      spriteStatePendingTimerRef.current = setTimeout(() => {
        spriteStatePendingTimerRef.current = null
        flush()
      }, SPRITE_STATE_THROTTLE_MS - elapsed)
    }
  }

  function handleScratchCursor(payload) {
    if (!identity) return
    if (canPublishTeacherLive()) publishTeacherLive({ cursor: payload })
    if (!teacherPresentation && session?.activeStudentView === identity.anonymousId) {
      writeStudentCursor?.(identity.anonymousId, payload)
    }
  }

  function handleScratchBlockDrag(payload) {
    if (!identity) return
    if (canPublishTeacherLive()) publishTeacherLive({ blockDrag: payload })
    if (!teacherPresentation && session?.activeStudentView === identity.anonymousId) {
      writeStudentBlockDrag?.(identity.anonymousId, payload)
    }
  }

  // Live tile-placement mirror for code_arrange tasks — the assembled code
  // itself only syncs once every blank is filled (see handleCodeChange /
  // handleFileChange), so without this a teacher watching a student would
  // see stale code from a previous task until the student finishes, and a
  // "Go Live to Students" viewer would see nothing move at all. Same two
  // destinations as handleScratchSpriteState/handleScratchCursor above:
  // teacherLive for a Go-Live/presentation broadcast, the student's own
  // currentCodeArrangeSlots record for a teacher passively watching them.
  function handleCodeArrangeSlotsChange(slotState, { fromTeacher = false } = {}) {
    codeArrangeSlotStateRef.current = slotState
    if (!identity) return
    if (!fromTeacher) supersedeTeacherAnswerEdit()
    if (canPublishTeacherLive()) publishTeacherLive({ codeArrangeSlots: slotState })
    // Written on every tile placement (a discrete action, like a quiz answer
    // — not per keystroke), watched or not, so the teacher's StudentCard can
    // show "X/N slots filled" for the whole class.
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      writeStudentCodeArrangeSlots?.(identity.anonymousId, slotState)
    }
  }

  // Live drag-position mirror for code_arrange tasks, broadcast-only (Go
  // Live/presentation) — unlike slot placements there's no per-student
  // "watch one student" destination for this, since StudentModal only needs
  // the settled board, not the in-flight drag. Payload is null on drag end
  // to clear the mirror immediately rather than waiting for it to go stale.
  function handleCodeArrangeDragCursor(payload) {
    if (!identity) return
    if (canPublishTeacherLive()) publishTeacherLive({ codeArrangeCursor: payload })
  }

  function handleScratchCheck(passed, snapshot) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const alreadySolved = isAlreadySolved()
    const effectivePassed = alreadySolved ? true : passed
    const checks = Array.isArray(task?.check) ? task.check : task?.check ? [task.check] : []
    const suggestion = effectivePassed
      ? ''
      : String(snapshot?.suggestion ?? '').trim() ||
        String(checks.find((c) => c?.hint)?.hint ?? '').trim()
    if (!alreadySolved && task?.check) applyCheckFeedback(passed, suggestion)
    if (!identity || lesson?.type !== 'scratch') return
    if (
      phase === 'lesson' ||
      phase === 'sandbox' ||
      activeStudentViewRef.current === identity.anonymousId
    ) {
      const states =
        snapshot?.workspaceStates ??
        persistence.readSavedCode(identity.anonymousId, currentTaskId)?.state ??
        null
      writeStudentRun(identity.anonymousId, {
        code: states ? JSON.stringify(states) : undefined,
        status: 'success',
        checkPassed: effectivePassed,
      })
      if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
        logAttempt(identity.anonymousId, currentTaskId, { submission: states, passed, suggestion })
      }
    }
  }

  // ─── Generic work slot handlers ──────────────────────────────────────────────

  // Evaluates the task check against a work-slot module's work and reports the outcome: local
  // feedback (a failing interaction-only re-check stays quiet), then — in a live lesson, outside
  // the personal sandbox — the run record (the work as `code` via wire.toCode) and, while the
  // task is unsolved, the attempt log (wire.submission).
  function evaluateAndReport({ moduleType, work: workValue, context }, opts = {}) {
    const { suppressFailFeedback = false } = opts
    const { wire } = getModuleDefinition(moduleType)
    const alreadySolved = isAlreadySolved()
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const completionPassed = task?.check ? evaluateCheck(task.check, null, context) : false
    const evaluation = task?.check
      ? evaluateCheckWithFeedback(task, '', context, {
          completionPassed,
          feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT,
        })
      : { passed: false, suggestion: '' }
    const evaluatedPassed = evaluation.passed
    const passed = alreadySolved ? true : evaluatedPassed
    const suggestion = passed ? '' : evaluation.suggestion
    if (!alreadySolved && task?.check && (evaluatedPassed || !suppressFailFeedback)) {
      applyCheckFeedback(evaluatedPassed, suggestion)
      updateTargetedStageOffer(task, evaluation, evaluatedPassed)
    }
    if (
      !teacherPresentation &&
      phase === 'lesson' &&
      !inPersonalSandboxRef.current &&
      effectiveIdentity?.anonymousId
    ) {
      writeStudentRun(effectiveIdentity.anonymousId, {
        code: wire.toCode(workValue),
        status: task?.check ? (evaluatedPassed ? 'success' : 'error') : null,
        checkPassed: evaluatedPassed,
      })
      if (!alreadySolved && task?.check) {
        logAttempt(effectiveIdentity.anonymousId, currentTaskId, {
          submission: wire.submission(workValue),
          passed: evaluatedPassed,
          suggestion,
        })
      }
    }
  }

  // The check context for a work-slot module's latest work and interaction (read from refs, so
  // idle feedback evaluates whatever is current when its timer fires).
  function currentWorkCheckContext(moduleType) {
    return getModuleDefinition(moduleType).checking.buildContext(
      workValueFor(moduleType),
      interactionFor(moduleType)
    )
  }

  /**
   * The one change pipeline for work-slot modules. `next` is the new work (undefined for an
   * interaction-only update); `interaction` the workspace's new { currentDir, openFile }.
   * What follows the set depends on the module's `checking.trigger`:
   *
   *   'change' (filesystem, desktop): set work → persistence.saveWork → teacherLive (published
   *   by useTeacherLivePublish's effect, which tracks the work value) → no watched-only mirror
   *   (every change already writes a run) → evaluate now, with fail feedback suppressed for
   *   interaction-only re-checks → idle feedback.
   *
   *   'run' (python, turtle, arcade, electronics; checked when the code runs): set work →
   *   teacherLive now → the run record (the work with the current output / run status and the
   *   module's extras) → writeStudentCode only while this student is watched (no per-keystroke
   *   Firebase write otherwise) → idle feedback against the code.
   */
  function handleWorkChange(next, options = {}) {
    const {
      moduleType = lesson?.type,
      interaction,
      suppressFailFeedback = next === undefined,
    } = options
    const definition = workSlotDefinition(moduleType)
    if (!definition) return
    if (definition.checking.trigger !== 'change') {
      if (next !== undefined) handleCodeWorkChange(definition, next)
      return
    }
    if (interaction !== undefined) setInteraction(moduleType, interaction)
    if (next !== undefined) {
      setWork(moduleType, next)
      persistence.saveWork(moduleType, effectiveIdentity?.anonymousId, currentTaskId, next)
    }
    evaluateAndReport(
      { moduleType, work: workValueFor(moduleType), context: currentWorkCheckContext(moduleType) },
      { suppressFailFeedback }
    )
    scheduleIdleFeedback(() => currentWorkCheckContext(moduleType))
  }

  // handleWorkChange for modules checked on Run (see above).
  function handleCodeWorkChange(definition, next) {
    const moduleType = definition.type
    setWork(moduleType, next)
    const { work: stored, meta } = definition.workSlot.stored(next)
    const wireCode = definition.wire.toCode(stored)
    if (canPublishTeacherLive()) publishTeacherLive({ code: wireCode })
    if (effectiveIdentity) {
      persistence.saveRunRecord(moduleType, effectiveIdentity.anonymousId, currentTaskId, stored, {
        output,
        runStatus,
        ...meta,
      })
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, wireCode)
    }
    // Code modules' idle feedback also sees the last run's status; a state module's (the
    // electronics circuit) sees the work alone.
    scheduleIdleFeedback(() =>
      definition.checking.buildContext(
        stored,
        definition.workSlot.kind === 'code' ? { status: runStatusRef.current } : {}
      )
    )
  }

  // Legacy per-module names the workspaces (and sharedWorkspacePayload) call. Interaction
  // handlers stay memoised, as before, so workspace effects keyed on them don't re-fire.
  function handleFsChange(newFs) {
    handleWorkChange(newFs, { moduleType: 'filesystem' })
  }

  function handleDesktopChange(newDesktop) {
    handleWorkChange(newDesktop, { moduleType: 'desktop' })
  }

  const handleFsInteraction = useCallback(
    (interaction) => handleWorkChange(undefined, { moduleType: 'filesystem', interaction }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, currentTaskId, teacherPresentation, phase, effectiveIdentity]
  )

  const handleDesktopInteraction = useCallback(
    (interaction) => handleWorkChange(undefined, { moduleType: 'desktop', interaction }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, currentTaskId, teacherPresentation, phase, effectiveIdentity]
  )

  // ─── Reset/Complete code ───────────────────────────────────────────────────

  function handleResetCode() {
    if (inPersonalSandboxRef.current) {
      if (!window.confirm('Reset sandbox to the starter code? Your sandbox work will be lost.'))
        return
      const slotDefinition = workSlotDefinition(lesson.type)
      if (slotDefinition) {
        restoreWork(lesson.type, slotDefinition.workSlot.sandbox(lesson))
        // As before: modules checked on Run drop their run; state modules reset feedback.
        if (slotDefinition.checking.trigger !== 'change') {
          setOutput('')
          setTurtleResult(null)
          setRunStatus(null)
        }
        if (slotDefinition.workSlot.kind === 'state') resetCheckFeedback()
      } else if (lesson.type === 'html') {
        const starterFiles = (lesson.sandboxStarterFiles ?? []).map((f) => ({ ...f }))
        setFiles(starterFiles)
        setActiveFile(starterFiles[0]?.name ?? '')
        setIframeSrc(null)
        setRunStatus(null)
      }
      return
    }
    if (!window.confirm('Reset your code to the starter code? Your current work will be lost.'))
      return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition?.workSlot.taskReset) {
      resetWorkToStarter(slotDefinition, task)
    } else if (lesson.type === 'html') {
      const taskFiles = (getStarterStage(task)?.stage?.files ?? task?.starterFiles ?? []).map(
        (f) => ({ ...f })
      )
      setFiles(taskFiles)
      if (canPublishTeacherLive())
        publishTeacherLive({
          files: Object.fromEntries(taskFiles.map((f) => [f.name, f.content])),
          output: '',
          runStatus: null,
          checkPassed: false,
          checkAttempted: false,
        })
      setActiveFile(task?.entryFile ?? taskFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'scratch') {
      setScratchExternalState(task?.starterBlocks ?? null)
      setScratchActiveStageIndex(null)
    }
    // Filesystem and desktop (no workSlot.taskReset) only reset inside the personal sandbox.
  }

  // The Reset button for a work-slot module outside the personal sandbox.
  // - 'code' modules restore the starter (in a teacher sandbox, a teacherSandboxReset module
  //   restores the teacher's pushed code instead) without saving it, republish, and drop the
  //   run. Extras reset through their own pipeline first: Arcade's design goes through
  //   handleArcadeDesignChange, which saves it with the code as it was before the reset.
  // - 'state' modules (electronics) restore and save the starter.
  function resetWorkToStarter(definition, task) {
    const moduleType = definition.type
    const { workSlot } = definition
    if (workSlot.kind === 'state') {
      persistRestoredWork(moduleType, restoreWork(moduleType, workSlot.starter(task)))
      resetCheckFeedback()
      return
    }
    // In a teacher-started sandbox the session still points at a lesson task, but the
    // student's starting point is what the teacher sent, not that task's starter code.
    const starter =
      workSlot.teacherSandboxReset && phaseRef.current === 'sandbox'
        ? workSlot.fromStored({ work: session?.sandboxCode, meta: {} }, workSlot.sandbox(lesson))
        : workSlot.starter(task)
    const { work: starterCode, meta } = workSlot.stored(starter)
    if (Object.hasOwn(meta, 'arcadeDesign')) handleArcadeDesignChange(meta.arcadeDesign)
    restoreWork(moduleType, starter)
    if (canPublishTeacherLive())
      publishTeacherLive({
        code: definition.wire.toCode(starterCode),
        output: '',
        runStatus: null,
        checkPassed: false,
        checkAttempted: false,
      })
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    resetCheckFeedback()
  }

  function handleShowCodeStage(stageIndex) {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return
    const stage = task.codeStages?.[stageIndex]
    if (!stage) return

    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition) {
      const restored = restoreWork(lesson.type, slotDefinition.workSlot.stage(task, stageIndex))
      clearRunFor(lesson.type)
      persistRestoredWork(lesson.type, restored)
    } else if (lesson.type === 'html') {
      const stageFiles = (stage.files ?? []).map((f) => ({ ...f }))
      setFiles(stageFiles)
      setActiveFile(stage.entryFile ?? task.entryFile ?? stageFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, stageFiles)
    } else if (lesson.type === 'scratch') {
      const stageBlocks = stage.blocks ?? null
      setScratchExternalState(stageBlocks)
      setScratchActiveStageIndex(stageIndex)
      if (stageBlocks)
        persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, stageBlocks)
    }
    setOfferedStageIndex(stageIndex)
  }

  function handleRevealSupportStage(
    stageIndex,
    source = 'student',
    attemptNumber = checkFailCount
  ) {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const stage = task?.codeStages?.[stageIndex]
    if (!stage) return
    if (!['python', 'html', 'arcade', 'turtle', 'electronics', 'scratch'].includes(lesson?.type))
      return
    if (!isRevealableStage(stage)) return

    const record = {
      taskId: currentTaskId,
      stageIndex,
      stageLabel: stage.label || `Stage ${stageIndex + 1}`,
      source,
      attemptNumber,
      revealedAt: Date.now(),
    }
    setLocalSupportStageReveals((prev) => ({
      ...prev,
      [currentTaskId]: {
        ...(prev[currentTaskId] ?? {}),
        [stageIndex]: record,
      },
    }))
    setOfferedStageIndex((prev) => Math.max(prev, stageIndex))
    setSupportStageVisibility((prev) => ({ ...prev, [currentTaskId]: stageIndex }))
    setSupportStageOffers((prev) => ({ ...prev, [currentTaskId]: null }))
    markStagePromptAccepted()
    if (!teacherPresentation && phase === 'lesson') {
      recordSupportStageReveal?.(effectiveIdentity.anonymousId, currentTaskId, stageIndex, {
        source,
        stageLabel: record.stageLabel,
        attemptNumber: record.attemptNumber,
      })
    }
  }

  function handleHtmlRuntimeError(src, errorMeta) {
    const supportAttempt = htmlSupportAttemptsRef.current.get(src)
    if (!supportAttempt) return
    supportAttempt.hasError = true
    if (supportAttempt.outcomeApplied && supportAttempt.passed) {
      supportAttempt.passed = false
      updateSupportStageForAttempt(false)
    }
    // Keep the first error's line for this run — later errors (e.g. a second,
    // unrelated console.error) shouldn't bump the highlight around.
    if (errorMeta && htmlErrorLocation == null) {
      const location = resolveIframeErrorLocation(
        errorMeta.loadId,
        errorMeta.filename,
        errorMeta.lineno
      )
      if (location) setHtmlErrorLocation(location)
    }
  }

  function updateSupportStageForAttempt(passed) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (
      !task ||
      teacherPresentation ||
      inPersonalSandboxRef.current ||
      !['lesson', 'solo'].includes(phaseRef.current)
    )
      return
    if (!['python', 'html'].includes(lesson?.type)) return

    if (passed) {
      setSupportStageVisibility((prev) => ({ ...prev, [currentTaskId]: null }))
      setSupportStageOffers((prev) => ({ ...prev, [currentTaskId]: null }))
      return
    }

    // Keep the existing offer available until the student either uses it or
    // succeeds. Repeated failures must not skip over an unused reference.
    if (offeredSupportStageIndex != null) return

    const nextStage = getNextRevealableStage(task, Object.keys(supportStageReveals))
    if (nextStage) {
      setSupportStageOffers((prev) => ({ ...prev, [currentTaskId]: nextStage.index }))
      return
    }

    const latestStage = getRevealableStages(task)
      .map(({ index }) => index)
      .filter((index) => Object.prototype.hasOwnProperty.call(supportStageReveals, index))
      .at(-1)
    if (latestStage != null) {
      setSupportStageVisibility((prev) => ({ ...prev, [currentTaskId]: latestStage }))
    }
  }

  function handleRevealOfferedSupportStage() {
    if (offeredSupportStageIndex == null) return
    handleRevealSupportStage(offeredSupportStageIndex)
  }

  function handlePreviewTargetedStage() {
    if (targetedStageOffer?.action !== 'preview') return
    setTargetedPreviewStageIndex(targetedStageOffer.stageIndex)
    setTargetedStageOffer(null)
    markStagePromptAccepted()
  }

  function handleAcceptTargetedStage() {
    if (!targetedStageOffer) return
    const { stageIndex } = targetedStageOffer
    setTargetedStageOffer(null)
    markStagePromptAccepted()
    setTargetedPreviewStageIndex(stageIndex)
  }

  function handleAcceptGenericNextStage(stageIndex) {
    handleRevealSupportStage(stageIndex)
  }

  function handlePreviewCompleteCode() {
    // Non-destructive: reveals the complete solution read-only in the explainer
    // panel without touching the student's own editor or marking the task solved.
    setCompletePreviewShown(true)
  }

  function handleShowCompleteCode() {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return
    const slotDefinition = workSlotDefinition(lesson.type)

    if (slotDefinition) {
      // The complete work (Arcade: with the complete design, like Show stage and remote reset).
      const restored = restoreWork(lesson.type, slotDefinition.workSlot.complete(task))
      clearRunFor(lesson.type)
      applyCheckFeedback(true)
      persistRestoredWork(lesson.type, restored)
    } else if (lesson.type === 'html') {
      const completeStage = getCompleteStage(task)?.stage
      const completeFiles = (completeStage?.files ?? task.completeFiles ?? []).map((f) => ({
        ...f,
      }))
      setFiles(completeFiles)
      setActiveFile(
        completeStage?.entryFile ??
          task.completeEntryFile ??
          task.entryFile ??
          completeFiles[0]?.name ??
          ''
      )
      setIframeSrc(null)
      setRunStatus(null)
      applyCheckFeedback(true)
      persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, completeFiles)
    } else if (lesson.type === 'scratch') {
      const completeBlocks = task.completeBlocks ?? null
      setScratchExternalState(completeBlocks)
      setScratchActiveStageIndex(null)
      applyCheckFeedback(true)
      if (completeBlocks)
        persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, completeBlocks)
    }
  }

  // ─── Submit (HTML / Python submit-mode) ──────────────────────────────────────

  async function handleSubmit() {
    const actor = effectiveIdentity
    if (!actor) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const isHtml = lesson?.type === 'html'
    const alreadySolved = isAlreadySolved()
    let passed,
      suggestion = ''
    if (!alreadySolved) {
      const codeForCheck = isHtml ? files.map((f) => f.content).join('\n') : code
      const checkContext = buildCodeCheckContext(lesson?.type, codeForCheck)
      const completionPassed = task?.check
        ? evaluateCheckWithCode(task.check, codeForCheck, checkContext)
        : false
      const evaluation = evaluateCheckWithFeedback(task, '', checkContext, { completionPassed })
      passed = task?.check ? evaluation.passed : false
      suggestion = task?.check ? evaluation.suggestion : ''
      if (task?.check) {
        applyCheckFeedback(passed, suggestion)
        updateTargetedStageOffer(task, evaluation, passed)
      }
      updateSupportStageForAttempt(!task?.check || passed)
    } else {
      passed = true
    }
    setRunStatus('submitted')
    if (canPublishTeacherLive()) {
      publishTeacherLive({
        code: isHtml ? undefined : code,
        files: isHtml ? Object.fromEntries(files.map((f) => [f.name, f.content])) : undefined,
        output: isHtml ? undefined : '',
        runStatus: 'submitted',
        checkPassed: passed,
        checkAttempted: !alreadySolved && !!task?.check,
        checkSuggestion: suggestion,
      })
    }
    if (isHtml) {
      persistence.saveHtmlFiles(actor.anonymousId, currentTaskId, files)
    } else {
      persistence.savePythonCode(actor.anonymousId, currentTaskId, {
        code,
        output: '',
        runStatus: 'submitted',
      })
    }
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      const filesMap = isHtml
        ? Object.fromEntries(files.map((f) => [f.name, f.content]))
        : undefined
      await writeStudentRun(actor.anonymousId, {
        code: isHtml ? undefined : code,
        files: filesMap,
        output: isHtml ? undefined : '',
        status: 'submitted',
        checkPassed: passed,
      })
    }
    if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
      const submission = isHtml ? Object.fromEntries(files.map((f) => [f.name, f.content])) : code
      logAttempt(actor.anonymousId, currentTaskId, { submission, passed, suggestion })
    }
  }

  // A work-slot module's saved work for another task (mode-aware: localStorage normally,
  // in-memory in presentation/preview), e.g. for viewing an earlier task.
  function readSavedTaskWork(moduleType, taskId) {
    if (!effectiveIdentity) return null
    return persistence.readWork(moduleType, effectiveIdentity.anonymousId, taskId)?.work ?? null
  }

  // Workspace sharing captures the student's own current state. Built here
  // rather than in the view because the module-specific sources (Scratch's
  // scratchCodeRef, the generic work slot) only exist inside this hook.
  function buildShareSnapshot() {
    return buildSharedWorkspaceSnapshot({
      lesson: lessonRef.current,
      taskId: currentTaskIdRef.current,
      code: codeRef.current,
      scratchCode: scratchCodeRef.current,
      // The snapshot picks the entry for the task's module (sharedWorkspacePayload keeps its
      // per-kind parameters until plan step 4.6).
      fsState: workValueFor('filesystem'),
      desktopState: workValueFor('desktop'),
      arcadeDesign: storedWork('arcade').meta.arcadeDesign,
      files: filesRef.current,
      activeFile: activeFileRef.current,
      output: outputRef.current,
      runStatus: runStatusRef.current,
    })
  }

  return {
    // State. `code` and `arcadeDesign` are aliases derived from the generic work slot.
    code,
    teacherCodeArrangeEdit,
    teacherAnswerNoticeAt,
    remoteRunToken,
    acknowledgeRemoteRun: (token) =>
      setRemoteRunToken((current) => (current === token ? null : current)),
    arcadeDesign: storedWork('arcade', renderedWorkFor('arcade')).meta.arcadeDesign,
    files,
    activeFile,
    output,
    runStatus,
    turtleResult,
    running,
    runningTests,
    testResults,
    pyodideStatus,
    iframeSrc,
    teacherLiveIframeSrc,
    htmlPreviewCollapsed,
    setHtmlPreviewCollapsed,
    publishOutputCollapsed,
    inputPrompt,
    checkPassed,
    checkAttempted,
    checkSuggestion,
    repeatedSuggestionCount,
    checkFailCount,
    stagePromptAccepted,
    offeredStageIndex,
    completePreviewShown,
    supportStageReveals,
    activeSupportStageIndex,
    offeredSupportStageIndex,
    teacherLiveReferenceActive,
    targetedStageOffer,
    targetedPreviewStageIndex,
    scratchSandboxProject,
    scratchExternalState,
    scratchActiveStageIndex,
    // Generic work slot, and the per-module names the workspaces read (thin aliases).
    work,
    fsState: renderedWorkFor('filesystem'),
    fsInteraction: interactions.filesystem ?? DEFAULT_INTERACTION,
    desktopState: renderedWorkFor('desktop'),
    desktopInteraction: interactions.desktop ?? DEFAULT_INTERACTION,
    editorSelection,
    editorActivity,
    inPersonalSandbox,
    teacherHighlights,
    dismissHighlight,
    errorLine,
    htmlErrorLocation,
    // Refs
    iframeRef,
    // Event handlers
    handleRun,
    handleStop,
    handleRunTests,
    handleSubmit,
    handleCodeChange,
    handleArcadeDesignChange,
    handleWorkspaceRun,
    // Arcade's name for handleWorkspaceRun ("Run game").
    handleArcadeRun: handleWorkspaceRun,
    handleFileChange,
    handleFileTabChange,
    handleEditorSelection,
    handleEditorActivity,
    handleScratchActivity,
    handleScratchSpriteState,
    handleScratchCursor,
    handleScratchBlockDrag,
    handleCodeArrangeSlotsChange,
    handleCodeArrangeDragCursor,
    handleScratchChange,
    handleScratchCheck,
    handleWorkChange,
    handleFsChange,
    handleFsInteraction,
    handleDesktopChange,
    handleDesktopInteraction,
    handleInputSubmit,
    handleInputChange,
    handleHtmlRuntimeError,
    handleResetCode,
    handleShowCodeStage,
    handleRevealSupportStage,
    handleRevealOfferedSupportStage,
    handlePreviewTargetedStage,
    handleAcceptTargetedStage,
    handleAcceptGenericNextStage,
    handlePreviewCompleteCode,
    handleShowCompleteCode,
    handleEnterPersonalSandbox,
    handleLeavePersonalSandbox,
    // Mode-aware task-save readers (localStorage normally, in-memory in presentation/preview)
    readSavedTaskCode: (taskId) =>
      effectiveIdentity ? persistence.readSavedCode(effectiveIdentity.anonymousId, taskId) : null,
    readSavedTaskFile: (taskId, filename) =>
      effectiveIdentity
        ? persistence.readSavedFile(effectiveIdentity.anonymousId, taskId, filename)
        : null,
    readSavedTaskWork,
    readSavedTaskFs: (taskId) => readSavedTaskWork('filesystem', taskId),
    readSavedTaskDesktop: (taskId) => readSavedTaskWork('desktop', taskId),
    // Generic per-task auxiliary storage (mode-aware, same key format as
    // readSavedTaskFile/saveHtmlFile). Used by task types that need to persist
    // something alongside their code that isn't itself a code file — for
    // example the code_arrange task type's tile-to-slot arrangement.
    saveTaskAuxFile: (taskId, filename, content) => {
      if (!effectiveIdentity) return
      persistence.saveHtmlFile(effectiveIdentity.anonymousId, taskId, filename, content)
    },
    recordCarryFallback,
    // Coordination helpers (called by StudentView)
    saveCurrentWork: saveCurrentWorkSnapshot,
    resetForTaskChange,
    exitPersonalSandbox,
    currentTeacherLivePayload,
    buildShareSnapshot,
    // Activity and quiz task state and handlers (null definition on other tasks).
    activity,
    canPublishTeacherLive,
    publishTeacherLive,
    updateTeacherLiveFn: updateTeacherLive,
    setTeacherLiveFn: setTeacherLive,
  }
}
