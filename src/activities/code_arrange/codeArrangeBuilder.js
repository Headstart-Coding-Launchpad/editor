// Builder conversion into the Arrange task format (moved unchanged from TaskEditor's
// handleTaskTypeChange). Keeps the task's module when it is a host module (python by
// default), drops the code-task fields an arrangement doesn't use, and seeds two empty
// single-blank lines and, for HTML, the entry file. Pure.
import { hostModuleFor } from './definition.js'
import {
  INDENT_MODE,
  INDENT_STEP,
  MAX_INDENT_DEPTH,
  isIndentArrangeTask,
} from '../../shared/codeArrangeIndent.js'

export function convertToCodeArrange(base) {
  const nextModuleType = hostModuleFor(base.moduleType)
  const {
    copyCode: _copyCode,
    codeStages: _codeStages,
    carryCodeFrom: _c1,
    carryBlocksFrom: _c2,
    carryFsFrom: _c3,
    carryCircuitFrom: _c4,
    ...rest
  } = base
  return {
    ...rest,
    taskType: 'code_arrange',
    moduleType: nextModuleType,
    moduleId: base.moduleId,
    lines: base.lines?.length
      ? base.lines
      : [
          { id: 'line-1', parts: [{ type: 'slot', id: 'line-1-slot-1', code: '' }] },
          { id: 'line-2', parts: [{ type: 'slot', id: 'line-2-slot-1', code: '' }] },
        ],
    distractors: base.distractors ?? [],
    ...(nextModuleType === 'html'
      ? {
          entryFile: base.entryFile ?? 'index.html',
          starterFiles: base.starterFiles?.length
            ? base.starterFiles
            : [{ name: base.entryFile ?? 'index.html', type: 'html', content: '' }],
        }
      : {}),
    check: null,
  }
}

// Switches an Arrange task between its modes (`slots`, `indent`), keeping the program: going to
// indent mode, each line's authored solution text becomes its code, its leading spaces its depth
// (whole 4-space steps); going back, each line becomes one blank holding that indented text.
// Settings the new mode doesn't use are dropped. Pure.
export function switchArrangeMode(task, mode) {
  const lines = Array.isArray(task.lines) ? task.lines : []
  if (mode === INDENT_MODE) {
    if (isIndentArrangeTask(task)) return task
    const {
      distractors: _distractors,
      entryFile: _entryFile,
      starterFiles: _starterFiles,
      ...rest
    } = task
    return {
      ...rest,
      arrangeMode: INDENT_MODE,
      moduleType: 'python',
      lines: lines.map((line) => {
        const text = (Array.isArray(line?.parts) ? line.parts : [])
          .map((part) => (part?.type === 'slot' ? (part.code ?? '') : (part?.text ?? '')))
          .join('')
        const spaces = text.length - text.trimStart().length
        return {
          id: line.id,
          code: text.trim(),
          depth: Math.min(Math.floor(spaces / INDENT_STEP.length), MAX_INDENT_DEPTH),
        }
      }),
    }
  }
  if (!isIndentArrangeTask(task)) return task
  const { arrangeMode: _arrangeMode, showBlocks: _showBlocks, ...rest } = task
  return {
    ...rest,
    lines: lines.map((line) => ({
      id: line.id,
      parts: [
        {
          type: 'slot',
          id: `${line.id}-slot-1`,
          code: INDENT_STEP.repeat(line.depth ?? 0) + String(line.code ?? '').trim(),
        },
      ],
    })),
    distractors: [],
  }
}

// Tile feedback for one blank (src/shared/codeArrange.js getTileFlag): how `tileId` is treated in
// this blank — 'wrong' (in its wrongTiles, with `hint`), 'accept' (in its alsoAccepts) or 'none'.
export function getSlotTileFeedback(slot, tileId) {
  const wrong = (Array.isArray(slot?.wrongTiles) ? slot.wrongTiles : []).find(
    (entry) => entry?.tileId === tileId
  )
  if (wrong) return { kind: 'wrong', hint: wrong.hint ?? '' }
  if (Array.isArray(slot?.alsoAccepts) && slot.alsoAccepts.includes(tileId)) {
    return { kind: 'accept', hint: '' }
  }
  return { kind: 'none', hint: '' }
}

// Sets how `tileId` is treated in this blank, keeping it in at most one of the two lists (so a
// tile can never be both wrong and accepted) and dropping a list once it is empty. Pure.
export function setSlotTileFeedback(slot, tileId, { kind, hint = '' } = {}) {
  const existingWrong = Array.isArray(slot?.wrongTiles) ? slot.wrongTiles : []
  const entry = hint ? { tileId, hint } : { tileId }
  // An entry already in the list keeps its place (editing its hint doesn't reorder the list).
  let wrongTiles = existingWrong.map((item) => (item?.tileId === tileId ? entry : item))
  if (kind !== 'wrong') wrongTiles = wrongTiles.filter((item) => item?.tileId !== tileId)
  else if (!existingWrong.some((item) => item?.tileId === tileId)) wrongTiles.push(entry)
  const alsoAccepts = (Array.isArray(slot?.alsoAccepts) ? slot.alsoAccepts : []).filter(
    (id) => id !== tileId
  )
  if (kind === 'accept') alsoAccepts.push(tileId)
  const { wrongTiles: _wrongTiles, alsoAccepts: _alsoAccepts, ...rest } = slot ?? {}
  return {
    ...rest,
    ...(wrongTiles.length > 0 ? { wrongTiles } : {}),
    ...(alsoAccepts.length > 0 ? { alsoAccepts } : {}),
  }
}
