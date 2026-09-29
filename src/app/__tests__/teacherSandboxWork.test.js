import { describe, expect, it } from 'vitest'
import { MODULE_TYPES, getModuleDefinition } from '../../modules/definitions.js'
import { DEFAULT_FS } from '../../modules/filesystem/filesystem.js'
import { DEFAULT_CIRCUIT, serializeCircuit } from '../../modules/electronics/circuit.js'
import { makeDefaultDesktop, normaliseDesktop } from '../../modules/desktop/desktopState.js'
import {
  cloneFiles,
  cloneScratchState,
  decodeSessionFiles,
  parseScratchState,
} from '../../shared/workspaceData'
import { decodeFileKey, encodeFileKey } from '../../shared/fileKeys'
import { getStarterStage } from '../../shared/taskStages'
import {
  cloneSandboxWork,
  hasSandboxWork,
  initialSandboxWorkByKind,
  readSessionSandboxWork,
  restoreSandboxWork,
  sandboxCodeFor,
  sandboxStarterWork,
  sandboxWireFields,
  sandboxWorkKind,
  taskStarterWork,
} from '../teacherSandboxWork'

// Plan step 4.6: TeacherView's teacher-sandbox chains (enter / push / reset / leave / restore,
// and the editor's liveState / onChange) now go through the module definitions. The `legacy*`
// functions below are verbatim copies of the per-type branches they replaced (TeacherView before
// step 4.6, the old per-kind React states flattened into one object); every module's writes to
// Realtime Database (`enterSandbox` / `pushSandboxCode` / `pushSandboxFiles` arguments), its draft
// and its restored editor state must come out identical.

const LEGACY_CODE_STRING_TYPES = ['python', 'arcade', 'electronics', 'turtle']
const LEGACY_STATE_KEY = {
  scratch: 'scratchState',
  filesystem: 'fsState',
  desktop: 'desktopState',
}
const legacyStateKey = (type) =>
  LEGACY_CODE_STRING_TYPES.includes(type) ? 'code' : (LEGACY_STATE_KEY[type] ?? 'files')

// handleGoLiveSandbox's enterSandbox fields / handlePushSandbox's push (before step 4.6).
function legacyWireFields(type, st) {
  if (LEGACY_CODE_STRING_TYPES.includes(type)) return { code: st.code }
  if (type === 'scratch') return { code: JSON.stringify(st.scratchState ?? {}) }
  if (type === 'filesystem') return { code: JSON.stringify(st.fsState) }
  if (type === 'desktop') return { code: JSON.stringify(st.desktopState) }
  return { files: st.files }
}

// The draft handleGoLiveSandbox / handlePushSandbox / handleDeactivateSandbox kept.
function legacyDraft(type, st) {
  if (LEGACY_CODE_STRING_TYPES.includes(type)) return st.code
  if (type === 'scratch') return cloneScratchState(st.scratchState)
  if (type === 'filesystem') return JSON.parse(JSON.stringify(st.fsState))
  if (type === 'desktop') return JSON.parse(JSON.stringify(st.desktopState))
  return cloneFiles(st.files)
}

// handleResetSandboxStarter: { draft, state, push } for the configured starter.
function legacyReset(type, configured) {
  if (LEGACY_CODE_STRING_TYPES.includes(type))
    return { draft: configured, state: configured, push: { code: configured } }
  if (type === 'scratch')
    return {
      draft: cloneScratchState(configured),
      state: configured,
      push: { code: JSON.stringify(configured ?? {}) },
    }
  if (type === 'filesystem')
    return {
      draft: JSON.parse(JSON.stringify(configured)),
      state: configured,
      push: { code: JSON.stringify(configured) },
    }
  if (type === 'desktop')
    return {
      draft: JSON.parse(JSON.stringify(configured)),
      state: normaliseDesktop(configured),
      push: { code: JSON.stringify(configured) },
    }
  const starterFiles = cloneFiles(configured.files ?? [])
  return { draft: starterFiles, state: starterFiles, push: { files: starterFiles } }
}

