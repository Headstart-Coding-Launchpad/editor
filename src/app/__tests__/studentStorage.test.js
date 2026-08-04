import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadSavedCode,
  loadSavedFile,
  saveCode,
  saveFile,
  loadSavedDesktop,
  saveDesktopState,
  loadPersonalSandboxDesktop,
  savePersonalSandboxDesktop,
  personalSandboxStorageKey,
  studentFileStorageKey,
  studentTaskStorageKey,
} from '../studentStorage'

describe('studentStorage', () => {
  beforeEach(() => localStorage.clear())

  it('retains the established task and per-file key formats', () => {
    expect(studentTaskStorageKey('python-1', 2, 'anon-id')).toBe('headstart_python-1_2_anon-id')
    expect(studentFileStorageKey('html-1', 3, 'index.html', 'anon-id')).toBe('headstart_html-1_3_index.html_anon-id')
  })

  it('namespaces composed-lesson sandboxes by lesson module without changing legacy keys', () => {
    expect(personalSandboxStorageKey('loops', 'anon-id')).toBe('headstart_loops_personalsandbox_anon-id')
    expect(personalSandboxStorageKey('loops', 'anon-id', 'console')).toBe('headstart_loops_module_console_sandbox_anon-id')
  })

  it('persists and restores code snapshots and HTML file contents', () => {
    saveCode('python-1', 2, 'anon-id', { code: 'print(1)', output: '1' })
    saveFile('html-1', 3, 'index.html', 'anon-id', '<h1>Hi</h1>')
    expect(loadSavedCode('python-1', 2, 'anon-id')).toEqual({ code: 'print(1)', output: '1' })
    expect(loadSavedFile('html-1', 3, 'index.html', 'anon-id')).toBe('<h1>Hi</h1>')
  })

  it('persists and restores desktop task state under its own field, alongside the fs key format', () => {
    const desktop = { fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] }
    saveDesktopState('desktop-1', 4, 'anon-id', desktop)
    expect(loadSavedDesktop('desktop-1', 4, 'anon-id')).toEqual(desktop)
    expect(localStorage.getItem(studentTaskStorageKey('desktop-1', 4, 'anon-id'))).toBe(JSON.stringify({ desktop }))
  })

  it('persists and restores a desktop personal sandbox, namespaced the same way as other sandbox state', () => {
    const desktop = { fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] }
    savePersonalSandboxDesktop('desktop-1', 'anon-id', desktop)
    expect(loadPersonalSandboxDesktop('desktop-1', 'anon-id')).toEqual(desktop)
    savePersonalSandboxDesktop('desktop-1', 'anon-id', desktop, 'module-a')
    expect(loadPersonalSandboxDesktop('desktop-1', 'anon-id', 'module-a')).toEqual(desktop)
    expect(loadPersonalSandboxDesktop('desktop-1', 'anon-id')).toEqual(desktop)
  })
})
