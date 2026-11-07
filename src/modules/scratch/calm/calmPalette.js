// The calm Scratch screen (capabilities.calmScratch; ScratchWorkspace, LessonTaskContent): pure
// rules for the collapsible block palette and the calm layout. Blockly-free, so they test in
// plain jsdom.
//
// The palette is Blockly's own always-open flyout laid over the left of the script area (349px of
// a 483px blocks pane at 1366). It cannot be narrowed, and resizing or pushing the workspace makes
// blocks jump or drift, so the calm screen leaves Blockly's layout alone: the palette starts
// closed behind a Blocks button, and every time it opens the script is scrolled clear of it.
import { scrollFlyoutToCategory } from '../scratchHighlight.js'

// Scrolls a workspace so no top-level block starts under the palette. On desktop the starter
// "say Hello! for 2 seconds" block loaded half hidden behind the palette while the instructions
// said "Click the block stack" (HSC Audit 08). Measured from the DOM, since the palette overlays
// the canvas: shifts the canvas right (scrollX grows as the canvas moves right) by just enough to
// clear the palette's right edge plus a small gap. Returns whether it scrolled.
// Blockly's trashcan has its own (hidden) `.blocklyFlyout` ahead of the palette in the DOM, so
// the palette is the widest flyout on show, not simply the first.
const FLYOUT_CLEAR_GAP = 16
function shownPaletteRect(div) {
  let best = null
  for (const el of div.querySelectorAll?.('.blocklyFlyout') ?? []) {
    if (el.style?.display === 'none') continue
    const rect = el.getBoundingClientRect()
    if (rect?.width > 0 && (!best || rect.width > best.width)) best = rect
  }
  return best
}
export function revealBlocksBesideFlyout(ws, div) {
  if (!ws || !div) return false
  const flyoutRect = shownPaletteRect(div)
  if (!flyoutRect) return false
  return scrollScriptRightOf(ws, flyoutRect.right)
}

// Arrival on the calm screen (palette closed, canvas not touched yet): hiding the palette moves
// Blockly's canvas, leaving the starter script off the left edge or far to the right, so the
// script is placed at the left of the canvas. Run once the layout has settled (debounced by the
// caller), never while dragging. Returns whether it scrolled.
const ARRIVAL_SLACK = 64
export function placeScriptOnArrival(ws, div) {
  if (!ws || !div) return false
  syncCanvasScroll(ws)
  const edge = div.getBoundingClientRect?.()?.left
  const leftmost = leftmostBlock(ws)
  if (!Number.isFinite(edge) || !Number.isFinite(leftmost)) return false
  const shift = edge + FLYOUT_CLEAR_GAP - leftmost
  if (shift <= 0 && -shift <= ARRIVAL_SLACK) return false
  ws.scroll(ws.scrollX + shift, ws.scrollY)
  return true
}

// Re-applies Blockly's own scroll position (it clamps it to what it allows), redrawing the canvas
// where Blockly thinks it is. After the palette hides, Blockly has drawn the canvas without the
// palette's offset while its scroll still counts it; this puts the two back in step.
export function syncCanvasScroll(ws) {
  try {
    ws?.scroll?.(ws.scrollX, ws.scrollY)
  } catch {}
}

function leftmostBlock(ws) {
  let leftmost = Infinity
  for (const block of ws.getTopBlocks?.(false) ?? []) {
    const rect = block.getSvgRoot?.()?.getBoundingClientRect?.()
    if (rect?.width) leftmost = Math.min(leftmost, rect.left)
  }
  return leftmost
}

function scrollScriptRightOf(ws, edge) {
  const leftmost = leftmostBlock(ws)
  if (!Number.isFinite(leftmost)) return false
  const shortfall = edge + FLYOUT_CLEAR_GAP - leftmost
  if (shortfall <= 0) return false
  ws.scroll(ws.scrollX + shortfall, ws.scrollY)
  return true
}

/**
 * Run when the palette has just opened (after Blockly has laid it out): scrolls any block hidden
 * under it clear, on every open, whether or not the child has touched the canvas. Never while a
 * block is being dragged (a scroll mid-drag makes the block jump from the finger): the caller
 * runs it again once the drag ends. Returns 'revealed' | 'clear' | 'deferred'.
 */
export function openPaletteReveal(ws, div, { dragging = false } = {}) {
  if (dragging) return 'deferred'
  return revealBlocksBesideFlyout(ws, div) ? 'revealed' : 'clear'
}

// The last category the child had the palette on, in memory only (never localStorage): reopening
// the palette, on this task or the next, goes back to it. One memory per student view
// (LessonTaskContent holds it and hands it to the workspace as `calm.categoryMemory`), so two views
// on one page, or two tests, never share it.
export function createPaletteCategoryMemory() {
  let category = null
  return {
    remember(name) {
      if (typeof name === 'string' && name.trim()) category = name.trim()
    },
    get() {
      return category
    },
  }
}

