import { getTaskModuleType } from '../shared/composedLesson'
import { parseScratchState } from '../shared/workspaceData'
import { getModuleDefinition } from '../modules/definitions.js'
import { noLiveExtras } from '../modules/moduleContract.js'

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
  desktopState,
  arcadeDesign,
  files,
  activeFile,
  output,
  runStatus,
}) {
  // Always resolve the module from the task, never from lesson.type — a
  // composed lesson's tasks can each be a different module.
  const moduleType = getTaskModuleType(lesson, taskId) ?? lesson?.type ?? null
  const definition = getModuleDefinition(moduleType)
  const stateKind = definition?.capabilities.sandboxState
  // Filesystem and Desktop state travels as a JSON string in `code` (their wire.toCode), like
  // everywhere else.
  const jsonStateByKind = { fs: fsState, desktop: desktopState }
  const isJsonState = Object.hasOwn(jsonStateByKind, stateKind ?? '')
  // Scratch never routes edits through the generic `code` state, so reading
  // `code` here would capture whatever an earlier non-Scratch task left behind.
  // Same reasoning as currentTeacherLivePayload in useTeacherLivePublish.js.
  const isScratch = stateKind === 'blocks'
  const { arcadeDesign: liveArcadeDesign } = (definition?.wire.liveExtras ?? noLiveExtras)({
    arcadeDesign,
  })

  return {
    lessonType: moduleType,
    taskId: taskId ?? null,
    code: isJsonState
      ? definition.wire.toCode(jsonStateByKind[stateKind] ?? null)
      : isScratch
        ? (scratchCode ?? '')
        : (code ?? ''),
    arcadeDesign: liveArcadeDesign ?? null,
    // Raw filenames here; useSession encodes file keys at the write boundary,
    // the same way it does for teacherLive.
    files: isJsonState
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

// Firebase errors reach the student verbatim otherwise. "PERMISSION_DENIED:
// Permission denied" means the rules in database.rules.json have not been
// deployed (`firebase deploy --only database`) — a deployment problem, not
// anything the student did or can fix.
export function describeShareError(err) {
  const raw = err?.message ?? ''
  if (/permission[_ ]denied/i.test(raw)) {
    return 'Sharing is not set up on this server yet — let your teacher know.'
  }
  if (/too large to share/i.test(raw)) return raw
  return 'Could not share this workspace. Try again in a moment.'
}

// Copy a shared snapshot into the student's own work through their normal change handlers, so
// it persists exactly like their own edits. Scratch, Filesystem and Desktop carry their state
// as a JSON string in `code`; HTML carries files; everything else is plain code.
export function applySharedWorkspaceCopy({ code, files, moduleType }, handlers) {
  const stateKind = getModuleDefinition(moduleType)?.capabilities.sandboxState
  const applyJsonState = {
    blocks: handlers.handleScratchChange,
    fs: handlers.handleFsChange,
    desktop: handlers.handleDesktopChange,
  }
  if (stateKind === 'files') {
    for (const file of files ?? []) handlers.handleFileChange(file.name, file.content)
  } else if (Object.hasOwn(applyJsonState, stateKind ?? '')) {
    const parsed = parseScratchState(code)
    if (parsed) applyJsonState[stateKind](parsed)
  } else {
    handlers.handleCodeChange(code ?? '')
  }
}
