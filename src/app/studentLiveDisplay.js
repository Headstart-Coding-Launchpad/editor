import { decodeFileKey } from '../shared/fileKeys'
import { getModuleDefinition, getModuleTypesWithCapability } from '../modules/definitions'

// Lesson types whose live code is representable as the Presentation View support
// reference (sessions/{lessonId}/teacherLiveReference) — each module's
// `capabilities.teacherLiveReference`. Scratch's live "code" is a serialized Blockly
// project, not text, so it's excluded — see docs/agents/classroom-behaviours.md.
export const TEACHER_LIVE_REFERENCE_TYPES = getModuleTypesWithCapability('teacherLiveReference')

export function toTeacherLiveFiles(files) {
  return files
    ? Object.entries(files).map(([key, content]) => {
        const name = decodeFileKey(key)
        return {
          name,
          content,
          type: name.endsWith('.html') ? 'html' : name.endsWith('.css') ? 'css' : 'javascript',
        }
      })
    : []
}

// Adapts a teacherLiveReference payload into the same shape each module's
// getDisplayState returns for its other tabs, through the module's wire codec: on the
// files channel {files, entryFile} (html); on the code channel `wire.fromCode(code)` — the
// code string itself for code-string modules (capabilities.sandboxState 'code'), a parsed
// object for structured state (fs). Used both for the student-side support-stage
// reference and the teacher's own read-only "Live" tab. Returns null for an
// inactive/unsupported payload.
export function teacherLiveReferenceDisplayState(payload, lessonType) {
  if (!payload || !TEACHER_LIVE_REFERENCE_TYPES.includes(lessonType)) return null
  const definition = getModuleDefinition(lessonType)
  if (!definition) return null
  const { wire } = definition
  if (wire.sandboxChannel === 'files') {
    return {
      files: toTeacherLiveFiles(payload.files),
      entryFile: payload.activeFile || 'index.html',
    }
  }
  if (definition.capabilities.sandboxState === 'code') return wire.fromCode(payload.code ?? '')
  // Structured state: a malformed/partial snapshot mid-broadcast shows nothing rather than throw.
  return wire.fromCode(payload.code || '{}') ?? {}
}

