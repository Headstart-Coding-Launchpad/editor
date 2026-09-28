import { describe, it, expect, beforeEach } from 'vitest'
import { createStudentPersistence } from '../createStudentPersistence'
import { clearEphemeralStorage, ephemeralStorage } from '../../studentStorage'
import { getModuleDefinition } from '../../../modules/definitions.js'

// The generic saveWork / readWork / saveSandboxWork / readSandboxWork API (module storage
// adapters) must write byte-for-byte what the per-type named savers write today: same
// localStorage keys, same JSON, same routing (task / personal sandbox / in-memory store).

const LESSON = 'lesson-1'
const ACTOR = 'anon-1'
const TASK = 't1'

function snapshotLocalStorage() {
  const entries = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    entries[key] = localStorage.getItem(key)
  }
  return entries
}

function makePersistence({
  inSandbox = false,
  teacherPresentation = false,
  previewMode = false,
  sandboxModuleId = null,
} = {}) {
  return createStudentPersistence({
    lessonId: LESSON,
    teacherPresentation,
    previewMode,
    inPersonalSandboxRef: { current: inSandbox },
    sandboxModuleId,
  })
}

const design = { sprites: [{ id: 's1' }] }
const fs = { type: 'dir', name: '/', children: [] }
const desktop = { apps: ['fileManager'], windows: [], fs }
const blocks = { sprite1: { blocks: [] } }
const files = [
  { name: 'index.html', content: '<p>hi</p>', type: 'html' },
  { name: 'style.css', content: 'p{}', type: 'css' },
]

// [type, legacy save call, generic save call]
const CASES = [
  [
    'python',
    (p) => p.savePythonCode(ACTOR, TASK, { code: 'x', output: 'o', runStatus: 'success' }),
    (p) => p.saveWork('python', ACTOR, TASK, 'x', { output: 'o', runStatus: 'success' }),
  ],
  [
    'turtle',
    (p) => p.savePythonCode(ACTOR, TASK, { code: 't', output: '', runStatus: null }),
    (p) => p.saveWork('turtle', ACTOR, TASK, 't', { output: '', runStatus: null }),
  ],
  [
    'arcade',
    (p) =>
      p.savePythonCode(ACTOR, TASK, {
        code: 'g',
        output: '',
        runStatus: null,
        arcadeDesign: design,
      }),
    (p) =>
      p.saveWork('arcade', ACTOR, TASK, 'g', { output: '', runStatus: null, arcadeDesign: design }),
  ],
  [
    'electronics',
    (p) => p.savePythonCode(ACTOR, TASK, { code: '{"components":[]}' }),
    (p) => p.saveWork('electronics', ACTOR, TASK, '{"components":[]}'),
  ],
  [
    'scratch',
    (p) => p.saveScratch(ACTOR, TASK, blocks),
    (p) => p.saveWork('scratch', ACTOR, TASK, blocks),
  ],
  [
    'filesystem',
    (p) => p.saveFs(ACTOR, TASK, fs),
    (p) => p.saveWork('filesystem', ACTOR, TASK, fs),
  ],
  [
    'desktop',
    (p) => p.saveDesktop(ACTOR, TASK, desktop),
    (p) => p.saveWork('desktop', ACTOR, TASK, desktop),
  ],
  [
    'html',
    (p) => p.saveHtmlFiles(ACTOR, TASK, files),
    (p) => p.saveWork('html', ACTOR, TASK, files),
  ],
]

beforeEach(() => {
  localStorage.clear()
  clearEphemeralStorage()
})

describe('saveWork matches the named savers byte for byte', () => {
  for (const [type, legacySave, genericSave] of CASES) {
    for (const [mode, options] of [
      ['task', {}],
      ['composed-module task', { sandboxModuleId: 'mod-a' }],
    ]) {
      it(`${type} (${mode})`, () => {
        legacySave(makePersistence(options))
        const legacy = snapshotLocalStorage()
        localStorage.clear()
        genericSave(makePersistence(options))
        expect(snapshotLocalStorage()).toEqual(legacy)
        expect(Object.keys(legacy).length).toBeGreaterThan(0)
      })
    }

    it(`${type} (presentation / preview → in-memory store, localStorage untouched)`, () => {
      const persistence = makePersistence({ teacherPresentation: true })
      genericSave(persistence)
      expect(snapshotLocalStorage()).toEqual({})
      const read = persistence.readWork(type, ACTOR, TASK, { filename: 'index.html' })
      if (type === 'html') {
        expect(read.work).toBe('<p>hi</p>')
        expect(ephemeralStorage.loadSavedFile(LESSON, TASK, 'index.html', ACTOR)).toBe('<p>hi</p>')
      } else {
        expect(read).toEqual(
          getModuleDefinition(type).storage.fromTaskRecord(
            ephemeralStorage.loadSavedCode(LESSON, TASK, ACTOR)
          )
        )
        expect(read.work).not.toBeUndefined()
      }
    })
  }

  it('skips every save in the personal sandbox while presenting or previewing', () => {
    for (const [type, , genericSave] of CASES) {
      genericSave(makePersistence({ inSandbox: true, previewMode: true }))
      makePersistence({ previewMode: true }).saveSandboxWork(type, ACTOR, 'x')
      expect(snapshotLocalStorage(), type).toEqual({})
    }
  })
})

