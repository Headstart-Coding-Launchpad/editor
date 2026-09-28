// Node-safe half of the HTML module (see ../defineModule.js). UI and preview runtime live in
// index.js.
import { defineModule } from '../defineModule.js'
import {
  filesStarterPresent,
  validateCodeChecks,
  validateHtmlStarterFiles,
  validateTaskChecks,
  warnCompleteFiles,
} from '../moduleTaskValidation.js'
import {
  codeCheckContext,
  filesWire,
  filesWorkSlot,
  joinFileContents,
  perFileStorage,
  stageForAction,
  starterStageOf,
} from '../moduleContract.js'
import { getCompleteStage } from '../../shared/taskStages.js'

const DEFAULT_HTML_FILE = {
  name: 'index.html',
  type: 'html',
  content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>',
}

export default defineModule({
  type: 'html',
  meta: {
    label: 'HTML',
    order: 4,
    shortLabel: 'HTML',
    icon: '🌐',
    pickerHint: 'Workspace',
    language: 'html',
    playground: false,
    surfaceLabels: { lessonIntro: 'Web Dev', builderMeta: 'Web', print: 'Web (HTML/CSS/JS)' },
  },
  capabilities: {
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'files',
    // Run builds the preview iframe from the files.
    run: 'preview',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete')
      return {
        files: task?.completeFiles ?? [],
        entryFile: task?.completeEntryFile ?? task?.entryFile ?? 'index.html',
      }
    if (tab?.startsWith('stage_'))
      return {
        files:
          stage?.code != null
            ? [{ name: 'support-snippet.html', type: 'html', content: stage.code }]
            : (stage?.files ?? []),
        entryFile:
          stage?.code != null
            ? 'support-snippet.html'
            : (stage?.entryFile ?? task?.entryFile ?? 'index.html'),
      }
    return liveState
  },

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterFiles: task.starterFiles?.length ? task.starterFiles : [DEFAULT_HTML_FILE],
    entryFile: task.entryFile ?? 'index.html',
    carryCodeFrom: task.carryCodeFrom ?? null,
    codeStages: task.codeStages ?? [
      {
        label: 'Starter',
        role: 'starter',
        files: task.starterFiles?.length ? task.starterFiles : [DEFAULT_HTML_FILE],
        entryFile: task.entryFile ?? 'index.html',
      },
    ],
  }),

  makeNewStage: (task, existing) => ({
    label:
      existing.length === 0
        ? 'Starter'
        : `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    ...(existing.length === 0
      ? {
          files: (task.starterFiles ?? []).map((f) => ({ ...f })),
          entryFile: task.entryFile ?? 'index.html',
        }
      : { code: '' }),
  }),

  initCompleteTab: (task, { onUpdate, selectedFile, setSelectedCompleteFile }) => {
    if (!task.completeFiles?.length) {
      const initFiles = (task.starterFiles ?? []).map((f) => ({ ...f }))
      onUpdate({ ...task, completeFiles: initFiles })
      setSelectedCompleteFile(initFiles[0]?.name ?? '')
    } else {
      setSelectedCompleteFile(task.completeFiles[0]?.name ?? selectedFile ?? '')
    }
  },

  initStageTab: (stage, { setSelectedFile }) => {
    setSelectedFile(stage?.files?.[0]?.name ?? '')
  },

  defaultCheck: (interactionMode) =>
    interactionMode === 'submit'
      ? [{ type: 'code_contains', value: '' }]
      : [{ type: 'output_contains', value: '' }],

  carryThroughField: 'carryCodeFrom',
  completeField: 'completeFiles',
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].files/entryFile — see python/definition.js's
  // getCarryThroughUpdates for why the legacy starterFiles field alone isn't enough once a
  // task has stages.
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const files = (sourceTask.completeFiles ?? sourceTask.starterFiles ?? []).map((f) => ({ ...f }))
    const newEntry = sourceTask.completeEntryFile ?? sourceTask.entryFile
    const updates = { starterFiles: files }
    if (newEntry) updates.entryFile = newEntry
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0
          ? {
              ...stage,
              files: files.map((f) => ({ ...f })),
              ...(newEntry ? { entryFile: newEntry } : {}),
            }
          : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: (task) => ({
    starterFiles: (task.starterFiles ?? []).map((f) => ({ ...f, content: '' })),
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: true,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: true,
  supportsCopyCode: true,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['html', 'javascript', 'css'],
  explainerCodeBlockLanguages: ['html', 'css', 'javascript'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: [DEFAULT_HTML_FILE],
  initialState: (task) => ({
    files: task.starterFiles?.length ? task.starterFiles : [DEFAULT_HTML_FILE],
    entryFile: task.entryFile ?? 'index.html',
  }),
  serializeState: null,
  deserializeState: null,

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    resetTarget: (task, action) => {
      const { stage } = stageForAction(task, action)
      const starter = starterStageOf(task)
      if (action === 'complete') {
        return {
          files: task.completeFiles ?? [],
          entryFile: task.completeEntryFile ?? task.entryFile,
        }
      }
      if (action === 'starter') {
        return {
          files: starter?.files ?? task.starterFiles ?? [],
          entryFile: starter?.entryFile ?? task.entryFile,
        }
      }
      return {
        files: stage?.files ?? starter?.files ?? task.starterFiles ?? [],
        entryFile: stage?.entryFile ?? starter?.entryFile ?? task.entryFile,
      }
    },
    hasComplete: (task) =>
      getCompleteStage(task)?.stage?.files?.length > 0 || task?.completeFiles?.length > 0,
    // Complete lives in the unified code stages, not a separate teacher tab.
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => ({
      files: lesson?.sandboxStarterFiles?.length
        ? lesson.sandboxStarterFiles
        : (task?.starterFiles ?? [DEFAULT_HTML_FILE]),
      entryFile: task?.entryFile ?? 'index.html',
    }),
    composedSandboxFields: (firstTask) => ({
      sandboxStarterFiles: firstTask?.starterFiles ?? [],
    }),
  },
  storage: perFileStorage(),
  wire: filesWire(),
  // Generic work slot (useStudentCodeState, plan step 4.5): `{ files, activeFile }`, stored one
  // `{ content }` record per file and sent as a filename → content map on the files channel.
  // Checked when Run builds the preview (and on Submit in submit mode): a code check reads the
  // files' contents joined; the preview adds `iframeDoc` (element checks), idle feedback `output`.
  checking: {
    trigger: 'run',
    buildContext: (files, extras = {}) => codeCheckContext(joinFileContents(files), extras),
  },
  workSlot: filesWorkSlot(),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateHtmlStarterFiles(task, n, errors)
    validateTaskChecks(task, (checks, kind) =>
      validateCodeChecks(checks, n, errors, kind, {
        html: true,
        interactionMode: task.interactionMode,
      })
    )
    warnCompleteFiles(task, n, warnings)
  },
  hasStarterContent: filesStarterPresent,
})
