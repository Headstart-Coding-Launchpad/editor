// Node-safe half of the Python Turtle module (see ../defineModule.js). UI and the Pyodide
// runtime bridge live in index.js.
import { defineModule } from '../defineModule.js'
import { codeStagesField } from '../../shared/taskFields.js'
import { codeStarterPresent, validateTaskChecks } from '../moduleTaskValidation.js'
import { validateTurtleChecks } from '../../shared/checkAuthoringValidation.js'
import {
  codeCheckContext,
  codeHasComplete,
  codeResetTarget,
  codeStringWire,
  codeWorkSlot,
  recordStorage,
  TEACHER_EDIT_CODE_COPY,
  alwaysPersonalSandbox,
  variablesPanelLiveExtra,
} from '../moduleContract.js'
import { SHOW_VARIABLES_TASK_FIELD } from '../../shared/variablesPanel/variablesPanel.js'
import { LAYOUT_TASK_FIELD, validateTaskLayout } from '../../shared/resultPane/resultPane.js'
import { validateShowVariables } from '../../shared/variablesPanel/validation.js'
import { SCRUB_TASK_FIELD, validateScrub } from '../../shared/scrub/scrubConfig.js'
import { getStarterStage } from '../../shared/taskStages.js'
import { PYTHON_SLOW_MO_TASK_FIELD, validatePythonSlowMo } from '../python/slowMo/config.js'
import {
  PUZZLE_TASK_FIELD,
  validateLockedLines,
  validatePuzzle,
} from '../../shared/puzzle/puzzle.js'
import {
  SETUP_CODE_TASK_FIELD,
  SETUP_NOTE_TASK_FIELD,
  validateSetupCode,
} from '../../shared/puzzle/setupCode.js'
import { compactTurtleResultForSync } from './sync.js'
import { validateTurtleCourse } from './course.js'
import {
  codeDefaultTypeFields,
  MARKUP_COPY_CODE_PLACEHOLDER,
  never,
  noUpdates,
} from '../moduleAuthoring.js'
import { printCodeStringTask } from '../printHelpers.js'

const DEFAULT_STARTER_CODE =
  'import turtle\n\nturtle.forward(100)\nturtle.left(90)\nturtle.forward(100)\n'

