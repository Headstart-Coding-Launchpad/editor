// Contract v2 `checking` + `workSlot` groups (plan step 4.3): the definitions that put a module
// on useStudentCodeState's generic work slot. Pure and Node-safe, validated by defineModule.
import { describe, it, expect } from 'vitest'
import { CHECK_TRIGGERS, defineModule } from '../defineModule.js'
import { MODULE_TYPES, getModuleDefinition } from '../definitions.js'
import filesystemDefinition from '../filesystem/definition.js'
import htmlDefinition from '../html/definition.js'
import scratchDefinition from '../scratch/definition.js'
import { perFileStorage } from '../moduleContract.js'
import { builtInOnly } from './helpers/builtInModules.js'
import { DEFAULT_FS } from '../filesystem/filesystem.js'
import { makeDefaultDesktop, normaliseDesktop } from '../desktop/desktopState.js'

// Plan step 4.3 put filesystem and desktop on the slot (checked on every change); step 4.4
// added the code modules (checked on Run); step 4.5 html (per file, checked on Run) and scratch
// (its workspace checks and reports).
const CHANGE_CHECKED_TYPES = ['filesystem', 'desktop']
const RUN_CHECKED_TYPES = ['python', 'turtle', 'arcade', 'electronics', 'html']
const WORKSPACE_CHECKED_TYPES = ['scratch']
const WORK_SLOT_TYPES = [...CHANGE_CHECKED_TYPES, ...RUN_CHECKED_TYPES, ...WORKSPACE_CHECKED_TYPES]
const triggerOf = (type) =>
  CHANGE_CHECKED_TYPES.includes(type)
    ? 'change'
    : WORKSPACE_CHECKED_TYPES.includes(type)
      ? 'workspace'
      : 'run'

describe('work-slot definitions', () => {
  it('every module is on the generic work slot', () => {
    const onSlot = MODULE_TYPES.filter((type) => getModuleDefinition(type).workSlot != null)
    expect(builtInOnly(onSlot).sort()).toEqual([...WORK_SLOT_TYPES].sort())
    expect(onSlot.sort()).toEqual([...MODULE_TYPES].sort())
    for (const type of MODULE_TYPES) {
      const definition = getModuleDefinition(type)
      expect(definition.checking == null, type).toBe(definition.workSlot == null)
    }
  })

  it.each(WORK_SLOT_TYPES)('%s declares frozen checking and workSlot groups', (type) => {
    const definition = getModuleDefinition(type)
    expect(Object.isFrozen(definition.checking)).toBe(true)
    expect(Object.isFrozen(definition.workSlot)).toBe(true)
    expect(definition.checking.trigger).toBe(triggerOf(type))
    expect(CHECK_TRIGGERS).toContain(definition.checking.trigger)
  })

  it('filesystem: the check context is the tree plus the interaction', () => {
    const { checking, workSlot } = getModuleDefinition('filesystem')
    const fs = { '/': { type: 'dir' } }
    expect(checking.buildContext(fs, { currentDir: '/docs', openFile: null })).toEqual({
      fs,
      currentDir: '/docs',
      openFile: null,
    })
    expect(workSlot).toMatchObject({
      starterField: 'starterFs',
      sandboxField: 'sandboxStarterFs',
      stageField: 'fs',
    })
    expect(workSlot.empty()).toBe(DEFAULT_FS)
    expect(workSlot.normalise(fs)).toBe(fs)
  })

  it('desktop: fs checks see the desktop tree; restored work is normalised', () => {
    const { checking, workSlot } = getModuleDefinition('desktop')
    const desktop = normaliseDesktop({ fs: { '/': { type: 'dir' } } })
    expect(checking.buildContext(desktop, { currentDir: '/', openFile: '/a.txt' })).toEqual({
      fs: desktop.fs,
      desktop,
      currentDir: '/',
      openFile: '/a.txt',
      input: null,
    })
    // The recorded input summary rides on the interaction into ctx.input.
    const input = { gestures: { double_click: { any: 1 } } }
    expect(checking.buildContext(desktop, { currentDir: '/', input }).input).toBe(input)
    expect(workSlot).toMatchObject({
      starterField: 'starterDesktop',
      sandboxField: 'sandboxStarterDesktop',
      stageField: 'desktop',
    })
    expect(workSlot.empty()).toEqual(makeDefaultDesktop())
    expect(workSlot.empty({ availableApps: ['paint'] })).toEqual(makeDefaultDesktop(['paint']))
    expect(workSlot.normalise({ fs: desktop.fs, windows: [] })).toEqual(
      normaliseDesktop({ fs: desktop.fs, windows: [] })
    )
  })
})

