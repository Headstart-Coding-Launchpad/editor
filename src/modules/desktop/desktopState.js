import { DEFAULT_FS } from '../filesystem/filesystem.js'

// ── state shape ──────────────────────────────────────────────────────────────
//
// {
//   fs: { "/": { type: 'dir' }, "/Downloads/": { type: 'dir' }, ... }, // same flat map as filesystem.js
//   recycleBin: [{ path, entry, deletedAt, originalParent }],
//   windows: [{ id, appId, x, y, width, height, minimized, maximized, zIndex }],
// }

export const DEFAULT_DESKTOP_FS = { ...DEFAULT_FS, '/Downloads/': { type: 'dir' } }

export const DEFAULT_WINDOW = { x: 80, y: 60, width: 640, height: 420 }

export function makeDefaultWindows(availableApps = ['fileManager']) {
  return availableApps.map((appId, i) => ({
    id: `${appId}-1`,
    appId,
    x: DEFAULT_WINDOW.x + i * 32,
    y: DEFAULT_WINDOW.y + i * 32,
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    minimized: false,
    maximized: false,
    zIndex: i + 1,
  }))
}

export function makeDefaultDesktop(availableApps = ['fileManager']) {
  return {
    fs: DEFAULT_DESKTOP_FS,
    recycleBin: [],
    windows: makeDefaultWindows(availableApps),
  }
}

export const DEFAULT_DESKTOP = makeDefaultDesktop()

export function normaliseDesktop(raw) {
  if (!raw || typeof raw !== 'object') return makeDefaultDesktop()
  return {
    fs: raw.fs && typeof raw.fs === 'object' ? raw.fs : DEFAULT_DESKTOP_FS,
    recycleBin: Array.isArray(raw.recycleBin) ? raw.recycleBin : [],
    windows: Array.isArray(raw.windows) ? raw.windows : makeDefaultWindows(),
  }
}

export function serializeDesktop(state) {
  return JSON.stringify(normaliseDesktop(state))
}

export function deserializeDesktop(raw) {
  try {
    return normaliseDesktop(JSON.parse(raw))
  } catch {
    return makeDefaultDesktop()
  }
}

// ── window operations (all pure — return a new desktop state) ────────────────

export function focusWindow(state, windowId) {
  const maxZ = Math.max(0, ...state.windows.map(w => w.zIndex ?? 0))
  return {
    ...state,
    windows: state.windows.map(w => w.id === windowId ? { ...w, zIndex: maxZ + 1 } : w),
  }
}

export function moveWindow(state, windowId, x, y) {
  return {
    ...state,
    windows: state.windows.map(w => w.id === windowId ? { ...w, x, y } : w),
  }
}

export function resizeWindow(state, windowId, width, height) {
  return {
    ...state,
    windows: state.windows.map(w => w.id === windowId ? { ...w, width, height } : w),
  }
}

export function setWindowMinimized(state, windowId, minimized) {
  return {
    ...state,
    windows: state.windows.map(w => w.id === windowId ? { ...w, minimized, maximized: minimized ? false : w.maximized } : w),
  }
}

export function setWindowMaximized(state, windowId, maximized) {
  return {
    ...state,
    windows: state.windows.map(w => w.id === windowId ? { ...w, maximized, minimized: false } : w),
  }
}

export function closeWindow(state, windowId) {
  return {
    ...state,
    windows: state.windows.filter(w => w.id !== windowId),
  }
}

export function openWindow(state, appId, overrides = {}) {
  const existing = state.windows.find(w => w.appId === appId)
  if (existing) return setWindowMinimized(focusWindow(state, existing.id), existing.id, false)
  const maxZ = Math.max(0, ...state.windows.map(w => w.zIndex ?? 0))
  const win = {
    id: `${appId}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    appId,
    ...DEFAULT_WINDOW,
    minimized: false,
    maximized: false,
    zIndex: maxZ + 1,
    ...overrides,
  }
  return { ...state, windows: [...state.windows, win] }
}

// Arranges two windows side by side across the given viewport width/height.
export function arrangeSideBySide(state, windowIdA, windowIdB, viewport = { width: 1200, height: 700 }) {
  const half = Math.floor(viewport.width / 2)
  let windows = state.windows.map(w => {
    if (w.id === windowIdA) return { ...w, x: 0, y: 0, width: half, height: viewport.height, minimized: false, maximized: false }
    if (w.id === windowIdB) return { ...w, x: half, y: 0, width: viewport.width - half, height: viewport.height, minimized: false, maximized: false }
    return w
  })
  return { ...state, windows }
}
