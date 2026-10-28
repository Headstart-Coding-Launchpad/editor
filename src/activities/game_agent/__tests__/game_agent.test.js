// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REWARDS,
  agentAfter,
  closestKnown,
  countSituations,
  describeSituation,
  stateKey,
  testMapFor,
  topSituations,
  withTestResult,
  bestMoveOf,
  cellsOfMoves,
  envOf,
  gradeTask,
  greedyRun,
  initialGameAgentState,
  newAgent,
  normalizeGameAgentState,
  parseMap,
  solutionFor,
  stepWorld,
  summaryOf,
  trainEpisodes,
  validateGameAgentTask,
  validateGameAgentWarnings,
  withGoResult,
  withRewards,
  withSenses,
} from '../game_agent.js'
import definition from '../definition.js'

const MAP = ['#####', '#R..#', '#.#T#', '#####']
const TASK = { id: 1, taskType: 'activity', activityType: 'game_agent', map: MAP }
const SILLY = { treasure: 0, step: 5, wall: -5, pit: -10 }

describe('parseMap and validateGameAgentTask', () => {
  it('accepts the example map, the default task and a map with a pit', () => {
    expect(validateGameAgentTask(TASK, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
    expect(parseMap(['#####', '#R.X#', '#.#T#', '#...#']).errors).toEqual([])
  })

  it('reports each map mistake', () => {
    const msgs = (map) => validateGameAgentTask({ map }, 2)
    expect(msgs(undefined)).toEqual(['Task 2: needs a map (a list of rows of text).'])
    expect(msgs([])).toEqual(['Task 2: needs a map (a list of rows of text).'])
    expect(msgs(['R.T', '..'])).toEqual(['Task 2: map row 2 is not the same length as row 1.'])
    expect(msgs(['R.T?'])).toEqual(['Task 2: map row 1 has "?"; use # . R T X C only.'])
    expect(msgs(['R....T....'.repeat(2)])).toEqual(['Task 2: map can be at most 10 x 10.'])
    expect(msgs(['...T'])).toEqual(['Task 2: map needs exactly one R (the robot start).'])
    expect(msgs(['RRT'])).toEqual(['Task 2: map needs exactly one R (the robot start).'])
    expect(msgs(['R..'])).toEqual(['Task 2: map needs exactly one T (the treasure).'])
    expect(msgs(['R#T'])).toEqual(['Task 2: the robot cannot reach the treasure on this map.'])
    // A pit is not a way through.
    expect(msgs(['RXT'])).toEqual(['Task 2: the robot cannot reach the treasure on this map.'])
  })

  it('reports bad rewards and episodes', () => {
    const t = (extra) => validateGameAgentTask({ map: MAP, ...extra }, 3)
    expect(t({ rewards: 5 })).toEqual([
      'Task 3: rewards must be an object like { treasure: 10, step: -1, wall: -5 }.',
    ])
    expect(t({ rewards: { treasure: 99, step: 1.5, wall: -21, pit: 'x' } })).toEqual([
      'Task 3: rewards.treasure must be a whole number from -20 to 20.',
      'Task 3: rewards.step must be a whole number from -20 to 20.',
      'Task 3: rewards.wall must be a whole number from -20 to 20.',
      'Task 3: rewards.pit must be a whole number from -20 to 20.',
    ])
    expect(t({ episodes: 0 })).toEqual(['Task 3: episodes must be a whole number from 1 to 500.'])
    expect(t({ episodes: 501 })).toHaveLength(1)
    expect(t({ rewards: { treasure: 5 }, episodes: 10 })).toEqual([])
  })

  it('warns when race has no testMaps', () => {
    expect(validateGameAgentWarnings({ race: true }, 4)).toEqual([
      "Task 4: race needs testMaps; without them the tutor's card ranks the Go! score instead of a mystery-map score.",
    ])
    expect(validateGameAgentWarnings({ race: true, testMaps: [MAP] }, 4)).toEqual([])
    expect(validateGameAgentWarnings({}, 4)).toEqual([])
  })

  it('validates senses, maxSenses and testMaps', () => {
    const t = (extra) => validateGameAgentTask({ ...TASK, ...extra }, 2)
    expect(t({ senses: ['walls', 'treasure_direction'], maxSenses: 3 })).toEqual([])
    expect(t({ senses: ['smell'] })).toHaveLength(1)
    expect(t({ senses: [] })).toHaveLength(1)
    expect(t({ maxSenses: 0 })).toHaveLength(1)
    expect(t({ senses: ['walls', 'pit_near'], maxSenses: 1 })).toEqual([
      'Task 2: senses lists 2 senses but maxSenses is 1.',
    ])
    expect(t({ testMaps: [['#####', '#R.T#', '#####']] })).toEqual([])
    expect(t({ testMaps: [['#R#T#']] })).toEqual([
      'Task 2: testMaps map 1: the robot cannot reach the treasure on this map.',
    ])
    expect(t({ testMaps: [] })).toHaveLength(1)
    expect(t({ testMaps: Array(6).fill(MAP) })).toEqual([
      'Task 2: testMaps can have at most 5 maps.',
    ])
  })
})

describe('the world', () => {
  const env = envOf(TASK)

  it('keeps the robot where it is when it bumps a wall, and charges the wall reward', () => {
    // R is at row 1, column 1; up is a wall.
    const out = stepWorld(env, DEFAULT_REWARDS, env.start, 0)
    expect(out).toMatchObject({ s: env.start, reward: -5, bumped: true, done: false })
    // The edge of the grid counts as a wall too.
    expect(stepWorld(envOf({ map: ['RT'] }), DEFAULT_REWARDS, 0, 0).bumped).toBe(true)
  })

  it('charges a step, pays the treasure and ends there; a pit ends the try', () => {
    expect(stepWorld(env, DEFAULT_REWARDS, env.start, 1)).toMatchObject({
      reward: -1,
      done: false,
    })
    const above = env.treasure - env.cols // the square above T
    expect(stepWorld(env, DEFAULT_REWARDS, above, 2)).toMatchObject({
      reward: 10,
      done: true,
      reached: true,
    })
    const loose = { rows: 1, cols: 3, cells: ['floor', 'pit', 'floor'], start: 0, treasure: 2 }
    expect(stepWorld(loose, DEFAULT_REWARDS, 0, 1)).toMatchObject({
      reward: -10,
      done: true,
      reached: false,
    })
  })
})

describe('learning', () => {
  const env = envOf(TASK)

  it('is deterministic: the same rewards and tries give the same robot', () => {
    const a = agentAfter(env, DEFAULT_REWARDS, 30)
    const b = agentAfter(env, DEFAULT_REWARDS, 30)
    expect(a.q).toEqual(b.q)
    // Training in two parts equals training in one.
    const c = newAgent(env)
    trainEpisodes(env, DEFAULT_REWARDS, c, 10)
    trainEpisodes(env, DEFAULT_REWARDS, c, 20)
    expect(c.q).toEqual(a.q)
  })

  it('learns a route to the treasure within 50 episodes with the default rewards', () => {
    const run = greedyRun(env, DEFAULT_REWARDS, agentAfter(env, DEFAULT_REWARDS, 50))
    expect(run.reached).toBe(true)
    expect(run.moves).toBe('RRD')
    expect(run.steps).toBe(3)
    expect(run.score).toBe(-1 + -1 + 10)
    expect(run.cells[run.cells.length - 1]).toBe(env.treasure)
  })

  it('learns a longer map too, and goes round a pit', () => {
    const big = envOf({
      map: [
        '##########',
        '#R.......#',
        '#.######.#',
        '#.#....#.#',
        '#.#.##.#.#',
        '#...#T...#',
        '##########',
      ],
    })
    expect(greedyRun(big, DEFAULT_REWARDS, agentAfter(big, DEFAULT_REWARDS, 50)).reached).toBe(true)
    const pit = envOf({ map: ['#####', '#R.X#', '#.#T#', '#...#'] })
    const run = greedyRun(pit, DEFAULT_REWARDS, agentAfter(pit, DEFAULT_REWARDS, 50))
    expect(run.reached).toBe(true)
    expect(run.moves).not.toMatch(/^RR/)
  })

  it('does something daft with silly rewards (a bonus for every step, nothing for the treasure)', () => {
    for (const n of [20, 50, 100]) {
      const run = greedyRun(env, SILLY, agentAfter(env, SILLY, n))
      expect(run.reached).toBe(false)
      expect(run.steps).toBe(env.cap) // wanders until the step limit
    }
  })

  it('stops a try at the step limit', () => {
    const agent = newAgent(env)
    const [score] = trainEpisodes(env, SILLY, agent, 1)
    expect(agent.episodes).toBe(1)
    expect(score).toBeLessThanOrEqual(env.cap * 5)
  })

  it('bestMoveOf: no opinion when untrained, the highest Q-value otherwise', () => {
    const agent = newAgent(env)
    expect(bestMoveOf(agent, env.start)).toBe(-1)
    agent.q.set(stateKey(env, env.start, agent.senses, new Set()), [0, 0, 3, 0]) // down
    expect(bestMoveOf(agent, env.start)).toBe(2)
    agent.q.get(stateKey(env, env.start, agent.senses, new Set()))[1] = 5 // right
    expect(bestMoveOf(agent, env.start)).toBe(1)
    // After training, the square before the treasure points at it.
    const trained = agentAfter(env, DEFAULT_REWARDS, 50)
    expect(bestMoveOf(trained, env.start)).toBeGreaterThanOrEqual(0)
  })

  it('draws a stored route back onto the grid', () => {
    expect(cellsOfMoves(env, 'RRD')).toEqual([
      env.start,
      env.start + 1,
      env.start + 2,
      env.treasure,
    ])
    // Into a wall: stays put.
    expect(cellsOfMoves(env, 'U')).toEqual([env.start, env.start])
  })
})

describe('state, grading and the definition', () => {
  const trainedState = () => solutionFor(TASK)

  it('starts untrained and not passed; the solution passes', () => {
    expect(gradeTask(TASK, initialGameAgentState(TASK))).toMatchObject({ passed: false })
    const solution = trainedState()
    expect(solution.reached).toBe(true)
    expect(solution.trained).toBeGreaterThan(0)
    expect(gradeTask(TASK, solution).passed).toBe(true)
    expect(definition.grade(TASK, solution).passed).toBe(true)
  })

  it('needs a Go! that reached the treasure, with hints that point at the mistake', () => {
    const base = initialGameAgentState(TASK)
    expect(gradeTask(TASK, base).hint).toBe('Press Train to let the robot practise.')
    expect(gradeTask(TASK, { ...base, trained: 10 }).hint).toBe(
      'Press Go! to see where the robot goes.'
    )
    const missed = { ...base, trained: 10, goes: 1, reached: false }
    expect(gradeTask(TASK, missed).hint).toMatch(/Train it some more/)
    expect(gradeTask(TASK, { ...missed, rewards: { ...base.rewards, step: 3 } }).hint).toMatch(
      /wanders/
    )
    expect(gradeTask(TASK, { ...missed, rewards: { ...base.rewards, treasure: 0 } }).hint).toMatch(
      /worth nothing/
    )
  })

  it('changing the rewards resets the learning; the best score keeps the best Go!', () => {
    let s = withGoResult(trainedState(), { reached: true, score: 8, steps: 3, moves: 'RRD' })
    expect(s).toMatchObject({ bestScore: 8, bestSteps: 3 })
    s = withGoResult(s, { reached: true, score: 5, steps: 5, moves: 'RRDDD' })
    expect(s.bestScore).toBe(8)
    s = withGoResult(s, { reached: false, score: 50, steps: 20, moves: 'RL' })
    expect(s.bestScore).toBe(8)
    const reset = withRewards(TASK, s, { ...s.rewards, treasure: 12 })
    expect(reset).toMatchObject({ trained: 0, scores: [], bestScore: null, reached: false })
    expect(reset.rewards.treasure).toBe(12)
  })

  it('cleans up a hand-edited state', () => {
    const s = normalizeGameAgentState(TASK, {
      rewards: { treasure: 99, step: 'x' },
      trained: -4,
      scores: [1, 'a', 2],
      moves: 'RRXD',
    })
    expect(s.rewards).toEqual({ ...DEFAULT_REWARDS, treasure: 20 })
    expect(s.trained).toBe(0)
    expect(s.scores).toEqual([1, 2])
    expect(s.moves).toBe('RRD')
    expect(normalizeGameAgentState(TASK, 'junk')).toEqual(initialGameAgentState(TASK))
  })

  it('shows the tutor episodes and the best score on the card', () => {
    expect(summaryOf(TASK, initialGameAgentState(TASK)).text).toBe('Not trained yet')
    const s = withGoResult(trainedState(), { reached: true, score: 8, steps: 3, moves: 'RRD' })
    expect(summaryOf(TASK, s)).toEqual({
      text: `${s.trained} episodes · best 8 (3 steps)`,
      tone: 'success',
    })
    expect(summaryOf(TASK, { ...s, training: true }).text).toMatch(/^training · best 8/)
    const missed = { ...initialGameAgentState(TASK), trained: 5, goes: 1 }
    expect(summaryOf(TASK, missed).text).toBe('5 episodes · no treasure yet · last Go! missed')
  })

  it('reports progress as two steps', () => {
    const base = initialGameAgentState(TASK)
    expect(definition.getProgress(TASK, base)).toMatchObject({ filled: 0, total: 2 })
    expect(definition.getProgress(TASK, { ...base, trained: 5 })).toMatchObject({ filled: 1 })
    expect(definition.getProgress(TASK, trainedState())).toMatchObject({ filled: 2 })
  })

  it('syncs training progress as continuous and everything else as discrete', () => {
    const a = { ...initialGameAgentState(TASK), training: true, trained: 10 }
    const b = { ...a, trained: 20, scores: [1, 2] }
    expect(definition.classifyChange(a, b)).toBe('continuous')
    expect(definition.classifyChange(initialGameAgentState(TASK), a)).toBe('discrete') // start
    expect(definition.classifyChange(b, { ...b, training: false })).toBe('discrete') // stop
    expect(definition.classifyChange(a, { ...a, rewards: { ...a.rewards, step: -2 } })).toBe(
      'discrete'
    )
    expect(definition.classifyChange(a, { ...a, goes: 1, reached: true })).toBe('discrete')
  })

  it('keeps the shared state small and round-trips it', () => {
    const s = {
      ...trainedState(),
      scores: Array.from({ length: 80 }, (_, i) => i - 40),
      moves: 'R'.repeat(200),
    }
    const raw = definition.serializeShared(s)
    expect(raw.length).toBeLessThan(900)
    expect(definition.deserialize(raw, TASK).scores).toHaveLength(40)
    expect(definition.deserialize(raw, TASK).moves).toHaveLength(80)
  })

  it('builds a class summary for the report', () => {
    const good = withGoResult(trainedState(), { reached: true, score: 8, steps: 3, moves: 'RRD' })
    const out = definition.report.summaryFields(TASK, [
      { distinctAttempts: [{ submission: good }] },
      {
        distinctAttempts: [
          { submission: JSON.stringify({ ...initialGameAgentState(TASK), trained: 40 }) },
        ],
      },
      { distinctAttempts: [] },
    ])
    expect(out.gameAgentResults).toEqual({
      trainedCount: 2,
      reachedCount: 1,
      avgEpisodes: Math.round((good.trained + 40) / 2),
      bestScore: 8,
      testedCount: 0,
      testReachedCount: 0,
      bestTestScore: null,
    })
  })
})

describe('senses, coins and the mystery map', () => {
  const COIN_MAP = ['#######', '#R.C..#', '#.#X#T#', '#######']
  const coinEnv = envOf({ map: COIN_MAP })
  const OPEN = ['#####', '#R..#', '#.#T#', '#####']

  it('parses a coin and lets the robot walk through it', () => {
    expect(coinEnv.coins).toEqual([10])
    expect(coinEnv.cells[10]).toBe('coin')
  })

  it('pays a coin once per try', () => {
    const taken = new Set()
    const rewards = { ...DEFAULT_REWARDS, coin: 4 }
    expect(stepWorld(coinEnv, rewards, 9, 1, taken).reward).toBe(4)
    expect(stepWorld(coinEnv, rewards, 11, 3, taken).reward).toBe(-1)
    expect(taken.has(10)).toBe(true)
  })

  it('stateKey reports only the chosen senses', () => {
    const open = envOf({ map: OPEN })
    expect(stateKey(open, open.start, ['position'], new Set())).toBe(`p${open.start}`)
    expect(stateKey(open, open.start, ['walls'], new Set())).toBe('w1001')
    expect(stateKey(open, open.start, ['treasure_direction'], new Set())).toBe('tSE')
    expect(stateKey(open, open.start, ['treasure_direction_4'], new Set())).toBe('fE')
    expect(stateKey(open, open.start, ['pit_near'], new Set())).toBe('x0')
    expect(stateKey(open, open.start, ['walls', 'position'], new Set())).toBe(
      `p${open.start}|w1001`
    )
  })

  it('stateKey senses pits and coins, and forgets a taken coin', () => {
    expect(stateKey(coinEnv, 9, ['pit_near'], new Set())).toBe('x0')
    expect(stateKey(coinEnv, 10, ['pit_near'], new Set())).toBe('x1')
    expect(stateKey(coinEnv, coinEnv.start, ['coin_direction'], new Set())).toBe('cE')
    expect(stateKey(coinEnv, coinEnv.start, ['coin_direction'], new Set([10]))).toBe('cnone')
  })

  it('counts the situations the senses can report', () => {
    const open = envOf({ map: OPEN })
    expect(countSituations(open, ['position'])).toBe(5)
    expect(countSituations(open, ['walls'])).toBeLessThan(5)
  })

  it('describes a situation in plain words', () => {
    expect(describeSituation('w1001|tSE')).toBe('walls: up, left; treasure is down and right')
  })

  it('learns with senses, deterministically, and lists top situations', () => {
    const senses = ['walls', 'treasure_direction']
    const rewards = { ...DEFAULT_REWARDS, coin: 3 }
    const a = agentAfter(coinEnv, rewards, 60, senses)
    const b = agentAfter(coinEnv, rewards, 60, senses)
    expect(a.q).toEqual(b.q)
    const top = topSituations(a, 3)
    expect(top.length).toBeGreaterThan(0)
    expect(top[0].visits).toBeGreaterThanOrEqual(top[top.length - 1].visits)
  })

  it('runs on a test map with no training and a step cap', () => {
    const senses = ['walls', 'treasure_direction']
    const task = { ...TASK, senses, testMaps: [['######', '#..T.#', '#.##.#', '#R...#', '######']] }
    const agent = agentAfter(envOf(task), DEFAULT_REWARDS, 80, senses)
    const before = agent.episodes
    const testEnv = testMapFor(task, 0)
    const run = greedyRun(testEnv, DEFAULT_REWARDS, agent, { unseen: true })
    expect(agent.episodes).toBe(before)
    expect(run.steps).toBeLessThanOrEqual(120)
    expect(testMapFor(task, 1)).toEqual(testEnv)
    expect(testMapFor(TASK, 0)).toBeNull()
  })

  it('passes on the test map when testMaps are set, else on the Go!', () => {
    const task = { ...TASK, testMaps: [['#####', '#R.T#', '#####']] }
    const trained = { ...normalizeGameAgentState(task, null), trained: 50, reached: true }
    expect(gradeTask(task, trained).passed).toBe(false)
    const tested = withTestResult(trained, { reached: true, score: 9, steps: 2 })
    expect(gradeTask(task, tested).passed).toBe(true)
    expect(gradeTask(TASK, trained).passed).toBe(true)
  })

  it('changing senses resets learning but keeps rewards', () => {
    const s = { ...normalizeGameAgentState(TASK, null), trained: 30 }
    const next = withSenses(TASK, s, ['walls'])
    expect(next.trained).toBe(0)
    expect(next.senses).toEqual(['walls'])
    expect(next.rewards).toEqual(s.rewards)
    expect(withRewards(TASK, next, { ...next.rewards, step: -2 }).senses).toEqual(['walls'])
  })

  it('shows the mystery-map score on the card when race is on', () => {
    const task = { ...TASK, race: true, testMaps: [['#####', '#R.T#', '#####']] }
    const base = { ...normalizeGameAgentState(task, null), trained: 40 }
    const s = withTestResult(base, { reached: true, score: 8, steps: 2 })
    expect(summaryOf(task, s).text).toBe('mystery map: 8 pts · 40 tries')
  })

  it('reports senses, rewards, tries and the test result in the shared state', () => {
    const run = { reached: false, score: -9, steps: 30 }
    const s = withTestResult(normalizeGameAgentState(TASK, null), run)
    const shared = JSON.parse(definition.serializeShared(s))
    expect(shared).toMatchObject({
      senses: ['position'],
      tests: 1,
      testReached: false,
      testScore: -9,
    })
    expect(shared.rewards).toBeDefined()
    expect(shared.trained).toBe(0)
  })
})

describe('a new map (senses that carry over)', () => {
  const rewards = { treasure: 10, step: -1, wall: -5, pit: -10, coin: 3 }
  const train = envOf({ map: ['#######', '#R.C..#', '#.#X#T#', '#######'] })
  const mystery = envOf({ map: ['######', '#..T.#', '#.##.#', '#R...#', '######'] })
  const onNewMap = (senses) =>
    greedyRun(mystery, rewards, agentAfter(train, rewards, 100, senses), { unseen: true })

  it('walls and the treasure compass find the way first time', () => {
    expect(onNewMap(['walls', 'treasure_direction'])).toMatchObject({
      reached: true,
      moves: 'UURR',
    })
  })

  it('a robot that only knows its square number gets lost', () => {
    expect(onNewMap(['position']).reached).toBe(false)
  })

  it('the compass alone is not enough here', () => {
    expect(onNewMap(['treasure_direction']).reached).toBe(false)
  })

  it('uses the closest situation it knows', () => {
    const agent = agentAfter(train, rewards, 100, ['walls', 'treasure_direction'])
    const known = [...agent.q.keys()][0]
    expect(closestKnown(agent, known)).toBe(known)
    expect(closestKnown(newAgent(train, ['walls']), 'w0000')).toBe(null)
  })
})