// applySandboxStarterState: the editor state it set.
function legacyRestore(type, draft, session, configured) {
  const isSandbox = session?.state === 'sandbox'
  const sessionHasCode = isSandbox && session.sandboxCode != null
  const mod = getModuleDefinition(type)
  if (LEGACY_CODE_STRING_TYPES.includes(type))
    return draft.code ?? (sessionHasCode ? session.sandboxCode : null) ?? configured
  if (type === 'scratch')
    return (
      draft.scratchState ??
      (sessionHasCode ? parseScratchState(session.sandboxCode) : null) ??
      configured
    )
  if (type === 'filesystem')
    return (
      draft.fs ?? (sessionHasCode ? mod.deserializeState(session.sandboxCode) : null) ?? configured
    )
  if (type === 'desktop')
    return normaliseDesktop(
      draft.desktop ??
        (sessionHasCode ? mod.deserializeState(session.sandboxCode) : null) ??
        configured
    )
  const sessionFiles = isSandbox ? decodeSessionFiles(session?.sandboxFiles, decodeFileKey) : []
  return draft.files?.length
    ? cloneFiles(draft.files)
    : sessionFiles.length
      ? cloneFiles(sessionFiles)
      : cloneFiles(configured.files ?? [])
}

// The editor's liveState for the module (before step 4.6).
function legacyLiveState(type, st, task) {
  if (['python', 'arcade', 'turtle', 'electronics'].includes(type)) return st.code
  if (type === 'scratch') return st.scratchState
  if (type === 'filesystem') return st.fsState
  if (type === 'desktop') return st.desktopState
  return { files: st.files, entryFile: task?.entryFile ?? 'index.html' }
}

const LEGACY_DRAFT_KEY = { scratchState: 'scratchState', fsState: 'fs', desktopState: 'desktop' }

// ── Samples ──────────────────────────────────────────────────────────────────

const HTML_FILES = [
  { name: 'index.html', type: 'html', content: '<p>hi</p>' },
  { name: 'style.css', type: 'css', content: 'p { color: red }' },
]
const DESKTOP = normaliseDesktop({ ...makeDefaultDesktop(), lastSearchQuery: 'cats' })

// Work values (stored form) a teacher could have in the editor, per module.
const SAMPLE_WORK = {
  python: ['print("hi")', ''],
  turtle: ['turtle.forward(10)', ''],
  arcade: ['game.run()', ''],
  electronics: [serializeCircuit(DEFAULT_CIRCUIT)],
  scratch: [{ Stage: { blocks: { a: { opcode: 'event_whenflagclicked' } } } }, null],
  filesystem: [{ '/': { type: 'dir', children: ['a.txt'] } }, DEFAULT_FS],
  desktop: [DESKTOP, makeDefaultDesktop()],
  html: [HTML_FILES, []],
}

function lessonFor(type) {
  return {
    type,
    sandboxStarter:
      type === 'scratch' ? JSON.stringify({ Stage: { blocks: {} } }) : 'print("sandbox")',
    sandboxStarterFiles: HTML_FILES,
    sandboxStarterFs: { '/': { type: 'dir', children: ['starter.txt'] } },
    sandboxStarterDesktop: DESKTOP,
    sandboxStarterCircuit: DEFAULT_CIRCUIT,
  }
}

const TASK = {
  id: 1,
  starterCode: 'print("task")',
  entryFile: 'index.html',
  starterFiles: HTML_FILES,
  starterBlocks: { Stage: { blocks: {} } },
  starterFs: DEFAULT_FS,
  starterCircuit: DEFAULT_CIRCUIT,
}

// The legacy per-kind state object holding `work` for the module.
function legacyStateWith(type, work) {
  return {
    code: '',
    files: [],
    scratchState: null,
    fsState: DEFAULT_FS,
    desktopState: makeDefaultDesktop(),
    [legacyStateKey(type)]: work,
  }
}

function sessionFromFields(fields) {
  return fields.files
    ? {
        state: 'sandbox',
        sandboxFiles: Object.fromEntries(
          fields.files.map((f) => [encodeFileKey(f.name), f.content])
        ),
      }
    : { state: 'sandbox', sandboxCode: fields.code }
}

