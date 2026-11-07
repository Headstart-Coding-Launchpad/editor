// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  SCRATCH_CALM_STACK_BREAKPOINT,
  calmExplainerWidth,
  calmFoldsSpriteProps,
  calmPaletteFollowUp,
  calmStackedStageScale,
  createPaletteCategoryMemory,
  openPaletteReveal,
  paletteStartsOpen,
  placeScriptOnArrival,
  topFlyoutCategory,
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

describe('calm Scratch layout rules', () => {
  it('starts with the palette closed unless the lesson opts out', () => {
    expect(paletteStartsOpen({})).toBe(false)
    expect(paletteStartsOpen(null)).toBe(false)
    expect(paletteStartsOpen({ scratchPaletteOpen: true })).toBe(true)
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

  it('pins a stage about 300px wide in the stacked (portrait) layout', () => {
    expect(calmStackedStageScale(736) * 480).toBeGreaterThanOrEqual(290)
    expect(calmStackedStageScale(736) * 480).toBeLessThanOrEqual(320)
    expect(calmStackedStageScale(300)).toBeGreaterThanOrEqual(0.35)
  })
})
