/**
 * Turtle course mode's vehicles (./course.js): clean top-down drawings, made with canvas paths
 * (no image assets), that turn with the heading. Each is drawn centred on (0, 0), facing +x
 * (east), `size` pixels long; drawCourseVehicle places and turns it.
 *
 * Kinds: turtle (the default), car, rover, boat, drone. Every one has a dark outline so it reads
 * on road, walls and the trail alike, and a clear front (windscreen, bow, camera mast, head).
 */
import { toCanvasPoint } from './draw.js'

const DEG2RAD = Math.PI / 180
const OUTLINE = '#1f2937'

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function fillStroke(ctx, fill, line) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = line
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2)
}

function drawCar(ctx, s, line) {
  const L = s
  const W = s * 0.52
  // Wheels first, peeking out under the body.
  ctx.fillStyle = OUTLINE
  for (const wx of [-L * 0.3, L * 0.26]) {
    for (const wy of [-W / 2 - s * 0.03, W / 2 - s * 0.09]) {
      roundRect(ctx, wx - s * 0.1, wy, s * 0.2, s * 0.12, s * 0.03)
      ctx.fill()
    }
  }
  roundRect(ctx, -L / 2, -W / 2, L, W, s * 0.14)
  fillStroke(ctx, '#2563eb', line)
  // Windscreen (front) and rear window.
  ctx.beginPath()
  ctx.moveTo(L * 0.2, -W * 0.36)
  ctx.lineTo(L * 0.32, -W * 0.3)
  ctx.lineTo(L * 0.32, W * 0.3)
  ctx.lineTo(L * 0.2, W * 0.36)
  ctx.closePath()
  fillStroke(ctx, '#bfdbfe', line * 0.6)
  roundRect(ctx, -L * 0.36, -W * 0.3, L * 0.1, W * 0.6, s * 0.03)
  fillStroke(ctx, '#bfdbfe', line * 0.6)
  // Roof.
  roundRect(ctx, -L * 0.22, -W * 0.32, L * 0.38, W * 0.64, s * 0.06)
  fillStroke(ctx, '#1d4ed8', line * 0.6)
  // Headlights.
  ctx.fillStyle = '#fde68a'
  for (const hy of [-W * 0.3, W * 0.3]) {
    ellipse(ctx, L * 0.46, hy, s * 0.035, s * 0.05)
    ctx.fill()
  }
}

function drawRover(ctx, s, line) {
  const L = s * 0.9
  const W = s * 0.62
  // Six wheels, three a side.
  ctx.fillStyle = OUTLINE
  for (const wx of [-L * 0.34, 0, L * 0.34]) {
    for (const wy of [-W / 2 - s * 0.1, W / 2 - s * 0.02]) {
      roundRect(ctx, wx - s * 0.09, wy, s * 0.18, s * 0.12, s * 0.03)
      ctx.fill()
    }
  }
  roundRect(ctx, -L / 2, -W / 2, L, W, s * 0.06)
  fillStroke(ctx, '#e5e7eb', line)
  // Solar panel: a grid of cells over the back two thirds.
  roundRect(ctx, -L * 0.44, -W * 0.38, L * 0.6, W * 0.76, s * 0.02)
  fillStroke(ctx, '#1e3a8a', line * 0.6)
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = Math.max(0.5, line * 0.4)
  ctx.beginPath()
  for (let i = 1; i < 4; i += 1) {
    const x = -L * 0.44 + (L * 0.6 * i) / 4
    ctx.moveTo(x, -W * 0.38)
    ctx.lineTo(x, W * 0.38)
  }
  ctx.moveTo(-L * 0.44, 0)
  ctx.lineTo(L * 0.16, 0)
  ctx.stroke()
  // Camera mast at the front.
  ellipse(ctx, L * 0.33, 0, s * 0.1, s * 0.1)
  fillStroke(ctx, '#f97316', line * 0.8)
  ellipse(ctx, L * 0.36, 0, s * 0.035, s * 0.035)
  ctx.fillStyle = OUTLINE
  ctx.fill()
}

function drawBoat(ctx, s, line) {
  const L = s
  const W = s * 0.46
  // Hull: flat stern, pointed bow.
  ctx.beginPath()
  ctx.moveTo(-L / 2, -W / 2)
  ctx.lineTo(L * 0.12, -W / 2)
  ctx.quadraticCurveTo(L * 0.4, -W * 0.42, L / 2, 0)
  ctx.quadraticCurveTo(L * 0.4, W * 0.42, L * 0.12, W / 2)
  ctx.lineTo(-L / 2, W / 2)
  ctx.closePath()
  fillStroke(ctx, '#f8fafc', line)
  // Deck stripe and cabin.
  ctx.beginPath()
  ctx.moveTo(-L * 0.44, -W * 0.34)
  ctx.lineTo(L * 0.1, -W * 0.34)
  ctx.quadraticCurveTo(L * 0.32, -W * 0.28, L * 0.4, 0)
  ctx.quadraticCurveTo(L * 0.32, W * 0.28, L * 0.1, W * 0.34)
  ctx.lineTo(-L * 0.44, W * 0.34)
  ctx.closePath()
  fillStroke(ctx, '#0e7490', line * 0.6)
  roundRect(ctx, -L * 0.28, -W * 0.24, L * 0.3, W * 0.48, s * 0.04)
  fillStroke(ctx, '#e2e8f0', line * 0.6)
  roundRect(ctx, -L * 0.02, -W * 0.2, L * 0.06, W * 0.4, s * 0.02)
  fillStroke(ctx, '#7dd3fc', line * 0.5)
}

