// Contract v2 `checking` + `workSlot` groups (plan step 4.3): the definitions that put a module
// on useStudentCodeState's generic work slot. Pure and Node-safe, validated by defineModule.
import { describe, it, expect } from 'vitest'
import { CHECK_TRIGGERS, defineModule } from '../defineModule.js'
import { MODULE_TYPES, getModuleDefinition } from '../definitions.js'
import pythonDefinition from '../python/definition.js'
import filesystemDefinition from '../filesystem/definition.js'
import htmlDefinition from '../html/definition.js'
import { DEFAULT_FS } from '../filesystem/filesystem.js'
import { makeDefaultDesktop, normaliseDesktop } from '../desktop/desktopState.js'

const WORK_SLOT_TYPES = ['filesystem', 'desktop']

describe('work-slot definitions', () => {
  it('only filesystem and desktop are on the generic work slot so far', () => {
    const onSlot = MODULE_TYPES.filter((type) => getModuleDefinition(type).workSlot != null)
    expect(onSlot.sort()).toEqual([...WORK_SLOT_TYPES].sort())
    for (const type of MODULE_TYPES) {
      const definition = getModuleDefinition(type)
      expect(definition.checking == null, type).toBe(definition.workSlot == null)
    }
  })

  it.each(WORK_SLOT_TYPES)('%s declares frozen checking and workSlot groups', (type) => {
    const definition = getModuleDefinition(type)
    expect(Object.isFrozen(definition.checking)).toBe(true)
    expect(Object.isFrozen(definition.workSlot)).toBe(true)
    expect(definition.checking.trigger).toBe('change')
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
    })
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
    const result = defineModule({ ...pythonDefinition, meta: { ...pythonDefinition.meta } })
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

  it('rejects a work slot on a per-file module', () => {
    expect(() =>
      defineModule({
        ...htmlDefinition,
        meta: { ...htmlDefinition.meta },
        checking: { ...filesystemDefinition.checking },
        workSlot: { ...filesystemDefinition.workSlot },
      })
    ).toThrow(/record/)
  })
})
