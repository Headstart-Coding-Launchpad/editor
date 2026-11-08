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

// The palette starts open, as before the calm screen, so existing lessons are unchanged. A lesson
// opts into the calm closed palette (behind the Blocks button) with `scratchPaletteClosed: true`.
export function paletteStartsOpen(lesson) {
  return lesson?.scratchPaletteClosed !== true
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

// Sprite settings (the sprite property row: x, y, direction, size...) starts open when one of the
// task's checks reads sprite properties, where the child may need to watch them; else folded.
export function calmFoldsSpriteProps(task) {
  return !readsSpriteProperties(taskChecks(task))
}

// Below this task-panel width (a portrait tablet: 768px screen, ~736px panel) the stage is pinned
// above the blocks with the explainer beside it; above it (1024 landscape and up) the explainer is
// a column beside the blocks and the stage.
export const SCRATCH_CALM_STACK_BREAKPOINT = 880

// The explainer column beside the blocks (with the hint inside its card): about 232px on a 1366
// laptop, 208px on a 1024 tablet, at most 320px on a big screen, so the blocks get the room.
export function calmExplainerWidth(panelWidth) {
  return Math.max(208, Math.min(320, Math.round((panelWidth || 0) * 0.175)))
}

const STAGE_W = 480
const STAGE_H = 360

// The side-by-side stage starts small (Enlarge shows it full screen): 320x240 on a 1366 laptop
// (a ~1090px workspace beside the explainer column), about 256 wide on a 1024 tablet (~772px),
// never under 240 wide or over full size. It is also held to the window's size (320 at 1366, 256
// at 1024), so the playground, with no explainer column and a wider workspace, gets the same stage.
// A short screen shrinks it so Run, Enlarge, the stage, the sprite tiles and Sprite settings still
// fit the column (CALM_STAGE_COLUMN_CHROME).
const CALM_STAGE_MIN_W = 240
const CALM_STAGE_COLUMN_CHROME = 280
export function calmStageScale(width, height, viewportWidth = Infinity) {
  const byWorkspace = 100 + 0.2 * (width || 0)
  const byWindow = 64 + 0.1875 * (viewportWidth > 0 ? viewportWidth : Infinity)
  const wanted = Math.round(Math.min(byWorkspace, byWindow))
  const byWidth = Math.max(CALM_STAGE_MIN_W, Math.min(STAGE_W, wanted)) / STAGE_W
  const byHeight = height > 0 ? (height - CALM_STAGE_COLUMN_CHROME) / STAGE_H : Infinity
  return Math.max(0.35, Math.min(byWidth, byHeight))
}

// The full-screen stage (Enlarge): as big as the window allows under its bar, keeping 4:3.
export const CALM_FULLSCREEN_BAR_H = 56
const CALM_FULLSCREEN_PAD = 12
export function calmFullscreenStageScale(viewportWidth, viewportHeight) {
  const byWidth = ((viewportWidth || 0) - 2 * CALM_FULLSCREEN_PAD) / (STAGE_W + 2)
  const byHeight =
    ((viewportHeight || 0) - CALM_FULLSCREEN_BAR_H - 2 * CALM_FULLSCREEN_PAD) / (STAGE_H + 2)
  return Math.max(0.5, Math.min(byWidth, byHeight))
}

// How many canvas pixels per stage unit: 1 (480x360) at or under full size, more when the stage
// is shown bigger (full screen) so it is drawn sharp, not stretched. At most 3.
export function calmStageResolution(scale, devicePixelRatio = 1) {
  const wanted = Math.ceil((scale || 1) * (devicePixelRatio || 1) - 0.05)
  return Math.max(1, Math.min(3, wanted))
}

// The grey line under the stage before a check has run. The calm screen drops "Run your code to
// check" (the hint in the card already says to run) and "Place the blocks to check"; the manual
// check line stays, as it names the Check button. Null: no line.
export function scratchCheckPrompt({
  calm = false,
  hasChecks,
  attempted,
  running,
  manual = false,
  afterRun = false,
  afterPlaced = false,
}) {
  if (!hasChecks || attempted || running) return null
  if (manual) return 'Run your code, then click Check'
  if (calm) return null
  if (afterRun) return 'Run your code to check'
  if (afterPlaced) return 'Place the blocks to check'
  return null
}

// The pinned stage in the stacked layout: about 44% of the width, at most 0.65 (312x234).
const STACKED_STAGE_MAX = 0.65
const STACKED_STAGE_MIN = 0.35
export function calmStackedStageScale(width) {
  const scale = ((width || 0) * 0.44) / (STAGE_W + 2)
  return Math.max(STACKED_STAGE_MIN, Math.min(STACKED_STAGE_MAX, scale))
}

// The stacked layout's rows, worked out ONCE (LessonTaskContent, from the task panel's measured
// size) and handed to the workspace (`calm.layout`), so the card's fold threshold and the cap on
// its column are the same number. The explainer column beside the pinned stage is capped at 35%
// of the height (never below 140px) and its card scrolls inside. The Blocks pane below keeps up to
// 360px: never more than what is left under the top row (the stage, about 234px plus its toolbar,
// or the capped card if taller) and the gap, never below 120px. A 14-step card with a picture once
// grew the top row until the Blocks pane was 2px tall at 768x1024; a fixed 360px minimum overflowed
// any workspace under about 600px tall.
const STACKED_ASIDE_SHARE = 0.35
const STACKED_ASIDE_MIN = 140
const STACKED_BLOCKS_MAX_MIN = 360
const STACKED_BLOCKS_FLOOR = 120
const STACKED_GAP = 10
const STACKED_STAGE_CHROME = 52
export function calmStackedLayout(height, { width = 0 } = {}) {
  if (!(height > 0)) return { asideMaxHeight: null, blocksMinHeight: 0 }
  const stageRow = Math.round(STAGE_H * calmStackedStageScale(width)) + STACKED_STAGE_CHROME
  const asideMaxHeight = Math.max(STACKED_ASIDE_MIN, Math.round(height * STACKED_ASIDE_SHARE))
  const topRow = Math.max(stageRow, asideMaxHeight)
  const room = height - topRow - STACKED_GAP
  return {
    asideMaxHeight,
    blocksMinHeight: Math.max(STACKED_BLOCKS_FLOOR, Math.min(STACKED_BLOCKS_MAX_MIN, room)),
  }
}
export function calmStackedGridStyle(layout, { aside }) {
  const blocksMinHeight = layout?.blocksMinHeight ?? 0
  return {
    display: 'grid',
    gridTemplateColumns: aside ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
    gridTemplateRows: `auto minmax(${blocksMinHeight}px, 1fr)`,
    gridTemplateAreas: aside ? '"stage aside" "blocks blocks"' : '"stage" "blocks"',
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    gap: STACKED_GAP,
    position: 'relative',
  }
}

// Block size: 65% at most on the calm screen (60% at least), 75% elsewhere (60% at least), so on
// the calm screen blocks and the open palette are smaller and the palette tidier (350px wide at
// 75%, about 306px at 65% at 1366). The ONE place the range is chosen: the size, Blockly's zoom
// options and the unchanged-size check all read it.
export const CALM_BLOCK_SCALE = Object.freeze({ min: 0.6, max: 0.65 })
export const SCRATCH_BLOCK_SCALE = Object.freeze({ min: 0.6, max: 0.75 })
export function blockScaleRange(calm) {
  return calm ? CALM_BLOCK_SCALE : SCRATCH_BLOCK_SCALE
}
function clampScale(scale, { min, max }) {
  return Math.min(max, Math.max(min, scale))
}
// Blockly's zoom options for a new workspace: start, floor and ceiling from the same range.
export function blocklyZoomOptions(calm, scale) {
  const range = blockScaleRange(calm)
  const startScale = clampScale(Number.isFinite(scale) ? scale : range.max, range)
  return { controls: false, wheel: false, startScale, minScale: range.min, maxScale: range.max }
}

// Applies the block size to a workspace. Blockly's setScale scrolls the canvas even when the size
// is unchanged (it re-centres the view): on the calm screen, where every palette open or close
// re-applies the size, that moved the script about 105px on screen each time. There it is only
// set when it really changes (a resize); elsewhere it is set every time, as before. "Changes" is
// judged against the size Blockly would really give (it clamps setScale to the workspace's own
// zoom options), so a workspace made with another range never re-scales, and scrolls, forever.
export function applyBlockScale(ws, scale, { calm = false } = {}) {
  if (!ws?.setScale) return false
  if (calm) {
    const zoom = ws.options?.zoomOptions
    const min = Number.isFinite(zoom?.minScale) ? zoom.minScale : -Infinity
    const max = Number.isFinite(zoom?.maxScale) ? zoom.maxScale : Infinity
    if (Math.abs((ws.scale ?? 0) - clampScale(scale, { min, max })) < 0.001) return false
  }
  ws.setScale(scale)
  return true
}

/**
 * Calm screen: knows when a block (or the canvas) is being dragged in ONE workspace (`root`), so
 * palette and size changes wait for the drop. Capture phase, since Blockly stops a press on the
 * palette from bubbling (a palette toggled during that drag scrolled the canvas under the finger,
 * and the block landed about 160px from where it was let go). Narrow and self-healing:
 * - only a press on Blockly's palette or canvas inside this root starts a drag (not a toolbar
 *   button, an input, a scrollbar or the stage);
 * - only that pointer's release or cancel ends it (a second finger lifting does not);
 * - it also ends, so it can never stick, when the window loses focus or is hidden, on the next
 *   primary press (the release was lost: in the stage frame, outside the window), and after
 *   `timeoutMs` with no movement of that pointer.
 * `onEnd` runs once per drag. Returns the cleanup.
 */
const BLOCKLY_DRAG_SURFACE = '.blocklyFlyout, .blocklyBlockCanvas, .blocklyDraggable, .blocklySvg'
const BLOCKLY_NOT_A_DRAG = '.blocklyScrollbarHandle, .blocklyScrollbarBackground'
export const BLOCK_DRAG_TIMEOUT_MS = 15000
export function trackBlockDrags(root, { onStart, onEnd, timeoutMs = BLOCK_DRAG_TIMEOUT_MS }) {
  if (!root) return () => {}
  let activePointer = null
  let timer = 0
  function end() {
    if (activePointer === null) return
    activePointer = null
    clearTimeout(timer)
    onEnd?.()
  }
  const armTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(end, timeoutMs)
  }
  const pointerOf = (event) => event.pointerId ?? 'pointer'
  const isDragSurface = (target) => {
    if (!target?.closest || target.closest(BLOCKLY_NOT_A_DRAG)) return false
    const surface = target.closest(BLOCKLY_DRAG_SURFACE)
    return !!surface && root.contains(surface)
  }
  const onDown = (event) => {
    if (activePointer !== null) {
      // Another finger joining the drag is not a new drag; a new primary press means the last
      // release was lost.
      if (event.isPrimary === false) return
      end()
    }
    if (!isDragSurface(event.target)) return
    activePointer = pointerOf(event)
    armTimer()
    onStart?.()
  }
  const isActivePointer = (event) => activePointer !== null && pointerOf(event) === activePointer
  const onRelease = (event) => {
    if (isActivePointer(event)) end()
  }
  const onMove = (event) => {
    if (isActivePointer(event)) armTimer()
  }
  const onHidden = () => {
    if (document.visibilityState === 'hidden') end()
  }
  root.addEventListener('pointerdown', onDown, true)
  document.addEventListener('pointerup', onRelease, true)
  document.addEventListener('pointercancel', onRelease, true)
  document.addEventListener('pointermove', onMove, true)
  document.addEventListener('visibilitychange', onHidden)
  window.addEventListener('blur', end)
  return () => {
    clearTimeout(timer)
    activePointer = null
    root.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('pointerup', onRelease, true)
    document.removeEventListener('pointercancel', onRelease, true)
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('visibilitychange', onHidden)
    window.removeEventListener('blur', end)
  }
}

/**
 * Calm screen: whether a sprite's script still gets its one placement at the left of the canvas
 * (palette closed, canvas not touched). The child's Blocks toggle stops later placements only once
 * that placement has happened: a toggle before it (the palette opened at once) used to skip it,
 * leaving the script off the left edge or far to the right after the close.
 */
export function createCalmArrival() {
  const placed = new Set()
  const settled = new Set()
  return {
    wanted: (id) => !settled.has(id),
    placed: (id) => {
      placed.add(id)
    },
    toggled: (id) => {
      if (placed.has(id)) settled.add(id)
    },
  }
}
