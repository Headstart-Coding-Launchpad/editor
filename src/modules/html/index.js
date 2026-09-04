import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import HtmlTeacherLiveView from './TeacherLiveView.jsx'
import { buildIframeSrc, waitForIframeText as waitForPreviewText } from './iframe'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const DEFAULT_HTML_FILE = {
  name: 'index.html',
  type: 'html',
  content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>',
}

const htmlModule = {
  type: 'html',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: HtmlTeacherLiveView,

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

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

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
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].files/entryFile — see python/index.js's getCarryThroughUpdates
  // for why the legacy starterFiles field alone isn't enough once a task has stages.
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

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: [DEFAULT_HTML_FILE],
  initialState: (task) => ({
    files: task.starterFiles?.length ? task.starterFiles : [DEFAULT_HTML_FILE],
    entryFile: task.entryFile ?? 'index.html',
  }),
  serializeState: null,
  deserializeState: null,

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => ({
    files: lesson?.sandboxStarterFiles?.length
      ? lesson.sandboxStarterFiles
      : (task?.starterFiles ?? [DEFAULT_HTML_FILE]),
    entryFile: task?.entryFile ?? 'index.html',
  }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: () => Promise.resolve(),
    isReady: () => true,
    stop: () => {},
    provideInput: null,
    run: null,
    buildPreviewSrc: (state, task, opts = {}) =>
      buildIframeSrc(state?.files ?? state, state?.entryFile ?? task?.entryFile, opts),
    waitForPreviewText,
  },
}

export default htmlModule
