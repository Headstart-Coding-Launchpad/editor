import { describe, expect, it } from 'vitest'
import { withClosedPaletteScrollArea } from '../calm/calmPalette.js'

// Blockly's MetricsManager scroll area, as in blockly 12 (getPaddedContent_ + getScrollMetrics): the
// content padded by half a view. The view starts after the palette (absolute left = its width).
class FakeMetricsManager {
  constructor(workspace) {
    this.workspace_ = workspace
  }
  getAbsoluteMetrics() {
    return { left: this.workspace_.paletteWidth, top: 0 }
  }
  getViewMetrics() {
    return { left: 0, top: 0, width: this.workspace_.viewWidth, height: 300 }
  }
  getContentMetrics() {
    return this.workspace_.content
  }
  getScrollMetrics(scaled, view, content) {
    const v = view || this.getViewMetrics(false)
    const c = content || this.getContentMetrics()
    const right = c.left + c.width
    const left = Math.min(c.left - v.width / 2, right - v.width)
    return { left, width: Math.max(right + v.width / 2, c.left + v.width) - left }
  }
}

function workspace({ open, contentLeft }) {
  return {
    paletteWidth: 306,
    viewWidth: 451,
    content: { left: contentLeft, width: 132 },
    getFlyout: () => ({ isVisible: () => open }),
  }
}
const viewFits = (m) => {
  const scroll = m.getScrollMetrics()
  const { width } = m.getViewMetrics()
  return scroll.left <= 0 && scroll.left + scroll.width >= width
}

describe('withClosedPaletteScrollArea', () => {
  const Manager = withClosedPaletteScrollArea(FakeMetricsManager)

  it('keeps the view in range when a block is dropped in the strip the closed palette left', () => {
    // block dropped 248px left of the view: Blockly would scroll the view to follow it
    const closed = new Manager(workspace({ open: false, contentLeft: -248 }))
    expect(viewFits(closed)).toBe(true)
    expect(viewFits(new FakeMetricsManager(workspace({ open: false, contentLeft: -248 })))).toBe(
      false
    )
  })

  it('leaves an open palette as Blockly has it', () => {
    const open = workspace({ open: true, contentLeft: -248 })
    expect(new Manager(open).getScrollMetrics()).toEqual(
      new FakeMetricsManager(open).getScrollMetrics()
    )
  })

  it('passes an explicit view and content through, widened by the palette strip', () => {
    const m = new Manager(workspace({ open: false, contentLeft: 0 }))
    const wide = new FakeMetricsManager(
      workspace({ open: false, contentLeft: 0 })
    ).getScrollMetrics(false, { left: 0, top: 0, width: 757, height: 300 }, { left: 10, width: 50 })
    expect(
      m.getScrollMetrics(
        false,
        { left: 0, top: 0, width: 451, height: 300 },
        { left: 10, width: 50 }
      )
    ).toEqual(wide)
  })
})
