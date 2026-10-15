// Geometry for the Python Stage's filled shapes (rect, square, circle, polygon), shared by the
// canvas renderer, the SVG export and the rasteriser so all three draw a shape the same way.
// Pure and Node-safe.
//
// Every filled shape is anchored at its centre (x, y) and turned `angle` degrees CLOCKWISE
// around it (the screen convention: y goes down, as in CSS; unlike Turtle's left()). A shape's
// "local" coordinates are relative to its centre before the turn.

export const FILLED_SHAPES = Object.freeze(['rect', 'square', 'circle', 'polygon'])

// Outline width when `outline=` is given without `width=`.
export const DEFAULT_OUTLINE_WIDTH = 2

const DEG = Math.PI / 180

export function isFilledShape(command) {
  return FILLED_SHAPES.includes(command?.type)
}

// The command's turn in degrees (0 when it has none).
export function angleOf(command) {
  const angle = Number(command?.angle)
  return Number.isFinite(angle) ? angle : 0
}

// The command's opacity, 0 to 1 (1 when it has none).
export function opacityOf(command) {
  const opacity = Number(command?.opacity)
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1
}

// The fill colour ('#rrggbb'), or null for an outline-only shape.
export function fillOf(command) {
  return typeof command?.colour === 'string' && command.colour ? command.colour : null
}

// The outline colour, or null.
export function outlineOf(command) {
  return typeof command?.outline === 'string' && command.outline ? command.outline : null
}

// The outline width in stage pixels (0 without an outline).
export function outlineWidthOf(command) {
  if (!outlineOf(command)) return 0
  const width = Number(command.width)
  return Number.isFinite(width) && width > 0 ? width : DEFAULT_OUTLINE_WIDTH
}

/**
 * A rect, square or polygon's corners in local coordinates ([[x, y], …], clockwise on screen),
 * or null for a circle. A polygon has `sides` corners `size` from its centre, the first pointing
 * straight up.
 */
export function shapeCorners(command) {
  switch (command?.type) {
    case 'rect':
    case 'square': {
      const w = Math.max(0, Number(command.type === 'square' ? command.size : command.w) || 0)
      const h = Math.max(0, Number(command.type === 'square' ? command.size : command.h) || 0)
      return [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ]
    }
    case 'polygon': {
      const sides = Math.max(3, Math.round(Number(command.sides) || 3))
      const size = Math.max(0, Number(command.size) || 0)
      return Array.from({ length: sides }, (_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / sides
        return [size * Math.cos(a), size * Math.sin(a)]
      })
    }
    default:
      return null
  }
}

// A local point turned by `angle` degrees clockwise and moved to the centre (x, y).
export function toStage(command, [lx, ly]) {
  const a = angleOf(command) * DEG
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return [command.x + lx * cos - ly * sin, command.y + lx * sin + ly * cos]
}

// How far the shape reaches from its centre (any angle), not counting the outline.
export function shapeReach(command) {
  if (command?.type === 'circle') return Math.max(0, Number(command.r) || 0)
  const corners = shapeCorners(command)
  if (!corners) return 0
  return Math.max(0, ...corners.map(([x, y]) => Math.hypot(x, y)))
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export const HIT_FILL = 1
export const HIT_EDGE = 2

/**
 * A hit test for one filled shape: `(px, py) => mask`, where mask has HIT_FILL when the stage
 * point is inside the shape and HIT_EDGE when it lies on the outline band (half the outline
 * width either side of the edge, at least `minHalf`, so a thin outline still shows on a coarse
 * grid). The fill and the edge are reported whether or not the shape has a fill or an outline;
 * the caller paints what the shape has. Rectangles are half-open ([left, right) × [top,
 * bottom)), like the stage's pixels.
 */
export function shapeHitTest(command, { minHalf = 0 } = {}) {
  const a = angleOf(command) * DEG
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const cx = Number(command.x) || 0
  const cy = Number(command.y) || 0
  const half = Math.max(outlineWidthOf(command) / 2, minHalf)
  const local = (px, py) => {
    const dx = px - cx
    const dy = py - cy
    return [dx * cos + dy * sin, -dx * sin + dy * cos]
  }
  if (command.type === 'circle') {
    const r = Math.max(0, Number(command.r) || 0)
    return (px, py) => {
      const d = Math.hypot(px - cx, py - cy)
      return (d <= r ? HIT_FILL : 0) | (Math.abs(d - r) <= half ? HIT_EDGE : 0)
    }
  }
  const corners = shapeCorners(command) ?? []
  const boxed = command.type === 'rect' || command.type === 'square'
  const [hw, hh] = boxed ? [corners[1][0], corners[2][1]] : [0, 0]
  return (px, py) => {
    const [lx, ly] = local(px, py)
    let inside
    if (boxed) {
      inside = lx >= -hw && lx < hw && ly >= -hh && ly < hh
    } else {
      inside = false
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const [xi, yi] = corners[i]
        const [xj, yj] = corners[j]
        if (yi > ly !== yj > ly && lx < ((xj - xi) * (ly - yi)) / (yj - yi) + xi) inside = !inside
      }
    }
    let edge = false
    if (half > 0) {
      for (let i = 0, j = corners.length - 1; i < corners.length && !edge; j = i++) {
        edge =
          distanceToSegment(lx, ly, corners[j][0], corners[j][1], corners[i][0], corners[i][1]) <=
          half
      }
    }
    return (inside ? HIT_FILL : 0) | (edge ? HIT_EDGE : 0)
  }
}
