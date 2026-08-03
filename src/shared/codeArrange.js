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
// These helpers only ever produce a plain code string. The Python/HTML run
// pipeline and the shared check evaluator (src/modules/checks.js) consume
// that string exactly as they would any other task's code — neither one
// needs to know the code came from drag-and-drop tiles. Keeping that boundary
// pure and dependency-free here is what makes it easy to unit test and to
// reuse from both the student workspace and the Lesson Builder preview.

function stableHash(str) {
  let h = 0
  for (let i = 0; i < String(str ?? '').length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

export function getLines(task) {
  return Array.isArray(task?.lines) ? task.lines : []
}

export function getLineParts(line) {
  return Array.isArray(line?.parts) ? line.parts : []
}

// The ordered slot parts within a single line.
export function getLineSlots(line) {
  return getLineParts(line).filter(part => part?.type === 'slot')
}

// Every slot across the whole task, in authoring order (line order, then
// part order within a line). This is the full ordered id list a student
// must fill; drives completeness checks.
export function getAllSlots(task) {
  return getLines(task).flatMap(line => getLineSlots(line))
}

export function getSlotIds(task) {
  return getAllSlots(task).map(slot => slot.id)
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
    ...getAllSlots(task).map(slot => ({ id: slot.id, code: slot.code ?? '' })),
    ...getDistractors(task).map(d => ({ id: d?.id, code: d?.code ?? '' })),
  ]
  return all.sort((a, b) => stableHash(a.code) - stableHash(b.code))
}

// Looks up a tile's display code by its fragment id. Used for the drag-image
// label, which only ever has a tile id to work from.
export function getFragmentCodeById(task, fragmentId) {
  return getTaskPool(task).find(fragment => fragment.id === fragmentId)?.code ?? ''
}

// Whether a fragment id belongs to the task's shared pool. Used by the
// Builder to prune preview state after edits remove a tile.
export function fragmentIdExists(task, fragmentId) {
  return getTaskPool(task).some(fragment => fragment.id === fragmentId)
}

export function isArrangementComplete(task, slotState) {
  const slotIds = getSlotIds(task)
  if (slotIds.length === 0) return false
  const state = slotState && typeof slotState === 'object' ? slotState : {}
  return slotIds.every(id => state[id] != null && state[id] !== '')
}

// Assembles a single authored line into its final source text, given the
// tile currently selected for each of its slots (slot id -> fragment id,
// looked up in the task's one shared pool) and fixed text segments passed
// through unchanged, in part order.
export function assembleLineCode(line, slotState, pool) {
  const state = slotState && typeof slotState === 'object' ? slotState : {}
  return getLineParts(line).map(part => {
    if (part?.type === 'slot') {
      return pool.find(fragment => fragment.id === state[part.id])?.code ?? ''
    }
    return part?.text ?? ''
  }).join('')
}

// Assembles the full runnable program from the current slot placements: each
// line's parts, joined by newlines. Returns null while the arrangement is
// incomplete — callers should not run or persist an incomplete program as
// the task's code.
export function assembleCodeArrangement(task, slotState) {
  if (!isArrangementComplete(task, slotState)) return null
  const pool = getTaskPool(task)
  return getLines(task).map(line => assembleLineCode(line, slotState, pool)).join('\n')
}

// Builds the arrangement that matches the authored solution: every slot's
// own "native" correct tile (a slot's own id is always its own correct
// fragment's id — see the module doc comment). Used by the Builder preview
// so authors have a one-click way to check their intended solution passes.
export function buildSolutionSlotState(task) {
  return Object.fromEntries(getAllSlots(task).map(slot => [slot.id, slot.id]))
}

// HTML tasks assemble into a single target file — the entry file by default,
// or the first starter file if no entry file is authored yet.
export function getCodeArrangeEntryFile(task) {
  return task?.entryFile || task?.starterFiles?.[0]?.name || 'index.html'
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
          const result = match(index + 1, pos + fragment.code.length, { ...acc, [part.id]: fragment.id })
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
