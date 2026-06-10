import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudentPersistence } from '../useStudentPersistence'

vi.mock('../../studentStorage', () => ({
  saveCode: vi.fn(),
  saveFile: vi.fn(),
  saveFsState: vi.fn(),
  savePersonalSandboxCode: vi.fn(),
  savePersonalSandboxFile: vi.fn(),
  savePersonalSandboxFs: vi.fn(),
}))

import {
  saveCode, saveFile, saveFsState,
  savePersonalSandboxCode, savePersonalSandboxFile, savePersonalSandboxFs,
} from '../../studentStorage'

function makeRef(value) {
  return { current: value }
}

function setup({ teacherPresentation = false, previewMode = false, inPersonalSandbox = false } = {}) {
  const inPersonalSandboxRef = makeRef(inPersonalSandbox)
  const { result } = renderHook(() =>
    useStudentPersistence({ lessonId: 'lesson-1', teacherPresentation, previewMode, inPersonalSandboxRef })
  )
  return { persistence: result.current, inPersonalSandboxRef }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useStudentPersistence', () => {
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

    it('skips when teacherPresentation', () => {
      const { persistence } = setup({ teacherPresentation: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
      expect(savePersonalSandboxCode).not.toHaveBeenCalled()
    })

    it('skips when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(saveCode).not.toHaveBeenCalled()
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

    it('skips when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.saveHtmlFile('anon-1', 2, 'index.html', '<p/>')
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

    it('skips all files when teacherPresentation', () => {
      const { persistence } = setup({ teacherPresentation: true })
      persistence.saveHtmlFiles('anon-1', 3, [{ name: 'index.html', content: '<h1/>' }])
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

    it('skips when previewMode', () => {
      const { persistence } = setup({ previewMode: true })
      persistence.saveFs('anon-1', 5, {})
      expect(saveFsState).not.toHaveBeenCalled()
    })
  })

  describe('sandbox ref is read at call time', () => {
    it('switches to sandbox save when inPersonalSandboxRef.current is mutated after hook creation', () => {
      const { persistence, inPersonalSandboxRef } = setup({ inPersonalSandbox: false })
      inPersonalSandboxRef.current = true
      persistence.savePythonCode('anon-1', 1, { code: 'x=1' })
      expect(savePersonalSandboxCode).toHaveBeenCalled()
      expect(saveCode).not.toHaveBeenCalled()
    })
  })
})
