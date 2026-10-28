// Pure logic for the Game agent activity: the map, the robot's world, Q-learning written by
// hand, the greedy run, scoring, task validation and grading. Node-safe (no React, JSX or DOM)
// so the CLI, the Builder and print share it.
//
// The student sets the rewards; the robot practises episodes and learns which move is worth
// most from each square (tabular Q-learning). Everything is deterministic: a seeded random
// number generator means the same rewards and the same episode count always give the same
// robot, so a saved state only needs `rewards` + `trained` to be rebuilt (replayed).

export const MAX_SIZE = 10
export const REWARD_MIN = -20
export const REWARD_MAX = 20
export const DEFAULT_EPISODES = 50
export const MAX_EPISODES = 500
export const MAX_SCORES = 40
export const MAX_MOVES = 80

export const DEFAULT_REWARDS = { treasure: 10, step: -1, wall: -5, pit: -10 }
export const DEFAULT_COIN = 3
// `coin` only exists in a task's rewards when its map has a C (see rewardsOf).
export const REWARD_KEYS = ['treasure', 'step', 'wall', 'pit', 'coin']

// What the robot can sense. The learned table is keyed by what the chosen senses report.
export const SENSE_KEYS = [
  'position',
  'walls',
  'treasure_direction',
  'treasure_direction_4',
  'pit_near',
  'coin_direction',
]
export const SENSE_LABELS = {
  position: ['Where I am', '📍'],
  walls: ['Walls next to me', '🧱'],
  treasure_direction: ['Treasure compass (8 ways)', '🧭'],
  treasure_direction_4: ['Treasure compass (4 ways)', '🧭'],
  pit_near: ['Pit next to me', '🕳️'],
  coin_direction: ['Coin compass', '🪙'],
}
export const MAX_TEST_MAPS = 5
export const MAX_TEST_MOVES = 120

// Up, right, down, left. The letters are how a route is stored.
export const ACTIONS = [
  { letter: 'U', dr: -1, dc: 0 },
  { letter: 'R', dr: 0, dc: 1 },
  { letter: 'D', dr: 1, dc: 0 },
  { letter: 'L', dr: 0, dc: -1 },
]

const ALPHA = 0.5
const GAMMA = 0.9
const SEED = 20241023

// Training on random courses (randomCourses with the usual brain): each try is on the next course
// of a separate training stream, so the robot sees many layouts instead of one. The same table
// learns from a different world every try, so it learns more gently (a smaller step), explores for
// longer, and one press of Train runs several times the tries.
export const COURSE_TRIES_FACTOR = 5
const COURSE_ALPHA = 0.05
const courseEpsilon = (episode) => Math.max(0.05, 0.9 * Math.pow(0.995, episode))

const isWhole = (n) => typeof n === 'number' && Number.isInteger(n)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// ---------------------------------------------------------------- the map

const MAP_CHARS = new Set(['#', '.', 'R', 'T', 'X', 'C'])

// Check a map and build the world. Returns { errors, env } (env is null when there are errors).
// The messages carry no "Task n:" prefix; validateGameAgentTask adds it.
export function parseMap(map) {
  const errors = []
  if (!Array.isArray(map) || map.length === 0 || !map.every((row) => typeof row === 'string')) {
    return { errors: ['needs a map (a list of rows of text).'], env: null }
  }
  const rows = map.length
  const cols = map[0].length
  if (rows > MAX_SIZE || cols > MAX_SIZE) {
    errors.push(`map can be at most ${MAX_SIZE} x ${MAX_SIZE}.`)
  }
  map.forEach((row, i) => {
    if (row.length !== cols) errors.push(`map row ${i + 1} is not the same length as row 1.`)
    const bad = [...row].find((ch) => !MAP_CHARS.has(ch))
    if (bad !== undefined) {
      errors.push(`map row ${i + 1} has "${bad}"; use # . R T X C only.`)
    }
  })
  if (cols === 0) errors.push('needs a map (a list of rows of text).')
  if (errors.length) return { errors, env: null }

  const starts = []
  const treasures = []
  const cells = []
  map.forEach((row, r) => {
    ;[...row].forEach((ch, c) => {
      const index = r * cols + c
      if (ch === 'R') starts.push(index)
      if (ch === 'T') treasures.push(index)
      cells.push(ch === '#' ? 'wall' : ch === 'X' ? 'pit' : ch === 'C' ? 'coin' : 'floor')
    })
  })
  if (starts.length !== 1) errors.push('map needs exactly one R (the robot start).')
  if (treasures.length !== 1) errors.push('map needs exactly one T (the treasure).')
  if (errors.length) return { errors, env: null }

  const floorCount = cells.filter((cell) => cell !== 'wall').length
  const env = {
    rows,
    cols,
    cells,
    start: starts[0],
    treasure: treasures[0],
    coins: cells.flatMap((cell, i) => (cell === 'coin' ? [i] : [])),
    cap: Math.max(8, 4 * floorCount),
  }
  if (!canReach(env)) {
    return { errors: ['the robot cannot reach the treasure on this map.'], env: null }
  }
  return { errors: [], env }
}

