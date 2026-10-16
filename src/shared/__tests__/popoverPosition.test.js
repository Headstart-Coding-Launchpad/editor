// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { rightAlignedPopoverShift } from '../popoverPosition.js'

describe('rightAlignedPopoverShift (HSC Audit 21: poll set-up off the left edge)', () => {
  it('leaves a popover that already fits', () => {
    expect(rightAlignedPopoverShift({ anchorRight: 900, width: 380, viewportWidth: 1024 })).toBe(0)
  })

  it('moves a popover right until its left edge clears the margin', () => {
    // A Poll button ending at x=264 with a 380px panel: left edge at -116.
    expect(rightAlignedPopoverShift({ anchorRight: 264, width: 380, viewportWidth: 1024 })).toBe(
      124
    )
  })

  it('pins a popover wider than the viewport to the left margin', () => {
    expect(rightAlignedPopoverShift({ anchorRight: 300, width: 400, viewportWidth: 390 })).toBe(108)
  })

  it('does nothing before the popover is measured', () => {
    expect(rightAlignedPopoverShift({ anchorRight: 100, width: 0, viewportWidth: 1024 })).toBe(0)
  })
})
