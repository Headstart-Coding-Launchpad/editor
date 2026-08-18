import { describe, it, expect } from 'vitest'
import {
  makeDefaultDesktop,
  normaliseDesktop,
  serializeDesktop,
  deserializeDesktop,
  focusWindow,
  moveWindow,
  resizeWindow,
  setWindowMinimized,
  setWindowMaximized,
  closeWindow,
  openWindow,
  isWindowDirty,
  arrangeSideBySide,
  recordPageVisit,
  recordSearchQuery,
} from '../desktopState.js'

describe('desktopState', () => {
  it('makeDefaultDesktop seeds a Downloads folder and opens only the first available app', () => {
    const state = makeDefaultDesktop(['fileManager'])
    expect(state.fs['/Downloads/']).toEqual({ type: 'dir' })
    expect(state.windows).toHaveLength(1)
    expect(state.windows[0].appId).toBe('fileManager')
    expect(state.recycleBin).toEqual([])
  })

  it('makeDefaultDesktop leaves additional available apps closed, launchable only from their icon', () => {
    const state = makeDefaultDesktop(['fileManager', 'textEditor', 'imageViewer'])
    expect(state.windows).toHaveLength(1)
    expect(state.windows[0].appId).toBe('fileManager')
  })

  it('normaliseDesktop fills in missing fields with defaults', () => {
    expect(normaliseDesktop(null)).toEqual(makeDefaultDesktop())
    expect(normaliseDesktop({ fs: { '/': { type: 'dir' } } })).toEqual({
      fs: { '/': { type: 'dir' } },
      recycleBin: [],
      windows: expect.any(Array),
      browserVisited: [],
      lastSearchQuery: null,
    })
  })

  it('round-trips through serialize/deserialize', () => {
    const state = makeDefaultDesktop()
    const restored = deserializeDesktop(serializeDesktop(state))
    expect(restored).toEqual(state)
  })

  it('deserializeDesktop falls back to defaults on invalid JSON', () => {
    expect(deserializeDesktop('not json')).toEqual(makeDefaultDesktop())
  })

  it('focusWindow raises a window above all others', () => {
    let state = makeDefaultDesktop()
    state = openWindow(state, 'textEditor')
    const [first, second] = state.windows
    const focused = focusWindow(state, first.id)
    expect(focused.windows.find(w => w.id === first.id).zIndex).toBeGreaterThan(second.zIndex)
  })

  it('moveWindow and resizeWindow update only the targeted window', () => {
    const state = makeDefaultDesktop()
    const id = state.windows[0].id
    const moved = moveWindow(state, id, 10, 20)
    expect(moved.windows[0]).toMatchObject({ x: 10, y: 20 })
    const resized = resizeWindow(moved, id, 300, 200)
    expect(resized.windows[0]).toMatchObject({ width: 300, height: 200 })
  })

  it('setWindowMinimized/setWindowMaximized are mutually exclusive', () => {
    const state = makeDefaultDesktop()
    const id = state.windows[0].id
    const maximized = setWindowMaximized(state, id, true)
    expect(maximized.windows[0]).toMatchObject({ maximized: true, minimized: false })
    const minimized = setWindowMinimized(maximized, id, true)
    expect(minimized.windows[0]).toMatchObject({ minimized: true, maximized: false })
  })

  it('closeWindow removes the window', () => {
    const state = makeDefaultDesktop()
    const id = state.windows[0].id
    expect(closeWindow(state, id).windows).toHaveLength(0)
  })

  it('openWindow adds a new window, or restores/focuses an existing one for the same app', () => {
    let state = makeDefaultDesktop()
    const opened = openWindow(state, 'imageViewer')
    expect(opened.windows).toHaveLength(2)

    const minimizedFirst = setWindowMinimized(opened, opened.windows[0].id, true)
    const reopened = openWindow(minimizedFirst, 'fileManager')
    expect(reopened.windows).toHaveLength(2)
    expect(reopened.windows.find(w => w.appId === 'fileManager').minimized).toBe(false)
  })

  it('openWindow with a filePath opens a separate window per file, but reuses one for the same file', () => {
    let state = makeDefaultDesktop()
    state = openWindow(state, 'textEditor', { filePath: '/a.txt' })
    state = openWindow(state, 'textEditor', { filePath: '/b.txt' })
    expect(state.windows.filter(w => w.appId === 'textEditor')).toHaveLength(2)

    const reopened = openWindow(state, 'textEditor', { filePath: '/a.txt' })
    expect(reopened.windows.filter(w => w.appId === 'textEditor')).toHaveLength(2)
  })

  it('openWindow with no filePath still dedupes to a single window per app', () => {
    let state = makeDefaultDesktop()
    state = openWindow(state, 'imageViewer')
    const reopened = openWindow(state, 'imageViewer')
    expect(reopened.windows.filter(w => w.appId === 'imageViewer')).toHaveLength(1)
  })

  it('isWindowDirty is false for windows with no draftContent, and compares draftContent against saved fs otherwise', () => {
    const fs = { '/a.txt': { type: 'file', content: 'saved' } }
    expect(isWindowDirty({ appId: 'fileManager' }, fs)).toBe(false)
    expect(isWindowDirty({ appId: 'textEditor', filePath: '/a.txt', draftContent: 'saved' }, fs)).toBe(false)
    expect(isWindowDirty({ appId: 'textEditor', filePath: '/a.txt', draftContent: 'edited' }, fs)).toBe(true)
    expect(isWindowDirty({ appId: 'textEditor', filePath: null, draftContent: '' }, fs)).toBe(false)
    expect(isWindowDirty({ appId: 'textEditor', filePath: null, draftContent: 'untitled text' }, fs)).toBe(true)
  })

  it('arrangeSideBySide places two windows edge to edge across the viewport', () => {
    let state = makeDefaultDesktop()
    state = openWindow(state, 'textEditor')
    const [a, b] = state.windows
    const arranged = arrangeSideBySide(state, a.id, b.id, { width: 1000, height: 600 })
    const wa = arranged.windows.find(w => w.id === a.id)
    const wb = arranged.windows.find(w => w.id === b.id)
    expect(wa.x).toBe(0)
    expect(wa.width).toBe(500)
    expect(wb.x).toBe(500)
    expect(wa.width + wb.width).toBe(1000)
  })

  it('recordPageVisit dedups the browser visit log', () => {
    let state = makeDefaultDesktop()
    state = recordPageVisit(state, 'home')
    state = recordPageVisit(state, 'wildlife-facts')
    state = recordPageVisit(state, 'home')
    expect(state.browserVisited).toEqual(['home', 'wildlife-facts'])
  })

  it('recordPageVisit with no pageId is a no-op', () => {
    const state = makeDefaultDesktop()
    expect(recordPageVisit(state, null)).toBe(state)
  })

  it('recordSearchQuery overwrites the last search query', () => {
    let state = makeDefaultDesktop()
    state = recordSearchQuery(state, 'blue whales')
    expect(state.lastSearchQuery).toBe('blue whales')
    state = recordSearchQuery(state, 'sharks')
    expect(state.lastSearchQuery).toBe('sharks')
  })
})