// Breadth-first search from R to T over floor squares (a pit is not a way through).
function canReach(env) {
  const seen = new Set([env.start])
  const queue = [env.start]
  while (queue.length) {
    const s = queue.shift()
    if (s === env.treasure) return true
    for (const a of ACTIONS) {
      const r = Math.floor(s / env.cols) + a.dr
      const c = (s % env.cols) + a.dc
      if (r < 0 || c < 0 || r >= env.rows || c >= env.cols) continue
      const next = r * env.cols + c
      if (seen.has(next) || env.cells[next] === 'wall' || env.cells[next] === 'pit') continue
      seen.add(next)
      queue.push(next)
    }
  }
  return false
}

export function envOf(task) {
  return parseMap(task?.map).env
}

// ---------------------------------------------------------------- the world

// One move. A wall (or the edge) keeps the robot where it is and costs the wall reward.
// `taken` (optional Set) holds the coins already collected this try; a coin pays once.
export function stepWorld(env, rewards, s, a, taken) {
  const r = Math.floor(s / env.cols) + ACTIONS[a].dr
  const c = (s % env.cols) + ACTIONS[a].dc
  if (r < 0 || c < 0 || r >= env.rows || c >= env.cols || env.cells[r * env.cols + c] === 'wall') {
    return { s, reward: rewards.wall, bumped: true, done: false, reached: false }
  }
  const next = r * env.cols + c
  if (next === env.treasure) {
    return { s: next, reward: rewards.treasure, bumped: false, done: true, reached: true }
  }
  if (env.cells[next] === 'pit') {
    return { s: next, reward: rewards.pit, bumped: false, done: true, reached: false }
  }
  if (env.cells[next] === 'coin' && taken && !taken.has(next)) {
    taken.add(next)
    return { s: next, reward: rewards.coin ?? 0, bumped: false, done: false, reached: false }
  }
  return { s: next, reward: rewards.step, bumped: false, done: false, reached: false }
}

// ---------------------------------------------------------------- senses

const COMPASS_WORDS = {
  N: 'up',
  NE: 'up and right',
  E: 'right',
  SE: 'down and right',
  S: 'down',
  SW: 'down and left',
  W: 'left',
  NW: 'up and left',
}
const SIDE_NAMES = ['up', 'right', 'down', 'left']
const COMPASS_TABLE = {
  '-1,0': 'N',
  '-1,1': 'NE',
  '0,1': 'E',
  '1,1': 'SE',
  '1,0': 'S',
  '1,-1': 'SW',
  '0,-1': 'W',
  '-1,-1': 'NW',
}

// 8-way compass from square `from` to square `to` (rows grow downwards, so N is up).
function compass(env, from, to) {
  const dr = Math.sign(Math.floor(to / env.cols) - Math.floor(from / env.cols))
  const dc = Math.sign((to % env.cols) - (from % env.cols))
  if (dr === 0 && dc === 0) return 'here'
  return COMPASS_TABLE[`${dr},${dc}`]
}

// 4-way compass: whichever way is further (ties go up/down).
function compass4(env, from, to) {
  const dr = Math.floor(to / env.cols) - Math.floor(from / env.cols)
  const dc = (to % env.cols) - (from % env.cols)
  if (dr === 0 && dc === 0) return 'here'
  if (Math.abs(dr) >= Math.abs(dc)) return dr < 0 ? 'N' : 'S'
  return dc > 0 ? 'E' : 'W'
}

function neighbour(env, s, a) {
  const r = Math.floor(s / env.cols) + ACTIONS[a].dr
  const c = (s % env.cols) + ACTIONS[a].dc
  if (r < 0 || c < 0 || r >= env.rows || c >= env.cols) return -1
  return r * env.cols + c
}

// The robot's situation as a string: what its chosen senses report from square `pos`.
// `taken` is the Set of coins already collected (they stop being sensed).
export function stateKey(env, pos, senses, taken) {
  const parts = []
  for (const sense of SENSE_KEYS) {
    if (!senses.includes(sense)) continue
    if (sense === 'position') parts.push(`p${pos}`)
    if (sense === 'walls') {
      let bits = ''
      for (let a = 0; a < 4; a++) {
        const n = neighbour(env, pos, a)
        bits += n < 0 || env.cells[n] === 'wall' ? '1' : '0'
      }
      parts.push(`w${bits}`)
    }
    if (sense === 'treasure_direction') parts.push(`t${compass(env, pos, env.treasure)}`)
    if (sense === 'treasure_direction_4') parts.push(`f${compass4(env, pos, env.treasure)}`)
    if (sense === 'pit_near') {
      const near = [0, 1, 2, 3].some((a) => {
        const n = neighbour(env, pos, a)
        return n >= 0 && env.cells[n] === 'pit'
      })
      parts.push(near ? 'x1' : 'x0')
    }
    if (sense === 'coin_direction') {
      let best = -1
      let bestDist = Infinity
      for (const coin of env.coins ?? []) {
        if (taken?.has(coin)) continue
        const d =
          Math.abs(Math.floor(coin / env.cols) - Math.floor(pos / env.cols)) +
          Math.abs((coin % env.cols) - (pos % env.cols))
        if (d < bestDist) {
          best = coin
          bestDist = d
        }
      }
      parts.push(best < 0 ? 'cnone' : `c${compass(env, pos, best)}`)
    }
  }
  return parts.join('|')
}

