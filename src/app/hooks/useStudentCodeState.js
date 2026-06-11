import { useState, useRef, useEffect, useCallback } from 'react'
import { runPython, stopPython, provideInput } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck, evaluateCheckWithCode, getFirstFailedCheckHint, getIncorrectCheckHint, normalizeChecks, evaluateSingleCheck, resolveTestCheck } from '../../shared/checks'
import { flattenTasks, findTaskById } from '../../shared/taskUtils'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS, normaliseDirPath } from '../../shared/filesystem'
import { decodeFileKey } from '../../shared/fileKeys'
import { loadSavedCode, loadSavedFile, saveCode, saveFile, loadPersonalSandboxCode, savePersonalSandboxCode, loadPersonalSandboxFile, savePersonalSandboxFile, loadPersonalSandboxFs, savePersonalSandboxFs, loadSavedFs, saveFsState } from '../studentStorage'
import { selectHtmlTaskFiles, selectPythonTaskCode } from '../studentTaskContent'
import { getQuizSuggestion } from '../studentQuizContent'
import { usePyodideState } from './usePyodideState'
import { useCheckFeedback } from './useCheckFeedback'
import { createStudentPersistence } from './createStudentPersistence'
import { useTeacherLivePublish } from './useTeacherLivePublish'
import { useTypeAssets } from '../../shared/useTypeAssets'

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
  writeStudentAnswer,
  writeStudentCode,
  writeStudentFiles,
  writeStudentOutput,
  writeStudentInteraction,
  writeStudentPersonalSandbox,
  registerPresence,
  removeStudent,
  updateTeacherLive,
  setTeacherLive,
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
  const [fsState, setFsState]             = useState(DEFAULT_FS)
  const [fsInteraction, setFsInteraction] = useState({ currentDir: '/', openFile: null })
  const [editorSelection, setEditorSelection] = useState(null)
  const [editorActivity, setEditorActivity] = useState(null)
  const [inPersonalSandbox, setInPersonalSandbox] = useState(false)

  const iframeRef           = useRef(null)
  const appendOutputRef     = useRef(null)
  const writeAnswerDebounceRef = useRef(null)

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

  // ─── Sub-hooks ────────────────────────────────────────────────────────────

  const { pyodideStatus, setPyodideStatus, initPyodideIfNeeded } = usePyodideState({ lesson })

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
  const {
    checkPassed, setCheckPassed, checkAttempted, setCheckAttempted,
    checkSuggestion, setCheckSuggestion, repeatedSuggestionCount,
    testResults, setTestResults, checkPassedRef,
    resetCheckFeedback, applyCheckFeedback,
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
  const shouldSkipLocalPersist = teacherPresentation || previewMode

  // ─── localStorage snapshot helpers ────────────────────────────────────────

  function saveCurrentWorkSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!id || teacherPresentation || previewMode || !currentLesson) return
    if (inPersonalSandboxRef.current) return

    const task = flattenTasks(currentLesson.tasks).find(t => t.id === taskId)
    if (task?.taskType === 'quiz' || task?.taskType === 'information') return

    if (currentLesson.type === 'python') {
      saveCode(lessonId, taskId, id.anonymousId, {
        code: codeRef.current,
        output: outputRef.current,
        runStatus: runStatusRef.current,
      })
    } else if (currentLesson.type === 'html') {
      filesRef.current.forEach(f => saveFile(lessonId, taskId, f.name, id.anonymousId, f.content))
    } else if (currentLesson.type === 'filesystem' && !previewMode) {
      saveFsState(lessonId, taskId, id.anonymousId, fsStateRef.current)
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
        readSavedCode: previewMode ? () => null : sourceTaskId => loadSavedCode(lessonId, sourceTaskId, activeIdentity.anonymousId),
      }))
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
    } else if (lesson.type === 'filesystem') {
      const carryId = task.carryFsFrom ?? null
      const ownSaved = previewMode ? null : loadSavedFs(lessonId, taskId, activeIdentity.anonymousId)
      const savedFromCarry = (!previewMode && carryId != null) ? loadSavedFs(lessonId, carryId, activeIdentity.anonymousId) : null
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
    } else {
      const taskFiles = selectHtmlTaskFiles({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedFile: previewMode ? () => null : (sourceTaskId, filename) => loadSavedFile(lessonId, sourceTaskId, filename, activeIdentity.anonymousId),
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

  // Load task content when task or phase changes
  useEffect(() => {
    if ((phase === 'lesson' || phase === 'solo') && effectiveIdentity && lesson) {
      loadTaskContent(currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTaskId, lesson, effectiveIdentity?.anonymousId])

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

    if (lesson.type === 'python') {
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
      else if (action === 'complete') targetBlocks = task.completeBlocks ?? null
      else {
        const stageMatch = action.match(/^stage_(\d+)$/)
        const stage = stageMatch ? (task.codeStages ?? [])[parseInt(stageMatch[1], 10)] : null
        targetBlocks = stage?.blocks ?? task.starterBlocks ?? null
      }
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // ─── Personal sandbox ──────────────────────────────────────────────────────

  function handleEnterPersonalSandbox() {
    if (!identity || teacherPresentation || !lesson) return
    const id = identity.anonymousId
    if (lesson.type === 'python') {
      const saved = loadPersonalSandboxCode(lessonId, id)
      setCode(saved?.code ?? lesson.sandboxStarterCode ?? '')
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
    const isWatched = session?.activeStudentView === actor.anonymousId
    const alreadySolved = isAlreadySolved()

    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setTestResults(null)
    if (!alreadySolved) resetCheckFeedback()

    if (lesson.type === 'python') {
      let accumulated = ''
      const echoOutput = (text) => {
        accumulated += text
        setOutput(accumulated)
        if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ output: accumulated }))
        if (isWatched) writeStudentOutput(actor.anonymousId, accumulated)
      }
      appendOutputRef.current = echoOutput
      const result = await runPython(code, {
        onOutput: (text, _kind) => echoOutput(text),
        onInputRequired: (prompt) => setInputPrompt(prompt),
      })
      setInputPrompt(null)

      if (result.status === 'stopped') {
        setRunning(false)
        return
      }

      const status = result.status
      setRunStatus(status)

      const checkContext = { status, code, variables: result.variables ?? {} }
      const hasTests = task?.tests?.length > 0
      let passed = alreadySolved ? true : (hasTests ? false : evaluateCheck(task?.check, accumulated, checkContext))
      let suggestion = ''
      if (!alreadySolved) {
        const incorrectHint = (!passed && !hasTests && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, accumulated, checkContext) : ''
        suggestion = (!hasTests && task?.check) ? (incorrectHint || getFirstFailedCheckHint(task.check, accumulated, checkContext)) : ''
        if (!hasTests && task?.check) applyCheckFeedback(passed, suggestion)
      }

      if (canPublishTeacherLive()) {
        publishTeacherLive({ output: accumulated, runStatus: status, checkPassed: passed, checkAttempted: !alreadySolved && !hasTests && !!task?.check, checkSuggestion: suggestion })
      }
      persistence.savePythonCode(actor.anonymousId, currentTaskId, { code, output: accumulated, runStatus: status })
      if (!teacherPresentation && (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        await writeStudentRun(actor.anonymousId, { code, output: accumulated, status, checkPassed: hasTests ? undefined : passed })
      }
      setRunning(false)
      return
    }

    // HTML — build iframe
    setHtmlPreviewCollapsed(false)
    const currentFiles = filesRef.current
    const src = buildIframeSrc(currentFiles, task?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath),
      storageAssets: htmlIframeStorageAssets,
    })
    setIframeSrc(src)
    setRunStatus('success')

    const taskIdAtRunTime = currentTaskIdRef.current
    waitForIframeText().then(text => {
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
      persistence.saveHtmlFiles(actor.anonymousId, taskIdAtRunTime, currentFiles)
      setRunning(false)
    })
  }

  function handleStop() {
    stopPython()
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    provideInput(value)
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
    resetCheckFeedback()

    const results = []
    try {
      await initPyodideIfNeeded()

      for (const test of task.tests) {
        const inputQueue = (test.inputs ?? []).map(inp => inp.value ?? '')
        let accumulated = ''
        const result = await runPython(code, {
          onOutput: text => { accumulated += text },
          onInputRequired: () => { provideInput(inputQueue.shift() ?? '') },
        })
        const resolvedCheck = resolveTestCheck(test.check, test.inputs ?? [])
        const checks = normalizeChecks(resolvedCheck)
        const checkContext = { status: result.status, code, variables: result.variables ?? {} }
        const passed = checks.length > 0 && checks.every(c => evaluateSingleCheck(c, accumulated, checkContext))
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
    } catch {
      stopPython()
      setRunStatus('error')
    } finally {
      setRunningTests(false)
    }
  }

  // ─── Editor change handlers ────────────────────────────────────────────────

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (canPublishTeacherLive()) publishTeacherLive({ code: newCode })
    if (shouldSkipLocalPersist) return
    if (identity && lesson?.type === 'python') {
      persistence.savePythonCode(identity.anonymousId, currentTaskId, { code: newCode, output, runStatus })
    }
    if (session?.activeStudentView === identity?.anonymousId) {
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
    if (shouldSkipLocalPersist) return
    if (identity && lesson?.type === 'html') {
      persistence.saveHtmlFile(identity.anonymousId, currentTaskId, filename, content)
    }
    if (session?.activeStudentView === identity?.anonymousId) {
      const filesMap = Object.fromEntries(
        filesRef.current.map(f => [f.name, f.name === filename ? content : f.content])
      )
      writeStudentFiles(identity.anonymousId, filesMap)
    }
  }

  function handleScratchChange(workspaceStates) {
    if (canPublishTeacherLive()) publishTeacherLive({ code: JSON.stringify(workspaceStates) })
    if (shouldSkipLocalPersist) return
    if (!identity) return
    persistence.saveScratch(identity.anonymousId, currentTaskId, workspaceStates)
    if (activeStudentViewRef.current === identity.anonymousId) {
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
        setCode(lesson.sandboxStarterCode ?? '')
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
    }
  }

  function handleShowCompleteCode() {
    if (!identity) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    if (!task) return

    if (lesson.type === 'python') {
      const completeCode = task.completeCode ?? ''
      setCode(completeCode)
      setOutput('')
      setRunStatus(null)
      applyCheckFeedback(true)
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code: completeCode, output: '', runStatus: null })
    } else if (lesson.type === 'html') {
      const completeFiles = (task.completeFiles ?? []).map(f => ({ ...f }))
      setFiles(completeFiles)
      setActiveFile(task.completeEntryFile ?? task.entryFile ?? completeFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      applyCheckFeedback(true)
      completeFiles.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    } else if (lesson.type === 'scratch') {
      const completeBlocks = task.completeBlocks ?? null
      setScratchExternalState(completeBlocks)
      applyCheckFeedback(true)
      if (completeBlocks) saveCode(lessonId, currentTaskId, identity.anonymousId, { state: completeBlocks })
    } else if (lesson.type === 'filesystem') {
      const completeFs = task.completeFs ?? DEFAULT_FS
      setFsState(completeFs)
      applyCheckFeedback(true)
      if (!previewMode) saveFsState(lessonId, currentTaskId, identity.anonymousId, completeFs)
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
  }

  return {
    // State
    code, files, activeFile, output, runStatus, running, runningTests, testResults,
    pyodideStatus, iframeSrc, teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed,
    inputPrompt, checkPassed, checkAttempted, checkSuggestion, repeatedSuggestionCount,
    selectedAnswer, scratchSandboxProject, scratchExternalState,
    fsState, fsInteraction, editorSelection, editorActivity, inPersonalSandbox,
    // Refs
    iframeRef,
    // Event handlers
    handleRun, handleStop, handleRunTests, handleSubmit, handleQuizSelect,
    handleCodeChange, handleFileChange, handleFileTabChange,
    handleEditorSelection, handleEditorActivity,
    handleScratchChange, handleScratchCheck,
    handleFsChange, handleFsInteraction,
    handleInputSubmit, handleResetCode, handleShowCompleteCode,
    handleEnterPersonalSandbox, handleLeavePersonalSandbox,
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
