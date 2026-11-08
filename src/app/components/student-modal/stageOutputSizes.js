// The least height (px) the Output keeps under the Stage, whichever size the Stage is.
export const OUTPUT_FLOOR = 140
// Height of the row holding the size toggle above the Stage, and the gap between the parts.
export const TOGGLE_ROW = 40
export const GAP = 8
// The smallest Stage side (px): on a very short modal the Stage stays at least this big.
export const MIN_STAGE = 160
// The least width (px) the code column keeps when "Bigger picture" widens the right column.
export const CODE_MIN = 320
// How much wider than its own width "Bigger picture" tries to make the column.
const BIG_SHARE = 1.6
// The column's own width while small: the same rule as its CSS `clamp(300px, 26vw, 460px)`.
const SMALL_MIN = 300
const SMALL_MAX = 460
const SMALL_VW = 0.26

/**
 * The Stage's side in px, always a square. Small: the column's width, unless the column is too
 * short, then smaller so the Output keeps OUTPUT_FLOOR (never below MIN_STAGE). Big: up to
 * `bigWidth`, while the Output keeps OUTPUT_FLOOR, and never below the small side.
 * `after` is the height the panel under the Output (the name tags) wants, its gap included;
 * the Stage shrinks for it too. `afterMax` is the most that panel may take (its gap included)
 * so the Output still keeps its floor once the Stage is at MIN_STAGE; past it the panel
 * scrolls. Null when there is no panel. `used` is the height the toggle row and the Stage take.
 */
export function stageSizes({ width, height, big, bigWidth = width * BIG_SHARE, after = 0 }) {
  const room = height - TOGGLE_ROW - GAP * 2 - OUTPUT_FLOOR - after
  let stage = Math.min(width, Math.max(MIN_STAGE, Math.min(width, room)))
  if (big) stage = Math.max(stage, Math.min(bigWidth, room))
  stage = Math.round(stage)
  const used = TOGGLE_ROW + GAP + stage
  const afterMax = after > 0 ? Math.max(0, height - used - GAP - OUTPUT_FLOOR) : null
  return { stage, used, afterMax }
}

/**
 * The right column's widths in px, from the room the row has for the code and this column
 * together (`free`), worked out afresh on every render. Small is the CSS clamp; big grows by
 * BIG_SHARE but leaves the code CODE_MIN, and is the small width when there is no room.
 */
export function columnWidths({ free, viewportWidth }) {
  const small = Math.round(Math.min(SMALL_MAX, Math.max(SMALL_MIN, viewportWidth * SMALL_VW)))
  const big = Math.round(Math.min(small * BIG_SHARE, free - CODE_MIN))
  return { small, big: big > small ? big : small }
}