const wordsOf = (value) => (value === 'here' ? 'here' : COMPASS_WORDS[value])

// A key in plain words, for "the robot sees ...".
export function describeSituation(key) {
  const out = []
  for (const part of String(key).split('|')) {
    const kind = part[0]
    const value = part.slice(1)
    if (kind === 'p') out.push(`I am on square ${Number(value) + 1}`)
    else if (kind === 'w') {
      const names = SIDE_NAMES.filter((_, i) => value[i] === '1')
      out.push(names.length ? `walls: ${names.join(', ')}` : 'no walls next to me')
    } else if (kind === 't' || kind === 'f') out.push(`treasure is ${wordsOf(value)}`)
    else if (kind === 'x') out.push(value === '1' ? 'a pit is next to me' : 'no pit next to me')
    else if (kind === 'c') {
      out.push(value === 'none' ? 'no coin to find' : `coin is ${wordsOf(value)}`)
    }
  }
  return out.join('; ')
}

// How many different situations the chosen senses can report on this map ("N situations to
// learn"). Counts every open square with no coins taken and with all coins taken.
export function countSituations(env, senses) {
  const seen = new Set()
  const all = new Set(env.coins ?? [])
  for (let s = 0; s < env.cells.length; s++) {
    if (env.cells[s] === 'wall') continue
    seen.add(stateKey(env, s, senses, new Set()))
    seen.add(stateKey(env, s, senses, all))
  }
  return seen.size
}

// ---------------------------------------------------------------- learning

