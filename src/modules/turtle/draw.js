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

/** Whether a `fill` record is drawn when the first `length` records are shown (see recorder.js). */
export function isTurtleFillShown(command, length = Infinity) {
  if (command?.type !== 'fill' || !Array.isArray(command.points) || command.points.length < 3)
    return false
  return command.closedAt == null || command.closedAt <= length
}

/** The on-screen line width for a pensize: at least 1.5 units, so thin lines stay visible. */
export function turtleLineWidth(width, transform) {
  const size = Number(width)
  return Math.max(1, transform.scale * Math.max(1.5, Number.isFinite(size) ? size : 1))
}

/**
 * Replays a turtle command log onto a canvas 2D context. Pure w.r.t. the
 * command log — safe to call repeatedly (e.g. on resize) with the same log.
 * Used by the student's canvas, the tutor's views, the Builder, sharing and export.
 *
 * Draws in the order the code ran (real turtle's order), so later shapes cover earlier ones.
 * A filled shape's fill record sits where begin_fill() ran, before its own outline, so the
 * outline stays on top of its own fill (see recorder.js and docs/authoring/turtle.md "Drawing
 * order"). The 🐢 marker goes on top of everything.
 */
export function drawTurtleCommands(ctx, commands = [], options = {}) {
  const {
    logicalWidth = TURTLE_LOGICAL_WIDTH,
    logicalHeight = TURTLE_LOGICAL_HEIGHT,
    background = '#ffffff',
    // Final turtle state ({ x, y, heading, visible }) — when given, the 🐢 marker is
    // drawn on top of everything so students can see where it is and which way it faces.
    turtle = null,
    // Draws the marker instead of the 🐢: (ctx, pose, transform) => void (e.g. a vehicle).
    drawMarker = drawTurtleMarker,
  } = options
  const transform = computeTurtleTransform(
    ctx.canvas.width,
    ctx.canvas.height,
    logicalWidth,
    logicalHeight
  )

  ctx.save()
  drawTurtleBackground(ctx, background)
  drawTurtleItems(ctx, commands, transform)
  drawMarker(ctx, turtle, transform)
  ctx.restore()
}

export function drawTurtleBackground(ctx, background = '#ffffff') {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Draws records `from` (inclusive) to `to` (exclusive), in order. A fill shows only once it
 * was closed within the first `to` records, so drawing a prefix shows the picture at that
 * point. Motion records (move, turn, speed, visible) draw nothing.
 */
export function drawTurtleItems(ctx, commands = [], transform, from = 0, to = commands.length) {
  const end = Math.min(to, commands.length)
  for (let i = Math.max(0, from); i < end; i += 1) {
    drawTurtleItem(ctx, commands[i], transform, end)
  }
}

/** One record. `shownLength`: how many records are shown (decides whether a fill is closed). */
export function drawTurtleItem(ctx, command, transform, shownLength = Infinity) {
  switch (command?.type) {
    case 'fill':
      if (isTurtleFillShown(command, shownLength)) drawFill(ctx, command, transform)
      break
    case 'line':
      drawLine(ctx, command, transform)
      break
    case 'dot':
      drawDot(ctx, command, transform)
      break
    case 'stamp':
      drawStamp(ctx, command, transform)
      break
    case 'text':
      drawText(ctx, command, transform)
      break
    default:
      break
  }
}

/** Part of a line (playback): from its start to `progress` (0–1) of the way along. */
export function drawPartialTurtleLine(ctx, command, progress, transform) {
  if (command?.type !== 'line') return
  const p = Math.max(0, Math.min(1, progress))
  drawLine(
    ctx,
    {
      ...command,
      x2: command.x1 + (command.x2 - command.x1) * p,
      y2: command.y1 + (command.y2 - command.y1) * p,
    },
    transform
  )
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

/** The 🐢 at `turtle` ({ x, y, heading, visible }); nothing when hidden or not given. */
export function drawTurtleMarker(ctx, turtle, transform) {
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

function drawFill(ctx, command, transform) {
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

function drawLine(ctx, command, transform) {
  // pensize(0) draws nothing.
  if (command.width !== undefined && Number(command.width) === 0) return
  const from = toCanvasPoint(command.x1, command.y1, transform)
  const to = toCanvasPoint(command.x2, command.y2, transform)
  ctx.lineWidth = turtleLineWidth(command.width, transform)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = command.color || DEFAULT_PEN_COLOR
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

/** dot(): a filled circle centred where the turtle was; `size` is its diameter. */
function drawDot(ctx, command, transform) {
  const center = toCanvasPoint(command.x, command.y, transform)
  const radius = Math.max(0.5, ((Number(command.size) || 1) / 2) * transform.scale)
  ctx.fillStyle = command.color || DEFAULT_PEN_COLOR
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/** Small triangular marker mimicking the default turtle cursor shape. */
function drawStamp(ctx, command, transform) {
  const size = Math.max(4, transform.scale * 10)
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

function drawText(ctx, command, transform) {
  const point = toCanvasPoint(command.x, command.y, transform)
  const fontSize = Math.max(8, (command.fontSize || 8) * transform.scale)
  ctx.fillStyle = command.color || DEFAULT_PEN_COLOR
  ctx.font = `${fontSize}px system-ui, sans-serif`
  ctx.textAlign =
    command.align === 'center' ? 'center' : command.align === 'right' ? 'right' : 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(command.text ?? '', point.x, point.y)
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
