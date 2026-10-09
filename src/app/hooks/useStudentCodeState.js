import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  FEEDBACK_TIMING,
  checkAllowedForSubmit,
  evaluateCheck,
  evaluateCheckWithCode,
  evaluateCheckWithFeedback,
  evaluateTaskWithoutRun,
  NO_RUN_RESULTS,
  getStageOfferMatchThreshold,
  normalizeChecks,
  normalizeFeedbackChecks,
  evaluateSingleCheck,
  isCodeCheck,
  isRunAttemptedCheck,
  resolveTestCheck,
} from '../../modules/checks'
import {
  flattenTasks,
  findTaskById,
  getCompleteStage,
  getNextRevealableStage,
  getRevealableStages,
  getStageRole,
  isRevealableStage,
} from '../../shared/taskUtils'
import {
  TEACHER_LIVE_PIN_REVEAL_KEY,
  TEACHER_LIVE_REVEAL_KEY,
  getTeacherLivePin,
  isTeacherLivePinLogged,
} from '../../shared/taskStages.js'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { isFlaggablePaste, isSamePasteText, measurePaste } from '../../shared/pasteDetection'
import { DEFAULT_FS, normaliseDirPath } from '../../modules/filesystem/filesystem'
import { DEFAULT_CIRCUIT } from '../../modules/electronics/circuit'
import { makeDefaultDesktop } from '../../modules/desktop/desktopState'
import { decodeFileKey } from '../../shared/fileKeys'
import { AUTO_CHECK_LEAVE, isAutoAttempt } from '../../shared/autoCheck'
import {
  savePersonalSandboxCode,
  savePersonalSandboxFileRecord,
  clearEphemeralStorage,
} from '../studentStorage'
import {
  resolveRemoteResetTarget,
  resolveSavedCarrySource,
  selectHtmlTaskFiles,
  selectPythonTaskCode,
} from '../studentTaskContent'
import { decodeSessionFiles, getFileType } from '../../shared/workspaceData'
import { resolveIframeErrorLocation } from '../../modules/html/iframe'
import { buildCodeCheckContext } from '../codeCheckContext'
import { useCheckFeedback } from './useCheckFeedback'
import { useLatestRef } from './useLatestRef'
import { buildStudentHintState, lastErrorLine } from '../studentHints.js'
import { useSandboxCodePush } from './useSandboxCodePush'
import { useStudentPresenceReporting } from './useStudentPresenceReporting'
import { createStudentPersistence } from './createStudentPersistence'
import { useTeacherLivePublish } from './useTeacherLivePublish'
import { useActivityState } from './useActivityState'
import {
  getModuleHostedActivity,
  isHostedActivityTask,
  isModuleHostedActivityTask,
} from '../../activities/registry.pure.js'
import { solutionOrInitialState } from '../../activities/state.js'
import {
  assembleCodeArrangement,
  getAttemptPlacements,
  getCodeArrangeEntryFile,
  getCodeArrangeSlotCode,
} from '../../shared/codeArrange.js'
import { buildSharedWorkspaceSnapshot } from '../sharedWorkspacePayload'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions.js'
import { cloneArcadeDesign } from '../../modules/arcade/design'
import { runWithRuntime } from './runWithRuntime'
import { useStudentBadgeSignals } from './useStudentBadgeSignals'
import { runErrorFor, runErrorName } from '../../badges/signals'

// The generic work slot before any module has loaded work into it.
const EMPTY_WORK = Object.freeze({ moduleType: null, taskId: null, value: null })
// A work-slot module's interaction before its workspace has reported one.
const DEFAULT_INTERACTION = Object.freeze({ currentDir: '/', openFile: null })

// A files module's work before any has loaded, and while the slot holds another module's.
const NO_FILES_WORK = Object.freeze({ files: Object.freeze([]), activeFile: '' })

// The module definition when `type` is on the generic work slot (declares `workSlot`), else null.
// Every module is since plan step 4.5.
function workSlotDefinition(type) {
  const definition = getModuleDefinition(type)
  return definition?.workSlot ? definition : null
}

// Whether a work-slot module's work is code the student writes — a code string or files
// (capabilities.sandboxState 'code' / 'files': python, turtle, arcade, electronics, html) — rather
// than a structured state (scratch, filesystem, desktop). An information task clears code work.
// (Plan step 4.8: read from the sandbox kind rather than `meta.language`, which is the same set
// for every built-in module, so a text module without a code language still speaks `code`.)
function isCodeWork(definition) {
  const kind = definition?.capabilities.sandboxState
  return kind === 'code' || kind === 'files'
}

// Whether the work is one code string on the code channel (python, turtle, arcade, electronics):
// what the `code` alias and the code editor's handleCodeChange speak.
function isCodeStringWork(definition) {
  return isCodeWork(definition) && definition.wire.sandboxChannel === 'code'
}

// Whether the module's work travels on the files channel (html): its value is
// `{ files, activeFile }` (filesWorkSlot in src/modules/moduleContract.js).
function isFilesWork(definition) {
  return definition?.wire.sandboxChannel === 'files'
}

// The `code` alias: the code of the code-string module the slot holds, '' otherwise.
function codeOfSlot(slot) {
  const definition = workSlotDefinition(slot.moduleType)
  return isCodeStringWork(definition) ? definition.workSlot.stored(slot.value).work : ''
}

// The `files` / `activeFile` aliases: the files module's work the slot holds, else none.
function filesWorkOfSlot(slot) {
  return isFilesWork(workSlotDefinition(slot.moduleType)) ? slot.value : NO_FILES_WORK
}

