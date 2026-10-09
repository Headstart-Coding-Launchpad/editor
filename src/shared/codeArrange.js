import { stableHash } from './textUtils.js'
import {
  assembleIndentArrangement,
  buildIndentSolutionState,
  deriveIndentStateFromCode,
  getLines as getIndentLines,
  isIndentArrangeTask,
  pruneIndentState,
} from './codeArrangeIndent.js'

// Pure helpers for the "code_arrange" task type: students assemble a program
// by dragging code tiles into slots, then it actually runs through the real
// Python/HTML pipeline.
//
// Every authored line is a `parts` sequence alternating fixed text and
// slots — there is no separate "whole line" mode/schema branch. A line that
// is just one blank with no surrounding text (`parts: [{type:'slot', ...}]`)
// reads and behaves exactly like a traditional "whole line" tile; a line
// mixing text and slots reads like `for i in range(___):`. The Builder
// defaults a newly added line to that single-slot shape as a convenience,
// but nothing in this module treats it specially.
//
// There is exactly one shared tile pool for the whole task: every slot's own
// correct code, plus the task-level `distractors` list. Any tile in that
// pool can be dropped into any slot — a distractor (or another slot's
// correct tile) placed in the "wrong" slot still assembles and runs for
// real. A slot's own id doubles as the id of its own "correct" tile in that
// pool, so buildSolutionSlotState() needs no separate bookkeeping to know
// which pool tile is the intended answer for a slot.
//
// Tile feedback (bottom of this file): optional authored hints flag a tile dropped into a blank
// where it is known to be wrong. It never decides completion.
//
// These helpers only ever produce a plain code string. The Python/HTML run
// pipeline and the shared check evaluator (src/modules/checks.js) consume
// that string exactly as they would any other task's code — neither one
// needs to know the code came from drag-and-drop tiles. Keeping that boundary
// pure and dependency-free here is what makes it easy to unit test and to
// reuse from both the student workspace and the Lesson Builder preview.
//
// Indent mode (`arrangeMode: indent`, ./codeArrangeIndent.js) fixes the lines and lets the student
// set each one's depth. Its state is a { lineId: depth } map that travels through the same
// storage, live channel and teacher edits, so the state helpers below (prune, complete, assemble,
// solution, derive from code) hand an indent task over to that module.

export function getLines(task) {
  return Array.isArray(task?.lines) ? task.lines : []
}

export function getLineParts(line) {
  return Array.isArray(line?.parts) ? line.parts : []
}

// The ordered slot parts within a single line.
export function getLineSlots(line) {
  return getLineParts(line).filter((part) => part?.type === 'slot')
}

// Every slot across the whole task, in authoring order (line order, then
// part order within a line). This is the full ordered id list a student
// must fill; drives completeness checks.
export function getAllSlots(task) {
  return getLines(task).flatMap((line) => getLineSlots(line))
}

export function getSlotIds(task) {
  return getAllSlots(task).map((slot) => slot.id)
}

export function getDistractors(task) {
  return Array.isArray(task?.distractors) ? task.distractors : []
}

// The single shared tile pool for the whole task: every slot's own correct
// code, normalised to {id, code}, plus the task-level distractor list.
// Sorted by a stable hash of the code (not authoring order) so the pool
// doesn't reveal the answer positions, but stays stable across
// re-renders/reloads.
export function getTaskPool(task) {
  const all = [
    ...getAllSlots(task).map((slot) => ({ id: slot.id, code: slot.code ?? '' })),
    ...getDistractors(task).map((d) => ({ id: d?.id, code: d?.code ?? '' })),
  ]
  return all.sort((a, b) => stableHash(a.code) - stableHash(b.code))
}

// Looks up a tile's display code by its fragment id. Used for the drag-image
// label, which only ever has a tile id to work from.
export function getFragmentCodeById(task, fragmentId) {
  return getTaskPool(task).find((fragment) => fragment.id === fragmentId)?.code ?? ''
}

