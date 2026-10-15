// Box-model maths for the HTML Inspector overlay and panel. Pure: give it an element's border
// box (getBoundingClientRect) and its margin, border and padding sizes, and it returns the four
// nested boxes and the bands between them, in the same coordinates as the rect.

export const BOX_LAYERS = Object.freeze(['margin', 'border', 'padding', 'content'])

// Colour-blind-safe (Okabe–Ito) colours, always paired with a text label.
export const BOX_COLOURS = Object.freeze({
  margin: '#E69F00',
  border: '#F0E442',
  padding: '#009E73',
  content: '#56B4E9',
})

const SIDES = ['top', 'right', 'bottom', 'left']

function px(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** { margin, border, padding } each { top, right, bottom, left } in px from a computed style. */
export function readBoxSizes(style) {
  const read = (prefix, suffix = '') =>
    Object.fromEntries(
      SIDES.map((side) => [side, px(style?.getPropertyValue?.(`${prefix}-${side}${suffix}`))])
    )
  return {
    margin: read('margin'),
    border: read('border', '-width'),
    padding: read('padding'),
  }
}

function inset(rect, sides, sign = 1) {
  const x = rect.x + sign * sides.left
  const y = rect.y + sign * sides.top
  const width = Math.max(0, rect.width - sign * (sides.left + sides.right))
  const height = Math.max(0, rect.height - sign * (sides.top + sides.bottom))
  return { x, y, width, height }
}

/**
 * The four boxes from the border box: { margin, border, padding, content } rects
 * ({ x, y, width, height }). Negative margins pull the margin box inside the border box.
 */
export function computeBoxes(borderRect, sizes) {
  const border = {
    x: borderRect.x ?? borderRect.left ?? 0,
    y: borderRect.y ?? borderRect.top ?? 0,
    width: Math.max(0, borderRect.width ?? 0),
    height: Math.max(0, borderRect.height ?? 0),
  }
  const margin = inset(border, sizes.margin, -1)
  const padding = inset(border, sizes.border)
  const content = inset(padding, sizes.padding)
  return { margin, border, padding, content }
}

/**
 * The bands to paint for each layer: the ring between a box and the next one in, as up to four
 * rects (top, right, bottom, left), plus the content box itself. Zero-size pieces are dropped.
 * Returns [{ layer, rects: [{ x, y, width, height }], sizes }].
 */
export function computeBoxBands(borderRect, sizes) {
  const boxes = computeBoxes(borderRect, sizes)
  const ring = (outer, inner) =>
    [
      { x: outer.x, y: outer.y, width: outer.width, height: inner.y - outer.y },
      {
        x: inner.x + inner.width,
        y: inner.y,
        width: outer.x + outer.width - (inner.x + inner.width),
        height: inner.height,
      },
      {
        x: outer.x,
        y: inner.y + inner.height,
        width: outer.width,
        height: outer.y + outer.height - (inner.y + inner.height),
      },
      { x: outer.x, y: inner.y, width: inner.x - outer.x, height: inner.height },
    ].filter((rect) => rect.width > 0 && rect.height > 0)
  return [
    { layer: 'margin', rects: ring(boxes.margin, boxes.border), sizes: sizes.margin },
    { layer: 'border', rects: ring(boxes.border, boxes.padding), sizes: sizes.border },
    { layer: 'padding', rects: ring(boxes.padding, boxes.content), sizes: sizes.padding },
    {
      layer: 'content',
      rects: boxes.content.width > 0 || boxes.content.height > 0 ? [boxes.content] : [],
      sizes: null,
    },
  ]
}

/** "16" / "8.5" — a px size as the bands and the diagram label it (no unit, rounded to 0.5). */
export function formatPx(value) {
  const rounded = Math.round((Number(value) || 0) * 2) / 2
  return String(rounded)
}

/** "16 8 16 8" — four sides as one label, or one number when they're all the same. */
export function formatSides(sides) {
  if (!sides) return ''
  const values = SIDES.map((side) => formatPx(sides[side]))
  return values.every((value) => value === values[0]) ? values[0] : values.join(' ')
}
