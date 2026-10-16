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
  NO_LIVE_EXTRAS,
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
import { SCRUB_TASK_FIELD, validateScrub } from '../../shared/scrub/scrubConfig.js'
import {
  INSPECTOR_FOCUS_MAX,
  INSPECTOR_KEYS,
  INSPECTOR_SECTIONS,
  normalizeInspectorLiveState,
} from './inspector/config.js'

// `inspector` (./inspector/config.js): the HTML Inspector on the preview.
function validateInspector(task, n, errors, warnings) {
  const inspector = task?.inspector
  if (inspector == null) return
  if (typeof inspector !== 'object' || Array.isArray(inspector)) {
    errors.push(
      `Task ${n} inspector must be an object like { enabled: true, show: [box, cascade] }`
    )
    return
  }
  for (const key of ['enabled', 'open']) {
    if (inspector[key] != null && typeof inspector[key] !== 'boolean') {
      errors.push(`Task ${n} inspector.${key} must be true or false`)
    }
  }
  if (
    inspector.focus != null &&
    (typeof inspector.focus !== 'string' ||
      !inspector.focus.trim() ||
      inspector.focus.length > INSPECTOR_FOCUS_MAX)
  ) {
    errors.push(
      `Task ${n} inspector.focus must be a CSS selector of ${INSPECTOR_FOCUS_MAX} characters or fewer`
    )
  }
  if (
    inspector.show != null &&
    (!Array.isArray(inspector.show) ||
      inspector.show.some((section) => !INSPECTOR_SECTIONS.includes(section)))
  ) {
    errors.push(`Task ${n} inspector.show must be a list of: ${INSPECTOR_SECTIONS.join(', ')}`)
  }
  const extra = Object.keys(inspector).filter((key) => !INSPECTOR_KEYS.includes(key))
  if (extra.length > 0) {
    warnings.push(`Task ${n} inspector has unknown fields (${extra.join(', ')}); they are ignored`)
  }
  if (inspector.enabled !== true) {
    warnings.push(`Task ${n} inspector is not enabled (enabled: true), so students won't see it`)
  } else if (task.interactionMode === 'submit') {
    warnings.push(`Task ${n} inspector needs the preview, which submit-mode tasks don't show`)
  }
}

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
    // Saved to a matched student's class roster on Run / submission (src/shared/roster/).
    rosterWork: 'files',
    // Controls a tutor or a task's `highlight` field can pulse (src/shared/controlHighlight.js).
    // HTML has no Stop: Run re-renders the preview.
    highlightTargets: [{ id: 'run', label: 'Run button' }],
    stageReveal: 'progressive',
    teacherStageReveal: true,
    highlights: true,
    downloadCode: false,
    typingStats: true,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'files',
    cardSummary: 'page',
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
    // A task's `scrub` (src/shared/scrub/): CSS and attribute values; the student's preview
    // re-renders live while a value moves (a watching tutor's view updates on Run).
    scrub: { liveRerun: 'preview', needsImport: null, inputCall: null },
    // The task's `inspector` field adds the HTML Inspector to the preview (./inspector/).
    previewInspector: true,
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
    {
      name: 'carryCodeFromLesson',
      type: 'object',
      description:
        "{ lesson, task }: start from the student's own saved work on that task of an earlier lesson (stock ids; the tutor matches students to the class roster). Not with carryCodeFrom.",
    },
    {
      name: 'inspector',
      type: 'object',
      description:
        'HTML Inspector on the preview: { enabled: true, open?, focus?: "<CSS selector>", show?: [box, cascade, layout] } (docs/authoring/html.md).',
    },
    SCRUB_TASK_FIELD,
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
  // The HTML Inspector's Go Live state rides along with every payload (null when off).
  wire: filesWire({
    liveExtras: ({ inspector } = {}) => ({
      ...NO_LIVE_EXTRAS,
      inspector: normalizeInspectorLiveState(inspector),
    }),
  }),
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
    validateInspector(task, n, errors, warnings)
    // Ranges are lines of whichever file is open, so there is no one starter to check them against.
    validateScrub(task, n, errors, warnings)
  },
  hasStarterContent: filesStarterPresent,
})
