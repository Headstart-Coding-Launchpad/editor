import { describe, it, expect } from 'vitest'
import { MODULE_TYPES, getModuleDefinition } from '../definitions.js'
import { NO_LIVE_EXTRAS } from '../moduleContract.js'
import { getCompleteStage } from '../../shared/taskStages.js'
import { compactTurtleResultForSync } from '../turtle/sync.js'

// Contract v2 hooks (lifecycle / storage / wire) must reproduce today's behaviour exactly.
// The legacy oracles below are verbatim copies of the inline branches the hooks replaced, so
// any drift in a definition shows up here as well as in the Phase 0 characterisation suites.

const def = (type) => getModuleDefinition(type)

// ── Legacy oracles ────────────────────────────────────────────────────────────

// StudentView.jsx hasCompleteSolution, before lifecycle.hasComplete.
function legacyHasComplete(type, task) {
  const unifiedCompleteStage = getCompleteStage(task)?.stage
  return type === 'python' || type === 'arcade' || type === 'turtle'
    ? !!(unifiedCompleteStage?.code ?? task?.completeCode)
    : type === 'scratch'
      ? !!task?.completeBlocks
      : type === 'filesystem'
        ? !!task?.completeFs
        : type === 'desktop'
          ? !!task?.completeDesktop
          : type === 'electronics'
            ? !!task?.completeCircuit
            : unifiedCompleteStage?.files?.length > 0 || task?.completeFiles?.length > 0
}

// TeacherEditorPanel.jsx showCompleteTab, before lifecycle.teacherCompleteTab.
function legacyTeacherCompleteTab(type, task) {
  const usesUnifiedStages = type === 'python' || type === 'html'
  return (
    !usesUnifiedStages &&
    (type === 'python' ||
      type === 'html' ||
      (type === 'scratch' && task?.completeBlocks != null) ||
      (type === 'filesystem' && !!task?.completeFs) ||
      (type === 'desktop' && !!task?.completeDesktop) ||
      (type === 'electronics' && !!task?.completeCircuit))
  )
}

// composedLesson.js sandboxFields, before lifecycle.composedSandboxFields.
function legacySandboxFields(moduleType, fallbackTask) {
  if (moduleType === 'python' || moduleType === 'arcade')
    return { sandboxStarter: fallbackTask?.starterCode ?? '' }
  if (moduleType === 'html') return { sandboxStarterFiles: fallbackTask?.starterFiles ?? [] }
  if (moduleType === 'scratch') {
    const blocks = fallbackTask?.starterBlocks ?? null
    return { sandboxStarter: blocks == null ? null : JSON.stringify(blocks) }
  }
  if (moduleType === 'filesystem') return { sandboxStarterFs: fallbackTask?.starterFs ?? null }
  if (moduleType === 'desktop')
    return { sandboxStarterDesktop: fallbackTask?.starterDesktop ?? null }
  if (moduleType === 'electronics')
    return { sandboxStarterCircuit: fallbackTask?.starterCircuit ?? null }
  return {}
}

const TASKS = [
  undefined,
  null,
  {},
  { starterCode: 'print(1)', completeCode: 'print(2)' },
  { completeCode: '' },
  { codeStages: [{ role: 'complete', code: 'done' }] },
  { codeStages: [{ role: 'complete', code: '' }], completeCode: 'x' },
  { codeStages: [{ role: 'complete', files: [{ name: 'a.html', content: '' }] }] },
  { completeFiles: [{ name: 'index.html', content: '<p>' }], starterFiles: [] },
  { completeFiles: [] },
  { starterBlocks: { a: 1 }, completeBlocks: { b: 2 } },
  { completeBlocks: null },
  { starterFs: { type: 'dir' }, completeFs: { type: 'dir', children: [] } },
  { starterDesktop: { apps: [] }, completeDesktop: { apps: ['fileManager'] } },
  { starterCircuit: { components: [] }, completeCircuit: { components: [{ id: 'led' }] } },
]

