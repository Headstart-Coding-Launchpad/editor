// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  SCRATCH_CALM_STACK_BREAKPOINT,
  calmExplainerWidth,
  calmFoldsSpriteProps,
  calmPaletteFollowUp,
  calmStackedStageScale,
  createCalmDragEndStep,
  createPaletteCategoryMemory,
  openPaletteReveal,
  paletteStartsOpen,
  placeScriptOnArrival,
  topFlyoutCategory,
  CALM_BLOCK_SCALE,
  applyBlockScale,
  calmStackedGridStyle,
  calmStackedLayout,
  blockScaleRange,
  blocklyZoomOptions,
  createCalmArrival,
  trackBlockDrags,
} from '../calm/calmPalette.js'

// A Blockly-like workspace whose blocks really move when it scrolls: a block placed at
// workspace x sits at screen left = divLeft + x + (scrollX - startScrollX). The palette (flyout)
// covers screen 0..350, as it does at 1366 (349px of a 483px blocks pane).
function fakeWorkspace(blockXs, { flyoutWidth = 350 } = {}) {
  const div = document.createElement('div')
  const flyoutEl = document.createElement('div')
  flyoutEl.className = 'blocklyFlyout'
  flyoutEl.getBoundingClientRect = () => ({ left: 0, right: flyoutWidth, width: flyoutWidth })
  div.appendChild(flyoutEl)
  const startScrollX = 0
  const ws = {
    scrollX: startScrollX,
    scrollY: 0,
    scroll(x, y) {
      this.scrollX = x
      this.scrollY = y
    },
    getTopBlocks() {
      return blockXs.map((x) => ({
        getSvgRoot: () => ({
          getBoundingClientRect: () => {
            const left = x + (ws.scrollX - startScrollX)
            return { left, right: left + 180, width: 180 }
          },
        }),
      }))
    },
  }
  const lefts = () => ws.getTopBlocks().map((b) => b.getSvgRoot().getBoundingClientRect().left)
  return { ws, div, flyoutEl, lefts, flyoutRight: flyoutWidth }
}

describe('Fun moment: opening the Blocks palette never hides the child’s script', () => {
  it('a block placed at x = -150 ends right of the palette after the palette opens', () => {
    const { ws, div, lefts, flyoutRight } = fakeWorkspace([-150, 60])
    expect(openPaletteReveal(ws, div)).toBe('revealed')
    for (const left of lefts()) expect(left).toBeGreaterThan(flyoutRight)
  })

  it('a script the child panned far left (under the palette) is scrolled clear too', () => {
    const { ws, div, lefts, flyoutRight } = fakeWorkspace([-620, -480])
    expect(openPaletteReveal(ws, div)).toBe('revealed')
    expect(Math.min(...lefts())).toBeGreaterThan(flyoutRight)
  })

  it('reveals on every open, also after the child has already pressed the canvas', () => {
    const { ws, div, lefts, flyoutRight } = fakeWorkspace([-150])
    openPaletteReveal(ws, div)
    // The child drags the script back under the palette, closes and opens it again.
    ws.scroll(ws.scrollX - 400, 0)
    expect(Math.min(...lefts())).toBeLessThan(flyoutRight)
    expect(openPaletteReveal(ws, div)).toBe('revealed')
    expect(Math.min(...lefts())).toBeGreaterThan(flyoutRight)
  })

  it('measures the palette, not the hidden trashcan flyout Blockly puts before it', () => {
    const { ws, div, flyoutEl, lefts, flyoutRight } = fakeWorkspace([-150])
    const trash = document.createElement('div')
    trash.className = 'blocklyFlyout'
    trash.style.display = 'none'
    trash.getBoundingClientRect = () => ({ left: 0, right: 0, width: 0 })
    div.insertBefore(trash, flyoutEl)
    expect(openPaletteReveal(ws, div)).toBe('revealed')
    expect(Math.min(...lefts())).toBeGreaterThan(flyoutRight)
  })

  it('leaves a script that is already clear exactly where it is', () => {
    const { ws, div, lefts } = fakeWorkspace([420])
    expect(openPaletteReveal(ws, div)).toBe('clear')
    expect(lefts()).toEqual([420])
  })

  it('never scrolls while a block is being dragged (the block would jump from the finger)', () => {
    const { ws, div, lefts } = fakeWorkspace([-150])
    expect(openPaletteReveal(ws, div, { dragging: true })).toBe('deferred')
    expect(lefts()).toEqual([-150])
  })

  it('does nothing while the palette is still hidden', () => {
    const { ws, div, flyoutEl, lefts } = fakeWorkspace([-150])
    flyoutEl.style.display = 'none'
    expect(openPaletteReveal(ws, div)).toBe('clear')
    expect(lefts()).toEqual([-150])
  })

  it('on arrival with the palette closed, places the script at the left of the canvas (either way)', () => {
    for (const startX of [-207, 366]) {
      const { ws, div, flyoutEl, lefts } = fakeWorkspace([startX])
      flyoutEl.style.display = 'none'
      div.getBoundingClientRect = () => ({ left: 0, right: 500, width: 500 })
      expect(placeScriptOnArrival(ws, div)).toBe(true)
      expect(lefts()).toEqual([16])
    }
    // Already near the left: left alone.
    const near = fakeWorkspace([40])
    near.flyoutEl.style.display = 'none'
    near.div.getBoundingClientRect = () => ({ left: 0, right: 500, width: 500 })
    expect(placeScriptOnArrival(near.ws, near.div)).toBe(false)
    expect(near.lefts()).toEqual([40])
  })
})

