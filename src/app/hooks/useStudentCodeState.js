import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { FEEDBACK_TIMING, checkAllowedForSubmit, evaluateCheck, evaluateCheckWithCode, evaluateCheckWithFeedback, getStageOfferMatchThreshold, normalizeChecks, normalizeFeedbackChecks, evaluateSingleCheck, resolveTestCheck } from '../../modules/checks'
import { flattenTasks, findTaskById, getCompleteStage, getNextRevealableStage, getRevealableStages, getStageRole, getStarterStage, isRevealableStage } from '../../shared/taskUtils'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS, normaliseDirPath } from '../../modules/filesystem/filesystem'
import { DEFAULT_CIRCUIT, serializeCircuit } from '../../modules/electronics/circuit'
import { decodeFileKey } from '../../shared/fileKeys'
import { loadSavedCode, loadPersonalSandboxCode, savePersonalSandboxCode, loadPersonalSandboxFile, savePersonalSandboxFile, loadPersonalSandboxFs, savePersonalSandboxFs, clearEphemeralStorage } from '../studentStorage'
import { resolveSavedCarrySource, selectHtmlTaskFiles, selectPythonTaskCode } from '../studentTaskContent'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { buildQuizSubmission, getQuizSuggestion } from '../studentQuizContent'
import { useCheckFeedback } from './useCheckFeedback'
import { createStudentPersistence } from './createStudentPersistence'
import { useTeacherLivePublish } from './useTeacherLivePublish'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { getLessonModule } from '../../modules/registry'
import { appendStudentOutput, createStudentOutputBuffer } from './studentOutputBuffer'
import { cloneArcadeDesign, designForCodeTab } from '../../modules/arcade/design'

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
  writeStudentFiles,
  writeStudentOutput,
  writeStudentInteraction,
  recordStudentCarryFallback,
  recordSupportStageReveal,
  writeStudentPersonalSandbox,
  writeStudentPresence,
  registerPresence,
  removeStudent,
  updateTeacherLive,
  setTeacherLive,
  removeTeacherHighlight,
}) {
  const [code, setCode]                   = useState('')
  const [arcadeDesign, setArcadeDesign]   = useState(null)
  const [files, setFiles]                 = useState([])
  const [activeFile, setActiveFile]       = useState('')
  const [output, setOutput]               = useState('')
  const [runStatus, setRunStatus]         = useState(null)
  const [running, setRunning]             = useState(false)
  const [runningTests, setRunningTests]   = useState(false)
  const [iframeSrc, setIframeSrc]         = useState(null)
  const [inputPrompt, setInputPrompt]     = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [scratchSandboxProject, setScratchSandboxProject] = useState(null)
  const [scratchExternalState, setScratchExternalState] = useState(null)
  const [scratchActiveStageIndex, setScratchActiveStageIndex] = useState(null)
  const [fsState, setFsState]             = useState(DEFAULT_FS)
  const [fsInteraction, setFsInteraction] = useState({ currentDir: '/', openFile: null })
  const [editorSelection, setEditorSelection] = useState(null)
  const [editorActivity, setEditorActivity] = useState(null)
  const [inPersonalSandbox, setInPersonalSandbox] = useState(false)
  const [localSupportStageReveals, setLocalSupportStageReveals] = useState({})
  const [supportStageVisibility, setSupportStageVisibility] = useState({})
  const [supportStageOffers, setSupportStageOffers] = useState({})
  const [targetedStageOffer, setTargetedStageOffer] = useState(null)
  const [targetedPreviewStageIndex, setTargetedPreviewStageIndex] = useState(null)
  const targetedStageOfferMatchCountsRef = useRef({})

  const iframeRef              = useRef(null)
  const appendOutputRef        = useRef(null)
  const writeAnswerDebounceRef = useRef(null)
  const lastOutputWriteRef     = useRef(0)
  const lastRuntimeCodeWriteRef = useRef(0)
  const outputRafIdRef         = useRef(null)
  const runtimeCodeRafIdRef    = useRef(null)
  const pendingRuntimeCodeRef  = useRef(null)
  const idleFeedbackTimerRef   = useRef(null)
  const htmlSupportAttemptsRef = useRef(new Map())

  const IDLE_FEEDBACK_DELAY_MS = 900

  // Stable refs for stale-closure-safe reads inside async handlers and callbacks
  const identityRef          = useRef(identity)
  identityRef.current        = identity
  const lessonRef            = useRef(lesson)
  lessonRef.current          = lesson
  const currentTaskIdRef     = useRef(currentTaskId)
  currentTaskIdRef.current   = currentTaskId
  const phaseRef             = useRef(phase)
  phaseRef.current           = phase
  const codeRef              = useRef(code)
  codeRef.current            = code
  const arcadeDesignRef      = useRef(arcadeDesign)
  arcadeDesignRef.current    = arcadeDesign
  const arcadeDesignWriteTimerRef = useRef(null)
  const filesRef             = useRef(files)
  filesRef.current           = files
  const outputRef            = useRef(output)
  outputRef.current          = output
  const runStatusRef         = useRef(runStatus)
  runStatusRef.current       = runStatus
  const sessionRef           = useRef(session)
  sessionRef.current         = session
  const activeStudentViewRef = useRef(session?.activeStudentView)
  activeStudentViewRef.current = session?.activeStudentView
  const editorSelectionRef   = useRef(editorSelection)
  editorSelectionRef.current = editorSelection
  const editorActivityRef    = useRef(editorActivity)
  editorActivityRef.current  = editorActivity
  const inPersonalSandboxRef = useRef(inPersonalSandbox)
  inPersonalSandboxRef.current = inPersonalSandbox
  const fsStateRef           = useRef(fsState)
  fsStateRef.current         = fsState
  const activeFileRef        = useRef(activeFile)
  activeFileRef.current      = activeFile
  const fsInteractionRef     = useRef(fsInteraction)
  fsInteractionRef.current   = fsInteraction

  // ─── Runtime status ───────────────────────────────────────────────────────

  const [pyodideStatus, setPyodideStatus] = useState('idle')

  useEffect(() => {
    const mod = getLessonModule(lesson?.type)
    if (!lesson || !mod?.runtime?.init || mod.runtime.isReady()) return
    setPyodideStatus('loading')
    mod.runtime.init(msg => setPyodideStatus(msg))
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
    lesson?.storageAssets ?? [],
  )
  const htmlSharedAssetNames = lesson?.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const htmlIframeStorageAssets = [
    ...lessonStorageAssets.filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !lessonStorageAssets.some(b => b.name === a.name)),
  ]

  const myStudentData = session?.students?.[identity?.anonymousId]
  const supportStageReveals = useMemo(() => ({
    ...(session?.supportRevealLog?.[effectiveIdentity?.anonymousId]?.[currentTaskId] ?? {}),
    ...(localSupportStageReveals[currentTaskId] ?? {}),
  }), [session?.supportRevealLog, effectiveIdentity?.anonymousId, currentTaskId, localSupportStageReveals])
  const activeSupportStageIndex = useMemo(() => {
    const visibility = supportStageVisibility[currentTaskId]
    if (visibility !== undefined) return visibility
    const revealedIndexes = Object.keys(supportStageReveals).map(Number).filter(Number.isInteger)
    return revealedIndexes.length ? Math.max(...revealedIndexes) : null
  }, [currentTaskId, supportStageReveals, supportStageVisibility])
  const offeredSupportStageIndex = supportStageOffers[currentTaskId] ?? null

  const teacherHighlights = useMemo(() => {
    const raw = myStudentData?.teacherHighlights
    if (!raw) return []
    return Object.entries(raw)
      .filter(([, h]) => decodeFileKey(h.file) === activeFile)
      .map(([id, h]) => ({ id, from: h.from, to: h.to, emoji: h.emoji, note: h.note }))
  }, [myStudentData?.teacherHighlights, activeFile])

  const dismissHighlight = useCallback(highlightId => {
    if (!identity?.anonymousId) return
    removeTeacherHighlight?.(identity.anonymousId, highlightId)
  }, [identity, removeTeacherHighlight])

  const {
    checkPassed, setCheckPassed, checkAttempted, setCheckAttempted,
    checkSuggestion, setCheckSuggestion, repeatedSuggestionCount, checkFailCount,
    testResults, setTestResults, checkPassedRef,
    offeredStageIndex, setOfferedStageIndex,
    completePreviewShown, setCompletePreviewShown,
    stagePromptAccepted, markStagePromptAccepted,
    resetRunFeedback, resetCheckFeedback, applyCheckFeedback,
  } = useCheckFeedback({ myStudentData })

  const sandboxModuleId = lesson?.lessonModule?.id ?? null
  const persistence = createStudentPersistence({ lessonId, teacherPresentation, previewMode, inPersonalSandboxRef, sandboxModuleId })

  const { teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed, canPublishTeacherLive, currentTeacherLivePayload, publishTeacherLive } = useTeacherLivePublish({
    teacherPresentation,
    identityRef, sessionRef, lessonRef, currentTaskIdRef,
    codeRef, arcadeDesignRef, filesRef, activeFileRef, outputRef, runStatusRef, fsStateRef,
    editorSelectionRef, editorActivityRef,
    lesson, session, identity, currentTaskId,
    code, files, activeFile, output, runStatus,
    checkPassed, checkAttempted, checkSuggestion, fsState,
    iframeStorageAssets: htmlIframeStorageAssets,
    updateTeacherLive,
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
      const feedbackChecks = normalizeFeedbackChecks(task).filter(check => (
        options.feedbackFilter ? options.feedbackFilter(check, task) : true
      ))
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
      const matchedIdleFeedback = evaluation.feedbackResults.find(result => result.passed)
      if (matchedIdleFeedback && !isAlreadySolved()) {
        applyCheckFeedback(evaluation.passed, evaluation.suggestion)
        updateTargetedStageOffer(task, evaluation, evaluation.passed)
      }
    }, IDLE_FEEDBACK_DELAY_MS)
  }

  useEffect(() => () => {
    if (idleFeedbackTimerRef.current !== null) {
      clearTimeout(idleFeedbackTimerRef.current)
      idleFeedbackTimerRef.current = null
    }
  }, [lesson?.type, currentTaskId])

  useEffect(() => () => {
    if (arcadeDesignWriteTimerRef.current !== null) clearTimeout(arcadeDesignWriteTimerRef.current)
  }, [])

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

    const task = flattenTasks(currentLesson.tasks).find(t => t.id === taskId)
    if (task?.taskType === 'quiz' || task?.taskType === 'information') return

    if (currentLesson.type === 'python') {
      persistence.savePythonCode(id.anonymousId, taskId, {
        code: codeRef.current,
        output: outputRef.current,
        runStatus: runStatusRef.current,
      })
    } else if (currentLesson.type === 'arcade') {
      persistence.savePythonCode(id.anonymousId, taskId, {
        code: codeRef.current,
        output: outputRef.current,
        runStatus: runStatusRef.current,
        arcadeDesign: arcadeDesignRef.current,
      })
    } else if (currentLesson.type === 'html') {
      persistence.saveHtmlFiles(id.anonymousId, taskId, filesRef.current)
    } else if (currentLesson.type === 'filesystem') {
      persistence.saveFs(id.anonymousId, taskId, fsStateRef.current)
    } else if (currentLesson.type === 'electronics') {
      persistence.savePythonCode(id.anonymousId, taskId, { code: codeRef.current })
    }
    // Scratch: blocks are saved immediately in handleScratchChange — no snapshot needed
  }

  function savePersonalSandboxSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    if (!id || teacherPresentation || !currentLesson) return
    if (currentLesson.type === 'python') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current }, currentLesson.lessonModule?.id ?? null)
    } else if (currentLesson.type === 'arcade') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current, arcadeDesign: arcadeDesignRef.current }, currentLesson.lessonModule?.id ?? null)
    } else if (currentLesson.type === 'html') {
      filesRef.current.forEach(f => savePersonalSandboxFile(lessonId, f.name, id.anonymousId, f.content, currentLesson.lessonModule?.id ?? null))
    } else if (currentLesson.type === 'filesystem') {
      savePersonalSandboxFs(lessonId, id.anonymousId, fsStateRef.current, currentLesson.lessonModule?.id ?? null)
    } else if (currentLesson.type === 'electronics') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current }, currentLesson.lessonModule?.id ?? null)
    }
    // Scratch: saves incrementally via handleScratchChange
  }

  function recordCarryFallback(fallback) {
    const id = identityRef.current
    if (!fallback || teacherPresentation || previewMode || phaseRef.current !== 'lesson' || !id?.anonymousId) return
    if (sessionRef.current?.carryFallbackLog?.[id.anonymousId]?.[fallback.taskId]) return
    recordStudentCarryFallback?.(id.anonymousId, fallback.taskId, fallback)
  }

  // ─── Task content loading ──────────────────────────────────────────────────

  function loadTaskContent(taskId) {
    const activeIdentity = effectiveIdentity
    if (!lesson || !activeIdentity) return
    const task = flattenTasks(lesson.tasks).find(t => t.id === taskId)
    if (!task) return
    if (task.taskType === 'quiz' || task.taskType === 'information') {
      setCode('')
      setFiles([])
      setActiveFile('')
      setSelectedAnswer('')
      resetCheckFeedback()
      return
    }
    if (lesson.type === 'python') {
      setCode(selectPythonTaskCode({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedCode: sourceTaskId => persistence.readSavedCode(activeIdentity.anonymousId, sourceTaskId),
        onCarryFallback: recordCarryFallback,
      }))
    } else if (lesson.type === 'arcade') {
      const saved = persistence.readSavedCode(activeIdentity.anonymousId, taskId)
      setCode(selectPythonTaskCode({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedCode: sourceTaskId => persistence.readSavedCode(activeIdentity.anonymousId, sourceTaskId),
        onCarryFallback: recordCarryFallback,
      }))
      setArcadeDesign(saved?.arcadeDesign ? cloneArcadeDesign(saved.arcadeDesign) : designForCodeTab(task, 'starter'))
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
      setScratchActiveStageIndex(null)
    } else if (lesson.type === 'filesystem') {
      const carryId = task.carryFsFrom ?? null
      const ownSaved = persistence.readSavedFs(activeIdentity.anonymousId, taskId)
      const carried = resolveSavedCarrySource({
        tasks: lesson.tasks,
        taskId,
        carryFromId: carryId,
        carryField: 'carryFsFrom',
        readSavedState: sourceTaskId => persistence.readSavedFs(activeIdentity.anonymousId, sourceTaskId),
        hasSavedState: fs => fs != null,
      })
      if (ownSaved == null) recordCarryFallback(carried.fallback)
      const initialFs = carryId != null
        ? (ownSaved ?? carried.saved ?? task.starterFs ?? DEFAULT_FS)
        : (ownSaved ?? task.starterFs ?? DEFAULT_FS)
      setFsState(initialFs)
      const defaultDir = task.startsInDir ? normaliseDirPath(task.startsInDir) : '/'
      setFsInteraction({ currentDir: carryId ? (fsInteractionRef.current?.currentDir ?? defaultDir) : defaultDir, openFile: null })
      resetCheckFeedback()
    } else if (lesson.type === 'electronics') {
      const carryId = task.carryCircuitFrom ?? null
      const ownSaved = persistence.readSavedCode(activeIdentity.anonymousId, taskId)?.code ?? null
      const carried = resolveSavedCarrySource({
        tasks: lesson.tasks,
        taskId,
        carryFromId: carryId,
        carryField: 'carryCircuitFrom',
        readSavedState: sourceTaskId => persistence.readSavedCode(activeIdentity.anonymousId, sourceTaskId),
        hasSavedState: saved => saved != null && Object.prototype.hasOwnProperty.call(saved, 'code'),
      })
      if (ownSaved == null) recordCarryFallback(carried.fallback)
      const starter = serializeCircuit(getStarterStage(task)?.stage?.circuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT)
      setCode(carryId != null ? (ownSaved ?? carried.saved?.code ?? starter) : (ownSaved ?? starter))
      setFiles([])
      setActiveFile('')
      resetCheckFeedback()
    } else {
      const taskFiles = selectHtmlTaskFiles({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedFile: (sourceTaskId, filename) => persistence.readSavedFile(activeIdentity.anonymousId, sourceTaskId, filename),
        onCarryFallback: recordCarryFallback,
      })
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  // Exposed to StudentView for coordination (save before task change, navigation)
  function resetForTaskChange() {
    setOutput('')
    setRunStatus(null)
    resetCheckFeedback()
    setTargetedStageOffer(null)
    setTargetedPreviewStageIndex(null)
    targetedStageOfferMatchCountsRef.current = {}
    setSelectedAnswer('')
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

  // Register Firebase presence so the teacher sees who is connected live.
  // Also re-registers on reconnect (connected flips true) so the online key
  // is restored after a temporary network drop without a page refresh.
  useEffect(() => {
    if (teacherPresentation) return
    if (!connected) return
    if ((phase === 'lesson' || phase === 'sandbox') && identity?.anonymousId) {
      registerPresence(identity.anonymousId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, identity?.anonymousId, teacherPresentation, connected])

  // Track whether the student's browser window is focused so the teacher can
  // see "Away" when a student has switched tabs or minimised the window.
  useEffect(() => {
    if (teacherPresentation || !identity?.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    const id = identity.anonymousId
    const onFocus = () => writeStudentPresence?.(id, { windowFocused: true })
    const onBlur  = () => writeStudentPresence?.(id, { windowFocused: false })
    writeStudentPresence?.(id, { windowFocused: document.hasFocus() })
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, identity?.anonymousId, teacherPresentation])

  // Track mouse/keyboard activity so the teacher gets a WhatsApp-style
  // typing indicator. Throttled to one Firebase write per 2 seconds.
  useEffect(() => {
    if (teacherPresentation || !identity?.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    const id = identity.anonymousId
    let lastWrite = 0
    const record = () => {
      const now = Date.now()
      if (now - lastWrite < 2000) return
      lastWrite = now
      writeStudentPresence?.(id, { lastActivityAt: now })
    }
    window.addEventListener('mousemove', record)
    window.addEventListener('keydown', record)
    window.addEventListener('mousedown', record)
    return () => {
      window.removeEventListener('mousemove', record)
      window.removeEventListener('keydown', record)
      window.removeEventListener('mousedown', record)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, identity?.anonymousId, teacherPresentation])

  // Presentation windows must not appear as students
  useEffect(() => {
    if (!teacherPresentation || !identity?.anonymousId || !session?.students?.[identity.anonymousId]) return
    removeStudent(identity.anonymousId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, identity?.anonymousId, session?.students])

  // When teacher starts live-viewing this student, publish the current in-memory editor state
  useEffect(() => {
    if (teacherPresentation) return
    if (!identity?.anonymousId || session?.activeStudentView !== identity.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    if (!lesson || viewingTaskId !== null) return

    if (lesson.type === 'python' || lesson.type === 'arcade' || lesson.type === 'electronics') {
      writeStudentCode(identity.anonymousId, code)
      writeStudentOutput(identity.anonymousId, output)
    } else if (lesson.type === 'html') {
      writeStudentFiles(identity.anonymousId, Object.fromEntries(files.map(f => [f.name, f.content])))
    } else if (lesson.type === 'scratch') {
      const saved = loadSavedCode(lessonId, currentTaskId, identity.anonymousId)
      if (saved?.state) writeStudentCode(identity.anonymousId, JSON.stringify(saved.state))
    } else if (lesson.type === 'filesystem') {
      writeStudentCode(identity.anonymousId, JSON.stringify(fsStateRef.current))
    }
    writeStudentInteraction(identity.anonymousId, {
      selection: editorSelectionRef.current,
      activeFile: lesson.type === 'html' ? activeFile : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // React to sandbox code pushes (Python)
  useEffect(() => {
    if (phase !== 'sandbox' || !['python', 'arcade'].includes(lesson?.type) || !session?.sandboxCode) return
    setCode(session.sandboxCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox block pushes (Scratch)
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'scratch' || !session?.sandboxCode) return
    try {
      setScratchSandboxProject(JSON.parse(session.sandboxCode))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox filesystem pushes
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'filesystem' || !session?.sandboxCode) return
    try {
      setFsState(JSON.parse(session.sandboxCode))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox circuit pushes
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'electronics' || !session?.sandboxCode) return
    setCode(session.sandboxCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox files pushes (HTML)
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'html') return
    if (session?.sandboxFiles) {
      const decoded = Object.entries(session.sandboxFiles).map(([k, v]) => {
        const name = decodeFileKey(k)
        const type = name.endsWith('.html') ? 'html' : name.endsWith('.css') ? 'css' : 'js'
        return { name, content: v, type }
      })
      setFiles(decoded)
      if (decoded.length > 0) setActiveFile(decoded[0].name)
    } else if (lesson?.sandboxStarterFiles?.length > 0) {
      setFiles(lesson.sandboxStarterFiles)
      setActiveFile(lesson.sandboxStarterFiles[0].name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxFilesUpdatedAt])

  // React to teacher remotely resetting or completing this student's code
  useEffect(() => {
    if (!myStudentData?.remoteResetPushedAt || (phase !== 'lesson' && phase !== 'solo')) return
    const action = myStudentData.remoteResetAction
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task || !action) return

    const revealMatch = action.match(/^reveal_stage_(\d+)$/)
    if (revealMatch) {
      const stageIndex = parseInt(revealMatch[1], 10)
      const stage = task.codeStages?.[stageIndex]
      if (getStageRole(stage) === 'support') handleRevealSupportStage(stageIndex, 'teacher')
      else if (getStageRole(stage) === 'complete') setCompletePreviewShown(true)
      return
    }

    if (lesson.type === 'python' || lesson.type === 'arcade') {
      let target
      if (action === 'starter') target = getStarterStage(task)?.stage?.code ?? task.starterCode ?? ''
      else if (action === 'complete') target = task.completeCode ?? ''
      else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        target = stage?.code ?? getStarterStage(task)?.stage?.code ?? task.starterCode ?? ''
      }
      setCode(target)
      if (lesson.type === 'arcade') {
        const resetDesign = designForCodeTab(task, action)
        setArcadeDesign(resetDesign)
        persistence.savePythonCode(effectiveIdentity?.anonymousId, currentTaskId, { code: target, output: '', runStatus: null, arcadeDesign: resetDesign })
        if (identity?.anonymousId && sessionRef.current?.activeStudentView === identity.anonymousId) writeStudentArcadeDesign?.(identity.anonymousId, resetDesign)
      }
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'html') {
      let targetFiles, targetEntry
      if (action === 'starter') {
        const starter = getStarterStage(task)?.stage
        targetFiles = starter?.files ?? task.starterFiles ?? []
        targetEntry = starter?.entryFile ?? task.entryFile
      } else if (action === 'complete') {
        targetFiles = task.completeFiles ?? []
        targetEntry = task.completeEntryFile ?? task.entryFile
      } else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        const starter = getStarterStage(task)?.stage
        targetFiles = stage?.files ?? starter?.files ?? task.starterFiles ?? []
        targetEntry = stage?.entryFile ?? starter?.entryFile ?? task.entryFile
      }
      setFiles(targetFiles.map(f => ({ ...f })))
      setActiveFile(targetEntry ?? targetFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'scratch') {
      let targetBlocks
      if (action === 'starter') targetBlocks = getStarterStage(task)?.stage?.blocks ?? task.starterBlocks ?? null
      else if (action === 'complete') {
        targetBlocks = task.completeBlocks ?? null
        setScratchActiveStageIndex(null)
      }
      else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stageIndex = stageMatch ? parseInt(stageMatch[1], 10) : null
        const stage = stageIndex != null ? (task.codeStages ?? [])[stageIndex] : null
        targetBlocks = stage?.blocks ?? task.starterBlocks ?? null
        setScratchActiveStageIndex(stage ? stageIndex : null)
      }
      if (action === 'starter') setScratchActiveStageIndex(null)
      setScratchExternalState(targetBlocks)
    } else if (lesson.type === 'filesystem') {
      let targetFs
      if (action === 'complete') {
        targetFs = task.completeFs ?? task.starterFs ?? DEFAULT_FS
      } else if (action === 'starter') {
        targetFs = task.starterFs ?? DEFAULT_FS
      } else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        targetFs = stage?.fs ?? task.starterFs ?? DEFAULT_FS
      }
      setFsState(targetFs)
      resetCheckFeedback()
    } else if (lesson.type === 'electronics') {
      let targetCircuit
      if (action === 'complete') {
        targetCircuit = task.completeCircuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT
      } else if (action === 'starter') {
        targetCircuit = getStarterStage(task)?.stage?.circuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT
      } else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        targetCircuit = stage?.circuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT
      }
      setCode(serializeCircuit(targetCircuit))
      resetCheckFeedback()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // Apply teacher-committed work when teacher finishes a live edit.
  useEffect(() => {
    if (!myStudentData?.teacherEditAppliedAt) return
    const newCode = myStudentData?.teacherEditApplyCode
    const newFiles = myStudentData?.teacherEditApplyFiles
    const newArcadeDesign = myStudentData?.teacherEditApplyArcadeDesign
    if (lesson?.type === 'html' && newFiles) {
      const nextFiles = decodeSessionFiles(newFiles, decodeFileKey, 'html')
      setFiles(nextFiles)
      setActiveFile(current => nextFiles.some(file => file.name === current) ? current : (nextFiles[0]?.name ?? ''))
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
      if (effectiveIdentity?.anonymousId) {
        persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, nextFiles)
      }
    } else if (newCode !== undefined && (lesson?.type === 'python' || lesson?.type === 'arcade' || lesson?.type === 'electronics')) {
      setCode(newCode ?? '')
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
      const nextDesign = lesson?.type === 'arcade'
        ? (newArcadeDesign ? cloneArcadeDesign(newArcadeDesign) : arcadeDesignRef.current)
        : null
      if (lesson?.type === 'arcade') setArcadeDesign(nextDesign)
      if (effectiveIdentity?.anonymousId) {
        persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, {
          code: newCode ?? '', output: '', runStatus: null,
          ...(lesson?.type === 'arcade' ? { arcadeDesign: nextDesign } : {}),
        })
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
    if (lesson.type === 'python' || lesson.type === 'arcade') {
      const saved = loadPersonalSandboxCode(lessonId, id, sandboxModuleId)
      setCode(saved?.code ?? lesson.sandboxStarter ?? '')
      if (lesson.type === 'arcade') {
        setArcadeDesign(saved?.arcadeDesign ? cloneArcadeDesign(saved.arcadeDesign) : null)
      }
    } else if (lesson.type === 'html') {
      const starterFiles = lesson.sandboxStarterFiles ?? []
      const sandboxFiles = starterFiles.map(f => {
        const savedContent = loadPersonalSandboxFile(lessonId, f.name, id, sandboxModuleId)
        return { ...f, content: savedContent ?? f.content }
      })
      const withContent = sandboxFiles.length > 0 ? sandboxFiles : starterFiles.map(f => ({ ...f }))
      setFiles(withContent)
      setActiveFile(withContent[0]?.name ?? '')
    } else if (lesson.type === 'filesystem') {
      const savedFs = loadPersonalSandboxFs(lessonId, id, sandboxModuleId)
      setFsState(savedFs ?? lesson.sandboxStarterFs ?? DEFAULT_FS)
    } else if (lesson.type === 'electronics') {
      const saved = loadPersonalSandboxCode(lessonId, id, sandboxModuleId)
      setCode(saved?.code ?? serializeCircuit(lesson.sandboxStarterCircuit ?? DEFAULT_CIRCUIT))
    }
    setOutput('')
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
    const mod = getLessonModule(lesson?.type)
    const isWatched = session?.activeStudentView === actor.anonymousId
    const alreadySolved = isAlreadySolved()

    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setTestResults(null)
    if (!alreadySolved) resetRunFeedback()

    if (lesson.type === 'python' || lesson.type === 'electronics') {
      lastOutputWriteRef.current = 0
      if (outputRafIdRef.current !== null) { cancelAnimationFrame(outputRafIdRef.current); outputRafIdRef.current = null }
      let outputBuffer = createStudentOutputBuffer()
      const echoOutput = (text) => {
        const nextOutputBuffer = appendStudentOutput(outputBuffer, text)
        if (nextOutputBuffer === outputBuffer) return
        outputBuffer = nextOutputBuffer
        // Throttle React re-renders to one per animation frame (~60fps max).
        // outputBuffer is a closure var so the RAF always reads the latest value.
        if (outputRafIdRef.current === null) {
          outputRafIdRef.current = requestAnimationFrame(() => {
            outputRafIdRef.current = null
            setOutput(outputBuffer.display)
          })
        }
        // Debounce Firebase writes independently at 200ms
        const now = Date.now()
        if (now - lastOutputWriteRef.current >= 200) {
          lastOutputWriteRef.current = now
          if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ output: outputBuffer.raw }))
          if (isWatched) writeStudentOutput(actor.anonymousId, outputBuffer.raw)
        }
      }
      let latestRuntimeCode = code
      const flushRuntimeCodeUpdate = () => {
        if (runtimeCodeRafIdRef.current !== null) {
          cancelAnimationFrame(runtimeCodeRafIdRef.current)
          runtimeCodeRafIdRef.current = null
        }
        const pending = pendingRuntimeCodeRef.current
        pendingRuntimeCodeRef.current = null
        if (typeof pending !== 'string') return
        latestRuntimeCode = pending
        codeRef.current = pending
        setCode(pending)
        const now = Date.now()
        if (now - lastRuntimeCodeWriteRef.current >= 200) {
          lastRuntimeCodeWriteRef.current = now
          if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ code: pending }))
          if (isWatched) writeStudentCode(actor.anonymousId, pending)
        }
      }
      const scheduleRuntimeCodeUpdate = (nextCode) => {
        if (lesson.type !== 'electronics' || typeof nextCode !== 'string' || nextCode === latestRuntimeCode) return
        latestRuntimeCode = nextCode
        pendingRuntimeCodeRef.current = nextCode
        if (runtimeCodeRafIdRef.current !== null) return
        runtimeCodeRafIdRef.current = requestAnimationFrame(flushRuntimeCodeUpdate)
      }
      appendOutputRef.current = echoOutput
      const result = await mod.runtime.run(code, task, {
        onOutput: (text, _kind) => echoOutput(text),
        onInputRequired: (prompt) => setInputPrompt(prompt),
        onCodeUpdate: scheduleRuntimeCodeUpdate,
        getRuntimeCode: () => codeRef.current,
      })
      setInputPrompt(null)

      // Cancel any pending RAF and sync final output immediately
      if (outputRafIdRef.current !== null) { cancelAnimationFrame(outputRafIdRef.current); outputRafIdRef.current = null }

      if (result.status === 'stopped') {
        flushRuntimeCodeUpdate()
        setOutput(outputBuffer.display)
        if (lesson.type === 'electronics') persistence.savePythonCode(actor.anonymousId, currentTaskId, { code: latestRuntimeCode, output: outputBuffer.raw })
        if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ code: latestRuntimeCode, output: outputBuffer.raw }))
        if (isWatched) {
          writeStudentCode(actor.anonymousId, latestRuntimeCode)
          writeStudentOutput(actor.anonymousId, outputBuffer.raw)
        }
        setRunning(false)
        return
      }

      flushRuntimeCodeUpdate()
      setOutput(outputBuffer.display)
      const status = result.status
      setRunStatus(status)
      const nextCode = typeof result.updatedCode === 'string' ? result.updatedCode : latestRuntimeCode
      if (nextCode !== code) setCode(nextCode)

      const checkContext = { status, code: nextCode, variables: result.variables ?? {} }
      const hasTests = task?.tests?.length > 0
      let passed = alreadySolved ? true : (status === 'error' || hasTests ? false : evaluateCheckWithFeedback(task, outputBuffer.raw, checkContext).passed)
      let suggestion = ''
      if (!alreadySolved) {
        // Feedback checks can diagnose code even when Python could not run (for
        // example, `print(hello)` raises NameError). Keep completion failed on a
        // runtime error, but still evaluate the feedback checks and their stage
        // offers against the submitted code/output.
        const evaluation = (!hasTests && task?.check) ? evaluateCheckWithFeedback(task, outputBuffer.raw, checkContext, {
          completionPassed: status !== 'error' && evaluateCheck(task.check, outputBuffer.raw, checkContext),
        }) : null
        if (evaluation) {
          passed = evaluation.passed
          suggestion = evaluation.suggestion
          updateTargetedStageOffer(task, evaluation, passed)
        }
        if (!hasTests && task?.check) applyCheckFeedback(passed, suggestion)
        updateSupportStageForAttempt(status !== 'error' && (!task?.check || passed))
      }

      if (canPublishTeacherLive()) {
        publishTeacherLive({ code: nextCode, output: outputBuffer.raw, runStatus: status, checkPassed: passed, checkAttempted: !alreadySolved && !hasTests && !!task?.check, checkSuggestion: suggestion })
      }
      persistence.savePythonCode(actor.anonymousId, currentTaskId, { code: nextCode, output: outputBuffer.raw, runStatus: status })
      if (!teacherPresentation && (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        await writeStudentRun(actor.anonymousId, { code: nextCode, output: outputBuffer.raw, status, checkPassed: hasTests ? undefined : passed })
      }
      if (!teacherPresentation && phaseRef.current === 'lesson' && !alreadySolved && !hasTests && task?.check) {
        logAttempt(actor.anonymousId, currentTaskId, { submission: nextCode, passed, suggestion })
      }
      setRunning(false)
      return
    }

    // HTML — build iframe
    setHtmlPreviewCollapsed(false)
    const currentFiles = filesRef.current
    const src = mod.runtime.buildPreviewSrc(
      { files: currentFiles, entryFile: task?.entryFile ?? 'index.html' },
      task,
      { assets: lesson.assets ?? [], assetsPath: resolveAssetsPath(lesson.assetsPath), storageAssets: htmlIframeStorageAssets }
    )
    htmlSupportAttemptsRef.current.clear()
    htmlSupportAttemptsRef.current.set(src, { hasError: false, outcomeApplied: false, passed: false })
    setIframeSrc(src)
    setRunStatus('success')

    const taskIdAtRunTime = currentTaskIdRef.current
    mod.runtime.waitForPreviewText().then(text => {
      let passed, suggestion = ''
      if (!alreadySolved) {
        const codeStr = currentFiles.map(f => f.content).join('\n')
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
        publishTeacherLive({ runStatus: 'success', checkPassed: passed, checkAttempted: !alreadySolved && !!task?.check, checkSuggestion: suggestion, files: Object.fromEntries(currentFiles.map(f => [f.name, f.content])) })
      }
      if (!teacherPresentation && (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        if (taskIdAtRunTime === currentTaskIdRef.current) {
          const filesMap = Object.fromEntries(currentFiles.map(f => [f.name, f.content]))
          writeStudentRun(actor.anonymousId, { files: filesMap, status: 'success', checkPassed: passed })
        }
      }
      if (!teacherPresentation && phaseRef.current === 'lesson' && !alreadySolved && task?.check && taskIdAtRunTime === currentTaskIdRef.current) {
        const filesMap = Object.fromEntries(currentFiles.map(f => [f.name, f.content]))
        logAttempt(actor.anonymousId, taskIdAtRunTime, { submission: filesMap, passed, suggestion })
      }
      persistence.saveHtmlFiles(actor.anonymousId, taskIdAtRunTime, currentFiles)
      setRunning(false)
    })
  }

  function handleStop() {
    getLessonModule(lesson?.type)?.runtime?.stop()
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    getLessonModule(lesson?.type)?.runtime?.provideInput(value)
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
    setRunStatus(null)
    setTestResults(null)
    resetRunFeedback()

    const results = []
    const mod = getLessonModule(lesson?.type)
    try {
      await initRuntimeIfNeeded()

      for (const test of task.tests) {
        const inputQueue = (test.inputs ?? []).map(inp => inp.value ?? '')
        let accumulated = ''
        const result = await mod.runtime.run(code, task, {
          onOutput: text => { accumulated += text },
          onInputRequired: () => { mod.runtime.provideInput(inputQueue.shift() ?? '') },
        })
        const resolvedCheck = resolveTestCheck(test.check, test.inputs ?? [])
        const checks = normalizeChecks(resolvedCheck)
        const checkContext = { status: result.status, code, variables: result.variables ?? {} }
        const passed = result.status !== 'error' && checks.length > 0 && checks.every(c => evaluateSingleCheck(c, accumulated, checkContext))
        results.push({ id: test.id, name: test.name || `Test ${results.length + 1}`, passed, output: accumulated, status: result.status })
        if (result.status === 'stopped') break
      }

      const allPassed = results.length > 0 && results.every(r => r.passed)
      const finalStatus = results.some(r => r.status === 'error')
        ? 'error'
        : results.some(r => r.status === 'stopped') ? 'stopped' : 'success'
      const displayedOutput = results.find(r => !r.passed)?.output ?? results[results.length - 1]?.output ?? ''
      setTestResults(results)
      setOutput(displayedOutput)
      setRunStatus(finalStatus)
      if (finalStatus !== 'stopped') applyCheckFeedback(allPassed)
      if (finalStatus !== 'stopped') updateSupportStageForAttempt(allPassed)

      if (canPublishTeacherLive()) {
        publishTeacherLive({ output: displayedOutput, runStatus: finalStatus, checkPassed: allPassed, checkAttempted: true })
      }
      persistence.savePythonCode(actor.anonymousId, currentTaskId, { code, output: displayedOutput, runStatus: finalStatus })
      if (!teacherPresentation && (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        await writeStudentRun(actor.anonymousId, { code, output: displayedOutput, status: finalStatus, checkPassed: allPassed })
      }
      if (!teacherPresentation && phaseRef.current === 'lesson' && finalStatus !== 'stopped') {
        const failedTestNames = results.filter(r => !r.passed).map(r => r.name).join(', ')
        logAttempt(actor.anonymousId, currentTaskId, { submission: code, passed: allPassed, suggestion: failedTestNames })
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

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (canPublishTeacherLive()) publishTeacherLive({ code: newCode })
    if (effectiveIdentity && (lesson?.type === 'python' || lesson?.type === 'arcade' || lesson?.type === 'electronics')) {
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: newCode, output, runStatus, ...(lesson?.type === 'arcade' ? { arcadeDesign: arcadeDesignRef.current } : {}) })
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, newCode)
    }
    if (lesson?.type === 'python' || lesson?.type === 'arcade' || lesson?.type === 'electronics') {
      scheduleIdleFeedback(() => (
        lessonRef.current?.type === 'electronics'
          ? { code: newCode, circuit: newCode }
          : { code: newCode, status: runStatusRef.current }
      ))
    }
  }

  function handleArcadeDesignChange(nextDesign) {
    const next = cloneArcadeDesign(nextDesign)
    setArcadeDesign(next)
    if (effectiveIdentity && lesson?.type === 'arcade') {
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: codeRef.current, output: outputRef.current, runStatus: runStatusRef.current, arcadeDesign: next })
    }
    if (canPublishTeacherLive()) publishTeacherLive({ arcadeDesign: next })
    if (!teacherPresentation && identity && session?.activeStudentView === identity.anonymousId) {
      if (arcadeDesignWriteTimerRef.current !== null) clearTimeout(arcadeDesignWriteTimerRef.current)
      arcadeDesignWriteTimerRef.current = setTimeout(() => {
        writeStudentArcadeDesign?.(identity.anonymousId, next)
        arcadeDesignWriteTimerRef.current = null
      }, 600)
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
    const nextFiles = filesRef.current.map(f => f.name === filename ? { ...f, content } : f)
    setFiles(nextFiles)
    if (canPublishTeacherLive()) {
      publishTeacherLive({ files: Object.fromEntries(nextFiles.map(f => [f.name, f.content])), activeFile: filename })
    }
    if (effectiveIdentity && lesson?.type === 'html') {
      persistence.saveHtmlFile(effectiveIdentity.anonymousId, currentTaskId, filename, content)
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      const filesMap = Object.fromEntries(
        filesRef.current.map(f => [f.name, f.name === filename ? content : f.content])
      )
      writeStudentFiles(identity.anonymousId, filesMap)
    }
    if (lesson?.type === 'html') {
      scheduleIdleFeedback(() => ({
        code: nextFiles.map(f => f.content).join('\n'),
        output: outputRef.current,
        iframeDoc: iframeRef.current?.contentDocument ?? null,
      }), { feedbackFilter: checkAllowedForSubmit })
    }
  }

  function handleScratchChange(workspaceStates) {
    if (canPublishTeacherLive()) publishTeacherLive({ code: JSON.stringify(workspaceStates) })
    if (!effectiveIdentity) return
    persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, workspaceStates)
    if (identity && activeStudentViewRef.current === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, JSON.stringify(workspaceStates))
    }
  }

  function handleScratchCheck(passed, snapshot) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const alreadySolved = isAlreadySolved()
    const effectivePassed = alreadySolved ? true : passed
    const checks = Array.isArray(task?.check) ? task.check : task?.check ? [task.check] : []
    const suggestion = effectivePassed ? '' : (String(snapshot?.suggestion ?? '').trim() || String(checks.find(c => c?.hint)?.hint ?? '').trim())
    if (!alreadySolved && task?.check) applyCheckFeedback(passed, suggestion)
    if (!identity || lesson?.type !== 'scratch') return
    if (phase === 'lesson' || phase === 'sandbox' || activeStudentViewRef.current === identity.anonymousId) {
      const states = snapshot?.workspaceStates ?? loadSavedCode(lessonId, currentTaskId, identity.anonymousId)?.state ?? null
      writeStudentRun(identity.anonymousId, {
        code: states ? JSON.stringify(states) : undefined,
        output: snapshot?.spriteStates ? JSON.stringify(snapshot.spriteStates) : undefined,
        status: 'success',
        checkPassed: effectivePassed,
      })
      if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
        logAttempt(identity.anonymousId, currentTaskId, { submission: states, passed, suggestion })
      }
    }
  }

  // ─── Filesystem handlers ───────────────────────────────────────────────────

  function applyFsCheckAndPublish(context, { suppressFailFeedback = false } = {}) {
    const alreadySolved = isAlreadySolved()
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const completionPassed = task?.check ? evaluateCheck(task.check, null, context) : false
    const evaluation = task?.check
      ? evaluateCheckWithFeedback(task, '', context, { completionPassed, feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT })
      : { passed: false, suggestion: '' }
    const evaluatedPassed = evaluation.passed
    const passed = alreadySolved ? true : evaluatedPassed
    const suggestion = passed ? '' : evaluation.suggestion
    if (!alreadySolved && task?.check && (evaluatedPassed || !suppressFailFeedback)) {
      applyCheckFeedback(evaluatedPassed, suggestion)
      updateTargetedStageOffer(task, evaluation, evaluatedPassed)
    }
    if (!teacherPresentation && phase === 'lesson' && !inPersonalSandboxRef.current && effectiveIdentity?.anonymousId) {
      writeStudentRun(effectiveIdentity.anonymousId, {
        code: JSON.stringify(context.fs),
        status: task?.check ? (evaluatedPassed ? 'success' : 'error') : null,
        checkPassed: evaluatedPassed,
      })
      if (!alreadySolved && task?.check) {
        logAttempt(effectiveIdentity.anonymousId, currentTaskId, { submission: context.fs, passed: evaluatedPassed, suggestion })
      }
    }
  }

  function handleFsChange(newFs) {
    setFsState(newFs)
    persistence.saveFs(effectiveIdentity?.anonymousId, currentTaskId, newFs)
    applyFsCheckAndPublish({ fs: newFs, ...fsInteractionRef.current })
    scheduleIdleFeedback(() => ({ fs: fsStateRef.current, ...fsInteractionRef.current }))
  }

  const handleFsInteraction = useCallback((interaction) => {
    setFsInteraction(interaction)
    applyFsCheckAndPublish({ fs: fsStateRef.current, ...interaction }, { suppressFailFeedback: true })
    scheduleIdleFeedback(() => ({ fs: fsStateRef.current, ...interaction }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, currentTaskId, teacherPresentation, phase, effectiveIdentity])

  // ─── Reset/Complete code ───────────────────────────────────────────────────

  function handleResetCode() {
    if (inPersonalSandboxRef.current) {
      if (!window.confirm('Reset sandbox to the starter code? Your sandbox work will be lost.')) return
      if (lesson.type === 'python' || lesson.type === 'arcade') {
        setCode(lesson.sandboxStarter ?? '')
        if (lesson.type === 'arcade') setArcadeDesign(null)
        setOutput('')
        setRunStatus(null)
      } else if (lesson.type === 'html') {
        const starterFiles = (lesson.sandboxStarterFiles ?? []).map(f => ({ ...f }))
        setFiles(starterFiles)
        setActiveFile(starterFiles[0]?.name ?? '')
        setIframeSrc(null)
        setRunStatus(null)
      } else if (lesson.type === 'filesystem') {
        setFsState(lesson.sandboxStarterFs ?? DEFAULT_FS)
        resetCheckFeedback()
      } else if (lesson.type === 'electronics') {
        setCode(serializeCircuit(lesson.sandboxStarterCircuit ?? DEFAULT_CIRCUIT))
        setOutput('')
        setRunStatus(null)
        resetCheckFeedback()
      }
      return
    }
    if (!window.confirm('Reset your code to the starter code? Your current work will be lost.')) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (lesson.type === 'python' || lesson.type === 'arcade') {
      setCode(getStarterStage(task)?.stage?.code ?? task?.starterCode ?? '')
      if (lesson.type === 'arcade') handleArcadeDesignChange(designForCodeTab(task, 'starter'))
      if (canPublishTeacherLive()) publishTeacherLive({ code: getStarterStage(task)?.stage?.code ?? task?.starterCode ?? '', output: '', runStatus: null, checkPassed: false, checkAttempted: false })
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'html') {
      const taskFiles = (getStarterStage(task)?.stage?.files ?? task?.starterFiles ?? []).map(f => ({ ...f }))
      setFiles(taskFiles)
      if (canPublishTeacherLive()) publishTeacherLive({ files: Object.fromEntries(taskFiles.map(f => [f.name, f.content])), output: '', runStatus: null, checkPassed: false, checkAttempted: false })
      setActiveFile(task?.entryFile ?? taskFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'scratch') {
      setScratchExternalState(task?.starterBlocks ?? null)
      setScratchActiveStageIndex(null)
    } else if (lesson.type === 'electronics') {
      const starter = serializeCircuit(getStarterStage(task)?.stage?.circuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
      setCode(starter)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: starter })
      resetCheckFeedback()
    }
  }

  function handleShowCodeStage(stageIndex) {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return
    const stage = task.codeStages?.[stageIndex]
    if (!stage) return

    if (lesson.type === 'python' || lesson.type === 'arcade') {
      const stageCode = stage.code ?? ''
      setCode(stageCode)
      if (lesson.type === 'arcade') setArcadeDesign(designForCodeTab(task, `stage_${stageIndex}`))
      setOutput('')
      setRunStatus(null)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: stageCode, output: '', runStatus: null, ...(lesson.type === 'arcade' ? { arcadeDesign: designForCodeTab(task, `stage_${stageIndex}`) } : {}) })
    } else if (lesson.type === 'html') {
      const stageFiles = (stage.files ?? []).map(f => ({ ...f }))
      setFiles(stageFiles)
      setActiveFile(stage.entryFile ?? task.entryFile ?? stageFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, stageFiles)
    } else if (lesson.type === 'scratch') {
      const stageBlocks = stage.blocks ?? null
      setScratchExternalState(stageBlocks)
      setScratchActiveStageIndex(stageIndex)
      if (stageBlocks) persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, stageBlocks)
    } else if (lesson.type === 'filesystem') {
      const stageFs = stage.fs ?? DEFAULT_FS
      setFsState(stageFs)
      persistence.saveFs(effectiveIdentity.anonymousId, currentTaskId, stageFs)
    } else if (lesson.type === 'electronics') {
      const stageCircuit = serializeCircuit(stage.circuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT)
      setCode(stageCircuit)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: stageCircuit })
    }
    setOfferedStageIndex(stageIndex)
  }

  function handleRevealSupportStage(stageIndex, source = 'student', attemptNumber = checkFailCount) {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const stage = task?.codeStages?.[stageIndex]
    if (!stage) return
      if (!['python', 'html', 'arcade', 'electronics', 'scratch'].includes(lesson?.type)) return
    if (!isRevealableStage(stage)) return

    const record = {
      taskId: currentTaskId,
      stageIndex,
      stageLabel: stage.label || `Stage ${stageIndex + 1}`,
      source,
      attemptNumber,
      revealedAt: Date.now(),
    }
    setLocalSupportStageReveals(prev => ({
      ...prev,
      [currentTaskId]: {
        ...(prev[currentTaskId] ?? {}),
        [stageIndex]: record,
      },
    }))
    setOfferedStageIndex(prev => Math.max(prev, stageIndex))
    setSupportStageVisibility(prev => ({ ...prev, [currentTaskId]: stageIndex }))
    setSupportStageOffers(prev => ({ ...prev, [currentTaskId]: null }))
    markStagePromptAccepted()
    if (!teacherPresentation && phase === 'lesson') {
      recordSupportStageReveal?.(effectiveIdentity.anonymousId, currentTaskId, stageIndex, {
        source,
        stageLabel: record.stageLabel,
        attemptNumber: record.attemptNumber,
      })
    }
  }

  function handleHtmlRuntimeError(src) {
    const supportAttempt = htmlSupportAttemptsRef.current.get(src)
    if (!supportAttempt) return
    supportAttempt.hasError = true
    if (supportAttempt.outcomeApplied && supportAttempt.passed) {
      supportAttempt.passed = false
      updateSupportStageForAttempt(false)
    }
  }

  function updateSupportStageForAttempt(passed) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task || teacherPresentation || inPersonalSandboxRef.current || !['lesson', 'solo'].includes(phaseRef.current)) return
    if (!['python', 'html'].includes(lesson?.type)) return

    if (passed) {
      setSupportStageVisibility(prev => ({ ...prev, [currentTaskId]: null }))
      setSupportStageOffers(prev => ({ ...prev, [currentTaskId]: null }))
      return
    }

    // Keep the existing offer available until the student either uses it or
    // succeeds. Repeated failures must not skip over an unused reference.
    if (offeredSupportStageIndex != null) return

    const nextStage = getNextRevealableStage(task, Object.keys(supportStageReveals))
    if (nextStage) {
      setSupportStageOffers(prev => ({ ...prev, [currentTaskId]: nextStage.index }))
      return
    }

    const latestStage = getRevealableStages(task)
      .map(({ index }) => index)
      .filter(index => Object.prototype.hasOwnProperty.call(supportStageReveals, index))
      .at(-1)
    if (latestStage != null) {
      setSupportStageVisibility(prev => ({ ...prev, [currentTaskId]: latestStage }))
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

    if (lesson.type === 'python' || lesson.type === 'arcade') {
      const completeCode = getCompleteStage(task)?.stage?.code ?? task.completeCode ?? ''
      setCode(completeCode)
      setOutput('')
      setRunStatus(null)
      applyCheckFeedback(true)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: completeCode, output: '', runStatus: null })
    } else if (lesson.type === 'html') {
      const completeStage = getCompleteStage(task)?.stage
      const completeFiles = (completeStage?.files ?? task.completeFiles ?? []).map(f => ({ ...f }))
      setFiles(completeFiles)
      setActiveFile(completeStage?.entryFile ?? task.completeEntryFile ?? task.entryFile ?? completeFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      applyCheckFeedback(true)
      persistence.saveHtmlFiles(effectiveIdentity.anonymousId, currentTaskId, completeFiles)
    } else if (lesson.type === 'scratch') {
      const completeBlocks = task.completeBlocks ?? null
      setScratchExternalState(completeBlocks)
      setScratchActiveStageIndex(null)
      applyCheckFeedback(true)
      if (completeBlocks) persistence.saveScratch(effectiveIdentity.anonymousId, currentTaskId, completeBlocks)
    } else if (lesson.type === 'filesystem') {
      const completeFs = task.completeFs ?? DEFAULT_FS
      setFsState(completeFs)
      applyCheckFeedback(true)
      persistence.saveFs(effectiveIdentity.anonymousId, currentTaskId, completeFs)
    } else if (lesson.type === 'electronics') {
      const completeCircuit = serializeCircuit(task.completeCircuit ?? task.starterCircuit ?? DEFAULT_CIRCUIT)
      setCode(completeCircuit)
      applyCheckFeedback(true)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: completeCircuit })
    }
  }

  // ─── Submit (HTML submit-mode / quiz) ──────────────────────────────────────

  async function handleSubmit() {
    const actor = effectiveIdentity
    if (!actor) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const isHtml = lesson?.type === 'html'
    const alreadySolved = isAlreadySolved()
    let passed, suggestion = ''
    if (!alreadySolved) {
      const codeForCheck = isHtml ? files.map(f => f.content).join('\n') : code
      const checkContext = lesson?.type === 'electronics' ? { code: codeForCheck, circuit: codeForCheck } : { code: codeForCheck }
      const completionPassed = task?.check ? evaluateCheckWithCode(task.check, codeForCheck, checkContext) : false
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
        files: isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : undefined,
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
      persistence.savePythonCode(actor.anonymousId, currentTaskId, { code, output: '', runStatus: 'submitted' })
    }
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      const filesMap = isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : undefined
      await writeStudentRun(actor.anonymousId, { code: isHtml ? undefined : code, files: filesMap, output: isHtml ? undefined : '', status: 'submitted', checkPassed: passed })
    }
    if (!teacherPresentation && phase === 'lesson' && !alreadySolved && task?.check) {
      const submission = isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : code
      logAttempt(actor.anonymousId, currentTaskId, { submission, passed, suggestion })
    }
  }

  async function handleQuizSelect(answer, passedOverride) {
    const actor = effectiveIdentity
    if (!actor) return
    const serializedAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer)

    if (passedOverride === null) {
      setSelectedAnswer(answer)
      if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
        clearTimeout(writeAnswerDebounceRef.current)
        writeAnswerDebounceRef.current = setTimeout(() => {
          writeStudentAnswer?.(actor.anonymousId, serializedAnswer)
        }, 300)
      }
      return
    }

    const task = findTaskById(lesson?.tasks, currentTaskId)
    const passed =
      typeof passedOverride === 'boolean'
        ? passedOverride
        : task?.check
          ? evaluateCheck(task.check, answer, { answer: typeof answer === 'string' ? answer : '' })
          : task?.quizType === 'short_answer'
            ? !!(typeof answer === 'string' ? answer.trim() : false)
            : false
    const suggestion = passed ? '' : getQuizSuggestion(task, answer)

    setSelectedAnswer(answer)
    applyCheckFeedback(passed, suggestion)
    setRunStatus('submitted')
    if (canPublishTeacherLive()) {
      publishTeacherLive({ answer: serializedAnswer, runStatus: 'submitted', checkPassed: passed, checkAttempted: true, checkSuggestion: suggestion })
    }
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      await writeStudentRun(actor.anonymousId, {
        answer: serializedAnswer,
        status: 'submitted',
        checkPassed: passed,
      })
    }
    if (!teacherPresentation && phase === 'lesson') {
      logAttempt(actor.anonymousId, currentTaskId, { submission: buildQuizSubmission(task, answer), passed, suggestion })
    }
  }

  return {
    // State
    code, arcadeDesign, files, activeFile, output, runStatus, running, runningTests, testResults,
    pyodideStatus, iframeSrc, teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed,
    inputPrompt, checkPassed, checkAttempted, checkSuggestion, repeatedSuggestionCount, checkFailCount, stagePromptAccepted,
    offeredStageIndex, completePreviewShown, supportStageReveals, activeSupportStageIndex, offeredSupportStageIndex, targetedStageOffer, targetedPreviewStageIndex,
    selectedAnswer, scratchSandboxProject, scratchExternalState, scratchActiveStageIndex,
    fsState, fsInteraction, editorSelection, editorActivity, inPersonalSandbox,
    teacherHighlights, dismissHighlight,
    // Refs
    iframeRef,
    // Event handlers
    handleRun, handleStop, handleRunTests, handleSubmit, handleQuizSelect,
    handleCodeChange, handleArcadeDesignChange, handleFileChange, handleFileTabChange,
    handleEditorSelection, handleEditorActivity,
    handleScratchChange, handleScratchCheck,
    handleFsChange, handleFsInteraction,
    handleInputSubmit, handleHtmlRuntimeError, handleResetCode, handleShowCodeStage, handleRevealSupportStage, handleRevealOfferedSupportStage, handlePreviewTargetedStage, handleAcceptTargetedStage, handleAcceptGenericNextStage, handlePreviewCompleteCode, handleShowCompleteCode,
    handleEnterPersonalSandbox, handleLeavePersonalSandbox,
    // Mode-aware task-save readers (localStorage normally, in-memory in presentation/preview)
    readSavedTaskCode: taskId => effectiveIdentity ? persistence.readSavedCode(effectiveIdentity.anonymousId, taskId) : null,
    readSavedTaskFile: (taskId, filename) => effectiveIdentity ? persistence.readSavedFile(effectiveIdentity.anonymousId, taskId, filename) : null,
    readSavedTaskFs: taskId => effectiveIdentity ? persistence.readSavedFs(effectiveIdentity.anonymousId, taskId) : null,
    recordCarryFallback,
    // Coordination helpers (called by StudentView)
    saveCurrentWork: saveCurrentWorkSnapshot,
    resetForTaskChange,
    exitPersonalSandbox,
    currentTeacherLivePayload,
    canPublishTeacherLive,
    publishTeacherLive,
    updateTeacherLiveFn: updateTeacherLive,
    setTeacherLiveFn: setTeacherLive,
  }
}
