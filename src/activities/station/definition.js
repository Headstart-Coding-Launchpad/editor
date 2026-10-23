// Space station activity definition (pure). Wraps ./station.js in the activity contract
// (src/activities/defineActivity.js; docs/architecture/activities.md). Phase 1: Mouse and
// Keyboard Lessons 1-4 (docs/architecture/station-activity.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  GOAL_IDS,
  GOALS,
  WORLD_IDS,
  applyCarried,
  carriedOthers,
  carrySceneOf,
  gradeStationTask,
  initialStationState,
  methodWords,
  promptFor,
  solvedDone,
  stationProgress,
  validateStationTask,
  worldIdOf,
  lessonOf,
} from './station.js'

const parseState = (raw) => {
  if (raw && typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// What goes to Firebase and the teacher: everything except the device-only undo stack, which is
// cut to its last step so the tutor's "Undo last change" has something to put back.
const sharedState = (state) => {
  const { undo, ...rest } = state ?? {}
  return { ...rest, undo: Array.isArray(undo) ? undo.slice(-1) : [] }
}

const initialState = (task) => initialStationState(task)

export default defineActivity({
  id: 'station',
  label: 'Space station',
  category: 'digital_skills',
  icon: '🚀',
  description:
    'Build a saved space station, one mouse or keyboard skill per lesson: click, double-click, drag, Ctrl+Z and scrolling a catalogue.',
  yaml: { type: 'station' },
  // Marked as you go: the task passes the moment the core goals are done (no Check button).
  completion: 'auto',
  passMessage: 'Station upgraded!',
  // A whole station is too small at a third of the screen: Show it opens one build at a time.
  showIt: 'single',
  requires: { finePointer: true },
  touchFallback: 'block',

  fields: {
    task: [
      {
        name: 'lesson',
        type: 'number',
        required: true,
        description:
          '1 to 4 (Phase 1). Sets the starting station: earlier lessons are already built in default places, then this lesson is set up. Optional for the zoo (3) and the toy shop (4), which have one lesson each.',
      },
      {
        name: 'world',
        type: 'string',
        values: WORLD_IDS,
        description:
          'Where this task builds: station (the default), zoo (Lesson 3: drag animals into their enclosures) or toyshop (Lesson 4: scroll a catalogue of toys). The build is saved for each world separately.',
      },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        description: "This week's goals, done in any order.",
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'goal', type: 'string', required: true, values: GOAL_IDS },
          {
            name: 'target',
            type: 'string',
            description:
              'A section id, hull or lights, a part id, a crate id or (sort) an enclosure kind, depending on the goal. Leave out for any.',
          },
          { name: 'prompt', type: 'string', authored: true },
          {
            name: 'order',
            type: 'array',
            description:
              'power_on, open_crate, place_part: ids to do in this order (sections, crates or parts). A wrong next step just blinks.',
          },
          {
            name: 'match',
            type: 'string',
            description:
              'pick_colour: the colour that counts. The card shows it; other colours still recolour but do not count.',
          },
          {
            name: 'card',
            type: 'string',
            description:
              'order_part, place_part: a part id shown as a picture ("find the one in the picture") in place of a target.',
          },
          {
            name: 'onlyNoted',
            type: 'boolean',
            description:
              'open_crate: done when every crate the delivery note lists is open and no other is. Opening a decoy blinks and stays shut.',
          },
          {
            name: 'count',
            type: 'number',
            description:
              'place_part (lesson 3, with a target), open_crate, undo: done when exactly that many.',
          },
          {
            name: 'pattern',
            type: 'object',
            description:
              'light_pattern: which power sections must be on, like { left: on, core: off, right: on }. Done when the power buttons match the card.',
          },
        ],
      },
      {
        name: 'crates',
        type: 'array',
        description:
          'Lesson 2: which crates are in the delivery bay (up to 5) and the sticker on each: [{ id: crate-1, sticker: red-star }]. Defaults to crate-1 to crate-3 with no stickers.',
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'sticker', type: 'string' },
        ],
      },
      {
        name: 'note',
        type: 'array',
        description:
          'Lesson 2: the stickers on the delivery note (for open_crate with onlyNoted), like [red-star, blue-circle].',
      },
      {
        name: 'mistakes',
        type: 'array',
        description:
          "Lesson 3: the clumsy robot's drops, parts already on the station at the start: [{ part: dome, spot: top-module-1 }]. In the zoo the keeper puts an animal in the wrong enclosure: [{ part: grass-lion, spot: ice-2 }]. Only Ctrl+Z removes them (needs an undo_mistakes goal). They are never saved as the child's station.",
        itemFields: [
          { name: 'part', type: 'string', required: true },
          { name: 'spot', type: 'string', required: true },
        ],
      },
      {
        name: 'catalogue',
        type: 'array',
        description:
          'Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue (animal ids in the zoo, toy ids in the toy shop). Defaults to the lesson or world list.',
      },
      {
        name: 'coreItems',
        type: 'number',
        description:
          'How many goals make the round (1 to the number of items): the FIRST this many goals are required, the rest are bonus. Defaults to all goals.',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'station',
    lesson: 1,
    items: [
      { id: 'power', goal: 'power_on' },
      { id: 'hull', goal: 'pick_colour', target: 'hull' },
    ],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateStationTask(task, n),
    warnings: [],
  }),

  initialState,

  solutionState: (task) => {
    const base = initialStationState(task)
    return {
      ...base,
      scene: {
        ...base.scene,
        power: Object.fromEntries(Object.keys(base.scene.power).map((id) => [id, true])),
      },
      done: solvedDone(task),
    }
  },

  // Every station change is a discrete step (a click, a drop). Pointer moves while dragging are
  // UI state, not activity state.
  classifyChange: () => 'discrete',

  // The undo stack stays on the device except its last step (tutor undo).
  serializeShared: (state) => JSON.stringify(sharedState(state)),

  // The station is carried between lessons (host work: defineActivity does not read this yet).
  carrySlot: {
    id: 'station',
    // The clumsy robot's preset drops are not the child's station: they are dropped here.
    // One scene per world ({ v: 2, worlds }); an older { v: 1, scene } is the station's.
    extract: (state) => carrySceneOf(state),
    apply: (task, carried) =>
      initialStationState(task, applyCarried(task, carried), carriedOthers(task, carried)),
  },

  grade: (task, state) => {
    const result = gradeStationTask(task, state)
    return {
      passed: result.done,
      suggestion: result.hint,
      itemResults: Object.fromEntries(
        Object.entries(result.itemResults).map(([id, r]) => [id, r.correct])
      ),
    }
  },

  getProgress: (task, state) => {
    const { done, core, total } = stationProgress(task, state)
    const counted = Math.min(done, core)
    return {
      kind: 'items',
      filled: counted,
      total: core,
      correct: counted,
      bonus: Math.max(0, Math.min(done, total) - core),
    }
  },

  summarize: (task, state) => {
    const { counted, total, core, done } = gradeStationTask(task, state)
    return {
      text: roundSummaryText(counted, total, core, 'goals'),
      tone: done ? 'success' : 'neutral',
    }
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map(
      (item) =>
        `<li>${esc(promptFor(item, task.lesson, worldIdOf(task)))} <em>(${esc(GOALS[item.goal]?.methods.map(methodWords).join(' or ') ?? '')})</em></li>`
    )
    return `<p>Lesson ${esc(lessonOf(task))}</p><ol>${rows.join('')}</ol>`
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'station' }),
    normalizeSubmission: (task, submission) => parseState(submission),
    // For each goal, how many students did it and by which method.
    summaryFields: (task, perStudent) => {
      const goals = {}
      for (const item of task?.items ?? []) goals[item.id] = { done: 0, methods: {} }
      for (const student of perStudent ?? []) {
        const latest = student.distinctAttempts?.[student.distinctAttempts.length - 1]?.submission
        const state = parseState(latest)
        for (const [id, record] of Object.entries(state?.done ?? {})) {
          if (!goals[id]) continue
          goals[id].done += 1
          const method = record?.method ?? 'unknown'
          goals[id].methods[method] = (goals[id].methods[method] ?? 0) + 1
        }
      }
      return { goals }
    },
  },

  teacherEditable: true,
})