function nextRandom(agent) {
  // mulberry32
  agent.rng = (agent.rng + 0x6d2b79f5) >>> 0
  let t = agent.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The table is a Map from situation (stateKey) to the four move values. `visits` counts how
// often each situation came up (to list the commonest in "what it learned").
export function newAgent(env, senses = ['position'], onCourses = false) {
  const agent = { q: new Map(), visits: new Map(), env, senses, rng: SEED, episodes: 0 }
  if (onCourses) {
    agent.alpha = COURSE_ALPHA
    agent.epsilon = courseEpsilon
  }
  return agent
}

const rowOf = (agent, key) => {
  let row = agent.q.get(key)
  if (!row) {
    row = [0, 0, 0, 0]
    agent.q.set(key, row)
  }
  return row
}

// Explore a lot at first, then settle down.
export function epsilonFor(episode) {
  return Math.max(0.05, 0.9 * Math.pow(0.93, episode))
}

function bestAction(agent, key) {
  const row = agent.q.get(key)
  if (!row) return 0
  let best = 0
  for (let a = 1; a < 4; a++) if (row[a] > row[best]) best = a
  return best
}

// The move the robot currently thinks is best from square `s`, as an index into ACTIONS, or -1
// when it has no opinion yet (all four values equal, e.g. untrained). Ties go to the first best.
export function bestMoveOfKey(agent, key) {
  const q = agent.q.get(key)
  if (!q || q.every((v) => v === q[0])) return -1
  return bestAction(agent, key)
}

// Same, for square `s` (with no coins taken yet).
export function bestMoveOf(agent, s) {
  return bestMoveOfKey(agent, stateKey(agent.env, s, agent.senses, new Set()))
}

// The situations the robot meets most, each with the move it prefers: for "when it sees X it
// goes Y". Only situations it has an opinion about.
export function topSituations(agent, limit = 5) {
  return [...agent.q.keys()]
    .map((key) => ({ key, move: bestMoveOfKey(agent, key), visits: agent.visits.get(key) ?? 0 }))
    .filter((row) => row.move >= 0)
    .sort((a, b) => b.visits - a.visits || (a.key < b.key ? -1 : 1))
    .slice(0, limit)
}

export function beginEpisode(env) {
  return {
    s: env.start,
    steps: 0,
    score: 0,
    done: false,
    reached: false,
    last: null,
    taken: new Set(),
  }
}

// Advance one episode by one move (learning from it). Returns the same episode object.
export function stepEpisode(env, rewards, agent, ep) {
  if (ep.done) return ep
  const s = ep.s
  const key = stateKey(env, s, agent.senses, ep.taken)
  const row = rowOf(agent, key)
  agent.visits.set(key, (agent.visits.get(key) ?? 0) + 1)
  const a =
    nextRandom(agent) < (agent.epsilon ?? epsilonFor)(agent.episodes)
      ? Math.floor(nextRandom(agent) * 4)
      : bestAction(agent, key)
  const out = stepWorld(env, rewards, s, a, ep.taken)
  let future = 0
  if (!out.done) {
    const nextRow = agent.q.get(stateKey(env, out.s, agent.senses, ep.taken))
    future = nextRow ? Math.max(...nextRow) : 0
  }
  row[a] += (agent.alpha ?? ALPHA) * (out.reward + GAMMA * future - row[a])
  ep.s = out.s
  ep.steps += 1
  ep.score += out.reward
  ep.last = { action: a, bumped: out.bumped }
  if (out.done || ep.steps >= env.cap) {
    ep.done = true
    ep.reached = out.reached
  }
  return ep
}

// Close an episode: counts it and returns its score.
export function finishEpisode(agent, ep) {
  agent.episodes += 1
  return ep.score
}

export function runEpisode(env, rewards, agent) {
  const ep = beginEpisode(env)
  while (!ep.done) stepEpisode(env, rewards, agent, ep)
  finishEpisode(agent, ep)
  return ep
}

// Train n more episodes. Returns each episode's score.
export function trainEpisodes(env, rewards, agent, n) {
  const scores = []
  for (let i = 0; i < n; i++) scores.push(runEpisode(env, rewards, agent).score)
  return scores
}

// A robot that has had `trained` episodes (replayed, so a saved state need not hold the table).
// With `courseEnvFor` (a function from the try number to a course) every try runs on that course.
export function agentAfter(env, rewards, trained, senses = ['position'], courseEnvFor = null) {
  const agent = newAgent(env, senses, !!courseEnvFor)
  for (let i = 0; i < trained; i += 1) {
    runEpisode(courseEnvFor ? courseEnvFor(i) : env, rewards, agent)
  }
  return agent
}

// Run the learned moves once from R with no exploring. `moves` is the route as U/R/D/L letters.
// With `unseen` (a map nobody trained on) the robot meets situations it never saw. It then does
// what it learned for the closest situation it does know (closestKnown), and it doesn't walk into
// the same wall twice from the same square. The run stops after MAX_TEST_MOVES.
export function greedyRun(env, rewards, agent, { unseen = false } = {}) {
  let s = env.start
  let score = 0
  let reached = false
  let moves = ''
  const cells = [s]
  const taken = new Set()
  const bumped = new Set()
  const cap = unseen ? Math.min(env.cap, MAX_TEST_MOVES) : env.cap
  for (let steps = 0; steps < cap; steps++) {
    const key = stateKey(env, s, agent.senses ?? ['position'], taken)
    // A square number means nothing on another map, so it never matches what it learned there.
    const a = unseen
      ? testMove(agent, key.replace(/(^|\|)p(\d+)/, '$1n$2'), s, bumped, steps)
      : bestAction(agent, key)
    const out = stepWorld(env, rewards, s, a, taken)
    if (out.bumped) bumped.add(`${s}:${a}`)
    moves += ACTIONS[a].letter
    score += out.reward
    s = out.s
    cells.push(s)
    if (out.done) {
      reached = out.reached
      break
    }
  }
  return { moves, cells, score, steps: moves.length, reached }
}

// Compass points next to each other count as half alike ("up and right" is a bit like "right").
const COMPASS_RING = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function partLikeness(a, b) {
  if (a === b) return 1
  if (a[0] !== b[0] || (a[0] !== 't' && a[0] !== 'c')) return 0
  const i = COMPASS_RING.indexOf(a.slice(1))
  const j = COMPASS_RING.indexOf(b.slice(1))
  if (i < 0 || j < 0) return 0
  const gap = Math.min((i - j + 8) % 8, (j - i + 8) % 8)
  return gap === 1 ? 0.5 : 0
}

// The known situation most like `key` (one the robot has an opinion about), or null. Ties go to
// the one it met most often.
export function closestKnown(agent, key) {
  const parts = key.split('|')
  let best = null
  let bestScore = 0
  let bestVisits = -1
  for (const known of agent.q.keys()) {
    if (bestMoveOfKey(agent, known) < 0) continue
    const other = known.split('|')
    let score = 0
    for (let i = 0; i < parts.length; i++) score += partLikeness(parts[i], other[i] ?? '')
    const visits = agent.visits.get(known) ?? 0
    if (score > bestScore || (score === bestScore && score > 0 && visits > bestVisits)) {
      best = known
      bestScore = score
      bestVisits = visits
    }
  }
  return best
}

// A move on a new map: the learned move for this situation (or the closest known one), best first,
// skipping moves that already hit a wall from this square.
function testMove(agent, key, s, bumped, steps) {
  const source = bestMoveOfKey(agent, key) >= 0 ? key : closestKnown(agent, key)
  const row = source ? agent.q.get(source) : null
  // Knowing nothing like it, the robot just guesses (and can walk into the same wall again).
  if (!row) return guessMove(key, steps)
  const order = [0, 1, 2, 3].sort((x, y) => row[y] - row[x] || x - y)
  return order.find((a) => !bumped.has(`${s}:${a}`)) ?? order[0]
}

// A repeatable made-up move for a situation the robot has never seen.
export function guessMove(key, step) {
  let h = step
  for (const ch of key) h += ch.charCodeAt(0)
  return h % 4
}

// Which test map a "Go on a new map" press uses (they take turns); null when none are set.
export function testMapFor(task, tests) {
  const maps = testMapsOf(task)
  return maps.length ? maps[tests % maps.length] : null
}

// Where a stored route goes (used to draw the tutor's view). Stops at a wall bump's square.
export function cellsOfMoves(env, moves) {
  const cells = [env.start]
  let s = env.start
  for (const letter of String(moves ?? '')) {
    const a = ACTIONS.findIndex((x) => x.letter === letter)
    if (a < 0) break
    const r = Math.floor(s / env.cols) + ACTIONS[a].dr
    const c = (s % env.cols) + ACTIONS[a].dc
    if (
      r >= 0 &&
      c >= 0 &&
      r < env.rows &&
      c < env.cols &&
      env.cells[r * env.cols + c] !== 'wall'
    ) {
      s = r * env.cols + c
    }
    cells.push(s)
  }
  return cells
}

// ---------------------------------------------------------------- task fields

export const hasCoin = (env) => !!env && (env.coins?.length ?? 0) > 0

export function rewardsOf(task) {
  const out = { ...DEFAULT_REWARDS }
  const given = task?.rewards && typeof task.rewards === 'object' ? task.rewards : {}
  const mapHasCoin = Array.isArray(task?.map) && task.map.some((row) => String(row).includes('C'))
  if (mapHasCoin || isWhole(given.coin)) out.coin = DEFAULT_COIN
  for (const key of REWARD_KEYS) {
    if (isWhole(given[key])) out[key] = clamp(given[key], REWARD_MIN, REWARD_MAX)
  }
  return out
}

export function episodesOf(task) {
  return isWhole(task?.episodes) && task.episodes >= 1
    ? Math.min(task.episodes, MAX_EPISODES)
    : DEFAULT_EPISODES
}

// How the robot learns: 'reward' (the default, Q-learning from points) or 'copy' (a neural
// network that learns from the student's driving; see copybot.js).
export const BRAINS = ['reward', 'copy']
export const brainOf = (task) => (task?.brain === 'copy' ? 'copy' : 'reward')
export const isCopyBrain = (task) => brainOf(task) === 'copy'
export const PANELS = ['network']
export const hasNetworkPanel = (task) =>
  Array.isArray(task?.panels) && task.panels.includes('network')

// Tries one press of Train runs: with random courses (and the usual brain) it is several times as many.
export const triesPerTrain = (task) =>
  hasCourses(task) && !isCopyBrain(task) ? episodesOf(task) * COURSE_TRIES_FACTOR : episodesOf(task)

// The starting senses (the student can change them when the task offers the choice).
export function sensesOf(task) {
  const given = Array.isArray(task?.senses) ? task.senses.filter((x) => SENSE_KEYS.includes(x)) : []
  if (given.length) return SENSE_KEYS.filter((x) => given.includes(x))
  // A copy-bot leaves `position` out unless the author asks for it: a square number is no use on a new course.
  return isCopyBrain(task) ? ['walls', 'treasure_direction'] : ['position']
}

export const maxSensesOf = (task) =>
  isWhole(task?.maxSenses) && task.maxSenses >= 1
    ? Math.min(task.maxSenses, SENSE_KEYS.length)
    : SENSE_KEYS.length

// The student picks senses only when the task sets `senses` or `maxSenses`.
export const sensesChoosable = (task) => task?.senses !== undefined || task?.maxSenses !== undefined

// The sealed maps for "Go on a new map": parsed worlds (maps that fail to parse are dropped).
export function testMapsOf(task) {
  return Array.isArray(task?.testMaps)
    ? task.testMaps.map((m) => parseMap(m).env).filter(Boolean)
    : []
}

// Does the task run the trained robot on random courses? (The settings are checked in courses.js.)
export const hasCourses = (task) =>
  isCopyBrain(task) ||
  (!!task?.randomCourses &&
    typeof task.randomCourses === 'object' &&
    !Array.isArray(task.randomCourses))

export const showLearningOf = (task) => task?.showLearning !== false
export const hasPit = (env) => !!env && env.cells.includes('pit')

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message is listed in docs/authoring/validation-errors.md (`…` stands for each ${...}).
export function validateGameAgentTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  errors.push(...parseMap(task?.map).errors.map((message) => `${where}: ${message}`))
  if (task?.rewards !== undefined) {
    if (!task.rewards || typeof task.rewards !== 'object' || Array.isArray(task.rewards)) {
      errors.push(`${where}: rewards must be an object like { treasure: 10, step: -1, wall: -5 }.`)
    } else {
      for (const key of REWARD_KEYS) {
        const value = task.rewards[key]
        if (value === undefined) continue
        if (!isWhole(value) || value < REWARD_MIN || value > REWARD_MAX) {
          errors.push(
            `${where}: rewards.${key} must be a whole number from ${REWARD_MIN} to ${REWARD_MAX}.`
          )
        }
      }
    }
  }
  if (task?.senses !== undefined) {
    if (!Array.isArray(task.senses) || task.senses.length === 0) {
      errors.push(`${where}: senses must be a list of ${SENSE_KEYS.join(', ')}.`)
    } else {
      for (const sense of task.senses) {
        if (!SENSE_KEYS.includes(sense)) {
          errors.push(`${where}: senses has "${sense}"; use ${SENSE_KEYS.join(', ')} only.`)
        }
      }
    }
  }
  if (task?.maxSenses !== undefined) {
    if (!isWhole(task.maxSenses) || task.maxSenses < 1 || task.maxSenses > SENSE_KEYS.length) {
      errors.push(`${where}: maxSenses must be a whole number from 1 to ${SENSE_KEYS.length}.`)
    } else if (Array.isArray(task.senses) && task.senses.length > task.maxSenses) {
      errors.push(
        `${where}: senses lists ${task.senses.length} senses but maxSenses is ${task.maxSenses}.`
      )
    }
  }
  if (task?.testMaps !== undefined) {
    if (!Array.isArray(task.testMaps) || task.testMaps.length === 0) {
      errors.push(`${where}: testMaps must be a list of maps (each a list of rows of text).`)
    } else {
      if (task.testMaps.length > MAX_TEST_MAPS) {
        errors.push(`${where}: testMaps can have at most ${MAX_TEST_MAPS} maps.`)
      }
      task.testMaps.forEach((m, i) => {
        for (const message of parseMap(m).errors) {
          errors.push(`${where}: testMaps map ${i + 1}: ${message}`)
        }
      })
    }
  }
  if (task?.brain !== undefined && !BRAINS.includes(task.brain)) {
    errors.push(`${where}: brain must be ${BRAINS.join(' or ')}.`)
  }
  if (task?.panels !== undefined) {
    if (!Array.isArray(task.panels)) {
      errors.push(`${where}: panels must be a list like [network].`)
    } else {
      for (const panel of task.panels) {
        if (!PANELS.includes(panel)) {
          errors.push(`${where}: panels has "${panel}"; use ${PANELS.join(', ')} only.`)
        }
      }
    }
  }
  if (task?.episodes !== undefined) {
    if (!isWhole(task.episodes) || task.episodes < 1 || task.episodes > MAX_EPISODES) {
      errors.push(`${where}: episodes must be a whole number from 1 to ${MAX_EPISODES}.`)
    }
  }
  return errors
}