describe('lifecycle hooks match the inline branches they replaced', () => {
  for (const type of MODULE_TYPES) {
    it(`${type}: hasComplete`, () => {
      for (const task of TASKS) {
        expect(def(type).lifecycle.hasComplete(task), JSON.stringify(task)).toBe(
          legacyHasComplete(type, task)
        )
      }
    })

    it(`${type}: teacherCompleteTab`, () => {
      for (const task of TASKS) {
        expect(!!def(type).lifecycle.teacherCompleteTab(task), JSON.stringify(task)).toBe(
          legacyTeacherCompleteTab(type, task)
        )
      }
    })

    it(`${type}: composedSandboxFields`, () => {
      for (const task of TASKS) {
        expect(def(type).lifecycle.composedSandboxFields(task), JSON.stringify(task)).toEqual(
          legacySandboxFields(type, task)
        )
      }
    })

    it(`${type}: getSandboxState is the sandboxStarter alias`, () => {
      expect(def(type).getSandboxState).toBe(def(type).lifecycle.sandboxStarter)
    })
  }
})

// ── Storage adapters: exact record shapes from docs/agents/runtime-model.md ─────

const design = { sprites: [{ id: 's1' }], sounds: [] }
const fs = { type: 'dir', name: '/', children: [{ type: 'file', name: 'a.txt', content: 'hi' }] }
const desktop = { apps: ['fileManager'], windows: [], fs }
const blocks = { __stage__: { blocks: [] }, sprite1: { blocks: [{ opcode: 'x' }] } }

const RECORD_CASES = {
  python: {
    work: 'print(1)',
    meta: { output: '1\n', runStatus: 'success' },
    task: { code: 'print(1)', output: '1\n', runStatus: 'success' },
    sandbox: { code: 'print(1)' },
  },
  turtle: {
    work: 'import turtle',
    meta: { output: '', runStatus: null },
    task: { code: 'import turtle', output: '', runStatus: null },
    sandbox: { code: 'import turtle' },
  },
  arcade: {
    work: 'game.run()',
    meta: { output: '', runStatus: 'success', arcadeDesign: design },
    task: { code: 'game.run()', output: '', runStatus: 'success', arcadeDesign: design },
    sandbox: { code: 'game.run()', arcadeDesign: design },
  },
  electronics: {
    work: '{"components":[]}',
    meta: {},
    task: { code: '{"components":[]}' },
    sandbox: { code: '{"components":[]}' },
  },
  scratch: { work: blocks, meta: {}, task: { state: blocks }, sandbox: { state: blocks } },
  filesystem: { work: fs, meta: {}, task: { fs }, sandbox: { fs } },
  desktop: { work: desktop, meta: {}, task: { desktop }, sandbox: { desktop } },
}

