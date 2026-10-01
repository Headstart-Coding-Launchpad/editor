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
//   reports        `{ taskType: 'code' }`, the submission is the assembled code / files
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
  const slotIds = getSlotIds(task)
  if (slotIds.length === 0) return null
  // Only the task's own tiles count: an unknown id shows as an empty blank.
  const slots = isSlotMap(state) ? pruneSlotState(task, state) : {}
  const filled = slotIds.filter((id) => isFilled(slots[id])).length
  return { kind: 'code_arrange', filled, total: slotIds.length, correct: null }
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
    task: [
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
            name: 'parts',
            type: 'array',
            required: true,
            authored: true,
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
            ],
          },
        ],
      },
      {
        name: 'distractors',
        type: 'array',
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'code', type: 'string', required: true, authored: true },
        ],
      },
      {
        name: 'check',
        type: 'object',
        required: true,
        authored: true,
        description: "The host module's completion check.",
      },
      { name: 'entryFile', type: 'string', description: 'HTML only.' },
      { name: 'starterFiles', type: 'array', authored: true, description: 'HTML only.' },
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
  // Each slot part's `code` is its answer.
  sealedFields: ['lines'],
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
      ? { text: `${progress.filled}/${progress.total} slots filled`, tone: 'neutral' }
      : null
  },
  teacherEditable: true,

  report: Object.freeze({
    typeFields: () => ({ taskType: 'code' }),
    normalizeSubmission: (task, submission) => normalizeCodeSubmission(submission),
    summaryFields: () => ({}),
  }),

  // Prints nothing of its own (the lines and tiles are not printed today).
  printHtml: () => '',
})