describe('Fun moment: the script stays still when the palette opens or closes', () => {
  // Blockly's setScale scrolls the canvas even when the scale is unchanged (it re-centres the
  // view), which is what moved the script about 105px on every palette toggle at 1366.
  function blocklyLike(blockXs, scale) {
    const fake = fakeWorkspace(blockXs)
    fake.ws.scale = scale
    fake.ws.setScale = vi.fn(function (next) {
      this.scale = next
      this.scroll(this.scrollX - 105, this.scrollY)
    })
    return fake
  }

  it('re-applying the same block size after a toggle leaves the script where it was', () => {
    const { ws, lefts } = blocklyLike([715], CALM_BLOCK_SCALE.max)
    applyBlockScale(ws, CALM_BLOCK_SCALE.max, { calm: true })
    expect(ws.setScale).not.toHaveBeenCalled()
    expect(lefts()).toEqual([715])
  })

  it('a real size change (the window resized) still re-scales', () => {
    const { ws } = blocklyLike([715], CALM_BLOCK_SCALE.max)
    applyBlockScale(ws, CALM_BLOCK_SCALE.min, { calm: true })
    expect(ws.setScale).toHaveBeenCalledWith(CALM_BLOCK_SCALE.min)
  })

  it('outside the calm screen the old always-re-scale path is unchanged', () => {
    const { ws } = blocklyLike([715], 0.75)
    applyBlockScale(ws, 0.75)
    expect(ws.setScale).toHaveBeenCalledWith(0.75)
  })
})

// A press like the browser's: pointerId and isPrimary (jsdom has no PointerEvent).
function press(type, target, { pointerId = 1, isPrimary = true } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  Object.defineProperty(event, 'isPrimary', { value: isPrimary })
  target.dispatchEvent(event)
}
// A workspace root as Blockly builds it: the palette and canvas inside a .blocklySvg, a toolbar
// button beside it, a scrollbar, and the stage.
function blocklyRoot() {
  const root = document.createElement('div')
  root.innerHTML = `
    <button data-id="toolbar">Blocks</button>
    <input data-id="input" />
    <canvas data-id="stage"></canvas>
    <svg class="blocklySvg">
      <g class="blocklyFlyout"><g class="blocklyDraggable"><rect data-id="palette-block" /></g></g>
      <g class="blocklyBlockCanvas"><g class="blocklyDraggable"><rect data-id="script-block" /></g></g>
      <g class="blocklyScrollbarHandle"><rect data-id="scrollbar" /></g>
    </svg>`
  document.body.appendChild(root)
  const at = (id) => root.querySelector(`[data-id="${id}"]`)
  return { root, at }
}

