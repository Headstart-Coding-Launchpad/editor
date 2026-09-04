import { decodeFileKey } from '../shared/fileKeys'

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
