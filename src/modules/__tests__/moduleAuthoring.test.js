import { describe, expect, it } from 'vitest'
import { defineModule } from '../defineModule.js'
import {
  getModuleAuthoring,
  getModuleDefinition,
  MODULE_TYPES,
  SPRITE_LIBRARY_MODULE_TYPE,
} from '../definitions.js'
import pythonDefinition from '../python/definition.js'
import { builtInOnly } from './helpers/builtInModules.js'
import { copyStarterToComplete } from '../../builder/lessonUtils.js'
import {
  esc,
  legacyBuilderRunFlags,
  legacyBuilderSpriteLibraryType,
  legacyCodeFormat,
  legacyCopyCodePlaceholder,
  legacyCopyStarterToComplete,
  legacyDefaultTypeFields,
  legacyIncludesTypeAssetsInPreview,
  legacyIncompleteDraftLabel,
  legacyIncompleteDraftWorkspace,
  legacyPrintModuleSections,
  legacyResetToStarterReselectsFiles,
  legacySandboxStarterEditor,
  legacySharedTypeAssets,
  legacySpritePickerLibraryType,
  legacyUsesUnifiedCodeStages,
} from './helpers/legacyBuilderAuthoring.js'

// Plan step 4.8: the Builder's per-type branches moved onto each module's `authoring` group.
// Every hook is compared against a verbatim copy of the branch it replaced
// (helpers/legacyBuilderAuthoring.js).

const SPRITE_PRESET = { id: 'preset-cat', name: 'Library Cat', type: 'cat', x: 10, y: -5, size: 80 }

const CIRCUIT = {
  version: 1,
  board: { type: 'half', rows: 10, cols: 30 },
  components: [
    { id: 'led1', type: 'led', label: 'Red', pins: ['a', 'b'], position: { row: 2, col: 3 } },
    {
      id: 'mc1',
      type: 'microcontroller',
      props: { code: 'print("hi")', pins: ['GP0'] },
    },
    { id: 'bat', type: 'battery', props: { voltage: 9 } },
    { id: 'odd', type: 'mystery_part' },
  ],
  wires: [{ id: 'w1', from: 'bat.+', to: 'led1.a', color: 'red' }],
  microcontroller: { enabled: true, boardType: 'pico', starterCode: '# legacy' },
}

const FS = {
  '/': { type: 'dir' },
  '/docs': { type: 'dir' },
  '/docs/readme.txt': { type: 'file', content: 'Hello <world> & "friends"' },
  '/docs/deep/image.png': { type: 'file', src: 'assets/image.png' },
  '/meta.json': { type: 'file', size: 3, tags: ['a', 'b'] },
  '/empty.txt': { type: 'file', content: '' },
  '/long.txt': { type: 'file', content: 'x'.repeat(200) },
}

// Previous tasks a new task may follow: every module's fields at once, plus sparse variants.
const PREV_TASKS = [
  null,
  { id: 7 },
  {
    id: 3,
    starterCode: 'print(1)',
    completeCode: 'print(2)',
    starterFiles: [{ name: 'a.html', type: 'html', content: '<p>a</p>' }],
    completeFiles: [{ name: 'b.html', type: 'html', content: '<p>b</p>' }],
    entryFile: 'a.html',
    completeEntryFile: 'b.html',
    starterBlocks: { blocks: 1 },
    completeBlocks: { blocks: 2 },
    sprites: [{ id: 'sprite1', name: 'Cat' }],
    backdrops: [{ id: 'backdrop1', name: 'Sky' }],
    variables: [{ name: 'score' }],
    starterCircuit: CIRCUIT,
    completeCircuit: { ...CIRCUIT, components: [] },
    microcontroller: { enabled: true, boardType: 'pico', starterCode: 'x = 1' },
    starterFs: FS,
    completeFs: { '/': { type: 'dir' } },
    starterDesktop: { fs: FS, windows: [] },
    completeDesktop: { fs: {}, windows: [] },
    availableApps: ['fileManager', 'browser'],
  },
  {
    id: 4,
    starterCode: 'only starter',
    starterFiles: [{ name: 'index.html', type: 'html', content: '' }],
    entryFile: 'index.html',
    starterBlocks: null,
    starterCircuit: CIRCUIT,
    starterFs: FS,
    starterDesktop: { fs: FS },
    availableApps: ['browser'],
  },
]

