// Random courses for the Game agent (task field `randomCourses`). Pure and Node-safe.
//
// A course is a small generated map (same characters as a task map: # . R T X C). It is built from
// a seed, so the same seed always gives the same sequence of courses: with `seed: class` every
// student in a lesson gets course 1, 2, 3 ... identical, so a race on them is fair.
//
// Every course is checked before it is used:
//   1. Solvable. A breadth-first search from R reaches T (a pit counts as blocked), as parseMap does.
//   2. No dead-end trap near the way to the treasure. A "trap" is a pocket at least 2 deep: an open
//      square with 3 wall/edge neighbours whose one exit is itself hemmed in by 2 or more walls (a
//      corridor to nowhere; see deadEnds). A robot that senses walls + the treasure compass steers
//      toward the treasure, walks in, turns back and is pulled in again, so a course is rejected
//      when the far end of any such pocket lies within TRAP_NEAR (3) squares of the straight line
//      from R to T (distance in king moves, so a diagonal step is 1). Pockets far from that line,
//      and single notches (depth 1, whose one exit the walls sense shows), are allowed.
// A course that fails is thrown away and the next attempt is made from the same random stream, so
// the result is still the same for the same seed. After MAX_ATTEMPTS the course falls back to an
// open board (no walls, no pits) so generating never fails.
import { MAX_SIZE, parseMap } from './game_agent.js'

export const COURSE_SIZE_MIN = 5
export const COURSE_SIZE_MAX = Math.min(9, MAX_SIZE)
export const COURSE_WALLS_MAX = 0.4
export const COURSE_PITS_MAX = 3
export const COURSE_COINS_MAX = 3
export const COURSE_DEFAULTS = { size: 7, walls: 0.25, pits: 1, coins: 0, seed: 'class' }
export const TRAP_NEAR = 3
export const MAX_ATTEMPTS = 200

const isWhole = (n) => typeof n === 'number' && Number.isInteger(n)
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

// mulberry32, the same generator the learning code uses.
function makeRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const hasRandomCourses = (task) => isObject(task?.randomCourses)

// The task's settings with defaults filled in, or null when the task has no randomCourses.
export function courseSpecOf(task) {
  if (!hasRandomCourses(task)) return null
  const given = task.randomCourses
  const num = (v, lo, hi, fallback, whole) =>
    typeof v === 'number' && Number.isFinite(v) && (!whole || isWhole(v))
      ? Math.min(hi, Math.max(lo, v))
      : fallback
  return {
    size: num(given.size, COURSE_SIZE_MIN, COURSE_SIZE_MAX, COURSE_DEFAULTS.size, true),
    walls: num(given.walls, 0, COURSE_WALLS_MAX, COURSE_DEFAULTS.walls, false),
    pits: num(given.pits, 0, COURSE_PITS_MAX, COURSE_DEFAULTS.pits, true),
    coins: num(given.coins, 0, COURSE_COINS_MAX, COURSE_DEFAULTS.coins, true),
    seed: isWhole(given.seed) && given.seed >= 0 ? given.seed : 'class',
  }
}

// The number the courses grow from. A number seed is used as it is. `class` comes from the lesson id
// (a live session runs on the lesson id, so every student in it gets the same one) and the task id,
// so two course tasks in one lesson differ. Without a lesson id (Builder preview) it is the task id.
export function courseSeedOf(task, lessonId) {
  const spec = courseSpecOf(task)
  if (!spec) return 0
  if (spec.seed !== 'class') return spec.seed >>> 0
  return hashString(`class|${lessonId ?? ''}|${task?.id ?? ''}`)
}

// Squares on the straight line from a to b (inclusive), as [row, col].
function lineCells(size, a, b) {
  const ar = Math.floor(a / size)
  const ac = a % size
  const br = Math.floor(b / size)
  const bc = b % size
  const n = Math.max(Math.abs(br - ar), Math.abs(bc - ac), 1)
  const out = []
  for (let i = 0; i <= n; i += 1) {
    out.push([Math.round(ar + ((br - ar) * i) / n), Math.round(ac + ((bc - ac) * i) / n)])
  }
  return out
}

const SIDES = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
]
const isClosed = (rows, r, c) =>
  r < 0 || c < 0 || r >= rows.length || c >= rows.length || rows[r][c] === '#'

// The far ends of dead-end pockets at least 2 deep: an open square (not R, T or a pit) with 3
// wall/edge neighbours whose one way out leads to a square that is itself hemmed in (2 or more
// wall/edge neighbours). That is a corridor to nowhere. A single notch (the way out opens onto
// open ground) is not counted: the walls sense shows its one exit, so the robot can learn it.
export function deadEnds(rows) {
  const out = []
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows.length; c += 1) {
      if (!'.C'.includes(rows[r][c])) continue
      const open = SIDES.filter(([dr, dc]) => !isClosed(rows, r + dr, c + dc))
      if (open.length !== 1) continue
      const nr = r + open[0][0]
      const nc = c + open[0][1]
      const hemmed = SIDES.filter(([dr, dc]) => isClosed(rows, nr + dr, nc + dc)).length
      if (hemmed >= 2) out.push([r, c])
    }
  }
  return out
}

