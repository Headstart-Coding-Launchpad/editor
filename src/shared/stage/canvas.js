// Canvas renderer for the Python Stage: replays a command list onto a 2D context, scaled from
// the 400 × 400 logical stage to the canvas's size. Pure with respect to the commands, so it is
// safe to call again on resize, for a ghost target, or for a prefix of the commands (slow-mo).
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

// Emoji draw in Noto Color Emoji (loaded by index.css) on every device, so a stamp or an emoji in
// text() looks the same on Windows, Chromebooks, iPads and in lesson screenshots (request #85).
// The system emoji fonts are only a fallback while it loads. In text(), letters keep the system
// font and only the emoji fall through to Noto.
export const STAGE_EMOJI_FONT = 'Noto Color Emoji'
const EMOJI_FONT = '"Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
const TEXT_FONT = 'system-ui, "Segoe UI", "Noto Color Emoji", sans-serif'

// Sizes a canvas's backing store to its displayed size (device pixels). True when it changed.
export function sizeStageCanvas(canvas) {
  if (!canvas) return false
  const ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
  if (canvas.width === width && canvas.height === height) return false
  canvas.width = width
  canvas.height = height
  return true
}

// Runs `paint` with the command's opacity and turn applied around its centre (x, y), which
// becomes the origin. The canvas's own alpha (a ghost's) is kept and multiplied.
function withPlacement(ctx, command, paint) {
  ctx.save()
  ctx.globalAlpha *= opacityOf(command)
  ctx.translate(command.x, command.y)
  const angle = angleOf(command)
  if (angle) ctx.rotate((angle * Math.PI) / 180)
  paint()
  ctx.restore()
}

// A filled shape (rect, square, circle, polygon): its fill, then its outline on top.
function drawShape(ctx, command) {
  withPlacement(ctx, command, () => {
    ctx.beginPath()
    if (command.type === 'circle') {
      ctx.arc(0, 0, Math.max(0, command.r), 0, Math.PI * 2)
    } else {
      const corners = shapeCorners(command)
      corners.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
    }
    const fill = fillOf(command)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fill()
    }
    const outline = outlineOf(command)
    if (outline) {
      ctx.strokeStyle = outline
      ctx.lineWidth = outlineWidthOf(command)
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  })
}

function drawCommand(ctx, command) {
  if (isFilledShape(command)) {
    drawShape(ctx, command)
    return
  }
  switch (command?.type) {
    case 'clear':
      ctx.fillStyle = STAGE_BACKGROUND
      ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
      break
    case 'background':
      ctx.fillStyle = command.colour
      ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
      break
    case 'line':
      ctx.save()
      ctx.globalAlpha *= opacityOf(command)
      ctx.strokeStyle = command.colour
      ctx.lineWidth = command.width || 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(command.x1, command.y1)
      ctx.lineTo(command.x2, command.y2)
      ctx.stroke()
      ctx.restore()
      break
    case 'text':
      withPlacement(ctx, command, () => {
        ctx.fillStyle = command.colour
        ctx.font = `${command.size || 16}px ${TEXT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(command.text ?? ''), 0, 0)
      })
      break
    case 'stamp':
      withPlacement(ctx, command, () => {
        ctx.font = `${command.size || 32}px ${EMOJI_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(command.emoji ?? ''), 0, 0)
      })
      break
    case 'grid': {
      const colours = command.colours ?? []
      ;(command.cells ?? []).forEach((row, r) => {
        ;(row ?? []).forEach((index, c) => {
          if (!(index >= 0) || !colours[index]) return
          ctx.fillStyle = colours[index]
          // A hair of overlap hides the seams between scaled cells.
          ctx.fillRect(
            command.x + c * command.cell,
            command.y + r * command.cell,
            command.cell + 0.5,
            command.cell + 0.5
          )
        })
      })
      break
    }
    default:
      break
  }
}

/**
 * Draws a stage onto `ctx`, filling the canvas (the stage is square; a non-square canvas is
 * letterboxed). Options:
 * - ghost: a target's commands, drawn faintly over the drawing (ghostAlpha, default 0.35)
 * - diff: a comparison (compareStages); its differing cells are outlined and tinted
 */
export function drawStage(ctx, commands, { ghost = null, ghostAlpha = 0.35, diff = null } = {}) {
  if (!ctx) return
  const { width, height } = ctx.canvas
  const scale = Math.min(width, height) / STAGE_SIZE
  const offsetX = (width - STAGE_SIZE * scale) / 2
  const offsetY = (height - STAGE_SIZE * scale) / 2
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)
  ctx.beginPath()
  ctx.rect(0, 0, STAGE_SIZE, STAGE_SIZE)
  ctx.clip()
  ctx.fillStyle = STAGE_BACKGROUND
  ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
  for (const command of Array.isArray(commands) ? commands : []) drawCommand(ctx, command)
  if (Array.isArray(ghost) && ghost.length > 0) {
    ctx.globalAlpha = ghostAlpha
    for (const command of ghost) {
      // The target's own background would wash out the whole drawing; its shapes are enough.
      if (command?.type === 'background' || command?.type === 'clear') continue
      drawCommand(ctx, command)
    }
    ctx.globalAlpha = 1
  }
  if (diff && Array.isArray(diff.diff) && diff.diff.length > 0) {
    const cell = STAGE_SIZE / diff.resolution
    ctx.fillStyle = 'rgba(236, 72, 153, 0.35)'
    for (const index of diff.diff) {
      const row = Math.floor(index / diff.resolution)
      const col = index % diff.resolution
      ctx.fillRect(col * cell, row * cell, cell, cell)
    }
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.8)'
    ctx.lineWidth = 1 / scale
    ctx.setLineDash([3 / scale, 2 / scale])
    for (const label of [...(diff.missing ?? []), ...(diff.extra ?? [])]) {
      ctx.strokeRect(label.x - 6, label.y - 6, 24, 24)
    }
    ctx.setLineDash([])
  }
  ctx.restore()
}
