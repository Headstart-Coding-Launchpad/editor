import { describe, it, expect } from 'vitest'
import {
  LIFECYCLE_HOOKS,
  STORAGE_HOOKS,
  STORAGE_LAYOUTS,
  WIRE_CHANNELS,
  WIRE_HOOKS,
  defineModule,
  defineUiModule,
} from '../defineModule.js'
import { MODULE_TYPES, getModuleDefinition, getModuleDefinitions } from '../definitions.js'
import { getLessonModule, getLessonModules } from '../registry.js'
import { LESSON_MODULE_TYPES } from '../../shared/composedLesson.js'
import pythonDefinition from '../python/definition.js'

describe('module definitions', () => {
  it('registers all eight module types in registry order', () => {
    expect(MODULE_TYPES).toEqual([
      'python',
      'arcade',
      'turtle',
      'scratch',
      'html',
      'filesystem',
      'desktop',
      'electronics',
    ])
    expect(getModuleDefinitions().map((definition) => definition.type)).toEqual(MODULE_TYPES)
  })

  it('matches the registry order and labels', () => {
    expect(getLessonModules().map((mod) => mod.type)).toEqual(MODULE_TYPES)
    expect(getLessonModules().map((mod) => mod.label)).toEqual(
      getModuleDefinitions().map((definition) => definition.meta.label)
    )
  })

  it('keeps LESSON_MODULE_TYPES in its legacy order with the same members', () => {
    expect(LESSON_MODULE_TYPES).toEqual([
      'python',
      'arcade',
      'turtle',
      'html',
      'scratch',
      'filesystem',
      'desktop',
      'electronics',
    ])
    expect([...LESSON_MODULE_TYPES].sort()).toEqual([...MODULE_TYPES].sort())
  })

  it('returns null for an unknown type', () => {
    expect(getModuleDefinition('unknown')).toBeNull()
    expect(getModuleDefinition(undefined)).toBeNull()
  })

  for (const type of MODULE_TYPES) {
    describe(`${type} definition`, () => {
      const definition = getModuleDefinition(type)

      it('passes defineModule validation', () => {
        expect(() => defineModule({ ...definition })).not.toThrow()
        expect(definition.type).toBe(type)
        expect(Object.isFrozen(definition)).toBe(true)
      })

      it('is merged unchanged into the UI module', () => {
        const mod = getLessonModule(type)
        for (const key of Object.keys(definition)) {
          expect(mod[key], key).toBe(definition[key])
        }
      })

      it('defines every contract v2 lifecycle, storage and wire hook', () => {
        for (const key of LIFECYCLE_HOOKS) {
          expect(typeof definition.lifecycle[key], `lifecycle.${key}`).toBe('function')
        }
        expect(STORAGE_LAYOUTS).toContain(definition.storage.layout)
        for (const key of STORAGE_HOOKS) {
          expect(typeof definition.storage[key], `storage.${key}`).toBe('function')
        }
        expect(WIRE_CHANNELS).toContain(definition.wire.sandboxChannel)
        for (const key of WIRE_HOOKS) {
          expect(typeof definition.wire[key], `wire.${key}`).toBe('function')
        }
        for (const group of ['lifecycle', 'storage', 'wire']) {
          expect(Object.isFrozen(definition[group]), group).toBe(true)
        }
        expect(definition.getSandboxState).toBe(definition.lifecycle.sandboxStarter)
      })

      it('keeps UI-only surfaces out of the definition', () => {
        for (const key of [
          'StudentWorkspace',
          'BuilderWorkspace',
          'CheckEditor',
          'TeacherLiveView',
          'getLayoutStyles',
          'runtime',
        ]) {
          expect(key in definition, key).toBe(false)
          expect(key in getLessonModule(type), key).toBe(true)
        }
      })
    })
  }
})

describe('defineModule', () => {
  const valid = () => {
    const { ...copy } = pythonDefinition
    return { ...copy, meta: { ...copy.meta } }
  }

  it('throws a descriptive error for a missing type', () => {
    const def = valid()
    delete def.type
    expect(() => defineModule(def)).toThrow(/"type"/)
  })

  it('throws for a missing meta.label', () => {
    const def = valid()
    delete def.meta.label
    expect(() => defineModule(def)).toThrow(/meta\.label/)
  })

  it.each(['getDisplayState', 'makeCodeTaskFields', 'initialState'])(
    'throws for a missing required hook %s',
    (key) => {
      const def = valid()
      delete def[key]
      expect(() => defineModule(def)).toThrow(new RegExp(`python.*"${key}"`))
    }
  )

  it.each([
    ['lifecycle', 'sandboxStarter'],
    ['lifecycle', 'resetTarget'],
    ['storage', 'toTaskRecord'],
    ['wire', 'liveExtras'],
  ])('throws for a missing contract v2 hook %s.%s', (group, key) => {
    const def = valid()
    def[group] = { ...def[group] }
    delete def[group][key]
    expect(() => defineModule(def)).toThrow(new RegExp(`python.*"${group}\\.${key}"`))
  })

  it('derives getSandboxState from lifecycle.sandboxStarter and rejects a divergent one', () => {
    const def = valid()
    delete def.getSandboxState
    expect(defineModule(def).getSandboxState).toBe(def.lifecycle.sandboxStarter)
    expect(() => defineModule({ ...def, getSandboxState: () => '' })).toThrow(/alias/)
  })

  it('rejects a files sandbox channel on a module whose sandbox state is not files', () => {
    const def = valid()
    def.wire = { ...def.wire, sandboxChannel: 'files' }
    expect(() => defineModule(def)).toThrow(/sandboxChannel/)
  })

  it('throws for a missing capability flag', () => {
    const def = valid()
    delete def.supportsTests
    expect(() => defineModule(def)).toThrow(/"supportsTests"/)
  })

  it('throws for a missing defaultState', () => {
    const def = valid()
    delete def.defaultState
    expect(() => defineModule(def)).toThrow(/defaultState/)
  })

  it('defaults optional hooks to null', () => {
    const def = valid()
    delete def.initCompleteTab
    delete def.serializeState
    const result = defineModule(def)
    expect(result.initCompleteTab).toBeNull()
    expect(result.serializeState).toBeNull()
  })
})

describe('defineUiModule', () => {
  const ui = () => ({
    StudentWorkspace: () => null,
    BuilderWorkspace: () => null,
    CheckEditor: () => null,
    TeacherLiveView: null,
    getLayoutStyles: () => ({}),
    runtime: null,
  })

  it('merges definition and UI', () => {
    const parts = ui()
    const mod = defineUiModule(pythonDefinition, parts)
    expect(mod.type).toBe('python')
    expect(mod.StudentWorkspace).toBe(parts.StudentWorkspace)
    expect(mod.getDisplayState).toBe(pythonDefinition.getDisplayState)
  })

  it('throws when a required UI key is missing', () => {
    const parts = ui()
    delete parts.CheckEditor
    expect(() => defineUiModule(pythonDefinition, parts)).toThrow(/"CheckEditor"/)
  })

  it('throws when a UI key duplicates a definition field', () => {
    expect(() =>
      defineUiModule(pythonDefinition, { ...ui(), getDisplayState: () => null })
    ).toThrow(/duplicates/)
  })
})
