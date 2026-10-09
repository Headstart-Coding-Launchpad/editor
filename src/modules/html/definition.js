// Node-safe half of the HTML module (see ../defineModule.js). UI and preview runtime live in
// index.js.
import { defineModule } from '../defineModule.js'
import { codeStagesField } from '../../shared/taskFields.js'
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
  TEACHER_EDIT_CODE_COPY,
} from '../moduleContract.js'
import { getCompleteStage } from '../../shared/taskStages.js'
import { MARKUP_COPY_CODE_PLACEHOLDER } from '../moduleAuthoring.js'
import { HTML_FILE_TYPE, HTML_ONLY } from './fileTemplates.js'
import { printHtmlTask } from './print.js'

const DEFAULT_HTML_FILE = {
  name: 'index.html',
  type: 'html',
  content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>',
}

export default defineModule({
  type: 'html',
  meta: {
    teacherEditCopy: TEACHER_EDIT_CODE_COPY,
    label: 'HTML',
    order: 4,
    shortLabel: 'HTML',
    icon: '🌐',
    pickerHint: 'Workspace',
    language: 'html',
    playground: false,
    // The composed-lesson picker has always listed HTML before Scratch.
    pickerOrder: 3,
    surfaceLabels: { lessonIntro: 'Web Dev', builderMeta: 'Web', print: 'Web (HTML/CSS/JS)' },
  },
  capabilities: {
    stageReveal: 'progressive',
    teacherStageReveal: true,
    highlights: true,
    downloadCode: false,
    typingStats: true,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'files',
    teacherEditor: { surface: 'files' },
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'files',
    teacherFillHeight: true,
    teacherSandboxRow: true,
    teacherUnifiedStageTabs: true,
    // Run builds the preview iframe from the files.
    run: 'preview',
    // Authors hint at starter lines with `<!--> … -->` marker lines (src/shared/lineHints.js).
    lineHints: 'html',
    // A classmate can help (src/shared/peerHelp.js).
    peerHelp: { anchors: 'lines', hints: 'html' },
    // A passed task's side-quests run in a throwaway HTML workspace, the starter as index.html
    // (src/shared/sideQuests.js).
    sideQuests: true,
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

  taskFields: [
    {
      name: 'starterFiles',
      type: 'array',
      required: true,
      authored: true,
      itemFields: [
        { name: 'name', type: 'string', required: true },
        { name: 'type', type: 'string' },
        { name: 'content', type: 'string', authored: true },
      ],
    },
    { name: 'entryFile', type: 'string' },
    { name: 'completeFiles', type: 'array', authored: true },
    { name: 'completeEntryFile', type: 'string' },
    codeStagesField([
      { name: 'files', type: 'array', authored: true },
      { name: 'entryFile', type: 'string' },
    ]),
    { name: 'copyCode', type: 'string', authored: true, description: 'Read-only code to copy.' },
    { name: 'interactionMode', type: 'string', values: ['run', 'submit'] },
    { name: 'carryCodeFrom', type: 'string' },
  ],
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

  // ── Builder authoring hooks (see ../defineModule.js, "authoring") ─────────────
  authoring: {
    // The Builder's first task starts from the "HTML" file template (not DEFAULT_HTML_FILE).
    defaultTypeFields: (prevTask) => ({
      starterFiles: prevTask
        ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map((f) => ({ ...f }))
        : [{ name: 'index.html', type: HTML_FILE_TYPE, content: HTML_ONLY }],
      entryFile: prevTask
        ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html')
        : 'index.html',
      carryCodeFrom: prevTask?.id ?? null,
    }),
    missingStarter: (task) => !Array.isArray(task.starterFiles),
    missingStarterLabel: 'starter files',
    copyStarterToComplete: (task) => ({
      completeFiles: (task.starterFiles ?? []).map((file) => ({ ...file })),
      completeEntryFile: task.entryFile ?? 'index.html',
    }),
    printTask: printHtmlTask,
    sandboxStarterEditor: 'files',
    builderRun: 'preview',
    copyCodePlaceholder: MARKUP_COPY_CODE_PLACEHOLDER,
    fileTabs: true,
    sharedTypeAssets: true,
    previewTypeAssets: true,
  },

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    hasPersonalSandbox: (lesson) => !!(lesson?.sandboxStarterFiles?.length > 0),
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
