/**
 * Turtle course mode: a task's `course` field turns the turtle into a vehicle driven round a map
 * (docs/authoring/turtle.md "Course mode"). This file is the pure model: reading the task field,
 * building a map's "world" (walls, goal, pickups, start) in turtle coordinates, geometry,
 * validation and the screen-reader words. No DOM, no Pyodide.
 *
 * Two kinds of course:
 * - `type: grid`: a text map. `#` wall, `.` road, `G` goal, `*` pickup, `> < ^ v` start and
 *   heading (east, west, north, south); a space is off the map (a wall). The map is scaled to fit
 *   the 400 × 400 turtle world; forward() moves whole squares and turns are quarter turns.
 * - `type: track`: free movement in turtle coordinates (centre (0, 0), y up, ±200).
 *   `start: { x, y, heading }`, `goal: { x, y, r }` (a circle) or `goal: { rect: [x1, y1, x2, y2] }`,
 *   `walls: [[x1, y1, x2, y2], { rect: [x1, y1, x2, y2] }, …]`, `pickups: [[x, y], …]` and an
 *   optional `trackCode` Turtle snippet whose lines become walls (./trackCode.js). The edge of the
 *   picture is a wall too.
 *
 * `map` holds one map; `maps` a list played one after another (the same program runs on each).
 * A track's own fields may sit straight on `course` instead of in `map`.
 *
 * Student-made maps (P6-16): a grid course with `studentMap: true` lets the student's code call
 * `turtle.course_map(text)` to drive its own map instead (see "Student-made maps" below). The
 * authored `map` is shown until the student sets one.
 */
import { TURTLE_LOGICAL_WIDTH, TURTLE_LOGICAL_HEIGHT } from './engine.js'
import { trackCodeSegments } from './trackCode.js'

export const COURSE_TYPES = ['grid', 'track']
export const COURSE_VEHICLES = ['turtle', 'car', 'rover', 'boat', 'drone']
export const DEFAULT_COURSE_VEHICLE = 'turtle'
export const COURSE_MAX_MAPS = 6
export const GRID_MAX_SIZE = 30
export const GRID_LEGEND = {
  '#': 'wall',
  '.': 'road',
  G: 'goal',
  '*': 'pickup',
  '>': 'start',
  '<': 'start',
  '^': 'start',
  v: 'start',
  ' ': 'off',
}
const START_HEADINGS = { '>': 0, '^': 90, '<': 180, v: 270 }

// Track mode: the vehicle is a circle this many turtle units across from its centre to its edge.
export const TRACK_VEHICLE_RADIUS = 10
// How far ahead (or to the side) wall_ahead() / wall_left() / wall_right() look on a track.
export const TRACK_SENSOR_RANGE = 30
// A pickup on a track is collected when the vehicle's centre passes this close to it.
export const TRACK_PICKUP_REACH = 12
export const TRACK_DEFAULT_GOAL_RADIUS = 20
// The faint trail the vehicle leaves (its pen, down by default).
export const COURSE_TRAIL_COLOR = '#93c5fd'

const HALF_W = TURTLE_LOGICAL_WIDTH / 2
const HALF_H = TURTLE_LOGICAL_HEIGHT / 2

// ── Reading the task field ─────────────────────────────────────────────────────

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const TRACK_FIELDS = ['start', 'goal', 'walls', 'pickups', 'trackCode']

/**
 * The task's course, normalised: { type, vehicle, maps: [map spec] }, or null when the task has
 * none (or it is unusable). A grid map spec is its text; a track map spec is an object.
 */
export function getTaskCourse(task) {
  const course = task?.course
  if (!isPlainObject(course)) return null
  const type = COURSE_TYPES.includes(course.type) ? course.type : null
  if (!type) return null
  const vehicle = COURSE_VEHICLES.includes(course.vehicle) ? course.vehicle : DEFAULT_COURSE_VEHICLE
  let maps
  if (Array.isArray(course.maps)) maps = course.maps
  else if (course.map !== undefined && course.map !== null) maps = [course.map]
  else if (type === 'track' && TRACK_FIELDS.some((field) => course[field] !== undefined)) {
    maps = [Object.fromEntries(TRACK_FIELDS.map((field) => [field, course[field]]))]
  } else maps = []
  maps = maps.slice(0, COURSE_MAX_MAPS)
  if (maps.length === 0) return null
  // Student-made maps are for grid courses only (validation errors on a track).
  const studentMap = type === 'grid' && course.studentMap === true
  return { type, vehicle, maps, ...(studentMap ? { studentMap: true } : {}) }
}

