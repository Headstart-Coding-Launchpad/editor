// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computePickerPosition, PICKER_MARGIN } from '../pickerPosition.js'

const rect = (left, top, width = 70, height = 82) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

function bottomEdge(pos, vh) {
  return pos.top != null ? pos.top + pos.maxHeight : vh - pos.bottom
}
function topEdge(pos, vh) {
  return pos.top != null ? pos.top : vh - pos.bottom - pos.maxHeight
}

describe('computePickerPosition', () => {
  it('opens below the tile when there is room', () => {
    const pos = computePickerPosition(rect(100, 100), { width: 1366, height: 768 })
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(100 + 82 + 4)
    expect(pos.left).toBe(100)
    expect(pos.maxHeight).toBe(320)
  })

  it('flips above a tile near the bottom of a 1366x768 screen', () => {
    const vh = 768
    const pos = computePickerPosition(rect(40, 640), { width: 1366, height: vh })
    expect(pos.placement).toBe('above')
    expect(pos.bottom).toBe(vh - 640 + 4)
    expect(topEdge(pos, vh)).toBeGreaterThanOrEqual(PICKER_MARGIN)
  })

  it('at 150% zoom (911x512 CSS px) the whole list stays on screen', () => {
    const vw = 911
    const vh = 512
    for (const top of [20, 200, 300, 420]) {
      const pos = computePickerPosition(rect(860, top), { width: vw, height: vh })
      expect(topEdge(pos, vh)).toBeGreaterThanOrEqual(PICKER_MARGIN - 0.001)
      expect(bottomEdge(pos, vh)).toBeLessThanOrEqual(vh - PICKER_MARGIN + 0.001)
      expect(pos.left + pos.width).toBeLessThanOrEqual(vw - PICKER_MARGIN)
    }
  })

  it('caps the height to the space on the chosen side', () => {
    const vh = 400
    const pos = computePickerPosition(rect(10, 150, 70, 82), { width: 800, height: vh })
    expect(pos.maxHeight).toBeLessThanOrEqual(Math.max(vh - 232 - 4 - 8, 150 - 4 - 8))
    expect(bottomEdge(pos, vh)).toBeLessThanOrEqual(vh - PICKER_MARGIN)
  })

  it('shrinks the width on a narrow phone', () => {
    const pos = computePickerPosition(rect(10, 10), { width: 200, height: 700 })
    expect(pos.width).toBe(200 - PICKER_MARGIN * 2)
    expect(pos.left).toBe(PICKER_MARGIN)
  })

  it('keeps a usable list when the tile is scrolled off-screen', () => {
    const vh = 600
    const pos = computePickerPosition(rect(10, 900), { width: 800, height: vh })
    expect(pos.maxHeight).toBeGreaterThan(0)
    expect(bottomEdge(pos, vh)).toBeLessThanOrEqual(vh - PICKER_MARGIN)
    expect(topEdge(pos, vh)).toBeGreaterThanOrEqual(PICKER_MARGIN)
  })
})