/**
 * What follows a palette open or close on the calm screen: 'reveal' after an open (back to the
 * remembered category, blocks scrolled clear of the palette) or 'sync' after a close (Blockly's
 * scroll re-applied, then the script placed on arrival). Never mid-drag (a scroll then makes the
 * dragged block jump): the same step runs when the drag ends.
 */
export function calmPaletteFollowUp({ open, dragging }) {
  const step = open ? 'reveal' : 'sync'
  return dragging ? { now: null, onDragEnd: step } : { now: step, onDragEnd: null }
}

/**
 * The palette step owed when a block drag ends. Toggles during one drag are only noted (`note`);
 * on drag end `take` gives the step for the palette's FINAL state ('reveal' if it ends open, 'sync'
 * if it ends closed), once, so a close then an open (or the reverse) mid-drag never loses a step
 * to the other.
 */
export function createCalmDragEndStep() {
  let owed = false
  return {
    note() {
      owed = true
    },
    take({ open }) {
      if (!owed) return null
      owed = false
      return open ? 'reveal' : 'sync'
    },
  }
}

// The category heading at (or just above) the top of the palette's view. Never throws.
export function topFlyoutCategory(workspace) {
  try {
    const flyout = workspace?.getFlyout?.()
    if (!flyout || (flyout.isVisible && !flyout.isVisible())) return null
    const flyoutWorkspace = flyout.getWorkspace()
    const view = flyoutWorkspace.getMetricsManager().getViewMetrics()
    let name = null
    for (const item of flyout.getContents?.() ?? []) {
      const element = item?.getElement?.() ?? item
      if (!element?.isLabel?.()) continue
      const y = element.getPosition().y * (flyoutWorkspace.scale ?? 1)
      if (y <= view.top + 24) name = element.getButtonText?.()?.trim() || name
    }
    return name
  } catch {
    return null
  }
}

// Scrolls a just-opened palette back to the remembered category (if it has that heading).
export function restorePaletteCategory(workspace, memory) {
  const name = memory?.get?.()
  return name ? scrollFlyoutToCategory(workspace, name) : false
}

// Lesson-level opt-out (`scratchPaletteOpen: true`): the palette starts open, as before the calm
// screen, for a lesson whose explainers point at blocks in an open palette.
export function paletteStartsOpen(lesson) {
  return lesson?.scratchPaletteOpen === true
}

function readsSpriteProperties(check) {
  if (!check || typeof check !== 'object') return false
  if (Array.isArray(check)) return check.some(readsSpriteProperties)
  if (typeof check.type === 'string' && check.type.startsWith('sprite_property')) return true
  return Object.values(check).some(
    (value) => typeof value === 'object' && readsSpriteProperties(value)
  )
}

// Every place a task can hold checks: the completion check (one or a list), feedback checks and
// their legacy alias, and any check kept on a code stage or under a manual-check field.
function taskChecks(task) {
  if (!task || typeof task !== 'object') return []
  const stages = Array.isArray(task.codeStages) ? task.codeStages : []
  return [
    task.check,
    task.checks,
    task.manualCheck,
    task.manualChecks,
    task.feedbackChecks,
    task.incorrectChecks,
    ...stages.flatMap((stage) => [stage?.check, stage?.checks]),
  ]
}

// The sprite property row (x, y, direction, size...) folds behind More unless one of the task's
// checks reads sprite properties, where the child may need to watch them.
export function calmFoldsSpriteProps(task) {
  return !readsSpriteProperties(taskChecks(task))
}

// Below this task-panel width (a portrait tablet: 768px screen, ~736px panel) the stage is pinned
// above the blocks with the explainer beside it; above it (1024 landscape and up) the explainer is
// a column beside the blocks and the stage.
export const SCRATCH_CALM_STACK_BREAKPOINT = 880

// The explainer column beside the blocks: 320px on a laptop, narrowing to 220px on a tablet.
export function calmExplainerWidth(panelWidth) {
  return Math.max(220, Math.min(320, Math.round((panelWidth || 0) * 0.24)))
}

// The pinned stage in the stacked layout: about 44% of the width, at most 0.65 (312x234).
const STAGE_W = 480
const STACKED_STAGE_MAX = 0.65
const STACKED_STAGE_MIN = 0.35
export function calmStackedStageScale(width) {
  const scale = ((width || 0) * 0.44) / (STAGE_W + 2)
  return Math.max(STACKED_STAGE_MIN, Math.min(STACKED_STAGE_MAX, scale))
}
