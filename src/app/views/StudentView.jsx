import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession, decodeFileKey } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck, evaluateCheckWithCode, getFirstFailedCheckHint, getIncorrectCheckHint } from '../../shared/checks'
import { flattenTasks, findTaskById, filterTasksByMode } from '../../shared/taskUtils'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import ExplainerPanel from '../components/ExplainerPanel'
import InformationTask from '../components/InformationTask'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import CollapsibleIframePreview from '../components/CollapsibleIframePreview'
import ScratchWorkspace from '../components/ScratchWorkspace'
import QuizTask from '../components/QuizTask'
import FilesystemTask from '../components/FilesystemTask'
import CheckFeedbackBanner from '../components/CheckFeedbackBanner'
import LiveActivityToast from '../components/LiveActivityToast'
import SplitPane from '../../shared/SplitPane'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { DEFAULT_FS } from '../../shared/filesystem'
import { loadSavedCode, loadSavedFile, saveCode, saveFile, loadPersonalSandboxCode, savePersonalSandboxCode, loadPersonalSandboxFile, savePersonalSandboxFile, loadSavedFs, saveFsState } from '../studentStorage'
import { selectHtmlTaskFiles, selectPythonTaskCode, selectScratchInitialProject } from '../studentTaskContent'
import { deriveStudentLiveDisplay, toTeacherLiveFiles } from '../studentLiveDisplay'
import { getQuizSuggestion } from '../studentQuizContent'
import TaskSlideTransition from '../components/TaskSlideTransition'
import StudentEditorHeader from '../components/StudentEditorHeader'
import LoadingScreen from '../components/LoadingScreen'