export default defineModule({
  type: 'turtle',
  meta: {
    teacherEditCopy: TEACHER_EDIT_CODE_COPY,
    label: 'Python Turtle',
    order: 2,
    shortLabel: 'Turtle',
    icon: '🐢',
    pickerHint: 'Workspace',
    language: 'python',
    playground: false,
    surfaceLabels: { stageReference: 'Python' },
  },
  capabilities: {
    // Saved to a matched student's class roster on Run / submission (src/shared/roster/).
    rosterWork: 'code',
    // Controls a tutor or a task's `highlight` field can pulse (src/shared/controlHighlight.js).
    // Run and Stop share one button, which carries data-highlight-target="run stop".
    highlightTargets: [
      { id: 'run', label: 'Run button' },
      { id: 'stop', label: 'Stop button' },
    ],
    stageReveal: 'offer',
    teacherStageReveal: false,
    highlights: false,
    downloadCode: false,
    typingStats: true,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'view',
    teacherEditor: { surface: 'code' },
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
    run: 'runtime',
    // Authors hint at starter lines with `#> …` marker lines (src/shared/lineHints.js).
    lineHints: 'python',
    // A classmate can help (src/shared/peerHelp.js).
    peerHelp: { anchors: 'lines', hints: 'python' },
    // A passed task's side-quests run in a throwaway Turtle workspace (src/shared/sideQuests.js).
    sideQuests: true,
    // A task's `scrub` (src/shared/scrub/): a scrubbed value redraws live unless the program
    // asks for input().
    scrub: { liveRerun: 'preview', needsImport: null, inputCall: 'input' },
  },
  // The run's drawing is synced with the run (a run result, like output).
  runResult: { errorLine: false, turtle: true, liveCode: false, stage: false },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  makeCodeTaskFields: (task) => {
    const starterCode = task.starterCode ?? DEFAULT_STARTER_CODE
    return {
      starterCode,
      carryCodeFrom: task.carryCodeFrom ?? null,
      codeStages: task.codeStages ?? [{ label: 'Starter', role: 'starter', code: starterCode }],
    }
  },

  makeNewStage: (task, existing) => ({
    label:
      existing.length === 0
        ? 'Starter'
        : `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    code: existing.length === 0 ? (task.starterCode ?? DEFAULT_STARTER_CODE) : '',
  }),

  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' })
  },

  initStageTab: null,

  defaultCheck: () => [
    { type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1' },
  ],

  taskFields: [
    { name: 'starterCode', type: 'string', authored: true },
    { name: 'completeCode', type: 'string', authored: true },
    codeStagesField([{ name: 'code', type: 'string', authored: true }]),
    { name: 'copyCode', type: 'string', authored: true, description: 'Read-only code to copy.' },
    {
      name: 'showBlocks',
      type: 'boolean',
      description: 'Coloured block brackets in the Python editor (default true; false hides them).',
    },
    { name: 'carryCodeFrom', type: 'string' },
    {
      name: 'carryCodeFromLesson',
      type: 'object',
      description:
        "{ lesson, task }: start from the student's own saved work on that task of an earlier lesson (stock ids; the tutor matches students to the class roster). Not with carryCodeFrom.",
    },
    SHOW_VARIABLES_TASK_FIELD,
    SCRUB_TASK_FIELD,
    PYTHON_SLOW_MO_TASK_FIELD,
    // Hidden setup and puzzle rules (src/shared/puzzle/).
    SETUP_CODE_TASK_FIELD,
    SETUP_NOTE_TASK_FIELD,
    PUZZLE_TASK_FIELD,
    // Which result tab shows first on smaller screens (src/shared/resultPane/).
    LAYOUT_TASK_FIELD,

    {
      name: 'course',
      type: 'object',
      description:
        "Course mode (docs/authoring/turtle.md): { type: 'grid' | 'track', vehicle?: 'turtle' | 'car' | 'rover' | 'boat' | 'drone', map | maps, studentMap?: true }. Grid maps are text (# wall, . road, G goal, * pickup, > < ^ v start); a track is { start, goal, walls, pickups, trackCode }. The turtle becomes a vehicle with sensors (wall_ahead, wall_left, wall_right, at_goal, on_pickup, collected). studentMap: true (grid only) lets the student's code set its own map with turtle.course_map(text); map is shown until then.",
    },
  ],
  carryThroughField: 'carryCodeFrom',
  completeField: 'completeCode',
  carryThroughLabel: 'Carry code from task',
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const code = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    const updates = { starterCode: code }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, code } : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: () => ({ starterCode: '' }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  // Matches Arcade Kit: draw-and-check tasks, not submit-based text output.
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,
  supportsCopyCode: true,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  initialState: (task) => task.starterCode ?? DEFAULT_STARTER_CODE,
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  // ── Builder authoring hooks (see ../defineModule.js, "authoring") ─────────────
  authoring: {
    defaultTypeFields: codeDefaultTypeFields,
    missingStarter: never,
    // "Reset to starter code" has never copied anything for turtle (its complete code lives in
    // the unified code stages).
    copyStarterToComplete: noUpdates,
    printTask: printCodeStringTask,
    sandboxStarterEditor: 'code',
    // The Builder's Run has always taken the preview path for turtle; its workspace runs itself.
    builderRun: 'preview',
    copyCodePlaceholder: MARKUP_COPY_CODE_PLACEHOLDER,
  },

  lifecycle: {
    hasPersonalSandbox: alwaysPersonalSandbox,
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    // Composed lessons have never derived a turtle sandbox starter from the first task.
    composedSandboxFields: () => ({}),
  },
  storage: recordStorage({ workKey: 'code', taskMeta: ['output', 'runStatus'] }),
  // The drawing is a run result; it is compacted before it travels on teacherLive.
  wire: codeStringWire({
    liveExtras: ({ turtleResult, variablesPanel } = {}) => ({
      arcadeDesign: null,
      turtleResult: compactTurtleResultForSync(turtleResult),
      inspector: null,
      ...variablesPanelLiveExtra({ variablesPanel }),
      stage: null,
    }),
  }),
  // Generic work slot (useStudentCodeState): the code string, checked when it runs.
  checking: { trigger: 'run', buildContext: codeCheckContext },
  workSlot: codeWorkSlot({ teacherSandboxReset: true }),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateTaskChecks(task, (checks, kind) => validateTurtleChecks(checks, n, errors, kind))
    validateShowVariables(task, n, errors, warnings)
    validateScrub(task, n, errors, warnings, {
      starterCode: getStarterStage(task)?.stage?.code ?? task.starterCode ?? null,
    })
    validatePythonSlowMo(task, n, errors, warnings)
    validateSetupCode(task, n, errors, warnings)
    validatePuzzle(task, n, errors, warnings)
    validateLockedLines(task, n, warnings)
    validateTaskLayout(task, n, errors, warnings)

    // Course mode (./course.js): the map(s). Course checks on a task with no course are caught
    // by their own registry `validate` (./courseChecks.js).
    validateTurtleCourse(task, n, errors, warnings)
  },
  hasStarterContent: codeStarterPresent,
})
