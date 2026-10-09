// Code Arrange (legacy `taskType: 'code_arrange'`): students drag code tiles into the blanks of
// a program, then run it. Unlike the other activities it is hosted by a workspace module
// (`hostModules`), not by ActivityHost: the assembled program goes through the python / html
// module's normal work slot, Run and checks (useStudentCodeState), so the program is marked by
// running it. The activity owns only the tile arrangement:
//
//   state          slot map { [slotId]: tileId } (a slot's own id is its correct tile's id)
//   localStorage   aux file `__code_arrange_slots__` (JSON slot map), saved on every placement
//   live           students/{id}/currentCodeArrangeSlots on every placement (watched or not),
//                  teacherLive.codeArrangeSlots / codeArrangeCursor while broadcasting
//   teacher edit   teacherAnswerEdit.codeArrangeSlots ("Edit answers" in StudentModal)
//   reports        `{ taskType: 'code' }`, the submission is the assembled code / files; each
//                  attempt also records its `placements` (blank id -> tile id)
//
// Tile feedback (src/shared/codeArrange.js getTileFlag): a tile dropped into a blank where it is
// known to be wrong (a distractor anywhere, or one of the blank's `wrongTiles`) turns that blank
// red with its hint at once; each such drop is logged as a tile miss
// (students/{id}/tileMissLog/{taskId}), never as an attempt. Completion stays run-based.
// A tutor can also highlight a tile live from StudentModal (`tileHighlights`,
// src/shared/tutorTileHighlights.js); it draws the same red outline.
//
// Indent mode (`arrangeMode: indent`, src/shared/codeArrangeIndent.js): the lines are fixed and
// the student sets each one's depth. Its state is a { lineId: depth } map carried by the same
// storage, live channel and teacher edits; the shared helpers in src/shared/codeArrange.js
// (prune, assemble, solution, derive) hand indent tasks over to it.
//
// Only composed lessons offer it (the Builder's Arrange format). Pure and Node-safe.
import { defineActivity } from '../defineActivity.js'
import {
  CODE_ARRANGE_MODULE_TYPES,
  codeArrangeHasStarter,
  validateCodeArrangeTask,
} from '../legacyValidation.js'
import {
  buildSolutionSlotState,
  getSlotIds,
  isArrangementComplete,
  pruneSlotState,
} from '../../shared/codeArrange.js'
import {
  INDENT_MODE,
  countMovedLines,
  getMovableLineIds,
  isIndentArrangeTask,
  isIndentArrangementCorrect,
} from '../../shared/codeArrangeIndent.js'
import { normalizeCodeSubmission } from '../../shared/codeSubmission.js'

export const CODE_ARRANGE_SLOTS_FILENAME = '__code_arrange_slots__'