function drawDrone(ctx, s, line) {
  const arm = s * 0.36
  // X frame.
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = Math.max(1, s * 0.07)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const angle of [45, 135, 225, 315]) {
    ctx.moveTo(0, 0)
    ctx.lineTo(arm * Math.cos(angle * DEG2RAD), arm * Math.sin(angle * DEG2RAD))
  }
  ctx.stroke()
  // Rotors: front pair orange, back pair grey, so the front is clear.
  for (const angle of [45, 135, 225, 315]) {
    const x = arm * Math.cos(angle * DEG2RAD)
    const y = arm * Math.sin(angle * DEG2RAD)
    ellipse(ctx, x, y, s * 0.17, s * 0.17)
    fillStroke(ctx, x > 0 ? 'rgba(249, 115, 22, 0.35)' : 'rgba(148, 163, 184, 0.45)', line * 0.6)
    ellipse(ctx, x, y, s * 0.04, s * 0.04)
    ctx.fillStyle = OUTLINE
    ctx.fill()
  }
  roundRect(ctx, -s * 0.16, -s * 0.13, s * 0.32, s * 0.26, s * 0.07)
  fillStroke(ctx, '#334155', line)
  // Camera / front light.
  ellipse(ctx, s * 0.16, 0, s * 0.05, s * 0.05)
  fillStroke(ctx, '#f97316', line * 0.5)
}

function drawTurtleSprite(ctx, s, line) {
  const shellL = s * 0.62
  const shellW = s * 0.5
  // Flippers.
  for (const [x, y, angle] of [
    [s * 0.16, -shellW * 0.48, -40],
    [s * 0.16, shellW * 0.48, 40],
    [-s * 0.22, -shellW * 0.42, -140],
    [-s * 0.22, shellW * 0.42, 140],
  ]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle * DEG2RAD)
    ellipse(ctx, s * 0.08, 0, s * 0.11, s * 0.055)
    fillStroke(ctx, '#65a30d', line * 0.6)
    ctx.restore()
  }
  // Head.
  ellipse(ctx, s * 0.4, 0, s * 0.11, s * 0.09)
  fillStroke(ctx, '#65a30d', line * 0.7)
  ctx.fillStyle = OUTLINE
  for (const ey of [-s * 0.04, s * 0.04]) {
    ellipse(ctx, s * 0.45, ey, s * 0.015, s * 0.015)
    ctx.fill()
  }
  // Shell with a plate pattern.
  ellipse(ctx, -s * 0.04, 0, shellL / 2, shellW / 2)
  fillStroke(ctx, '#3f6212', line)
  ctx.strokeStyle = '#a3b18a'
  ctx.lineWidth = Math.max(0.5, line * 0.5)
  ctx.beginPath()
  ctx.moveTo(-s * 0.14, -shellW * 0.16)
  ctx.lineTo(s * 0.06, -shellW * 0.16)
  ctx.lineTo(s * 0.12, 0)
  ctx.lineTo(s * 0.06, shellW * 0.16)
  ctx.lineTo(-s * 0.14, shellW * 0.16)
  ctx.lineTo(-s * 0.2, 0)
  ctx.closePath()
  for (const [x1, y1, x2, y2] of [
    [-s * 0.14, -shellW * 0.16, -s * 0.2, -shellW * 0.42],
    [s * 0.06, -shellW * 0.16, s * 0.1, -shellW * 0.4],
    [-s * 0.14, shellW * 0.16, -s * 0.2, shellW * 0.42],
    [s * 0.06, shellW * 0.16, s * 0.1, shellW * 0.4],
    [s * 0.12, 0, s * 0.24, 0],
    [-s * 0.2, 0, -s * 0.34, 0],
  ]) {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  ctx.stroke()
}

const DRAWERS = {
  turtle: drawTurtleSprite,
  car: drawCar,
  rover: drawRover,
  boat: drawBoat,
  drone: drawDrone,
}

export const VEHICLE_KINDS = Object.keys(DRAWERS)

/** Draws vehicle `kind` centred on (0, 0) facing +x, `size` px long (canvas already placed). */
export function drawVehicleShape(ctx, kind, size) {
  const draw = DRAWERS[kind] ?? DRAWERS.turtle
  const line = Math.max(1, size * 0.045)
  ctx.save()
  ctx.lineJoin = 'round'
  draw(ctx, size, line)
  ctx.restore()
}

/**
 * The vehicle at `pose` ({ x, y, heading, visible }, turtle coordinates), `size` turtle units
 * long. Nothing when the pose is hidden (hideturtle()) or missing.
 */
export function drawCourseVehicle(ctx, kind, pose, transform, size) {
  if (!pose || pose.visible === false) return
  const x = Number(pose.x)
  const y = Number(pose.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const centre = toCanvasPoint(x, y, transform)
  ctx.save()
  ctx.translate(centre.x, centre.y)
  // Canvas rotation is clockwise-positive; turtle heading is counter-clockwise-positive.
  ctx.rotate(-(Number(pose.heading) || 0) * DEG2RAD)
  drawVehicleShape(ctx, kind, Math.max(16, size * transform.scale))
  ctx.restore()
}