export function validateGameAgentWarnings(task, n) {
  const warnings = []
  if (isCopyBrain(task) && Array.isArray(task.testMaps) && task.testMaps.length) {
    warnings.push(`Task ${n}: testMaps are not used when brain is copy (it drives on courses).`)
  }
  if (isCopyBrain(task) && Array.isArray(task.senses) && task.senses.includes('position')) {
    warnings.push(
      `Task ${n}: a copy-bot that senses position cannot tell one course from another; leave position out.`
    )
  }
  if (task?.panels !== undefined && !isCopyBrain(task) && hasNetworkPanel(task)) {
    warnings.push(`Task ${n}: the network panel is only drawn when brain is copy.`)
  }
  if (task?.race && testMapsOf(task).length === 0 && !hasCourses(task)) {
    warnings.push(
      `Task ${n}: race needs testMaps; without them the tutor's card ranks the Go! score instead of a mystery-map score.`
    )
  }
  return warnings
}

// ---------------------------------------------------------------- state

// The whole state is small enough to be shared: rewards, how many episodes the robot has had,
// the last scores, and the last Go! (route, score, whether it found the treasure).
export function initialGameAgentState(task) {
  return {
    v: 1,
    rewards: rewardsOf(task),
    senses: sensesOf(task),
    trained: 0,
    scores: [],
    training: false,
    goes: 0,
    moves: '',
    goScore: null,
    reached: false,
    bestScore: null,
    bestSteps: null,
    tests: 0,
    testReached: false,
    testScore: null,
    testSteps: null,
    testBest: null,
    courses: [],
    drives: [],
    driveCourse: 0,
  }
}