// True when such a pocket's far end lies within TRAP_NEAR squares of the straight line from R to T.
export function hasDeadEndTrap(rows) {
  const size = rows.length
  const flat = rows.join('')
  const line = lineCells(size, flat.indexOf('R'), flat.indexOf('T'))
  return deadEnds(rows).some(([r, c]) =>
    line.some(([lr, lc]) => Math.max(Math.abs(lr - r), Math.abs(lc - c)) <= TRAP_NEAR)
  )
}

function attempt(spec, random) {
  const { size } = spec
  const total = size * size
  const pick = () => Math.floor(random() * total)
  const start = pick()
  // The treasure is far from the start: at least size - 1 squares away when that can be found.
  let treasure = pick()
  for (let i = 0; i < 30; i += 1) {
    const dist =
      Math.abs(Math.floor(treasure / size) - Math.floor(start / size)) +
      Math.abs((treasure % size) - (start % size))
    if (treasure !== start && dist >= size - 1) break
    treasure = pick()
  }
  if (treasure === start) treasure = (start + size + 1) % total
  const cells = Array.from({ length: total }, (_, i) =>
    i === start ? 'R' : i === treasure ? 'T' : random() < spec.walls ? '#' : '.'
  )
  const put = (char, count) => {
    const free = cells.map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0)
    for (let k = 0; k < count && free.length; k += 1) {
      cells[free.splice(Math.floor(random() * free.length), 1)[0]] = char
    }
  }
  put('X', spec.pits)
  put('C', spec.coins)
  const rows = []
  for (let r = 0; r < size; r += 1) rows.push(cells.slice(r * size, (r + 1) * size).join(''))
  return rows
}

// Course number `index` (0 for the first) of the sequence for `seed`:
// { rows, env, attempts, fallback }. Same spec + seed + index, same course, always.
export function generateCourse(spec, seed, index) {
  const random = makeRandom(((seed >>> 0) + Math.imul(index + 1, 0x9e3779b1)) >>> 0)
  random() // the first value of two close seeds is too alike: skip it
  for (let tries = 1; tries <= MAX_ATTEMPTS; tries += 1) {
    const rows = attempt(spec, random)
    const { env } = parseMap(rows)
    if (env && !hasDeadEndTrap(rows)) return { rows, env, attempts: tries, fallback: false }
  }
  const rows = attempt({ ...spec, walls: 0, pits: 0, coins: 0 }, random)
  return { rows, env: parseMap(rows).env, attempts: MAX_ATTEMPTS, fallback: true }
}

// The course a press of "Try a new course" runs: number `count` (0 for the first), or null when the
// task has none.
export function courseFor(task, lessonId, count) {
  const spec = courseSpecOf(task)
  return spec ? generateCourse(spec, courseSeedOf(task, lessonId), count) : null
}

// Authoring checks. Messages are listed in docs/authoring/validation-errors.md (`…` for each ${...}).
export function validateRandomCourses(task, n) {
  const errors = []
  const warnings = []
  const where = `Task ${n}`
  const given = task?.randomCourses
  if (given === undefined) return { errors, warnings }
  if (!isObject(given)) {
    errors.push(
      `${where}: randomCourses must be an object like { size: 7, walls: 0.25, pits: 1, seed: class }.`
    )
    return { errors, warnings }
  }
  const whole = (key, lo, hi) => {
    const v = given[key]
    if (v !== undefined && (!isWhole(v) || v < lo || v > hi)) {
      errors.push(`${where}: randomCourses.${key} must be a whole number from ${lo} to ${hi}.`)
    }
  }
  whole('size', COURSE_SIZE_MIN, COURSE_SIZE_MAX)
  whole('pits', 0, COURSE_PITS_MAX)
  whole('coins', 0, COURSE_COINS_MAX)
  const w = given.walls
  if (
    w !== undefined &&
    (typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > COURSE_WALLS_MAX)
  ) {
    errors.push(`${where}: randomCourses.walls must be a number from 0 to ${COURSE_WALLS_MAX}.`)
  }
  const s = given.seed
  if (s !== undefined && s !== 'class' && !(isWhole(s) && s >= 0)) {
    errors.push(`${where}: randomCourses.seed must be class or a whole number from 0 up.`)
  }
  if (Array.isArray(task?.testMaps) && task.testMaps.length) {
    warnings.push(`${where}: testMaps are not used when randomCourses is set.`)
  }
  return { errors, warnings }
}