function isSlotMap(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseSlots(raw) {
  if (isSlotMap(raw)) return raw
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return isSlotMap(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// The stored slot map (aux file text, or the object mirrored in RTDB). Anything that isn't a
// plain object loads as an empty board; given the task, placements that aren't the task's own
// slots and tiles are dropped (pruneSlotState), so a stale board can never look complete.
function deserializeSlots(raw, task) {
  const slots = parseSlots(raw)
  return task ? pruneSlotState(task, slots) : slots
}

function isFilled(value) {
  return value != null && String(value).trim() !== ''
}

// { kind, filled, total, correct: null } — the StudentCard / StudentModal "X/N slots filled"
// badge. Arrangements are marked by running the program, never per slot.
function slotProgress(task, state) {
  if (isIndentArrangeTask(task)) return indentProgress(task, state)
  const slotIds = getSlotIds(task)
  if (slotIds.length === 0) return null
  // Only the task's own tiles count: an unknown id shows as an empty blank.
  const slots = isSlotMap(state) ? pruneSlotState(task, state) : {}
  const filled = slotIds.filter((id) => isFilled(slots[id])).length
  return { kind: 'code_arrange', filled, total: slotIds.length, correct: null }
}

// Indent mode: how many movable lines have left their start depth ("2/5 lines moved").
function indentProgress(task, state) {
  const total = getMovableLineIds(task).length
  if (total === 0) return null
  const filled = countMovedLines(task, isSlotMap(state) ? pruneSlotState(task, state) : {})
  return { kind: 'code_arrange', filled, total, correct: null, unit: 'lines', verb: 'moved' }
}

// The session report's `tileMisses[]` for the task: `{ slotId, tileId, count, studentCount }` per
// blank and tile, most dropped first. Omitted when nobody dropped a known-wrong tile.
function summarizeTileMisses(perStudent) {
  const groups = new Map()
  for (const studentTask of perStudent ?? []) {
    for (const miss of studentTask?.tileMisses ?? []) {
      const key = JSON.stringify([miss.slotId, miss.tileId])
      const group = groups.get(key) ?? {
        slotId: miss.slotId,
        tileId: miss.tileId,
        count: 0,
        students: new Set(),
      }
      group.count++
      group.students.add(studentTask)
      groups.set(key, group)
    }
  }
  if (groups.size === 0) return {}
  return {
    tileMisses: [...groups.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ students, ...group }) => ({ ...group, studentCount: students.size })),
  }
}

// The host module a code_arrange surface renders for: its own type when it is a host module,
// otherwise the first (python), as the teacher panels always have.
export function hostModuleFor(moduleType) {
  return CODE_ARRANGE_MODULE_TYPES.includes(moduleType) ? moduleType : CODE_ARRANGE_MODULE_TYPES[0]
}

export default defineActivity({
  id: 'code_arrange',
  label: 'Arrange',
  category: 'code',
  icon: '🧱',
  description: 'Drag code tiles into the blanks of a program, then run it.',
  legacy: Object.freeze({ taskType: 'code_arrange' }),
  yaml: Object.freeze({ type: 'code_arrange' }),
  // The Builder offers Arrange only in composed lessons.
  availableIn: (lesson) => lesson?.type === 'composed',
  hostModules: CODE_ARRANGE_MODULE_TYPES,

  fields: {
    modeField: 'arrangeMode',
    task: [
      {
        name: 'arrangeMode',
        type: 'string',
        values: ['slots', INDENT_MODE],
        description:
          "slots (default): drag tiles into blanks. indent: lines fixed in order, the student sets each line's depth (Python only).",
      },
      {
        name: 'moduleType',
        type: 'string',
        required: true,
        values: CODE_ARRANGE_MODULE_TYPES,
      },
      {
        name: 'lines',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'code',
            type: 'string',
            required: true,
            authored: true,
            modes: [INDENT_MODE],
            description: 'The line without leading spaces.',
          },
          {
            name: 'depth',
            type: 'number',
            required: true,
            authored: true,
            modes: [INDENT_MODE],
            description: 'The correct depth: 0 to 4 indent steps.',
          },
          {
            name: 'start',
            type: 'number',
            modes: [INDENT_MODE],
            description: 'Depth the line starts at (default 0); for "fix the indent" tasks.',
          },
          {
            name: 'locked',
            type: 'boolean',
            modes: [INDENT_MODE],
            description: 'Fixed at its depth; the student cannot move it.',
          },
          {
            name: 'parts',
            type: 'array',
            required: true,
            authored: true,
            modes: ['slots'],
            description: 'At least one slot across the task.',
            itemFields: [
              { name: 'type', type: 'string', required: true, values: ['text', 'slot'] },
              { name: 'text', type: 'string', authored: true, description: 'Text parts.' },
              { name: 'id', type: 'string', description: 'Slot parts; unique.' },
              {
                name: 'code',
                type: 'string',
                authored: true,
                description: 'Slot parts: the answer tile.',
              },
              {
                name: 'wrongTiles',
                type: 'array',
                authored: true,
                description:
                  "Slot parts, optional: tiles known to be wrong in this blank (another blank's id or a distractor id), flagged the moment one is dropped here with its hint.",
                itemFields: [
                  { name: 'tileId', type: 'string', required: true },
                  { name: 'hint', type: 'string', authored: true },
                ],
              },
              {
                name: 'alsoAccepts',
                type: 'array',
                description:
                  'Slot parts, optional: tile ids that are also fine in this blank; never flagged here.',
              },
            ],
          },
        ],
      },
      {
        name: 'distractors',
        type: 'array',
        authored: true,
        modes: ['slots'],
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'code', type: 'string', required: true, authored: true },
          {
            name: 'hint',
            type: 'string',
            authored: true,
            description:
              'Optional: shown the moment this tile is dropped into any blank (default: "This piece doesn\'t belong in this program.").',
          },
        ],
      },
      {
        name: 'check',
        type: 'object',
        required: true,
        authored: true,
        description: "The host module's completion check.",
      },
      { name: 'entryFile', type: 'string', modes: ['slots'], description: 'HTML only.' },
      {
        name: 'starterFiles',
        type: 'array',
        authored: true,
        modes: ['slots'],
        description: 'HTML only.',
      },
      {
        name: 'showBlocks',
        type: 'boolean',
        modes: [INDENT_MODE],
        description: 'Coloured block brackets beside the lines (default true).',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'code_arrange',
    moduleType: 'python',
    explainer: prev.explainer ?? '',
    lines: [{ id: 'line-1', parts: [{ type: 'slot', id: 'line-1-slot-1', code: 'print("Hi")' }] }],
    distractors: [],
    check: { type: 'output', operator: 'contains', value: 'Hi' },
  }),

  // The arrangement's structure (shared legacy rules, one wording for Builder + CLI). The host
  // module's own rules run as well in lesson validation (src/shared/lessonValidation.js).
  validateTask: (task, { n, moduleType, lesson } = {}) => {
    const errors = []
    const warnings = []
    validateCodeArrangeTask(task, {
      n,
      moduleType: moduleType ?? task?.moduleType ?? lesson?.type,
      errors,
      warnings,
    })
    return { errors, warnings }
  },
  hasStarter: (task) => codeArrangeHasStarter(task),
  // The completion check is the host module's (hasCheckValue: null in legacyValidation.js).
  hasCheckValue: (task) => !!task?.check,

  initialState: () => ({}),
  solutionState: (task) => buildSolutionSlotState(task),
  // Each slot part's `code` is its answer (and its wrongTiles / alsoAccepts give placements
  // away); a distractor's hint marks it as a distractor.
  sealedFields: ['lines', 'distractors'],
  serialize: (state) => JSON.stringify(state ?? {}),
  deserialize: (raw, task) => deserializeSlots(raw, task),
  storage: Object.freeze({ persist: true, filename: CODE_ARRANGE_SLOTS_FILENAME }),
  liveChannel: 'codeArrangeSlots',
  // Every tile placement is discrete (mirrored whether or not the teacher is watching).
  classifyChange: () => 'discrete',

  // The classroom marks an arrangement by running the assembled program through the host
  // module's checks. grade() answers the pure question "is this the authored arrangement?".
  grade: (task, state) => {
    const slots = isSlotMap(state) ? state : {}
    if (isIndentArrangeTask(task)) {
      return {
        passed: isIndentArrangementCorrect(task, pruneSlotState(task, slots)),
        suggestion: '',
      }
    }
    const passed =
      isArrangementComplete(task, slots) && getSlotIds(task).every((id) => slots[id] === id)
    return { passed, suggestion: '' }
  },

  getProgress: slotProgress,
  // Unit shown after the counts by formatTaskItemProgress ("1/2 slots filled").
  progressUnit: 'slots',
  summarize: (task, state) => {
    const progress = slotProgress(task, state)
    return progress
      ? {
          text: `${progress.filled}/${progress.total} ${progress.unit ?? 'slots'} ${progress.verb ?? 'filled'}`,
          tone: 'neutral',
        }
      : null
  },
  teacherEditable: true,
  // Slot mode only: a tutor can highlight a placed tile (target: the blank's slot id). Indent
  // mode has no tiles in blanks, so it has no tile highlights.
  tileHighlights: (task) => !isIndentArrangeTask(task),

  report: Object.freeze({
    typeFields: () => ({ taskType: 'code' }),
    normalizeSubmission: (task, submission) => normalizeCodeSubmission(submission),
    // Known-wrong tile drops across the class (each student's `tileMisses`), most common first.
    summaryFields: (task, perStudent) => summarizeTileMisses(perStudent),
  }),

  // Prints nothing of its own (the lines and tiles are not printed today).
  printHtml: () => '',
})