// Whether a fragment id belongs to the task's shared pool. Used by the
// Builder to prune preview state after edits remove a tile.
export function fragmentIdExists(task, fragmentId) {
  return getTaskPool(task).some((fragment) => fragment.id === fragmentId)
}

// Keeps only the placements that are real tiles of this task: a slot id the task has, holding a
// tile id from the task's pool. A saved or mirrored board can hold ids from an earlier version of
// the task (or, before task-scoped teacher edits, another task's tiles); those show as empty and
// assemble to nothing, so they are dropped rather than counted as filled.
export function pruneSlotState(task, slotState) {
  if (isIndentArrangeTask(task)) return pruneIndentState(task, slotState)
  if (!slotState || typeof slotState !== 'object' || Array.isArray(slotState)) return {}
  const slotIds = new Set(getSlotIds(task))
  const poolIds = new Set(getTaskPool(task).map((fragment) => fragment.id))
  return Object.fromEntries(
    Object.entries(slotState).filter(([slotId, tileId]) => {
      return slotIds.has(slotId) && poolIds.has(tileId)
    })
  )
}

// Complete when every slot holds a tile from the task's pool — an unknown tile id renders as an
// empty blank and assembles to '', so it never counts as filled.
export function isArrangementComplete(task, slotState) {
  // Any depths make a runnable program.
  if (isIndentArrangeTask(task)) return getIndentLines(task).length > 0
  const slotIds = getSlotIds(task)
  if (slotIds.length === 0) return false
  const state = slotState && typeof slotState === 'object' ? slotState : {}
  const poolIds = new Set(getTaskPool(task).map((fragment) => fragment.id))
  return slotIds.every((id) => state[id] != null && state[id] !== '' && poolIds.has(state[id]))
}

// Assembles a single authored line into its final source text, given the
// tile currently selected for each of its slots (slot id -> fragment id,
// looked up in the task's one shared pool) and fixed text segments passed
// through unchanged, in part order.
function assembleLineCode(line, slotState, pool) {
  const state = slotState && typeof slotState === 'object' ? slotState : {}
  return getLineParts(line)
    .map((part) => {
      if (part?.type === 'slot') {
        return pool.find((fragment) => fragment.id === state[part.id])?.code ?? ''
      }
      return part?.text ?? ''
    })
    .join('')
}

// Assembles the full runnable program from the current slot placements: each
// line's parts, joined by newlines. Returns null while the arrangement is
// incomplete — callers should not run or persist an incomplete program as
// the task's code.
export function assembleCodeArrangement(task, slotState) {
  if (isIndentArrangeTask(task)) return assembleIndentArrangement(task, slotState)
  if (!isArrangementComplete(task, slotState)) return null
  const pool = getTaskPool(task)
  return getLines(task)
    .map((line) => assembleLineCode(line, slotState, pool))
    .join('\n')
}

// Builds the arrangement that matches the authored solution: every slot's
// own "native" correct tile (a slot's own id is always its own correct
// fragment's id — see the module doc comment). Used by the Builder preview
// so authors have a one-click way to check their intended solution passes.
export function buildSolutionSlotState(task) {
  if (isIndentArrangeTask(task)) return buildIndentSolutionState(task)
  return Object.fromEntries(getAllSlots(task).map((slot) => [slot.id, slot.id]))
}

// HTML tasks assemble into a single target file — the entry file by default,
// or the first starter file if no entry file is authored yet.
export function getCodeArrangeEntryFile(task) {
  return task?.entryFile || task?.starterFiles?.[0]?.name || 'index.html'
}

// The program a code_arrange task's host work slot currently holds: the entry file's content
// when the host keeps files (`files` given: html), else the code string (python). Compared
// against assembleCodeArrangement() to keep the slot in step with the tiles — Run and the
// attempt log read the slot, never the tiles.
export function getCodeArrangeSlotCode(task, { code, files } = {}) {
  if (Array.isArray(files)) {
    const entryFile = getCodeArrangeEntryFile(task)
    return files.find((f) => f?.name === entryFile)?.content ?? ''
  }
  return typeof code === 'string' ? code : ''
}

