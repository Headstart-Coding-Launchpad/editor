// Pure-JS rasteriser for the Python Stage (no canvas: jsdom tests and the Node CLI have none).
// Shapes are sampled at cell centres onto a square grid (100 × 100 by default, so one cell is
// 4 × 4 stage pixels), as drawn: turned shapes and polygons by their real outline
// (./geometry.js), outlines on top of fills, and see-through shapes (opacity) blended with what
// is under them. Text and emoji are NOT rasterised: they are compared by command (the
// same words or emoji at about the same place), since font rendering differs between devices.
import { STAGE_BACKGROUND, STAGE_SIZE, visibleCommands } from './commands.js'
import { coloursMatch, hexToRgb, rgbToHex } from './colours.js'
import {
  HIT_EDGE,
  HIT_FILL,
  distanceToSegment,
  fillOf,
  isFilledShape,
  opacityOf,
  outlineOf,
  outlineWidthOf,
  shapeHitTest,
  shapeReach,
} from './geometry.js'

export const DEFAULT_RESOLUTION = 100
// Text and emoji count as "the same place" within this many stage pixels on each axis.
export const POSITION_TOLERANCE = 12

const WHITE = packHex(STAGE_BACKGROUND)

function packHex(hex) {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

function unpack(value) {
  return rgbToHex([(value >> 16) & 255, (value >> 8) & 255, value & 255])
}

// `top` laid over `base` (packed RGB) at `alpha` (0–1), as a canvas blends a see-through fill.
function blend(base, top, alpha) {
  if (alpha >= 1) return top
  if (alpha <= 0) return base
  const mix = (shift) =>
    Math.round(((base >> shift) & 255) * (1 - alpha) + ((top >> shift) & 255) * alpha)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

function clampIndex(value, resolution) {
  return Math.max(0, Math.min(resolution - 1, value))
}

// Paints the cells whose centre lies inside [x, x + w) × [y, y + h). A shape too small to cover
// any centre still paints the one cell under its middle, so a 1-pixel dot is never lost.
function paintRect(cells, resolution, x, y, w, h, colour) {
  if (!(w > 0) || !(h > 0)) return
  const scale = STAGE_SIZE / resolution
  const i0 = clampIndex(Math.floor(x / scale - 0.5), resolution)
  const i1 = clampIndex(Math.ceil((x + w) / scale), resolution)
  const j0 = clampIndex(Math.floor(y / scale - 0.5), resolution)
  const j1 = clampIndex(Math.ceil((y + h) / scale), resolution)
  let painted = false
  for (let j = j0; j <= j1; j++) {
    const cy = (j + 0.5) * scale
    if (cy < y || cy >= y + h) continue
    for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * scale
      if (cx < x || cx >= x + w) continue
      cells[j * resolution + i] = colour
      painted = true
    }
  }
  if (!painted) paintPoint(cells, resolution, x + w / 2, y + h / 2, colour)
}

function paintPoint(cells, resolution, x, y, colour, alpha = 1) {
  if (x < 0 || y < 0 || x >= STAGE_SIZE || y >= STAGE_SIZE) return
  const scale = STAGE_SIZE / resolution
  const index = Math.floor(y / scale) * resolution + Math.floor(x / scale)
  cells[index] = blend(cells[index], colour, alpha)
}

// A filled shape (rect, square, circle, polygon), turned and see-through as drawn: the fill,
// then the outline band on top. The outline band is at least half a cell wide either side of
// the edge so a thin outline still shows on the grid. A shape too small to cover any cell
// centre paints the one cell under its middle.
function paintShape(cells, resolution, command) {
  const fill = fillOf(command)
  const outline = outlineOf(command)
  if (!fill && !outline) return
  const scale = STAGE_SIZE / resolution
  const alpha = opacityOf(command)
  const fillPacked = fill ? packHex(fill) : 0
  const outlinePacked = outline ? packHex(outline) : 0
  const hit = shapeHitTest(command, { minHalf: outline ? scale / 2 : 0 })
  const reach = shapeReach(command) + (outline ? Math.max(outlineWidthOf(command) / 2, scale) : 0)
  const i0 = clampIndex(Math.floor((command.x - reach) / scale), resolution)
  const i1 = clampIndex(Math.ceil((command.x + reach) / scale), resolution)
  const j0 = clampIndex(Math.floor((command.y - reach) / scale), resolution)
  const j1 = clampIndex(Math.ceil((command.y + reach) / scale), resolution)
  let painted = false
  for (let j = j0; j <= j1; j++) {
    const cy = (j + 0.5) * scale
    for (let i = i0; i <= i1; i++) {
      const mask = hit((i + 0.5) * scale, cy)
      if (!mask) continue
      const index = j * resolution + i
      if (fill && mask & HIT_FILL) {
        cells[index] = blend(cells[index], fillPacked, alpha)
        painted = true
      }
      if (outline && mask & HIT_EDGE) {
        cells[index] = blend(cells[index], outlinePacked, alpha)
        painted = true
      }
    }
  }
  if (!painted && alpha > 0) {
    paintPoint(cells, resolution, command.x, command.y, fill ? fillPacked : outlinePacked, alpha)
  }
}

function paintLine(cells, resolution, command, colour) {
  const { x1, y1, x2, y2 } = command
  const alpha = opacityOf(command)
  const scale = STAGE_SIZE / resolution
  // At least half a cell wide, so a thin line always shows up on the grid.
  const half = Math.max((Number(command.width) || 2) / 2, scale / 2)
  const i0 = clampIndex(Math.floor((Math.min(x1, x2) - half) / scale), resolution)
  const i1 = clampIndex(Math.ceil((Math.max(x1, x2) + half) / scale), resolution)
  const j0 = clampIndex(Math.floor((Math.min(y1, y2) - half) / scale), resolution)
  const j1 = clampIndex(Math.ceil((Math.max(y1, y2) + half) / scale), resolution)
  for (let j = j0; j <= j1; j++) {
    const cy = (j + 0.5) * scale
    for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * scale
      if (distanceToSegment(cx, cy, x1, y1, x2, y2) <= half) {
        cells[j * resolution + i] = blend(cells[j * resolution + i], colour, alpha)
      }
    }
  }
}