describe('storage adapters', () => {
  it('covers every module type', () => {
    expect([...Object.keys(RECORD_CASES), 'html'].sort()).toEqual([...MODULE_TYPES].sort())
  })

  for (const [type, { work, meta, task, sandbox }] of Object.entries(RECORD_CASES)) {
    describe(type, () => {
      const { storage } = def(type)

      it('uses the record layout', () => {
        expect(storage.layout).toBe('record')
      })

      it('writes the exact task record shape (key order included)', () => {
        const record = storage.toTaskRecord(work, meta)
        expect(record).toEqual(task)
        expect(JSON.stringify(record)).toBe(JSON.stringify(task))
      })

      it('writes the exact personal-sandbox record shape', () => {
        const record = storage.toSandboxRecord(work, meta)
        expect(JSON.stringify(record)).toBe(JSON.stringify(sandbox))
      })

      it('writes only the work field when no meta is passed', () => {
        expect(Object.keys(storage.toTaskRecord(work))).toEqual([storage.workKey])
        expect(Object.keys(storage.toSandboxRecord(work))).toEqual([storage.workKey])
      })

      it('round-trips through JSON (localStorage) back to work + meta', () => {
        const stored = JSON.parse(JSON.stringify(storage.toTaskRecord(work, meta)))
        const read = storage.fromTaskRecord(stored)
        expect(read.work).toEqual(work)
        expect(storage.toTaskRecord(read.work, read.meta)).toEqual(task)
        const sandboxStored = JSON.parse(JSON.stringify(storage.toSandboxRecord(work, meta)))
        const sandboxRead = storage.fromSandboxRecord(sandboxStored)
        expect(storage.toSandboxRecord(sandboxRead.work, sandboxRead.meta)).toEqual(sandbox)
      })

      it('reads a missing record as null', () => {
        expect(storage.fromTaskRecord(null)).toBeNull()
        expect(storage.fromSandboxRecord(null)).toBeNull()
      })
    })
  }

  describe('html', () => {
    const { storage } = def('html')

    it('stores one { content } record per file', () => {
      expect(storage.layout).toBe('perFile')
      expect(JSON.stringify(storage.toTaskRecord('<p>hi</p>'))).toBe('{"content":"<p>hi</p>"}')
      expect(JSON.stringify(storage.toSandboxRecord('<p>hi</p>'))).toBe('{"content":"<p>hi</p>"}')
      expect(storage.fromTaskRecord({ content: '<p>hi</p>' })).toEqual({
        work: '<p>hi</p>',
        meta: {},
      })
      expect(storage.fromSandboxRecord(null)).toBeNull()
    })
  })
})

// ── Wire codec ────────────────────────────────────────────────────────────────

describe('wire codec', () => {
  const liveInput = {
    arcadeDesign: design,
    turtleResult: { commands: [{ type: 'line', x1: 0.123, y1: 0, x2: 10.07, y2: 0 }] },
  }

  for (const type of MODULE_TYPES) {
    it(`${type}: liveExtras always names both extras`, () => {
      const extras = def(type).wire.liveExtras(liveInput)
      expect(Object.keys(extras).sort()).toEqual(Object.keys(NO_LIVE_EXTRAS).sort())
      expect(extras.arcadeDesign).toBe(type === 'arcade' ? design : null)
      expect(extras.turtleResult).toEqual(
        type === 'turtle' ? compactTurtleResultForSync(liveInput.turtleResult) : null
      )
    })
  }

  it('sends html on the files channel and everything else on the code channel', () => {
    for (const type of MODULE_TYPES) {
      expect(def(type).wire.sandboxChannel).toBe(
        def(type).capabilities.sandboxState === 'files' ? 'files' : 'code'
      )
    }
  })

  it('keeps code-string work as-is', () => {
    for (const type of ['python', 'turtle', 'arcade', 'electronics']) {
      expect(def(type).wire.toCode('x = 1')).toBe('x = 1')
      expect(def(type).wire.fromCode('x = 1')).toBe('x = 1')
      expect(def(type).wire.submission('x = 1')).toBe('x = 1')
    }
  })

  it('serialises JSON-state work exactly like JSON.stringify and parses it back', () => {
    for (const [type, work] of [
      ['scratch', blocks],
      ['filesystem', fs],
      ['desktop', desktop],
    ]) {
      const code = def(type).wire.toCode(work)
      expect(code).toBe(JSON.stringify(work))
      expect(def(type).wire.fromCode(code)).toEqual(work)
      expect(def(type).wire.fromCode('not json')).toBeNull()
      expect(def(type).wire.submission(work)).toBe(work)
    }
  })

  it('logs html submissions as a filename → content map', () => {
    const files = [
      { name: 'index.html', content: '<p>', type: 'html' },
      { name: 'style.css', content: 'p{}', type: 'css' },
    ]
    expect(def('html').wire.submission(files)).toEqual({ 'index.html': '<p>', 'style.css': 'p{}' })
    expect(def('html').wire.toCode(files)).toBeNull()
  })
})