// Reconstructs the slot state for a single already-assembled program line,
// given that line's authoring definition and the task's shared pool — the
// inverse of assembleLineCode(). The line's fixed-text parts are known,
// unambiguous anchors, so a small backtracking matcher walks the parts left
// to right, consuming literal text verbatim and, at each slot, trying every
// candidate in the shared pool until the remaining text can still resolve
// all the way to the end of the line (this also correctly handles two slots
// with no fixed text between them, since candidates are tried against the
// task's small known pool rather than parsed as free text). Returns null
// (not a guess) when nothing reproduces the line exactly.
//
// Backtracking runs over the whole task's shared pool rather than a small
// per-slot list, so it assumes lesson-authoring-scale pools (a handful of
// slots/distractors) — fine for how this task type is actually authored.
function deriveLineSlotState(line, codeLine, pool) {
  if (typeof codeLine !== 'string') return null
  const parts = getLineParts(line)

  function match(index, pos, acc) {
    if (index === parts.length) return pos === codeLine.length ? acc : null
    const part = parts[index]
    if (part?.type === 'slot') {
      for (const fragment of pool) {
        if (codeLine.startsWith(fragment.code, pos)) {
          const result = match(index + 1, pos + fragment.code.length, {
            ...acc,
            [part.id]: fragment.id,
          })
          if (result) return result
        }
      }
      return null
    }
    const text = part?.text ?? ''
    if (!codeLine.startsWith(text, pos)) return null
    return match(index + 1, pos + text.length, acc)
  }

  return match(0, 0, {})
}

// Reconstructs a full slot arrangement from an already-assembled code
// string — the inverse of assembleCodeArrangement(). Used to redraw the tile
// board for a teacher live-viewing or editing a student, where the only
// thing that streams is the assembled code/file content (the same
// displayCode/displayFiles or teacherLiveCode/teacherLiveFiles every other
// task type mirrors), never the student's own tile-placement bookkeeping.
//
// Matching is exact and all-or-nothing: the number of program lines must
// equal the number of authored lines, and every individual line must be
// derivable from its own authoring definition. Any mismatch is treated as
// "not derivable" and yields an empty arrangement rather than a guess or a
// thrown error — the run output/checks the teacher sees do not depend on
// this reconstruction, it is a best-effort visual only.
export function deriveSlotStateFromCode(task, code) {
  if (isIndentArrangeTask(task)) return deriveIndentStateFromCode(task, code)
  const lines = getLines(task)
  if (lines.length === 0 || typeof code !== 'string') return {}

  const codeLines = code.split('\n')
  if (codeLines.length !== lines.length) return {}

  const pool = getTaskPool(task)
  const state = {}
  for (let i = 0; i < lines.length; i++) {
    const lineState = deriveLineSlotState(lines[i], codeLines[i], pool)
    if (!lineState) return {}
    Object.assign(state, lineState)
  }
  return state
}

// ─── Tile feedback (known-wrong placements) ─────────────────────────────────
//
// Optional authored fields flag a tile the moment it is dropped into a blank where it is known to
// be wrong, like fill-in-the-blank's instant red blank:
//   distractors[].hint   shown whenever that distractor sits in any blank (a default when none is
//                        authored)
//   slot.wrongTiles      [{ tileId, hint }]: tiles (another blank's own tile, or a distractor)
//                        known to be wrong in this blank, with the hint to show
//   slot.alsoAccepts     [tileId]: tiles that are fine in this blank, never flagged there
// A tile id is a blank's own id (that blank's own tile) or a distractor's id. Only known-wrong
// placements are flagged: a blank's own tile, or any other tile not listed, never is, and nothing
// is ever marked right, so arrangements that run correctly another way still pass. Completion
// stays the run against `check`. Indent tasks have no tiles and are never flagged. A task that
// authors none of these fields flags nothing (usesTileFeedback), as before tile feedback existed.

