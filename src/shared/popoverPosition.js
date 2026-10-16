// Keeping a right-aligned popover on screen. A popover anchored to its button's right edge
// (`right: 0`) runs off the left of the screen when the button sits near the left, as the
// tutor's Poll button does once the top bar wraps on a tablet: "Launch poll" was unreachable
// (HSC Audit 21).

export const POPOVER_VIEWPORT_MARGIN = 8

/**
 * How far (px) to move a right-aligned popover to the right so it fits the viewport: 0 when it
 * already fits. `anchorRight` is the right edge of the element the popover is aligned to.
 * A popover wider than the viewport is pinned to the left margin.
 */
export function rightAlignedPopoverShift({
  anchorRight,
  width,
  viewportWidth,
  margin = POPOVER_VIEWPORT_MARGIN,
}) {
  if (!(width > 0) || !(viewportWidth > 0)) return 0
  const left = anchorRight - width
  if (left >= margin) return 0
  const shift = margin - left
  // Never push the right edge past the viewport unless the popover can't fit at all.
  const maxShift = Math.max(0, viewportWidth - margin - anchorRight)
  return width + margin * 2 > viewportWidth ? shift : Math.min(shift, maxShift)
}
