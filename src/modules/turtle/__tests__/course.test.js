// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildCourseWorld,
  courseRunSpec,
  describeCourse,
  getTaskCourse,
  gridCellAt,
  gridCellCentre,
  gridMapProblems,
  isInTrackGoal,
  sweepTrack,
  trackMapProblems,
  validateTurtleCourse,
  TRACK_VEHICLE_RADIUS,
} from '../course.js'

const MAZE = `#########
#>..#..G#
#.#.#.#.#
#...*...#
#########`

describe('getTaskCourse', () => {
  it('reads a grid map and defaults the vehicle to the turtle', () => {
    expect(getTaskCourse({ course: { type: 'grid', map: MAZE } })).toEqual({
      type: 'grid',
      vehicle: 'turtle',
      maps: [MAZE],
    })
  })

  it('reads several maps, keeps the vehicle, and takes inline track fields as one map', () => {
    expect(
      getTaskCourse({ course: { type: 'grid', vehicle: 'rover', maps: [MAZE, MAZE] } })
    ).toMatchObject({ vehicle: 'rover', maps: [MAZE, MAZE] })
    const course = getTaskCourse({
      course: { type: 'track', start: { x: 0, y: 0 }, goal: { x: 100, y: 0, r: 20 } },
    })
    expect(course.maps).toHaveLength(1)
    expect(course.maps[0].goal).toEqual({ x: 100, y: 0, r: 20 })
  })

  it('is null without a usable course', () => {
    expect(getTaskCourse({})).toBeNull()
    expect(getTaskCourse({ course: { type: 'maze', map: MAZE } })).toBeNull()
    expect(getTaskCourse({ course: { type: 'grid' } })).toBeNull()
  })

  it('builds the worker spec for one map', () => {
    const course = getTaskCourse({ course: { type: 'grid', maps: [MAZE, MAZE] } })
    expect(courseRunSpec(course, 1, 51)).toEqual({
      type: 'grid',
      vehicle: 'turtle',
      map: MAZE,
      index: 1,
      count: 2,
      taskId: '51',
    })
  })
})

describe('grid maps', () => {
  it('scales the map to fit the 400 × 400 world, centred', () => {
    const world = buildCourseWorld('grid', MAZE, 'rover')
    expect(world.rows).toBe(5)
    expect(world.cols).toBe(9)
    expect(world.cell).toBeCloseTo(400 / 9)
    expect(world.left).toBeCloseTo(-200)
    expect(world.top).toBeCloseTo((5 * 400) / 9 / 2)
  })

  it('finds the start, its heading, the goal and the pickups', () => {
    const world = buildCourseWorld('grid', MAZE)
    expect(world.start).toMatchObject({ heading: 0, ...gridCellCentre(world, 1, 1) })
    expect(world.goals).toEqual([{ row: 1, col: 7 }])
    expect(world.pickups).toEqual([expect.objectContaining({ row: 3, col: 4 })])
    expect(gridCellAt(world, world.start.x, world.start.y)).toEqual({ row: 1, col: 1 })
  })

  it('reads every start arrow as a heading', () => {
    expect(buildCourseWorld('grid', '#^G#').start.heading).toBe(90)
    expect(buildCourseWorld('grid', '#<G#').start.heading).toBe(180)
    expect(buildCourseWorld('grid', '#vG#').start.heading).toBe(270)
  })

  it('pads short rows with off-map squares', () => {
    const world = buildCourseWorld('grid', '#>.G#\n#.')
    expect(world.cells[1]).toEqual(['wall', 'road', 'off', 'off', 'off'])
  })

  it('explains a broken map', () => {
    expect(gridMapProblems('#..G#')[0]).toMatch(/no start/)
    expect(gridMapProblems('#>>G#')[0]).toMatch(/2 starts/)
    expect(gridMapProblems('#>..#')[0]).toMatch(/no goal/)
    expect(gridMapProblems('#>.xG#')[0]).toMatch(/"x"/)
    expect(gridMapProblems('')[0]).toMatch(/empty/)
    expect(gridMapProblems(42)[0]).toMatch(/text/)
    expect(gridMapProblems(`>G${'.'.repeat(40)}`)[0]).toMatch(/the most is 30 × 30/)
    expect(buildCourseWorld('grid', '#..G#').error).toMatch(/no start/)
  })
})

