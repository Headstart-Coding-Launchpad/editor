import { describe, it, expect } from 'vitest'
import { defineModule, defineUiModule } from '../defineModule.js'
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

  it.each(['getDisplayState', 'makeCodeTaskFields', 'getSandboxState', 'initialState'])(
    'throws for a missing required hook %s',
    (key) => {
      const def = valid()
      delete def[key]
      expect(() => defineModule(def)).toThrow(new RegExp(`python.*"${key}"`))
    }
  )

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
