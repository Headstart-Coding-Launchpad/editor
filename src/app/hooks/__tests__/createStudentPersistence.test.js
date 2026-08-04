import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStudentPersistence } from '../createStudentPersistence'

vi.mock('../../studentStorage', () => ({
  saveCode: vi.fn(),
  saveFile: vi.fn(),
  saveFsState: vi.fn(),
  saveDesktopState: vi.fn(),
  loadSavedCode: vi.fn(),
  loadSavedFile: vi.fn(),
  loadSavedFs: vi.fn(),
  loadSavedDesktop: vi.fn(),
  savePersonalSandboxCode: vi.fn(),
  savePersonalSandboxFile: vi.fn(),
  savePersonalSandboxFs: vi.fn(),
  savePersonalSandboxDesktop: vi.fn(),
  ephemeralStorage: {
    saveCode: vi.fn(),
    saveFile: vi.fn(),
    saveFsState: vi.fn(),
    saveDesktopState: vi.fn(),
    loadSavedCode: vi.fn(),
    loadSavedFile: vi.fn(),
    loadSavedFs: vi.fn(),
    loadSavedDesktop: vi.fn(),
  },
}))

import {
  saveCode, saveFile, saveFsState, saveDesktopState,
  loadSavedCode, loadSavedFile, loadSavedFs, loadSavedDesktop,
  savePersonalSandboxCode, savePersonalSandboxFile, savePersonalSandboxFs, savePersonalSandboxDesktop,
  ephemeralStorage,
} from '../../studentStorage'

function makeRef(value) {
  return { current: value }
}