describe('defineModule — checking / workSlot validation', () => {
  const withSlot = (overrides = {}) => ({
    ...filesystemDefinition,
    meta: { ...filesystemDefinition.meta },
    checking: { ...filesystemDefinition.checking },
    workSlot: { ...filesystemDefinition.workSlot },
    ...overrides,
  })

  it('defaults both groups to null when absent', () => {
    const result = defineModule({
      ...htmlDefinition,
      meta: { ...htmlDefinition.meta },
      checking: undefined,
      workSlot: undefined,
    })
    expect(result.checking).toBeNull()
    expect(result.workSlot).toBeNull()
  })

  it('requires checking and workSlot together', () => {
    expect(() => defineModule(withSlot({ checking: null }))).toThrow(/declared together/)
    expect(() => defineModule(withSlot({ workSlot: undefined }))).toThrow(/declared together/)
  })

  it('rejects an unknown trigger and a missing buildContext', () => {
    expect(() =>
      defineModule(withSlot({ checking: { ...filesystemDefinition.checking, trigger: 'typing' } }))
    ).toThrow(/checking\.trigger/)
    expect(() => defineModule(withSlot({ checking: { trigger: 'change' } }))).toThrow(
      /filesystem.*"checking\.buildContext"/
    )
  })

  it('accepts an optional evaluateWithoutRun function and rejects anything else', () => {
    const evaluateWithoutRun = () => null
    expect(
      defineModule(withSlot({ checking: { ...filesystemDefinition.checking, evaluateWithoutRun } }))
        .checking.evaluateWithoutRun
    ).toBe(evaluateWithoutRun)
    expect(() =>
      defineModule(
        withSlot({ checking: { ...filesystemDefinition.checking, evaluateWithoutRun: 'yes' } })
      )
    ).toThrow(/checking\.evaluateWithoutRun/)
  })

  it.each(['starterField', 'sandboxField', 'stageField', 'empty', 'normalise'])(
    'requires workSlot.%s',
    (key) => {
      const workSlot = { ...filesystemDefinition.workSlot }
      delete workSlot[key]
      expect(() => defineModule(withSlot({ workSlot }))).toThrow(
        new RegExp(`filesystem.*"workSlot\\.${key}"`)
      )
    }
  )

  it('rejects a per-file slot on the code channel', () => {
    expect(() => defineModule(withSlot({ storage: perFileStorage() }))).toThrow(
      /"record" storage layout on the "code" wire channel, or "perFile" on "files"/
    )
  })

  it('accepts a missing buildContext only for a workspace trigger', () => {
    const scratch = { ...scratchDefinition, meta: { ...scratchDefinition.meta } }
    expect(defineModule(scratch).checking).toEqual({
      trigger: 'workspace',
      evaluateWithoutRun: expect.any(Function),
    })
    expect(() =>
      defineModule({ ...scratch, checking: { trigger: 'run' }, getSandboxState: undefined })
    ).toThrow(/scratch.*"checking\.buildContext"/)
  })

  it('a workspace-owned slot needs the workspace trigger', () => {
    expect(() =>
      defineModule(
        withSlot({ workSlot: { ...filesystemDefinition.workSlot, workspaceOwned: true } })
      )
    ).toThrow(/workspaceOwned.*"workspace" checking trigger/)
  })
})