export const DEFAULT_DISTRACTOR_TILE_HINT = "This piece doesn't belong in this program."
export const DEFAULT_WRONG_TILE_HINT = "This piece doesn't belong in this blank."

function trimmedText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getSlotWrongTiles(slot) {
  return Array.isArray(slot?.wrongTiles)
    ? slot.wrongTiles.filter(
        (entry) => entry && typeof entry === 'object' && typeof entry.tileId === 'string'
      )
    : []
}

export function getSlotAlsoAccepts(slot) {
  return Array.isArray(slot?.alsoAccepts)
    ? slot.alsoAccepts.filter((id) => typeof id === 'string' && id)
    : []
}

// The flag for tile `tileId` sitting in blank `slotId`: `{ hint }`, or null when it isn't a
// known-wrong placement. A blank's own wrongTiles entry beats the distractor's own hint.
export function getTileFlag(task, slotId, tileId) {
  if (isIndentArrangeTask(task) || !slotId || tileId == null || tileId === '') return null
  if (tileId === slotId) return null
  const slot = getAllSlots(task).find((part) => part.id === slotId)
  if (!slot) return null
  if (getSlotAlsoAccepts(slot).includes(tileId)) return null
  const distractor = getDistractors(task).find((d) => d?.id === tileId)
  const wrong = getSlotWrongTiles(slot).find((entry) => entry.tileId === tileId)
  if (wrong) {
    const hint =
      trimmedText(wrong.hint) ||
      (distractor ? trimmedText(distractor.hint) || DEFAULT_DISTRACTOR_TILE_HINT : '') ||
      DEFAULT_WRONG_TILE_HINT
    return { hint }
  }
  if (distractor && usesTileFeedback(task)) {
    return { hint: trimmedText(distractor.hint) || DEFAULT_DISTRACTOR_TILE_HINT }
  }
  return null
}

// Tile feedback is opt-in per task, so a lesson written before it behaves exactly as it did: a
// task flags anything only once it authors a distractor `hint` or a blank's `wrongTiles` /
// `alsoAccepts`. From then on every distractor is flagged (with the default hint when it has none).
export function usesTileFeedback(task) {
  if (isIndentArrangeTask(task)) return false
  return (
    getDistractors(task).some((d) => trimmedText(d?.hint) !== '') ||
    getAllSlots(task).some(
      (slot) => getSlotWrongTiles(slot).length > 0 || getSlotAlsoAccepts(slot).length > 0
    )
  )
}

// Every flagged blank in an arrangement: { [slotId]: { tileId, hint } }. Placements that aren't
// real tiles of the task are ignored (they show as empty blanks).
export function getTileFlags(task, slotState) {
  if (isIndentArrangeTask(task)) return {}
  const placements = pruneSlotState(task, slotState)
  const flags = {}
  for (const [slotId, tileId] of Object.entries(placements)) {
    const flag = getTileFlag(task, slotId, tileId)
    if (flag) flags[slotId] = { tileId, ...flag }
  }
  return flags
}

// The flagged placements `next` makes that `prev` didn't have (a tile newly dropped into a blank
// where it is known to be wrong): [{ slotId, tileId }], in blank order. Logged as tile misses.
export function getNewTileMisses(task, prev, next) {
  const before = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}
  const flags = getTileFlags(task, next)
  return getSlotIds(task)
    .filter((slotId) => flags[slotId] && before[slotId] !== flags[slotId].tileId)
    .map((slotId) => ({ slotId, tileId: flags[slotId].tileId }))
}

// The placements an arrange attempt records (blank id -> tile id), or null for an indent task or
// an empty board.
export function getAttemptPlacements(task, slotState) {
  if (isIndentArrangeTask(task)) return null
  const placements = pruneSlotState(task, slotState)
  return Object.keys(placements).length > 0 ? placements : null
}
