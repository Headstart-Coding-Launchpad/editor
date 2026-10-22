// A Python Stage drawing as a standalone 400 × 400 SVG string, for saving a picture (export, a
// later gallery) without a canvas. Pure and Node-safe.
import { STAGE_BACKGROUND, STAGE_SIZE } from './commands.js'
import {
  angleOf,
  fillOf,
  isFilledShape,
  opacityOf,
  outlineOf,
  outlineWidthOf,
  shapeCorners,
} from './geometry.js'

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : '0'
}

// translate(x y) rotate(angle): the shape's centre and turn (clockwise, like the canvas).
function placement(command) {
  const angle = angleOf(command)
  return ` transform="translate(${num(command.x)} ${num(command.y)})${angle ? ` rotate(${num(angle)})` : ''}"`
}

// Fill and outline paint, each faded by the opacity separately, as the canvas draws them.
function paint(command) {
  const opacity = opacityOf(command)
  const fill = fillOf(command)
  const outline = outlineOf(command)
  let attrs = ` fill="${fill ? esc(fill) : 'none'}"`
  if (fill && opacity < 1) attrs += ` fill-opacity="${num(opacity)}"`
  if (outline) {
    attrs += ` stroke="${esc(outline)}" stroke-width="${num(outlineWidthOf(command))}" stroke-linejoin="round"`
    if (opacity < 1) attrs += ` stroke-opacity="${num(opacity)}"`
  }
  return attrs
}

function opacityAttr(command) {
  const opacity = opacityOf(command)
  return opacity < 1 ? ` opacity="${num(opacity)}"` : ''
}

function shapeSvg(command) {
  if (command.type === 'circle') {
    return `<circle r="${num(Math.max(0, command.r))}"${placement(command)}${paint(command)}/>`
  }
  const points = shapeCorners(command)
    .map(([x, y]) => `${num(x)},${num(y)}`)
    .join(' ')
  return `<polygon points="${points}"${placement(command)}${paint(command)}/>`
}

function commandSvg(command) {
  if (isFilledShape(command)) return shapeSvg(command)
  switch (command?.type) {
    case 'clear':
      return `<rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="${STAGE_BACKGROUND}"/>`
    case 'background':
      return `<rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="${esc(command.colour)}"/>`
    case 'line':
      return `<line x1="${num(command.x1)}" y1="${num(command.y1)}" x2="${num(command.x2)}" y2="${num(command.y2)}" stroke="${esc(command.colour)}" stroke-width="${num(command.width || 2)}" stroke-linecap="round"${opacityAttr(command)}/>`
    case 'text':
      return `<text${placement(command)} fill="${esc(command.colour)}" font-size="${num(command.size || 16)}" font-family="system-ui, 'Noto Color Emoji', sans-serif" text-anchor="middle" dominant-baseline="central"${opacityAttr(command)}>${esc(command.text)}</text>`
    case 'stamp':
      return `<text${placement(command)} font-size="${num(command.size || 32)}" font-family="'Noto Color Emoji', sans-serif" text-anchor="middle" dominant-baseline="central"${opacityAttr(command)}>${esc(command.emoji)}</text>`
    case 'grid': {
      const parts = []
      ;(command.cells ?? []).forEach((row, r) => {
        ;(row ?? []).forEach((index, c) => {
          const colour = index >= 0 ? command.colours?.[index] : null
          if (!colour) return
          parts.push(
            `<rect x="${num(command.x + c * command.cell)}" y="${num(command.y + r * command.cell)}" width="${num(command.cell)}" height="${num(command.cell)}" fill="${esc(colour)}"/>`
          )
        })
      })
      return parts.join('')
    }
    default:
      return ''
  }
}

export function stageToSvg(commands) {
  const body = (Array.isArray(commands) ? commands : []).map(commandSvg).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_SIZE}" height="${STAGE_SIZE}" viewBox="0 0 ${STAGE_SIZE} ${STAGE_SIZE}"><rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="${STAGE_BACKGROUND}"/>${body}</svg>`
}
