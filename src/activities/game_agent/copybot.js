// The copy-bot for the Game agent (task field `brain: copy`). Pure and Node-safe.
//
// The student drives the robot over a few practice courses. Every move they make is an example:
// what the robot could sense at that square (the sense vector) and which way they went. Train fits
// a small neural network (a multilayer perceptron: inputs -> 8 hidden neurons -> 4 outputs, one per
// direction) on those examples with stochastic gradient descent. Watch it drive then runs the
// network on a course nobody drove: at each square it picks the output that is lit most.
//
// Everything is deterministic: the network starts from a seeded random state and Train replays the
// same steps, so the saved state only needs the drives and the number of moves that were fitted
// (the network is rebuilt from them, as the Q-learning robot is rebuilt from its episode count).
// Drive badly and it copies the mistakes: that is true by construction, it learns only from them.
import {
  ACTIONS,
  MAX_TEST_MOVES,
  initialGameAgentState,
  stepWorld,
  withCourseResult,
} from './game_agent.js'
import { courseFor, trainingCourseFor } from './courses.js'

export const HIDDEN = 8
export const FIT_STEPS = 600 // SGD steps in one press of Train
export const STEPS_PER_FRAME = 60 // the work per animation frame (a low-end Chromebook stays smooth)
export const LEARNING_RATE = 0.3
export const MAX_EXAMPLES = 200 // moves recorded in all
export const MAX_DRIVE_COURSES = 6
const NET_SEED = 20261028

// Up, right, down, left: the same order as ACTIONS.
const SIDE_WORDS = ['up', 'right', 'down', 'left']
const REVISIT = 0.05
const NO_REWARDS = { treasure: 0, step: 0, wall: 0, pit: 0, coin: 0 }

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rowOf = (env, s) => Math.floor(s / env.cols)
const colOf = (env, s) => s % env.cols

function cellAt(env, s, a) {
  const r = rowOf(env, s) + ACTIONS[a].dr
  const c = colOf(env, s) + ACTIONS[a].dc
  if (r < 0 || c < 0 || r >= env.rows || c >= env.cols) return 'edge'
  return env.cells[r * env.cols + c]
}
function nextSquare(env, s, a) {
  return cellAt(env, s, a) === 'edge'
    ? -1
    : (rowOf(env, s) + ACTIONS[a].dr) * env.cols + colOf(env, s) + ACTIONS[a].dc
}
const blocked = (env, s, a) => ['edge', 'wall'].includes(cellAt(env, s, a))

// Four lights for "the thing is up / right / down / left of me" (a diagonal lights two).
function direction(env, from, to, ways) {
  if (to == null || to < 0 || to === from) return [0, 0, 0, 0]
  const dr = rowOf(env, to) - rowOf(env, from)
  const dc = colOf(env, to) - colOf(env, from)
  if (ways === 4) {
    if (Math.abs(dr) >= Math.abs(dc)) return dr < 0 ? [1, 0, 0, 0] : [0, 0, 1, 0]
    return dc > 0 ? [0, 1, 0, 0] : [0, 0, 0, 1]
  }
  return [dr < 0 ? 1 : 0, dc > 0 ? 1 : 0, dr > 0 ? 1 : 0, dc < 0 ? 1 : 0]
}

function nearestCoin(env, pos, taken) {
  let best = -1
  let bestDist = Infinity
  for (const coin of env.coins ?? []) {
    if (taken?.has(coin)) continue
    const d =
      Math.abs(rowOf(env, coin) - rowOf(env, pos)) + Math.abs(colOf(env, coin) - colOf(env, pos))
    if (d < bestDist) {
      best = coin
      bestDist = d
    }
  }
  return best
}

const hasCompass = (senses) =>
  senses.includes('treasure_direction') || senses.includes('treasure_direction_4')

// The names of the input neurons for these senses, in order (for the network picture).
export function inputNames(senses) {
  const out = []
  const sides = (label) => SIDE_WORDS.forEach((w) => out.push(`${label} ${w}`))
  if (senses.includes('position')) out.push('row', 'column')
  if (senses.includes('walls')) sides('wall')
  if (hasCompass(senses)) sides('treasure')
  if (senses.includes('pit_near')) sides('pit')
  if (senses.includes('coin_direction')) sides('coin')
  return out
}

