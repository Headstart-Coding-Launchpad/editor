// Where to draw the student "Add sprite"/"Add backdrop" library picker. Pure (no DOM), so it's
// testable without layout.
//
// The picker is portalled to document.body (an ancestor of the Add tile clips it), positioned
// from the Add tile's on-screen rect: below the tile when there's room, else above it, else on
// whichever side has more space. Its height is capped by the space on that side, so the list
// always scrolls to its last item inside the viewport (small laptops, browser zoom, tablets).
// Horizontally it lines up with the tile's left edge, clamped to the viewport.
//
// Returns fixed-position CSS: `top` when below, `bottom` when above (so a short list still
// hugs the tile), plus `left`, `width` and `maxHeight`.

export const PICKER_GAP = 4
export const PICKER_MARGIN = 8
// Prefer flipping above when less than this fits below.
export const PICKER_COMFORT_HEIGHT = 240
export const PICKER_MIN_HEIGHT = 80

export function computePickerPosition(
  anchor,
  viewport,
  { width = 220, preferredHeight = 320, gap = PICKER_GAP, margin = PICKER_MARGIN } = {}
) {
  const vw = Math.max(0, viewport?.width ?? 0)
  const vh = Math.max(0, viewport?.height ?? 0)
  const panelWidth = Math.max(0, Math.min(width, vw - margin * 2))

  // Clamp the anchor into the viewport so a half-scrolled-off tile still gets a usable list.
  const anchorTop = Math.min(Math.max(anchor.top, margin), vh - margin)
  const anchorBottom = Math.min(Math.max(anchor.bottom, margin), vh - margin)
  const spaceBelow = Math.max(0, vh - anchorBottom - gap - margin)
  const spaceAbove = Math.max(0, anchorTop - gap - margin)

  const comfort = Math.min(preferredHeight, PICKER_COMFORT_HEIGHT)
  let placement
  if (spaceBelow >= comfort) placement = 'below'
  else if (spaceAbove >= comfort) placement = 'above'
  else placement = spaceBelow >= spaceAbove ? 'below' : 'above'

  const available = placement === 'below' ? spaceBelow : spaceAbove
  const maxHeight = Math.max(Math.min(preferredHeight, available), Math.min(PICKER_MIN_HEIGHT, vh))

  const left = Math.max(margin, Math.min(anchor.left, vw - margin - panelWidth))
  const position = { placement, left, width: panelWidth, maxHeight }
  if (placement === 'below') {
    // If even the minimum height doesn't fit, pull it up so it stays on screen.
    position.top = Math.max(margin, Math.min(anchorBottom + gap, vh - margin - maxHeight))
  } else {
    position.bottom = Math.max(margin, Math.min(vh - anchorTop + gap, vh - margin - maxHeight))
  }
  return position
}