const numOrNull = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)

// The score on each random course tried: [{ n, score, reached }], the last MAX_COURSE_LOG.
export const MAX_COURSE_LOG = 20
function normalizeCourses(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => c && isWhole(c.n) && c.n > 0 && Number.isFinite(c.score))
    .map((c) => ({ n: c.n, score: c.score, reached: c.reached === true }))
    .slice(-MAX_COURSE_LOG)
}

// The copy-bot's drives: [{ c, moves }], the course number and the letters driven on it. At most
// MAX_DRIVES courses and MAX_DRIVE_MOVES moves in all.
export const MAX_DRIVES = 6
export const MAX_DRIVE_MOVES = 200
function normalizeDrives(raw) {
  if (!Array.isArray(raw)) return []
  let room = MAX_DRIVE_MOVES
  const out = []
  for (const d of raw) {
    if (!d || !isWhole(d.c) || d.c < 0 || typeof d.moves !== 'string' || out.length >= MAX_DRIVES)
      continue
    const moves = d.moves.replace(/[^URDL]/g, '').slice(0, room)
    room -= moves.length
    out.push({ c: d.c, moves })
  }
  return out
}

export function normalizeGameAgentState(task, raw) {
  const base = initialGameAgentState(task)
  if (!raw || typeof raw !== 'object') return base
  const rewards = { ...base.rewards }
  for (const key of REWARD_KEYS) {
    if (key in base.rewards && isWhole(raw.rewards?.[key]))
      rewards[key] = clamp(raw.rewards[key], REWARD_MIN, REWARD_MAX)
  }
  const rawSenses = Array.isArray(raw.senses)
    ? raw.senses.filter((x) => SENSE_KEYS.includes(x))
    : []
  return {
    v: 1,
    rewards,
    senses: rawSenses.length ? SENSE_KEYS.filter((x) => rawSenses.includes(x)) : base.senses,
    trained: isWhole(raw.trained) && raw.trained > 0 ? Math.min(raw.trained, 100000) : 0,
    scores: Array.isArray(raw.scores)
      ? raw.scores.filter((s) => typeof s === 'number' && Number.isFinite(s)).slice(-MAX_SCORES)
      : [],
    training: raw.training === true,
    goes: isWhole(raw.goes) && raw.goes > 0 ? raw.goes : 0,
    moves:
      typeof raw.moves === 'string' ? raw.moves.replace(/[^URDL]/g, '').slice(0, MAX_MOVES) : '',
    goScore: numOrNull(raw.goScore),
    reached: raw.reached === true,
    bestScore: numOrNull(raw.bestScore),
    bestSteps: numOrNull(raw.bestSteps),
    tests: isWhole(raw.tests) && raw.tests > 0 ? raw.tests : 0,
    testReached: raw.testReached === true,
    testScore: numOrNull(raw.testScore),
    testSteps: numOrNull(raw.testSteps),
    testBest: numOrNull(raw.testBest),
    courses: normalizeCourses(raw.courses),
    drives: normalizeDrives(raw.drives),
    driveCourse:
      isWhole(raw.driveCourse) && raw.driveCourse > 0 ? Math.min(raw.driveCourse, 1000) : 0,
  }
}

