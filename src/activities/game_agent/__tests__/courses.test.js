import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  DEFAULT_REWARDS,
  agentAfter,
  gradeTask,
  greedyRun,
  initialGameAgentState,
  normalizeGameAgentState,
  parseMap,
  COURSE_TRIES_FACTOR,
  summaryOf,
  triesPerTrain,
  withCourseResult,
} from '../game_agent.js'
import {
  MAX_ATTEMPTS,
  courseFor,
  courseSeedOf,
  courseSpecOf,
  generateCourse,
  hasDeadEndTrap,
  trainingCourseFor,
  validateRandomCourses,
} from '../courses.js'

const spec = (extra = {}) => courseSpecOf({ randomCourses: extra })
// A task map to train on: walls, a pit and a bend, bigger than the starter map.
const OWN_MAP = ['#######', '#R....#', '#.##.##', '#..#..#', '##.#X.#', '#....T#', '#######']
const task = (extra = {}) => ({
  id: 't1',
  map: OWN_MAP,
  randomCourses: { size: 7, walls: 0.25, pits: 1, seed: 'class' },
  ...extra,
})

describe('coursesBeaten', () => {
  it('counts each beaten course once, out of at least 5', async () => {
    const { coursesBeaten } = await import('../game_agent.js')
    const c = (n, reached) => ({ n, score: 1, reached })
    expect(coursesBeaten({ courses: [] }).text).toBe('New courses beaten: 0 of 5')
    expect(coursesBeaten({ courses: [c(1, true), c(1, true), c(2, false)] }).text).toBe(
      'New courses beaten: 1 of 5'
    )
  })
})

describe('generateCourse', () => {
  it('makes 200 seeds of solvable courses with no dead-end trap near the way', () => {
    let fallbacks = 0
    let total = 0
    for (const size of [5, 7, 9]) {
      for (let seed = 0; seed < 200; seed += 1) {
        const s = spec({ size, walls: 0.4, pits: 3, coins: 2 })
        const course = generateCourse(s, seed, seed % 5)
        const parsed = parseMap(course.rows)
        expect(parsed.errors, `size ${size} seed ${seed}`).toEqual([])
        expect(course.rows).toHaveLength(size)
        expect(course.rows.every((row) => row.length === size)).toBe(true)
        expect(hasDeadEndTrap(course.rows), `size ${size} seed ${seed}`).toBe(false)
        total += 1
        if (course.fallback) fallbacks += 1
      }
    }
    // The fallback is a rarity, not how most courses are made (even at the busiest settings).
    expect(fallbacks / total).toBeLessThan(0.1)
  })

  it('places the number of pits and coins asked for', () => {
    const { rows } = generateCourse(spec({ size: 9, walls: 0.1, pits: 3, coins: 2 }), 7, 0)
    const flat = rows.join('')
    expect(flat.split('X').length - 1).toBe(3)
    expect(flat.split('C').length - 1).toBe(2)
    expect(flat.split('R').length - 1).toBe(1)
    expect(flat.split('T').length - 1).toBe(1)
  })

  it('gives the same courses for the same seed, and different ones for another', () => {
    const s = spec()
    const run = (seed) => [0, 1, 2, 3, 4].map((i) => generateCourse(s, seed, i).rows.join('/'))
    expect(run(42)).toEqual(run(42))
    expect(run(42)).not.toEqual(run(43))
    expect(new Set(run(42)).size).toBeGreaterThan(1)
  })

  it('detects a dead-end pocket beside the way to the treasure', () => {
    const trap = ['.....', '.....', 'R...T', '.#.#.', '.#.#.']
    expect(hasDeadEndTrap(trap)).toBe(true)
    expect(hasDeadEndTrap(['.....', '.....', 'R...T', '.....', '.....'])).toBe(false)
    // a single notch (its exit opens onto open ground) is not a trap
    expect(hasDeadEndTrap(['.....', '.....', 'R...T', '.#.#.', '.....'])).toBe(false)
  })

  it('never fails: a crowded spec still gives a solvable course', () => {
    const course = generateCourse(spec({ size: 5, walls: 0.4, pits: 3 }), 1, 0)
    expect(parseMap(course.rows).errors).toEqual([])
    expect(course.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS)
  })
})

describe('class seed', () => {
  it('is the same for the same lesson and task, and differs by lesson or task', () => {
    const t = task()
    expect(courseSeedOf(t, 'lesson-a')).toBe(courseSeedOf({ ...t }, 'lesson-a'))
    expect(courseSeedOf(t, 'lesson-a')).not.toBe(courseSeedOf(t, 'lesson-b'))
    expect(courseSeedOf(t, 'lesson-a')).not.toBe(courseSeedOf({ ...t, id: 't2' }, 'lesson-a'))
    expect(courseFor(t, 'lesson-a', 2).rows).toEqual(courseFor(t, 'lesson-a', 2).rows)
  })

  it('uses a number seed as it is, for any lesson', () => {
    const t = task({ randomCourses: { seed: 99 } })
    expect(courseSeedOf(t, 'a')).toBe(99)
    expect(courseSeedOf(t, 'b')).toBe(99)
  })
})