export function deriveStudentLiveDisplay({
  teacherPresentation,
  phase,
  teacherLive,
  identityId,
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
  watchingStudentPanel = false,
}) {
  const inLiveLesson = phase === 'lesson' || phase === 'sandbox'
  const isTeacherLiveViewer = !!(
    !teacherPresentation &&
    inLiveLesson &&
    teacherLive?.active &&
    teacherLive.source === 'teacher'
  )
  const isPresentationStudentViewer = !!(
    teacherPresentation &&
    teacherLive?.active &&
    teacherLive.source === 'student'
  )
  // A student's work broadcast to the class. 'takeover' (the default) locks every other
  // student onto it; 'panel' ("Show to class, keep coding") only offers it: each viewer keeps
  // their own editor and chooses to watch (watchingStudentPanel) or try a throwaway copy.
  const isOtherStudentBroadcast = !!(
    !teacherPresentation &&
    inLiveLesson &&
    teacherLive?.active &&
    teacherLive.source === 'student' &&
    teacherLive.sourceStudentId !== identityId
  )
  const isStudentPanelBroadcast = isOtherStudentBroadcast && teacherLive.mode === 'panel'
  const isStudentGoLiveViewer =
    isOtherStudentBroadcast && (!isStudentPanelBroadcast || !!watchingStudentPanel)
  const isForcedTeacherLive =
    isTeacherLiveViewer || isPresentationStudentViewer || isStudentGoLiveViewer
  // Students watching a broadcast can't lift the code out of it. Deliberately narrower
  // than isForcedTeacherLive: isPresentationStudentViewer is the *presenting teacher*
  // watching a pinned student, and a teacher keeps normal selection on their own screen.
  const isLiveCopyBlocked = isTeacherLiveViewer || isStudentGoLiveViewer
  const teacherLiveFiles = toTeacherLiveFiles(teacherLive?.files)

  return {
    isTeacherLiveViewer,
    isPresentationStudentViewer,
    isStudentGoLiveViewer,
    isStudentPanelBroadcast,
    isTeacherLiveActive: !!(
      teacherPresentation &&
      teacherLive?.active &&
      teacherLive.source === 'teacher'
    ),
    isForcedTeacherLive,
    isLiveCopyBlocked,
    displayedTaskId: isForcedTeacherLive
      ? (teacherLive?.taskId ?? currentTaskId)
      : (viewingTaskId ?? currentTaskId),
    displayCode: isForcedTeacherLive ? (teacherLive.code ?? '') : code,
    displayArcadeDesign: isForcedTeacherLive ? (teacherLive.arcadeDesign ?? null) : null,
    displayTurtleResult: isForcedTeacherLive ? (teacherLive.turtleResult ?? null) : null,
    displaySpriteState: isForcedTeacherLive ? (teacherLive.spriteState ?? null) : null,
    displayCursor: isForcedTeacherLive ? (teacherLive.cursor ?? null) : null,
    displayBlockDrag: isForcedTeacherLive ? (teacherLive.blockDrag ?? null) : null,
    displayCodeArrangeSlots: isForcedTeacherLive ? (teacherLive.codeArrangeSlots ?? null) : null,
    displayCodeArrangeCursor: isForcedTeacherLive ? (teacherLive.codeArrangeCursor ?? null) : null,
    displayFiles: isForcedTeacherLive ? teacherLiveFiles : files,
    displayActiveFile: isForcedTeacherLive
      ? (teacherLive.activeFile ?? teacherLiveFiles[0]?.name ?? '')
      : activeFile,
    displayOutput: isForcedTeacherLive ? (teacherLive.output ?? '') : output,
    displayRunStatus: isForcedTeacherLive ? (teacherLive.runStatus ?? null) : runStatus,
    displayCheckPassed: isForcedTeacherLive ? !!teacherLive.checkPassed : checkPassed,
    displayCheckAttempted: isForcedTeacherLive ? !!teacherLive.checkAttempted : checkAttempted,
    displayCheckSuggestion: isForcedTeacherLive
      ? (teacherLive.checkSuggestion ?? '')
      : checkSuggestion,
    displaySelection: isForcedTeacherLive ? (teacherLive.selection ?? null) : null,
    // The broadcast's serialised activity state (teacherLive.answer). Activity tasks render it
    // read-only through ActivityHost; null when not forced-live (the viewer's own state shows).
    displayAnswer: isForcedTeacherLive ? (teacherLive.answer ?? null) : null,
    displayActivity: isForcedTeacherLive ? (teacherLive.activity ?? null) : editorActivity,
    // A forced-live viewer's output/preview panel mirrors the source's
    // expanded/collapsed state continuously (locked, not just a one-time
    // seed) — see publishOutputCollapsed in useTeacherLivePublish.js. Only
    // meaningful while forced-live; null otherwise since the component uses
    // its own local toggle state in that case.
    displayOutputCollapsed: isForcedTeacherLive ? !!teacherLive.outputCollapsed : null,
  }
}

// A student broadcast as a SharedWorkspaceViewer snapshot ({taskId, lessonType, code, files,
// arcadeDesign}): what "Try a copy" on a "Show to class" broadcast opens. Files arrive with
// encoded keys on the wire and leave as a filename → content map.
export function teacherLiveToSnapshot(teacherLive) {
  if (!teacherLive?.active) return null
  return {
    taskId: teacherLive.taskId ?? null,
    lessonType: teacherLive.lessonType ?? null,
    code: teacherLive.code ?? '',
    files: Object.fromEntries(
      toTeacherLiveFiles(teacherLive.files).map((f) => [f.name, f.content])
    ),
    arcadeDesign: teacherLive.arcadeDesign ?? null,
  }
}