export default function StudentView({ lessonId: lessonIdProp, soloMode = false, lesson: lessonProp = null, teacherPresentation = false, allowUnrestrictedTaskNavigation = false, previewMode = false, initialTaskId = null }) {
  const lessonId = lessonIdProp ?? lessonProp?.id ?? 'preview'
  const {
    session, loading: sessionLoading, registerPresence, joinSession,
    writeStudentRun, writeStudentCode, writeStudentFiles, writeStudentOutput, writeStudentInteraction, writeStudentPersonalSandbox,
    setTaskId, setTeacherLive, updateTeacherLive, removeStudent,
  } = useSession(lessonId)
  const { identity, loaded: identityLoaded, createIdentity, updateTimestamp, updateDisplayName } = useIdentity()
  const effectiveIdentity = teacherPresentation ? { anonymousId: 'teacher-presenter', displayName: 'Teacher' } : identity

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [phase, setPhase]               = useState('loading') // loading | waiting | name-entry | lesson | sandbox | solo | ended
  const [currentTaskId, setCurrentTaskId] = useState(initialTaskId ?? 1)
  const [viewingTaskId, setViewingTaskId] = useState(null) // null = current task
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle') // idle | loading | ready
  const [iframeSrc, setIframeSrc]         = useState(null)
  const [teacherLiveIframeSrc, setTeacherLiveIframeSrc] = useState(null)
  const [htmlPreviewCollapsed, setHtmlPreviewCollapsed] = useState(true)
  const [inputPrompt, setInputPrompt]     = useState(null)
  const [checkPassed, setCheckPassed]     = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [checkSuggestion, setCheckSuggestion] = useState('')
  const [repeatedSuggestionCount, setRepeatedSuggestionCount] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [scratchSandboxProject, setScratchSandboxProject] = useState(null)
  const [scratchExternalState, setScratchExternalState] = useState(null)
  const [fsState, setFsState] = useState(DEFAULT_FS)
  const [fsInteraction, setFsInteraction] = useState({ currentDir: '/', openFile: null })
  const [editorSelection, setEditorSelection] = useState(null)
  const [editorActivity, setEditorActivity] = useState(null)
  const [inPersonalSandbox, setInPersonalSandbox] = useState(false)
  const isMobile = useIsMobile()
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)
  const identityRef = useRef(identity)
  identityRef.current = identity
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Live refs so the session-end effect can read current editor state without stale closures
  const codeRef = useRef(code)
  codeRef.current = code
  const filesRef = useRef(files)
  filesRef.current = files
  const outputRef = useRef(output)
  outputRef.current = output
  const runStatusRef = useRef(runStatus)
  runStatusRef.current = runStatus
  const currentTaskIdRef = useRef(currentTaskId)
  currentTaskIdRef.current = currentTaskId
  const lessonRef = useRef(lesson)
  lessonRef.current = lesson
  const activeStudentViewRef = useRef(session?.activeStudentView)
  activeStudentViewRef.current = session?.activeStudentView
  const editorSelectionRef = useRef(editorSelection)
  editorSelectionRef.current = editorSelection
  const editorActivityRef = useRef(editorActivity)
  editorActivityRef.current = editorActivity
  const inPersonalSandboxRef = useRef(inPersonalSandbox)
  inPersonalSandboxRef.current = inPersonalSandbox
  const fsStateRef = useRef(fsState)
  fsStateRef.current = fsState
  const fsInteractionRef = useRef(fsInteraction)
  fsInteractionRef.current = fsInteraction

  function currentTeacherLivePayload(extra = {}) {
    const filesMap = Object.fromEntries(filesRef.current.map(f => [f.name, f.content]))
    const sourceStudentId = teacherPresentation ? null : identityRef.current?.anonymousId
    const sourceStudentName = teacherPresentation ? null : identityRef.current?.displayName
    return {
      active: true,
      source: teacherPresentation ? 'teacher' : 'student',
      sourceStudentId,
      sourceStudentName,
      taskId: currentTaskIdRef.current,
      lessonType: lessonRef.current?.type,
      code: codeRef.current,
      files: filesMap,
      activeFile,
      output: outputRef.current,
      runStatus: runStatusRef.current,
      checkPassed,
      checkAttempted,
      checkSuggestion,
      selection: editorSelectionRef.current,
      activity: editorActivityRef.current,
      ...extra,
    }
  }

  function resetCheckFeedback() {
    setCheckPassed(false)
    setCheckAttempted(false)
    setCheckSuggestion('')
    setRepeatedSuggestionCount(0)
  }

  function applyCheckFeedback(passed, suggestion = '') {
    const nextSuggestion = passed ? '' : String(suggestion ?? '').trim()
    setCheckPassed(passed)
    setCheckAttempted(true)
    setCheckSuggestion(nextSuggestion)
    setRepeatedSuggestionCount(prev => {
      if (passed || !nextSuggestion) return 0
      return checkSuggestion === nextSuggestion ? prev + 1 : 1
    })
    return nextSuggestion
  }

  function canPublishTeacherLive() {
    if (!session?.teacherLive?.active) return false
    if (teacherPresentation) return session?.teacherLive?.source !== 'student'
    return session.teacherLive.sourceStudentId === identityRef.current?.anonymousId
  }

  function publishTeacherLive(extra = {}) {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload(extra))
  }

  function saveCurrentWorkSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!id || teacherPresentation || !currentLesson) return
    if (inPersonalSandboxRef.current) return // personal sandbox state is saved separately

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

  // Load lesson JSON (or use lessonProp directly when provided by builder preview)
  useEffect(() => {
    if (lessonProp != null) {
      setLesson(lessonProp)
      setCurrentTaskId(initialTaskId ?? flattenTasks(lessonProp.tasks)[0]?.id ?? 1)
      setLessonLoading(false)
      return
    }
    const base = import.meta.env.BASE_URL
    fetch(`${base}lessons/${lessonId}.json`)
      .then(r => r.json())
      .then(data => { setLesson(data); setLessonLoading(false) })
      .catch(() => setLessonLoading(false))
  }, [lessonId, lessonProp])

  useEffect(() => {
    if (lesson?.type === 'html') setHtmlPreviewCollapsed(true)
  }, [lesson?.type, currentTaskId])

  useEffect(() => {
    if (teacherPresentation || lesson?.type !== 'html' || !session?.teacherLive?.active || !session.teacherLive.files) {
      setTeacherLiveIframeSrc(null)
      return
    }
    const liveFiles = toTeacherLiveFiles(session.teacherLive.files)
    const liveTask = flattenTasks(lesson.tasks).find(t => t.id === session.teacherLive.taskId)
    setHtmlPreviewCollapsed(false)
    setTeacherLiveIframeSrc(buildIframeSrc(liveFiles, liveTask?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, lesson?.type, session?.teacherLive?.updatedAt])

  // Warm up Pyodide for Python lessons
  useEffect(() => {
    if (!lesson || lesson.type !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson])

  // Determine phase once session + identity are loaded
  useEffect(() => {
    if ((!soloMode && sessionLoading) || (!teacherPresentation && !identityLoaded) || lessonLoading) return

    if (teacherPresentation) {
      if (!session) {
        setPhase('waiting')
        return
      }
      if (session.state === 'ended') {
        setPhase('ended')
        return
      }
      if (session.state === 'sandbox') {
        setPhase('sandbox')
        return
      }
      setCurrentTaskId(session.currentTaskId ?? 1)
      setPhase('lesson')
      return
    }

    // No session — go straight to solo or waiting depending on URL mode
    if (!session) {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'join-choice' || phaseRef.current === 'name-entry' || phaseRef.current === 'waiting') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      if (phaseRef.current === 'loading') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      // Already solo — stay solo
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Session ended — exit any join flow gracefully
    if (session.state === 'ended') {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'loading' || phaseRef.current === 'join-choice') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Verify the session belongs to this lesson before proceeding
    if (session.lessonId && session.lessonId !== lessonId) {
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Solo mode is URL-determined — stay in current phase when session state changes
    if (phaseRef.current === 'solo' || phaseRef.current === 'ended') return

    // Don't interrupt the student while they're entering their name
    if (phaseRef.current === 'name-entry') return

    if (session.state === 'waiting') {
      // Already in waiting room — check if they need to be prompted for name now
      if (phaseRef.current === 'waiting') {
        const alreadyRegistered = identity && identity.lastSessionTimestamp === session.createdAt
        if (!alreadyRegistered) setPhase('name-entry')
        return
      }
      // Fresh arrival in live mode → name entry
      if (soloMode) return
      setPhase('name-entry')
      return
    }

    // Session is active or sandbox
    const sessionTs = session.createdAt
    const isReturning = identity && identity.lastSessionTimestamp === sessionTs

    // Student was in the waiting room and the session just became active
    if (phaseRef.current === 'waiting') {
      if (isReturning) {
        if (session.state === 'sandbox') { setPhase('sandbox'); return }
        setCurrentTaskId(session.currentTaskId ?? 1)
        setPhase('lesson')
      } else {
        setPhase('name-entry')
      }
      return
    }

    if (!identity || !isReturning) {
      setPhase('name-entry')
      return
    }

    // Returning student — update timestamp and drop in
    updateTimestamp(sessionTs)

    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, identityLoaded, lessonLoading, session?.state, session?.createdAt, session?.currentTaskId, soloMode, teacherPresentation])

  useEffect(() => {
    if (teacherPresentation && !sessionLoading && session?.state === 'ended') window.close()
  }, [teacherPresentation, sessionLoading, session?.state])

  // React to teacher moving to a new task
  useEffect(() => {
    if (!session?.currentTaskId || phase !== 'lesson') return
    if (session.currentTaskId !== currentTaskId) {
      // If student was in personal sandbox, save their sandbox state and pull them back to the lesson
      if (inPersonalSandboxRef.current) {
        savePersonalSandboxSnapshot()
        setInPersonalSandbox(false)
        if (identity?.anonymousId) writeStudentPersonalSandbox(identity.anonymousId, false)
      }
      saveCurrentWorkSnapshot()
      setCurrentTaskId(session.currentTaskId)
      setViewingTaskId(null)
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
      setSelectedAnswer('')
      loadTaskContent(session.currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentTaskId])

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
      // sandboxCode is a JSON string of the Blockly workspace state
      setScratchSandboxProject(JSON.parse(session.sandboxCode))
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
  const myStudentData = session?.students?.[identity?.anonymousId]
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
      const targetFs = action === 'complete'
        ? (task.completeFs ?? task.starterFs ?? DEFAULT_FS)
        : (task.starterFs ?? DEFAULT_FS)
      setFsState(targetFs)
      resetCheckFeedback()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // Sync teacher rename back to local identity so TopBar updates immediately
  useEffect(() => {
    if (!identity?.anonymousId || !session?.students) return
    const firebaseName = session.students[identity.anonymousId]?.displayName
    if (firebaseName && firebaseName !== identity.displayName) {
      updateDisplayName(firebaseName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.students?.[identity?.anonymousId]?.displayName])

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
        readSavedCode: sourceTaskId => loadSavedCode(lessonId, sourceTaskId, activeIdentity.anonymousId),
      }))
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
    } else if (lesson.type === 'filesystem') {
      const carryId = task.carryFsFrom ?? null
      const ownSaved = previewMode ? null : loadSavedFs(lessonId, taskId, activeIdentity.anonymousId)
      const saved = ownSaved ?? (!previewMode && carryId != null ? loadSavedFs(lessonId, carryId, activeIdentity.anonymousId) : null)
      setFsState(saved ?? task.starterFs ?? DEFAULT_FS)
      setFsInteraction({ currentDir: '/', openFile: null })
      resetCheckFeedback()
    } else {
      const taskFiles = selectHtmlTaskFiles({
        tasks: lesson.tasks,
        task,
        taskId,
        phase,
        readSavedFile: (sourceTaskId, filename) => loadSavedFile(lessonId, sourceTaskId, filename, activeIdentity.anonymousId),
      })
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  useEffect(() => {
    if ((phase === 'lesson' || phase === 'solo') && effectiveIdentity && lesson) {
      loadTaskContent(currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTaskId, lesson, effectiveIdentity?.anonymousId])

  useEffect(() => {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, session?.teacherLive?.active, session?.teacherLive?.sourceStudentId, identity?.anonymousId, currentTaskId, code, files, activeFile, output, runStatus, checkPassed, checkAttempted])

  // When phase leaves lesson/solo, exit personal sandbox silently
  useEffect(() => {
    if (phase === 'lesson' || phase === 'solo') return
    if (!inPersonalSandboxRef.current) return
    savePersonalSandboxSnapshot()
    setInPersonalSandbox(false)
    if (identity?.anonymousId) writeStudentPersonalSandbox(identity.anonymousId, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Register Firebase presence so the teacher sees who is connected live
  useEffect(() => {
    if (teacherPresentation) return
    if ((phase === 'lesson' || phase === 'sandbox') && identity?.anonymousId) {
      registerPresence(identity.anonymousId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, identity?.anonymousId, teacherPresentation])

  // Presentation windows must not appear as students, including when the
  // teacher browser already has a previous student identity in localStorage.
  useEffect(() => {
    if (!teacherPresentation || !identity?.anonymousId || !session?.students?.[identity.anonymousId]) return
    removeStudent(identity.anonymousId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, identity?.anonymousId, session?.students])

  // When the teacher starts live-viewing this student, publish the current
  // in-memory editor state immediately so the modal is not blank until typing.
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
    }
    writeStudentInteraction(identity.anonymousId, {
      selection: editorSelectionRef.current,
      activeFile: lesson.type === 'html' ? activeFile : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // ─── Personal sandbox ──────────────────────────────────────────────────────

  function savePersonalSandboxSnapshot() {
    const id = identityRef.current
    if (!id || teacherPresentation || !lessonRef.current) return
    if (lessonRef.current.type === 'python') {
      savePersonalSandboxCode(lessonId, id.anonymousId, { code: codeRef.current })
    } else if (lessonRef.current.type === 'html') {
      filesRef.current.forEach(f => savePersonalSandboxFile(lessonId, f.name, id.anonymousId, f.content))
    } else if (lessonRef.current.type === 'scratch') {
      // Scratch saves incrementally via handleScratchChange so nothing to do here
    }
  }

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

  // ─── Event handlers ────────────────────────────────────────────────────────

  async function handleNameSubmit(displayName) {
    const sessionTs = session.createdAt
    const id = createIdentity(displayName, sessionTs)
    await joinSession(id.anonymousId, displayName)
    if (session.state === 'waiting') { setPhase('waiting'); return }
    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  }

  function handleWaitForTeacher() {
    if (session && session.state === 'waiting') {
      setPhase('name-entry')
    } else {
      // No session yet — go to waiting room; when session appears we'll prompt for name
      setPhase('waiting')
    }
  }

  function handleSoloNavigate(taskId) {
    if (teacherPresentation) {
      if (!flatTasks.some(t => t.id === taskId)) return
      setTaskId(taskId)
      setCurrentTaskId(taskId)
      setViewingTaskId(null)
      setOutput('')
      setRunStatus(null)
      resetCheckFeedback()
      setSelectedAnswer('')
      setIframeSrc(null)
      updateTeacherLive({ taskId, output: '', runStatus: null, checkPassed: false, checkAttempted: false })
      return
    }
    if (!identity) return
    const currentTask = findTaskById(lesson?.tasks, currentTaskId)
    if (phase === 'solo' && !allowUnrestrictedTaskNavigation) {
      const targetIdx = flatTasks.findIndex(t => t.id === taskId)
      const currIdx = flatTasks.findIndex(t => t.id === currentTaskId)
      if (targetIdx > currIdx) {
        const canAdvance = !currentTask?.check || currentTask?.taskType === 'information' || checkPassed
        if (!canAdvance || targetIdx > currIdx + 1) return
      }
    }
    // Persist current editing state before leaving the task
    if (currentTask?.taskType === 'quiz' || currentTask?.taskType === 'information') {
      // Quiz answers are not local editor work.
    } else if (lesson?.type === 'python') {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output, runStatus })
    } else if (lesson?.type === 'html') {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    } else if (lesson?.type === 'filesystem' && !previewMode) {
      saveFsState(lessonId, currentTaskId, identity.anonymousId, fsState)
    }
    // scratch: blocks are saved incrementally via handleScratchChange
    setViewingTaskId(null)
    setOutput('')
    setRunStatus(null)
    resetCheckFeedback()
    setSelectedAnswer('')
    setIframeSrc(null)
    setCurrentTaskId(taskId)
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

  async function handleRun() {
    const actor = effectiveIdentity
    if (!actor || running) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const isWatched = session?.activeStudentView === actor.anonymousId

    setRunning(true)
    setOutput('')
    setRunStatus(null)
    resetCheckFeedback()

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
      const passed = evaluateCheck(task?.check, accumulated, checkContext)
      const incorrectHint = (!passed && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, accumulated, checkContext) : ''
      const suggestion = task?.check ? (incorrectHint || getFirstFailedCheckHint(task.check, accumulated, checkContext)) : ''
      if (task?.check) applyCheckFeedback(passed, suggestion)

      if (canPublishTeacherLive()) {
        publishTeacherLive({ output: accumulated, runStatus: status, checkPassed: passed, checkAttempted: !!task?.check, checkSuggestion: suggestion })
      }
      if (!teacherPresentation) {
        if (inPersonalSandboxRef.current) {
          savePersonalSandboxCode(lessonId, actor.anonymousId, { code })
        } else {
          saveCode(lessonId, currentTaskId, actor.anonymousId, { code, output: accumulated, runStatus: status })
        }
      }
      if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        await writeStudentRun(actor.anonymousId, { code, output: accumulated, status, checkPassed: passed })
      }
      setRunning(false)
      return
    }

    // HTML — build iframe
    setHtmlPreviewCollapsed(false)
    const src = buildIframeSrc(files, task?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath),
    })
    setIframeSrc(src)
    setRunStatus('success')

    // Wait for the iframe to report its body text via postMessage, then run checks
    waitForIframeText().then(text => {
      const codeStr = files.map(f => f.content).join('\n')
      const iframeDoc = iframeRef.current?.contentDocument ?? null
      const passed = evaluateCheck(task?.check, text, { code: codeStr, iframeDoc })
      const incorrectHint = (!passed && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, text, { code: codeStr, iframeDoc }) : ''
      const suggestion = task?.check ? (incorrectHint || getFirstFailedCheckHint(task.check, text, { code: codeStr, iframeDoc })) : ''
      if (task?.check) applyCheckFeedback(passed, suggestion)
      if (canPublishTeacherLive()) {
        publishTeacherLive({ runStatus: 'success', checkPassed: passed, checkAttempted: !!task?.check, checkSuggestion: suggestion, files: Object.fromEntries(files.map(f => [f.name, f.content])) })
      }
      if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox' || inPersonalSandboxRef.current || isWatched)) {
        const filesMap = Object.fromEntries(files.map(f => [f.name, f.content]))
        writeStudentRun(actor.anonymousId, { files: filesMap, status: 'success', checkPassed: passed })
      }
      if (!teacherPresentation) {
        if (inPersonalSandboxRef.current) {
          files.forEach(f => savePersonalSandboxFile(lessonId, f.name, actor.anonymousId, f.content))
        } else {
          files.forEach(f => saveFile(lessonId, currentTaskId, f.name, actor.anonymousId, f.content))
        }
      }
    })
    setRunning(false)
  }

  function handleStop() {
    stopPython()
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    provideInput(value)
  }

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (canPublishTeacherLive()) {
      publishTeacherLive({ code: newCode })
    }
    if (teacherPresentation) return
    if (identity && lesson?.type === 'python') {
      if (inPersonalSandboxRef.current) {
        savePersonalSandboxCode(lessonId, identity.anonymousId, { code: newCode })
      } else {
        saveCode(lessonId, currentTaskId, identity.anonymousId, { code: newCode, output, runStatus })
      }
    }
    if (session?.activeStudentView === identity?.anonymousId) {
      writeStudentCode(identity.anonymousId, newCode)
    }
  }

  function handleEditorSelection(selection, filename = null) {
    const nextSelection = {
      ...selection,
      ...(filename ? { file: filename } : {}),
    }
    editorSelectionRef.current = nextSelection
    setEditorSelection(nextSelection)
    if (canPublishTeacherLive()) publishTeacherLive({ selection: nextSelection })
    if (!teacherPresentation && session?.activeStudentView === identity?.anonymousId) {
      writeStudentInteraction(identity.anonymousId, { selection: nextSelection })
    }
  }

  function handleEditorActivity(activity, filename = null) {
    const nextActivity = {
      ...activity,
      ...(filename ? { file: filename } : {}),
    }
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
    const nextFiles = files.map(f => f.name === filename ? { ...f, content } : f)
    setFiles(nextFiles)
    if (canPublishTeacherLive()) {
      publishTeacherLive({
        files: Object.fromEntries(nextFiles.map(f => [f.name, f.content])),
        activeFile: filename,
      })
    }
    if (teacherPresentation) return
    if (identity && lesson?.type === 'html') {
      if (inPersonalSandboxRef.current) {
        savePersonalSandboxFile(lessonId, filename, identity.anonymousId, content)
      } else {
        saveFile(lessonId, currentTaskId, filename, identity.anonymousId, content)
      }
    }
    if (session?.activeStudentView === identity?.anonymousId) {
      const filesMap = Object.fromEntries(
        files.map(f => [f.name, f.name === filename ? content : f.content])
      )
      writeStudentFiles(identity.anonymousId, filesMap)
    }
  }

  function handleScratchChange(workspaceStates) {
    if (canPublishTeacherLive()) {
      publishTeacherLive({ code: JSON.stringify(workspaceStates) })
    }
    if (teacherPresentation) return
    if (!identity) return
    if (inPersonalSandboxRef.current) {
      savePersonalSandboxCode(lessonId, identity.anonymousId, { state: workspaceStates })
    } else {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { state: workspaceStates })
    }
    if (activeStudentViewRef.current === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, JSON.stringify(workspaceStates))
    }
  }

  function handleScratchCheck(passed, snapshot) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const checks = Array.isArray(task?.check) ? task.check : task?.check ? [task.check] : []
    const suggestion = passed ? '' : String(checks.find(c => c?.hint)?.hint ?? '').trim()
    if (task?.check) applyCheckFeedback(passed, suggestion)
    if (!identity || lesson?.type !== 'scratch') return
    if (phase === 'lesson' || phase === 'sandbox' || activeStudentViewRef.current === identity.anonymousId) {
      const states = snapshot?.workspaceStates ?? loadSavedCode(lessonId, currentTaskId, identity.anonymousId)?.state ?? null
      writeStudentRun(identity.anonymousId, {
        code: states ? JSON.stringify(states) : undefined,
        output: snapshot?.spriteStates ? JSON.stringify(snapshot.spriteStates) : undefined,
        status: 'success',
        checkPassed: passed,
      })
    }
  }

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

  async function handleSubmit() {
    const actor = effectiveIdentity
    if (!actor) return
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const isHtml = lesson?.type === 'html'
    const codeForCheck = isHtml ? files.map(f => f.content).join('\n') : code
    const passed = task?.check ? evaluateCheckWithCode(task.check, codeForCheck) : false
    const incorrectHint = (!passed && task?.incorrectChecks) ? getIncorrectCheckHint(task.incorrectChecks, '', { code: codeForCheck }) : ''
    const suggestion = task?.check ? (incorrectHint || getFirstFailedCheckHint(task.check, '', { code: codeForCheck })) : ''
    if (task?.check) applyCheckFeedback(passed, suggestion)
    setRunStatus('submitted')
    if (canPublishTeacherLive()) {
      publishTeacherLive({
        code: isHtml ? undefined : code,
        files: isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : undefined,
        output: isHtml ? undefined : '',
        runStatus: 'submitted',
        checkPassed: passed,
        checkAttempted: !!task?.check,
        checkSuggestion: suggestion,
      })
    }
    if (!teacherPresentation && isHtml) {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, actor.anonymousId, f.content))
    } else if (!teacherPresentation) {
      saveCode(lessonId, currentTaskId, actor.anonymousId, { code, output: '', runStatus: 'submitted' })
    }
    if (!teacherPresentation && (phase === 'lesson' || phase === 'sandbox')) {
      const filesMap = isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : undefined
      await writeStudentRun(actor.anonymousId, { code: isHtml ? undefined : code, files: filesMap, output: isHtml ? undefined : '', status: 'submitted', checkPassed: passed })
    }
  }

  async function handleQuizSelect(answer, passedOverride) {
    const actor = effectiveIdentity
    if (!actor) return

    // Intermediate state update (match/fill_blank tile placement in progress)
    if (passedOverride === null) {
      setSelectedAnswer(answer)
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
    const serializedAnswer = typeof answer === 'string' ? answer : JSON.stringify(answer)
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

  function applyFsCheckAndPublish(context) {
    const task = findTaskById(lesson?.tasks, currentTaskId)
    const passed = task?.check ? evaluateCheck(task.check, null, context) : false
    const suggestion = passed ? '' : (task?.check ? getFirstFailedCheckHint(task.check, null, context) : '')
    if (task?.check) applyCheckFeedback(passed, suggestion)
    if (!teacherPresentation && phase === 'lesson' && effectiveIdentity?.anonymousId) {
      writeStudentRun(effectiveIdentity.anonymousId, {
        code: JSON.stringify(context.fs),
        status: task?.check ? (passed ? 'success' : 'error') : null,
        checkPassed: passed,
      })
    }
  }

  function handleFsChange(newFs) {
    setFsState(newFs)
    if (!teacherPresentation && !previewMode) {
      saveFsState(lessonId, currentTaskId, effectiveIdentity?.anonymousId, newFs)
    }
    applyFsCheckAndPublish({ fs: newFs, ...fsInteractionRef.current })
  }

  const handleFsInteraction = useCallback((interaction) => {
    setFsInteraction(interaction)
    applyFsCheckAndPublish({ fs: fsStateRef.current, ...interaction })
  // applyFsCheckAndPublish reads lesson/currentTaskId/phase/effectiveIdentity via closure;
  // listing them here keeps navigate (which deps on handleFsInteraction) stable between renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, currentTaskId, teacherPresentation, phase, effectiveIdentity])

  // ─── Render helpers ────────────────────────────────────────────────────────

  if (phase === 'loading' || (!soloMode && sessionLoading) || lessonLoading || (!teacherPresentation && !identityLoaded)) {
    return <LoadingScreen message="Loading…" />
  }

  if (!lesson) {
    return <LoadingScreen message={`Lesson "${lessonId}" not found.`} />
  }

  function handleGoSolo() {
    createIdentity('Solo', Date.now())
    setPhase('solo')
  }

  if (phase === 'name-entry') {
    return (
      <NameEntry
        lessonTitle={lesson.title}
        existingNames={session ? Object.values(session.students ?? {}).map(s => s.displayName) : []}
        onSubmit={handleNameSubmit}
        onGoSolo={handleGoSolo}
        waitingForSession={session?.state === 'waiting'}
      />
    )
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        lessonTitle={lesson.title}
        lessonDescription={lesson.description}
      />
    )
  }

  if (phase === 'ended') {
    return (
      <div style={styles.centreScreen}>
        <h2 style={styles.title}>Session ended</h2>
        <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
          Great work today! Your progress has been saved.
        </p>
        <p style={{ color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: 24 }}>
          Want to keep practising on your own?
        </p>
        <button
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: 15 }}
          onClick={() => setPhase('solo')}
        >
          Continue Solo
        </button>
      </div>
    )
  }

  const taskDisplayMode = phase === 'solo' ? 'solo' : phase === 'lesson' ? 'live' : null
  const visibleTasks = filterTasksByMode(lesson.tasks, taskDisplayMode)
  const flatTasks = flattenTasks(visibleTasks)
  const currentIndex = flatTasks.findIndex(t => t.id === currentTaskId)
  const {
    isPresentationStudentViewer,
    isStudentGoLiveViewer,
    isTeacherLiveActive,
    isForcedTeacherLive,
    displayedTaskId,
    displayCode,
    displayFiles,
    displayActiveFile,
    displayOutput,
    displayRunStatus,
    displayCheckPassed,
    displayCheckAttempted,
    displayCheckSuggestion,
    displaySelection,
    displayActivity,
  } = deriveStudentLiveDisplay({
    teacherPresentation,
    phase,
    teacherLive: session?.teacherLive,
    identityId: identity?.anonymousId,
    currentTaskId,
    viewingTaskId,
    code,
    files,
    activeFile,
    output,
    runStatus,
    checkPassed,
    checkAttempted,
    checkSuggestion,
    editorActivity,
  })
  const task = flatTasks.find(t => t.id === displayedTaskId)
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'
  const isQuizTask = task?.taskType === 'quiz'
  const isAutoEvaluatedQuiz = isQuizTask && (task?.quizType === 'match' || task?.quizType === 'fill_blank')
  const isInformationTask = task?.taskType === 'information'
  const currentTask = flatTasks.find(t => t.id === currentTaskId)
  const currentTaskIsAutoEvaluated = currentTask?.taskType === 'quiz' && (currentTask?.quizType === 'match' || currentTask?.quizType === 'fill_blank')
  const canAdvanceSolo = (!currentTask?.check && !currentTaskIsAutoEvaluated) || currentTask?.taskType === 'information' || checkPassed
  const canNavigateNextSolo = allowUnrestrictedTaskNavigation || canAdvanceSolo
  const hasCompleteSolution = lesson.type === 'python'
    ? !!task?.completeCode
    : lesson.type === 'scratch'
    ? !!task?.completeBlocks
    : lesson.type === 'filesystem'
    ? !!task?.completeFs
    : (task?.completeFiles?.length > 0)
  const canOfferCompleteSolution = isSolo && hasCompleteSolution && !displayCheckPassed && repeatedSuggestionCount >= 2
  const hasPersonalSandbox = lesson.type === 'python'
    ? !!(lesson.sandboxStarterCode != null)
    : lesson.type === 'html'
    ? !!(lesson.sandboxStarterFiles?.length > 0)
    : lesson.type === 'scratch'
    ? !!(lesson.sandboxStarterCode != null)
    : false
  const canOfferPersonalSandbox = (phase === 'lesson' || isSolo) && hasPersonalSandbox && displayCheckPassed && !inPersonalSandbox && !isForcedTeacherLive
  const taskContentStyle = isQuizTask
    ? styles.taskContentQuiz
    : isInformationTask
    ? styles.taskContentInfo
    : lesson.type === 'python' || lesson.type === 'html'
    ? styles.taskContentScroll
    : styles.taskContent
  const editorAreaStyle = isQuizTask
    ? styles.editorAreaQuiz
    : isInformationTask
    ? styles.editorAreaInfo
    : lesson.type === 'scratch'
    ? styles.editorAreaScratch
    : lesson.type === 'python' || lesson.type === 'html'
      ? styles.editorAreaScroll
      : styles.editorArea

  const isPaused = !isForcedTeacherLive && (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  async function handleToggleTeacherLive() {
    if (!teacherPresentation) return
    if (session?.teacherLive?.active) {
      await setTeacherLive(null)
      return
    }
    await setTeacherLive(currentTeacherLivePayload())
  }

  const topBarRight = teacherPresentation ? (
    <div style={styles.presentationControls}>
      <button
        className="btn-ghost"
        style={styles.presentationBtn}
        disabled={currentIndex <= 0}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
      >
        Previous
      </button>
      <span style={styles.presentationTaskLabel}>Task {currentIndex + 1} / {flatTasks.length}</span>
      <button
        className="btn-ghost"
        style={styles.presentationBtn}
        disabled={currentIndex >= flatTasks.length - 1}
        onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
      >
        Next
      </button>
      <button
        className={isTeacherLiveActive ? 'btn-danger' : 'btn-primary'}
        style={styles.presentationBtn}
        onClick={handleToggleTeacherLive}
      >
        {isTeacherLiveActive ? 'Stop Live to Students' : 'Go Live to Students'}
      </button>
    </div>
  ) : (
    !isSandbox && (
      <TaskProgressDots
        tasks={visibleTasks}
        currentTaskId={currentTaskId}
        viewingTaskId={viewingTaskId}
        isSolo={isSolo}
        canSelectTask={id => {
          if (!isSolo) return true
          const idIdx = flatTasks.findIndex(t => t.id === id)
          return allowUnrestrictedTaskNavigation || idIdx <= currentIndex || (idIdx === currentIndex + 1 && canAdvanceSolo)
        }}
        onDotClick={id => {
          if (isSolo) {
            if (id !== currentTaskId) handleSoloNavigate(id)
          } else if (id < currentTaskId) {
            setViewingTaskId(id === currentTaskId ? null : id)
          }
        }}
      />
    )
  )

  return (
    <div style={{ ...styles.page, background: isForcedTeacherLive ? '#dde0e5' : '#f5f5f5' }}>
      {isPaused && (
        <div style={styles.pauseOverlay}>
          <span style={styles.pauseIcon}>⏸</span>
          <h2 style={styles.pauseTitle}>Coding Paused</h2>
          <p style={styles.pauseSubtitle}>Your teacher will resume the session shortly</p>
        </div>
      )}
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        displayName={isPresentationStudentViewer ? `Other Student — ${session.teacherLive.sourceStudentName ?? 'Student'}` : teacherPresentation ? 'Presentation' : identity?.displayName}
        isSandbox={isSandbox}
        isSolo={teacherPresentation ? undefined : isSolo}
        right={topBarRight}
      />
      <LiveActivityToast activity={displayActivity} showClicks={isForcedTeacherLive} />

      {isForcedTeacherLive && (
        <div style={styles.teacherLiveBanner}>
          <span className="live-dot" />
          {isPresentationStudentViewer || isStudentGoLiveViewer
            ? `Watching ${session.teacherLive.sourceStudentName ?? 'a student'}'s screen — your work is saved`
            : 'Watching teacher — your own work is saved and will return when live view ends'}
        </div>
      )}



      {isViewingPrev && (
        <div style={styles.prevBanner}>
          You are viewing a previous task — return to current task to continue.
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={() => setViewingTaskId(null)}
          >
            Back to Current Task
          </button>
        </div>
      )}

      {inPersonalSandbox && (
        <div style={styles.personalSandboxBanner}>
          <span>Personal Sandbox — your lesson progress is saved</span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={handleLeavePersonalSandbox}
          >
            Close Sandbox
          </button>
        </div>
      )}

      <div style={isSolo && (isQuizTask || isInformationTask) ? { ...styles.body, overflow: 'hidden' } : styles.body}>
        <TaskSlideTransition
          transitionKey={`${phase}-${inPersonalSandbox ? 'personal-sandbox' : (viewingTaskId ?? currentTaskId)}`}
          style={taskContentStyle}
        >
          {task?.explainer && !isSandbox && !inPersonalSandbox && !isQuizTask && !isInformationTask && (
            <ExplainerPanel title={task.title} content={task.explainer} topicType={lesson.type} />
          )}

        <div style={editorAreaStyle} className={isForcedTeacherLive ? 'live-view-active' : undefined}>
          {!inPersonalSandbox && (task?.check || isAutoEvaluatedQuiz) && displayCheckAttempted && (
            <CheckFeedbackBanner
              passed={displayCheckPassed}
              failureMessage={isQuizTask ? 'Not quite right, try again.' : undefined}
              suggestion={displayCheckSuggestion}
              onShowCompleteCode={canOfferCompleteSolution ? handleShowCompleteCode : undefined}
              onGoPersonalSandbox={canOfferPersonalSandbox ? handleEnterPersonalSandbox : undefined}
            />
          )}
          {isInformationTask ? (
            <InformationTask task={task} lesson={lesson} fill />
          ) : task?.taskType === 'quiz' ? (
            <QuizTask
              task={task}
              showQuestion
              selectedAnswer={selectedAnswer}
              onSelectAnswer={isViewingPrev ? undefined : handleQuizSelect}
              submitted={runStatus === 'submitted'}
              checkPassed={checkPassed}
              disabled={isViewingPrev}
              showResult={false}
            />
          ) : lesson.type === 'filesystem' ? (
            <FilesystemTask
              key={`filesystem-${viewingTaskId ?? currentTaskId}`}
              fs={fsState}
              onFsChange={isViewingPrev || isForcedTeacherLive ? undefined : handleFsChange}
              onInteraction={isViewingPrev || isForcedTeacherLive ? undefined : handleFsInteraction}
              assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
              assets={lesson.assets}
              disabled={isViewingPrev || isForcedTeacherLive}
            />
          ) : lesson.type === 'scratch' ? (() => {
            const personalSandboxScratchState = inPersonalSandbox
              ? (loadPersonalSandboxCode(lessonId, identity?.anonymousId)?.state ?? lesson.sandboxStarterCode ?? null)
              : null
            const initialProject = inPersonalSandbox ? null : selectScratchInitialProject({
              task,
              taskId: viewingTaskId ?? currentTaskId,
              readSavedCode: sourceTaskId => loadSavedCode(lessonId, sourceTaskId, identity?.anonymousId),
            })
            return (
              <>
                {!isViewingPrev && !isSandbox && !inPersonalSandbox && !isForcedTeacherLive && (
                  <div style={{ display: 'flex', flexShrink: 0, paddingBottom: 4 }}>
                    <button
                      className="btn-ghost-outline"
                      style={styles.resetBtn}
                      onClick={handleResetCode}
                      title="Reset blocks to the starter blocks for this task"
                    >
                      Reset Blocks
                    </button>
                  </div>
                )}
                <ScratchWorkspace
                  key={`scratch-${viewingTaskId ?? currentTaskId}-${isSandbox ? 'sandbox' : inPersonalSandbox ? 'personal-sandbox' : 'task'}`}
                  task={inPersonalSandbox ? null : task}
                  readOnly={isViewingPrev || isForcedTeacherLive}
                  unrestricted={isSandbox || inPersonalSandbox}
                  assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                  initialState={initialProject}
                  onStateChange={isViewingPrev || isForcedTeacherLive ? undefined : handleScratchChange}
                  onCheckResult={isViewingPrev || isForcedTeacherLive || inPersonalSandbox ? undefined : handleScratchCheck}
                  externalState={isSandbox ? scratchSandboxProject : inPersonalSandbox ? personalSandboxScratchState : scratchExternalState}
                  syncNowKey={session?.activeStudentView === identity?.anonymousId ? session?.activeStudentView : null}
                />
              </>
            )
          })()
          : lesson.type === 'python' ? (
            <>
              {!isViewingPrev && !isForcedTeacherLive && (
                <div style={styles.studentEditorHeader} className="ui-tabs ui-tabs--editor">
                  <span style={styles.studentEditorTitle}>Code</span>
                  <div style={styles.studentEditorActions}>
                    {task?.interactionMode === 'submit' ? (
                      <button
                        className="btn-primary"
                        style={styles.studentEditorPrimaryBtn}
                        onClick={handleSubmit}
                      >
                        Submit
                      </button>
                    ) : (
                      <button
                        className={running ? 'btn-danger' : 'btn-primary'}
                        style={styles.studentEditorPrimaryBtn}
                        onClick={running ? handleStop : handleRun}
                        disabled={!running && pyodideStatus === 'loading'}
                      >
                        {running ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                      </button>
                    )}
                    <button
                      className="btn-ghost-outline"
                      style={styles.resetBtn}
                      onClick={handleResetCode}
                      disabled={running}
                      title="Reset code to the starter code for this task"
                    >
                      Reset Code
                    </button>
                  </div>
                </div>
              )}
              <PythonEditor
                code={isForcedTeacherLive ? displayCode : isViewingPrev ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.code ?? '') : code}
                readOnly={isViewingPrev || isForcedTeacherLive}
                onChange={isViewingPrev || isForcedTeacherLive ? undefined : handleCodeChange}
                onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorSelection}
                onActivity={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorActivity}
                remoteSelection={isForcedTeacherLive ? displaySelection : null}
                pyodideStatus={pyodideStatus}
              />
              {!isViewingPrev && !isForcedTeacherLive && (
                task?.interactionMode === 'submit' ? (
                  <>
                    {runStatus === 'submitted' && (
                      task?.check
                        ? null
                        : <div style={styles.submitBanner}>Code submitted</div>
                    )}
                  </>
                ) : (
                  <>
                    <OutputPanel
                      output={output}
                      runStatus={runStatus}
                      inputPrompt={inputPrompt}
                      onInputSubmit={handleInputSubmit}
                      checkPassed={checkPassed}
                      hasCheck={!!task?.check}
                      running={running}
                    />
                  </>
                )
              )}
              {isForcedTeacherLive && (
                <OutputPanel
                  output={displayOutput}
                  runStatus={displayRunStatus}
                  checkPassed={displayCheckPassed}
                  hasCheck={!!task?.check}
                  checkAttempted={displayCheckAttempted}
                />
              )}
              {isViewingPrev && (
                <OutputPanel
                  output={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.output ?? ''}
                  runStatus={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.runStatus ?? null}
                  checkPassed={false}
                  hasCheck={false}
                  checkAttempted={false}
                />
              )}
            </>
          ) : isMobile ? (
            <div style={styles.htmlMobile}>
              <div style={styles.htmlLeft}>
                {!isViewingPrev && !isForcedTeacherLive && (
                  <StudentEditorHeader
                    task={task}
                    running={running}
                    onRun={handleRun}
                    onSubmit={handleSubmit}
                    onReset={handleResetCode}
                  />
                )}
                <HtmlEditor
                  files={displayFiles}
                  activeFile={displayActiveFile}
                  onTabChange={isForcedTeacherLive ? undefined : handleFileTabChange}
                  onFileChange={isViewingPrev || isForcedTeacherLive ? undefined : handleFileChange}
                  onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorSelection}
                  onActivity={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorActivity}
                  remoteSelection={isForcedTeacherLive && displaySelection?.file === displayActiveFile ? displaySelection : null}
                  readOnly={isViewingPrev || isForcedTeacherLive}
                  assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                  assets={lesson.assets}
                />
              </div>
              {task?.interactionMode !== 'submit' && (
                <div style={styles.htmlMobilePreview}>
                  <CollapsibleIframePreview
                    src={isForcedTeacherLive ? teacherLiveIframeSrc : iframeSrc}
                    iframeRef={iframeRef}
                    fill
                    collapsed={htmlPreviewCollapsed}
                    onToggle={() => setHtmlPreviewCollapsed(v => !v)}
                    animate
                  />
                </div>
              )}
              {displayRunStatus === 'submitted' && !task?.check && (
                <div style={styles.submitBanner}>Code submitted</div>
              )}
            </div>
          ) : (
            <>
            <SplitPane
              style={styles.htmlSplitPane}
              rightCollapsed={task?.interactionMode === 'submit' || htmlPreviewCollapsed}
              collapsedRightWidth={task?.interactionMode === 'submit' ? 0 : 44}
              collapsedRight={
                task?.interactionMode === 'submit' ? null : (
                  <CollapsibleIframePreview
                    src={isForcedTeacherLive ? teacherLiveIframeSrc : iframeSrc}
                    iframeRef={iframeRef}
                    collapsed
                    onToggle={() => setHtmlPreviewCollapsed(false)}
                  />
                )
              }
              left={
                <div style={styles.htmlLeft}>
                  {!isViewingPrev && !isForcedTeacherLive && (
                    <StudentEditorHeader
                      task={task}
                      running={running}
                      onRun={handleRun}
                      onSubmit={handleSubmit}
                      onReset={handleResetCode}
                    />
                  )}
                  <HtmlEditor
                    files={displayFiles}
                    activeFile={displayActiveFile}
                    onTabChange={isForcedTeacherLive ? undefined : handleFileTabChange}
                    onFileChange={isViewingPrev || isForcedTeacherLive ? undefined : handleFileChange}
                    onSelectionChange={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorSelection}
                    onActivity={isViewingPrev || isForcedTeacherLive ? undefined : handleEditorActivity}
                    remoteSelection={isForcedTeacherLive && displaySelection?.file === displayActiveFile ? displaySelection : null}
                    readOnly={isViewingPrev || isForcedTeacherLive}
                    assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                    assets={lesson.assets}
                  />
                </div>
              }
              right={
                <CollapsibleIframePreview
                  src={isForcedTeacherLive ? teacherLiveIframeSrc : iframeSrc}
                  iframeRef={iframeRef}
                  fill
                  collapsed={false}
                  onToggle={() => setHtmlPreviewCollapsed(true)}
                  animate
                />
              }
            />
            {displayRunStatus === 'submitted' && !task?.check && (
              <div style={styles.submitBanner}>Code submitted</div>
            )}
            </>
          )}

          {false && isSolo && (
            <div style={styles.soloNav}>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentIndex <= 0}
                onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
              >
                ← Previous
              </button>
              <span style={styles.soloNavLabel}>
                Task {currentIndex + 1} of {flatTasks.length}
              </span>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentIndex >= flatTasks.length - 1}
                onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        </TaskSlideTransition>
      </div>
      {isSolo && (
        <div style={styles.soloNav}>
          {!inPersonalSandbox && (
            <button
              className="btn-secondary"
              style={styles.soloNavBtn}
              disabled={currentIndex <= 0}
              onClick={() => handleSoloNavigate(flatTasks[currentIndex - 1]?.id)}
            >
              Previous
            </button>
          )}
          {inPersonalSandbox ? (
            <span style={styles.soloNavLabel}>Personal Sandbox</span>
          ) : (
            <span style={styles.soloNavLabel}>
              Task {currentIndex + 1} of {flatTasks.length}
            </span>
          )}
          {inPersonalSandbox ? null : hasPersonalSandbox && !isQuizTask && !isInformationTask && (
            <button
              className="btn-ghost-outline"
              style={{ ...styles.soloNavBtn, fontSize: 14 }}
              onClick={handleEnterPersonalSandbox}
              title="Open your personal sandbox to experiment freely"
            >
              Open Sandbox
            </button>
          )}
          {!inPersonalSandbox && (
            <button
              className={`btn-secondary${checkPassed && currentIndex < flatTasks.length - 1 ? ' btn-next-success' : ''}`}
              style={{
                ...styles.soloNavBtn,
                ...(canNavigateNextSolo && currentIndex < flatTasks.length - 1
                  ? { fontSize: 18, padding: '14px 36px' }
                  : {}),
              }}
              disabled={currentIndex >= flatTasks.length - 1 || !canNavigateNextSolo}
              onClick={() => handleSoloNavigate(flatTasks[currentIndex + 1]?.id)}
              title={!canNavigateNextSolo ? 'Pass the completion check before moving on' : 'Next task'}
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
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
    padding: '16px',
    minHeight: 0,
  },
  teacherLiveBanner: {
    background: 'var(--colour-primary)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1.15rem',
    padding: '16px 20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    letterSpacing: '0.01em',
  },
  presentationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  presentationBtn: {
    fontSize: 13,
    padding: '5px 12px',
  },
  presentationTaskLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    minWidth: 72,
    textAlign: 'center',
  },
  taskContent: {
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
    overflow: 'hidden',
  },
  taskContentInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorArea: {
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
    overflow: 'hidden',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  taskContentScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'visible',
  },
  editorAreaScratch: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 0',
    flexShrink: 0,
  },
  htmlMobileButtonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    margin: '0 0 4px',
    flexShrink: 0,
  },
  studentEditorHeader: {
    flexShrink: 0,
  },
  studentEditorTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: 'var(--colour-primary)',
    padding: '0 10px',
  },
  studentEditorActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    flexWrap: 'wrap',
  },
  studentEditorPrimaryBtn: {
    padding: '7px 18px',
    fontSize: 13,
    flexShrink: 0,
  },
  resetBtn: {
    fontSize: 14,
    padding: '9px 20px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 420,
    overflow: 'visible',
    gap: 0,
    paddingBottom: 4,
  },
  htmlMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
  },
  htmlMobilePreview: {
    minHeight: 300,
    height: 300,
    display: 'flex',
    flexDirection: 'column',
  },
  htmlSplitPane: {
    flex: '0 0 auto',
    minHeight: 520,
    height: 520,
    overflow: 'visible',
  },
  centreScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  taskTitleHeader: {
    background: 'var(--colour-primary-dark)',
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    padding: '10px 16px',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  prevBanner: {
    background: 'rgba(239,68,68,0.08)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
  },
  personalSandboxBanner: {
    background: 'rgba(124,58,237,0.08)',
    borderBottom: '1px solid rgba(124,58,237,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#5b21b6',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    flexShrink: 0,
  },
  soloNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px 16px',
    borderTop: '2px solid #e5e7eb',
    background: '#f5f5f5',
    flexShrink: 0,
  },
  soloNavBtn: {
    fontSize: 16,
    padding: '12px 28px',
    fontWeight: 600,
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
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
  submitBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#1e40af',
    fontWeight: 600,
  },
  submitCheckPass: {
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  submitCheckFail: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
}
