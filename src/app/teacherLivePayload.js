import { findTaskById } from '../shared/taskUtils'
import { decodeFileKey } from '../shared/fileKeys'

export function buildStudentLivePayload({ student, lesson, taskId, entryFileTaskId }) {
  const task = findTaskById(lesson?.tasks, entryFileTaskId)
  const files = student.currentFiles
    ? Object.fromEntries(Object.entries(student.currentFiles).map(([key, content]) => [decodeFileKey(key), content]))
    : {}

  return {
    source: 'student',
    sourceStudentId: student.anonymousId,
    sourceStudentName: student.displayName,
    taskId,
    lessonType: lesson?.type,
    code: student.currentCode ?? '',
    files,
    activeFile: task?.entryFile ?? Object.keys(files)[0] ?? '',
    output: student.currentOutput ?? '',
    runStatus: student.lastRunStatus ?? null,
    checkPassed: !!student.checkPassed,
    checkAttempted: student.checkPassed != null || student.lastRunStatus != null,
    selection: student.currentSelection ?? null,
    activity: student.currentActivity ?? null,
  }
}