export const sharedState = (state) => normalizeGameAgentState(null, state)

// The state after the Go! button: records the run and keeps the best that found the treasure.
export function withGoResult(state, run) {
  const better =
    run.reached && (state.bestScore == null || run.score > state.bestScore)
      ? { bestScore: run.score, bestSteps: run.steps }
      : {}
  return {
    ...state,
    goes: (state.goes ?? 0) + 1,
    moves: run.moves.slice(0, MAX_MOVES),
    goScore: run.score,
    reached: run.reached,
    ...better,
  }
}

// New rewards: the robot forgets everything and the best score starts again (scores made with
// other rewards cannot be compared).
export function withRewards(task, state, rewards) {
  return { ...initialGameAgentState(task), rewards, senses: state.senses ?? sensesOf(task) }
}

// New senses: the robot forgets everything, the same as new rewards (what it learned was keyed
// by what it used to sense).
export function withSenses(task, state, senses) {
  return { ...initialGameAgentState(task), rewards: state.rewards, senses }
}

// The state after "Go on a new map": the result only. No training happens; a new map is a test.
export function withTestResult(state, run) {
  const better =
    run.reached && (state.testBest == null || run.score > state.testBest)
      ? { testBest: run.score }
      : {}
  return {
    ...state,
    tests: (state.tests ?? 0) + 1,
    testReached: run.reached,
    testScore: run.score,
    testSteps: run.steps,
    ...better,
  }
}

