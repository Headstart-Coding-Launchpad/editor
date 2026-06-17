import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSavedCode,
  loadSavedFile,
  loadPersonalSandboxCode,
  loadPersonalSandboxFile,
  loadPersonalSandboxFs,
  loadSavedFs,
  saveCode,
  saveFile,
  savePersonalSandboxCode,
  savePersonalSandboxFs,
  saveFsState,
  studentFileStorageKey,
  studentTaskStorageKey,
} from '../studentStorage'

describe('studentStorage', () => {
  beforeEach(() => localStorage.clear())

  it('retains the established task and per-file key formats', () => {
    expect(studentTaskStorageKey('python-1', 2, 'anon-id')).toBe('headstart_python-1_2_anon-id')
    expect(studentFileStorageKey('html-1', 3, 'index.html', 'anon-id')).toBe('headstart_html-1_3_index.html_anon-id')
  })

  it('persists and restores code snapshots and HTML file contents', () => {
    saveCode('python-1', 2, 'anon-id', { code: 'print(1)', output: '1' })
    saveFile('html-1', 3, 'index.html', 'anon-id', '<h1>Hi</h1>')
    expect(loadSavedCode('python-1', 2, 'anon-id')).toEqual({ code: 'print(1)', output: '1' })
    expect(loadSavedFile('html-1', 3, 'index.html', 'anon-id')).toBe('<h1>Hi</h1>')
  })
})

describe('studentStorage — corrupt data resilience', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('loadSavedCode returns null and removes the key on corrupt JSON', () => {
    const key = studentTaskStorageKey('l1', 1, 'a1')
    localStorage.setItem(key, '{broken json}')
    expect(loadSavedCode('l1', 1, 'a1')).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('loadSavedFile returns null on corrupt JSON', () => {
    const key = studentFileStorageKey('l1', 1, 'main.py', 'a1')
    localStorage.setItem(key, 'not-json')
    expect(loadSavedFile('l1', 1, 'main.py', 'a1')).toBeNull()
  })

  it('loadPersonalSandboxCode returns null on corrupt JSON', () => {
    localStorage.setItem('headstart_l1_personalsandbox_a1', '[unclosed')
    expect(loadPersonalSandboxCode('l1', 'a1')).toBeNull()
  })

  it('loadPersonalSandboxFile returns null on corrupt JSON', () => {
    localStorage.setItem('headstart_l1_personalsandbox_index.html_a1', 'bad')
    expect(loadPersonalSandboxFile('l1', 'index.html', 'a1')).toBeNull()
  })

  it('loadPersonalSandboxFs returns null on corrupt JSON', () => {
    localStorage.setItem('headstart_l1_personalsandbox_a1', '{invalid}')
    expect(loadPersonalSandboxFs('l1', 'a1')).toBeNull()
  })

  it('loadSavedFs returns null on corrupt JSON', () => {
    localStorage.setItem('headstart_l1_1_a1', '{invalid}')
    expect(loadSavedFs('l1', 1, 'a1')).toBeNull()
  })
})

describe('studentStorage — quota exceeded resilience', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('saveCode does not throw when setItem raises QuotaExceededError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => saveCode('l1', 1, 'a1', { code: 'x' })).not.toThrow()
  })

  it('saveFile does not throw when setItem raises QuotaExceededError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => saveFile('l1', 1, 'main.py', 'a1', 'code')).not.toThrow()
  })

  it('savePersonalSandboxCode does not throw on quota error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => savePersonalSandboxCode('l1', 'a1', { code: 'x' })).not.toThrow()
  })

  it('savePersonalSandboxFs does not throw on quota error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => savePersonalSandboxFs('l1', 'a1', {})).not.toThrow()
  })

  it('saveFsState does not throw on quota error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })
    expect(() => saveFsState('l1', 1, 'a1', {})).not.toThrow()
  })
})
