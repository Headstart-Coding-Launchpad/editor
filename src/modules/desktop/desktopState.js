import { DEFAULT_FS } from '../filesystem/filesystem.js'

// ── state shape ──────────────────────────────────────────────────────────────
//
// {
//   fs: { "/": { type: 'dir' }, "/Downloads/": { type: 'dir' }, ... }, // same flat map as filesystem.js
//   recycleBin: [{ path, entry, deletedAt, originalParent }],
//   windows: [{ id, appId, x, y, width, height, minimized, maximized, zIndex, filePath? }],
//   browserVisited: ['pageId', ...],   // every simulated-browser page ever visited (dedup log)
//   lastSearchQuery: 'free text' | null, // most recent query submitted to the simulated search engine
// }
//
// `filePath` is optional and only meaningful for apps that can show several windows at
// once (Text Editor); it's the path of the file that window is displaying/editing.

export const DEFAULT_DESKTOP_FS = { ...DEFAULT_FS, '/Downloads/': { type: 'dir' } }

export const DEFAULT_WINDOW = { x: 80, y: 60, width: 640, height: 420 }

// Only the first available app starts open — the rest wait for the student to launch them
// from a desktop icon (or, for Text Editor/Image Viewer, from opening a file in File
// Manager). Opening a window per available app would defeat the point of desktop icons the
// moment a task offers more than one app.
export function makeDefaultWindows(availableApps = ['fileManager']) {
  const first = availableApps[0]
  if (!first) return []
  return [{
    id: `${first}-1`,
    appId: first,
    ...DEFAULT_WINDOW,
    minimized: false,
    maximized: false,
    zIndex: 1,
  }]
}

export function makeDefaultDesktop(availableApps = ['fileManager']) {
  return {
    fs: DEFAULT_DESKTOP_FS,
    recycleBin: [],
    windows: makeDefaultWindows(availableApps),
    browserVisited: [],
    lastSearchQuery: null,
  }
}

export const DEFAULT_DESKTOP = makeDefaultDesktop()

export function normaliseDesktop(raw) {
  if (!raw || typeof raw !== 'object') return makeDefaultDesktop()
  return {
    fs: raw.fs && typeof raw.fs === 'object' ? raw.fs : DEFAULT_DESKTOP_FS,
    recycleBin: Array.isArray(raw.recycleBin) ? raw.recycleBin : [],
    windows: Array.isArray(raw.windows) ? raw.windows : makeDefaultWindows(),
    browserVisited: Array.isArray(raw.browserVisited) ? raw.browserVisited : [],
    lastSearchQuery: typeof raw.lastSearchQuery === 'string' ? raw.lastSearchQuery : null,
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

// A window is "dirty" (has unsaved edits) when it carries a `draftContent` buffer that
// differs from what's actually saved in `fs` at its `filePath` (or, for an untitled window
// with no filePath yet, differs from empty). Only apps that opt in by setting `draftContent`
// on their window (Text Editor) are ever dirty — File Manager windows never set it.
export function isWindowDirty(win, fs) {
  if (win?.draftContent === undefined) return false
  const saved = win.filePath ? (fs?.[win.filePath]?.content ?? '') : ''
  return win.draftContent !== saved
}

// Opens a window for `appId`, or restores/focuses one already open for the same
// (appId, filePath) pair. `filePath` is omitted for singleton apps (File Manager, or
// Image Viewer/Text Editor launched blank) so those keep today's one-window-per-app
// behaviour; passing a filePath lets several Text Editor windows be open at once.
export function openWindow(state, appId, overrides = {}) {
  const filePath = overrides.filePath ?? null
  const existing = state.windows.find(w => w.appId === appId && (w.filePath ?? null) === filePath)
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

// Records a simulated-browser page visit in the dedup log used by the `browser_visited`
// check — a no-op if that page has already been logged.
export function recordPageVisit(state, pageId) {
  if (!pageId || state.browserVisited?.includes(pageId)) return state
  return { ...state, browserVisited: [...(state.browserVisited ?? []), pageId] }
}

// Records the most recent free-text query submitted to the simulated search engine,
// used by the `search_query` check.
export function recordSearchQuery(state, query) {
  return { ...state, lastSearchQuery: query }
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