describe('track maps', () => {
  const track = {
    start: { x: -150, y: 0, heading: 0 },
    goal: { x: 150, y: 0, r: 20 },
    walls: [[0, -50, 0, 50], { rect: [-100, 100, 100, 120] }],
    pickups: [[-100, 0], { x: 50, y: 150 }],
  }

  it('builds walls from lines, boxes and the edge of the picture', () => {
    const world = buildCourseWorld('track', track, 'car')
    expect(world.lines).toEqual([{ x1: 0, y1: -50, x2: 0, y2: 50 }])
    expect(world.rects).toEqual([{ x1: -100, y1: 100, x2: 100, y2: 120 }])
    // 1 line + 4 box sides + 4 edges.
    expect(world.segments).toHaveLength(9)
    expect(world.pickups).toEqual([
      { x: -100, y: 0 },
      { x: 50, y: 150 },
    ])
    expect(world.radius).toBe(TRACK_VEHICLE_RADIUS)
  })

  it('adds the lines a trackCode snippet draws', () => {
    const world = buildCourseWorld('track', {
      ...track,
      trackCode: 'turtle.penup()\nturtle.goto(-50, -100)\nturtle.pendown()\nturtle.forward(100)',
    })
    expect(world.lines).toContainEqual({ x1: -50, y1: -100, x2: 50, y2: -100 })
  })

  it('stops a sweep where the vehicle touches a wall', () => {
    const world = buildCourseWorld('track', track)
    const hit = sweepTrack(world, -150, 0, 100, 0)
    expect(hit.hit).toBe(true)
    expect(hit.x).toBeCloseTo(-TRACK_VEHICLE_RADIUS, 1)
    expect(hit.y).toBe(0)
    const clear = sweepTrack(world, -150, 70, 100, 70)
    expect(clear).toEqual({ hit: false, x: 100, y: 70, t: 1 })
  })

  it('lets a vehicle touching a wall move away from it', () => {
    const world = buildCourseWorld('track', track)
    expect(sweepTrack(world, -10, 0, -60, 0).hit).toBe(false)
  })

  it('knows when the vehicle is in a round or box goal', () => {
    const round = buildCourseWorld('track', track)
    expect(isInTrackGoal(round, 160, 10)).toBe(true)
    expect(isInTrackGoal(round, 120, 0)).toBe(false)
    const box = buildCourseWorld('track', { ...track, goal: { rect: [100, -20, 140, 20] } })
    expect(isInTrackGoal(box, 120, 0)).toBe(true)
    expect(isInTrackGoal(box, 90, 0)).toBe(false)
  })

  it('explains a broken track', () => {
    expect(trackMapProblems({})[0]).toMatch(/no goal/)
    expect(trackMapProblems({ goal: { x: 0 } })[0]).toMatch(/goal needs x and y/)
    expect(trackMapProblems({ goal: { x: 0, y: 0, r: -1 } })[0]).toMatch(/goal.r/)
    expect(trackMapProblems({ goal: { rect: [1, 2] } })[0]).toMatch(/four numbers/)
    expect(trackMapProblems({ goal: { x: 0, y: 0 }, walls: [[1, 2, 3]] })[0]).toMatch(/wall 1/)
    expect(trackMapProblems({ goal: { x: 0, y: 0 }, pickups: [['a', 1]] })[0]).toMatch(/pickup 1/)
    expect(trackMapProblems({ goal: { x: 0, y: 0 }, start: { x: 300 } })[0]).toMatch(
      /outside the picture/
    )
    expect(trackMapProblems({ goal: { x: 0, y: 0 }, trackCode: 'print(1)' })[0]).toMatch(
      /trackCode line 1/
    )
    expect(trackMapProblems('track')[0]).toMatch(/must be an object/)
  })
})

describe('validateTurtleCourse', () => {
  function validate(course) {
    const errors = []
    const warnings = []
    validateTurtleCourse({ course }, 3, errors, warnings)
    return { errors, warnings }
  }

  it('accepts a good grid and a good track', () => {
    expect(validate({ type: 'grid', vehicle: 'rover', map: MAZE })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(
      validate({ type: 'track', map: { start: { x: -100, y: 0 }, goal: { x: 100, y: 0 } } })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('reports the type, vehicle, map and maps problems', () => {
    expect(validate('grid').errors[0]).toMatch(/Task 3 course must be an object/)
    expect(validate({ type: 'maze' }).errors[0]).toMatch(/course.type must be grid or track/)
    expect(validate({ type: 'grid', vehicle: 'tank', map: MAZE }).errors[0]).toMatch(
      /course.vehicle must be one of/
    )
    expect(validate({ type: 'grid', map: MAZE, maps: [MAZE] }).errors[0]).toMatch(
      /both map and maps/
    )
    expect(validate({ type: 'grid', maps: [] }).errors[0]).toMatch(/course.maps must be a list/)
    expect(validate({ type: 'grid', maps: Array(7).fill(MAZE) }).errors[0]).toMatch(/the most is 6/)
    expect(validate({ type: 'grid' }).errors[0]).toMatch(/course has no map/)
    expect(validate({ type: 'grid', maps: [MAZE, '#>.#'] }).errors[0]).toMatch(
      /Task 3 course map 2: the grid map has no goal/
    )
  })

  it('warns when a track start touches a wall or sits in the goal', () => {
    const { warnings } = validate({
      type: 'track',
      map: { start: { x: 0, y: 195 }, goal: { x: 0, y: 190, r: 30 } },
    })
    expect(warnings).toEqual([
      expect.stringMatching(/start is touching a wall/),
      expect.stringMatching(/starts in the goal/),
    ])
  })
})

describe('describeCourse', () => {
  it('says where the vehicle is, the pickups and the goal', () => {
    const world = buildCourseWorld('grid', MAZE, 'rover')
    const pose = { ...gridCellCentre(world, 1, 2), heading: 0 }
    expect(describeCourse(world, pose, { collected: 0 })).toBe(
      'Rover at row 2, column 3, facing east. 0 of 1 pickups collected. Goal at row 2, column 8.'
    )
  })

  it('adds the map label and what happened', () => {
    const world = buildCourseWorld('track', { goal: { x: 100, y: 0 } }, 'car')
    expect(
      describeCourse(
        world,
        { x: 12.4, y: -3, heading: 90 },
        {
          mapLabel: 'Map 2 of 3',
          outcome: { crashed: true, message: 'The car hit a wall at x 12, y -3.' },
        }
      )
    ).toBe(
      'Map 2 of 3. Car at x 12, y -3, facing north. Goal at x 100, y 0. The car hit a wall at x 12, y -3.'
    )
  })
})
