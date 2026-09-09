import { decodeFileKey } from '../shared/fileKeys'

// Lesson types whose live code is representable as the Presentation View support
// reference (sessions/{lessonId}/teacherLiveReference). Scratch's live "code" is a
// serialized Blockly project, not text, so it's excluded — see
// docs/agents/classroom-behaviours.md.
export const TEACHER_LIVE_REFERENCE_TYPES = ['python', 'html', 'arcade', 'electronics', 'filesystem']

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
// getDisplayState returns for its other tabs (a code string for python/arcade/
// electronics, {files, entryFile} for html, an fs object for filesystem) — used
// both for the student-side support-stage reference and the teacher's own
// read-only "Live" tab. Returns null for an inactive/unsupported payload.
export function teacherLiveReferenceDisplayState(payload, lessonType) {
  if (!payload || !TEACHER_LIVE_REFERENCE_TYPES.includes(lessonType)) return null
  if (lessonType === 'python' || lessonType === 'arcade' || lessonType === 'electronics') {
    return payload.code ?? ''
  }
  if (lessonType === 'html') {
    return { files: toTeacherLiveFiles(payload.files), entryFile: payload.activeFile || 'index.html' }
  }
  if (lessonType === 'filesystem') {
    try {
      return JSON.parse(payload.code || '{}')
    } catch {
      // Malformed/partial snapshot mid-broadcast — show nothing rather than throw.
      return {}
    }
  }
  return null
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
  const isStudentGoLiveViewer = !!(
    !teacherPresentation &&
    inLiveLesson &&
    teacherLive?.active &&
    teacherLive.source === 'student' &&
    teacherLive.sourceStudentId !== identityId
  )
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
    displayActivity: isForcedTeacherLive ? (teacherLive.activity ?? null) : editorActivity,
  }
}
