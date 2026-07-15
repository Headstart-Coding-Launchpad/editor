import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { evaluateCheck, evaluateCheckWithCode, getFirstFailedCheckHint, getIncorrectCheckHint, normalizeChecks, evaluateSingleCheck, resolveTestCheck } from '../../modules/checks'
import { flattenTasks, findTaskById } from '../../shared/taskUtils'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS, normaliseDirPath } from '../../modules/filesystem/filesystem'
import { DEFAULT_CIRCUIT, serializeCircuit } from '../../modules/electronics/circuit'
import { decodeFileKey } from '../../shared/fileKeys'
import { loadSavedCode, loadPersonalSandboxCode, savePersonalSandboxCode, loadPersonalSandboxFile, savePersonalSandboxFile, loadPersonalSandboxFs, savePersonalSandboxFs, clearEphemeralStorage } from '../studentStorage'
import { selectHtmlTaskFiles, selectPythonTaskCode } from '../studentTaskContent'
import { parseScratchState } from '../../shared/workspaceData'
import { getQuizSuggestion } from '../studentQuizContent'
import { useCheckFeedback } from './useCheckFeedback'
import { createStudentPersistence } from './createStudentPersistence'
import { useTeacherLivePublish } from './useTeacherLivePublish'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { getLessonModule } from '../../modules/registry'

/**
 * Owns all student editor/code workspace state: code, files, output, checks, personal sandbox,
 * Pyodide lifecycle, iframe, run handlers, and localStorage persistence.
 *
 * Receives currentTaskId, viewingTaskId, phase, and session write callbacks from the caller.
 */
