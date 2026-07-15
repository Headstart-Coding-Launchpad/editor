import { describe, it, expect } from 'vitest'
import { getLessonModule } from '../registry.js'

const LESSON_TYPES = ['python', 'html', 'scratch', 'filesystem', 'electronics']

describe('module interface contract', () => {
  for (const type of LESSON_TYPES) {
    describe(`${type} module`, () => {
      const mod = getLessonModule(type)

      it('has a type string matching its registry key', () => {
        expect(mod.type).toBe(type)
      })

      it('has getLayoutStyles returning taskContentStyle and editorAreaStyle', () => {
        const styles = mod.getLayoutStyles(false)
        expect(styles).toHaveProperty('taskContentStyle')
        expect(styles).toHaveProperty('editorAreaStyle')
        expect(typeof styles.taskContentStyle).toBe('object')
        expect(typeof styles.editorAreaStyle).toBe('object')
      })

      it('getLayoutStyles accepts isMobile=true without throwing', () => {
        expect(() => mod.getLayoutStyles(true)).not.toThrow()
      })

      it('has makeCodeTaskFields as a function', () => {
        expect(typeof mod.makeCodeTaskFields).toBe('function')
      })

      it('makeCodeTaskFields returns an object given an empty task', () => {
        const result = mod.makeCodeTaskFields({})
        expect(result).not.toBeNull()
        expect(typeof result).toBe('object')
      })

      it('has stageLabels with starterLabel and completeLabel strings', () => {
        expect(typeof mod.stageLabels?.starterLabel).toBe('string')
        expect(typeof mod.stageLabels?.completeLabel).toBe('string')
      })

      it('has explainerInlineCodeLanguages as an array', () => {
        expect(Array.isArray(mod.explainerInlineCodeLanguages)).toBe(true)
      })

      it('has StudentWorkspace, BuilderWorkspace, CheckEditor keys (may be null in Phase 1)', () => {
        expect('StudentWorkspace' in mod).toBe(true)
        expect('BuilderWorkspace' in mod).toBe(true)
        expect('CheckEditor' in mod).toBe(true)
      })

      it('has supportsVariableChecks and supportsDomChecks as booleans', () => {
        expect(typeof mod.supportsVariableChecks).toBe('boolean')
        expect(typeof mod.supportsDomChecks).toBe('boolean')
      })

      it('has carryThroughField as a string and getCarryThroughUpdates/getNewStarterUpdates as functions', () => {
        expect(typeof mod.carryThroughField).toBe('string')
        expect(typeof mod.carryThroughLabel).toBe('string')
        expect(typeof mod.getCarryThroughUpdates).toBe('function')
        expect(typeof mod.getNewStarterUpdates).toBe('function')
      })

      // ── New interface fields ──────────────────────────────────────────────────

      it('has TeacherLiveView as a function/component or null', () => {
        expect(mod.TeacherLiveView === null || typeof mod.TeacherLiveView === 'function').toBe(true)
      })

      it('has getDisplayState as a function', () => {
        expect(typeof mod.getDisplayState).toBe('function')
      })

      it('getDisplayState(task, stage, liveState, "starter") returns liveState', () => {
        const liveState = 'test-live-state'
        expect(mod.getDisplayState({}, null, liveState, 'starter')).toBe(liveState)
      })

      it('getDisplayState does not throw for complete/stage tabs', () => {
        expect(() => mod.getDisplayState({}, null, null, 'complete')).not.toThrow()
        expect(() => mod.getDisplayState({}, null, null, 'stage_0')).not.toThrow()
      })

      it('has defaultState defined on the module', () => {
        expect('defaultState' in mod).toBe(true)
      })

      it('has initialState as a function returning a value for an empty task', () => {
        expect(typeof mod.initialState).toBe('function')
        const result = mod.initialState({})
        expect(result !== undefined).toBe(true)
      })

      it('has serializeState and deserializeState (function or null)', () => {
        const isFnOrNull = v => v === null || typeof v === 'function'
        expect(isFnOrNull(mod.serializeState)).toBe(true)
        expect(isFnOrNull(mod.deserializeState)).toBe(true)
      })

      it('has getSandboxState as a function', () => {
        expect(typeof mod.getSandboxState).toBe('function')
      })

      it('getSandboxState returns a value for empty lesson/task', () => {
        expect(() => mod.getSandboxState({}, {})).not.toThrow()
      })

      it('has runtime as null or an object with the expected shape', () => {
        const { runtime } = mod
        if (runtime === null) return
        expect(typeof runtime).toBe('object')
        expect(typeof runtime.init).toBe('function')
        expect(typeof runtime.isReady).toBe('function')
        expect(typeof runtime.stop).toBe('function')
      })
    })
  }

  describe('python-specific', () => {
    const mod = getLessonModule('python')
    it('makeCodeTaskFields sets starterCode', () => {
      const result = mod.makeCodeTaskFields({ starterCode: 'print("hi")' })
      expect(result.starterCode).toBe('print("hi")')
    })

    it('makeNewStage creates a stage with code', () => {
      const result = mod.makeNewStage({ starterCode: 'x = 1' }, [])
      expect(result.label).toContain('1')
      expect(result.code).toBe('x = 1')
    })

    it('includes python in explainerInlineCodeLanguages', () => {
      expect(mod.explainerInlineCodeLanguages).toContain('python')
    })
  })

  describe('html-specific', () => {
    const mod = getLessonModule('html')
    it('makeCodeTaskFields includes a default index.html when no starter files', () => {
      const result = mod.makeCodeTaskFields({})
      expect(result.starterFiles).toHaveLength(1)
      expect(result.starterFiles[0].name).toBe('index.html')
    })

    it('makeCodeTaskFields preserves existing starter files', () => {
      const files = [{ name: 'index.html', content: '<h1>Hi</h1>' }]
      const result = mod.makeCodeTaskFields({ starterFiles: files })
      expect(result.starterFiles).toBe(files)
    })

    it('makeNewStage creates a stage with files', () => {
      const task = { starterFiles: [{ name: 'index.html', content: '' }], entryFile: 'index.html' }
      const result = mod.makeNewStage(task, [])
      expect(result.label).toContain('1')
      expect(Array.isArray(result.files)).toBe(true)
    })

    it('includes html in explainerInlineCodeLanguages', () => {
      expect(mod.explainerInlineCodeLanguages).toContain('html')
    })
  })

  describe('scratch-specific', () => {
    const mod = getLessonModule('scratch')
    it('makeCodeTaskFields sets toolbox and starterBlocks', () => {
      const result = mod.makeCodeTaskFields({ toolbox: 'motion', starterBlocks: null })
      expect(result).toHaveProperty('toolbox')
      expect(result).toHaveProperty('starterBlocks')
    })

    it('makeNewStage is null (stages managed by ScratchTaskSetup)', () => {
      expect(mod.makeNewStage).toBeNull()
    })
  })

  describe('filesystem-specific', () => {
    const mod = getLessonModule('filesystem')
    it('makeCodeTaskFields sets starterFs', () => {
      const result = mod.makeCodeTaskFields({})
      expect(result).toHaveProperty('starterFs')
    })

    it('makeNewStage creates a stage with fs', () => {
      const result = mod.makeNewStage({}, [])
      expect(result).toHaveProperty('fs')
    })
  })
})