// What the robot senses at square `pos` as numbers (0 or 1, position 0 to 1), in inputNames order.
export function featuresAt(env, pos, senses, taken) {
  const x = []
  if (senses.includes('position')) {
    x.push(rowOf(env, pos) / Math.max(1, env.rows - 1), colOf(env, pos) / Math.max(1, env.cols - 1))
  }
  if (senses.includes('walls')) for (let a = 0; a < 4; a += 1) x.push(blocked(env, pos, a) ? 1 : 0)
  if (hasCompass(senses)) {
    x.push(...direction(env, pos, env.treasure, senses.includes('treasure_direction') ? 8 : 4))
  }
  if (senses.includes('pit_near')) {
    for (let a = 0; a < 4; a += 1) x.push(cellAt(env, pos, a) === 'pit' ? 1 : 0)
  }
  if (senses.includes('coin_direction')) {
    x.push(...direction(env, pos, nearestCoin(env, pos, taken), 8))
  }
  return x
}

// ---------------------------------------------------------------- the network

export function newNet(nIn) {
  const random = mulberry(NET_SEED)
  const spread = () => random() - 0.5
  return {
    nIn,
    w1: Array.from({ length: HIDDEN }, () => Array.from({ length: nIn }, spread)),
    b1: Array.from({ length: HIDDEN }, () => 0),
    w2: Array.from({ length: 4 }, () => Array.from({ length: HIDDEN }, spread)),
    b2: [0, 0, 0, 0],
    steps: 0,
  }
}

// Run the network: the hidden neurons' lights (-1 to 1) and the four outputs (they add up to 1).
export function forward(net, x) {
  const h = net.w1.map((row, j) =>
    Math.tanh(row.reduce((sum, w, i) => sum + w * (x[i] ?? 0), net.b1[j]))
  )
  const z = net.w2.map((row, k) => row.reduce((sum, w, j) => sum + w * h[j], net.b2[k]))
  const top = Math.max(...z)
  const e = z.map((v) => Math.exp(v - top))
  const total = e.reduce((a, b) => a + b, 0)
  return { h, out: e.map((v) => v / total) }
}

export const chosenMove = (out) => out.indexOf(Math.max(...out))

function sgdStep(net, x, y) {
  const { h, out } = forward(net, x)
  const dz = out.map((p, k) => p - (k === y ? 1 : 0))
  const dh = h.map((hj, j) => dz.reduce((sum, d, k) => sum + d * net.w2[k][j], 0) * (1 - hj * hj))
  for (let k = 0; k < 4; k += 1) {
    for (let j = 0; j < HIDDEN; j += 1) net.w2[k][j] -= LEARNING_RATE * dz[k] * h[j]
    net.b2[k] -= LEARNING_RATE * dz[k]
  }
  for (let j = 0; j < HIDDEN; j += 1) {
    for (let i = 0; i < net.nIn; i += 1) net.w1[j][i] -= LEARNING_RATE * dh[j] * (x[i] ?? 0)
    net.b1[j] -= LEARNING_RATE * dh[j]
  }
}

// Fit more steps to the network: step k looks at a seeded-random example. Chunks add up to the
// same network as one call, so a run can be split across animation frames.
export function fitSteps(net, examples, count) {
  if (!examples.length) return net
  for (let i = 0; i < count; i += 1) {
    const random = mulberry(NET_SEED + 1 + net.steps)
    const e = examples[Math.floor(random() * examples.length)]
    sgdStep(net, e.x, e.y)
    net.steps += 1
  }
  return net
}

export const fitNet = (examples, nIn) => fitSteps(newNet(nIn), examples, FIT_STEPS)

// ---------------------------------------------------------------- the drives

// A drive is { c, moves }: training course number c and the U/R/D/L letters driven on it.
export const movesDriven = (drives) => drives.reduce((n, d) => n + d.moves.length, 0)
export const coursesDriven = (drives) => drives.filter((d) => d.moves.length > 0).length

// Walk a drive on its course: the squares visited, whether it ended (treasure or pit), the score.
export function replayDrive(env, rewards, moves) {
  let s = env.start
  const taken = new Set()
  const cells = [s]
  let done = false
  let reached = false
  let score = 0
  for (const letter of moves) {
    if (done) break
    const a = ACTIONS.findIndex((x) => x.letter === letter)
    if (a < 0) break
    const out = stepWorld(env, rewards, s, a, taken)
    s = out.s
    score += out.reward
    cells.push(s)
    if (out.done) {
      done = true
      reached = out.reached
    }
  }
  return { s, cells, done, reached, score, taken }
}

