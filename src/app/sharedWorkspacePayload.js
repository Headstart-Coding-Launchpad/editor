import { getTaskModuleType } from '../shared/composedLesson'

// Workspace sharing captures a frozen snapshot of a student's work at one
// moment. Live-only interaction state (cursor, block drag, sprite runtime,
// selection, activity) is deliberately left out: it is meaningless once frozen
// and would only inflate a payload that has to travel to the whole class.
//
// A snapshot is always written by the sharer's own client. The teacher cannot
// build one, because students/{id}/currentCode is only fresh while
// activeStudentView matches that student, and a student pressing Share is
// almost never the watched one.

// Scratch and Arcade snapshots are the large ones. Refuse anything past this
// rather than pushing megabytes at every student in the class.
export const SHARE_PAYLOAD_MAX_BYTES = 512 * 1024

export function buildSharedWorkspaceSnapshot({
  lesson,
  taskId,
  code,
  scratchCode,
  fsState,
  arcadeDesign,
  files,
  activeFile,
  output,
  runStatus,
}) {
  // Always resolve the module from the task, never from lesson.type — a
  // composed lesson's tasks can each be a different module.
  const moduleType = getTaskModuleType(lesson, taskId) ?? lesson?.type ?? null
  const isFilesystem = moduleType === 'filesystem'
  // Scratch never routes edits through the generic `code` state, so reading
  // `code` here would capture whatever an earlier non-Scratch task left behind.
  // Same reasoning as currentTeacherLivePayload in useTeacherLivePublish.js.
  const isScratch = moduleType === 'scratch'

  return {
    lessonType: moduleType,
    taskId: taskId ?? null,
    code: isFilesystem
      ? JSON.stringify(fsState ?? null)
      : isScratch
        ? (scratchCode ?? '')
        : (code ?? ''),
    arcadeDesign: moduleType === 'arcade' ? (arcadeDesign ?? null) : null,
    // Raw filenames here; useSession encodes file keys at the write boundary,
    // the same way it does for teacherLive.
    files: isFilesystem
      ? {}
      : Object.fromEntries((files ?? []).map((f) => [f.name, f.content ?? ''])),
    activeFile: activeFile ?? '',
    output: output ?? '',
    runStatus: runStatus ?? null,
    capturedAt: Date.now(),
  }
}

export function measureSnapshotBytes(snapshot) {
  try {
    return new TextEncoder().encode(JSON.stringify(snapshot ?? null)).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function isSnapshotWithinLimit(snapshot) {
  return measureSnapshotBytes(snapshot) <= SHARE_PAYLOAD_MAX_BYTES
}

export function buildShareIndexEntry({ sharerId, sharerName, task, taskId, lessonType, sharedBy }) {
  return {
    sharerId: sharerId ?? null,
    sharerName: sharerName ?? 'A student',
    taskId: taskId ?? null,
    taskTitle: task?.title ?? '',
    lessonType: lessonType ?? null,
    sharedBy: sharedBy === 'teacher' ? 'teacher' : 'student',
    sharedAt: Date.now(),
  }
}

// Newest first — the gallery and the "what just arrived" toast both want the
// most recent share at the top.
export function sortedShareEntries(sharedWorkspaces) {
  return Object.entries(sharedWorkspaces ?? {})
    .map(([shareId, entry]) => ({ shareId, ...entry }))
    .sort((a, b) => (b.sharedAt ?? 0) - (a.sharedAt ?? 0))
}
