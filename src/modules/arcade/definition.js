// Node-safe half of the Arcade Kit module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import {
  codeStarterPresent,
  collectFeedbackChecks,
  validateCodeChecks,
  validateTaskChecks,
  warnCompleteCode,
} from '../moduleTaskValidation.js'
import { normalizeChecks } from '../checks.js'
import { warnArcadeUnevaluatedChecks } from '../../shared/checkAuthoringValidation.js'
import { cloneArcadeDesign, designForCodeTab } from './design.js'
import {
  codeCheckContext,
  codeHasComplete,
  codeResetTarget,
  codeStringWire,
  codeWorkSlot,
  completeCodeOf,
  recordStorage,
  starterCodeOf,
  TEACHER_EDIT_CODE_COPY,
  alwaysPersonalSandbox,
} from '../moduleContract.js'

// The work-slot value: the code plus the sprite/sound design that rides alongside it.
const EMPTY_ARCADE_WORK = Object.freeze({ code: '', arcadeDesign: null })

export default defineModule({
  type: 'arcade',
  meta: {
    teacherEditCopy: TEACHER_EDIT_CODE_COPY,
    label: 'Arcade Kit',
    order: 1,
    shortLabel: 'Arcade Kit',
    icon: '🕹️',
    pickerHint: 'Workspace · Experimental',
    language: 'python',
    playground: true,
    surfaceLabels: { stageReference: 'Python' },
  },
  capabilities: {
    stageReveal: 'offer',
    teacherStageReveal: true,
    highlights: false,
    downloadCode: false,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'view',
    cardSummary: 'output',
    teacherEditor: { surface: 'view', workspace: 'code', design: true },
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
    // The game runs in the workspace's own iframe (ArcadePreview), which reports "Run game"
    // back through handleArcadeRun.
    run: 'workspace',
  },
  getDisplayState: (task, stage, liveState, tab) =>
    tab === 'complete'
      ? (task?.completeCode ?? '')
      : tab?.startsWith('stage_')
        ? (stage?.code ?? '')
        : typeof liveState === 'string'
          ? liveState
          : (task?.starterCode ?? ''),
  makeCodeTaskFields: (task) => {
    const starterCode =
      task.starterCode ??
      'from headstart_arcade import game, Sprite, keys\n\n# Write update() and draw(), then call game.run().\n\ngame.run()\n'
    return {
      starterCode,
      carryCodeFrom: task.carryCodeFrom ?? null,
      codeStages: task.codeStages ?? [
        {
          label: 'Starter',
          role: 'starter',
          code: starterCode,
          arcadeDesign: cloneArcadeDesign(task.arcadeDesign),
        },
      ],
    }
  },
  makeNewStage: (task, existing) =>
    existing.length === 0
      ? {
          label: 'Starter',
          role: 'starter',
          code: task.starterCode ?? '',
          arcadeDesign: cloneArcadeDesign(task.arcadeDesign),
        }
      : {
          label: `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
          role: 'support',
          code: '',
        },
  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' })
  },
  initStageTab: null,
  defaultCheck: () => [{ type: 'code_contains', value: '' }],
  carryThroughField: 'carryCodeFrom',
  completeField: 'completeCode',
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].code (see python/definition.js's getCarryThroughUpdates for why).
  getCarryThroughUpdates: (source, targetTask) => {
    const code = source.completeCode ?? source.starterCode ?? ''
    const updates = { starterCode: code }
    if (targetTask?.codeStages?.length)
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, code } : stage
      )
    return updates
  },
  getNewStarterUpdates: () => ({ starterCode: '' }),
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,
  // The game runs in its own iframe with no captured text output, so only code checks can
  // be evaluated (on Run game — see handleArcadeRun in useStudentCodeState.js).
  supportsOutputChecks: false,
  supportsCopyCode: true,
  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],
  defaultState: '',
  initialState: (task) => task.starterCode ?? '',
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),
  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    hasPersonalSandbox: alwaysPersonalSandbox,
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    composedSandboxFields: (firstTask) => ({ sandboxStarter: firstTask?.starterCode ?? '' }),
  },
  // The sprite/sound design rides alongside the code in both records.
  storage: recordStorage({
    workKey: 'code',
    taskMeta: ['output', 'runStatus', 'arcadeDesign'],
    sandboxMeta: ['arcadeDesign'],
  }),
  wire: codeStringWire({
    liveExtras: ({ arcadeDesign } = {}) => ({ arcadeDesign, turtleResult: null }),
  }),
  // Generic work slot (useStudentCodeState): `{ code, arcadeDesign }`. Storage and wire take
  // the code as the work and the design as the record's `arcadeDesign` field (stored()).
  checking: { trigger: 'run', buildContext: codeCheckContext },
  workSlot: codeWorkSlot({
    starter: (task) => ({
      code: starterCodeOf(task),
      arcadeDesign: designForCodeTab(task, 'starter'),
    }),
    stage: (task, stageIndex) => ({
      code: task?.codeStages?.[stageIndex]?.code ?? '',
      arcadeDesign: designForCodeTab(task, `stage_${stageIndex}`),
    }),
    // Show complete loads the complete design with the code, like Show stage and remote reset.
    complete: (task) => ({
      code: completeCodeOf(task),
      arcadeDesign: designForCodeTab(task, 'complete'),
    }),
    sandbox: (lesson) => ({ code: lesson?.sandboxStarter ?? '', arcadeDesign: null }),
    fromResetTarget: (target, task, action) => ({
      code: target.code,
      arcadeDesign: designForCodeTab(task, action),
    }),
    empty: () => EMPTY_ARCADE_WORK,
    stored: (value) => ({
      work: value?.code ?? '',
      meta: { arcadeDesign: value?.arcadeDesign ?? null },
    }),
    // A stored design is cloned; a missing one keeps the fallback's (the starter design on task
    // load, none in the personal sandbox, the current one for a teacher edit or push).
    fromStored: (stored, fallback) => ({
      code: stored?.work ?? fallback.code,
      arcadeDesign: stored?.meta?.arcadeDesign
        ? cloneArcadeDesign(stored.meta.arcadeDesign)
        : fallback.arcadeDesign,
    }),
    // The design has no other save on a teacher reset.
    remoteResetPersists: true,
  }),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateTaskChecks(task, (checks, kind) =>
      validateCodeChecks(checks, n, errors, kind, { interactionMode: task.interactionMode })
    )
    warnArcadeUnevaluatedChecks(
      [...normalizeChecks(task.check), ...collectFeedbackChecks(task)],
      n,
      warnings
    )
    warnCompleteCode(task, n, warnings)
  },
  hasStarterContent: codeStarterPresent,
})
