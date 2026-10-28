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
export const REWARD_KEYS = ['treasure', 'step', 'wall', 'pit']

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

const isWhole = (n) => typeof n === 'number' && Number.isInteger(n)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// ---------------------------------------------------------------- the map

const MAP_CHARS = new Set(['#', '.', 'R', 'T', 'X'])

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
      errors.push(`map row ${i + 1} has "${bad}"; use # . R T X only.`)
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
      cells.push(ch === '#' ? 'wall' : ch === 'X' ? 'pit' : 'floor')
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
      if (seen.has(next) || env.cells[next] !== 'floor') continue
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
export function stepWorld(env, rewards, s, a) {
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
  return { s: next, reward: rewards.step, bumped: false, done: false, reached: false }
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

export function newAgent(env) {
  return { q: new Array(env.rows * env.cols * 4).fill(0), rng: SEED, episodes: 0 }
}

// Explore a lot at first, then settle down.
export function epsilonFor(episode) {
  return Math.max(0.05, 0.9 * Math.pow(0.93, episode))
}

function bestAction(agent, s) {
  let best = 0
  for (let a = 1; a < 4; a++) if (agent.q[s * 4 + a] > agent.q[s * 4 + best]) best = a
  return best
}

// The move the robot currently thinks is best from square `s`, as an index into ACTIONS, or -1
// when it has no opinion yet (all four values equal, e.g. untrained). Ties go to the first best.
export function bestMoveOf(agent, s) {
  const q = agent.q.slice(s * 4, s * 4 + 4)
  if (q.length < 4 || q.every((v) => v === q[0])) return -1
  return bestAction(agent, s)
}

export function beginEpisode(env) {
  return { s: env.start, steps: 0, score: 0, done: false, reached: false, last: null }
}

// Advance one episode by one move (learning from it). Returns the same episode object.
export function stepEpisode(env, rewards, agent, ep) {
  if (ep.done) return ep
  const s = ep.s
  const a =
    nextRandom(agent) < epsilonFor(agent.episodes)
      ? Math.floor(nextRandom(agent) * 4)
      : bestAction(agent, s)
  const out = stepWorld(env, rewards, s, a)
  const future = out.done ? 0 : agent.q[out.s * 4 + bestAction(agent, out.s)]
  const i = s * 4 + a
  agent.q[i] += ALPHA * (out.reward + GAMMA * future - agent.q[i])
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
export function agentAfter(env, rewards, trained) {
  const agent = newAgent(env)
  trainEpisodes(env, rewards, agent, trained)
  return agent
}

// Run the learned moves once from R with no exploring. `moves` is the route as U/R/D/L letters.
export function greedyRun(env, rewards, agent) {
  let s = env.start
  let score = 0
  let reached = false
  let moves = ''
  const cells = [s]
  for (let steps = 0; steps < env.cap; steps++) {
    const a = bestAction(agent, s)
    const out = stepWorld(env, rewards, s, a)
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

export function rewardsOf(task) {
  const out = { ...DEFAULT_REWARDS }
  const given = task?.rewards && typeof task.rewards === 'object' ? task.rewards : {}
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
  if (task?.episodes !== undefined) {
    if (!isWhole(task.episodes) || task.episodes < 1 || task.episodes > MAX_EPISODES) {
      errors.push(`${where}: episodes must be a whole number from 1 to ${MAX_EPISODES}.`)
    }
  }
  return errors
}

export function validateGameAgentWarnings(task, n) {
  const warnings = []
  if (task?.race) {
    warnings.push(
      `Task ${n}: race is not built yet; the tutor's card shows each best score so a race can be run on the big screen.`
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
    trained: 0,
    scores: [],
    training: false,
    goes: 0,
    moves: '',
    goScore: null,
    reached: false,
    bestScore: null,
    bestSteps: null,
  }
}

const numOrNull = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null)

export function normalizeGameAgentState(task, raw) {
  const base = initialGameAgentState(task)
  if (!raw || typeof raw !== 'object') return base
  const rewards = { ...base.rewards }
  for (const key of REWARD_KEYS) {
    if (isWhole(raw.rewards?.[key])) rewards[key] = clamp(raw.rewards[key], REWARD_MIN, REWARD_MAX)
  }
  return {
    v: 1,
    rewards,
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
  return { ...initialGameAgentState(task), rewards }
}

// A finished state for "Complete (show answers)": trains with the task's rewards until the
// robot's Go! finds the treasure.
export function solutionFor(task) {
  const env = envOf(task)
  const state = initialGameAgentState(task)
  if (!env) return { ...state, reached: true }
  const rewards = state.rewards
  const agent = newAgent(env)
  const scores = []
  const batch = episodesOf(task)
  let run = greedyRun(env, rewards, agent)
  while (agent.episodes < MAX_EPISODES && !(agent.episodes > 0 && run.reached)) {
    scores.push(...trainEpisodes(env, rewards, agent, batch))
    run = greedyRun(env, rewards, agent)
  }
  return withGoResult({ ...state, trained: agent.episodes, scores: scores.slice(-MAX_SCORES) }, run)
}

// ---------------------------------------------------------------- grading

// Plain-words hint for a robot that did not find the treasure.
export function hintFor(state) {
  const { rewards } = state
  if (state.trained === 0) return 'Press Train to let the robot practise.'
  if (state.goes === 0) return 'Press Go! to see where the robot goes.'
  if (rewards.treasure <= 0) return 'The treasure is worth nothing. Give it a big reward.'
  if (rewards.step >= 0)
    return 'Every step earns a bonus, so the robot just wanders. Make steps cost something.'
  return 'The robot did not find the treasure. Train it some more, then press Go! again.'
}

export function gradeTask(task, state) {
  const s = normalizeGameAgentState(task, state)
  const passed = s.trained > 0 && s.reached
  return {
    passed,
    trained: s.trained,
    reached: s.reached,
    bestScore: s.bestScore,
    bestSteps: s.bestSteps,
    hint: passed ? null : hintFor(s),
  }
}

// The card line: where the student is, and their best score for a race on the big screen.
export function summaryOf(task, state) {
  const s = normalizeGameAgentState(task, state)
  const g = gradeTask(task, s)
  if (s.trained === 0) return { text: 'Not trained yet', tone: 'neutral' }
  const best =
    s.bestScore == null ? 'no treasure yet' : `best ${s.bestScore} (${s.bestSteps} steps)`
  const where = s.training ? 'training' : `${s.trained} episodes`
  return {
    text: `${where} · ${best}${s.goes > 0 && !s.reached ? ' · last Go! missed' : ''}`,
    tone: g.passed ? 'success' : 'neutral',
  }
}