// The state after "Try a new course": the same as a test map, plus the score for that course number.
export function withCourseResult(state, run) {
  const next = withTestResult(state, run)
  const entry = { n: (state.tests ?? 0) + 1, score: run.score, reached: run.reached }
  return { ...next, courses: [...(state.courses ?? []), entry].slice(-MAX_COURSE_LOG) }
}

// A finished state for "Complete (show answers)": trains with the task's rewards until the
// robot's Go! finds the treasure.
export function solutionFor(task) {
  const env = envOf(task)
  const state = initialGameAgentState(task)
  if (!env) return { ...state, reached: true }
  const rewards = state.rewards
  const agent = newAgent(env, state.senses)
  const scores = []
  const batch = episodesOf(task)
  let run = greedyRun(env, rewards, agent)
  while (agent.episodes < MAX_EPISODES && !(agent.episodes > 0 && run.reached)) {
    scores.push(...trainEpisodes(env, rewards, agent, batch))
    run = greedyRun(env, rewards, agent)
  }
  const done = withGoResult(
    { ...state, trained: agent.episodes, scores: scores.slice(-MAX_SCORES) },
    run
  )
  const testEnv = testMapFor(task, 0)
  return testEnv ? withTestResult(done, greedyRun(testEnv, rewards, agent, { unseen: true })) : done
}

// ---------------------------------------------------------------- grading

// Plain-words hint for a robot that did not find the treasure.
export function hintFor(state, task = null) {
  const { rewards } = state
  if (isCopyBrain(task)) {
    if (!(state.drives ?? []).some((d) => d.moves.length))
      return 'Drive the robot to the treasure with the arrows.'
    if (state.trained === 0) return 'Press Train so the robot learns from your driving.'
    if (state.tests === 0) return 'Press Watch it drive to see it drive on a new course.'
    return 'It got lost, so it copied something that did not help. Drive more courses, then train it again.'
  }
  if (state.trained === 0) return 'Press Train to let the robot practise.'
  if (state.goes === 0 && state.tests === 0) return 'Press Go! to see where the robot goes.'
  if (state.tests > 0 && !state.testReached) {
    return 'The robot got lost on the new map. Try other senses, so it can find the way on a map it has not seen.'
  }
  if (rewards.treasure <= 0) return 'The treasure is worth nothing. Give it a big reward.'
  if (rewards.step >= 0)
    return 'Every step earns a bonus, so the robot just wanders. Make steps cost something.'
  return 'The robot did not find the treasure. Train it some more, then press Go! again.'
}

export function gradeTask(task, state) {
  const s = normalizeGameAgentState(task, state)
  const hasTests = testMapsOf(task).length > 0 || hasCourses(task)
  const passed = s.trained > 0 && (hasTests ? s.testReached : s.reached)
  return {
    passed,
    trained: s.trained,
    reached: s.reached,
    testReached: s.testReached,
    testBest: s.testBest,
    bestScore: s.bestScore,
    bestSteps: s.bestSteps,
    hint: passed ? null : hintFor(s, task),
  }
}

// The card line: where the student is, and their best score for a race on the big screen.
export function summaryOf(task, state) {
  const s = normalizeGameAgentState(task, state)
  const g = gradeTask(task, s)
  if (isCopyBrain(task)) {
    const moves = s.drives.reduce((n, d) => n + d.moves.length, 0)
    if (moves === 0) return { text: 'Not driven yet', tone: 'neutral' }
    const last = s.courses[s.courses.length - 1]
    const ran = last ? ` · course ${last.n}: ${last.reached ? `${last.score} pts` : 'lost'}` : ''
    const before = s.trained === 0 ? ' · not trained yet' : ''
    return {
      text: `copy-bot · ${moves} moves${before}${ran}`,
      tone: g.passed ? 'success' : 'neutral',
    }
  }
  if (s.trained === 0) return { text: 'Not trained yet', tone: 'neutral' }
  if (hasCourses(task) && s.courses.length > 0) {
    // Each shared course by number, so the tutor can compare students on the same course.
    const shown = s.courses
      .slice(-4)
      .map((c) => `course ${c.n}: ${c.reached ? `${c.score} pts` : 'lost'}`)
    return {
      text: `${shown.join(' · ')} · ${s.trained} tries`,
      tone: g.passed ? 'success' : 'neutral',
    }
  }
  if (task?.race && s.tests > 0) {
    const got = s.testBest == null ? 'lost' : `${s.testBest} pts`
    return {
      text: `mystery map: ${got} · ${s.trained} tries`,
      tone: g.passed ? 'success' : 'neutral',
    }
  }
  const best =
    s.bestScore == null ? 'no treasure yet' : `best ${s.bestScore} (${s.bestSteps} steps)`
  const where = s.training ? 'training' : `${s.trained} episodes`
  return {
    text: `${where} · ${best}${s.goes > 0 && !s.reached ? ' · last Go! missed' : ''}`,
    tone: g.passed ? 'success' : 'neutral',
  }
}
