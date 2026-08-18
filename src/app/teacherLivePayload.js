import { findTaskById } from '../shared/taskUtils'
import { decodeFileKey } from '../shared/fileKeys'
import { getTaskModuleType } from '../shared/composedLesson'

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
    lessonType: getTaskModuleType(lesson, taskId) ?? lesson?.type,
    code: student.currentCode ?? '',
    arcadeDesign: student.currentArcadeDesign ?? null,
    spriteState: student.currentSpriteState ?? null,
    cursor: student.currentCursor ?? null,
    blockDrag: student.currentBlockDrag ?? null,
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