export function hasTaskCourse(task) {
  return getTaskCourse(task) !== null
}

/** What the runtime sends the worker for map `index` (see ./shim.js buildTurtleProgram). */
export function courseRunSpec(course, index, taskId = null) {
  return {
    type: course.type,
    vehicle: course.vehicle,
    map: course.maps[index],
    index,
    count: course.maps.length,
    ...(taskId !== null && taskId !== undefined ? { taskId: String(taskId) } : {}),
    ...(course.studentMap ? { studentMap: true } : {}),
  }
}

// ── Grid maps ──────────────────────────────────────────────────────────────────

/** A grid map's rows ({ rows: string[] } or { error }), before any world is built. */
export function readGridRows(text) {
  if (typeof text !== 'string') return { error: 'a grid map must be text, one line per row' }
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+$/, ''))
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (lines.length === 0) return { error: 'the grid map is empty' }
  return { rows: lines }
}

/** Problems with a grid map's text, in words (empty when it's fine). */
export function gridMapProblems(text) {
  const read = readGridRows(text)
  if (read.error) return [read.error]
  const { rows } = read
  const problems = []
  const cols = Math.max(...rows.map((row) => row.length))
  if (rows.length > GRID_MAX_SIZE || cols > GRID_MAX_SIZE) {
    problems.push(
      `the grid map is ${cols} × ${rows.length}; the most is ${GRID_MAX_SIZE} × ${GRID_MAX_SIZE}`
    )
  }
  const unknown = new Set()
  let starts = 0
  let goals = 0
  rows.forEach((row) => {
    for (const ch of row) {
      if (!(ch in GRID_LEGEND)) unknown.add(ch)
      else if (GRID_LEGEND[ch] === 'start') starts += 1
      else if (GRID_LEGEND[ch] === 'goal') goals += 1
    }
  })
  if (unknown.size) {
    problems.push(
      `the grid map uses ${[...unknown].map((c) => `"${c}"`).join(', ')}; use # wall, . road, G goal, * pickup and one of > < ^ v for the start`
    )
  }
  if (starts !== 1) {
    problems.push(
      starts === 0
        ? 'the grid map has no start: put one of > < ^ v where the vehicle starts'
        : `the grid map has ${starts} starts; it needs exactly one of > < ^ v`
    )
  }
  if (goals === 0) problems.push('the grid map has no goal: put a G where the vehicle should end')
  return problems
}

function buildGridWorld(text, vehicle) {
  const read = readGridRows(text)
  if (read.error) return { error: read.error }
  const problems = gridMapProblems(text)
  if (problems.length) return { error: problems[0] }
  const rowsText = read.rows
  const rows = rowsText.length
  const cols = Math.max(...rowsText.map((row) => row.length))
  const cell = Math.min(TURTLE_LOGICAL_WIDTH / cols, TURTLE_LOGICAL_HEIGHT / rows)
  const left = -(cols * cell) / 2
  const top = (rows * cell) / 2
  const cells = []
  const goals = []
  const pickups = []
  let start = null
  for (let r = 0; r < rows; r += 1) {
    const line = []
    for (let c = 0; c < cols; c += 1) {
      const ch = rowsText[r][c] ?? ' '
      const kind = GRID_LEGEND[ch] ?? 'off'
      if (kind === 'start') {
        start = { row: r, col: c, heading: START_HEADINGS[ch] }
        line.push('road')
      } else {
        line.push(kind)
      }
      if (kind === 'goal') goals.push({ row: r, col: c })
      if (kind === 'pickup') pickups.push({ row: r, col: c })
    }
    cells.push(line)
  }
  const world = { type: 'grid', vehicle, rows, cols, cell, left, top, cells, goals }
  world.pickups = pickups.map((p) => ({ ...p, ...gridCellCentre(world, p.row, p.col) }))
  world.start = { ...gridCellCentre(world, start.row, start.col), heading: start.heading }
  return world
}