describe('Fun moment: a block dragged out of the palette lands where the child lets go', () => {
  function tracked(options = {}) {
    const { root, at } = blocklyRoot()
    const onStart = vi.fn()
    const onEnd = vi.fn()
    const stop = trackBlockDrags(root, { onStart, onEnd, ...options })
    const done = () => {
      stop()
      root.remove()
    }
    return { root, at, onStart, onEnd, stop, done }
  }

  it('sees the press even when Blockly stops it bubbling up from the palette', () => {
    const t = tracked()
    t.at('palette-block').addEventListener('pointerdown', (event) => event.stopPropagation())
    press('pointerdown', t.at('palette-block'))
    expect(t.onStart).toHaveBeenCalledTimes(1)
    press('pointerup', document)
    expect(t.onEnd).toHaveBeenCalledTimes(1)
    t.stop()
    press('pointerdown', t.at('palette-block'))
    expect(t.onStart).toHaveBeenCalledTimes(1)
    t.done()
  })

  it('a tap on a toolbar button, an input, the stage or a scrollbar is not a drag', () => {
    const t = tracked()
    for (const id of ['toolbar', 'input', 'stage', 'scrollbar']) {
      press('pointerdown', t.at(id))
      press('pointerup', document)
    }
    expect(t.onStart).not.toHaveBeenCalled()
    expect(t.onEnd).not.toHaveBeenCalled()
    t.done()
  })

  it('a second finger lifting, or a release that began elsewhere, does not end the drag', () => {
    const t = tracked()
    press('pointerdown', t.at('script-block'), { pointerId: 7 })
    press('pointerdown', t.at('script-block'), { pointerId: 8, isPrimary: false })
    press('pointerup', document, { pointerId: 8, isPrimary: false })
    press('pointerup', document, { pointerId: 3 })
    expect(t.onEnd).not.toHaveBeenCalled()
    press('pointercancel', document, { pointerId: 7 })
    expect(t.onEnd).toHaveBeenCalledTimes(1)
    t.done()
  })

  it('a release that never arrives (in the stage frame, outside the window) never sticks', () => {
    vi.useFakeTimers()
    try {
      const t = tracked({ timeoutMs: 15000 })
      // The window loses focus.
      press('pointerdown', t.at('script-block'))
      window.dispatchEvent(new Event('blur'))
      expect(t.onEnd).toHaveBeenCalledTimes(1)
      // The next primary press ends a drag whose release was lost.
      press('pointerdown', t.at('palette-block'))
      press('pointerdown', t.at('toolbar'), { pointerId: 2 })
      expect(t.onEnd).toHaveBeenCalledTimes(2)
      // Nothing at all: the timeout, counted from the last movement of that pointer.
      press('pointerdown', t.at('palette-block'))
      vi.advanceTimersByTime(10000)
      press('pointermove', document)
      vi.advanceTimersByTime(10000)
      expect(t.onEnd).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(5001)
      expect(t.onEnd).toHaveBeenCalledTimes(3)
      // A hidden page ends it too, and only once.
      press('pointerdown', t.at('script-block'))
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      delete document.visibilityState
      press('pointerup', document)
      expect(t.onEnd).toHaveBeenCalledTimes(4)
      t.done()
    } finally {
      vi.useRealTimers()
    }
  })

  it('two workspaces on one page (Builder preview, teacher live view) never take each other’s drags', () => {
    const a = tracked()
    const b = tracked()
    press('pointerdown', a.at('script-block'))
    expect(a.onStart).toHaveBeenCalledTimes(1)
    expect(b.onStart).not.toHaveBeenCalled()
    press('pointerup', document)
    expect(a.onEnd).toHaveBeenCalledTimes(1)
    expect(b.onEnd).not.toHaveBeenCalled()
    a.done()
    b.done()
  })
})

describe('the script’s one placement on arrival (calm screen)', () => {
  it('a Blocks toggle before the placement does not skip it; after it, it ends placements', () => {
    const arrival = createCalmArrival()
    arrival.toggled('cat')
    expect(arrival.wanted('cat')).toBe(true)
    arrival.placed('cat')
    expect(arrival.wanted('cat')).toBe(true)
    arrival.toggled('cat')
    expect(arrival.wanted('cat')).toBe(false)
    expect(arrival.wanted('dog')).toBe(true)
  })
})