// Tasks exercising every printed field of every module.
const PRINT_TASKS = [
  {},
  { taskType: 'information' },
  {
    carryCodeFrom: 2,
    starterCode: 'print("<a>")',
    completeCode: 'x = "&"',
    copyCode: '  copy me  ',
    codeStages: [{ label: 'Starter', code: 's' }, { code: 'c' }],
    entryFile: 'index.html',
    starterFiles: [{ name: 'index.html', content: '<h1>Hi</h1>' }, { name: 'x.css' }],
    completeFiles: [{ name: 'index.html', content: '<h1>Done</h1>' }],
  },
  {
    carryBlocksFrom: 1,
    sprites: [
      { name: 'Cat', type: 'cat', x: 0, y: 5, size: 100, direction: 90 },
      { name: '<Bat>', studentEditable: false },
    ],
    backdrops: [{ name: 'Sky', colour: '#fff' }, { name: 'Pic', image: 'a.png' }, { name: 'X' }],
    variables: [{ name: 'score', showOnStage: true }, { name: 'lives' }],
    toolbox: '<xml></xml>',
    prebuiltStacks: [{ opcode: 'event_whenflagclicked' }],
    starterBlocks: { a: 1 },
    completeBlocks: { b: 2 },
    codeStages: [
      { label: 'Starter', blocks: { c: 3 }, prebuiltStacks: [{ x: 1 }] },
      { label: 'Support', files: [{ name: 'f.html', content: 'f' }], fs: FS },
    ],
  },
  {
    carryFsFrom: 5,
    starterFs: FS,
    completeFs: JSON.stringify({ '/': { type: 'dir' }, '/a.txt': { type: 'file', content: 'a' } }),
    codeStages: [{ label: 'Stage 1', fs: FS }, { label: 'Empty' }],
  },
  { starterFs: 'not json', completeFs: { '/': { type: 'dir' } } },
  {
    carryCircuitFrom: 9,
    availableComponents: ['led', 'battery', 'terminal', 'unknown_part'],
    microcontroller: { enabled: true, boardType: '', starterCode: 'import machine' },
    starterCircuit: CIRCUIT,
    completeCircuit: JSON.stringify(CIRCUIT),
    codeStages: [{ label: 'Circuit stage', circuit: CIRCUIT }, { label: 'None' }],
  },
  { microcontroller: { boardType: 'pico' }, starterCircuit: 'garbage', completeCircuit: {} },
  { copyCode: '   ', codeStages: [] },
]

const UNKNOWN = ['composed', 'nope', undefined]

