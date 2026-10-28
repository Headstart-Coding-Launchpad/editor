import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  DEFAULT_REWARDS,
  gradeTask,
  hintFor,
  initialGameAgentState,
  normalizeGameAgentState,
  sensesOf,
  summaryOf,
  validateGameAgentTask,
  validateGameAgentWarnings,
  withCourseResult,
} from '../game_agent.js'
import { courseFor, trainingCourseFor } from '../courses.js'
import {
  FIT_STEPS,
  copySolutionFor,
  examplesOf,
  featuresAt,
  fitNet,
  fitSteps,
  forward,
  inputNames,
  movesDriven,
  netRun,
  newNet,
  replayDrive,
  shortestWay,
} from '../copybot.js'

const SENSES = ['walls', 'treasure_direction']
const rewards = { ...DEFAULT_REWARDS }
// A gentle practice area: small courses, a few walls, no pits.
const task = (extra = {}) => ({
  id: 'c1',
  brain: 'copy',
  map: ['#####', '#R..#', '#.#T#', '#####'],
  randomCourses: { size: 5, walls: 0.15, pits: 0, seed: 'class' },
  ...extra,
})

// A copy-bot trained on `driver`'s driving over `count` practice courses, then run on the first
// 5 unseen class courses of each of 60 lessons: the fraction that reached the treasure.
function cleared(driver, count) {
  const t = task()
  let won = 0
  const LESSONS = 60
  for (let lesson = 0; lesson < LESSONS; lesson += 1) {
    const id = `lesson-${lesson}`
    const envFor = (c) => trainingCourseFor(t, id, c).env
    const drives = Array.from({ length: count }, (_, c) => ({ c, moves: driver(envFor(c)) }))
    const examples = examplesOf(drives, envFor, SENSES)
    const net = fitNet(examples, examples[0].x.length)
    for (let i = 0; i < 5; i += 1) {
      if (netRun(courseFor(t, id, i).env, rewards, net, SENSES).reached) won += 1
    }
  }
  return won / (LESSONS * 5)
}

describe('Fun moment: it drives like you on courses it has never seen', () => {
  it('a good driver on 3 courses gives a bot that clears most unseen courses', () => {
    expect(cleared(shortestWay, 3)).toBeGreaterThanOrEqual(0.65)
    expect(cleared(shortestWay, 2)).toBeGreaterThanOrEqual(0.55)
  }, 120000)

  it('an always-right driver gives a bot that mostly fails (it copies the habit)', () => {
    const habit = cleared(() => 'RRRRRR', 3)
    expect(habit).toBeLessThan(0.5)
    expect(habit).toBeLessThan(cleared(shortestWay, 3) - 0.25)
  }, 120000)
})

describe('senses as numbers', () => {
  it('names an input neuron for each light and leaves position out by default', () => {
    expect(sensesOf(task())).toEqual(SENSES)
    expect(sensesOf(task({ senses: ['position', 'walls'] }))).toEqual(['position', 'walls'])
    expect(inputNames(SENSES)).toEqual([
      'wall up',
      'wall right',
      'wall down',
      'wall left',
      'treasure up',
      'treasure right',
      'treasure down',
      'treasure left',
    ])
  })

  it('reports walls and the treasure compass', () => {
    const env = courseFor(task(), 'a', 0).env
    const x = featuresAt(env, env.start, SENSES, new Set())
    expect(x).toHaveLength(8)
    expect(x.every((v) => v === 0 || v === 1)).toBe(true)
    // the treasure is somewhere, so at least one compass light is on
    expect(x.slice(4).some((v) => v === 1)).toBe(true)
  })
})

describe('the network', () => {
  const examples = [
    { x: [1, 0, 0, 0, 0, 1, 0, 0], y: 1 },
    { x: [0, 0, 1, 0, 0, 0, 1, 0], y: 2 },
  ]

  it('is the same every time and its outputs add up to 1', () => {
    const a = fitNet(examples, 8)
    expect(a.w1).toEqual(fitNet(examples, 8).w1)
    const { out } = forward(a, examples[0].x)
    expect(out.reduce((x, y) => x + y, 0)).toBeCloseTo(1)
    expect(out.indexOf(Math.max(...out))).toBe(1)
  })

  it('fits in chunks to the same network as in one go (so it can run across frames)', () => {
    const whole = fitNet(examples, 8)
    const parts = newNet(8)
    for (let i = 0; i < FIT_STEPS; i += 60) fitSteps(parts, examples, 60)
    expect(parts.w2).toEqual(whole.w2)
  })

  it('copies a silly habit: always right means it drives right', () => {
    const t = task()
    const envFor = (c) => trainingCourseFor(t, 'x', c).env
    const habit = examplesOf(
      [
        { c: 0, moves: 'RRRR' },
        { c: 1, moves: 'RRR' },
      ],
      envFor,
      SENSES
    )
    expect(habit.every((e) => e.y === 1)).toBe(true)
    const run = netRun(courseFor(t, 'x', 0).env, rewards, fitNet(habit, 8), SENSES)
    expect(run.moves.startsWith('R')).toBe(true)
    expect(run.acts[0].out.indexOf(Math.max(...run.acts[0].out))).toBe(1)
  })

  it('records a drive and stops it at the treasure', () => {
    const env = trainingCourseFor(task(), 'y', 0).env
    const way = shortestWay(env)
    const done = replayDrive(env, rewards, `${way}RRRR`)
    expect(done.done).toBe(true)
    expect(done.reached).toBe(true)
    expect(done.cells).toHaveLength(way.length + 1)
    expect(
      movesDriven([
        { c: 0, moves: way },
        { c: 1, moves: 'RR' },
      ])
    ).toBe(way.length + 2)
  })
})

