// The Python Stage's checks (registered by src/modules/python/checks.js). Each reads the run's
// drawing from `context.stage`: { commands, target }, where `target` is the stageTarget's
// commands (null when the task has none or it couldn't be drawn). They need a run, so
// `lessons test-checks` reports them as needing one. Pure and Node-safe.
//
// Messages from validateStageCheck are documented in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js scans this file).
import { compareText } from '../checkHelpers.js'
import { coloursMatch, colourInWords, parseColour } from './colours.js'
import {
  MAX_POLYGON_SIDES,
  STAGE_SHAPE_KINDS,
  STAGE_SIZE,
  stageCommandsOf,
  visibleCommands,
} from './commands.js'
import {
  compareStages,
  comparisonMatches,
  DEFAULT_MATCH_TOLERANCE,
  stageColourAt,
} from './raster.js'

export const STAGE_CHECK_TYPES = Object.freeze([
  'stage_matches_target',
  'stage_shape_count',
  'stage_colour_used',
  'stage_pixel',
  'stage_text_shown',
])

export const STAGE_TEXT_OPERATORS = Object.freeze(['contains', 'equals', 'matches_regex'])

function stageOf(context = {}) {
  const stage = context?.stage
  return {
    commands: stageCommandsOf(stage),
    target: Array.isArray(stage?.target) ? stage.target : null,
  }
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// How many shapes of `kind` are on the stage; `sides` (polygons only) keeps the polygons with
// that many sides.
function countShapes(commands, kind, sides = null) {
  const visible = visibleCommands(commands)
  if (sides !== null) {
    return visible.filter((c) => c?.type === 'polygon' && Number(c.sides) === sides).length
  }
  if (!kind || kind === 'any') {
    return visible.filter((c) => STAGE_SHAPE_KINDS.includes(c?.type)).length
  }
  return visible.filter((c) => c?.type === kind).length
}

// Every colour actually on the stage (after the last clear): shapes and their outlines, text,
// the background and the grid colours some cell uses.
export function stageColours(commands) {
  const colours = []
  for (const command of visibleCommands(commands)) {
    if (!command) continue
    if (command.type === 'grid') {
      const used = new Set()
      for (const row of command.cells ?? [])
        for (const index of row ?? []) if (index >= 0) used.add(index)
      for (const index of used) if (command.colours?.[index]) colours.push(command.colours[index])
    } else {
      if (typeof command.colour === 'string') colours.push(command.colour)
      if (typeof command.outline === 'string') colours.push(command.outline)
    }
  }
  return colours
}

// Grid cell `index` (counting from 0) in the flat list of a grid's cells, row by row: { row,
// col }, or null past the end. A flat list drawn with width= is exactly that list.
function gridCellAt(grid, index) {
  let left = index
  const rows = Array.isArray(grid?.cells) ? grid.cells : []
  for (let row = 0; row < rows.length; row++) {
    const length = Array.isArray(rows[row]) ? rows[row].length : 0
    if (left < length) return { row, col: left }
    left -= length
  }
  return null
}

// The stage point a stage_pixel check reads: { x, y }, or the centre of a cell of the last grid
// on the stage, by (row, col) or by its index in the grid's flat list (null when there is no
// grid, or no such cell).
export function stagePixelPoint(check, commands) {
  const x = finite(check?.x)
  const y = finite(check?.y)
  if (x !== null && y !== null) return { x, y }
  let row = finite(check?.row)
  let col = finite(check?.col)
  const index = finite(check?.index)
  if ((row === null || col === null) && index === null) return null
  const grid = visibleCommands(commands)
    .filter((c) => c?.type === 'grid')
    .at(-1)
  if (!grid) return null
  if (row === null || col === null) {
    const cell = Number.isInteger(index) && index >= 0 ? gridCellAt(grid, index) : null
    if (!cell) return null
    ;({ row, col } = cell)
  }
  return { x: grid.x + (col + 0.5) * grid.cell, y: grid.y + (row + 0.5) * grid.cell }
}

export function evaluateStageCheck(check, context = {}) {
  const { commands, target } = stageOf(context)
  switch (check?.type) {
    case 'stage_matches_target': {
      if (!target) return false
      const tolerance = finite(check.tolerance) ?? DEFAULT_MATCH_TOLERANCE
      return comparisonMatches(compareStages(commands, target), tolerance)
    }
    case 'stage_shape_count': {
      const count = countShapes(commands, check.kind, finite(check.sides))
      const min = finite(check.min)
      const max = finite(check.max)
      if (min === null && max === null) return count >= 1
      return (min === null || count >= min) && (max === null || count <= max)
    }
    case 'stage_colour_used': {
      const wanted = parseColour(check.colour)
      if (!wanted) return false
      return stageColours(commands).some((colour) => coloursMatch(colour, wanted))
    }
    case 'stage_pixel': {
      const wanted = parseColour(check.colour)
      const point = stagePixelPoint(check, commands)
      if (!wanted || !point) return false
      return coloursMatch(stageColourAt(commands, point.x, point.y), wanted)
    }
    case 'stage_text_shown': {
      const expected = String(check.text ?? '')
      if (!expected.trim()) return false
      const operator = check.operator ?? 'contains'
      return visibleCommands(commands)
        .filter((c) => c?.type === 'text')
        .some((c) => compareText(c.text, operator, expected, { flags: check.flags }) === true)
    }
    default:
      return false
  }
}

/**
 * A stage check in plain words (the Builder's check row, the CLI): colours are named, never
 * shown as a swatch alone. E.g. 'Something red is on the stage'.
 */
export function describeStageCheck(check) {
  switch (check?.type) {
    case 'stage_matches_target':
      return `The drawing matches the target (up to ${Math.round((finite(check.tolerance) ?? DEFAULT_MATCH_TOLERANCE) * 100)}% different)`
    case 'stage_shape_count': {
      const sides = finite(check.sides)
      let kind = !check.kind || check.kind === 'any' ? 'shapes' : `${check.kind} commands`
      if (sides !== null) kind = `polygon commands with ${sides} sides`
      const min = finite(check.min)
      const max = finite(check.max)
      if (min !== null && max !== null) return `Between ${min} and ${max} ${kind} on the stage`
      if (max !== null) return `At most ${max} ${kind} on the stage`
      return `At least ${min ?? 1} ${kind} on the stage`
    }
    case 'stage_colour_used':
      return `Something ${colourInWords(check.colour)} is on the stage`
    case 'stage_pixel': {
      let where = `Grid row ${check.row}, column ${check.col}`
      if (finite(check.x) !== null) where = `The point x ${check.x}, y ${check.y}`
      else if (check.row == null && finite(check.index) !== null) {
        where = `Grid square ${check.index}`
      }
      return `${where} is ${colourInWords(check.colour)}`
    }
    case 'stage_text_shown':
      return `The stage shows text that ${String(check.operator ?? 'contains').replace(/_/g, ' ')} "${check.text ?? ''}"`
    default:
      return ''
  }
}

function hasStageTarget(task) {
  return typeof task?.stageTarget?.code === 'string' && !!task.stageTarget.code.trim()
}

// The Stage lives in the python module only (the stageTarget task field).
function moduleHasStage(moduleDefinition) {
  return !!moduleDefinition?.taskFields?.some((field) => field.name === 'stageTarget')
}

/**
 * Authoring rules for one stage check: complete messages starting `Task ${n} `.
 */
export function validateStageCheck(check, { n, kind, task, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  const type = check?.type
  if (moduleDefinition && !moduleHasStage(moduleDefinition)) {
    errors.push(`Task ${n} has a ${type} ${label}, but stage checks only work in Python tasks`)
  }
  if (type === 'stage_matches_target') {
    if (!hasStageTarget(task)) {
      errors.push(
        `Task ${n} has a stage_matches_target ${label} but no stageTarget code to compare with`
      )
    }
    if (check.tolerance != null) {
      const tolerance = finite(check.tolerance)
      if (tolerance === null || tolerance < 0 || tolerance > 1) {
        errors.push(
          `Task ${n} has a stage_matches_target ${label} with tolerance "${check.tolerance}" — use a fraction from 0 to 1, e.g. 0.02`
        )
      }
    }
  }
  if (type === 'stage_shape_count') {
    if (check.kind != null && check.kind !== 'any' && !STAGE_SHAPE_KINDS.includes(check.kind)) {
      errors.push(
        `Task ${n} has a stage_shape_count ${label} with kind "${check.kind}" — use one of: any, ${STAGE_SHAPE_KINDS.join(', ')}`
      )
    }
    if (check.sides != null) {
      const sides = finite(check.sides)
      if (sides === null || !Number.isInteger(sides) || sides < 3 || sides > MAX_POLYGON_SIDES) {
        errors.push(
          `Task ${n} has a stage_shape_count ${label} whose sides is not a whole number from 3 to 100`
        )
      } else if (check.kind !== 'polygon') {
        errors.push(
          `Task ${n} has a stage_shape_count ${label} with sides but its kind is not polygon — add kind: polygon`
        )
      }
    }
    const min = check.min == null ? null : finite(check.min)
    const max = check.max == null ? null : finite(check.max)
    if (
      (check.min != null && (min === null || min < 0 || !Number.isInteger(min))) ||
      (check.max != null && (max === null || max < 0 || !Number.isInteger(max)))
    ) {
      errors.push(
        `Task ${n} has a stage_shape_count ${label} whose min or max is not a whole number of 0 or more`
      )
    } else if (min !== null && max !== null && min > max) {
      errors.push(`Task ${n} has a stage_shape_count ${label} whose min is more than its max`)
    }
  }
  if (type === 'stage_colour_used' || type === 'stage_pixel') {
    if (!parseColour(check.colour)) {
      errors.push(
        `Task ${n} has a ${type} ${label} with colour "${check.colour ?? ''}" — use a CSS colour name, a PICO-8 name or a hex code like #ff0000`
      )
    }
  }
  if (type === 'stage_pixel') {
    const hasPoint = check.x != null || check.y != null
    const hasCell = check.row != null || check.col != null
    const hasIndex = check.index != null
    if ([hasPoint, hasCell, hasIndex].filter(Boolean).length !== 1) {
      errors.push(
        `Task ${n} has a stage_pixel ${label} that needs one of: x and y, row and col, or index`
      )
    } else if (hasIndex) {
      const index = finite(check.index)
      if (index === null || index < 0 || !Number.isInteger(index)) {
        errors.push(
          `Task ${n} has a stage_pixel ${label} whose index is not a whole number of 0 or more`
        )
      }
    } else if (hasPoint) {
      const x = finite(check.x)
      const y = finite(check.y)
      if (x === null || y === null || x < 0 || y < 0 || x >= STAGE_SIZE || y >= STAGE_SIZE) {
        errors.push(
          `Task ${n} has a stage_pixel ${label} whose x and y are not both numbers from 0 to 399`
        )
      }
    } else {
      const row = finite(check.row)
      const col = finite(check.col)
      if (
        row === null ||
        col === null ||
        row < 0 ||
        col < 0 ||
        !Number.isInteger(row) ||
        !Number.isInteger(col)
      ) {
        errors.push(
          `Task ${n} has a stage_pixel ${label} whose row and col are not both whole numbers of 0 or more`
        )
      }
    }
  }
  if (type === 'stage_text_shown') {
    if (typeof check.text !== 'string' || !check.text.trim()) {
      errors.push(`Task ${n} has a stage_text_shown ${label} but no text`)
    }
    if (check.operator != null && !STAGE_TEXT_OPERATORS.includes(check.operator)) {
      errors.push(
        `Task ${n} has a stage_text_shown ${label} with operator "${check.operator}" — use one of: ${STAGE_TEXT_OPERATORS.join(', ')}`
      )
    }
  }
  return errors
}
