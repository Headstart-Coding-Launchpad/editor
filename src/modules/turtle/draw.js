import {
  TURTLE_LOGICAL_WIDTH,
  TURTLE_LOGICAL_HEIGHT,
  DEFAULT_PEN_COLOR,
  DEFAULT_FILL_COLOR,
} from './engine.js'

const DEG2RAD = Math.PI / 180

/**
 * Maps the fixed logical turtle world onto whatever pixel size the canvas
 * currently has, centred and "contain"-fit so forward(100) always covers the
 * same fraction of the drawing area regardless of on-screen canvas size.
 */
export function computeTurtleTransform(
  canvasWidth,
  canvasHeight,
  logicalWidth = TURTLE_LOGICAL_WIDTH,
  logicalHeight = TURTLE_LOGICAL_HEIGHT
) {
  const scale = Math.max(1e-6, Math.min(canvasWidth / logicalWidth, canvasHeight / logicalHeight))
  return { scale, offsetX: canvasWidth / 2, offsetY: canvasHeight / 2 }
}

/** Turtle y increases upward; canvas y increases downward. */
export function toCanvasPoint(x, y, transform) {
  return { x: transform.offsetX + x * transform.scale, y: transform.offsetY - y * transform.scale }
}

/**
 * Replays a turtle command log onto a canvas 2D context. Pure w.r.t. the
 * command log — safe to call repeatedly (e.g. on resize) with the same log.
 * Used by both the student's own canvas and (Phase 3) the teacher live-view canvas.
 *
 * Renders in fixed layers (fills, then lines, then stamps, then text) rather
 * than strict command-log chronological order: a filled shape's own pen
 * outline should stay visible on top of its fill regardless of exactly when
 * each was drawn, which matters here since begin_fill()/end_fill() only
 * produces its polygon once the shape is closed, after its outline segments
 * were already logged. This is a deliberate simplification for the
 * instant/final-draw model — see docs/authoring/turtle.md "Rendering order".
 */
export function drawTurtleCommands(ctx, commands = [], options = {}) {
  const {
    logicalWidth = TURTLE_LOGICAL_WIDTH,
    logicalHeight = TURTLE_LOGICAL_HEIGHT,
    background = '#ffffff',
    // Final turtle state ({ x, y, heading, visible }) — when given, the 🐢 marker is
    // drawn on top of everything so students can see where it is and which way it faces.
    turtle = null,
  } = options
  const canvasWidth = ctx.canvas.width
  const canvasHeight = ctx.canvas.height
  const transform = computeTurtleTransform(canvasWidth, canvasHeight, logicalWidth, logicalHeight)

  ctx.save()
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  drawFills(ctx, commands, transform)
  drawLines(ctx, commands, transform)
  drawStamps(ctx, commands, transform)
  drawText(ctx, commands, transform)
  drawTurtleMarker(ctx, turtle, transform)

  ctx.restore()
}

export const TURTLE_MARKER_EMOJI = '🐢'

/**
 * Rotation/flip for the 🐢 emoji so its head points along the turtle heading.
 * The emoji artwork faces left, so a turtle heading anywhere to the right is
 * mirrored first; one heading left is drawn unmirrored. Either way it stays the
 * right way up instead of lying on its back when facing west.
 */
export function turtleMarkerTransform(heading = 0) {
  const normalized = ((Number(heading) % 360) + 360) % 360
  const facesLeft = normalized > 90 && normalized < 270
  // Canvas rotation is clockwise-positive; turtle heading is counter-clockwise-positive.
  const rotation = -(facesLeft ? normalized - 180 : normalized) * DEG2RAD
  return { rotation, mirror: !facesLeft }
}

function drawTurtleMarker(ctx, turtle, transform) {
  if (!turtle || turtle.visible === false) return
  const x = Number(turtle.x)
  const y = Number(turtle.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const center = toCanvasPoint(x, y, transform)
  const { rotation, mirror } = turtleMarkerTransform(turtle.heading)
  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate(rotation)
  if (mirror) ctx.scale(-1, 1)
  ctx.font = `${Math.max(14, transform.scale * 24)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(TURTLE_MARKER_EMOJI, 0, 0)
  ctx.restore()
}

function drawFills(ctx, commands, transform) {
  for (const command of commands) {
    if (command?.type !== 'fill' || !Array.isArray(command.points) || command.points.length < 3)
      continue
    ctx.beginPath()
    command.points.forEach((point, index) => {
      const canvasPoint = toCanvasPoint(point.x, point.y, transform)
      if (index === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y)
      else ctx.lineTo(canvasPoint.x, canvasPoint.y)
    })
    ctx.closePath()
    ctx.fillStyle = command.color || DEFAULT_FILL_COLOR
    ctx.fill()
  }
}

function drawLines(ctx, commands, transform) {
  ctx.lineWidth = Math.max(1, transform.scale * 1.5)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const command of commands) {
    if (command?.type !== 'line') continue
    const from = toCanvasPoint(command.x1, command.y1, transform)
    const to = toCanvasPoint(command.x2, command.y2, transform)
    ctx.strokeStyle = command.color || DEFAULT_PEN_COLOR
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
}

/** Small triangular marker mimicking the default turtle cursor shape. */
function drawStamps(ctx, commands, transform) {
  const size = Math.max(4, transform.scale * 10)
  for (const command of commands) {
    if (command?.type !== 'stamp') continue
    const center = toCanvasPoint(command.x, command.y, transform)
    // Canvas rotation is clockwise-positive; turtle heading is counter-clockwise-positive.
    const headingRad = -command.heading * DEG2RAD
    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(headingRad)
    ctx.fillStyle = command.color || DEFAULT_PEN_COLOR
    ctx.beginPath()
    ctx.moveTo(size, 0)
    ctx.lineTo(-size * 0.6, size * 0.5)
    ctx.lineTo(-size * 0.6, -size * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function drawText(ctx, commands, transform) {
  for (const command of commands) {
    if (command?.type !== 'text') continue
    const point = toCanvasPoint(command.x, command.y, transform)
    const fontSize = Math.max(8, (command.fontSize || 8) * transform.scale)
    ctx.fillStyle = command.color || DEFAULT_PEN_COLOR
    ctx.font = `${fontSize}px system-ui, sans-serif`
    ctx.textAlign =
      command.align === 'center' ? 'center' : command.align === 'right' ? 'right' : 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(command.text ?? '', point.x, point.y)
  }
}

/**
 * Sizes a canvas element's backing pixel buffer to match its current CSS
 * (on-screen) size, scaled for devicePixelRatio so lines stay crisp — the
 * logical turtle coordinates are unaffected either way (see computeTurtleTransform).
 */
export function sizeCanvasToDisplay(canvas) {
  if (!canvas) return false
  const ratio = window.devicePixelRatio || 1
  const displayWidth = Math.max(1, Math.round(canvas.clientWidth * ratio))
  const displayHeight = Math.max(1, Math.round(canvas.clientHeight * ratio))
  if (canvas.width === displayWidth && canvas.height === displayHeight) return false
  canvas.width = displayWidth
  canvas.height = displayHeight
  return true
}
