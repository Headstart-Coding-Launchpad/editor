import { useState, useEffect, useRef } from 'react'
import { buildIframeSrc } from '../../shared/iframe'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { flattenTasks } from '../../shared/taskUtils'
import { toTeacherLiveFiles } from '../studentLiveDisplay'

/**
 * Owns the teacher-live broadcast helpers and the two related effects:
 *   1. Rebuild teacherLiveIframeSrc when the teacher's HTML live state updates.
 *   2. Publish the full payload whenever any watched value changes.
 */
export function useTeacherLivePublish({
  teacherPresentation,
  // Stable refs (read at call time inside async/event handlers)
  identityRef,
  sessionRef,
  lessonRef,
  currentTaskIdRef,
  codeRef,
  filesRef,
  activeFileRef,
  outputRef,
  runStatusRef,
  fsStateRef,
  editorSelectionRef,
  editorActivityRef,
  // Reactive values — used by the sync dep array and payload snapshot
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
  fsState,
  // Callbacks
  updateTeacherLive,
}) {
  const [teacherLiveIframeSrc, setTeacherLiveIframeSrc] = useState(null)
  const [htmlPreviewCollapsed, setHtmlPreviewCollapsed] = useState(true)

  const checkPassedRef = useRef(checkPassed)
  checkPassedRef.current = checkPassed
  const checkAttemptedRef = useRef(checkAttempted)
  checkAttemptedRef.current = checkAttempted
  const checkSuggestionRef = useRef(checkSuggestion)
  checkSuggestionRef.current = checkSuggestion

  function canPublishTeacherLive() {
    const s = sessionRef.current
    if (!s?.teacherLive?.active) return false
    if (teacherPresentation) return s?.teacherLive?.source !== 'student'
    return s.teacherLive.sourceStudentId === identityRef.current?.anonymousId
  }

  function currentTeacherLivePayload(extra = {}) {
    const isFilesystem = lessonRef.current?.type === 'filesystem'
    const filesMap = isFilesystem ? {} : Object.fromEntries(filesRef.current.map(f => [f.name, f.content]))
    const sourceStudentId = teacherPresentation ? null : identityRef.current?.anonymousId
    const sourceStudentName = teacherPresentation ? null : identityRef.current?.displayName
    return {
      active: true,
      source: teacherPresentation ? 'teacher' : 'student',
      sourceStudentId,
      sourceStudentName,
      taskId: currentTaskIdRef.current,
      lessonType: lessonRef.current?.type,
      code: isFilesystem ? JSON.stringify(fsStateRef.current) : codeRef.current,
      files: filesMap,
      activeFile: activeFileRef.current,
      output: outputRef.current,
      runStatus: runStatusRef.current,
      checkPassed: checkPassedRef.current,
      checkAttempted: checkAttemptedRef.current,
      checkSuggestion: checkSuggestionRef.current,
      selection: editorSelectionRef.current,
      activity: editorActivityRef.current,
      ...extra,
    }
  }

  function publishTeacherLive(extra = {}) {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload(extra))
  }

  // Rebuild the teacher-live iframe src when the teacher's HTML live state updates
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
      storageAssets: (lesson.storageAssets ?? []).filter(a => a.showInEditor),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, lesson?.type, session?.teacherLive?.updatedAt])

  // Publish the current payload whenever any tracked value changes
  useEffect(() => {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, session?.teacherLive?.active, session?.teacherLive?.sourceStudentId, identity?.anonymousId, currentTaskId, code, JSON.stringify(files), activeFile, output, runStatus, checkPassed, checkAttempted, checkSuggestion, fsState])

  return { teacherLiveIframeSrc, htmlPreviewCollapsed, setHtmlPreviewCollapsed, canPublishTeacherLive, currentTeacherLivePayload, publishTeacherLive }
}
