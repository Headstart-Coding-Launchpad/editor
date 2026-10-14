// Words for the Python Stage: a screen-reader description of a drawing (the shapes, the text
// and the grid size) and a comparison summary for the diff view. Colours are always named in
// words, so nothing relies on colour alone. Pure.
import { STAGE_SIZE, visibleCommands } from './commands.js'
import { describeHex } from './colours.js'

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

export function describeCommand(command) {
  switch (command?.type) {
    case 'rect':
      return `${coloured('rectangle', command.colour)} at x ${n(command.x)}, y ${n(command.y)}, ${n(command.w)} wide and ${n(command.h)} tall`
    case 'circle':
      return `${coloured('circle', command.colour)} centred at x ${n(command.x)}, y ${n(command.y)}, radius ${n(command.r)}`
    case 'line':
      return `${coloured('line', command.colour)} from x ${n(command.x1)}, y ${n(command.y1)} to x ${n(command.x2)}, y ${n(command.y2)}`
    case 'text':
      return `the text ${quote(command.text)} in ${describeHex(command.colour)} at x ${n(command.x)}, y ${n(command.y)}`
    case 'stamp':
      return `the emoji ${command.emoji} at x ${n(command.x)}, y ${n(command.y)}`
    case 'grid': {
      const rows = command.cells?.length ?? 0
      const cols = Math.max(0, ...(command.cells ?? []).map((row) => row?.length ?? 0))
      const colours = (command.colours ?? []).map(describeHex)
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