// A module's work as its teacherLive / run fields: `{ code }` on the code channel, `{ files }`
// (a filename → content map) on the files channel.
function liveWorkFields(definition, stored) {
  return isFilesWork(definition)
    ? { files: definition.wire.toFilesMap(stored) }
    : { code: definition.wire.toCode(stored) }
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
  writeStudentHintState,
  logAttempt: logSessionAttempt,
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
  recordStudentPaste,
  recordStudentTileMiss,
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
  // Live badges: marks a logged attempt as errored after the fact (Arcade), and the
  // studentSignals writers useStudentBadgeSignals records through (see useSession).
  flagAttemptError,
  badgeSignalWriters,
}) {
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
  // Workspace-owned modules (workSlot.workspaceOwned: Scratch) keep their work in the
  // workspace. Restored work (reset, stage, complete, teacher edit) is pushed to it as
  // `pushedWork` with the code stage it came from (`pushedStageIndex`, null = none); a teacher
  // sandbox push lands in `sandboxPushedWork`. Aliased as scratchExternalState,
  // scratchActiveStageIndex and scratchSandboxProject.
  const [sandboxPushedWork, setSandboxPushedWork] = useState(null)
  const [pushedWork, setPushedWork] = useState(null)
  const [pushedStageIndex, setPushedStageIndex] = useState(null)
  // Generic work slot (module contract v2, plan steps 4.3–4.5) — every module's definition
  // declares `workSlot` + `checking`: the work value tagged with the module and task it belongs
  // to — a code string, Arcade's `{ code, arcadeDesign }`, html's `{ files, activeFile }`,
  // Scratch's reported workspace states, a filesystem tree or a desktop state. Readers only
  // trust `value` for the module named in `moduleType` (see workValueFor), so a composed lesson
  // switching modules can never publish, save or check the previous module's work. The old
  // `code` / `arcadeDesign` / `files` / `activeFile` names are derived from it (codeOfSlot,
  // filesWorkOfSlot). `interactions` keeps each module's latest workspace interaction
  // ({ currentDir, openFile }) — carry keeps the directory.
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
  // A teacher's "Edit answers" tiles for a code_arrange task: `{ slots, taskId, at }`, applied once
  // to that task's board by CodeArrangeTaskContainer (which then acknowledges it) and dropped when
  // the student moves to another task, so it never lands on a different task's board or over the
  // student's later placements.
  const [teacherCodeArrangeEdit, setTeacherCodeArrangeEdit] = useState(null)
  // A teacher "Start again" / "Complete" reset of a code_arrange task: `{ slots, taskId, at }`,
  // applied to that task's tiles by CodeArrangeTaskContainer (which then acknowledges it) so the
  // board matches the reset code slot.
  const [codeArrangeReset, setCodeArrangeReset] = useState(null)
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
  // publish it immediately — see handleCodeArrangeSlotsChange — and so Run can
  // assemble the program from the tiles if the code slot has lost it. The task
  // id is the task the board reported for.
  const codeArrangeSlotStateRef = useRef({})
  const codeArrangeSlotTaskIdRef = useRef(null)

  // Every attempt goes through here: a code_arrange attempt also records its tile placements
  // (blank id -> tile id) beside the assembled program, from the board this hook was last told
  // about for that task. Other tasks' attempts pass straight through.
  function logAttempt(anonymousId, taskId, fields = {}) {
    const placements =
      fields?.auto || fields?.placements !== undefined ? null : codeArrangeAttemptPlacements(taskId)
    return logSessionAttempt?.(anonymousId, taskId, placements ? { ...fields, placements } : fields)
  }

  function codeArrangeAttemptPlacements(taskId) {
    if (taskId == null || String(codeArrangeSlotTaskIdRef.current) !== String(taskId)) return null
    const task = findTaskById(lesson?.tasks, taskId)
    if (!isModuleHostedActivityTask(task)) return null
    return getAttemptPlacements(task, codeArrangeSlotStateRef.current)
  }

  const IDLE_FEEDBACK_DELAY_MS = 900

  // Stable refs for stale-closure-safe reads inside async handlers and callbacks
  const identityRef = useLatestRef(identity)
  const lessonRef = useLatestRef(lesson)
  const currentTaskIdRef = useLatestRef(currentTaskId)
  const phaseRef = useLatestRef(phase)
  // Turtle module only — mirrors turtleResult so currentTeacherLivePayload (built inside
  // useTeacherLivePublish, which only receives refs) can read the latest snapshot without
  // a stale closure. See setTurtleResult(result.turtle ?? null) below: it's set in the same
  // handler/render pass as setRunStatus, so the "publish on tracked value change" effect
  // (keyed on runStatus) always sees the fresh value the next time it fires.
  const turtleResultRef = useLatestRef(turtleResult)
  const arcadeDesignWriteTimerRef = useRef(null)
  const spriteStateLastSentRef = useRef(0)
  const spriteStatePendingTimerRef = useRef(null)
  const outputRef = useLatestRef(output)
  const runStatusRef = useLatestRef(runStatus)
  const sessionRef = useLatestRef(session)
  const activeStudentViewRef = useLatestRef(session?.activeStudentView)
  const editorSelectionRef = useLatestRef(editorSelection)
  const editorActivityRef = useLatestRef(editorActivity)
  const inPersonalSandboxRef = useLatestRef(inPersonalSandbox)
  // Live badge signals (topic opens, shortcuts, first edits, complete shown, sandbox runs),
  // gated off for the presentation window, previews and solo.
  const badgeSignals = useStudentBadgeSignals({
    phase,
    identity,
    session,
    teacherPresentation,
    previewMode,
    currentTaskId,
    inPersonalSandbox,
    writers: badgeSignalWriters,
  })
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
  // The old `filesRef` / `activeFileRef`, likewise read through the slot (files modules: html).
  const [filesRef] = useState(() => ({
    get current() {
      return filesWorkOfSlot(workRef.current).files
    },
  }))
  const [activeFileRef] = useState(() => ({
    get current() {
      return filesWorkOfSlot(workRef.current).activeFile
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
  // A workspace-owned module's restored work is pushed to its workspace instead (which reports
  // it back as an edit), with the code stage it came from when `stageIndex` is given (null for
  // the starter or complete). Returns the value restored.
  function restoreWork(moduleType, value, { stageIndex } = {}) {
    const { workSlot } = getModuleDefinition(moduleType)
    const restored = workSlot.normalise(value)
    if (workSlot.workspaceOwned) {
      setPushedWork(restored)
      if (stageIndex !== undefined) setPushedStageIndex(stageIndex)
    } else {
      setWork(moduleType, restored)
    }
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

  // Code modules treat the run as part of the code: restoring their work clears it (and html's
  // preview).
  function clearRunFor(moduleType) {
    if (getModuleDefinition(moduleType).workSlot.kind !== 'code') return
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setIframeSrc(null)
  }

  // Saves restored work (show stage, show complete, a persisting remote reset, the Reset
  // button of a state module): code-string modules save the cleared run alongside the code,
  // the shape savePythonCode wrote; others (html's files, one record per file) save the work
  // through their storage adapter. Nothing is saved for missing work (a Scratch stage without
  // blocks).
  function persistRestoredWork(moduleType, value) {
    const definition = getModuleDefinition(moduleType)
    const { workSlot } = definition
    const { work: stored, meta } = workSlot.stored(value)
    if (stored == null) return
    const actorId = effectiveIdentity?.anonymousId
    if (workSlot.kind === 'code' && definition.storage.layout === 'record') {
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

  // Render-time names derived from the slot: the old `code`, `files` and `activeFile` state,
  // and the current module's stored work, which useTeacherLivePublish tracks as a publish
  // trigger (null for a workspace-owned module, which publishes each report itself).
  const code = codeOfSlot(work)
  const { files, activeFile } = filesWorkOfSlot(work)
  const lessonSlotDefinition = workSlotDefinition(lesson?.type)
  const renderedStoredWork =
    lessonSlotDefinition && !lessonSlotDefinition.workSlot.workspaceOwned
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
  // reference. Two ways in (see docs/agents/classroom-behaviours.md):
  // - pinned ("Keep showing live code"): students.{id}.teacherLiveReferenceVisible or
  //   session.teacherLiveReferenceVisibleToAll — shows on every task until unpinned;
  // - one-off ("Reveal live code"): a supportRevealLog entry for this task
  //   (TEACHER_LIVE_REVEAL_KEY), so it drops off on the next task like a stage reveal.
  // Deriving this reactively — rather than via an explicit "clear" write — is
  // what makes it auto-clear the instant Presentation closes or moves to a
  // different task.
  const teacherLivePin = getTeacherLivePin(
    myStudentData?.teacherLiveReferenceVisible,
    session?.teacherLiveReferenceVisibleToAll
  )
  const teacherLiveReferenceRevealed = !!supportStageReveals[TEACHER_LIVE_REVEAL_KEY]
  const teacherLiveReferenceRequested = !!teacherLivePin || teacherLiveReferenceRevealed
  const teacherLiveReferenceActive =
    teacherLiveReferenceRequested &&
    !!session?.teacherLiveReference?.active &&
    session?.teacherLiveReference?.taskId === currentTaskId
  const teacherLiveReferencePinned = !!teacherLivePin && teacherLiveReferenceActive

  // Log a pinned reference once per pin — on the first task it actually shows —
  // not on every task while it stays pinned (that made the teacher's "Support"
  // chip reappear on every task). A one-off reveal is logged when it is revealed
  // (StudentModal writes it; "Reveal live code to all" lands in the remote-reset
  // effect below), so it needs nothing here.
  const loggedTeacherLivePinsRef = useRef(new Set())
  useEffect(() => {
    if (!teacherLiveReferencePinned) return
    if (teacherPresentation || phase !== 'lesson') return
    const anonymousId = effectiveIdentity?.anonymousId
    if (!anonymousId) return
    if (loggedTeacherLivePinsRef.current.has(teacherLivePin)) return
    if (isTeacherLivePinLogged(session?.supportRevealLog?.[anonymousId], teacherLivePin)) return
    loggedTeacherLivePinsRef.current.add(teacherLivePin)
    recordSupportStageReveal?.(anonymousId, currentTaskId, TEACHER_LIVE_PIN_REVEAL_KEY, {
      source: 'teacher-auto',
      stageLabel: "Teacher's live code (kept on)",
      pinnedAt: teacherLivePin,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teacherLiveReferencePinned,
    teacherLivePin,
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

  // Mirror the hint on this student's check-feedback banner (and any unopened "Want a hint?"
  // offer) onto their student node so the teacher's card, modal and common-hints strip can
  // show it (src/app/studentHints.js). Live lesson tasks only: sandbox, personal-sandbox,
  // presentation and preview runs neither set nor clear it. Writes only on change.
  const hintSyncEnabled =
    phase === 'lesson' &&
    !teacherPresentation &&
    !previewMode &&
    !inPersonalSandbox &&
    !!effectiveIdentity?.anonymousId &&
    typeof writeStudentHintState === 'function'
  const lastHintSyncRef = useRef({})
  useEffect(() => {
    if (!hintSyncEnabled) return
    const next = buildStudentHintState({
      task: findTaskById(lesson?.tasks, currentTaskId),
      taskId: currentTaskId,
      checkAttempted,
      checkPassed,
      checkSuggestion,
      checkFailCount,
      studentData: myStudentData,
      targetedStageOffer,
      offeredSupportStageIndex,
    })
    const scope = `${effectiveIdentity.anonymousId}:${currentTaskId}`
    if (lastHintSyncRef.current.scope !== scope) lastHintSyncRef.current = { scope }
    const written = lastHintSyncRef.current
    const updates = {}
    for (const key of ['studentHint', 'hintOffer']) {
      if (next[key] === undefined) continue
      const serialised = JSON.stringify(next[key])
      if (written[key] === serialised) continue
      written[key] = serialised
      updates[key] = next[key] ? { ...next[key], at: Date.now() } : null
    }
    if (Object.keys(updates).length) {
      Promise.resolve(writeStudentHintState(effectiveIdentity.anonymousId, updates)).catch((err) =>
        console.warn('Failed to sync student hint:', err)
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hintSyncEnabled,
    currentTaskId,
    checkAttempted,
    checkPassed,
    checkSuggestion,
    checkFailCount,
    targetedStageOffer,
    offeredSupportStageIndex,
    myStudentData?.checkOverridePushedAt,
  ])

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

    const definition = workSlotDefinition(currentLesson.type)
    // A workspace-owned module (Scratch) saves every change as it reports it — no snapshot.
    if (!definition || definition.workSlot.workspaceOwned) return
    // The storage adapter picks the record fields: python/turtle keep the run, Arcade adds its
    // design, electronics/filesystem/desktop save the work alone, html one record per file.
    const { work: stored, meta } = storedWork(currentLesson.type)
    persistence.saveWork(currentLesson.type, id.anonymousId, taskId, stored, {
      output: outputRef.current,
      runStatus: runStatusRef.current,
      ...meta,
    })
  }

  function savePersonalSandboxSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    if (!id || teacherPresentation || !currentLesson) return
    const slotDefinition = workSlotDefinition(currentLesson.type)
    // A workspace-owned module (Scratch) saves incrementally as it reports each change.
    if (!slotDefinition || slotDefinition.workSlot.workspaceOwned) return
    // Written directly (not persistence.saveSandboxWork, which also skips builder preview) to
    // keep this snapshot's existing preview behaviour. Arcade's sandbox record keeps its design;
    // html writes one record per file.
    const { storage } = slotDefinition
    const { work: stored, meta } = storedWork(currentLesson.type)
    const moduleId = currentLesson.lessonModule?.id ?? null
    if (storage.layout === 'perFile') {
      for (const file of stored) {
        savePersonalSandboxFileRecord(
          lessonId,
          file.name,
          id.anonymousId,
          storage.toSandboxRecord(file.content, meta),
          moduleId
        )
      }
    } else {
      savePersonalSandboxCode(
        lessonId,
        id.anonymousId,
        storage.toSandboxRecord(stored, meta),
        moduleId
      )
    }
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
      // No code for an information or activity task (the old `setCode('')` / `setFiles([])`); a
      // state module's work (scratch, filesystem, desktop) is left as it was.
      if (isCodeWork(workSlotDefinition(workRef.current.moduleType))) clearWork()
      resetCheckFeedback()
      return
    }
    if (workSlotDefinition(lesson.type)) loadWorkSlotTask(task, taskId, activeIdentity)
  }

  // Loads a work-slot module's work for a task, per its workSlot.kind:
  // - workspaceOwned (scratch): the workspace loads its own save, carry or starter once the
  //   previous task's workspace has flushed its save; the slot starts empty (until the
  //   workspace reports), with no pushed stage, and check feedback is reset.
  // - 'code' (python, turtle, arcade, html): the own save only in solo, else carry-through
  //   (carryCodeFrom), else the starter — selectPythonTaskCode, or per file selectHtmlTaskFiles
  //   for a per-file module. The module's extras (Arcade's design) come from the task's own
  //   record in any phase, else the starter's; html's active file is the task's entry file.
  //   Check feedback is left alone.
  // - 'state' (electronics, filesystem, desktop): the own save, else the carry source when the
  //   task carries (carryThroughField), else the starter; the interaction keeps the previous
  //   directory only when carrying; check feedback is reset.
  function loadWorkSlotTask(task, taskId, activeIdentity) {
    const moduleType = lesson.type
    const definition = workSlotDefinition(moduleType)
    const { workSlot } = definition
    const readStored = (sourceTaskId, filename) =>
      persistence.readWork(moduleType, activeIdentity.anonymousId, sourceTaskId, { filename })
    if (workSlot.workspaceOwned) {
      setWork(moduleType, workSlot.empty(task))
      setPushedStageIndex(null)
      resetCheckFeedback()
      return
    }
    if (workSlot.kind === 'code') {
      const perFile = definition.storage.layout === 'perFile'
      const loaded = perFile
        ? selectHtmlTaskFiles({
            tasks: lesson.tasks,
            task,
            taskId,
            phase,
            readSavedFile: (sourceTaskId, filename) =>
              readStored(sourceTaskId, filename)?.work ?? null,
            onCarryFallback: recordCarryFallback,
          })
        : selectPythonTaskCode({
            tasks: lesson.tasks,
            task,
            taskId,
            phase,
            readSavedCode: (sourceTaskId) =>
              persistence.readSavedCode(activeIdentity.anonymousId, sourceTaskId),
            onCarryFallback: recordCarryFallback,
          })
      const own = perFile ? null : readStored(taskId)
      restoreWork(
        moduleType,
        workSlot.fromStored({ work: loaded, meta: own?.meta ?? {} }, workSlot.starter(task))
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
    // Clear any work pushed to a workspace-owned module (reset/stage/solution/teacher edit) so
    // it can't overwrite the next task's initial blocks after the workspace remounts.
    setPushedWork(null)
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

  // A preview module (html) starts each task with its preview collapsed.
  useEffect(() => {
    if (getModuleDefinition(lesson?.type)?.capabilities.run === 'preview') {
      setHtmlPreviewCollapsed(true)
    }
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

  // The teacher's "every task" reference (students.{id}.autoRevealStage) is
  // re-applied as each task loads, so a student who needs it doesn't depend on
  // the teacher reopening it by hand every turn. Session-only: the setting lives
  // on the student's session node. Runs after the load effect above, whose
  // resetCheckFeedback would otherwise hide an auto-shown solution.
  const autoRevealStage = myStudentData?.autoRevealStage ?? null
  const autoRevealAppliedRef = useRef(null)
  useEffect(() => {
    if (phase !== 'lesson' || teacherPresentation || !autoRevealStage || !effectiveIdentity) {
      autoRevealAppliedRef.current = null
      return
    }
    const key = `${currentTaskId}|${autoRevealStage}`
    if (autoRevealAppliedRef.current === key) return
    autoRevealAppliedRef.current = key
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task || task.taskType === 'information' || isHostedActivityTask(task)) return
    if (!getModuleDefinition(lesson?.type)?.capabilities.unifiedStages) return
    applyAutoReveal(task, autoRevealStage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTaskId, autoRevealStage, teacherPresentation, effectiveIdentity?.anonymousId])

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
    // The pushed work (decoded by the module's wire) replaces the slot's work; Arcade keeps its
    // current design. A workspace-owned module's push (Scratch) is held for the workspace, which
    // owns its blocks. Pushed files replace the files and open the first one.
    onPushedWork: (pushed) => {
      if (getModuleDefinition(lesson.type).workSlot.workspaceOwned) setSandboxPushedWork(pushed)
      else restoreWork(lesson.type, withCode(lesson.type, pushed))
    },
    onPushedFiles: (pushed) => {
      const current = workValueFor(lesson.type)
      restoreWork(lesson.type, {
        ...current,
        files: pushed,
        activeFile: pushed.length > 0 ? pushed[0].name : current.activeFile,
      })
    },
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
    if (slotDefinition?.workSlot.workspaceOwned) {
      // The workspace holds the work (the slot only has what it last reported, if anything), so
      // mirror the task's saved record.
      const saved = persistence.readWork(lesson.type, identity.anonymousId, currentTaskId)?.work
      if (saved) writeStudentCode(identity.anonymousId, slotDefinition.wire.toCode(saved))
    } else if (isFilesWork(slotDefinition)) {
      writeStudentFiles(
        identity.anonymousId,
        slotDefinition.wire.toFilesMap(storedWork(lesson.type).work)
      )
    } else if (slotDefinition) {
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
    }
    // code_arrange is an activity hosted by python/html (its definition's
    // hostModules), not its own lesson.type, so it needs its own branch here
    // too — without it, a teacher opening the modal mid-arrangement sees a
    // blank board (no currentCodeArrangeSlots has ever been written for this
    // student/task yet) that then jumps straight to whatever the student had
    // already placed the moment they drop their next tile, instead of
    // reflecting their in-progress board right away.
    if (isModuleHostedActivityTask(findTaskById(lesson.tasks, currentTaskId))) {
      writeStudentCodeArrangeSlots?.(identity.anonymousId, codeArrangeSlotStateRef.current)
    }
    writeStudentInteraction(identity.anonymousId, {
      selection: editorSelectionRef.current,
      activeFile: isFilesWork(slotDefinition) ? activeFile : undefined,
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

    // "Reveal live code to all": a one-off reveal of the teacher's live code for
    // this task only (see teacherLiveReferenceActive).
    if (action === 'reveal_live') {
      handleRevealTeacherLiveReference()
      return
    }

    const revealMatch = action.match(/^reveal_stage_(\d+)$/)
    if (revealMatch) {
      const stageIndex = parseInt(revealMatch[1], 10)
      const stage = task.codeStages?.[stageIndex]
      if (getStageRole(stage) === 'support') handleRevealSupportStage(stageIndex, 'teacher')
      else if (getStageRole(stage) === 'complete') {
        setCompletePreviewShown(true)
        badgeSignals.reportCompleteShown(currentTaskId, 'preview')
      }
      return
    }

    const target = resolveRemoteResetTarget(task, action, lesson.type, {
      fs: DEFAULT_FS,
      circuit: DEFAULT_CIRCUIT,
      desktop: makeDefaultDesktop(task.availableApps),
    })
    if (!target) return
    // A reset to the complete code (the Complete tab, or a stage whose role is complete) puts
    // the answer in front of the student: a pass after it is not a real pass.
    const resetStage = action.match(/^stage_(\d+)$/)
    if (
      action === 'complete' ||
      (resetStage && getStageRole(task.codeStages?.[parseInt(resetStage[1], 10)]) === 'complete')
    ) {
      badgeSignals.reportCompleteShown(currentTaskId, 'teacherReset')
    }

    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition) {
      // A workspace-owned module (Scratch) also learns which stage is now active (null for the
      // starter or complete).
      const restored = restoreWork(
        lesson.type,
        slotDefinition.workSlot.fromResetTarget(target, task, action),
        { stageIndex: target.stageIndex }
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
      // A workspace-owned module's feedback stays until its workspace reports its next check.
      if (!slotDefinition.workSlot.workspaceOwned) resetCheckFeedback()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // A teacher reset of a code_arrange task also resets its tiles: 'starter' to an empty board,
  // 'complete' to the authored solution — the same initialState / solutionState a hosted
  // activity's reset loads (useActivityState). The effect above resets the code slot ('starter'
  // restores the empty starter); without this the board kept its tiles over an empty slot, so the
  // next Run executed (and logged) an empty program. As in useActivityState, the reset already
  // on the student record when this tab first sees it is history and is never re-applied.
  const seenCodeArrangeResetAtRef = useRef(undefined)
  const remoteResetPushedAt = myStudentData?.remoteResetPushedAt ?? null
  useEffect(() => {
    if (!myStudentData) return
    if (seenCodeArrangeResetAtRef.current === undefined) {
      seenCodeArrangeResetAtRef.current = remoteResetPushedAt
      return
    }
    if (!remoteResetPushedAt || remoteResetPushedAt === seenCodeArrangeResetAtRef.current) return
    if (phase !== 'lesson' && phase !== 'solo') return
    seenCodeArrangeResetAtRef.current = remoteResetPushedAt
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const activity = getModuleHostedActivity(task)
    if (!activity) return
    const action = myStudentData.remoteResetAction
    if (action !== 'starter' && action !== 'complete') return
    const slots =
      action === 'complete' ? solutionOrInitialState(activity, task) : activity.initialState(task)
    setCodeArrangeReset({ slots, taskId: currentTaskId, at: remoteResetPushedAt })
    clearRunFor(lesson.type)
    resetCheckFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteResetPushedAt, !!myStudentData])

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
    if (isModuleHostedActivityTask(task) && edit.codeArrangeSlots) {
      teacherAssistedTaskIdsRef.current.add(currentTaskId)
      setTeacherCodeArrangeEdit({
        slots: edit.codeArrangeSlots,
        taskId: currentTaskId,
        at: edit.at,
      })
      setTeacherAnswerNoticeAt(edit.at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherAnswerEdit?.at, lesson, phase, currentTaskId])

  // A pending code_arrange teacher edit belongs to one task: drop it once the student is on
  // another, so a later visit's board never re-applies it.
  useEffect(() => {
    setTeacherCodeArrangeEdit((current) =>
      current && String(current.taskId) !== String(currentTaskId) ? null : current
    )
  }, [currentTaskId])

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
    // Modules without workSlot.teacherEdit (filesystem, desktop) never apply teacher edits.
    const slotDefinition = workSlotDefinition(lesson?.type)
    if (!slotDefinition?.workSlot.teacherEdit) return
    const actorId = effectiveIdentity?.anonymousId
    if (isFilesWork(slotDefinition)) {
      // A files module (html) takes the teacher's files, keeping the active file while it
      // still exists; a teacher code edit means nothing to it.
      if (!newFiles) return
      const nextFiles = decodeSessionFiles(newFiles, decodeFileKey, slotDefinition.meta.language)
      const { activeFile: current } = workValueFor(lesson.type)
      restoreWork(lesson.type, {
        files: nextFiles,
        activeFile: nextFiles.some((file) => file.name === current)
          ? current
          : (nextFiles[0]?.name ?? ''),
      })
      setOutput('')
      setTurtleResult(null)
      setRunStatus(null)
      resetCheckFeedback()
      if (actorId) persistence.saveWork(lesson.type, actorId, currentTaskId, nextFiles)
    } else if (newCode !== undefined && slotDefinition.workSlot.workspaceOwned) {
      // The teacher edited Scratch blocks: pushed to the workspace and saved.
      const newState = slotDefinition.wire.fromCode(newCode)
      restoreWork(lesson.type, newState)
      resetCheckFeedback()
      if (actorId && newState) persistence.saveWork(lesson.type, actorId, currentTaskId, newState)
    } else if (newCode !== undefined) {
      // The teacher edited code: a code module takes it (Arcade also the design the teacher
      // sent, else keeps its own).
      const { workSlot } = slotDefinition
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
      if (actorId) {
        const { work: stored, meta } = storedWork(lesson.type, restored)
        persistence.saveRunRecord(lesson.type, actorId, currentTaskId, stored, {
          output: '',
          runStatus: null,
          ...meta,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherEditAppliedAt])

  // ─── Personal sandbox ──────────────────────────────────────────────────────

  function handleEnterPersonalSandbox() {
    if (!identity || teacherPresentation || !lesson) return
    const id = identity.anonymousId
    const slotDefinition = workSlotDefinition(lesson.type)
    // A workspace-owned module's workspace (Scratch) reads its own sandbox work.
    if (slotDefinition && !slotDefinition.workSlot.workspaceOwned) {
      restoreWork(lesson.type, readPersonalSandboxWork(slotDefinition, id))
    }
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setIframeSrc(null)
    resetCheckFeedback()
    setInPersonalSandbox(true)
    if (session) writeStudentPersonalSandbox(id, true)
  }

  // The saved personal-sandbox work (Arcade: with its saved design), else the lesson's sandbox
  // starter. A per-file module (html) reads each starter file's saved sandbox record.
  function readPersonalSandboxWork(definition, actorId) {
    const { type, workSlot } = definition
    const starter = workSlot.sandbox(lesson)
    if (definition.storage.layout !== 'perFile') {
      return workSlot.fromStored(persistence.readSandboxWork(type, actorId), starter)
    }
    const files = workSlot.stored(starter).work.map((file) => ({
      ...file,
      content:
        persistence.readSandboxWork(type, actorId, { filename: file.name })?.work ?? file.content,
    }))
    return workSlot.fromStored({ work: files, meta: {} }, starter)
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

  // Safety net for a code_arrange task: Run executes (and the attempt log records) the code slot,
  // never the tiles. CodeArrangeTaskContainer keeps the slot in step with a complete board, but if
  // the slot still holds something else at Run (e.g. a reset that landed in the same moment), the
  // program is assembled from the tiles first, so a complete board never runs an empty program.
  // Not in the personal or session sandbox, where the slot holds the sandbox's own code.
  function syncCodeArrangeSlotBeforeRun(task) {
    if (!isModuleHostedActivityTask(task)) return
    if (phase === 'sandbox' || inPersonalSandboxRef.current) return
    if (String(codeArrangeSlotTaskIdRef.current) !== String(currentTaskId)) return
    const assembled = assembleCodeArrangement(task, codeArrangeSlotStateRef.current)
    if (assembled === null) return
    const moduleType = lesson?.type
    const definition = workSlotDefinition(moduleType)
    if (!definition) return
    const slotCode = isFilesWork(definition)
      ? getCodeArrangeSlotCode(task, { files: workValueFor(moduleType)?.files ?? [] })
      : getCodeArrangeSlotCode(task, { code: storedWork(moduleType).work })
    if (slotCode === assembled) return
    if (isFilesWork(definition)) handleFileChange(getCodeArrangeEntryFile(task), assembled)
    else handleCodeChange(assembled)
  }

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
    syncCodeArrangeSlotBeforeRun(task)

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
        signals: badgeSignals,
      })
      return
    }

    // 'preview' (HTML) — build the iframe from the slot's files. The iframe is only ever rebuilt
    // here, on Run, never per keystroke.
    setHtmlPreviewCollapsed(false)
    const currentFiles = storedWork(moduleType).work
    const { wire } = definition
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
      errorName: null,
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
        const iframeDoc = iframeRef.current?.contentDocument ?? null
        const evaluation = evaluateCheckWithFeedback(
          task,
          text,
          definition.checking.buildContext(currentFiles, { iframeDoc, ran: true })
        )
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
          files: wire.toFilesMap(currentFiles),
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
          // A runtime error the preview has already reported makes this an 'error' run for
          // the teacher's card; one reported later is written by handleHtmlRuntimeError.
          const attemptNow = htmlSupportAttemptsRef.current.get(src)
          writeStudentRun(actor.anonymousId, {
            files: wire.toFilesMap(currentFiles),
            status: attemptNow?.hasError ? 'error' : 'success',
            checkPassed: passed,
            errorText: attemptNow?.errorMessage,
          })
          if (attemptNow) {
            attemptNow.runWrittenFor = actor.anonymousId
            attemptNow.errorWritten = !!attemptNow.hasError
          }
        }
      }
      // A runtime error the preview reported before its text came back (see
      // handleHtmlRuntimeError) is the attempt's and sandbox run's `error`.
      const htmlAttempt = htmlSupportAttemptsRef.current.get(src)
      const runError = htmlAttempt?.hasError ? (htmlAttempt.errorName ?? true) : false
      if (
        !teacherPresentation &&
        phaseRef.current === 'lesson' &&
        !alreadySolved &&
        task?.check &&
        taskIdAtRunTime === currentTaskIdRef.current
      ) {
        logAttempt(actor.anonymousId, taskIdAtRunTime, {
          submission: wire.submission(currentFiles),
          passed,
          suggestion,
          teacherAssisted: teacherAssistedTaskIdsRef.current.has(taskIdAtRunTime),
          error: runError,
        })
      }
      if (phaseRef.current === 'sandbox' || inPersonalSandboxRef.current) {
        badgeSignals.reportSandboxRun({
          error: runError,
          submission: wire.submission(currentFiles),
        })
      }
      persistence.saveWork(moduleType, actor.anonymousId, taskIdAtRunTime, currentFiles)
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
        const checkContext = {
          status: result.status,
          code,
          variables: result.variables ?? {},
          ran: true,
        }
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
          errorText: finalStatus === 'error' ? lastErrorLine(displayedOutput) : undefined,
        })
      }
      if (!teacherPresentation && phaseRef.current === 'lesson' && finalStatus !== 'stopped') {
        const failedTestNames = results
          .filter((r) => !r.passed)
          .map((r) => r.name)
          .join(', ')
        const erroredTest = results.find((r) => r.status === 'error')
        logAttempt(actor.anonymousId, currentTaskId, {
          submission: code,
          passed: allPassed,
          suggestion: failedTestNames,
          error: erroredTest ? runErrorFor('error', erroredTest.output) : false,
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
    if (!isCodeStringWork(workSlotDefinition(moduleType))) return
    handleWorkChange(withCode(moduleType, newCode), { moduleType })
  }

  // Arcade's sprite/sound design editor. The design is part of Arcade's work; it is saved with
  // the code and published at once, but mirrored to a watching teacher on its own debounced
  // channel (writeStudentArcadeDesign) rather than with the code.
  function handleArcadeDesignChange(nextDesign) {
    badgeSignals.reportUserEdit('arcade_design')
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
  // checks and run_attempted (the run itself) can be evaluated; other check types saved on the
  // task are ignored here (the Builder warns about them) rather than failing every attempt.
  function handleWorkspaceRun(runCode) {
    const actor = effectiveIdentity
    const moduleType = lesson?.type
    const definition = workSlotDefinition(moduleType)
    // Only a workspace-run module checked on Run (Arcade); Scratch reports checked runs through
    // reportRun.
    if (
      !actor ||
      definition?.capabilities.run !== 'workspace' ||
      definition.checking.trigger !== 'run'
    )
      return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const alreadySolved = isAlreadySolved()
    const runChecks = normalizeChecks(task?.check).filter(
      (check) => isCodeCheck(check) || isRunAttemptedCheck(check)
    )
    const checkTask = task
      ? {
          ...task,
          check: runChecks.length > 0 ? runChecks : null,
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
        // `ran`: this is a real run, so a run_attempted check passes (see checks.js).
        const context = definition.checking.buildContext(runCode, {
          status: 'success',
          ran: true,
        })
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
    // The game's own error (if any) arrives later, through handleWorkspaceRunError.
    if (phaseRef.current === 'sandbox' || inPersonalSandboxRef.current) {
      badgeSignals.reportSandboxRun({ error: false, submission: runCode })
    }
  }

  /**
   * A 'workspace'-run module's run failed after it started (Arcade: the game iframe reports a
   * Python error once it has loaded, after handleWorkspaceRun logged the run). Shows the error
   * as the run status, mirrors it like a run, and marks the logged attempt or sandbox run as
   * errored for the badge data. `message` is the formatted error ("Line 3: NameError: ...").
   */
  function handleWorkspaceRunError(message) {
    const actor = effectiveIdentity
    if (!actor) return
    const error = runErrorName(message) ?? true
    setRunStatus('error')
    if (canPublishTeacherLive()) publishTeacherLive({ runStatus: 'error' })
    const isWatched = session?.activeStudentView === actor.anonymousId
    if (
      !teacherPresentation &&
      (phaseRef.current === 'lesson' ||
        phaseRef.current === 'sandbox' ||
        inPersonalSandboxRef.current ||
        isWatched)
    ) {
      writeStudentRun(actor.anonymousId, { status: 'error', errorText: message })
    }
    if (!teacherPresentation && phaseRef.current === 'lesson' && !inPersonalSandboxRef.current) {
      flagAttemptError?.(actor.anonymousId, currentTaskId, error)
    }
    if (phaseRef.current === 'sandbox' || inPersonalSandboxRef.current) {
      badgeSignals.reportSandboxRunError(error)
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
    const definition = workSlotDefinition(lesson?.type)
    if (isFilesWork(definition)) {
      setWork(definition.type, { ...workValueFor(definition.type), activeFile: filename })
    }
    editorSelectionRef.current = null
    setEditorSelection(null)
    if (canPublishTeacherLive()) publishTeacherLive({ activeFile: filename, selection: null })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { selection: null, activeFile: filename })
    }
  }

  // A files module's (html) editor change to one file, through the files pipeline (see
  // handleFilesWorkChange): only that file is saved. The file need not be one of the work's
  // files (code_arrange saves its assembled entry file this way).
  function handleFileChange(filename, content) {
    const definition = workSlotDefinition(lesson?.type)
    if (!isFilesWork(definition)) return
    const current = workValueFor(definition.type)
    // A file the work doesn't hold yet is added (a code_arrange html task's entry file when the
    // starter files lack it), so the change is never silently dropped.
    const nextFiles = current.files.some((f) => f.name === filename)
      ? current.files.map((f) => (f.name === filename ? { ...f, content } : f))
      : [...current.files, { name: filename, type: getFileType(filename, 'html'), content }]
    if (htmlErrorLocation?.file === filename) setHtmlErrorLocation(null)
    handleFilesWorkChange(
      definition,
      { ...current, files: nextFiles },
      { changed: [{ name: filename, content }], editedFile: filename }
    )
  }

  // Scratch's workspace reports its blocks after every settled edit.
  function handleScratchChange(workspaceStates) {
    handleWorkChange(workspaceStates, { moduleType: 'scratch' })
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
    codeArrangeSlotTaskIdRef.current = currentTaskIdRef.current ?? null
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

  // A tile the student dropped into a blank where it is known to be wrong (code_arrange tile
  // feedback, see CodeArrangeTaskContainer): logged for the session report as a tile miss, never
  // an attempt. Only the student's own lesson work, like a flagged paste.
  function recordCodeArrangeTileMiss({ slotId, tileId } = {}) {
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef.current)
      return
    if (!effectiveIdentity?.anonymousId || currentTaskId == null || !slotId || !tileId) return
    recordStudentTileMiss?.(effectiveIdentity.anonymousId, currentTaskId, { slotId, tileId })
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

  /**
   * A 'workspace'-checked module (Scratch) evaluated the task check itself and reports the
   * outcome: `passed`, the workspace's own `suggestion` (empty → the generic banner), and
   * the `work` it checked (else the task's saved work). Applies local feedback; then, in a live
   * lesson, the teacher sandbox or while watched, writes the run (the work as `code` via
   * wire.toCode) and, in a live lesson while unsolved, the attempt (wire.submission).
   */
  function reportRun({ passed, suggestion: reportedSuggestion, work: reportedWork } = {}) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const alreadySolved = isAlreadySolved()
    const effectivePassed = alreadySolved ? true : passed
    // The workspace already applied the shared hint rule (checks.js buildCheckFeedbackResult);
    // an empty suggestion means no failed check had a hint, so the generic banner shows.
    const suggestion = effectivePassed ? '' : String(reportedSuggestion ?? '').trim()
    if (!alreadySolved && task?.check) applyCheckFeedback(passed, suggestion)
    const definition = workSlotDefinition(lesson?.type)
    if (!identity || definition?.checking.trigger !== 'workspace') return
    if (
      phase === 'lesson' ||
      phase === 'sandbox' ||
      activeStudentViewRef.current === identity.anonymousId
    ) {
      const { wire } = definition
      const checkedWork =
        reportedWork ??
        persistence.readWork(lesson.type, identity.anonymousId, currentTaskId)?.work ??
        null
      writeStudentRun(identity.anonymousId, {
        code: checkedWork ? wire.toCode(checkedWork) : undefined,
        status: 'success',
        checkPassed: effectivePassed,
      })
      if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
        // Scratch has no console: its runs never carry an error.
        logAttempt(identity.anonymousId, currentTaskId, {
          submission: wire.submission(checkedWork),
          passed,
          suggestion,
        })
      }
    }
    if (phase === 'sandbox' || inPersonalSandboxRef.current) {
      badgeSignals.reportSandboxRun({ error: false, submission: reportedWork ?? null })
    }
  }

  // The Scratch workspace's check report: onCheckResult(passed, { suggestion, workspaceStates }).
  function handleScratchCheck(passed, snapshot) {
    reportRun({ passed, suggestion: snapshot?.suggestion, work: snapshot?.workspaceStates })
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
        // A failed check is not a crash: 'error' is kept for runs that actually errored, so
        // the teacher's card can tell "Error" from "Failed" (src/app/studentHints.js).
        status: task?.check ? 'success' : null,
        checkPassed: evaluatedPassed,
      })
      if (!alreadySolved && task?.check) {
        // A failed filesystem / desktop check is not a console error: no `error` here.
        logAttempt(effectiveIdentity.anonymousId, currentTaskId, {
          submission: wire.submission(workValue),
          passed: evaluatedPassed,
          suggestion,
        })
      }
    }
  }

  // ─── Auto-check on leave ─────────────────────────────────────────────────────

  // The work to auto-check for the leaving task: the slot's work when it holds this task's work
  // for this module, else (personal sandbox, or the slot not loaded) the task's saved work.
  // Null when there is none, or for a per-file module (html) whose saved files can't be listed.
  function leavingTaskWork(moduleType, taskId, definition) {
    const slot = workRef.current
    if (
      !inPersonalSandboxRef.current &&
      slot.moduleType === moduleType &&
      (slot.taskId == null || slot.taskId === taskId) &&
      slot.value != null
    ) {
      return slot.value
    }
    if (definition.storage.layout === 'perFile') return null
    const saved = persistence.readWork(moduleType, effectiveIdentity.anonymousId, taskId)
    if (saved?.work == null) return null
    return definition.workSlot.fromStored(saved, defaultWorkFor(moduleType))
  }

  /**
   * Called by the student phase machine when the teacher moves a live class to another task,
   * BEFORE the current task changes (refs still point at the leaving task). If this student has
   * not passed the leaving graded task, grades their current work without running it
   * (checks.js evaluateTaskWithoutRun, or the module's checking.evaluateWithoutRun for Scratch)
   * and logs the verdict as an `auto: 'leave'` attempt for the session report. Never runs code,
   * changes the student's feedback, or writes their student node. Activities (quizzes included)
   * and information tasks are left alone, as are check-less tasks, solo, presentation and preview.
   */
  function autoCheckOnLeave() {
    if (teacherPresentation || previewMode || phaseRef.current !== 'lesson') return
    const anonymousId = effectiveIdentity?.anonymousId
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!anonymousId || !currentLesson || taskId == null) return
    const task = findTaskById(currentLesson.tasks, taskId)
    if (!task || task.taskType === 'information' || isHostedActivityTask(task)) return
    if (normalizeChecks(task.check).length === 0 && !(task.tests?.length > 0)) return
    if (checkPassedRef.current) return
    const logged = Object.values(sessionRef.current?.attemptLog?.[anonymousId]?.[taskId] ?? {})
    if (logged.some((entry) => entry?.passed && !isAutoAttempt(entry))) return

    // lessonRef is the leaving task's effective lesson, so a composed lesson's module is right.
    const moduleType = currentLesson.type
    const definition = workSlotDefinition(moduleType)
    if (!definition?.checking) return
    const workValue = leavingTaskWork(moduleType, taskId, definition)
    if (workValue == null) return

    let outcome = null
    try {
      const { checking } = definition
      if (typeof checking.evaluateWithoutRun === 'function') {
        outcome = checking.evaluateWithoutRun(task, workValue)
      } else if (typeof checking.buildContext === 'function') {
        const { work: stored } = definition.workSlot.stored(workValue)
        const context =
          checking.trigger === 'change'
            ? checking.buildContext(workValue, interactionFor(moduleType))
            : checking.buildContext(stored)
        outcome = evaluateTaskWithoutRun(task, context)
      } else {
        // A 'workspace'-checked module with no evaluator: its checks can't be judged here.
        outcome = { result: NO_RUN_RESULTS.NOT_RUN, suggestion: '' }
      }
    } catch (err) {
      console.warn('Auto-check on leave failed:', err)
      outcome = { result: NO_RUN_RESULTS.NOT_RUN, suggestion: '' }
    }
    if (!outcome) return

    const submission = definition.wire.submission(definition.workSlot.stored(workValue).work)
    Promise.resolve(
      logAttempt(anonymousId, taskId, {
        submission,
        passed: false,
        suggestion: outcome.suggestion,
        auto: AUTO_CHECK_LEAVE,
        autoResult: outcome.result,
      })
    ).catch((err) => console.warn('Failed to log the auto-check on leave:', err))
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
   *
   *   'run' on the files channel (html): see handleFilesWorkChange.
   *
   *   'workspace' (scratch; the workspace checks and reports through reportRun): set work →
   *   teacherLive now → the work saved alone → writeStudentCode only while watched.
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
      if (next === undefined) return
      if (isFilesWork(definition)) {
        handleFilesWorkChange(definition, next, { changed: changedFiles(moduleType, next) })
      } else {
        handleCodeWorkChange(definition, next)
      }
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

  // handleWorkChange for code-channel modules checked on Run or by their workspace (see above).
  function handleCodeWorkChange(definition, next) {
    const moduleType = definition.type
    const { trigger } = definition.checking
    // A workspace flushes its last report as it unmounts; in a composed lesson that can be
    // after the lesson has moved to another module. The report is still saved to its own task
    // (this handler's), but it never replaces the new module's work in the slot.
    if (trigger !== 'workspace' || lessonRef.current?.type === moduleType) setWork(moduleType, next)
    const { work: stored, meta } = definition.workSlot.stored(next)
    const wireCode = definition.wire.toCode(stored)
    if (canPublishTeacherLive()) publishTeacherLive({ code: wireCode })
    const actorId = effectiveIdentity?.anonymousId
    if (trigger === 'workspace') {
      // A workspace-checked module saves its work alone (Scratch: `{ state }`), and without an
      // actor reports nothing further.
      if (!actorId) return
      persistence.saveWork(moduleType, actorId, currentTaskId, stored, meta)
    } else if (actorId) {
      persistence.saveRunRecord(moduleType, actorId, currentTaskId, stored, {
        output,
        runStatus,
        ...meta,
      })
    }
    if (identity && activeStudentViewRef.current === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, wireCode)
    }
    if (trigger !== 'run') return
    // Code modules' idle feedback also sees the last run's status; a state module's (the
    // electronics circuit) sees the work alone.
    scheduleIdleFeedback(() =>
      definition.checking.buildContext(
        stored,
        definition.workSlot.kind === 'code' ? { status: runStatusRef.current } : {}
      )
    )
  }

  // The files names of `next` whose content differs from the current work (or that are new).
  function changedFiles(moduleType, next) {
    const before = new Map(workValueFor(moduleType).files.map((f) => [f.name, f.content]))
    return next.files.filter((f) => before.get(f.name) !== f.content)
  }

  /**
   * handleWorkChange for a files module (html, checked on Run): set work → teacherLive now
   * (the files map and the edited file as the active file) → save the `changed` files only (one
   * `{ content }` record each) → writeStudentFiles only while this student is watched → idle
   * feedback, limited to the checks allowed on submit (no preview has run). The preview iframe
   * is never rebuilt here — only Run (handleRun) builds it.
   */
  function handleFilesWorkChange(definition, next, { changed, editedFile = next.activeFile }) {
    const moduleType = definition.type
    const { wire } = definition
    setWork(moduleType, next)
    if (canPublishTeacherLive()) {
      publishTeacherLive({ files: wire.toFilesMap(next.files), activeFile: editedFile })
    }
    if (effectiveIdentity) {
      persistence.saveWork(moduleType, effectiveIdentity.anonymousId, currentTaskId, changed)
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      writeStudentFiles(identity.anonymousId, wire.toFilesMap(next.files))
    }
    scheduleIdleFeedback(
      () =>
        definition.checking.buildContext(next.files, {
          output: outputRef.current,
          iframeDoc: iframeRef.current?.contentDocument ?? null,
        }),
      { feedbackFilter: checkAllowedForSubmit }
    )
  }

  // Legacy per-module names the workspaces (and sharedWorkspacePayload) call. Interaction
  // handlers stay memoised, as before, so workspace effects keyed on them don't re-fire.
  // Both are only called by the workspace for the student's own actions (never on load), so each
  // is a real edit for Ready to Code.
  function handleFsChange(newFs) {
    badgeSignals.reportUserEdit('filesystem')
    handleWorkChange(newFs, { moduleType: 'filesystem' })
  }

  function handleDesktopChange(newDesktop) {
    badgeSignals.reportUserEdit('desktop')
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
      // A workspace-owned module's sandbox (Scratch) is its workspace's to reset.
      if (slotDefinition && !slotDefinition.workSlot.workspaceOwned) {
        restoreWork(lesson.type, slotDefinition.workSlot.sandbox(lesson))
        // As before: modules checked on Run drop their run (and html its preview); state
        // modules reset feedback.
        if (slotDefinition.checking.trigger !== 'change') {
          setOutput('')
          setTurtleResult(null)
          setRunStatus(null)
          setIframeSrc(null)
        }
        if (slotDefinition.workSlot.kind === 'state') resetCheckFeedback()
      }
      return
    }
    if (!window.confirm('Reset your code to the starter code? Your current work will be lost.'))
      return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const slotDefinition = workSlotDefinition(lesson.type)
    if (slotDefinition?.workSlot.taskReset) resetWorkToStarter(slotDefinition, task)
    // Filesystem and desktop (no workSlot.taskReset) only reset inside the personal sandbox.
  }

  // The Reset button for a work-slot module outside the personal sandbox.
  // - A workspace-owned module (scratch) has the starter pushed to its workspace, with no
  //   active stage; the workspace reports (and so saves) the change itself.
  // - 'code' modules restore the starter (in a teacher sandbox, a teacherSandboxReset module
  //   restores the teacher's pushed code instead) without saving it, republish, and drop the
  //   run (html: and the preview). Extras reset through their own pipeline first: Arcade's
  //   design goes through handleArcadeDesignChange, which saves it with the code as it was
  //   before the reset.
  // - 'state' modules (electronics) restore and save the starter.
  function resetWorkToStarter(definition, task) {
    const moduleType = definition.type
    const { workSlot } = definition
    if (workSlot.workspaceOwned) {
      restoreWork(moduleType, workSlot.starter(task), { stageIndex: null })
      return
    }
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
    const { work: starterWork, meta } = workSlot.stored(starter)
    if (Object.hasOwn(meta, 'arcadeDesign')) handleArcadeDesignChange(meta.arcadeDesign)
    restoreWork(moduleType, starter)
    if (canPublishTeacherLive())
      publishTeacherLive({
        ...liveWorkFields(definition, starterWork),
        output: '',
        runStatus: null,
        checkPassed: false,
        checkAttempted: false,
      })
    setOutput('')
    setTurtleResult(null)
    setRunStatus(null)
    setIframeSrc(null)
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
      const restored = restoreWork(lesson.type, slotDefinition.workSlot.stage(task, stageIndex), {
        stageIndex,
      })
      clearRunFor(lesson.type)
      persistRestoredWork(lesson.type, restored)
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
    // Support stages belong to the modules with unified code stages (all but filesystem and
    // desktop).
    if (!getModuleDefinition(lesson?.type)?.capabilities.unifiedStages) return
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

  // One-off reveal of the teacher's live code on the current task (the teacher's
  // "Reveal live code to all"). Shown at once from local state; the supportRevealLog
  // entry keeps it across a reload and is what the teacher's views and reports read.
  // Only while Presentation is broadcasting this task, so a stray command never logs
  // a reveal of a reference the student never saw.
  function handleRevealTeacherLiveReference() {
    if (!effectiveIdentity) return
    const liveReference = sessionRef.current?.teacherLiveReference ?? session?.teacherLiveReference
    if (!liveReference?.active || liveReference.taskId !== currentTaskId) return
    const stageLabel = "Teacher's live code"
    setLocalSupportStageReveals((prev) => ({
      ...prev,
      [currentTaskId]: {
        ...(prev[currentTaskId] ?? {}),
        [TEACHER_LIVE_REVEAL_KEY]: {
          taskId: currentTaskId,
          stageIndex: TEACHER_LIVE_REVEAL_KEY,
          stageLabel,
          source: 'teacher',
          revealedAt: Date.now(),
        },
      },
    }))
    if (!teacherPresentation && phase === 'lesson') {
      recordSupportStageReveal?.(
        effectiveIdentity.anonymousId,
        currentTaskId,
        TEACHER_LIVE_REVEAL_KEY,
        { source: 'teacher', stageLabel }
      )
    }
  }

  // 'first' = the first support stage; 'support' = every support stage (never the
  // solution); 'solution' = the complete stage, falling back to every support
  // stage on a task that has no complete stage.
  function applyAutoReveal(task, mode) {
    const supportStages = getRevealableStages(task).filter(
      ({ index }) => !Object.prototype.hasOwnProperty.call(supportStageReveals, index)
    )
    const completeStage = mode === 'solution' ? getCompleteStage(task) : null
    if (completeStage) {
      recordSupportStageReveal?.(
        effectiveIdentity.anonymousId,
        currentTaskId,
        completeStage.index,
        {
          source: 'teacher-auto',
          stageLabel: completeStage.stage.label || 'Complete',
        }
      )
      setCompletePreviewShown(true)
      return
    }
    const toReveal = mode === 'first' ? getRevealableStages(task).slice(0, 1) : supportStages
    toReveal
      .filter(({ index }) => !Object.prototype.hasOwnProperty.call(supportStageReveals, index))
      .forEach(({ index }) => handleRevealSupportStage(index, 'teacher-auto', 0))
  }

  // Large pastes into the editor are flagged to the teacher, not blocked. Text the
  // student copied or cut from their own editor doesn't count.
  const ownClipboardRef = useRef('')
  function handleEditorCopy(text) {
    if (text) ownClipboardRef.current = text
  }
  function handleEditorPaste(text) {
    if (phase !== 'lesson' || teacherPresentation || previewMode || inPersonalSandboxRef.current)
      return
    if (!effectiveIdentity?.anonymousId || !isFlaggablePaste(text)) return
    if (isSamePasteText(text, ownClipboardRef.current)) return
    recordStudentPaste?.(effectiveIdentity.anonymousId, currentTaskId, measurePaste(text))
  }

  function handleHtmlRuntimeError(src, errorMeta) {
    const supportAttempt = htmlSupportAttemptsRef.current.get(src)
    if (!supportAttempt) return
    supportAttempt.hasError = true
    if (!supportAttempt.errorName) supportAttempt.errorName = runErrorName(errorMeta?.message)
    if (!supportAttempt.errorMessage && errorMeta?.message) {
      supportAttempt.errorMessage = String(errorMeta.message)
    }
    // The run was already written as a success before this error arrived: correct it.
    if (supportAttempt.runWrittenFor && !supportAttempt.errorWritten) {
      supportAttempt.errorWritten = true
      writeStudentRun(supportAttempt.runWrittenFor, {
        status: 'error',
        errorText: supportAttempt.errorMessage,
      })
    }
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
    // Support-stage offers belong to the progressively revealing modules (python, html).
    if (getModuleDefinition(lesson?.type)?.capabilities.stageReveal !== 'progressive') return

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
    badgeSignals.reportCompleteShown(currentTaskId, 'preview')
  }

  function handleShowCompleteCode() {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return
    const slotDefinition = workSlotDefinition(lesson.type)
    badgeSignals.reportCompleteShown(currentTaskId, 'show')

    if (slotDefinition) {
      // The complete work (Arcade: with the complete design, like Show stage and remote reset;
      // html: the complete entry file; Scratch: no active stage).
      const restored = restoreWork(lesson.type, slotDefinition.workSlot.complete(task), {
        stageIndex: null,
      })
      clearRunFor(lesson.type)
      applyCheckFeedback(true)
      persistRestoredWork(lesson.type, restored)
    }
  }

  // ─── Submit (HTML / Python submit-mode) ──────────────────────────────────────

  async function handleSubmit() {
    const actor = effectiveIdentity
    if (!actor) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    // A files module (html) submits its files as a filename → content map, checked against
    // their joined contents; a code module its code.
    const definition = workSlotDefinition(lesson?.type)
    const isFiles = isFilesWork(definition)
    const submittedFiles = isFiles ? storedWork(lesson.type).work : null
    const filesMap = isFiles ? definition.wire.toFilesMap(submittedFiles) : undefined
    const alreadySolved = isAlreadySolved()
    let passed,
      suggestion = ''
    if (!alreadySolved) {
      const checkContext = isFiles
        ? definition.checking.buildContext(submittedFiles)
        : buildCodeCheckContext(lesson?.type, code)
      const codeForCheck = checkContext.code
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
        code: isFiles ? undefined : code,
        files: filesMap,
        output: isFiles ? undefined : '',
        runStatus: 'submitted',
        checkPassed: passed,
        checkAttempted: !alreadySolved && !!task?.check,
        checkSuggestion: suggestion,
      })
    }
    if (isFiles) {
      persistence.saveWork(lesson.type, actor.anonymousId, currentTaskId, submittedFiles)
    } else {
      persistence.savePythonCode(actor.anonymousId, currentTaskId, {
        code,
        output: '',
        runStatus: 'submitted',
      })
    }
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      await writeStudentRun(actor.anonymousId, {
        code: isFiles ? undefined : code,
        files: filesMap,
        output: isFiles ? undefined : '',
        status: 'submitted',
        checkPassed: passed,
      })
    }
    if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
      const submission = isFiles ? definition.wire.submission(submittedFiles) : code
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
  // rather than in the view because its source, the generic work slot, only
  // exists inside this hook.
  function buildShareSnapshot() {
    const scratchWork = storedWork('scratch').work
    return buildSharedWorkspaceSnapshot({
      lesson: lessonRef.current,
      taskId: currentTaskIdRef.current,
      code: codeRef.current,
      // What the Scratch workspace last reported ('' before any report).
      scratchCode:
        scratchWork == null ? '' : getModuleDefinition('scratch').wire.toCode(scratchWork),
      // The snapshot picks the entry for the task's module (buildSharedWorkspaceSnapshot keeps
      // its per-kind parameters, pinned by the Phase 0 share tests, and encodes them with the
      // module's wire).
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
    // State. `code`, `arcadeDesign`, `files` and `activeFile` are aliases derived from the
    // generic work slot.
    code,
    teacherCodeArrangeEdit,
    codeArrangeReset,
    // The board applied the reset: a later remount (another task, or back from an earlier one)
    // must not apply it again over the student's newer tiles.
    acknowledgeCodeArrangeReset: (at) =>
      setCodeArrangeReset((current) => (current?.at === at ? null : current)),
    // The board applied the teacher's "Edit answers" tiles: never apply them again.
    acknowledgeTeacherCodeArrangeEdit: (at) =>
      setTeacherCodeArrangeEdit((current) => (current?.at === at ? null : current)),
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
    handleEditorCopy,
    handleEditorPaste,
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
    teacherLiveReferencePinned,
    targetedStageOffer,
    targetedPreviewStageIndex,
    // A workspace-owned module's (Scratch's) pushed work, under its old names.
    scratchSandboxProject: sandboxPushedWork,
    scratchExternalState: pushedWork,
    scratchActiveStageIndex: pushedStageIndex,
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
    handleWorkspaceRunError,
    handleArcadeRunError: handleWorkspaceRunError,
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
    recordCodeArrangeTileMiss,
    handleScratchChange,
    handleScratchCheck,
    reportRun,
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
    autoCheckOnLeave,
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
    // Live badge signal reporters (useStudentBadgeSignals), for StudentView's work-area
    // keydown listener, topic opens and the BadgeSignalsContext.
    badgeSignals,
  }
}
