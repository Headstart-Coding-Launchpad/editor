// `capabilities.run` (plan step 4.4): what useStudentCodeState's Run does for each module —
// run the code through the module's runtime, build the HTML preview, leave it to the workspace,
// or nothing. handleRun dispatches on it instead of on the lesson type.
import { describe, it, expect } from 'vitest'
import { RUN_KINDS, RUN_RESULT_FLAGS, defineModule } from '../defineModule.js'
import { MODULE_TYPES, getModuleDefinition } from '../definitions.js'
import { getLessonModule } from '../registry'
import htmlDefinition from '../html/definition.js'
import pythonDefinition from '../python/definition.js'
import { builtInOnly } from './helpers/builtInModules.js'

const EXPECTED_RUN = {
  python: 'runtime',
  turtle: 'runtime',
  electronics: 'runtime',
  html: 'preview',
  arcade: 'workspace',
  scratch: 'workspace',
  filesystem: 'none',
  desktop: 'none',
}

describe('capabilities.run', () => {
  it('every module declares (or defaults to) its run kind', () => {
    expect(Object.keys(EXPECTED_RUN).sort()).toEqual(builtInOnly([...MODULE_TYPES]).sort())
    for (const type of builtInOnly(MODULE_TYPES)) {
      expect(getModuleDefinition(type).capabilities.run, type).toBe(EXPECTED_RUN[type])
      expect(RUN_KINDS).toContain(getModuleDefinition(type).capabilities.run)
    }
  })

  it('runtime modules declare runResult; the rest have none', () => {
    expect(getModuleDefinition('python').runResult).toEqual({
      errorLine: true,
      turtle: false,
      liveCode: false,
    })
    expect(getModuleDefinition('turtle').runResult).toEqual({
      errorLine: false,
      turtle: true,
      liveCode: false,
    })
    expect(getModuleDefinition('electronics').runResult).toEqual({
      errorLine: false,
      turtle: false,
      liveCode: true,
    })
    for (const type of MODULE_TYPES) {
      const definition = getModuleDefinition(type)
      if (definition.capabilities.run === 'runtime') {
        expect(Object.keys(definition.runResult).sort(), type).toEqual([...RUN_RESULT_FLAGS].sort())
      } else {
        expect(definition.runResult, type).toBeNull()
      }
    }
  })

  it('agrees with the UI half: runtime modules can run, the preview module builds previews', () => {
    for (const type of MODULE_TYPES) {
      const mod = getLessonModule(type)
      const run = mod.capabilities.run
      if (run === 'runtime') {
        expect(typeof mod.runtime?.run, type).toBe('function')
        expect(typeof mod.runtime?.stop, type).toBe('function')
        // runWithRuntime works through the generic work slot.
        expect(mod.workSlot, type).not.toBeNull()
      }
      if (run === 'preview') expect(typeof mod.runtime?.buildPreviewSrc, type).toBe('function')
    }
  })

  it('defineModule validates the run kind and runResult', () => {
    const redefine = (overrides) =>
      defineModule({
        ...pythonDefinition,
        meta: { ...pythonDefinition.meta },
        getSandboxState: undefined,
        ...overrides,
      })
    expect(() =>
      redefine({ capabilities: { ...pythonDefinition.capabilities, run: 'execute' } })
    ).toThrow(/capabilities\.run/)
    expect(() => redefine({ runResult: null })).toThrow(/runResult/)
    expect(() => redefine({ runResult: { errorLine: true, turtle: false } })).toThrow(
      /runResult\.liveCode/
    )
    expect(() =>
      defineModule({
        ...htmlDefinition,
        meta: { ...htmlDefinition.meta },
        getSandboxState: undefined,
        runResult: { errorLine: false, turtle: false, liveCode: false },
      })
    ).toThrow(/only declared by "runtime" modules/)
    const { run: _run, ...noRun } = htmlDefinition.capabilities
    expect(
      defineModule({
        ...htmlDefinition,
        meta: { ...htmlDefinition.meta },
        getSandboxState: undefined,
        capabilities: noRun,
      }).capabilities.run
    ).toBe('none')
  })
})
