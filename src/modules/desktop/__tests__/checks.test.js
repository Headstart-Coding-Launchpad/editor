import { describe, it, expect } from 'vitest'
import { evaluateDesktopCheck } from '../checks.js'
import { evaluateSingleCheck } from '../../checks.js'

function desktop(overrides = {}) {
  return {
    fs: { '/': { type: 'dir' } },
    recycleBin: [],
    windows: [],
    ...overrides,
  }
}

describe('evaluateDesktopCheck', () => {
  it('fs_recycle_bin is_in / not_in', () => {
    const state = desktop({ recycleBin: [{ path: '/notes.txt' }] })
    expect(evaluateDesktopCheck({ type: 'fs_recycle_bin', operator: 'is_in', path: '/notes.txt' }, state)).toBe(true)
    expect(evaluateDesktopCheck({ type: 'fs_recycle_bin', operator: 'is_in', path: '/missing.txt' }, state)).toBe(false)
    expect(evaluateDesktopCheck({ type: 'fs_recycle_bin', operator: 'not_in', path: '/missing.txt' }, state)).toBe(true)
  })

  it('window_state opened/closed/minimized/maximized', () => {
    const state = desktop({ windows: [{ appId: 'fileManager', minimized: false, maximized: true }] })
    expect(evaluateDesktopCheck({ type: 'window_state', operator: 'opened', appId: 'fileManager' }, state)).toBe(true)
    expect(evaluateDesktopCheck({ type: 'window_state', operator: 'closed', appId: 'fileManager' }, state)).toBe(false)
    expect(evaluateDesktopCheck({ type: 'window_state', operator: 'closed', appId: 'textEditor' }, state)).toBe(true)
    expect(evaluateDesktopCheck({ type: 'window_state', operator: 'maximized', appId: 'fileManager' }, state)).toBe(true)
    expect(evaluateDesktopCheck({ type: 'window_state', operator: 'minimized', appId: 'fileManager' }, state)).toBe(false)
  })

  it('windows_arranged_side_by_side accepts a tolerant side-by-side layout', () => {
    const state = desktop({
      windows: [
        { appId: 'a', x: 0, y: 0, width: 590, height: 600, minimized: false, maximized: false },
        { appId: 'b', x: 600, y: 0, width: 600, height: 600, minimized: false, maximized: false },
      ],
    })
    const check = { type: 'windows_arranged_side_by_side', appIds: ['a', 'b'] }
    expect(evaluateDesktopCheck(check, state, { viewport: { width: 1200 } })).toBe(true)
  })

  it('windows_arranged_side_by_side rejects overlapping or minimized windows', () => {
    const overlapping = desktop({
      windows: [
        { appId: 'a', x: 0, y: 0, width: 700, height: 600, minimized: false, maximized: false },
        { appId: 'b', x: 200, y: 0, width: 700, height: 600, minimized: false, maximized: false },
      ],
    })
    expect(evaluateDesktopCheck({ type: 'windows_arranged_side_by_side', appIds: ['a', 'b'] }, overlapping, { viewport: { width: 1200 } })).toBe(false)

    const minimized = desktop({
      windows: [
        { appId: 'a', x: 0, y: 0, width: 590, height: 600, minimized: true, maximized: false },
        { appId: 'b', x: 600, y: 0, width: 600, height: 600, minimized: false, maximized: false },
      ],
    })
    expect(evaluateDesktopCheck({ type: 'windows_arranged_side_by_side', appIds: ['a', 'b'] }, minimized, { viewport: { width: 1200 } })).toBe(false)
  })

  it('is registered with the central check dispatcher via context.desktop', () => {
    const state = desktop({ windows: [{ appId: 'fileManager', minimized: false }] })
    expect(evaluateSingleCheck({ type: 'window_state', operator: 'opened', appId: 'fileManager' }, '', { desktop: state })).toBe(true)
  })

  it('fs_* checks still route through context.fs when evaluated in a desktop context', () => {
    const state = desktop({ fs: { '/': { type: 'dir' }, '/Documents/': { type: 'dir' } } })
    expect(evaluateSingleCheck(
      { type: 'fs_path', operator: 'exists', itemType: 'dir', path: '/Documents/' },
      '',
      { fs: state.fs, desktop: state }
    )).toBe(true)
  })
})
