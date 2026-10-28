// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REWARDS,
  agentAfter,
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
    expect(msgs(['R.T?'])).toEqual(['Task 2: map row 1 has "?"; use # . R T X only.'])
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

  it('warns that race is not built yet', () => {
    expect(validateGameAgentWarnings({ race: true }, 4)).toEqual([
      "Task 4: race is not built yet; the tutor's card shows each best score so a race can be run on the big screen.",
    ])
    expect(validateGameAgentWarnings({}, 4)).toEqual([])
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
    })
  })
})
