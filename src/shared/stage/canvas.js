// Canvas renderer for the Python Stage: replays a command list onto a 2D context, scaled from
// the 400 × 400 logical stage to the canvas's size. Pure with respect to the commands, so it is
// safe to call again on resize, for a ghost target, or for a prefix of the commands (slow-mo).
import { STAGE_BACKGROUND, STAGE_SIZE } from './commands.js'

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
const TEXT_FONT = 'system-ui, "Segoe UI", sans-serif'

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

function drawCommand(ctx, command) {
  switch (command?.type) {
    case 'clear':
      ctx.fillStyle = STAGE_BACKGROUND
      ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
      break
    case 'background':
      ctx.fillStyle = command.colour
      ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)
      break
    case 'rect':
      ctx.fillStyle = command.colour
      ctx.fillRect(command.x, command.y, command.w, command.h)
      break
    case 'circle':
      ctx.fillStyle = command.colour
      ctx.beginPath()
      ctx.arc(command.x, command.y, Math.max(0, command.r), 0, Math.PI * 2)
      ctx.fill()
      break
    case 'line':
      ctx.strokeStyle = command.colour
      ctx.lineWidth = command.width || 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(command.x1, command.y1)
      ctx.lineTo(command.x2, command.y2)
      ctx.stroke()
      break
    case 'text':
      ctx.fillStyle = command.colour
      ctx.font = `${command.size || 16}px ${TEXT_FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(String(command.text ?? ''), command.x, command.y)
      break
    case 'stamp':
      ctx.font = `${command.size || 32}px ${EMOJI_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(command.emoji ?? ''), command.x, command.y)
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
