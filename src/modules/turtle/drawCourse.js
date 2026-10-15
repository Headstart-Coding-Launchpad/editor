/**
 * Drawing a Turtle course (./course.js) on the picture's canvas, in two layers:
 * - the map, under the drawing (drawCourseMap): road, walls, the goal;
 * - over the drawing, every frame (drawCourseTop): pickups still to collect (and rings where
 *   collected ones were), the crash mark once the vehicle has hit, and the vehicle.
 *
 * Things differ by shape and pattern as well as colour: walls are dark and hatched, road is
 * pale with grid lines, the goal is a chequered flag pattern, pickups are gold stars (a dashed
 * ring once collected), and a crash is a red jagged burst.
 */
import { toCanvasPoint } from './draw.js'
import { gridCellCentre } from './course.js'
import { drawCourseVehicle } from './vehicles.js'

const ROAD = '#f1f5f9'
const ROAD_LINE = '#cbd5e1'
const WALL = '#475569'
const WALL_HATCH = '#94a3b8'
const OFF_MAP = '#e2e8f0'
const GOAL_RING = '#15803d'
const PICKUP = '#f59e0b'
const PICKUP_LINE = '#92400e'
const CRASH = '#dc2626'

function canvasRect(transform, x1, y1, x2, y2) {
  const a = toCanvasPoint(Math.min(x1, x2), Math.max(y1, y2), transform)
  const b = toCanvasPoint(Math.max(x1, x2), Math.min(y1, y2), transform)
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
}

// Diagonal hatching inside a canvas rect (the current clip is left alone).
function hatch(ctx, rect, gap, colour, width) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.w, rect.h)
  ctx.clip()
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  for (let d = -rect.h; d < rect.w; d += gap) {
    ctx.moveTo(rect.x + d, rect.y + rect.h)
    ctx.lineTo(rect.x + d + rect.h, rect.y)
  }
  ctx.stroke()
  ctx.restore()
}

// A chequered pattern clipped to the current path (a finish flag).
function chequer(ctx, rect, squares) {
  const size = Math.max(rect.w, rect.h) / squares
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.fillStyle = '#111827'
  for (let i = 0; i * size < rect.w + size; i += 1) {
    for (let j = 0; j * size < rect.h + size; j += 1) {
      if ((i + j) % 2 === 0) ctx.fillRect(rect.x + i * size, rect.y + j * size, size, size)
    }
  }
  ctx.restore()
}

function drawWallRect(ctx, rect, scale) {
  ctx.fillStyle = WALL
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  hatch(ctx, rect, Math.max(4, 8 * scale), WALL_HATCH, Math.max(1, 1.2 * scale))
}

function drawGridMap(ctx, world, transform) {
  const { cell } = world
  const scale = transform.scale
  for (let row = 0; row < world.rows; row += 1) {
    for (let col = 0; col < world.cols; col += 1) {
      const centre = gridCellCentre(world, row, col)
      const rect = canvasRect(
        transform,
        centre.x - cell / 2,
        centre.y - cell / 2,
        centre.x + cell / 2,
        centre.y + cell / 2
      )
      const kind = world.cells[row][col]
      if (kind === 'wall') {
        drawWallRect(ctx, rect, scale)
      } else if (kind === 'off') {
        ctx.fillStyle = OFF_MAP
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      } else {
        ctx.fillStyle = ROAD
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
        ctx.strokeStyle = ROAD_LINE
        ctx.lineWidth = Math.max(1, 0.8 * scale)
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
        if (kind === 'goal') {
          const inset = rect.w * 0.14
          const flag = {
            x: rect.x + inset,
            y: rect.y + inset,
            w: rect.w - inset * 2,
            h: rect.h - inset * 2,
          }
          ctx.beginPath()
          ctx.rect(flag.x, flag.y, flag.w, flag.h)
          chequer(ctx, flag, 4)
          ctx.strokeStyle = GOAL_RING
          ctx.lineWidth = Math.max(2, 3 * scale)
          ctx.strokeRect(flag.x, flag.y, flag.w, flag.h)
        }
      }
    }
  }
}