describe('Fun moment: a robot with senses clears most class courses it never practised on', () => {
  // The task's own map is tiny; Train practises on random courses from a separate stream.
  const OWN = ['R....', '.....', '..T..', '.....', '.....']
  const t = task({ map: OWN, randomCourses: { size: 5, walls: 0.15, pits: 0, seed: 'class' } })
  const rewards = { ...DEFAULT_REWARDS }
  const LESSONS = 60
  // Fraction of the first 5 class courses cleared after 3 presses of Train, over 60 classes.
  const cleared = (senses) => {
    const own = parseMap(OWN).env
    let n = 0
    for (let lesson = 0; lesson < LESSONS; lesson += 1) {
      const id = `lesson-${lesson}`
      const tries = 3 * triesPerTrain(t)
      const agent = agentAfter(own, rewards, tries, senses, (i) => trainingCourseFor(t, id, i).env)
      for (let i = 0; i < 5; i += 1) {
        if (greedyRun(courseFor(t, id, i).env, rewards, agent, { unseen: true }).reached) n += 1
      }
    }
    return n / (LESSONS * 5)
  }

  it('walls + treasure compass clears 60% and beats the compass alone and position alone', () => {
    const walls = cleared(['walls', 'treasure_direction'])
    const compass = cleared(['treasure_direction'])
    const naive = cleared(['position'])
    expect(walls).toBeGreaterThanOrEqual(0.6)
    expect(walls).toBeGreaterThan(compass + 0.05)
    expect(compass).toBeGreaterThan(naive)
    expect(walls).toBeGreaterThan(naive * 2)
  }, 120000)

  it('practises on training courses that are not the class test courses', () => {
    const seen = new Set()
    for (let i = 0; i < 40; i += 1) seen.add(trainingCourseFor(t, 'lesson-1', i).rows.join('/'))
    const tests = new Set()
    for (let i = 0; i < 40; i += 1) tests.add(courseFor(t, 'lesson-1', i).rows.join('/'))
    expect(trainingCourseFor(t, 'lesson-1', 3).rows).toEqual(
      trainingCourseFor(t, 'lesson-1', 3).rows
    )
    expect(seen.size).toBeGreaterThan(20)
    expect([...tests].filter((rows) => seen.has(rows)).length).toBeLessThan(6)
  })

  it('runs more tries per Train press with courses, and the usual number without', () => {
    expect(triesPerTrain(t)).toBe(50 * COURSE_TRIES_FACTOR)
    expect(triesPerTrain({ map: OWN })).toBe(50)
  })

  it('replays to the same robot every time (a saved state rebuilds it)', () => {
    const own = parseMap(OWN).env
    const make = () =>
      agentAfter(
        own,
        rewards,
        60,
        ['walls', 'treasure_direction'],
        (i) => trainingCourseFor(t, 'x', i).env
      )
    expect([...make().q.entries()]).toEqual([...make().q.entries()])
  })
})

describe('state, grading and the card', () => {
  const t = task()
  const trained = { ...initialGameAgentState(t), trained: 50 }
  const run = (reached, score) => ({ reached, score, steps: 5, moves: 'R', cells: [0] })

  it('passes when the robot reaches the treasure on a generated course', () => {
    expect(gradeTask(t, trained).passed).toBe(false)
    const lost = withCourseResult(trained, run(false, -12))
    expect(gradeTask(t, lost).passed).toBe(false)
    const won = withCourseResult(lost, run(true, 6))
    expect(gradeTask(t, won).passed).toBe(true)
    expect(won.tests).toBe(2)
    expect(won.courses).toEqual([
      { n: 1, score: -12, reached: false },
      { n: 2, score: 6, reached: true },
    ])
  })

  it('shares the course scores and shows them by course number on the tutor card', () => {
    const won = withCourseResult(withCourseResult(trained, run(true, 8)), run(false, -9))
    const shared = JSON.parse(definition.serializeShared(won))
    expect(normalizeGameAgentState(t, shared).courses).toHaveLength(2)
    expect(summaryOf(t, won).text).toBe(
      'course 1: 8 pts · course 2: lost · 1 of 5 beaten · 50 tries'
    )
  })

  it('starts the sequence again when the rewards change (the robot forgot everything)', () => {
    expect(initialGameAgentState(t).courses).toEqual([])
  })

  it('summarises the class', () => {
    const state = withCourseResult(withCourseResult(trained, run(true, 8)), run(false, -9))
    const out = definition.report.summaryFields(t, [
      { distinctAttempts: [{ submission: state }] },
      { distinctAttempts: [{ submission: trained }] },
    ])
    expect(out.gameAgentResults.avgCoursesTried).toBe(2)
    expect(out.gameAgentResults.avgCoursesCleared).toBe(1)
  })
})

describe('validateRandomCourses', () => {
  const errs = (extra) => validateRandomCourses({ randomCourses: extra }, 1).errors
  it('accepts the example and an empty object', () => {
    expect(errs({ size: 7, walls: 0.25, pits: 1, seed: 'class' })).toEqual([])
    expect(errs({})).toEqual([])
    expect(errs({ size: 5, walls: 0, pits: 0, coins: 3, seed: 12 })).toEqual([])
  })
  it('rejects bad values', () => {
    expect(validateRandomCourses({ randomCourses: [1] }, 1).errors[0]).toMatch(/must be an object/)
    expect(errs({ size: 4 })[0]).toMatch(/size must be a whole number from 5 to 9/)
    expect(errs({ size: 10 })).toHaveLength(1)
    expect(errs({ walls: 0.5 })[0]).toMatch(/walls must be a number from 0 to 0.4/)
    expect(errs({ pits: 4 })[0]).toMatch(/pits must be a whole number from 0 to 3/)
    expect(errs({ coins: 1.5 })[0]).toMatch(/coins must be a whole number/)
    expect(errs({ seed: 'everyone' })[0]).toMatch(/seed must be class or a whole number/)
  })
  it('warns that testMaps are not used with randomCourses', () => {
    const out = validateRandomCourses({ randomCourses: {}, testMaps: [['R.T']] }, 1)
    expect(out.warnings[0]).toMatch(/testMaps are not used/)
  })
})