/** The turtle-coordinate centre of grid square (row, col) (0-based, row 0 at the top). */
export function gridCellCentre(world, row, col) {
  return { x: world.left + (col + 0.5) * world.cell, y: world.top - (row + 0.5) * world.cell }
}

/** The grid square a turtle point is in: { row, col } (may be off the map). */
export function gridCellAt(world, x, y) {
  return {
    row: Math.floor((world.top - y) / world.cell + 1e-9),
    col: Math.floor((x - world.left) / world.cell + 1e-9),
  }
}

export function gridCellKind(world, row, col) {
  if (row < 0 || col < 0 || row >= world.rows || col >= world.cols) return 'off'
  return world.cells[row][col]
}

export function isGridBlocked(world, row, col) {
  const kind = gridCellKind(world, row, col)
  return kind === 'wall' || kind === 'off'
}

/** The (row, col) step for a heading that is a whole quarter turn, or null for any other. */
export function gridStep(heading) {
  const h = ((Math.round(Number(heading)) % 360) + 360) % 360
  if (Math.abs(Number(heading) - Math.round(Number(heading))) > 1e-6) return null
  return (
    { 0: { dr: 0, dc: 1 }, 90: { dr: -1, dc: 0 }, 180: { dr: 0, dc: -1 }, 270: { dr: 1, dc: 0 } }[
      h
    ] ?? null
  )
}

// ── Student-made maps (course.studentMap, turtle.course_map) ───────────────────

const NUMBER_WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' }

/**
 * A student's map text tidied for use: line endings, trailing spaces and blank lines at either
 * end dropped, and the indentation every line shares removed (so a triple-quoted string inside a
 * function is fine). Null when it isn't text or has no rows.
 */
export function normalizeStudentMapText(text) {
  if (typeof text !== 'string') return null
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (lines.length === 0) return null
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length)
  )
  return lines.map((line) => line.slice(indent)).join('\n')
}

function describeCharacter(ch) {
  return ch === '\t' ? 'a tab' : `"${ch}"`
}

/**
 * Problems with a map the student's code passed to turtle.course_map(), in plain words for an
 * 11–16 year old (empty when it's fine). The same legend and limits as an authored grid map
 * (gridMapProblems): one start, at least one goal, at most 30 × 30.
 */
export function studentMapProblems(text, vehicle = DEFAULT_COURSE_VEHICLE) {
  if (typeof text !== 'string') {
    return ['course_map() needs your map as text in triple quotes: turtle.course_map("""…""")']
  }
  const tidy = normalizeStudentMapText(text)
  if (!tidy) {
    return [
      'Your map is empty: draw it with # for walls, . for road, G for the goal and > for the start',
    ]
  }
  const rows = tidy.split('\n')
  const cols = Math.max(...rows.map((row) => row.length))
  const name = vehicleName(vehicle)
  const problems = []
  if (rows.length > GRID_MAX_SIZE) {
    problems.push(`Your map is ${rows.length} rows tall; the most is ${GRID_MAX_SIZE}`)
  }
  if (cols > GRID_MAX_SIZE) {
    problems.push(`Your map is ${cols} squares wide; the most is ${GRID_MAX_SIZE}`)
  }
  const unknown = new Set()
  const startMarks = new Set()
  let starts = 0
  let goals = 0
  rows.forEach((row) => {
    for (const ch of row) {
      if (!(ch in GRID_LEGEND)) unknown.add(ch)
      else if (GRID_LEGEND[ch] === 'start') {
        starts += 1
        startMarks.add(ch)
      } else if (GRID_LEGEND[ch] === 'goal') goals += 1
    }
  })
  if (unknown.size) {
    problems.push(
      `Your map uses ${[...unknown].map(describeCharacter).join(', ')}: use # for walls, . for road, G for the goal, * for stars and > for the start`
    )
  }
  if (starts === 0) {
    problems.push(
      `Your map needs a start: put > where the ${name} begins (or < ^ v to face another way)`
    )
  } else if (starts > 1) {
    problems.push(
      `Your map has ${NUMBER_WORDS[starts] ?? starts} starts (${[...startMarks].join(' ')}): keep just one`
    )
  }
  if (goals === 0) problems.push('Your map needs a G for the goal')
  return problems
}