describe('block size on the calm screen', () => {
  it('is 65% at most and never below 60%; 75% to 60% elsewhere; one helper picks it', () => {
    expect(CALM_BLOCK_SCALE).toEqual({ min: 0.6, max: 0.65 })
    expect(blockScaleRange(true)).toBe(CALM_BLOCK_SCALE)
    expect(blockScaleRange(false)).toEqual({ min: 0.6, max: 0.75 })
  })

  it('Blockly’s zoom options come from the same range as the size', () => {
    expect(blocklyZoomOptions(true, 0.62)).toMatchObject({
      startScale: 0.62,
      minScale: 0.6,
      maxScale: 0.65,
    })
    expect(blocklyZoomOptions(false, 0.55).startScale).toBe(0.6)
    expect(blocklyZoomOptions(true, 0.55).startScale).toBe(0.6)
    expect(blocklyZoomOptions(true, 0.75).startScale).toBe(0.65)
  })

  it('calm turned on or off after the workspace was made never re-scales (and scrolls) every toggle', () => {
    // Made outside calm (floor 0.6); calm then asks for its own floor, 0.6, once.
    const setScale = vi.fn(function (next) {
      this.scale = Math.min(0.75, Math.max(0.6, next))
    })
    const ws = { scale: 0.75, setScale, options: { zoomOptions: blocklyZoomOptions(false, 0.75) } }
    expect(applyBlockScale(ws, 0.6, { calm: true })).toBe(true)
    expect(ws.scale).toBe(0.6)
    for (let i = 0; i < 3; i++) expect(applyBlockScale(ws, 0.6, { calm: true })).toBe(false)
    expect(setScale).toHaveBeenCalledTimes(1)
    // Made on the calm screen (ceiling 0.65); calm off asks for 0.75.
    const calmWs = {
      scale: 0.65,
      setScale: vi.fn(),
      options: { zoomOptions: blocklyZoomOptions(true, 0.65) },
    }
    expect(applyBlockScale(calmWs, 0.75, { calm: true })).toBe(false)
  })
})

describe('the palette remembers the last category for this session only', () => {
  function flyoutWith(labels, viewTop) {
    return {
      getFlyout: () => ({
        isVisible: () => true,
        getWorkspace: () => ({
          scale: 1,
          getMetricsManager: () => ({ getViewMetrics: () => ({ top: viewTop, height: 400 }) }),
        }),
        getContents: () =>
          labels.map(([name, y]) => ({
            getElement: () => ({
              isLabel: () => true,
              getButtonText: () => name,
              getPosition: () => ({ y }),
            }),
          })),
      }),
    }
  }

  it('reads the category heading at the top of the palette', () => {
    const ws = flyoutWith(
      [
        ['Events', 0],
        ['Motion', 600],
        ['Looks', 1200],
      ],
      640
    )
    expect(topFlyoutCategory(ws)).toBe('Motion')
    expect(topFlyoutCategory(null)).toBeNull()
  })

  it('keeps it in memory, not in localStorage', () => {
    const before = localStorage.length
    const memory = createPaletteCategoryMemory()
    memory.remember('Looks')
    expect(memory.get()).toBe('Looks')
    memory.remember(null)
    expect(memory.get()).toBe('Looks')
    expect(localStorage.length).toBe(before)
  })

  it('holds one memory per student view: two memories never share a category', () => {
    const first = createPaletteCategoryMemory()
    const second = createPaletteCategoryMemory()
    first.remember('Sound')
    expect(second.get()).toBeNull()
    second.remember('Motion')
    expect(first.get()).toBe('Sound')
  })
})

describe('after the palette opens or closes (calm screen)', () => {
  it('runs the open reveal or the close fixups straight away when nothing is being dragged', () => {
    expect(calmPaletteFollowUp({ open: true, dragging: false })).toEqual({
      now: 'reveal',
      onDragEnd: null,
    })
    expect(calmPaletteFollowUp({ open: false, dragging: false })).toEqual({
      now: 'sync',
      onDragEnd: null,
    })
  })

  it('during a drag runs nothing now and the same step on drag end, for a close as for an open', () => {
    expect(calmPaletteFollowUp({ open: true, dragging: true })).toEqual({
      now: null,
      onDragEnd: 'reveal',
    })
    expect(calmPaletteFollowUp({ open: false, dragging: true })).toEqual({
      now: null,
      onDragEnd: 'sync',
    })
  })
})

describe('the palette step on drag end (calm screen)', () => {
  it('runs nothing when the palette was not toggled during the drag', () => {
    const pending = createCalmDragEndStep()
    expect(pending.take({ open: true })).toBeNull()
  })

  it('closed then opened during one drag: the reveal for the open palette it ends on', () => {
    const pending = createCalmDragEndStep()
    pending.note()
    pending.note()
    expect(pending.take({ open: true })).toBe('reveal')
    expect(pending.take({ open: true })).toBeNull()
  })

  it('opened then closed during one drag: the close fixups for the closed palette it ends on', () => {
    const pending = createCalmDragEndStep()
    pending.note()
    pending.note()
    expect(pending.take({ open: false })).toBe('sync')
    expect(pending.take({ open: false })).toBeNull()
  })
})