describe('personal sandbox', () => {
  it('routes saveWork to the sandbox record like the named savers (code, state, fs, desktop)', () => {
    const pairs = [
      [
        (p) => p.savePythonCode(ACTOR, TASK, { code: 'x' }),
        (p) => p.saveWork('python', ACTOR, TASK, 'x'),
      ],
      [
        (p) => p.saveScratch(ACTOR, TASK, blocks),
        (p) => p.saveWork('scratch', ACTOR, TASK, blocks),
      ],
      [(p) => p.saveFs(ACTOR, TASK, fs), (p) => p.saveWork('filesystem', ACTOR, TASK, fs)],
      [
        (p) => p.saveDesktop(ACTOR, TASK, desktop),
        (p) => p.saveWork('desktop', ACTOR, TASK, desktop),
      ],
      [(p) => p.saveHtmlFiles(ACTOR, TASK, files), (p) => p.saveWork('html', ACTOR, TASK, files)],
    ]
    for (const sandboxModuleId of [null, 'mod-a']) {
      for (const [legacySave, genericSave] of pairs) {
        localStorage.clear()
        legacySave(makePersistence({ inSandbox: true, sandboxModuleId }))
        const legacy = snapshotLocalStorage()
        localStorage.clear()
        genericSave(makePersistence({ inSandbox: true, sandboxModuleId }))
        expect(snapshotLocalStorage()).toEqual(legacy)
      }
    }
  })

  it('writes the documented sandbox keys and shapes, arcade design included', () => {
    const persistence = makePersistence()
    persistence.saveSandboxWork('arcade', ACTOR, 'g', { arcadeDesign: design })
    expect(localStorage.getItem(`headstart_${LESSON}_personalsandbox_${ACTOR}`)).toBe(
      JSON.stringify({ code: 'g', arcadeDesign: design })
    )
    makePersistence({ sandboxModuleId: 'mod-a' }).saveSandboxWork('html', ACTOR, files)
    expect(
      localStorage.getItem(`headstart_${LESSON}_module_mod-a_sandbox_index.html_${ACTOR}`)
    ).toBe(JSON.stringify({ content: '<p>hi</p>' }))
  })

  it('reads sandbox work back through the adapters', () => {
    const persistence = makePersistence({ sandboxModuleId: 'mod-a' })
    persistence.saveSandboxWork('filesystem', ACTOR, fs)
    persistence.saveSandboxWork('html', ACTOR, files)
    expect(persistence.readSandboxWork('filesystem', ACTOR)).toEqual({ work: fs, meta: {} })
    expect(persistence.readSandboxWork('html', ACTOR, { filename: 'style.css' })).toEqual({
      work: 'p{}',
      meta: {},
    })
    expect(persistence.readSandboxWork('html', ACTOR)).toBeNull()
    expect(makePersistence().readSandboxWork('filesystem', ACTOR)).toBeNull()
  })
})

describe('readWork', () => {
  it('reads what the named savers wrote, with the meta fields present in the record', () => {
    const persistence = makePersistence()
    persistence.savePythonCode(ACTOR, TASK, {
      code: 'g',
      output: '',
      runStatus: null,
      arcadeDesign: design,
    })
    expect(persistence.readWork('arcade', ACTOR, TASK)).toEqual({
      work: 'g',
      meta: { output: '', runStatus: null, arcadeDesign: design },
    })
    persistence.saveFs(ACTOR, 't2', fs)
    expect(persistence.readWork('filesystem', ACTOR, 't2')).toEqual({ work: fs, meta: {} })
    expect(persistence.readWork('filesystem', ACTOR, 't2')?.work).toEqual(
      persistence.readSavedFs(ACTOR, 't2')
    )
    persistence.saveHtmlFile(ACTOR, 't3', 'index.html', '<b>')
    expect(persistence.readWork('html', ACTOR, 't3', { filename: 'index.html' })?.work).toBe(
      persistence.readSavedFile(ACTOR, 't3', 'index.html')
    )
    expect(persistence.readWork('desktop', ACTOR, 'missing')).toBeNull()
  })

  it('rejects an unknown module type', () => {
    expect(() => makePersistence().readWork('quiz', ACTOR, TASK)).toThrow(/quiz/)
  })
})