describe('code-module work slots (plan step 4.4)', () => {
  const task = {
    id: 't1',
    starterCode: 'legacy starter',
    completeCode: 'legacy complete',
    codeStages: [
      { role: 'starter', code: 'stage starter' },
      { role: 'support', code: 'support', arcadeDesign: { sprites: [{ id: 's' }], maps: [] } },
      { role: 'complete', code: 'stage complete' },
    ],
  }

  it.each(['python', 'turtle'])('%s: the value is the code string', (type) => {
    const { workSlot } = getModuleDefinition(type)
    expect(workSlot.kind).toBe('code')
    expect(workSlot.starter(task)).toBe('stage starter')
    expect(workSlot.stage(task, 1)).toBe('support')
    expect(workSlot.complete(task)).toBe('stage complete')
    expect(workSlot.sandbox({ sandboxStarter: 'sb' })).toBe('sb')
    expect(workSlot.fromResetTarget({ code: 'reset' })).toBe('reset')
    expect(workSlot.stored('x')).toEqual({ work: 'x', meta: {} })
    expect(workSlot.fromStored({ work: 'saved', meta: {} }, 'fallback')).toBe('saved')
    expect(workSlot.fromStored(null, 'fallback')).toBe('fallback')
    expect(workSlot).toMatchObject({
      taskReset: true,
      teacherSandboxReset: true,
      remoteResetPersists: false,
    })
  })

  it('arcade: { code, arcadeDesign }, stored as the code plus the design field', () => {
    const { workSlot } = getModuleDefinition('arcade')
    const value = { code: 'player = 1', arcadeDesign: { version: 1, sprites: [], maps: [] } }
    expect(workSlot.stored(value)).toEqual({
      work: 'player = 1',
      meta: { arcadeDesign: value.arcadeDesign },
    })
    expect(workSlot.starter(task).code).toBe('stage starter')
    expect(workSlot.stage(task, 1).arcadeDesign.sprites).toHaveLength(1)
    expect(workSlot.sandbox({ sandboxStarter: 'sb' })).toEqual({ code: 'sb', arcadeDesign: null })
    // A missing stored design keeps the fallback's; a stored one is cloned.
    const kept = workSlot.fromStored({ work: 'new', meta: {} }, value)
    expect(kept).toEqual({ code: 'new', arcadeDesign: value.arcadeDesign })
    const restored = workSlot.fromStored(
      { work: 'new', meta: { arcadeDesign: value.arcadeDesign } },
      { code: '', arcadeDesign: null }
    )
    expect(restored.arcadeDesign).toEqual(value.arcadeDesign)
    expect(restored.arcadeDesign).not.toBe(value.arcadeDesign)
    expect(workSlot).toMatchObject({
      kind: 'code',
      teacherSandboxReset: false,
      remoteResetPersists: true,
    })
  })

  it('electronics: a state slot of serialised circuits whose check context adds `circuit`', () => {
    const { workSlot, checking } = getModuleDefinition('electronics')
    expect(workSlot.kind).toBe('state')
    expect(workSlot.taskReset).toBe(true)
    expect(workSlot.empty()).toBe('')
    expect(
      JSON.parse(workSlot.starter({ starterCircuit: { components: [], wires: [] } }))
    ).toMatchObject({ components: [], wires: [] })
    expect(checking.buildContext('{"c":1}', { status: 'success' })).toEqual({
      status: 'success',
      code: '{"c":1}',
      circuit: '{"c":1}',
    })
  })

  it('field-declared slots (filesystem) get derived source hooks', () => {
    const { workSlot } = getModuleDefinition('filesystem')
    const fs = { '/': { type: 'dir', children: ['a.txt'] } }
    expect(workSlot.kind).toBe('state')
    expect(workSlot.taskReset).toBe(false)
    expect(workSlot.starter({ starterFs: fs })).toBe(fs)
    expect(workSlot.starter({})).toBe(DEFAULT_FS)
    expect(workSlot.stage({ codeStages: [{ fs }] }, 0)).toBe(fs)
    expect(workSlot.complete({ completeFs: fs })).toBe(fs)
    expect(workSlot.sandbox({ sandboxStarterFs: fs })).toBe(fs)
    expect(workSlot.fromResetTarget({ fs })).toBe(fs)
    expect(workSlot.fromStored({ work: fs, meta: {} }, DEFAULT_FS)).toBe(fs)
  })

  it('rejects a hook-form slot missing a source hook, an unknown kind or a non-boolean flag', () => {
    const python = getModuleDefinition('python')
    const withPythonSlot = (workSlot) =>
      defineModule({ ...python, meta: { ...python.meta }, workSlot, getSandboxState: undefined })
    const noStarter = { ...python.workSlot }
    delete noStarter.starter
    expect(() => withPythonSlot(noStarter)).toThrow(/python.*"workSlot\.starter"/)
    expect(() => withPythonSlot({ ...python.workSlot, kind: 'text' })).toThrow(/workSlot\.kind/)
    expect(() => withPythonSlot({ ...python.workSlot, taskReset: 'yes' })).toThrow(
      /workSlot\.taskReset/
    )
  })
})

