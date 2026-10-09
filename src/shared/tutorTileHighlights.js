// Tutor tile highlights: in StudentModal the tutor taps a placed tile (or an empty blank) on a
// student's drag-and-drop board to mark it "look again", with an optional short note. The
// student sees that blank outlined (the tile-feedback red) with the note, at once. Support, not
// grading: nothing about completion or attempts changes.
//
// Which tasks: the activity decides (`tileHighlights(task)` on its definition): code_arrange
// slot mode, Match, and Fill in the Gaps drag mode. Every one of them keeps its state as a
// `{ [targetId]: tileId }` map, so a highlight is the pair (targetId, tileId):
//   code_arrange  targetId = the blank (slot id), tileId = the tile in it
//   match         targetId = the prompt's pair id, tileId = the answer placed next to it
//   fill_blank    targetId = the blank id, tileId = the tile in it
// tileId is null for a highlighted empty blank.
//
// RTDB shape (docs/agents/runtime-model.md):
//   sessions/{lessonId}/students/{id}/teacherTileHighlights/{highlightId}:
//     { taskId, targetId, tileId, note, createdAt }      teacher-written; cleared by setTaskId
//   sessions/{lessonId}/students/{id}/tileHighlightLog/{taskId}/{pushId}:
//     { targetId, tileId, note, at }                     teacher-written, for the report
//
// A highlight shows only while that blank still holds the tile it was made on
// (isTileHighlightCurrent), and the student's device removes it when the student changes what
// that blank holds (moves the tile out, swaps it, drops one into an empty highlighted blank):
// staleTileHighlightIds compares the student's previous and next board.
//
// Pure and Node-safe: used by useSession, the student hosts, StudentModal, StudentCard and
// lessonReport.js.
import { getTaskActivity } from '../activities/registry.pure.js'
import { readStudentActivityState } from '../activities/state.js'

export const TILE_HIGHLIGHT_NOTE_MAX_LENGTH = 120
// Most tile highlights kept in the report log per student per task.
export const MAX_TILE_HIGHLIGHT_LOG_PER_TASK = 50

// True when the tutor can highlight tiles on this task (the activity decides).
export function supportsTileHighlights(task) {
  const definition = getTaskActivity(task)
  return typeof definition?.tileHighlights === 'function' && !!definition.tileHighlights(task)
}

function tileKey(value) {
  return value == null || value === '' ? null : String(value)
}

// The note as stored: trimmed, capped, null when empty.
export function normalizeTileHighlightNote(note) {
  const text = String(note ?? '')
    .trim()
    .slice(0, TILE_HIGHLIGHT_NOTE_MAX_LENGTH)
  return text || null
}

// The highlights on a task, oldest first: [{ id, taskId, targetId, tileId, note, createdAt }].
export function listTileHighlights(raw, taskId) {
  if (!raw || typeof raw !== 'object' || taskId == null) return []
  return Object.entries(raw)
    .filter(
      ([, entry]) =>
        entry &&
        typeof entry === 'object' &&
        entry.targetId &&
        String(entry.taskId) === String(taskId)
    )
    .map(([id, entry]) => ({
      id,
      taskId: String(entry.taskId),
      targetId: String(entry.targetId),
      tileId: tileKey(entry.tileId),
      note: normalizeTileHighlightNote(entry.note),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : 0,
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

function boardValue(state, targetId) {
  return state && typeof state === 'object' ? tileKey(state[targetId]) : null
}

// True while the highlighted blank still holds the tile it was made on.
export function isTileHighlightCurrent(highlight, state) {
  return boardValue(state, highlight.targetId) === tileKey(highlight.tileId)
}

// The highlights to draw on a board: { [targetId]: { id, tileId, note } } (the newest per blank).
export function activeTileHighlights(highlights, state) {
  const map = {}
  for (const highlight of highlights ?? []) {
    if (!isTileHighlightCurrent(highlight, state)) continue
    map[highlight.targetId] = { id: highlight.id, tileId: highlight.tileId, note: highlight.note }
  }
  return map
}

// Highlights the student's own change from `prevState` to `nextState` cleared: the blank held the
// highlighted tile (or was the highlighted empty blank) and now holds something else.
export function staleTileHighlightIds(highlights, prevState, nextState) {
  return (highlights ?? [])
    .filter((highlight) => {
      const wanted = tileKey(highlight.tileId)
      return (
        boardValue(prevState, highlight.targetId) === wanted &&
        boardValue(nextState, highlight.targetId) !== wanted
      )
    })
    .map((highlight) => highlight.id)
}

// Every highlight entry on one blank of a task (a tap replaces or removes all of them).
export function tileHighlightIdsForTarget(highlights, targetId) {
  return (highlights ?? [])
    .filter((highlight) => highlight.targetId === String(targetId))
    .map((highlight) => highlight.id)
}

// How many highlights the student's board shows right now on the given task (StudentCard),
// read against their mirrored state.
export function countActiveTileHighlights(task, student, taskId) {
  if (!task || !student?.teacherTileHighlights || !supportsTileHighlights(task)) return 0
  const highlights = listTileHighlights(student.teacherTileHighlights, taskId ?? task.id)
  if (highlights.length === 0) return 0
  const state = readStudentActivityState(task, student)
  return Object.keys(activeTileHighlights(highlights, state)).length
}

// The report's per-task `tutorTileHighlights[]` from tileHighlightLog/{taskId}, oldest first.
export function normalizeTileHighlightLog(raw) {
  if (!raw || typeof raw !== 'object') return []
  return Object.values(raw)
    .filter((entry) => entry && typeof entry === 'object' && entry.targetId)
    .map((entry) => {
      const note = normalizeTileHighlightNote(entry.note)
      return {
        targetId: String(entry.targetId),
        tileId: tileKey(entry.tileId),
        ...(note ? { note } : {}),
        at: typeof entry.at === 'number' ? entry.at : null,
      }
    })
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
}
