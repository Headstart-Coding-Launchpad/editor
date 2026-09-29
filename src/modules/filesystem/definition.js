// Node-safe half of the Filesystem module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import {
  anyCheckHasValue,
  validateStageStates,
  validateTaskChecks,
  warnCompleteFs,
} from '../moduleTaskValidation.js'
import { validateFilesystemChecks } from '../../shared/checkAuthoringValidation.js'
import { DEFAULT_FS } from './filesystem.js'
import {
  jsonWire,
  recordStorage,
  stageForAction,
  personalSandboxWhenLessonHas,
} from '../moduleContract.js'
import { noUpdates } from '../moduleAuthoring.js'
import { printFilesystemTask } from './print.js'

function sandboxStarterFs(lesson, task) {
  if (lesson?.sandboxStarterFs != null) {
    try {
      return JSON.parse(JSON.stringify(lesson.sandboxStarterFs))
    } catch {}
  }
  const fs = task?.starterFs ?? DEFAULT_FS
  try {
    return JSON.parse(JSON.stringify(fs))
  } catch {
    return DEFAULT_FS
  }
}

export default defineModule({
  type: 'filesystem',
  meta: {
    label: 'Filesystem',
    order: 5,
    shortLabel: 'Filesystem',
    icon: '🗂️',
    pickerHint: 'File manager',
    language: null,
    playground: false,
    surfaceLabels: { builderMeta: 'Files & Folders' },
  },
  capabilities: {
    stageReveal: 'offer',
    teacherStageReveal: false,
    highlights: false,
    downloadCode: false,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'view',
    cardSummary: 'fs',
    sideExplainer: false,
    modulePanes: false,
    teacherLiveReference: true,
    unifiedStages: false,
    sandboxState: 'fs',
    // Nothing to run: every change is checked (checking.trigger 'change').
    run: 'none',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeFs ?? DEFAULT_FS
    if (tab?.startsWith('stage_')) return stage?.fs ?? DEFAULT_FS
    return liveState
  },

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterFs: task.starterFs ?? DEFAULT_FS,
    carryFsFrom: task.carryFsFrom ?? null,
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    role: 'support',
    fs: task.starterFs ? { ...task.starterFs } : DEFAULT_FS,
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }],

  carryThroughField: 'carryFsFrom',
  completeField: 'completeFs',
  carryThroughLabel: 'Carry filesystem from task',
  // Also patches codeStages[0].fs (see python/definition.js's getCarryThroughUpdates for why).
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const fs = sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS
    const updates = { starterFs: fs }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, fs: { ...fs } } : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: () => ({
    starterFs: DEFAULT_FS,
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: [],
  explainerCodeBlockLanguages: [],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: DEFAULT_FS,
  initialState: (task) => task.starterFs ?? DEFAULT_FS,
  serializeState: (state) => JSON.stringify(state),
  deserializeState: (raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return DEFAULT_FS
    }
  },

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  // ── Builder authoring hooks (see ../defineModule.js, "authoring") ─────────────
  authoring: {
    defaultTypeFields: (prevTask) => ({
      starterFs: prevTask?.completeFs ?? prevTask?.starterFs ?? DEFAULT_FS,
      carryFsFrom: prevTask?.id ?? null,
    }),
    missingStarter: (task) => !task.starterFs,
    missingStarterLabel: 'starter filesystem',
    copyStarterToComplete: noUpdates,
    printTask: printFilesystemTask,
    sandboxStarterEditor: 'fs',
    builderRun: 'preview',
  },

  lifecycle: {
    hasPersonalSandbox: personalSandboxWhenLessonHas('sandboxStarterFs'),
    resetTarget: (task, action, ctx = {}) => {
      const { stage } = stageForAction(task, action)
      if (action === 'complete') return { fs: task.completeFs ?? task.starterFs ?? ctx.fs }
      if (action === 'starter') return { fs: task.starterFs ?? ctx.fs }
      return { fs: stage?.fs ?? task.starterFs ?? ctx.fs }
    },
    hasComplete: (task) => !!task?.completeFs,
    teacherCompleteTab: (task) => !!task?.completeFs,
    sandboxStarter: sandboxStarterFs,
    composedSandboxFields: (firstTask) => ({ sandboxStarterFs: firstTask?.starterFs ?? null }),
  },
  storage: recordStorage({ workKey: 'fs' }),
  wire: jsonWire(),
  // Generic work slot (useStudentCodeState): the tree is re-checked on every change.
  checking: {
    trigger: 'change',
    buildContext: (fs, interaction) => ({ fs, ...interaction }),
  },
  workSlot: {
    starterField: 'starterFs',
    sandboxField: 'sandboxStarterFs',
    stageField: 'fs',
    empty: () => DEFAULT_FS,
    normalise: (fs) => fs,
  },

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateStageStates(task, n, errors, { stateKey: 'fs', stateLabel: 'filesystem' })
    validateTaskChecks(task, (checks, kind) => validateFilesystemChecks(checks, n, errors, kind))
    warnCompleteFs(task, n, warnings)
  },
  // Students start from a folder tree, not an editor, so there is no empty-editor warning.
  hasStarterContent: null,
  hasCheckValue: anyCheckHasValue,
})
