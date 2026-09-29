import { useState, useEffect, useRef } from 'react'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { findTaskById, flattenTasks } from '../../shared/taskUtils'
import { allowsStudentBroadcast } from '../../activities/registry.pure.js'
import { toTeacherLiveFiles } from '../studentLiveDisplay'
import { getLessonModule } from '../../modules/registry'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { getModuleDefinition } from '../../modules/definitions.js'
import { noLiveExtras } from '../../modules/moduleContract.js'

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
  // codeRef / filesRef / activeFileRef: what a lesson type without a module definition (none
  // today) publishes.
  codeRef,
  turtleResultRef,
  filesRef,
  activeFileRef,
  outputRef,
  runStatusRef,
  // Generic work slot (every module since plan step 4.5): readWorkValue(moduleType) returns
  // that module's latest work (or its default when the slot holds another module's work). The
  // payload's code / files / activeFile and extras come from it through the module's wire.
  readWorkValue,
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
  // The current module's work-slot value (null for other modules): a publish trigger.
  workValue = null,
  iframeStorageAssets = null,
  // Optional ref to a function returning extra payload fields for the current task (the
  // activity host adds `answer`, the serialised activity state, on activity tasks).
  extraPayloadRef = null,
  // Callbacks
  updateTeacherLive,
  setTeacherLiveReference,
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
    if (s.teacherLive.sourceStudentId !== identityRef.current?.anonymousId) return false
    // Quiz and activity tasks are teacher-only broadcasts: a student's answers are never
    // pushed to the class, even if a broadcast of their earlier code task is still running.
    return allowsStudentBroadcast(findTaskById(lessonRef.current?.tasks, currentTaskIdRef.current))
  }

  function currentTeacherLivePayload(extra = {}) {
    const lessonType = lessonRef.current?.type
    const definition = getModuleDefinition(lessonType)
    // Work-slot modules publish their work through the wire: on the code channel as
    // wire.toCode — the code string, or a JSON string for scratch/filesystem/desktop ('' while
    // Scratch has reported nothing) — with their extras (Arcade's design) and no files; on the
    // files channel (html) as a filename → content map with an empty code.
    // Scratch publishes what its workspace last reported, never codeRef, which may still hold
    // whatever an earlier non-Scratch task left behind (that would wipe the mirror's blocks the
    // moment a broadcast starts, until the next real edit resynced it).
    const isWorkSlot = definition?.workSlot != null
    const stored = isWorkSlot ? definition.workSlot.stored(readWorkValue(lessonType)) : null
    const onFilesChannel = isWorkSlot && definition.wire.sandboxChannel === 'files'
    // teacherLive is an update() merge, so every module sends both extras (explicit nulls
    // for the ones it doesn't have) — see each definition's wire.liveExtras. A module's own
    // extras come with its work (Arcade's design); Turtle's drawing is a run result.
    const { arcadeDesign, turtleResult } = (definition?.wire.liveExtras ?? noLiveExtras)({
      turtleResult: turtleResultRef?.current,
      ...stored?.meta,
    })
    const filesMap = !isWorkSlot
      ? Object.fromEntries(filesRef.current.map((f) => [f.name, f.content]))
      : onFilesChannel
        ? definition.wire.toFilesMap(stored.work)
        : {}
    const slotCode = !isWorkSlot
      ? null
      : onFilesChannel || stored.work == null
        ? ''
        : definition.wire.toCode(stored.work)
    const sourceStudentId = teacherPresentation ? null : identityRef.current?.anonymousId
    const sourceStudentName = teacherPresentation ? null : identityRef.current?.displayName
    return {
      active: true,
      source: teacherPresentation ? 'teacher' : 'student',
      sourceStudentId,
      sourceStudentName,
      taskId: currentTaskIdRef.current,
      lessonType: lessonRef.current?.type,
      code: isWorkSlot ? slotCode : codeRef.current,
      arcadeDesign,
      turtleResult,
      files: filesMap,
      // A files module's own active file; no other module has one (never a leftover).
      activeFile: !isWorkSlot
        ? activeFileRef.current
        : onFilesChannel
          ? (readWorkValue(lessonType)?.activeFile ?? '')
          : '',
      output: outputRef.current,
      runStatus: runStatusRef.current,
      checkPassed: checkPassedRef.current,
      checkAttempted: checkAttemptedRef.current,
      checkSuggestion: checkSuggestionRef.current,
      selection: editorSelectionRef.current,
      activity: editorActivityRef.current,
      ...(extraPayloadRef?.current?.() ?? {}),
      ...extra,
    }
  }

  function publishTeacherLive(extra = {}) {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload(extra))
  }

  // Mirrors the source's output/preview panel collapse state to forced-live
  // viewers, continuously (not just a one-time seed) — see
  // studentLiveDisplay.js's displayOutputCollapsed. Deliberately a small
  // standalone merge-update rather than routed through the full
  // currentTeacherLivePayload()/publish-effect machinery above: updateTeacherLive
  // is a Firebase `update()` (merge, not overwrite), so this one field persists
  // across every other payload publish without needing to be threaded through
  // every call site that builds a payload.
  function publishOutputCollapsed(collapsed) {
    if (!canPublishTeacherLive()) return
    updateTeacherLive({ outputCollapsed: collapsed })
  }

  // Rebuild the teacher-live preview src when the teacher's live state updates
  useEffect(() => {
    // In a composed lesson the viewer can be on a different workspace from the
    // broadcast task. Resolve the preview module from the live task itself,
    // rather than from the viewer's current editor state.
    const sourceLesson = lesson?.composedLesson ?? lesson
    const liveLesson = getEffectiveLessonForTask(sourceLesson, session?.teacherLive?.taskId)
    const mod = liveLesson ? getLessonModule(liveLesson.type) : null
    if (
      teacherPresentation ||
      !mod?.runtime?.buildPreviewSrc ||
      !session?.teacherLive?.active ||
      !session.teacherLive.files
    ) {
      setTeacherLiveIframeSrc(null)
      return
    }
    const liveFiles = toTeacherLiveFiles(session.teacherLive.files)
    const liveTask = flattenTasks(sourceLesson?.tasks ?? []).find(
      (t) => t.id === session.teacherLive.taskId
    )
    setHtmlPreviewCollapsed(false)
    setTeacherLiveIframeSrc(
      mod.runtime.buildPreviewSrc(
        { files: liveFiles, entryFile: liveTask?.entryFile ?? 'index.html' },
        liveTask,
        {
          assets: liveLesson?.assets ?? [],
          assetsPath: resolveAssetsPath(liveLesson?.assetsPath),
          storageAssets: iframeStorageAssets ?? liveLesson?.storageAssets ?? [],
        }
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teacherPresentation,
    lesson?.type,
    session?.teacherLive?.updatedAt,
    JSON.stringify(iframeStorageAssets ?? []),
  ])

  // Publish the current payload whenever any tracked value changes
  useEffect(() => {
    if (!canPublishTeacherLive()) return
    updateTeacherLive(currentTeacherLivePayload())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teacherPresentation,
    session?.teacherLive?.active,
    session?.teacherLive?.sourceStudentId,
    identity?.anonymousId,
    currentTaskId,
    code,
    JSON.stringify(files),
    activeFile,
    output,
    runStatus,
    checkPassed,
    checkAttempted,
    checkSuggestion,
    workValue,
  ])

  // The reference channel only follows work of modules that offer a teacher-live reference
  // (filesystem, not desktop), as it did when each module had its own state.
  const referenceWorkValue = getModuleDefinition(lesson?.type)?.capabilities.teacherLiveReference
    ? workValue
    : null

  // Publish the soft support-reference channel whenever Presentation View is open,
  // independent of whether the "Go Live" force takeover (teacherLive) is toggled on —
  // see setTeacherLiveReference in useSession.js.
  useEffect(() => {
    if (!teacherPresentation || !setTeacherLiveReference) return
    setTeacherLiveReference(currentTeacherLivePayload())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, currentTaskId, code, JSON.stringify(files), referenceWorkValue])

  // Clear it the moment Presentation View closes, so it never outlives the window.
  // setTeacherLiveReference is deliberately excluded from the deps below — like every
  // other useSession callback in this file, it's a new function identity on every
  // render (useSession's functions aren't memoized, and its owner re-renders on any
  // realtime session change). Depending on it here would re-fire this cleanup on
  // every unrelated session update, wiping teacherLiveReference to null far more often
  // than Presentation View actually closes.
  useEffect(() => {
    if (!teacherPresentation || !setTeacherLiveReference) return
    return () => setTeacherLiveReference(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation])

  return {
    teacherLiveIframeSrc,
    htmlPreviewCollapsed,
    setHtmlPreviewCollapsed,
    canPublishTeacherLive,
    currentTeacherLivePayload,
    publishTeacherLive,
    publishOutputCollapsed,
  }
}