function collapseForDisplay(str, maxLines) {
  const lines = str.split('\n')
  if (lines.length <= maxLines) return str
  const hidden = lines.length - maxLines
  return `[${hidden} earlier lines hidden]\n` + lines.slice(-maxLines).join('\n')
}

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
  writeStudentFiles,
  writeStudentOutput,
  writeStudentInteraction,
  writeStudentPersonalSandbox,
  writeStudentPresence,
  registerPresence,
  removeStudent,
  updateTeacherLive,
  setTeacherLive,
  removeTeacherHighlight,
}) {
  const [code, setCode]                   = useState('')
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

  const iframeRef              = useRef(null)
  const appendOutputRef        = useRef(null)
  const writeAnswerDebounceRef = useRef(null)
  const lastOutputWriteRef     = useRef(0)
  const lastRuntimeCodeWriteRef = useRef(0)
  const outputCapReachedRef    = useRef(false)
  const outputRafIdRef         = useRef(null)
  const runtimeCodeRafIdRef    = useRef(null)
  const pendingRuntimeCodeRef  = useRef(null)

  const MAX_STREAMED_OUTPUT = 20_000
  const MAX_DISPLAY_LINES   = 100

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

  const { typeStorageAssets: htmlTypeAssets } = useTypeAssets(lesson?.type === 'html' ? 'html' : null)
  const htmlSharedAssetNames = lesson?.sharedAssetNames ?? null
  const htmlIncludedTypeAssets = htmlSharedAssetNames !== null
    ? htmlTypeAssets.filter(a => htmlSharedAssetNames.includes(a.name))
    : htmlTypeAssets
  const htmlIframeStorageAssets = [
    ...(lesson?.storageAssets ?? []).filter(a => a.showInEditor),
    ...htmlIncludedTypeAssets.filter(a => !(lesson?.storageAssets ?? []).some(b => b.name === a.name)),
  ]

  const myStudentData = session?.students?.[identity?.anonymousId]

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
    resetRunFeedback, resetCheckFeedback, applyCheckFeedback,
  } = useCheckFeedback({ myStudentData })

  const persistence = createStudentPersistence({ lessonId, teacherPresentation, previewMode, inPersonalSandboxRef })

  const { teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed, canPublishTeacherLive, currentTeacherLivePayload, publishTeacherLive } = useTeacherLivePublish({
    teacherPresentation,
    identityRef, sessionRef, lessonRef, currentTaskIdRef,
    codeRef, filesRef, activeFileRef, outputRef, runStatusRef, fsStateRef,
    editorSelectionRef, editorActivityRef,
    lesson, session, identity, currentTaskId,
    code, files, activeFile, output, runStatus,
    checkPassed, checkAttempted, checkSuggestion, fsState,
    iframeStorageAssets: htmlIframeStorageAssets,
    updateTeacherLive,
  })

  const isAlreadySolved = () => checkPassedRef.current && !inPersonalSandboxRef.current

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
    if (!id || teacherPresentation || !lessonRef.current) return
    if (lessonRef.current.type === 'python') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current })
    } else if (lessonRef.current.type === 'html') {
      filesRef.current.forEach(f => savePersonalSandboxFile(lessonId, f.name, id.anonymousId, f.content))
    } else if (lessonRef.current.type === 'filesystem') {
      savePersonalSandboxFs(lessonId, id.anonymousId, fsStateRef.current)
    } else if (lessonRef.current.type === 'electronics') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current })
    }
    // Scratch: saves incrementally via handleScratchChange
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
      }))
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
      setScratchActiveStageIndex(null)
    } else if (lesson.type === 'filesystem') {
      const carryId = task.carryFsFrom ?? null
      const ownSaved = persistence.readSavedFs(activeIdentity.anonymousId, taskId)
      const savedFromCarry = carryId != null ? persistence.readSavedFs(activeIdentity.anonymousId, carryId) : null
      let carryFallback = null
      if (carryId != null) {
        let resolveId = carryId
        while (resolveId != null) {
          const resolveTask = findTaskById(lesson.tasks, resolveId)
          if (!resolveTask) break
          const fs = resolveTask.completeFs ?? resolveTask.starterFs
          if (fs) { carryFallback = fs; break }
          resolveId = resolveTask.carryFsFrom ?? null
        }
      }
      const initialFs = carryId != null
        ? (ownSaved ?? savedFromCarry ?? carryFallback ?? task.starterFs ?? DEFAULT_FS)
        : (ownSaved ?? task.starterFs ?? DEFAULT_FS)
      setFsState(initialFs)
      const defaultDir = task.startsInDir ? normaliseDirPath(task.startsInDir) : '/'
      setFsInteraction({ currentDir: carryId ? (fsInteractionRef.current?.currentDir ?? defaultDir) : defaultDir, openFile: null })
      resetCheckFeedback()
    } else if (lesson.type === 'electronics') {
      const carryId = task.carryCircuitFrom ?? null
      const ownSaved = persistence.readSavedCode(activeIdentity.anonymousId, taskId)?.code ?? null
      const savedFromCarry = carryId != null ? persistence.readSavedCode(activeIdentity.anonymousId, carryId)?.code : null
      let carryFallback = null
      if (carryId != null) {
        const sourceTask = findTaskById(lesson.tasks, carryId)
        const circuit = sourceTask?.completeCircuit ?? sourceTask?.starterCircuit
        if (circuit) carryFallback = serializeCircuit(circuit)
      }
      const starter = serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT)
      setCode(carryId != null ? (ownSaved ?? savedFromCarry ?? carryFallback ?? starter) : (ownSaved ?? starter))
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
    setSelectedAnswer('')
    setIframeSrc(null)
    // Clear any pushed scratch state (reset/stage/solution/teacher edit) so it
    // can't overwrite the next task's initial blocks after the workspace remounts.
    setScratchExternalState(null)
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

    if (lesson.type === 'python' || lesson.type === 'electronics') {
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
    if (phase !== 'sandbox' || lesson?.type !== 'python' || !session?.sandboxCode) return
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

    if (lesson.type === 'python') {
      let target
      if (action === 'starter') target = task.starterCode ?? ''
      else if (action === 'complete') target = task.completeCode ?? ''
      else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        target = stage?.code ?? task.starterCode ?? ''
      }
      setCode(target)
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'html') {
      let targetFiles, targetEntry
      if (action === 'starter') {
        targetFiles = task.starterFiles ?? []
        targetEntry = task.entryFile
      } else if (action === 'complete') {
        targetFiles = task.completeFiles ?? []
        targetEntry = task.completeEntryFile ?? task.entryFile
      } else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        targetFiles = stage?.files ?? task.starterFiles ?? []
        targetEntry = stage?.entryFile ?? task.entryFile
      }
      setFiles(targetFiles.map(f => ({ ...f })))
      setActiveFile(targetEntry ?? targetFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'scratch') {
      let targetBlocks
      if (action === 'starter') targetBlocks = task.starterBlocks ?? null
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
        targetCircuit = task.starterCircuit ?? DEFAULT_CIRCUIT
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

  // Apply teacher-committed code when teacher finishes a live edit
  useEffect(() => {
    if (!myStudentData?.teacherEditAppliedAt) return
    const newCode = myStudentData?.teacherEditApplyCode
    if (newCode === undefined) return
    if (lesson?.type === 'python' || lesson?.type === 'electronics') {
      setCode(newCode ?? '')
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
      if (effectiveIdentity?.anonymousId) {
        persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: newCode ?? '', output: '', runStatus: null })
      }
    } else if (lesson?.type === 'scratch') {
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
    if (lesson.type === 'python') {
      const saved = loadPersonalSandboxCode(lessonId, id)
      setCode(saved?.code ?? lesson.sandboxStarter ?? '')
    } else if (lesson.type === 'html') {
      const starterFiles = lesson.sandboxStarterFiles ?? []
      const sandboxFiles = starterFiles.map(f => {
        const savedContent = loadPersonalSandboxFile(lessonId, f.name, id)
        return { ...f, content: savedContent ?? f.content }
      })
      const withContent = sandboxFiles.length > 0 ? sandboxFiles : starterFiles.map(f => ({ ...f }))
      setFiles(withContent)
      setActiveFile(withContent[0]?.name ?? '')
    } else if (lesson.type === 'filesystem') {
      const savedFs = loadPersonalSandboxFs(lessonId, id)
      setFsState(savedFs ?? lesson.sandboxStarterFs ?? DEFAULT_FS)
    } else if (lesson.type === 'electronics') {
      const saved = loadPersonalSandboxCode(lessonId, id)
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
      outputCapReachedRef.current = false
      if (outputRafIdRef.current !== null) { cancelAnimationFrame(outputRafIdRef.current); outputRafIdRef.current = null }
      let accumulated = ''
      const echoOutput = (text) => {
        if (outputCapReachedRef.current) return
        accumulated += text
        if (accumulated.length > MAX_STREAMED_OUTPUT) {
          accumulated = accumulated.slice(0, MAX_STREAMED_OUTPUT) + '\n[Output truncated — stop the program to continue]'
          outputCapReachedRef.current = true
        }
        // Throttle React re-renders to one per animation frame (~60fps max).
        // accumulated is a closure var so the RAF always reads the latest value.
        if (outputRafIdRef.current === null) {
          outputRafIdRef.current = requestAnimationFrame(() => {
            outputRafIdRef.current = null
            setOutput(collapseForDisplay(accumulated, MAX_DISPLAY_LINES))
          })
        }
        // Debounce Firebase writes independently at 200ms
        const now = Date.now()
        if (now - lastOutputWriteRef.current >= 200) {
          lastOutputWriteRef.current = now
          if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ output: accumulated }))
          if (isWatched) writeStudentOutput(actor.anonymousId, accumulated)
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
        setOutput(collapseForDisplay(accumulated, MAX_DISPLAY_LINES))
        if (lesson.type === 'electronics') persistence.savePythonCode(actor.anonymousId, currentTaskId, { code: latestRuntimeCode, output: accumulated })
        if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ code: latestRuntimeCode, output: accumulated }))
        if (isWatched) {
          writeStudentCode(actor.anonymousId, latestRuntimeCode)
          writeStudentOutput(actor.anonymousId, accumulated)
        }
        setRunning(false)
        return
      }

      flushRuntimeCodeUpdate()
      setOutput(collapseForDisplay(accumulated, MAX_DISPLAY_LINES))
      const status = result.status
      setRunStatus(status)
      const nextCode = typeof result.updatedCode === 'string' ? result.updatedCode : latestRuntimeCode
      if (nextCode !== code) setCode(nextCode)

      const checkContext = { status, code: nextCode, variables: result.variables ?? {} }
      const hasTests = task?.tests?.length > 0
      let passed = alreadySolved ? true : (status === 'error' || hasTests ? false : evaluateCheck(task?.check, accumulated, checkContext))
      let suggestion = ''
      if (!alreadySolved) {
        const incorrectHint = (!passed && !hasTests && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, accumulated, checkContext) : ''
        suggestion = (!hasTests && task?.check) ? (incorrectHint || getFirstFailedCheckHint(task.check, accumulated, checkContext)) : ''
        if (!hasTests && task?.check) applyCheckFeedback(passed, suggestion)
      }

      if (canPublishTeacherLive()) {
        publishTeacherLive({ code: nextCode, output: accumulated, runStatus: status, checkPassed: passed, checkAttempted: !alreadySolved && !hasTests && !!task?.check, checkSuggestion: suggestion })
      }
      persistence.savePythonCode(actor.anonymousId, currentTaskId, { code: nextCode, output: accumulated, runStatus: status })
      if (!teacherPresentation && (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        await writeStudentRun(actor.anonymousId, { code: nextCode, output: accumulated, status, checkPassed: hasTests ? undefined : passed })
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
    setIframeSrc(src)
    setRunStatus('success')

    const taskIdAtRunTime = currentTaskIdRef.current
    mod.runtime.waitForPreviewText().then(text => {
      let passed, suggestion = ''
      if (!alreadySolved) {
        const codeStr = currentFiles.map(f => f.content).join('\n')
        const iframeDoc = iframeRef.current?.contentDocument ?? null
        passed = evaluateCheck(task?.check, text, { code: codeStr, iframeDoc })
        const incorrectHint = (!passed && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, text, { code: codeStr, iframeDoc }) : ''
        suggestion = task?.check ? (incorrectHint || getFirstFailedCheckHint(task.check, text, { code: codeStr, iframeDoc })) : ''
        if (task?.check) applyCheckFeedback(passed, suggestion)
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
    } finally {
      setRunningTests(false)
    }
  }

  // ─── Editor change handlers ────────────────────────────────────────────────

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (canPublishTeacherLive()) publishTeacherLive({ code: newCode })
    if (effectiveIdentity && (lesson?.type === 'python' || lesson?.type === 'electronics')) {
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: newCode, output, runStatus })
    }
    if (identity && session?.activeStudentView === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, newCode)
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
    const suggestion = effectivePassed ? '' : String(checks.find(c => c?.hint)?.hint ?? '').trim()
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
    const evaluatedPassed = task?.check ? evaluateCheck(task.check, null, context) : false
    const passed = alreadySolved ? true : evaluatedPassed
    const suggestion = passed ? '' : (task?.check ? getFirstFailedCheckHint(task.check, null, context) : '')
    if (!alreadySolved && task?.check && (evaluatedPassed || !suppressFailFeedback)) applyCheckFeedback(evaluatedPassed, suggestion)
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
  }

  const handleFsInteraction = useCallback((interaction) => {
    setFsInteraction(interaction)
    applyFsCheckAndPublish({ fs: fsStateRef.current, ...interaction }, { suppressFailFeedback: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, currentTaskId, teacherPresentation, phase, effectiveIdentity])

  // ─── Reset/Complete code ───────────────────────────────────────────────────

  function handleResetCode() {
    if (inPersonalSandboxRef.current) {
      if (!window.confirm('Reset sandbox to the starter code? Your sandbox work will be lost.')) return
      if (lesson.type === 'python') {
        setCode(lesson.sandboxStarter ?? '')
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
    if (lesson.type === 'python') {
      setCode(task?.starterCode ?? '')
      if (canPublishTeacherLive()) publishTeacherLive({ code: task?.starterCode ?? '', output: '', runStatus: null, checkPassed: false, checkAttempted: false })
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
    } else if (lesson.type === 'html') {
      const taskFiles = (task?.starterFiles ?? []).map(f => ({ ...f }))
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
      const starter = serializeCircuit(task?.starterCircuit ?? DEFAULT_CIRCUIT)
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

    if (lesson.type === 'python') {
      const stageCode = stage.code ?? ''
      setCode(stageCode)
      setOutput('')
      setRunStatus(null)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: stageCode, output: '', runStatus: null })
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

  function handlePreviewCompleteCode() {
    // Non-destructive: reveals the complete solution read-only in the explainer
    // panel without touching the student's own editor or marking the task solved.
    setCompletePreviewShown(true)
  }

  function handleShowCompleteCode() {
    if (!effectiveIdentity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return

    if (lesson.type === 'python') {
      const completeCode = task.completeCode ?? ''
      setCode(completeCode)
      setOutput('')
      setRunStatus(null)
      applyCheckFeedback(true)
      persistence.savePythonCode(effectiveIdentity.anonymousId, currentTaskId, { code: completeCode, output: '', runStatus: null })
    } else if (lesson.type === 'html') {
      const completeFiles = (task.completeFiles ?? []).map(f => ({ ...f }))
      setFiles(completeFiles)
      setActiveFile(task.completeEntryFile ?? task.entryFile ?? completeFiles[0]?.name ?? '')
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
      passed = task?.check ? evaluateCheckWithCode(task.check, codeForCheck) : false
      const incorrectHint = (!passed && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, '', { code: codeForCheck }) : ''
      suggestion = task?.check ? (incorrectHint || getFirstFailedCheckHint(task.check, '', { code: codeForCheck })) : ''
      if (task?.check) applyCheckFeedback(passed, suggestion)
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
      logAttempt(actor.anonymousId, currentTaskId, { submission: serializedAnswer, passed, suggestion })
    }
  }

  return {
    // State
    code, files, activeFile, output, runStatus, running, runningTests, testResults,
    pyodideStatus, iframeSrc, teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed,
    inputPrompt, checkPassed, checkAttempted, checkSuggestion, repeatedSuggestionCount, checkFailCount,
    offeredStageIndex, completePreviewShown,
    selectedAnswer, scratchSandboxProject, scratchExternalState, scratchActiveStageIndex,
    fsState, fsInteraction, editorSelection, editorActivity, inPersonalSandbox,
    teacherHighlights, dismissHighlight,
    // Refs
    iframeRef,
    // Event handlers
    handleRun, handleStop, handleRunTests, handleSubmit, handleQuizSelect,
    handleCodeChange, handleFileChange, handleFileTabChange,
    handleEditorSelection, handleEditorActivity,
    handleScratchChange, handleScratchCheck,
    handleFsChange, handleFsInteraction,
    handleInputSubmit, handleResetCode, handleShowCodeStage, handlePreviewCompleteCode, handleShowCompleteCode,
    handleEnterPersonalSandbox, handleLeavePersonalSandbox,
    // Mode-aware task-save reader (localStorage normally, in-memory in presentation/preview)
    readSavedTaskCode: taskId => effectiveIdentity ? persistence.readSavedCode(effectiveIdentity.anonymousId, taskId) : null,
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
