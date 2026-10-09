// @vitest-environment node
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
import { builtInOnly } from './helpers/builtInModules.js'

describe('module definitions', () => {
  it('registers the eight built-in module types in registry order', () => {
    expect(builtInOnly(MODULE_TYPES)).toEqual([
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
    expect(builtInOnly(LESSON_MODULE_TYPES)).toEqual([
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

// Plan step 4.7: the capabilities that replaced the per-type gates in StudentView,
// StudentModal, StudentWorkspaceBody, StudentCard and LessonTaskContent. Each value pins the
// inline rule it replaced, so a definition edit that changes a classroom gate is visible here.
describe('student / teacher-monitoring UI capabilities (plan step 4.7)', () => {
  // Pins the built-in modules' values (see ./helpers/builtInModules.js).
  const TYPES = builtInOnly(MODULE_TYPES)
  const pick = (key) =>
    Object.fromEntries(TYPES.map((type) => [type, getModuleDefinition(type).capabilities[key]]))
  const typesWith = (key) => TYPES.filter((type) => pick(key)[type])

  it('stageReveal: python and html reveal progressively, the rest offer the next stage', () => {
    expect(pick('stageReveal')).toEqual({
      python: 'progressive',
      arcade: 'offer',
      turtle: 'offer',
      scratch: 'offer',
      html: 'progressive',
      filesystem: 'offer',
      desktop: 'offer',
      electronics: 'offer',
    })
  })

  it('teacherStageReveal matches the StudentModal Reveal menu (turtle has never had it)', () => {
    expect(typesWith('teacherStageReveal')).toEqual([
      'python',
      'arcade',
      'scratch',
      'html',
      'electronics',
    ])
  })

  it.each([
    ['highlights', ['python', 'html']],
    ['downloadCode', ['python']],
    ['fixedExplainer', ['scratch']],
    [
      'topicLibrary',
      ['python', 'arcade', 'turtle', 'html', 'filesystem', 'desktop', 'electronics'],
    ],
  ])('%s is set for %j', (key, types) => {
    expect(typesWith(key)).toEqual(types)
  })

  it('studentMirror and cardSummary', () => {
    expect(pick('studentMirror')).toEqual({
      python: 'code',
      arcade: 'view',
      turtle: 'view',
      scratch: 'blocks',
      html: 'files',
      filesystem: 'view',
      desktop: 'view',
      electronics: 'view',
    })
    expect(pick('cardSummary')).toEqual({
      python: 'output',
      arcade: 'output',
      turtle: null,
      scratch: 'blocks',
      html: null,
      filesystem: 'fs',
      desktop: null,
      electronics: 'output',
    })
  })

  it('remote run is offered exactly for the modules with a Run', () => {
    expect(TYPES.filter((type) => pick('run')[type] !== 'none')).toEqual([
      'python',
      'arcade',
      'turtle',
      'scratch',
      'html',
      'electronics',
    ])
  })

  it('focusPanes are the extra highlight/force panes (Electronics, Scratch)', () => {
    expect(pick('focusPanes')).toEqual({
      python: [],
      arcade: [],
      turtle: [],
      scratch: [
        { id: 'blocks', label: 'Blocks' },
        { id: 'stage', label: 'Stage' },
      ],
      html: [],
      filesystem: [],
      desktop: [],
      electronics: [
        { id: 'breadboard', label: 'Breadboard' },
        { id: 'code', label: 'MicroPython' },
      ],
    })
  })

  it('teacherEditor is declared exactly for workSlot.teacherEdit modules, with its copy', () => {
    const code = { surface: 'code', workspace: null, design: false }
    expect(pick('teacherEditor')).toEqual({
      python: code,
      arcade: { surface: 'view', workspace: 'code', design: true },
      turtle: code,
      scratch: { surface: 'blocks', workspace: null, design: false },
      html: { surface: 'files', workspace: null, design: false },
      filesystem: null,
      desktop: null,
      electronics: { surface: 'view', workspace: 'breadboard', design: false },
    })
    for (const type of MODULE_TYPES) {
      const definition = getModuleDefinition(type)
      expect(definition.capabilities.teacherEditor !== null, type).toBe(
        definition.workSlot.teacherEdit
      )
    }
    const copy = (type) => getModuleDefinition(type).meta.teacherEditCopy
    expect(copy('scratch').action).toBe('Edit Blocks')
    expect(copy('scratch').consent).toMatch(/Scratch blocks/)
    expect(copy('electronics').action).toBe('Edit Code')
    expect(copy('electronics').consent).toMatch(/breadboard/)
    for (const type of ['python', 'arcade', 'turtle', 'html']) {
      expect(copy(type).action, type).toBe('Edit Code')
      expect(copy(type).consent, type).toMatch(/They will type in your editor/)
    }
    expect(copy('filesystem')).toBeNull()
    expect(copy('desktop')).toBeNull()
  })

  it('lifecycle.hasPersonalSandbox follows each module sandbox-starter rule', () => {
    const offered = (lesson) =>
      TYPES.filter((type) => getModuleDefinition(type).lifecycle.hasPersonalSandbox(lesson))
    expect(offered({})).toEqual(['python', 'arcade', 'turtle'])
    expect(
      offered({
        sandboxStarter: '',
        sandboxStarterFiles: [{ name: 'index.html' }],
        sandboxStarterFs: {},
        sandboxStarterDesktop: {},
        sandboxStarterCircuit: {},
      })
    ).toEqual(TYPES)
    expect(offered({ sandboxStarterFiles: [], sandboxStarter: null })).toEqual([
      'python',
      'arcade',
      'turtle',
    ])
  })

  describe('defineModule validation', () => {
    const redefine = (overrides = {}, base = pythonDefinition) =>
      defineModule({
        ...base,
        meta: { ...base.meta, ...(overrides.meta ?? {}) },
        capabilities: { ...base.capabilities, ...(overrides.capabilities ?? {}) },
        getSandboxState: undefined,
      })

    it('accepts every registered definition unchanged', () => {
      for (const type of MODULE_TYPES) {
        expect(() => redefine({}, getModuleDefinition(type))).not.toThrow()
      }
    })

    it.each([
      [{ capabilities: { stageReveal: 'always' } }, /capabilities\.stageReveal/],
      [{ capabilities: { studentMirror: 'canvas' } }, /capabilities\.studentMirror/],
      [{ capabilities: { studentMirror: 'files' } }, /studentMirror.*wire\.sandboxChannel/],
      [{ capabilities: { studentMirror: 'view' } }, /highlights.*"code" or "files"/],
      [{ capabilities: { highlights: undefined } }, /capabilities\.highlights/],
      [{ capabilities: { fixedExplainer: true } }, /fixedExplainer/],
      [{ capabilities: { cardSummary: 'console' } }, /capabilities\.cardSummary/],
      [{ capabilities: { focusPanes: [{ id: 'instructions', label: 'Info' }] } }, /focusPanes/],
      [{ capabilities: { focusPanes: [{ id: 'code' }] } }, /focusPanes/],
      [{ capabilities: { teacherEditor: { surface: 'canvas' } } }, /teacherEditor\.surface/],
      [{ capabilities: { teacherEditor: { surface: 'files' } } }, /teacherEditor\.surface/],
      [{ capabilities: { teacherEditor: null } }, /workSlot\.teacherEdit/],
      [{ meta: { teacherEditCopy: null } }, /meta\.teacherEditCopy/],
    ])('rejects %j', (overrides, message) => {
      expect(() => redefine(overrides)).toThrow(message)
    })

    it('rejects a teacherEditor on a module whose work slot has no teacher edit', () => {
      expect(() =>
        redefine(
          {
            capabilities: { teacherEditor: { surface: 'view' } },
            meta: { teacherEditCopy: { action: 'Edit', consent: 'May I?' } },
          },
          getModuleDefinition('filesystem')
        )
      ).toThrow(/workSlot\.teacherEdit/)
    })

    it('rejects a missing lifecycle.hasPersonalSandbox', () => {
      const lifecycle = { ...pythonDefinition.lifecycle }
      delete lifecycle.hasPersonalSandbox
      expect(() =>
        defineModule({
          ...pythonDefinition,
          meta: { ...pythonDefinition.meta },
          getSandboxState: undefined,
          lifecycle,
        })
      ).toThrow(/lifecycle\.hasPersonalSandbox/)
    })
  })
})

// Plan step 4.8: the knobs that replaced the last inline type comparisons outside src/builder.
describe('core-surface capabilities (plan step 4.8)', () => {
  const typesWith = (predicate) =>
    builtInOnly(
      getModuleDefinitions()
        .filter(predicate)
        .map((definition) => definition.type)
    ).sort()

  it.each([
    ['teacherFillHeight', ['desktop', 'electronics', 'filesystem', 'html', 'scratch']],
    ['teacherSandboxRow', ['html', 'scratch']],
    ['teacherUnifiedStageTabs', ['html', 'python']],
    ['explainerBlockMenu', ['scratch']],
    ['sideQuests', ['html', 'python', 'turtle']],
  ])('%s is declared exactly by %j', (capability, types) => {
    expect(typesWith((definition) => definition.capabilities[capability] === true)).toEqual(types)
    for (const definition of getModuleDefinitions()) {
      expect(typeof definition.capabilities[capability]).toBe('boolean')
    }
  })

  it('lifecycle.playgroundTask exists exactly for the playground modules', () => {
    expect(
      typesWith((definition) => typeof definition.lifecycle.playgroundTask === 'function')
    ).toEqual(typesWith((definition) => definition.meta.playground))
    expect(getModuleDefinition('python').lifecycle.playgroundTask()).toEqual({
      id: 1,
      title: 'Python playground',
      starterCode: '',
    })
  })

  it('workSlot.teacherStarter defaults to starter (electronics overrides it)', () => {
    for (const definition of getModuleDefinitions()) {
      const { workSlot } = definition
      if (definition.type === 'electronics') {
        expect(workSlot.teacherStarter).not.toBe(workSlot.starter)
      } else {
        expect(workSlot.teacherStarter).toBe(workSlot.starter)
      }
    }
  })

  it('meta.pickerOrder defaults to meta.order (html and scratch swap in the picker)', () => {
    expect(getModuleDefinition('python').meta.pickerOrder).toBe(0)
    expect(getModuleDefinition('html').meta.pickerOrder).toBe(3)
    expect(getModuleDefinition('scratch').meta.pickerOrder).toBe(4)
    const electronics = getModuleDefinition('electronics')
    expect(electronics.meta.pickerOrder).toBe(electronics.meta.order)
  })

  it('rejects a playground module without lifecycle.playgroundTask, and a stray one', () => {
    const base = {
      ...pythonDefinition,
      meta: { ...pythonDefinition.meta },
      getSandboxState: undefined,
    }
    const lifecycle = { ...pythonDefinition.lifecycle, playgroundTask: undefined }
    expect(() => defineModule({ ...base, lifecycle })).toThrow(/lifecycle\.playgroundTask/)
    expect(() => defineModule({ ...base, meta: { ...base.meta, playground: false } })).toThrow(
      /lifecycle\.playgroundTask/
    )
  })

  it('rejects a non-boolean optional capability', () => {
    expect(() =>
      defineModule({
        ...pythonDefinition,
        meta: { ...pythonDefinition.meta },
        capabilities: { ...pythonDefinition.capabilities, teacherFillHeight: 'yes' },
        getSandboxState: undefined,
      })
    ).toThrow(/capabilities\.teacherFillHeight/)
  })
})