function setup({ teacherPresentation = false, previewMode = false, inPersonalSandbox = false } = {}) {
  const inPersonalSandboxRef = makeRef(inPersonalSandbox)
  const persistence = createStudentPersistence({ lessonId: 'lesson-1', teacherPresentation, previewMode, inPersonalSandboxRef })
  return { persistence, inPersonalSandboxRef }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createStudentPersistence', () => {
  describe('savePythonCode', () => {
    it('calls saveCode in normal mode', () => {
      const { persistence } = setup()
      persistence.savePythonCode('anon-1', 1, { code: 'x=1', output: 'hi', runStatus: 'success' })
      expect(saveCode).toHaveBeenCalledWith('lesson-1', 1, 'anon-1', { code: 'x=1', output: 'hi', runStatus: 'success' })
      expect(savePersonalSandboxCode).not.toHaveBeenCalled()
    })

    it('calls savePersonalSandboxCode in sandbox mode', () => {
      const { persistence } = setup({ inPersonalSandbox: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1', output: 'hi', runStatus: 'success' })
      expect(savePersonalSandboxCode).toHaveBeenCalledWith('lesson-1', 'anon-1', { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when teacherPresentation', () => {
      const { persistence } = setup({ teacherPresentation: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(ephemeralStorage.saveCode).toHaveBeenCalledWith('lesson-1', 1, 'anon-1', { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
      expect(savePersonalSandboxCode).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(ephemeralStorage.saveCode).toHaveBeenCalledWith('lesson-1', 1, 'anon-1', { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
    })

    it('skips sandbox saves in ephemeral modes', () => {
      const { persistence } = setup({ previewMode: true, inPersonalSandbox: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
      expect(savePersonalSandboxCode).not.toHaveBeenCalled()
      expect(ephemeralStorage.saveCode).not.toHaveBeenCalled()
    })
  })

  describe('saveHtmlFile', () => {
    it('calls saveFile in normal mode', () => {
      const { persistence } = setup()
      persistence.saveHtmlFile('anon-1', 2, 'index.html', '<p>hi</p>')
      expect(saveFile).toHaveBeenCalledWith('lesson-1', 2, 'index.html', 'anon-1', '<p>hi</p>')
    })

    it('calls savePersonalSandboxFile in sandbox mode', () => {
      const { persistence } = setup({ inPersonalSandbox: true })
      persistence.saveHtmlFile('anon-1', 2, 'style.css', 'body{}')
      expect(savePersonalSandboxFile).toHaveBeenCalledWith('lesson-1', 'style.css', 'anon-1', 'body{}')
      expect(saveFile).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.saveHtmlFile('anon-1', 2, 'index.html', '<p/>')
      expect(ephemeralStorage.saveFile).toHaveBeenCalledWith('lesson-1', 2, 'index.html', 'anon-1', '<p/>')
      expect(saveFile).not.toHaveBeenCalled()
    })
  })

  describe('saveHtmlFiles', () => {
    it('saves each file individually', () => {
      const { persistence } = setup()
      persistence.saveHtmlFiles('anon-1', 3, [
        { name: 'index.html', content: '<h1/>' },
        { name: 'style.css', content: 'body{}' },
      ])
      expect(saveFile).toHaveBeenCalledTimes(2)
      expect(saveFile).toHaveBeenCalledWith('lesson-1', 3, 'index.html', 'anon-1', '<h1/>')
      expect(saveFile).toHaveBeenCalledWith('lesson-1', 3, 'style.css', 'anon-1', 'body{}')
    })

    it('routes each file to ephemeral storage when teacherPresentation', () => {
      const { persistence } = setup({ teacherPresentation: true })
      persistence.saveHtmlFiles('anon-1', 3, [{ name: 'index.html', content: '<h1/>' }])
      expect(ephemeralStorage.saveFile).toHaveBeenCalledWith('lesson-1', 3, 'index.html', 'anon-1', '<h1/>')
      expect(saveFile).not.toHaveBeenCalled()
    })
  })

  describe('saveScratch', () => {
    it('calls saveCode with state in normal mode', () => {
      const { persistence } = setup()
      const states = { blocks: [] }
      persistence.saveScratch('anon-1', 4, states)
      expect(saveCode).toHaveBeenCalledWith('lesson-1', 4, 'anon-1', { state: states })
    })

    it('calls savePersonalSandboxCode in sandbox mode', () => {
      const { persistence } = setup({ inPersonalSandbox: true })
      const states = { blocks: [] }
      persistence.saveScratch('anon-1', 4, states)
      expect(savePersonalSandboxCode).toHaveBeenCalledWith('lesson-1', 'anon-1', { state: states })
      expect(saveCode).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when teacherPresentation', () => {
      const { persistence } = setup({ teacherPresentation: true })
      const states = { blocks: [] }
      persistence.saveScratch('anon-1', 4, states)
      expect(ephemeralStorage.saveCode).toHaveBeenCalledWith('lesson-1', 4, 'anon-1', { state: states })
      expect(saveCode).not.toHaveBeenCalled()
    })
  })

  describe('saveFs', () => {
    it('calls saveFsState in normal mode', () => {
      const { persistence } = setup()
      const fs = { '/': { type: 'dir', children: {} } }
      persistence.saveFs('anon-1', 5, fs)
      expect(saveFsState).toHaveBeenCalledWith('lesson-1', 5, 'anon-1', fs)
    })

    it('calls savePersonalSandboxFs in sandbox mode', () => {
      const { persistence } = setup({ inPersonalSandbox: true })
      const fs = { '/': { type: 'dir', children: {} } }
      persistence.saveFs('anon-1', 5, fs)
      expect(savePersonalSandboxFs).toHaveBeenCalledWith('lesson-1', 'anon-1', fs)
      expect(saveFsState).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.saveFs('anon-1', 5, {})
      expect(ephemeralStorage.saveFsState).toHaveBeenCalledWith('lesson-1', 5, 'anon-1', {})
      expect(saveFsState).not.toHaveBeenCalled()
    })
  })

  describe('saveDesktop', () => {
    it('calls saveDesktopState in normal mode', () => {
      const { persistence } = setup()
      const desktop = { fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] }
      persistence.saveDesktop('anon-1', 6, desktop)
      expect(saveDesktopState).toHaveBeenCalledWith('lesson-1', 6, 'anon-1', desktop)
    })

    it('calls savePersonalSandboxDesktop in sandbox mode', () => {
      const { persistence } = setup({ inPersonalSandbox: true })
      const desktop = { fs: {}, recycleBin: [], windows: [] }
      persistence.saveDesktop('anon-1', 6, desktop)
      expect(savePersonalSandboxDesktop).toHaveBeenCalledWith('lesson-1', 'anon-1', desktop)
      expect(saveDesktopState).not.toHaveBeenCalled()
    })

    it('routes to ephemeral storage when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.saveDesktop('anon-1', 6, {})
      expect(ephemeralStorage.saveDesktopState).toHaveBeenCalledWith('lesson-1', 6, 'anon-1', {})
      expect(saveDesktopState).not.toHaveBeenCalled()
    })
  })

  describe('readers', () => {
    it('readSavedCode reads localStorage in normal mode', () => {
      const { persistence } = setup()
      loadSavedCode.mockReturnValue({ code: 'x=1' })
      expect(persistence.readSavedCode('anon-1', 1)).toEqual({ code: 'x=1' })
      expect(loadSavedCode).toHaveBeenCalledWith('lesson-1', 1, 'anon-1')
      expect(ephemeralStorage.loadSavedCode).not.toHaveBeenCalled()
    })

    it('readSavedCode reads ephemeral storage in presentation/preview', () => {
      const { persistence } = setup({ teacherPresentation: true })
      ephemeralStorage.loadSavedCode.mockReturnValue({ state: { s1: {} } })
      expect(persistence.readSavedCode('anon-1', 1)).toEqual({ state: { s1: {} } })
      expect(ephemeralStorage.loadSavedCode).toHaveBeenCalledWith('lesson-1', 1, 'anon-1')
      expect(loadSavedCode).not.toHaveBeenCalled()
    })

    it('readSavedFile and readSavedFs route by mode', () => {
      const normal = setup().persistence
      normal.readSavedFile('anon-1', 2, 'index.html')
      normal.readSavedFs('anon-1', 3)
      expect(loadSavedFile).toHaveBeenCalledWith('lesson-1', 2, 'index.html', 'anon-1')
      expect(loadSavedFs).toHaveBeenCalledWith('lesson-1', 3, 'anon-1')

      const ephemeral = setup({ previewMode: true }).persistence
      ephemeral.readSavedFile('anon-1', 2, 'index.html')
      ephemeral.readSavedFs('anon-1', 3)
      expect(ephemeralStorage.loadSavedFile).toHaveBeenCalledWith('lesson-1', 2, 'index.html', 'anon-1')
      expect(ephemeralStorage.loadSavedFs).toHaveBeenCalledWith('lesson-1', 3, 'anon-1')
    })

    it('readSavedDesktop routes by mode', () => {
      const normal = setup().persistence
      normal.readSavedDesktop('anon-1', 6)
      expect(loadSavedDesktop).toHaveBeenCalledWith('lesson-1', 6, 'anon-1')

      const ephemeral = setup({ previewMode: true }).persistence
      ephemeral.readSavedDesktop('anon-1', 6)
      expect(ephemeralStorage.loadSavedDesktop).toHaveBeenCalledWith('lesson-1', 6, 'anon-1')
    })
  })

  describe('sandbox ref is read at call time', () => {
    it('switches to sandbox save when inPersonalSandboxRef.current is mutated after factory call', () => {
      const { persistence, inPersonalSandboxRef } = setup({ inPersonalSandbox: false })
      inPersonalSandboxRef.current = true
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(savePersonalSandboxCode).toHaveBeenCalled()
      expect(saveCode).not.toHaveBeenCalled()
    })
  })
})