describe('html and scratch work slots (plan step 4.5)', () => {
  const file = (name, content) => ({ name, type: 'html', content })

  it('html: { files, activeFile }, every source copying its files', () => {
    const { workSlot, checking, storage, wire } = getModuleDefinition('html')
    expect(storage.layout).toBe('perFile')
    expect(wire.sandboxChannel).toBe('files')
    expect(workSlot).toMatchObject({
      kind: 'code',
      taskReset: true,
      teacherEdit: true,
      workspaceOwned: false,
      teacherSandboxReset: false,
      remoteResetPersists: false,
    })
    const starterFiles = [file('index.html', '<p>a</p>'), file('style.css', 'p {}')]
    const task = {
      entryFile: 'index.html',
      starterFiles,
      completeFiles: [file('index.html', '<h1>done</h1>')],
      completeEntryFile: 'index.html',
      codeStages: [
        { role: 'starter', files: [file('main.html', 'stage starter')] },
        { role: 'support', files: [file('b.html', 'support')], entryFile: 'b.html' },
      ],
    }
    const starter = workSlot.starter(task)
    expect(starter).toEqual({
      files: [file('main.html', 'stage starter')],
      activeFile: 'index.html',
    })
    expect(starter.files[0]).not.toBe(task.codeStages[0].files[0])
    expect(workSlot.starter({ starterFiles })).toEqual({
      files: starterFiles,
      activeFile: 'index.html',
    })
    expect(workSlot.stage(task, 1)).toEqual({
      files: [file('b.html', 'support')],
      activeFile: 'b.html',
    })
    expect(workSlot.complete(task).files[0].content).toBe('<h1>done</h1>')
    expect(workSlot.sandbox({ sandboxStarterFiles: [file('s.html', 's')] })).toEqual({
      files: [file('s.html', 's')],
      activeFile: 's.html',
    })
    expect(workSlot.fromResetTarget({ files: starterFiles, entryFile: 'style.css' })).toEqual({
      files: starterFiles,
      activeFile: 'style.css',
    })
    expect(workSlot.empty()).toEqual({ files: [], activeFile: '' })
    expect(workSlot.stored(starter)).toEqual({ work: starter.files, meta: {} })
    expect(workSlot.fromStored({ work: starterFiles, meta: {} }, starter)).toEqual({
      files: starterFiles,
      activeFile: 'index.html',
    })
    expect(workSlot.fromStored(null, starter)).toBe(starter)
    // A code check reads the files' contents joined; the preview adds its document.
    expect(checking.buildContext(starterFiles, { iframeDoc: 'doc' })).toEqual({
      iframeDoc: 'doc',
      code: '<p>a</p>\np {}',
    })
  })

  it('scratch: workspace-owned states, checked by the workspace', () => {
    const { workSlot, checking } = getModuleDefinition('scratch')
    expect(checking).toEqual({ trigger: 'workspace', evaluateWithoutRun: expect.any(Function) })
    expect(workSlot).toMatchObject({
      kind: 'state',
      workspaceOwned: true,
      taskReset: true,
      teacherEdit: true,
    })
    const blocks = (id) => ({ cat: { id } })
    const task = {
      starterBlocks: blocks('starter'),
      completeBlocks: blocks('complete'),
      codeStages: [{ role: 'starter', blocks: blocks('stage') }],
    }
    // The Reset button's starter has always been starterBlocks.
    expect(workSlot.starter(task)).toEqual(blocks('starter'))
    expect(workSlot.stage(task, 0)).toEqual(blocks('stage'))
    expect(workSlot.stage(task, 3)).toBe(null)
    expect(workSlot.complete(task)).toEqual(blocks('complete'))
    expect(workSlot.sandbox({ sandboxStarter: JSON.stringify(blocks('sb')) })).toEqual(blocks('sb'))
    expect(workSlot.sandbox({ sandboxStarter: 'not json' })).toBe(null)
    expect(workSlot.fromResetTarget({ blocks: blocks('reset'), stageIndex: 0 })).toEqual(
      blocks('reset')
    )
    expect(workSlot.empty()).toBe(null)
  })

  it.each(['filesystem', 'desktop'])('%s never takes a teacher edit', (type) => {
    expect(getModuleDefinition(type).workSlot.teacherEdit).toBe(false)
  })

  it.each(['python', 'turtle', 'arcade', 'electronics'])('%s takes teacher edits', (type) => {
    expect(getModuleDefinition(type).workSlot).toMatchObject({
      teacherEdit: true,
      workspaceOwned: false,
    })
  })
})
