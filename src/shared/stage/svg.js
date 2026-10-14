// A Python Stage drawing as a standalone 400 × 400 SVG string, for saving a picture (export, a
// later gallery) without a canvas. Pure and Node-safe.
import { STAGE_BACKGROUND, STAGE_SIZE } from './commands.js'

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : '0'
}

function commandSvg(command) {
  switch (command?.type) {
    case 'clear':
      return `<rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="${STAGE_BACKGROUND}"/>`
    case 'background':
      return `<rect width="${STAGE_SIZE}" height="${STAGE_SIZE}" fill="${esc(command.colour)}"/>`
    case 'rect':
      return `<rect x="${num(command.x)}" y="${num(command.y)}" width="${num(command.w)}" height="${num(command.h)}" fill="${esc(command.colour)}"/>`
    case 'circle':
      return `<circle cx="${num(command.x)}" cy="${num(command.y)}" r="${num(command.r)}" fill="${esc(command.colour)}"/>`
    case 'line':
      return `<line x1="${num(command.x1)}" y1="${num(command.y1)}" x2="${num(command.x2)}" y2="${num(command.y2)}" stroke="${esc(command.colour)}" stroke-width="${num(command.width || 2)}" stroke-linecap="round"/>`
    case 'text':
      return `<text x="${num(command.x)}" y="${num(command.y)}" fill="${esc(command.colour)}" font-size="${num(command.size || 16)}" font-family="system-ui, sans-serif" dominant-baseline="hanging">${esc(command.text)}</text>`
    case 'stamp':
      return `<text x="${num(command.x)}" y="${num(command.y)}" font-size="${num(command.size || 32)}" text-anchor="middle" dominant-baseline="central">${esc(command.emoji)}</text>`
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