function drawTrackMap(ctx, world, transform) {
  const scale = transform.scale
  // Faint 50-unit grid lines: help students judge distances.
  ctx.strokeStyle = '#eef2f7'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let v = -200; v <= 200; v += 50) {
    const a = toCanvasPoint(v, -200, transform)
    const b = toCanvasPoint(v, 200, transform)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    const c = toCanvasPoint(-200, v, transform)
    const d = toCanvasPoint(200, v, transform)
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
  }
  ctx.stroke()

  // The goal zone, chequered with a green edge.
  const goal = world.goal
  if (goal.rect) {
    const rect = canvasRect(transform, goal.rect.x1, goal.rect.y1, goal.rect.x2, goal.rect.y2)
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    chequer(ctx, rect, Math.max(2, Math.round(rect.w / Math.max(8, 10 * scale))))
    ctx.strokeStyle = GOAL_RING
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  } else {
    const centre = toCanvasPoint(goal.x, goal.y, transform)
    const r = goal.r * scale
    const rect = { x: centre.x - r, y: centre.y - r, w: r * 2, h: r * 2 }
    ctx.beginPath()
    ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2)
    chequer(ctx, rect, Math.max(4, Math.round((goal.r * 2) / 10)))
    ctx.beginPath()
    ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = GOAL_RING
    ctx.lineWidth = Math.max(2, 3 * scale)
    ctx.stroke()
  }

  // Box walls, then line walls (thick, round-ended).
  for (const box of world.rects) {
    drawWallRect(ctx, canvasRect(transform, box.x1, box.y1, box.x2, box.y2), scale)
  }
  ctx.strokeStyle = WALL
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(3, 5 * scale)
  ctx.beginPath()
  for (const line of world.lines) {
    const a = toCanvasPoint(line.x1, line.y1, transform)
    const b = toCanvasPoint(line.x2, line.y2, transform)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()

  // The edge of the picture is a wall too.
  const edge = canvasRect(transform, -200, -200, 200, 200)
  ctx.strokeStyle = WALL
  ctx.lineWidth = Math.max(2, 3 * scale)
  ctx.strokeRect(edge.x, edge.y, edge.w, edge.h)
}

/** The map under the drawing (TurtlePicture's drawUnderlay). Nothing for a broken world. */
export function drawCourseMap(ctx, world, transform) {
  if (!world || world.error) return
  ctx.save()
  if (world.type === 'grid') drawGridMap(ctx, world, transform)
  else drawTrackMap(ctx, world, transform)
  ctx.restore()
}

function star(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / points
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** How big things are in a world: { pickup, vehicle } radius / length in turtle units. */
export function courseSizes(world) {
  if (world?.type === 'grid') return { pickup: world.cell * 0.28, vehicle: world.cell * 0.78 }
  return { pickup: 8, vehicle: (world?.radius ?? 10) * 2.6 }
}

/**
 * Which pickups and crash marks the first `done` records show: { collected: Set<index>,
 * crash: { x, y } | null }.
 */
export function courseMarksAt(commands = [], done = commands.length) {
  const collected = new Set()
  let crash = null
  const end = Math.min(done, commands.length)
  for (let i = 0; i < end; i += 1) {
    const command = commands[i]
    if (command?.type === 'pickup') collected.add(Number(command.index))
    else if (command?.type === 'crash') crash = { x: Number(command.x), y: Number(command.y) }
  }
  return { collected, crash }
}

/**
 * Over the drawing (TurtlePicture's drawMarker): pickups, the crash mark and the vehicle at
 * `pose`. `frame` is the playback frame (null for the finished picture): only what has happened
 * by then shows.
 */
export function drawCourseTop(ctx, world, commands, pose, transform, frame = null) {
  if (!world || world.error) return
  const scale = transform.scale
  const sizes = courseSizes(world)
  const done = frame ? frame.done : (commands?.length ?? 0)
  const { collected, crash } = courseMarksAt(commands ?? [], done)
  ctx.save()
  world.pickups.forEach((pickup, index) => {
    const centre = toCanvasPoint(pickup.x, pickup.y, transform)
    const r = Math.max(5, sizes.pickup * scale)
    if (collected.has(index)) {
      ctx.beginPath()
      ctx.arc(centre.x, centre.y, r * 0.7, 0, Math.PI * 2)
      ctx.setLineDash?.([3, 3])
      ctx.strokeStyle = PICKUP_LINE
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash?.([])
      return
    }
    star(ctx, centre.x, centre.y, r, r * 0.45, 5)
    ctx.fillStyle = PICKUP
    ctx.fill()
    ctx.lineWidth = Math.max(1, 1.5 * scale)
    ctx.strokeStyle = PICKUP_LINE
    ctx.stroke()
  })
  drawCourseVehicle(ctx, world.vehicle, pose, transform, sizes.vehicle)
  if (crash) {
    const centre = toCanvasPoint(crash.x, crash.y, transform)
    const r = Math.max(8, sizes.vehicle * 0.32 * scale)
    star(ctx, centre.x, centre.y, r, r * 0.5, 8)
    ctx.fillStyle = CRASH
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#7f1d1d'
    ctx.stroke()
    star(ctx, centre.x, centre.y, r * 0.45, r * 0.22, 8)
    ctx.fillStyle = '#fef08a'
    ctx.fill()
  }
  ctx.restore()
}