const CASES = MODULE_TYPES.flatMap((type) =>
  SAMPLE_WORK[type].map((work, index) => [type, index, work])
)

describe('teacher sandbox work through the module definitions (plan step 4.6)', () => {
  it('covers every registered module', () => {
    expect(Object.keys(SAMPLE_WORK).sort()).toEqual([...MODULE_TYPES].sort())
  })

  it('starts each kind from the same empty work the old per-kind states did', () => {
    expect(initialSandboxWorkByKind()).toEqual({
      code: '',
      files: [],
      blocks: null,
      fs: DEFAULT_FS,
      desktop: makeDefaultDesktop(),
    })
  })

  describe.each(CASES)('%s (sample %i)', (type, _index, work) => {
    const definition = getModuleDefinition(type)
    const legacyState = legacyStateWith(type, work)

    it('goes live and pushes with the same RTDB fields (enterSandbox / pushSandbox*)', () => {
      const fields = sandboxWireFields(definition, work)
      expect(fields).toEqual(legacyWireFields(type, legacyState))
      if (!fields.files) {
        expect(sandboxCodeFor(definition, work)).toBe(legacyWireFields(type, legacyState).code)
      }
    })

    it('keeps the same draft (go live, push, leave)', () => {
      expect(cloneSandboxWork(definition, work)).toEqual(legacyDraft(type, legacyState))
    })

    it('shows the same liveState in the teacher editor', () => {
      const workByKind = { ...initialSandboxWorkByKind(), [sandboxWorkKind(definition)]: work }
      const liveState =
        definition.wire.sandboxChannel === 'files'
          ? { files: workByKind[sandboxWorkKind(definition)], entryFile: TASK.entryFile }
          : workByKind[sandboxWorkKind(definition)]
      expect(liveState).toEqual(legacyLiveState(type, legacyState, TASK))
    })

    it('restores the pushed work from the session (reload / module switch)', () => {
      const session = sessionFromFields(legacyWireFields(type, legacyState))
      const configured = definition.lifecycle.sandboxStarter(lessonFor(type), TASK)
      const fromSession = readSessionSandboxWork(definition, session)
      const restored = restoreSandboxWork(
        definition,
        hasSandboxWork(definition, fromSession)
          ? fromSession
          : sandboxStarterWork(definition, lessonFor(type), TASK)
      )
      expect(restored).toEqual(legacyRestore(type, {}, session, configured))
    })

    it('prefers the draft over the session, as before', () => {
      const session = sessionFromFields(legacyWireFields(type, legacyStateWith(type, work)))
      const configured = definition.lifecycle.sandboxStarter(lessonFor(type), TASK)
      const draftWork = cloneSandboxWork(definition, work)
      const legacyDraftObject = {
        [LEGACY_DRAFT_KEY[legacyStateKey(type)] ?? legacyStateKey(type)]: draftWork,
      }
      const candidate = [draftWork, readSessionSandboxWork(definition, session)].find((w) =>
        hasSandboxWork(definition, w)
      )
      const restored = restoreSandboxWork(
        definition,
        candidate ?? sandboxStarterWork(definition, lessonFor(type), TASK)
      )
      expect(restored).toEqual(legacyRestore(type, legacyDraftObject, session, configured))
    })
  })

  describe.each(MODULE_TYPES)('%s', (type) => {
    const definition = getModuleDefinition(type)
    const configured = definition.lifecycle.sandboxStarter(lessonFor(type), TASK)

    it('resets to the starter with the same draft, editor state and push', () => {
      const starter = sandboxStarterWork(definition, lessonFor(type), TASK)
      const legacy = legacyReset(type, configured)
      expect(cloneSandboxWork(definition, starter)).toEqual(legacy.draft)
      expect(restoreSandboxWork(definition, starter)).toEqual(legacy.state)
      expect(sandboxWireFields(definition, starter)).toEqual(legacy.push)
    })

    it('restores the configured starter with no draft and no live sandbox', () => {
      for (const session of [null, { state: 'active', sandboxCode: 'x' }, { state: 'sandbox' }]) {
        const fromSession = readSessionSandboxWork(definition, session)
        const work = hasSandboxWork(definition, fromSession)
          ? fromSession
          : sandboxStarterWork(definition, lessonFor(type), TASK)
        expect(restoreSandboxWork(definition, work)).toEqual(
          legacyRestore(type, {}, session, configured)
        )
      }
    })
  })

  it('still treats an empty html draft as no draft (the session or starter wins)', () => {
    const html = getModuleDefinition('html')
    expect(hasSandboxWork(html, [])).toBe(false)
    expect(hasSandboxWork(html, HTML_FILES)).toBe(true)
    // Any non-null work counts on the code channel, including an empty code string.
    expect(hasSandboxWork(getModuleDefinition('python'), '')).toBe(true)
    expect(hasSandboxWork(getModuleDefinition('scratch'), null)).toBe(false)
  })

  // The one intended difference: a live sandboxCode that isn't the module's JSON (another
  // module's code after switching the sandbox module in a composed lesson) used to become an
  // empty tree / default desktop for filesystem and desktop; like Scratch always did, it now
  // falls back to the configured starter.
  it.each(['filesystem', 'desktop', 'scratch'])(
    'falls back to the %s starter when the session code is not its JSON',
    (type) => {
      const definition = getModuleDefinition(type)
      const session = { state: 'sandbox', sandboxCode: 'print("python")' }
      expect(readSessionSandboxWork(definition, session)).toBeNull()
    }
  )
})

