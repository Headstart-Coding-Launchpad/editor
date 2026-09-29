import { DEFAULT_VIEWPORT } from './desktopState.js'

export const DESKTOP_CHECK_TYPES = [
  'fs_recycle_bin',
  'window_state',
  'windows_arranged_side_by_side',
  'browser_visited',
  'search_query',
]

export const DESKTOP_CHECK_DEFINITIONS = {
  fs_recycle_bin: {
    subject: 'Recycle Bin',
    operators: ['is_in', 'not_in'],
    fields: ['path'],
    evaluate: 'on_change',
  },
  window_state: {
    subject: 'Window state',
    operators: ['opened', 'closed', 'minimized', 'maximized', 'moved_to', 'resized'],
    fields: ['appId', 'zone', 'size', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'],
    evaluate: 'on_change',
  },
  windows_arranged_side_by_side: {
    subject: 'Windows arranged side by side',
    operators: ['is_arranged'],
    fields: ['appIds'],
    evaluate: 'on_change',
  },
  browser_visited: {
    subject: 'Browser page visited',
    operators: ['visited', 'not_visited'],
    fields: ['pageId'],
    evaluate: 'on_change',
  },
  search_query: {
    subject: 'Search engine query',
    operators: ['contains', 'not_contains', 'equals'],
    fields: ['text'],
    evaluate: 'on_change',
  },
}

// Minimum share of the viewport each window must occupy, and how much of the
// viewport the pair must cover together, to count as "arranged side by side".
// Tolerant on purpose — the spec asks the check to assess a meaningful outcome
// ("two windows arranged correctly"), not an exact pixel layout.
const MIN_WINDOW_WIDTH_SHARE = 0.3
const MIN_COMBINED_WIDTH_SHARE = 0.75
const MAX_OVERLAP_SHARE = 0.15

// Screen zones for `window_state` `moved_to`, as [left, top, right, bottom] fractions of the
// desktop. A window is in a zone when its centre is.
export const WINDOW_ZONES = {
  left_half: [0, 0, 0.5, 1],
  right_half: [0.5, 0, 1, 1],
  top_half: [0, 0, 1, 0.5],
  bottom_half: [0, 0.5, 1, 1],
  top_left: [0, 0, 0.5, 0.5],
  top_right: [0.5, 0, 1, 0.5],
  bottom_left: [0, 0.5, 0.5, 1],
  bottom_right: [0.5, 0.5, 1, 1],
}

export const WINDOW_RESIZE_SIZES = ['smaller', 'larger']
const WINDOW_SIZE_LIMIT_FIELDS = ['minWidth', 'minHeight', 'maxWidth', 'maxHeight']

// How much a window's area must change from its starting size to count as resized.
const MIN_RESIZE_AREA_CHANGE = 0.15

// The desktop area window geometry refers to: the size WindowManager measured and stored on the
// desktop, else one passed in the check context, else the assumed default.
function viewportOf(desktop, context) {
  const stored = desktop?.viewport ?? context?.viewport
  return stored?.width > 0 && stored?.height > 0 ? stored : DEFAULT_VIEWPORT
}

function findWindow(windows, appId) {
  return (windows ?? []).find((w) => w.appId === appId) ?? null
}

function isFreeWindow(win) {
  return !!win && !win.minimized && !win.maximized
}

function evaluateMovedTo(check, win, viewport) {
  const zone = WINDOW_ZONES[check.zone]
  if (!zone || !isFreeWindow(win)) return false
  const cx = (win.x + win.width / 2) / viewport.width
  const cy = (win.y + win.height / 2) / viewport.height
  const [left, top, right, bottom] = zone
  return cx >= left && cx <= right && cy >= top && cy <= bottom
}

function evaluateResized(check, win, viewport) {
  if (!isFreeWindow(win)) return false
  const startArea = (win.startWidth ?? win.width) * (win.startHeight ?? win.height)
  const ratio = startArea > 0 ? (win.width * win.height) / startArea : 1
  const limits = WINDOW_SIZE_LIMIT_FIELDS.filter((field) => check[field] != null)
  if (check.size === 'smaller' && ratio > 1 - MIN_RESIZE_AREA_CHANGE) return false
  if (check.size === 'larger' && ratio < 1 + MIN_RESIZE_AREA_CHANGE) return false
  // No direction and no limits: any meaningful change counts.
  if (!check.size && limits.length === 0) return Math.abs(ratio - 1) >= MIN_RESIZE_AREA_CHANGE
  const width = win.width / viewport.width
  const height = win.height / viewport.height
  if (check.minWidth != null && width < Number(check.minWidth)) return false
  if (check.minHeight != null && height < Number(check.minHeight)) return false
  if (check.maxWidth != null && width > Number(check.maxWidth)) return false
  if (check.maxHeight != null && height > Number(check.maxHeight)) return false
  return true
}

function evaluateWindowState(check, windows, viewport) {
  const win = findWindow(windows, check.appId)
  switch (check.operator) {
    case 'opened':
      return !!win
    case 'closed':
      return !win
    case 'minimized':
      return !!win?.minimized
    case 'maximized':
      return !!win?.maximized
    case 'moved_to':
      return evaluateMovedTo(check, win, viewport)
    case 'resized':
      return evaluateResized(check, win, viewport)
    default:
      return false
  }
}

function evaluateArrangedSideBySide(check, windows, context) {
  const [appA, appB] = check.appIds ?? []
  if (!appA || !appB) return false
  const winA = findWindow(windows, appA)
  const winB = findWindow(windows, appB)
  if (!winA || !winB || winA.minimized || winB.minimized || winA.maximized || winB.maximized)
    return false

  const viewportWidth = viewportOf(context?.desktop, context).width
  if (winA.width / viewportWidth < MIN_WINDOW_WIDTH_SHARE) return false
  if (winB.width / viewportWidth < MIN_WINDOW_WIDTH_SHARE) return false

  const leftEdge = Math.min(winA.x, winB.x)
  const rightEdge = Math.max(winA.x + winA.width, winB.x + winB.width)
  const combinedSpan = rightEdge - leftEdge
  if (combinedSpan / viewportWidth < MIN_COMBINED_WIDTH_SHARE) return false

  const overlap = Math.max(
    0,
    Math.min(winA.x + winA.width, winB.x + winB.width) - Math.max(winA.x, winB.x)
  )
  const narrower = Math.min(winA.width, winB.width)
  if (overlap / narrower > MAX_OVERLAP_SHARE) return false

  return true
}

function evaluateBrowserVisited(check, browserVisited) {
  const visited = (browserVisited ?? []).includes(check.pageId)
  return check.operator === 'not_visited' ? !visited : visited
}

function evaluateSearchQuery(check, lastSearchQuery) {
  const query = (lastSearchQuery ?? '').trim().toLowerCase()
  const expected = (check.text ?? '').trim().toLowerCase()
  if (!expected) return false
  switch (check.operator) {
    case 'equals':
      return query === expected
    case 'not_contains':
      return !query.includes(expected)
    case 'contains':
    default:
      return query.includes(expected)
  }
}

// `desktop` is the desktop module's full state: { fs, recycleBin, windows, browserVisited,
// lastSearchQuery }. fs_* checks are evaluated separately (see src/modules/checks.js), which
// already knows how to route them through evaluateFsCheck using context.fs — this evaluator
// only owns desktop-specific checks.
export function evaluateDesktopCheck(check, desktop, context = {}) {
  if (!desktop) return false
  const { recycleBin = [], windows = [], browserVisited = [], lastSearchQuery = null } = desktop

  switch (check.type) {
    case 'fs_recycle_bin': {
      const isIn = recycleBin.some((item) => item.path === check.path)
      return check.operator === 'not_in' ? !isIn : isIn
    }
    case 'window_state':
      return evaluateWindowState(check, windows, viewportOf(desktop, context))
    case 'windows_arranged_side_by_side':
      return evaluateArrangedSideBySide(check, windows, { ...context, desktop })
    case 'browser_visited':
      return evaluateBrowserVisited(check, browserVisited)
    case 'search_query':
      return evaluateSearchQuery(check, lastSearchQuery)
    default:
      return false
  }
}

// Authoring rules for window_state (the registry's `validate`, run for the Builder and CLI).
function validateWindowState(check, { n, kind }) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  if (!String(check.appId ?? '').trim()) {
    errors.push(`Task ${n} has a window_state ${label} but no appId`)
  }
  if (check.operator === 'moved_to' && !WINDOW_ZONES[check.zone]) {
    errors.push(
      `Task ${n} has a window_state moved_to ${label} with zone "${check.zone ?? ''}" — use one of: ${Object.keys(WINDOW_ZONES).join(', ')}`
    )
  }
  if (check.operator !== 'resized') return errors
  if (check.size != null && !WINDOW_RESIZE_SIZES.includes(check.size)) {
    errors.push(
      `Task ${n} has a window_state resized ${label} with size "${check.size}" — use one of: ${WINDOW_RESIZE_SIZES.join(', ')}`
    )
  }
  for (const field of WINDOW_SIZE_LIMIT_FIELDS) {
    if (check[field] == null) continue
    const value = Number(check[field])
    if (!(value > 0 && value <= 1)) {
      errors.push(
        `Task ${n} has a window_state resized ${label} whose ${field} is not a fraction of the desktop (more than 0, up to 1)`
      )
    }
  }
  for (const [min, max] of [
    ['minWidth', 'maxWidth'],
    ['minHeight', 'maxHeight'],
  ]) {
    if (check[min] != null && check[max] != null && Number(check[min]) > Number(check[max])) {
      errors.push(
        `Task ${n} has a window_state resized ${label} whose ${min} is more than its ${max}`
      )
    }
  }
  return errors
}

const VALIDATORS = { window_state: validateWindowState }

// Check-type registry definitions (see ../checkRegistry.js). fs_* checks used in
// Desktop lessons are owned by the filesystem module's CHECKS.
export const CHECKS = DESKTOP_CHECK_TYPES.map((type) => {
  const def = DESKTOP_CHECK_DEFINITIONS[type] ?? {}
  return {
    type,
    owner: 'module:desktop',
    subject: def.subject,
    operators: def.operators,
    fields: def.fields,
    timing: def.evaluate ?? 'on_change',
    requiresRun: false,
    submitAllowed: false,
    contextKey: 'desktop',
    evaluate: (check, _output, context = {}) =>
      evaluateDesktopCheck(check, context.desktop, context),
    ...(VALIDATORS[type] ? { validate: VALIDATORS[type] } : {}),
  }
})