/** Whether a line of `code` that isn't a comment calls course_map(. */
export function codeCallsCourseMap(code) {
  return String(code ?? '')
    .split('\n')
    .some((line) => {
      const at = line.search(/\bcourse_map\s*\(/)
      return at >= 0 && !line.slice(0, at).includes('#')
    })
}

const STRING_ESCAPES = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"' }

/**
 * The first course_map("…") call in `code` whose argument is a plain string literal
 * (triple-quoted, or on one line with \n escapes): { text, start, end }, where start and end span
 * the literal (its quotes and any prefix), or null. Calls in comments are skipped.
 */
export function findStudentMapCall(code) {
  const source = String(code ?? '')
  const pattern = /\bcourse_map\s*\(\s*([rRuU]?)("""|'''|"|')/g
  let match
  while ((match = pattern.exec(source))) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1
    if (source.slice(lineStart, match.index).includes('#')) continue
    const prefix = match[1]
    const quote = match[2]
    const start = match.index + match[0].length - quote.length - prefix.length
    const bodyStart = match.index + match[0].length
    let text = null
    let close = -1
    if (quote.length === 3) {
      close = source.indexOf(quote, bodyStart)
      if (close >= 0) text = source.slice(bodyStart, close)
    } else {
      const raw = /[rR]/.test(prefix)
      let out = ''
      for (let i = bodyStart; i < source.length; i += 1) {
        const ch = source[i]
        if (ch === '\n') break
        if (ch === '\\' && !raw && i + 1 < source.length) {
          out += STRING_ESCAPES[source[i + 1]] ?? `\\${source[i + 1]}`
          i += 1
          continue
        }
        if (ch === quote) {
          close = i
          text = out
          break
        }
        out += ch
      }
    }
    if (text === null) continue
    const end = close + quote.length
    if (!/^\s*\)/.test(source.slice(end))) continue
    return { text, start, end }
  }
  return null
}

/** The map the student's code sets with course_map(), tidied, when it's usable; else null. */
export function readStudentMapFromCode(code, vehicle = DEFAULT_COURSE_VEHICLE) {
  const call = findStudentMapCall(code)
  if (!call || studentMapProblems(call.text, vehicle).length) return null
  return normalizeStudentMapText(call.text)
}

/**
 * `code` with its course_map() map replaced by `mapText` (as a triple-quoted string), or, when
 * the code has no such call, a call added straight after `import turtle` (or at the top, with
 * the import, when there is none).
 */
export function writeStudentMapToCode(code, mapText) {
  const source = String(code ?? '')
  const literal = `"""\n${mapText}\n"""`
  const call = findStudentMapCall(source)
  if (call) return source.slice(0, call.start) + literal + source.slice(call.end)
  const lines = source.split('\n')
  const importAt = lines.findIndex((line) => /^import\s+turtle(\s+as\s+\w+)?\s*(#.*)?$/.test(line))
  if (importAt >= 0) {
    const alias = lines[importAt].match(/^import\s+turtle\s+as\s+(\w+)/)?.[1] ?? 'turtle'
    lines.splice(importAt + 1, 0, `${alias}.course_map(${literal})`)
    return lines.join('\n')
  }
  return `import turtle\nturtle.course_map(${literal})\n${source}`
}

/**
 * The maps a course picture shows: { maps, studentMap }, where `studentMap` says the student's
 * own map is shown.
 * - A run that used the student's map (a run map's `studentMap` text): that map.
 * - No run result with a course part yet (or a slow-mo step or scrub preview, which have none):
 *   on a studentMap course, the usable map in the student's code (`previewMap`), if any.
 * - Otherwise the task's maps.
 */
export function courseMapsShown(course, courseResult = null, previewMap = null) {
  if (!course) return { maps: [], studentMap: false }
  const runMaps = Array.isArray(courseResult?.maps) ? courseResult.maps : null
  if (runMaps && runMaps.length) {
    const own = runMaps.map((map) =>
      typeof map?.studentMap === 'string' && map.studentMap ? map.studentMap : null
    )
    if (!own.some(Boolean)) return { maps: course.maps, studentMap: false }
    return {
      maps: runMaps.map((_, i) => own[i] ?? course.maps[i] ?? course.maps[0]),
      studentMap: true,
    }
  }
  if (course.studentMap && typeof previewMap === 'string' && previewMap) {
    return { maps: [previewMap], studentMap: true }
  }
  return { maps: course.maps, studentMap: false }
}

// ── Track maps ─────────────────────────────────────────────────────────────────

function num(value) {
  const n = Number(value)
  return value !== null && value !== '' && value !== undefined && Number.isFinite(n) ? n : null
}

function readNumbers(list, count) {
  if (!Array.isArray(list) || list.length !== count) return null
  const values = list.map(num)
  return values.some((v) => v === null) ? null : values
}

function readPoint(value) {
  if (Array.isArray(value)) {
    const values = readNumbers(value, 2)
    return values ? { x: values[0], y: values[1] } : null
  }
  if (isPlainObject(value)) {
    const x = num(value.x)
    const y = num(value.y)
    return x === null || y === null ? null : { x, y }
  }
  return null
}

function readRect(list) {
  const values = readNumbers(list, 4)
  if (!values) return null
  const [x1, y1, x2, y2] = values
  return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) }
}

function rectSegments(rect) {
  const { x1, y1, x2, y2 } = rect
  return [
    { x1, y1, x2, y2: y1 },
    { x1: x2, y1, x2, y2 },
    { x1: x2, y1: y2, x2: x1, y2 },
    { x1, y1: y2, x2: x1, y2: y1 },
  ]
}

const BORDER_SEGMENTS = rectSegments({ x1: -HALF_W, y1: -HALF_H, x2: HALF_W, y2: HALF_H })

/** Problems with a track map, in words (empty when it's fine). */
export function trackMapProblems(map) {
  if (!isPlainObject(map)) return ['a track map must be an object with start, goal and walls']
  const problems = []
  if (map.start !== undefined) {
    if (!isPlainObject(map.start)) problems.push('start must be { x, y, heading }')
    else {
      for (const key of ['x', 'y', 'heading']) {
        if (map.start[key] !== undefined && num(map.start[key]) === null) {
          problems.push(`start.${key} must be a number`)
        }
      }
      const x = num(map.start.x) ?? 0
      const y = num(map.start.y) ?? 0
      if (Math.abs(x) > HALF_W || Math.abs(y) > HALF_H) {
        problems.push(`start (${x}, ${y}) is outside the picture (x and y run from -200 to 200)`)
      }
    }
  }
  const goal = map.goal
  if (goal === undefined || goal === null) {
    problems.push(
      'the track has no goal: add goal: { x, y, r } or goal: { rect: [x1, y1, x2, y2] }'
    )
  } else if (!isPlainObject(goal)) {
    problems.push('goal must be { x, y, r } or { rect: [x1, y1, x2, y2] }')
  } else if (goal.rect !== undefined) {
    if (!readRect(goal.rect)) problems.push('goal.rect must be four numbers: [x1, y1, x2, y2]')
  } else if (!readPoint(goal)) {
    problems.push('goal needs x and y (and r for its size), or rect: [x1, y1, x2, y2]')
  } else if (goal.r !== undefined && !(num(goal.r) > 0)) {
    problems.push('goal.r must be a number above 0')
  }
  if (map.walls !== undefined) {
    if (!Array.isArray(map.walls)) problems.push('walls must be a list')
    else {
      map.walls.forEach((wall, index) => {
        const ok = Array.isArray(wall)
          ? !!readNumbers(wall, 4)
          : isPlainObject(wall) && !!readRect(wall.rect)
        if (!ok) {
          problems.push(
            `wall ${index + 1} must be a line [x1, y1, x2, y2] or a box { rect: [x1, y1, x2, y2] }`
          )
        }
      })
    }
  }
  if (map.pickups !== undefined) {
    if (!Array.isArray(map.pickups)) problems.push('pickups must be a list of [x, y] points')
    else {
      map.pickups.forEach((pickup, index) => {
        if (!readPoint(pickup)) problems.push(`pickup ${index + 1} must be [x, y]`)
      })
    }
  }
  if (map.trackCode !== undefined && map.trackCode !== null) {
    if (typeof map.trackCode !== 'string') problems.push('trackCode must be text')
    else {
      const parsed = trackCodeSegments(map.trackCode)
      if (parsed.error) problems.push(`trackCode ${parsed.error}`)
    }
  }
  return problems
}

function buildTrackWorld(map, vehicle) {
  const problems = trackMapProblems(map)
  if (problems.length) return { error: problems[0] }
  const start = {
    x: num(map.start?.x) ?? 0,
    y: num(map.start?.y) ?? 0,
    heading: (((num(map.start?.heading) ?? 0) % 360) + 360) % 360,
  }
  const goal =
    map.goal.rect !== undefined
      ? { rect: readRect(map.goal.rect) }
      : { ...readPoint(map.goal), r: num(map.goal.r) ?? TRACK_DEFAULT_GOAL_RADIUS }
  const lines = []
  const rects = []
  for (const wall of map.walls ?? []) {
    if (Array.isArray(wall)) {
      const [x1, y1, x2, y2] = readNumbers(wall, 4)
      lines.push({ x1, y1, x2, y2 })
    } else {
      rects.push(readRect(wall.rect))
    }
  }
  if (typeof map.trackCode === 'string' && map.trackCode.trim()) {
    lines.push(...trackCodeSegments(map.trackCode).segments)
  }
  const segments = [...lines, ...rects.flatMap(rectSegments), ...BORDER_SEGMENTS]
  const pickups = (map.pickups ?? []).map(readPoint)
  return {
    type: 'track',
    vehicle,
    radius: TRACK_VEHICLE_RADIUS,
    start,
    goal,
    lines,
    rects,
    segments,
    pickups,
  }
}

/**
 * A map's world, for map spec `map` of a course of `type`: grid worlds carry rows/cols/cell/cells,
 * track worlds carry segments/rects/lines; both have `start` { x, y, heading }, `pickups`
 * [{ x, y }] and the vehicle. { error } when the map can't be used.
 */
export function buildCourseWorld(type, map, vehicle = DEFAULT_COURSE_VEHICLE) {
  const kind = COURSE_VEHICLES.includes(vehicle) ? vehicle : DEFAULT_COURSE_VEHICLE
  if (type === 'grid') return buildGridWorld(map, kind)
  if (type === 'track') return buildTrackWorld(map, kind)
  return { error: `course type must be grid or track` }
}

/** The worlds of every map in a normalised course (getTaskCourse). */
export function buildCourseWorlds(course) {
  if (!course) return []
  return course.maps.map((map) => buildCourseWorld(course.type, map, course.vehicle))
}

// ── Geometry (track) ───────────────────────────────────────────────────────────

/** Distance from point (px, py) to segment s, and how far along s (0–1) the nearest point is. */
export function pointSegmentDistance(px, py, s) {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const lengthSq = dx * dx + dy * dy
  let t = lengthSq > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / lengthSq : 0
  t = Math.max(0, Math.min(1, t))
  return { distance: Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy)), t }
}

function nearestWallDistance(world, x, y) {
  let best = Infinity
  for (const segment of world.segments) {
    const { distance } = pointSegmentDistance(x, y, segment)
    if (distance < best) best = distance
  }
  return best
}

/**
 * Sweeps the vehicle (a circle of world.radius) from (x1, y1) to (x2, y2): { hit, x, y, t } where
 * (x, y) is how far it gets (the point of contact when `hit`), t the fraction of the way. A move
 * that starts touching a wall may still move away from it.
 */
export function sweepTrack(world, x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (!(length > 0)) return { hit: false, x: x1, y: y1, t: 1 }
  const radius = world.radius
  const stepLength = Math.max(0.5, radius / 4)
  const steps = Math.ceil(length / stepLength)
  let safeT = 0
  let previous = nearestWallDistance(world, x1, y1)
  const at = (t) => ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t })
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const point = at(t)
    const distance = nearestWallDistance(world, point.x, point.y)
    if (distance < radius - 1e-9 && distance < previous - 1e-9) {
      // Narrow the contact down between the last safe point and this one.
      let lo = safeT
      let hi = t
      for (let k = 0; k < 20; k += 1) {
        const mid = (lo + hi) / 2
        const p = at(mid)
        if (nearestWallDistance(world, p.x, p.y) < radius - 1e-9) hi = mid
        else lo = mid
      }
      const contact = at(lo)
      return { hit: true, x: contact.x, y: contact.y, t: lo }
    }
    safeT = t
    previous = distance
  }
  return { hit: false, x: x2, y: y2, t: 1 }
}

/** Whether a track point is in the goal zone. */
export function isInTrackGoal(world, x, y) {
  const goal = world.goal
  if (goal.rect) {
    const r = goal.rect
    return x >= r.x1 - 1e-9 && x <= r.x2 + 1e-9 && y >= r.y1 - 1e-9 && y <= r.y2 + 1e-9
  }
  return Math.hypot(x - goal.x, y - goal.y) <= goal.r + 1e-9
}

// ── Words ──────────────────────────────────────────────────────────────────────

const VEHICLE_NAMES = { turtle: 'turtle', car: 'car', rover: 'rover', boat: 'boat', drone: 'drone' }

export function vehicleName(vehicle) {
  return VEHICLE_NAMES[vehicle] ?? 'turtle'
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 'east', 'north', 'west', 'south' for quarter turns, else '30 degrees'. */
export function compassWord(heading) {
  const h = (((Math.round(Number(heading) * 10) / 10) % 360) + 360) % 360
  return { 0: 'east', 90: 'north', 180: 'west', 270: 'south' }[h] ?? `${h} degrees`
}

function round(value) {
  return Math.round(Number(value))
}

/** Where a pose is, in words: 'row 2, column 3' (grid, 1-based) or 'x 40, y -20' (track). */
export function describeCoursePlace(world, x, y) {
  if (world?.type === 'grid') {
    const { row, col } = gridCellAt(world, x, y)
    return `row ${row + 1}, column ${col + 1}`
  }
  return `x ${round(x)}, y ${round(y)}`
}

function describeGoal(world) {
  if (world.type === 'grid') {
    const goals = world.goals.map((g) => `row ${g.row + 1}, column ${g.col + 1}`)
    return goals.length === 1 ? `Goal at ${goals[0]}.` : `Goals at ${goals.join('; ')}.`
  }
  const goal = world.goal
  if (goal.rect) {
    return `Goal: the box from x ${round(goal.rect.x1)}, y ${round(goal.rect.y1)} to x ${round(goal.rect.x2)}, y ${round(goal.rect.y2)}.`
  }
  return `Goal at x ${round(goal.x)}, y ${round(goal.y)}.`
}

/**
 * The course in words for a screen reader, e.g. 'Rover at row 2, column 3, facing east. 1 of 2
 * pickups collected. Goal at row 1, column 7.' `pose` is where the vehicle is; `collected` how
 * many pickups it has; `outcome` (optional) adds 'It reached the goal.' / 'It crashed.'.
 */
export function describeCourse(world, pose, { collected = 0, mapLabel = '', outcome = null } = {}) {
  if (!world || world.error) return 'Course map.'
  const where = pose ?? world.start
  const name = capitalise(vehicleName(world.vehicle))
  const parts = []
  if (mapLabel) parts.push(`${mapLabel}.`)
  parts.push(
    `${name} at ${describeCoursePlace(world, where.x, where.y)}, facing ${compassWord(where.heading ?? 0)}.`
  )
  if (world.pickups.length) parts.push(`${collected} of ${world.pickups.length} pickups collected.`)
  parts.push(describeGoal(world))
  if (outcome?.crashed) parts.push(outcome.message ? outcome.message : 'It crashed.')
  else if (outcome?.goalReached) parts.push('It reached the goal.')
  return parts.join(' ')
}

// ── Validation (the Builder and the CLI; see ./definition.js) ─────────────────

// A starter's course_map() map row that starts with `#>` reads as a line hint marker
// (src/shared/lineHints.js), which is taken out of the code before students see it.
function studentMapHintClashes(task, n) {
  const sources = [
    ['starter code', task?.starterCode],
    ...(Array.isArray(task?.codeStages) ? task.codeStages : []).map((stage, index) => [
      `code stage ${index + 1}`,
      stage?.code,
    ]),
  ]
  const warnings = []
  const seen = new Set()
  for (const [label, code] of sources) {
    if (typeof code !== 'string' || seen.has(code)) continue
    seen.add(code)
    const call = findStudentMapCall(code)
    if (!call) continue
    if (call.text.split('\n').some((line) => line.trim().startsWith('#>'))) {
      warnings.push(
        `Task ${n} ${label}: a course_map() map row starts with #>, which is read as a line hint and taken out of the code; face that start with ^ or v, or move it one square in`
      )
    }
  }
  return warnings
}

/** Adds errors / warnings for a task's `course` field. */
export function validateTurtleCourse(task, n, errors, warnings = []) {
  const course = task?.course
  if (course === undefined || course === null) return
  if (!isPlainObject(course)) {
    errors.push(`Task ${n} course must be an object with type and map (or maps)`)
    return
  }
  if (!COURSE_TYPES.includes(course.type)) {
    errors.push(`Task ${n} course.type must be grid or track`)
    return
  }
  if (course.vehicle !== undefined && !COURSE_VEHICLES.includes(course.vehicle)) {
    errors.push(`Task ${n} course.vehicle must be one of: ${COURSE_VEHICLES.join(', ')}`)
  }
  if (course.studentMap !== undefined && course.studentMap !== null) {
    if (typeof course.studentMap !== 'boolean') {
      errors.push(`Task ${n} course.studentMap must be true or false`)
    } else if (course.studentMap && course.type !== 'grid') {
      errors.push(
        `Task ${n} course.studentMap only works on grid courses: students can't make their own track yet`
      )
    } else if (course.studentMap) {
      warnings.push(...studentMapHintClashes(task, n))
    }
  }
  if (course.map !== undefined && course.maps !== undefined) {
    errors.push(`Task ${n} course has both map and maps; use one`)
    return
  }
  if (course.maps !== undefined) {
    if (!Array.isArray(course.maps) || course.maps.length === 0) {
      errors.push(`Task ${n} course.maps must be a list of maps`)
      return
    }
    if (course.maps.length > COURSE_MAX_MAPS) {
      errors.push(
        `Task ${n} course.maps has ${course.maps.length} maps; the most is ${COURSE_MAX_MAPS}`
      )
      return
    }
  }
  const normalized = getTaskCourse(task)
  if (!normalized) {
    errors.push(
      course.type === 'grid'
        ? `Task ${n} course has no map: add map: with the grid as text`
        : `Task ${n} course has no track: add map: { start, goal, walls }`
    )
    return
  }
  const many = normalized.maps.length > 1
  normalized.maps.forEach((map, index) => {
    const label = many ? `course map ${index + 1}` : 'course map'
    const problems = course.type === 'grid' ? gridMapProblems(map) : trackMapProblems(map)
    for (const problem of problems) errors.push(`Task ${n} ${label}: ${problem}`)
    if (problems.length) return
    const world = buildCourseWorld(course.type, map, normalized.vehicle)
    if (world.type === 'track') {
      if (nearestWallDistance(world, world.start.x, world.start.y) < world.radius) {
        warnings.push(
          `Task ${n} ${label}: the start is touching a wall, so the vehicle may crash as soon as it moves`
        )
      }
      if (isInTrackGoal(world, world.start.x, world.start.y)) {
        warnings.push(`Task ${n} ${label}: the vehicle starts in the goal`)
      }
    }
  })
}
