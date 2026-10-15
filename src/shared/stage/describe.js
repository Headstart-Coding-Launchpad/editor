// Words for the Python Stage: a screen-reader description of a drawing (the shapes, the text
// and the grid size) and a comparison summary for the diff view. Colours are always named in
// words, so nothing relies on colour alone. Pure.
import { STAGE_CENTRE, STAGE_SIZE, visibleCommands } from './commands.js'
import { describeHex } from './colours.js'
import { angleOf, fillOf, opacityOf, outlineOf } from './geometry.js'

// The description lists at most this many things, then says how many more there are.
export const MAX_DESCRIBED_ITEMS = 25

function n(value) {
  return String(Math.round(Number(value) * 10) / 10)
}

function quote(text) {
  return `"${String(text)}"`
}

// 'a red rectangle', 'an orange circle', 'a line in a colour close to blue (#2040e0)'.
function coloured(noun, hex) {
  const words = describeHex(hex)
  if (words.startsWith('a colour')) return `a ${noun} in ${words}`
  return `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words} ${noun}`
}

function article(words) {
  return /^[aeiou]/i.test(words) ? 'an' : 'a'
}

// 'in the middle', or 'at x 100, y 80' (`centred` adds 'centred' before 'at').
function where(command, { centred = false } = {}) {
  if (Math.abs(command.x - STAGE_CENTRE) < 0.5 && Math.abs(command.y - STAGE_CENTRE) < 0.5) {
    return 'in the middle'
  }
  return `${centred ? 'centred ' : ''}at x ${n(command.x)}, y ${n(command.y)}`
}

const POLYGON_NAMES = {
  3: 'triangle',
  4: 'diamond',
  5: 'pentagon',
  6: 'hexagon',
  7: 'heptagon',
  8: 'octagon',
  9: 'nonagon',
  10: 'decagon',
}

// The shape's noun: 'square', 'hexagon', '12-sided shape'.
function shapeNoun(command) {
  switch (command.type) {
    case 'rect':
      return 'rectangle'
    case 'polygon':
      return POLYGON_NAMES[command.sides] ?? `${n(command.sides)}-sided shape`
    default:
      return command.type
  }
}

// 'a red square', 'a red square outline' (colour=None), with 'with a black outline' when both.
function shapeHead(command) {
  const noun = shapeNoun(command)
  const fill = fillOf(command)
  const outline = outlineOf(command)
  if (!fill) return coloured(`${noun} outline`, outline)
  const head = coloured(noun, fill)
  if (!outline) return head
  const words = describeHex(outline)
  return words.startsWith('a colour')
    ? `${head} with an outline in ${words}`
    : `${head} with ${article(words)} ${words} outline`
}

// ', turned 45°', ', see-through (opacity 0.5)': only what differs from the defaults.
function styleWords(command) {
  const parts = []
  const angle = angleOf(command)
  if (angle) parts.push(`turned ${n(angle)}°`)
  const opacity = opacityOf(command)
  if (opacity <= 0) parts.push('invisible (opacity 0)')
  else if (opacity < 1) parts.push(`see-through (opacity ${Math.round(opacity * 100) / 100})`)
  return parts
}

function joined(...parts) {
  return parts.flat().filter(Boolean).join(', ')
}