function paintGrid(cells, resolution, command) {
  const colours = (command.colours ?? []).map(packHex)
  const rows = Array.isArray(command.cells) ? command.cells : []
  rows.forEach((row, r) => {
    ;(Array.isArray(row) ? row : []).forEach((index, c) => {
      if (!(index >= 0) || colours[index] === undefined) return
      paintRect(
        cells,
        resolution,
        command.x + c * command.cell,
        command.y + r * command.cell,
        command.cell,
        command.cell,
        colours[index]
      )
    })
  })
}

/**
 * The stage's shapes as a `resolution` × `resolution` grid of packed RGB numbers (row-major,
 * index = row * resolution + col). Text and emoji are skipped (see compareStages).
 */
export function rasteriseStage(commands, resolution = DEFAULT_RESOLUTION) {
  const cells = new Int32Array(resolution * resolution).fill(WHITE)
  for (const command of Array.isArray(commands) ? commands : []) {
    if (!command || typeof command !== 'object') continue
    if (isFilledShape(command)) {
      paintShape(cells, resolution, command)
      continue
    }
    switch (command.type) {
      case 'clear':
        cells.fill(WHITE)
        break
      case 'background':
        cells.fill(packHex(command.colour))
        break
      case 'line':
        paintLine(cells, resolution, command, packHex(command.colour))
        break
      case 'grid':
        paintGrid(cells, resolution, command)
        break
      default:
        break
    }
  }
  return { resolution, cells }
}

// The colour ('#rrggbb') of the raster cell holding stage point (x, y).
export function rasterColourAt(raster, x, y) {
  const scale = STAGE_SIZE / raster.resolution
  const col = Math.max(0, Math.min(raster.resolution - 1, Math.floor(x / scale)))
  const row = Math.max(0, Math.min(raster.resolution - 1, Math.floor(y / scale)))
  return unpack(raster.cells[row * raster.resolution + col])
}

/**
 * The colour on the stage at point (x, y): shapes covering it are laid on in order (the last
 * solid one wins; see-through ones blend), text and emoji are ignored, white when nothing
 * covers it. Exact geometry, no grid.
 */
