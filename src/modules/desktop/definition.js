// Node-safe half of the Desktop module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import {
  anyCheckHasValue,
  validateStageStates,
  validateTaskChecks,
  warnCompleteDesktop,
} from '../moduleTaskValidation.js'
import { validateFilesystemChecks } from '../../shared/checkAuthoringValidation.js'
import {
  makeDefaultDesktop,
  normaliseDesktop,
  serializeDesktop,
  deserializeDesktop,
} from './desktopState.js'

export default defineModule({
  type: 'desktop',
  meta: {
    label: 'Desktop',
    order: 6,
    shortLabel: 'Desktop',
    icon: '🖥️',
    pickerHint: 'Windowed desktop',
    language: null,
    playground: false,
  },
  capabilities: {
    sideExplainer: false,
    modulePanes: false,
    teacherLiveReference: false,
    unifiedStages: false,
    sandboxState: 'desktop',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeDesktop ?? makeDefaultDesktop(task?.availableApps)
    if (tab?.startsWith('stage_')) return stage?.desktop ?? makeDefaultDesktop(task?.availableApps)
    return liveState
  },

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterDesktop:
      task.starterDesktop ?? makeDefaultDesktop(task.availableApps ?? ['fileManager']),
    carryDesktopFrom: task.carryDesktopFrom ?? null,
    availableApps: task.availableApps ?? ['fileManager'],
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    role: 'support',
    desktop: task.starterDesktop
      ? { ...task.starterDesktop }
      : makeDefaultDesktop(task.availableApps),
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }],

  carryThroughField: 'carryDesktopFrom',
  completeField: 'completeDesktop',
  carryThroughLabel: 'Carry desktop from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterDesktop:
      sourceTask.completeDesktop ??
      sourceTask.starterDesktop ??
      makeDefaultDesktop(sourceTask.availableApps),
  }),
  getNewStarterUpdates: () => ({
    starterDesktop: makeDefaultDesktop(),
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
  defaultState: makeDefaultDesktop(),
  initialState: (task) =>
    normaliseDesktop(
      task.starterDesktop ?? makeDefaultDesktop(task.availableApps ?? ['fileManager'])
    ),
  serializeState: (state) => serializeDesktop(state),
  deserializeState: (raw) => deserializeDesktop(raw),

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarterDesktop != null) {
      try {
        return normaliseDesktop(JSON.parse(JSON.stringify(lesson.sandboxStarterDesktop)))
      } catch {}
    }
    const desktop =
      task?.starterDesktop ?? makeDefaultDesktop(task?.availableApps ?? ['fileManager'])
    try {
      return normaliseDesktop(JSON.parse(JSON.stringify(desktop)))
    } catch {
      return makeDefaultDesktop()
    }
  },

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateStageStates(task, n, errors, { stateKey: 'desktop', stateLabel: 'desktop' })
    validateTaskChecks(task, (checks, kind) => validateFilesystemChecks(checks, n, errors, kind))
    warnCompleteDesktop(task, n, warnings)
  },
  hasStarterContent: null,
  hasCheckValue: anyCheckHasValue,
})
