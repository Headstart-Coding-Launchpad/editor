// Words for a Turtle drawing, for screen readers (the picture's aria-label), modelled on the
// Python Stage's src/shared/stage/describe.js: what was drawn, in which colours, and where the
// turtle ended up. Colours are named as the code gave them. Pure.
import { TURTLE_LOGICAL_WIDTH, TURTLE_LOGICAL_HEIGHT } from './engine.js'
import { isTurtleFillShown } from './draw.js'

// At most this many colours are named per kind of thing, then "and N more".
export const MAX_DESCRIBED_COLOURS = 5

function n(value) {
  return String(Math.round(Number(value) * 10) / 10)
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

function listWords(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function colourWords(colours) {
  const unique = [...new Set(colours.map((c) => String(c ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return ''
  const shown = unique.slice(0, MAX_DESCRIBED_COLOURS)
  const more = unique.length - shown.length
  return ` in ${listWords(more > 0 ? [...shown, `${more} more`] : shown)}`
}

/** 'right', 'up', 'left', 'down' for the four main headings, else '30 degrees'. */
export function describeHeading(heading) {
  const h = (((Math.round(Number(heading) * 10) / 10) % 360) + 360) % 360
  const named = { 0: 'right', 90: 'up', 180: 'left', 270: 'down' }[h]
  return named ? `${named} (${h} degrees)` : `${n(h)} degrees`
}

/**
 * The drawing in words, e.g. 'Turtle drawing, 400 by 400. Background: white. 24 lines in red,
 * orange and gold; 1 filled shape in yellow; 1 dot in white. The turtle is at x 0, y 0, facing
 * up (90 degrees).'
 */
export function describeTurtleDrawing(result) {
  const commands = Array.isArray(result?.commands) ? result.commands : []
  const state = result?.state ?? null
  const lines = commands.filter((c) => c?.type === 'line')
  const fills = commands.filter((c) => isTurtleFillShown(c, commands.length))
  const dots = commands.filter((c) => c?.type === 'dot')
  const stamps = commands.filter((c) => c?.type === 'stamp')
  const texts = commands.filter((c) => c?.type === 'text')

  const parts = []
  if (lines.length) {
    const widths = [...new Set(lines.map((l) => Number(l.width) || 1))]
    const thick = widths.length === 1 && widths[0] > 1 ? `, ${n(widths[0])} wide` : ''
    parts.push(`${plural(lines.length, 'line')}${colourWords(lines.map((l) => l.color))}${thick}`)
  }
  if (fills.length)
    parts.push(`${plural(fills.length, 'filled shape')}${colourWords(fills.map((f) => f.color))}`)
  if (dots.length)
    parts.push(`${plural(dots.length, 'dot')}${colourWords(dots.map((d) => d.color))}`)
  if (stamps.length)
    parts.push(`${plural(stamps.length, 'stamp')}${colourWords(stamps.map((s) => s.color))}`)
  if (texts.length) {
    const words = texts.slice(0, 3).map((t) => `"${t.text ?? ''}"`)
    const more = texts.length - words.length
    parts.push(`the text ${listWords(more > 0 ? [...words, `${more} more`] : words)}`)
  }

  const background = String(state?.background ?? '').trim()
  const head = `Turtle drawing, ${TURTLE_LOGICAL_WIDTH} by ${TURTLE_LOGICAL_HEIGHT}.${
    background && !/^(#fff(fff)?|white)$/i.test(background) ? ` Background: ${background}.` : ''
  }`
  const drawn = parts.length ? ` ${parts.join('; ')}.` : ' Nothing is drawn yet.'
  const where = state
    ? ` The turtle is at x ${n(state.x ?? 0)}, y ${n(state.y ?? 0)}, facing ${describeHeading(state.heading ?? 0)}${state.visible === false ? ', hidden' : ''}.`
    : ''
  return `${head}${drawn}${where}`
}