describe('state, grading, the card and the answer', () => {
  const t = task()
  const trained = {
    ...initialGameAgentState(t),
    drives: [
      { c: 0, moves: 'RRRDD' },
      { c: 1, moves: 'LLLUUUU' },
    ],
    trained: 12,
  }
  const run = (reached, score) => ({ reached, score, steps: 5, moves: 'R', cells: [0] })

  it('keeps the drives in the shared state and drops junk', () => {
    const shared = JSON.parse(definition.serializeShared(trained))
    expect(normalizeGameAgentState(t, shared).drives).toEqual(trained.drives)
    const junk = normalizeGameAgentState(t, {
      drives: [{ c: -1, moves: 'R' }, { c: 2, moves: 'RXD' }, 5],
    })
    expect(junk.drives).toEqual([{ c: 2, moves: 'RD' }])
  })

  it('passes when the copy-bot reaches the treasure on a new course', () => {
    expect(gradeTask(t, trained).passed).toBe(false)
    expect(gradeTask(t, withCourseResult(trained, run(false, -12))).passed).toBe(false)
    expect(gradeTask(t, withCourseResult(trained, run(true, 8))).passed).toBe(true)
    expect(hintFor(trained, t)).toMatch(/Watch it drive/)
    expect(hintFor(initialGameAgentState(t), t)).toMatch(/Drive the robot/)
  })

  it('shows examples and the new-course result on the tutor card', () => {
    expect(summaryOf(t, initialGameAgentState(t)).text).toBe('Not driven yet')
    expect(summaryOf(t, { ...trained, trained: 0 }).text).toBe(
      'copy-bot · 12 moves · not trained yet'
    )
    const won = withCourseResult(withCourseResult(trained, run(false, -9)), run(true, 8))
    expect(summaryOf(t, won).text).toBe('copy-bot · 12 moves · course 2: 8 pts · 1 of 5 beaten')
    const lost = withCourseResult(trained, run(false, -9))
    expect(summaryOf(t, lost).text).toBe('copy-bot · 12 moves · course 1: lost · 0 of 5 beaten')
  })

  it('has an answer that drives three courses and tries one new one', () => {
    const solved = copySolutionFor(t)
    expect(solved.drives).toHaveLength(3)
    expect(solved.courses).toHaveLength(1)
    expect(definition.solutionState(t)).toEqual(solved)
  })
})

describe('authoring checks', () => {
  it('accepts brain copy with the network panel and rejects other values', () => {
    expect(validateGameAgentTask(task({ panels: ['network'] }), 1)).toEqual([])
    expect(validateGameAgentTask(task({ brain: 'magic' }), 1)[0]).toMatch(
      /brain must be reward or copy/
    )
    expect(validateGameAgentTask(task({ panels: 'network' }), 1)[0]).toMatch(
      /panels must be a list/
    )
    expect(validateGameAgentTask(task({ panels: ['sound'] }), 1)[0]).toMatch(/panels has "sound"/)
  })

  it('warns about testMaps, position and a network panel with the usual brain', () => {
    const warn = (extra) => validateGameAgentWarnings(task(extra), 1).join('|')
    expect(warn({ testMaps: [['R.T']] })).toMatch(/testMaps are not used when brain is copy/)
    expect(warn({ senses: ['position'] })).toMatch(/cannot tell one course from another/)
    expect(warn({ brain: 'reward', panels: ['network'] })).toMatch(/only drawn when brain is copy/)
  })

  it('works with no randomCourses (it uses the defaults)', () => {
    const t = { id: 'z', brain: 'copy', map: ['#####', '#R..#', '#.#T#', '#####'] }
    expect(definition.validateTask(t, { n: 1 }).errors).toEqual([])
    expect(courseFor(t, 'l', 0).rows).toHaveLength(7)
  })
})