// The examples a list of drives makes: [{ x: sense vector, y: move }], at most `limit`.
// `envFor(c)` gives the env of training course c.
export function examplesOf(drives, envFor, senses, limit = MAX_EXAMPLES) {
  const out = []
  for (const drive of drives) {
    const env = envFor(drive.c)
    if (!env) continue
    let s = env.start
    const taken = new Set()
    for (const letter of drive.moves) {
      const a = ACTIONS.findIndex((m) => m.letter === letter)
      if (a < 0 || out.length >= limit) break
      out.push({ x: featuresAt(env, s, senses, taken), y: a })
      const step = stepWorld(env, NO_REWARDS, s, a, taken)
      s = step.s
      if (step.done) break
    }
  }
  return out
}

// Run the network on a course with no learning: { moves, cells, score, steps, reached, acts }.
// `acts` holds what each neuron showed on each step (for the picture).
export function netRun(env, rewards, net, senses) {
  let s = env.start
  const taken = new Set()
  const cells = [s]
  const acts = []
  let moves = ''
  let score = 0
  let reached = false
  const cap = Math.min(env.cap, MAX_TEST_MOVES)
  const bumped = new Set()
  const visits = new Map([[s, 1]])
  for (let i = 0; i < cap; i += 1) {
    const x = featuresAt(env, s, senses, taken)
    const { h, out } = forward(net, x)
    // The most lit output, but it does not walk into the same wall twice from one square, and a
    // square it has already stood on counts against a move (so it does not go round in circles).
    const worth = (k) => {
      if (bumped.has(`${s}:${k}`)) return -Infinity
      const next = nextSquare(env, s, k)
      return out[k] - REVISIT * (next >= 0 ? (visits.get(next) ?? 0) : 0)
    }
    const a = [0, 1, 2, 3].sort((p, q) => worth(q) - worth(p) || p - q)[0]
    acts.push({ x, h, out, move: a })
    const step = stepWorld(env, rewards, s, a, taken)
    if (step.bumped) bumped.add(`${s}:${a}`)
    moves += ACTIONS[a].letter
    score += step.reward
    s = step.s
    visits.set(s, (visits.get(s) ?? 0) + 1)
    cells.push(s)
    if (step.done) {
      reached = step.reached
      break
    }
  }
  return { moves, cells, score, steps: moves.length, reached, acts }
}

// A scripted driver for tests: a shortest way from R to T (a pit is not a way through), as letters.
// Where several moves are on a shortest way it goes sideways before up or down, always the same
// habit (a driver who zigzags gives a robot with a compass nothing steady to copy).
export function shortestWay(env) {
  const dist = new Map([[env.treasure, 0]])
  const queue = [env.treasure]
  while (queue.length) {
    const s = queue.shift()
    ACTIONS.forEach((a) => {
      const r = rowOf(env, s) + a.dr
      const c = colOf(env, s) + a.dc
      if (r < 0 || c < 0 || r >= env.rows || c >= env.cols) return
      const n = r * env.cols + c
      if (dist.has(n) || env.cells[n] === 'wall' || env.cells[n] === 'pit') return
      dist.set(n, dist.get(s) + 1)
      queue.push(n)
    })
  }
  let letters = ''
  let s = env.start
  while (s !== env.treasure && dist.has(s)) {
    const best = [1, 3, 0, 2].find((a) => dist.get(nextSquare(env, s, a)) === dist.get(s) - 1)
    letters += ACTIONS[best].letter
    s = nextSquare(env, s, best)
  }
  return letters
}

// "Complete (show answers)" for a copy-bot task: a good driver on three training courses, a
// trained network, and one run on the first new course.
export function copySolutionFor(task, lessonId = null) {
  const state = initialGameAgentState(task)
  const envFor = (c) => trainingCourseFor(task, lessonId, c)?.env
  const drives = [0, 1, 2].map((c) => ({ c, moves: shortestWay(envFor(c)) }))
  const examples = examplesOf(drives, envFor, state.senses)
  const net = fitNet(examples, examples[0].x.length)
  const trained = { ...state, drives, driveCourse: drives.length, trained: examples.length }
  const run = netRun(courseFor(task, lessonId, 0).env, state.rewards, net, state.senses)
  return withCourseResult(trained, run)
}