// Plan step 4.8: TeacherView's Starter-tab work for the displayed task (loadCurrentTaskContent)
// now comes from `workSlot.teacherStarter`. `legacyStarterTabWork` is a verbatim copy of the
// per-type chain it replaced (information / hosted-activity tasks keep their own branch).
function legacyStarterTabWork(type, task) {
  if (type === 'python' || type === 'arcade' || type === 'turtle') {
    return { code: getStarterStage(task)?.stage?.code ?? task.starterCode ?? '' }
  } else if (type === 'scratch') {
    return { blocks: task.starterBlocks ?? null }
  } else if (type === 'filesystem') {
    return { fs: task.starterFs ?? DEFAULT_FS }
  } else if (type === 'desktop') {
    return {
      desktop: normaliseDesktop(task.starterDesktop ?? makeDefaultDesktop(task.availableApps)),
    }
  } else if (type === 'electronics') {
    return { code: serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) }
  }
  return { files: getStarterStage(task)?.stage?.files ?? task.starterFiles ?? [] }
}

const STARTER_TAB_TASKS = [
  { id: 1 },
  {
    id: 2,
    starterCode: 'print(1)',
    starterBlocks: { blocks: { languageVersion: 0, blocks: [] } },
    starterFs: { type: 'folder', name: '/', children: [] },
    starterDesktop: { fs: { type: 'folder', name: '/', children: [] }, windows: [] },
    starterCircuit: { ...DEFAULT_CIRCUIT, components: [] },
    starterFiles: HTML_FILES,
    availableApps: ['files'],
  },
  {
    id: 3,
    starterCode: 'legacy',
    starterCircuit: { ...DEFAULT_CIRCUIT, components: [] },
    starterFiles: HTML_FILES,
    codeStages: [
      {
        role: 'starter',
        label: 'Starter',
        code: 'print("stage")',
        files: [{ name: 'index.html', type: 'html', content: '<p>stage</p>' }],
        circuit: { ...DEFAULT_CIRCUIT, components: [{ id: 'led1', type: 'led' }] },
      },
    ],
  },
  { id: 4, availableApps: ['files', 'notepad'] },
]

describe("TeacherView's Starter-tab work (plan step 4.8)", () => {
  describe.each([...MODULE_TYPES, 'not-a-module'])('%s', (type) => {
    it.each(STARTER_TAB_TASKS.map((task) => [task.id, task]))(
      'task %i matches the old per-type chain',
      (_id, task) => {
        const definition = getModuleDefinition(type)
        expect({ [sandboxWorkKind(definition)]: taskStarterWork(definition, task) }).toEqual(
          legacyStarterTabWork(type, task)
        )
      }
    )
  })
})
