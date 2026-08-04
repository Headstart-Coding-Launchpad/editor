export const DESKTOP_CHECK_TYPES = [
  'fs_recycle_bin',
  'window_state',
  'windows_arranged_side_by_side',
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
    operators: ['opened', 'closed', 'minimized', 'maximized'],
    fields: ['appId'],
    evaluate: 'on_change',
  },
  windows_arranged_side_by_side: {
    subject: 'Windows arranged side by side',
    operators: ['is_arranged'],
    fields: ['appIds'],
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

function findWindow(windows, appId) {
  return (windows ?? []).find(w => w.appId === appId) ?? null
}

function evaluateWindowState(check, windows) {
  const win = findWindow(windows, check.appId)
  switch (check.operator) {
    case 'opened': return !!win
    case 'closed': return !win
    case 'minimized': return !!win?.minimized
    case 'maximized': return !!win?.maximized
    default: return false
  }
}

function evaluateArrangedSideBySide(check, windows, context) {
  const [appA, appB] = check.appIds ?? []
  if (!appA || !appB) return false
  const winA = findWindow(windows, appA)
  const winB = findWindow(windows, appB)
  if (!winA || !winB || winA.minimized || winB.minimized || winA.maximized || winB.maximized) return false

  const viewportWidth = context?.viewport?.width ?? 1200
  if (winA.width / viewportWidth < MIN_WINDOW_WIDTH_SHARE) return false
  if (winB.width / viewportWidth < MIN_WINDOW_WIDTH_SHARE) return false

  const leftEdge = Math.min(winA.x, winB.x)
  const rightEdge = Math.max(winA.x + winA.width, winB.x + winB.width)
  const combinedSpan = rightEdge - leftEdge
  if (combinedSpan / viewportWidth < MIN_COMBINED_WIDTH_SHARE) return false

  const overlap = Math.max(0, Math.min(winA.x + winA.width, winB.x + winB.width) - Math.max(winA.x, winB.x))
  const narrower = Math.min(winA.width, winB.width)
  if (overlap / narrower > MAX_OVERLAP_SHARE) return false

  return true
}

// `desktop` is the desktop module's full state: { fs, recycleBin, windows }. fs_* checks are
// evaluated separately (see src/modules/checks.js), which already knows how to route them
// through evaluateFsCheck using context.fs — this evaluator only owns desktop-specific checks.
export function evaluateDesktopCheck(check, desktop, context = {}) {
  if (!desktop) return false
  const { recycleBin = [], windows = [] } = desktop

  switch (check.type) {
    case 'fs_recycle_bin': {
      const isIn = recycleBin.some(item => item.path === check.path)
      return check.operator === 'not_in' ? !isIn : isIn
    }
    case 'window_state':
      return evaluateWindowState(check, windows)
    case 'windows_arranged_side_by_side':
      return evaluateArrangedSideBySide(check, windows, context)
    default:
      return false
  }
}