describe('module authoring hooks reproduce the old Builder branches', () => {
  // The oracles describe the built-in modules (./helpers/builtInModules.js); a module added later
  // has no old Builder branch to match.
  describe.each(builtInOnly(MODULE_TYPES))('%s', (type) => {
    const authoring = getModuleAuthoring(type)
    const lesson = { type }

    it('defaultTypeFields matches useBuilderState.defaultTypeFields', () => {
      for (const prevTask of PREV_TASKS) {
        for (const defaultSprites of [[], [SPRITE_PRESET]]) {
          expect(authoring.defaultTypeFields(prevTask, { defaultSprites })).toEqual(
            legacyDefaultTypeFields(prevTask, type, defaultSprites)
          )
        }
      }
    })

    it('defaultTypeFields copies rather than shares the previous task’s values', () => {
      const prevTask = structuredClone(PREV_TASKS[2])
      const fresh = authoring.defaultTypeFields(prevTask, { defaultSprites: [] })
      const legacy = legacyDefaultTypeFields(prevTask, type, [])
      for (const [key, value] of Object.entries(legacy)) {
        if (value && typeof value === 'object') {
          expect(fresh[key] === prevTask[key]).toBe(value === prevTask[key])
        }
      }
    })

    it('copyStarterToComplete matches lessonUtils.copyStarterToComplete', () => {
      for (const task of [...PREV_TASKS.filter(Boolean), {}]) {
        expect(authoring.copyStarterToComplete(task)).toEqual(
          legacyCopyStarterToComplete(task, type)
        )
        expect(copyStarterToComplete(task, type)).toEqual(legacyCopyStarterToComplete(task, type))
      }
    })

    it('printTask is byte-identical to the old printLesson section', () => {
      for (const task of PRINT_TASKS) {
        // The old sections only ran for code tasks (no taskType).
        const expected = legacyPrintModuleSections(task, type)
        const actual = task.taskType ? '' : authoring.printTask(task, { esc })
        expect(actual).toBe(expected)
      }
      // Every module except desktop (which never printed a section) prints something here.
      const printed = PRINT_TASKS.filter((task) => legacyPrintModuleSections(task, type) !== '')
      expect(printed.length > 0).toBe(type !== 'desktop')
    })

    it('missingStarter and its label match the TaskEditor draft notice', () => {
      for (const task of [{}, ...PREV_TASKS.filter(Boolean), { starterFiles: [] }]) {
        expect(authoring.missingStarter(task)).toBe(legacyIncompleteDraftWorkspace(lesson, task))
        if (authoring.missingStarter(task)) {
          expect(authoring.missingStarterLabel).toBe(legacyIncompleteDraftLabel(lesson))
        }
      }
      expect(authoring.missingStarterLabel === null).toBe(
        !legacyIncompleteDraftWorkspace(lesson, {})
      )
    })

    it('data fields match the old inline type checks', () => {
      const definition = getModuleDefinition(type)
      expect(definition.capabilities.unifiedStages).toBe(legacyUsesUnifiedCodeStages(lesson))
      expect(authoring.previewTypeAssets).toBe(legacyIncludesTypeAssetsInPreview(lesson))
      expect(authoring.sharedTypeAssets).toBe(legacySharedTypeAssets(lesson))
      expect(authoring.fileTabs).toBe(legacyResetToStarterReselectsFiles(lesson))
      expect(authoring.sandboxStarterEditor).toBe(legacySandboxStarterEditor(lesson))
      const { isPython, isScratch } = legacyBuilderRunFlags({ type })
      expect(authoring.builderRun === 'pyodide').toBe(isPython)
      expect(authoring.builderRun === 'none').toBe(isScratch)
      const { label, iconType } = legacyCodeFormat(lesson)
      expect(authoring.codeFormat).toEqual({ label, icon: iconType })
      if (definition.supportsCopyCode) {
        expect(authoring.copyCodePlaceholder).toBe(legacyCopyCodePlaceholder(lesson))
      }
      expect(authoring.spriteLibrary ? type : null).toBe(legacySpritePickerLibraryType(type))
    })
  })

  it('the sprite library module is the one BuilderView loaded default sprites for', () => {
    for (const type of [...MODULE_TYPES, ...UNKNOWN]) {
      const loads =
        type === 'composed' || getModuleAuthoring(type)?.spriteLibrary
          ? SPRITE_LIBRARY_MODULE_TYPE
          : null
      expect(loads).toBe(legacyBuilderSpriteLibraryType({ type }))
    }
  })

  it('an unregistered type keeps the old fallbacks', () => {
    for (const type of UNKNOWN) {
      const lesson = { type }
      expect(getModuleAuthoring(type)).toBeNull()
      // copyStarterToComplete: nothing; print: nothing.
      expect(copyStarterToComplete({ starterCode: 'x' }, type)).toEqual(
        legacyCopyStarterToComplete({ starterCode: 'x' }, type)
      )
      expect(legacyPrintModuleSections(PRINT_TASKS[2], type)).toBe('')
      // Builder data fallbacks used by the call sites.
      expect(legacyUsesUnifiedCodeStages(lesson)).toBe(false)
      expect(legacyIncompleteDraftWorkspace(lesson, {})).toBe(false)
      expect(legacySandboxStarterEditor(lesson)).toBe('files')
      expect(legacyCodeFormat(lesson)).toMatchObject({ label: 'Code', iconType: 'code' })
      // useBuilderState's fallback: HTML task fields.
      expect(getModuleAuthoring('html').defaultTypeFields(null, {})).toEqual(
        legacyDefaultTypeFields(null, type)
      )
    }
  })
})

describe('defineModule authoring validation', () => {
  const withAuthoring = (authoring) => ({ ...pythonDefinition, authoring })

  it('fills the optional authoring fields', () => {
    const { authoring } = getModuleDefinition('filesystem')
    expect(authoring.codeFormat).toEqual({ label: 'Code', icon: 'code' })
    expect(authoring.copyCodePlaceholder).toBeNull()
    expect(authoring.fileTabs).toBe(false)
    expect(Object.isFrozen(authoring)).toBe(true)
  })

  it('requires the authoring group and its hooks', () => {
    expect(() => defineModule(withAuthoring(undefined))).toThrow(/"authoring"/)
    const { printTask: _printTask, ...rest } = pythonDefinition.authoring
    expect(() => defineModule(withAuthoring(rest))).toThrow(/authoring\.printTask/)
  })

  it('rejects unknown editor and run kinds', () => {
    const authoring = pythonDefinition.authoring
    expect(() =>
      defineModule(withAuthoring({ ...authoring, sandboxStarterEditor: 'nope' }))
    ).toThrow(/sandboxStarterEditor/)
    expect(() => defineModule(withAuthoring({ ...authoring, builderRun: 'nope' }))).toThrow(
      /builderRun/
    )
  })

  it('needs a copy-code placeholder on a supportsCopyCode module', () => {
    expect(() =>
      defineModule(withAuthoring({ ...pythonDefinition.authoring, copyCodePlaceholder: null }))
    ).toThrow(/copyCodePlaceholder/)
  })

  it('rejects a non-boolean flag and a malformed codeFormat', () => {
    const authoring = pythonDefinition.authoring
    expect(() => defineModule(withAuthoring({ ...authoring, fileTabs: 'yes' }))).toThrow(
      /authoring\.fileTabs/
    )
    expect(() => defineModule(withAuthoring({ ...authoring, codeFormat: { label: 'X' } }))).toThrow(
      /codeFormat/
    )
  })
})