describe('calm Scratch layout rules', () => {
  it('starts with the palette open (as before the calm screen) unless the lesson opts into closed', () => {
    expect(paletteStartsOpen({})).toBe(true)
    expect(paletteStartsOpen(null)).toBe(true)
    expect(paletteStartsOpen({ scratchPaletteClosed: false })).toBe(true)
    expect(paletteStartsOpen({ scratchPaletteClosed: true })).toBe(false)
    // The old opt-out name (never on main) means nothing now.
    expect(paletteStartsOpen({ scratchPaletteOpen: false })).toBe(true)
  })

  it('folds the sprite property row behind More unless a check reads sprite properties', () => {
    expect(calmFoldsSpriteProps({ check: { type: 'block_used', opcode: 'looks_say' } })).toBe(true)
    expect(calmFoldsSpriteProps({})).toBe(true)
    expect(calmFoldsSpriteProps({ check: [{ type: 'sprite_property', property: 'x' }] })).toBe(
      false
    )
    expect(
      calmFoldsSpriteProps({ check: { type: 'all', checks: [{ type: 'sprite_property_delta' }] } })
    ).toBe(false)
  })

  it.each([
    [
      'feedbackChecks',
      { feedbackChecks: [{ mode: 'nudge', type: 'sprite_property', property: 'x' }] },
    ],
    ['incorrectChecks', { incorrectChecks: { type: 'sprite_property_changed', property: 'y' } }],
    ['a checks list', { checks: [{ type: 'sprite_property', property: 'size' }] }],
    ['a manual check', { manualCheck: { type: 'sprite_property', property: 'direction' } }],
    ['a stage check', { codeStages: [{ role: 'support', check: { type: 'sprite_property' } }] }],
  ])('keeps the sprite property row out when %s reads sprite properties', (_, task) => {
    expect(calmFoldsSpriteProps({ check: { type: 'block_used' }, ...task })).toBe(false)
  })

  it('stacks the stage above the blocks only on a portrait-narrow task panel', () => {
    expect(SCRATCH_CALM_STACK_BREAKPOINT).toBeGreaterThan(736)
    expect(SCRATCH_CALM_STACK_BREAKPOINT).toBeLessThan(992)
  })

  it('gives the explainer card 220-320px beside the blocks', () => {
    expect(calmExplainerWidth(1334)).toBe(320)
    expect(calmExplainerWidth(992)).toBeGreaterThanOrEqual(220)
    expect(calmExplainerWidth(992)).toBeLessThan(260)
    expect(calmExplainerWidth(500)).toBe(220)
  })

  it('caps the explainer beside the pinned stage and keeps the Blocks pane at least 360px tall', () => {
    // 768x1024 portrait tablet: the workspace is about 820px tall and 736px wide.
    const layout = calmStackedLayout(820, { width: 736 })
    expect(layout.asideMaxHeight).toBe(Math.round(820 * 0.35))
    expect(layout.blocksMinHeight).toBe(360)
    expect(calmStackedGridStyle(layout, { aside: true }).gridTemplateRows).toBe(
      'auto minmax(360px, 1fr)'
    )
    // Never below 140px for the card. Not measured yet: no cap, no minimum.
    expect(calmStackedLayout(300, { width: 736 }).asideMaxHeight).toBe(140)
    expect(calmStackedLayout(0)).toEqual({ asideMaxHeight: null, blocksMinHeight: 0 })
    expect(calmStackedGridStyle(layout, { aside: false }).gridTemplateAreas).toBe(
      '"stage" "blocks"'
    )
  })

  it.each([500, 600, 768, 1024])(
    'at %ipx tall the stage row, the gap and the Blocks minimum fit the workspace',
    (height) => {
      const width = 736
      const { asideMaxHeight, blocksMinHeight } = calmStackedLayout(height, { width })
      const stageRow = Math.round(360 * calmStackedStageScale(width)) + 52
      const topRow = Math.max(stageRow, asideMaxHeight)
      expect(topRow + 10 + blocksMinHeight).toBeLessThanOrEqual(height)
      expect(blocksMinHeight).toBeGreaterThanOrEqual(120)
      expect(blocksMinHeight).toBeLessThanOrEqual(360)
    }
  )

  it('keeps a 120px floor for the blocks when nothing fits', () => {
    expect(calmStackedLayout(300, { width: 736 }).blocksMinHeight).toBe(120)
  })

  it('pins a stage about 300px wide in the stacked (portrait) layout', () => {
    expect(calmStackedStageScale(736) * 480).toBeGreaterThanOrEqual(290)
    expect(calmStackedStageScale(736) * 480).toBeLessThanOrEqual(320)
    expect(calmStackedStageScale(300)).toBeGreaterThanOrEqual(0.35)
  })
})