export function describeCommand(command) {
  switch (command?.type) {
    case 'rect':
      return joined(
        shapeHead(command),
        `${n(command.w)} wide and ${n(command.h)} tall`,
        styleWords(command),
        where(command)
      )
    case 'square':
      return joined(
        shapeHead(command),
        `size ${n(command.size)}`,
        styleWords(command),
        where(command)
      )
    case 'circle':
      return joined(
        shapeHead(command),
        `radius ${n(command.r)}`,
        styleWords(command),
        where(command)
      )
    case 'polygon':
      return joined(
        shapeHead(command),
        `${n(command.sides)} sides`,
        `size ${n(command.size)}`,
        styleWords(command),
        where(command)
      )
    case 'line':
      return joined(
        `${coloured('line', command.colour)} from x ${n(command.x1)}, y ${n(command.y1)} to x ${n(command.x2)}, y ${n(command.y2)}`,
        styleWords(command)
      )
    case 'text':
      return `${joined(`the text ${quote(command.text)} in ${describeHex(command.colour)}`, styleWords(command))} ${where(command, { centred: true })}`
    case 'stamp':
      return `${joined(`the emoji ${command.emoji}`, styleWords(command))} ${where(command)}`
    case 'grid': {
      const rows = command.cells?.length ?? 0
      const cols = Math.max(0, ...(command.cells ?? []).map((row) => row?.length ?? 0))
      const colours = (command.colours ?? []).map(describeHex)
      // A flat list drawn with width=: "a pixel grid of 24 squares, 8 to a row, in red and white".
      if (Number.isInteger(command.wrap) && command.wrap > 0) {
        const count = (command.cells ?? []).reduce((sum, row) => sum + (row?.length ?? 0), 0)
        return `a pixel grid of ${count} square${count === 1 ? '' : 's'}, ${command.wrap} to a row${colours.length ? `, in ${listWords(colours)}` : ''}`
      }
      return `a pixel grid of ${rows} row${rows === 1 ? '' : 's'} by ${cols} column${cols === 1 ? '' : 's'}${colours.length ? ` in ${listWords(colours)}` : ''}`
    }
    default:
      return ''
  }
}

function listWords(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * The drawing in words for a screen reader, e.g. 'Stage, 400 by 400. Background: navy. 3 things
 * drawn: a red circle centred at x 200, y 200, radius 50; …'.
 */
export function describeStage(commands) {
  const visible = visibleCommands(commands)
  let background = 'white'
  let start = 0
  visible.forEach((command, i) => {
    if (command?.type === 'background') {
      background = describeHex(command.colour)
      start = i + 1
    }
  })
  const items = visible.slice(start).map(describeCommand).filter(Boolean)
  const head = `Stage, ${STAGE_SIZE} by ${STAGE_SIZE}. Background: ${background}.`
  if (items.length === 0) return `${head} Nothing else is drawn.`
  const shown = items.slice(0, MAX_DESCRIBED_ITEMS)
  const more = items.length - shown.length
  return `${head} ${items.length} thing${items.length === 1 ? '' : 's'} drawn: ${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}.`
}

function describeLabel(label) {
  return label.kind === 'text'
    ? `the text ${quote(label.value)} near x ${n(label.x)}, y ${n(label.y)}`
    : `the emoji ${label.value} near x ${n(label.x)}, y ${n(label.y)}`
}

/**
 * A comparison (compareStages) in words for the student. `matches` says whether it passed.
 */
export function describeComparison(comparison, { matches = false } = {}) {
  if (!comparison) return ''
  if (matches) return 'Your drawing matches the target.'
  const parts = []
  if (comparison.differing > 0) {
    const percent = Math.max(1, Math.round(comparison.fraction * 100))
    const first = comparison.firstDifference
    const scale = STAGE_SIZE / comparison.resolution
    const at = first
      ? ` For example, near x ${n((first.col + 0.5) * scale)}, y ${n((first.row + 0.5) * scale)} the target is ${describeHex(first.target)} but yours is ${describeHex(first.mine)}.`
      : ''
    parts.push(`About ${percent}% of the stage is different from the target.${at}`)
  }
  if (comparison.missing.length > 0) {
    parts.push(`Still to draw: ${comparison.missing.slice(0, 3).map(describeLabel).join('; ')}.`)
  }
  if (comparison.extra.length > 0) {
    parts.push(`Not in the target: ${comparison.extra.slice(0, 3).map(describeLabel).join('; ')}.`)
  }
  return parts.join(' ') || 'Your drawing is very close to the target.'
}
