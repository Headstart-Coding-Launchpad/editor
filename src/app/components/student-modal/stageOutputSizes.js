// The least height (px) the Output keeps under the Stage: "Bigger picture" stops growing there.
export const OUTPUT_FLOOR = 140
// Height of the row holding the size toggle above the Stage, and the gap between the parts.
export const TOGGLE_ROW = 40
export const GAP = 8
// How much wider than the column's own width "Bigger picture" tries to make the Stage.
const BIG_SHARE = 1.6

/**
 * The Stage's side in px. Small: a square at the column's width, never shrunk by the Output.
 * Big: up to `bigWidth`, but only while the Output keeps OUTPUT_FLOOR, and never below small.
 * `used` is the height the toggle row and the Stage take.
 */
export function stageSizes({ width, height, big, bigWidth = width * BIG_SHARE }) {
  let stage = width
  if (big) {
    const room = height - TOGGLE_ROW - GAP * 2 - OUTPUT_FLOOR
    stage = Math.max(width, Math.min(bigWidth, room))
  }
  stage = Math.round(stage)
  return { stage, used: TOGGLE_ROW + GAP + stage }
}