export function stageColourAt(commands, x, y) {
  let colour = packHex(STAGE_BACKGROUND)
  for (const command of Array.isArray(commands) ? commands : []) {
    if (!command || typeof command !== 'object') continue
    if (isFilledShape(command)) {
      const mask = shapeHitTest(command, { minHalf: 0.5 })(x, y)
      const alpha = opacityOf(command)
      const fill = fillOf(command)
      const outline = outlineOf(command)
      if (fill && mask & HIT_FILL) colour = blend(colour, packHex(fill), alpha)
      if (outline && mask & HIT_EDGE) colour = blend(colour, packHex(outline), alpha)
      continue
    }
    switch (command.type) {
      case 'clear':
        colour = packHex(STAGE_BACKGROUND)
        break
      case 'background':
        colour = packHex(command.colour)
        break
      case 'line':
        if (
          distanceToSegment(x, y, command.x1, command.y1, command.x2, command.y2) <=
          Math.max((Number(command.width) || 2) / 2, 0.5)
        )
          colour = blend(colour, packHex(command.colour), opacityOf(command))
        break
      case 'grid': {
        const col = Math.floor((x - command.x) / command.cell)
        const row = Math.floor((y - command.y) / command.cell)
        const index = command.cells?.[row]?.[col]
        if (col >= 0 && row >= 0 && index >= 0 && command.colours?.[index]) {
          colour = packHex(command.colours[index])
        }
        break
      }
      default:
        break
    }
  }
  return unpack(colour)
}

// Text and emoji on the stage (after the last clear) as comparable items.
export function stageLabels(commands) {
  return visibleCommands(commands)
    .filter((command) => command?.type === 'text' || command?.type === 'stamp')
    .map((command) => ({
      kind: command.type,
      value: String(command.type === 'text' ? command.text : command.emoji).trim(),
      x: command.x,
      y: command.y,
    }))
}

function labelsMatch(a, b) {
  return (
    a.kind === b.kind &&
    a.value === b.value &&
    Math.abs(a.x - b.x) <= POSITION_TOLERANCE &&
    Math.abs(a.y - b.y) <= POSITION_TOLERANCE
  )
}

/**
 * Compares a drawing with a target drawing.
 * - Shapes: both rasterised at `resolution`; a cell differs when its colours don't match
 *   (coloursMatch). `fraction` = differing cells / all cells.
 * - Text and emoji: each target label needs a matching label (same words or emoji within
 *   POSITION_TOLERANCE); `missing` lists target labels the drawing lacks, `extra` the drawing's
 *   labels the target lacks.
 * `diff` is the differing cell indexes (row * resolution + col); `firstDifference` the first one
 * as { row, col, mine, target } colours, for a message in words.
 */
export function compareStages(commands, targetCommands, { resolution = DEFAULT_RESOLUTION } = {}) {
  const mine = rasteriseStage(commands, resolution)
  const target = rasteriseStage(targetCommands, resolution)
  const diff = []
  for (let i = 0; i < mine.cells.length; i++) {
    if (mine.cells[i] === target.cells[i]) continue
    if (coloursMatch(unpack(mine.cells[i]), unpack(target.cells[i]))) continue
    diff.push(i)
  }
  const myLabels = stageLabels(commands)
  const targetLabels = stageLabels(targetCommands)
  const used = new Set()
  const missing = []
  for (const label of targetLabels) {
    const index = myLabels.findIndex(
      (candidate, i) => !used.has(i) && labelsMatch(candidate, label)
    )
    if (index === -1) missing.push(label)
    else used.add(index)
  }
  const extra = myLabels.filter((_, i) => !used.has(i))
  const first = diff[0]
  return {
    resolution,
    total: mine.cells.length,
    differing: diff.length,
    fraction: diff.length / mine.cells.length,
    diff,
    missing,
    extra,
    firstDifference:
      first === undefined
        ? null
        : {
            row: Math.floor(first / resolution),
            col: first % resolution,
            mine: unpack(mine.cells[first]),
            target: unpack(target.cells[first]),
          },
  }
}

export const DEFAULT_MATCH_TOLERANCE = 0.01

// Whether a comparison passes: few enough differing cells and no missing or extra labels.
export function comparisonMatches(comparison, tolerance = DEFAULT_MATCH_TOLERANCE) {
  const limit = Number.isFinite(Number(tolerance)) ? Number(tolerance) : DEFAULT_MATCH_TOLERANCE
  return (
    !!comparison &&
    comparison.fraction <= limit + 1e-9 &&
    comparison.missing.length === 0 &&
    comparison.extra.length === 0
  )
}
