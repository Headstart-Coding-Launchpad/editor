// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createTurtleRecorder } from '../recorder.js'
import { buildCourseWorld, gridCellCentre, COURSE_TRAIL_COLOR } from '../course.js'
import { COURSE_MAX_MOVES, COURSE_MAX_SENSOR_CHECKS } from '../courseDrive.js'

const MAZE = `#########
#>..#..G#
#.#.#.#.#
#...*...#
#########`
const WORLD = buildCourseWorld('grid', MAZE, 'rover')

function grid(map = MAZE, vehicle = 'rover') {
  const rec = createTurtleRecorder()
  expect(rec.setCourse({ type: 'grid', vehicle, map })).toBe('')
  return rec
}

function at(rec, row, col) {
  const centre = gridCellCentre(WORLD, row, col)
  expect(rec.state.x).toBeCloseTo(centre.x)
  expect(rec.state.y).toBeCloseTo(centre.y)
}

describe('course mode: setting up', () => {
  it('starts the vehicle on the start square with a faint trail, placed instantly', () => {
    const rec = grid()
    at(rec, 1, 1)
    expect(rec.state.heading).toBe(0)
    expect(rec.state.color).toBe(COURSE_TRAIL_COLOR)
    expect(rec.commands.map((c) => c.type)).toEqual(['visible', 'move', 'visible'])
    expect(rec.commands[0]).toEqual({ type: 'visible', visible: false })
    expect(rec.calls).toEqual([])
  })

  it('answers a plain error for a map it cannot use', () => {
    const rec = createTurtleRecorder()
    expect(rec.setCourse({ type: 'grid', map: '#..#' })).toMatch(/^error\|.*no start/)
    expect(rec.course).toBeNull()
  })

  it('says the sensors need a course on an ordinary task', () => {
    expect(createTurtleRecorder().sense('wall_ahead')).toMatch(/^error\|wall_ahead\(\) only works/)
  })

  it('leaves ordinary turtle answers as they were (nothing)', () => {
    const rec = createTurtleRecorder()
    expect(rec.forward(10)).toBeUndefined()
    expect(rec.turn(45)).toBeUndefined()
    expect(rec.markCommand('circle')).toBeUndefined()
  })
})

describe('course mode: grid movement', () => {
  it('moves whole squares, one line per square', () => {
    const rec = grid()
    expect(rec.forward(2)).toBe('')
    at(rec, 1, 3)
    expect(rec.commands.filter((c) => c.type === 'line')).toHaveLength(2)
    expect(rec.course.moves).toBe(1)
  })

  it('turns in quarter turns and drives along the new heading', () => {
    const rec = grid()
    expect(rec.turn(-90)).toBe('')
    expect(rec.state.heading).toBe(270)
    expect(rec.forward(2)).toBe('')
    at(rec, 3, 1)
    expect(rec.turn(90)).toBe('')
    expect(rec.state.heading).toBe(0)
    expect(rec.forward(1)).toBe('')
    at(rec, 3, 2)
    // backward(): a negative distance, one square back along the heading.
    expect(rec.forward(-1)).toBe('')
    at(rec, 3, 1)
  })

  it('refuses other angles and part squares with a plain message', () => {
    const rec = grid()
    expect(rec.turn(45)).toBe(
      'error|On a grid, the rover turns in quarter turns: use left() or left(90), not left(45).'
    )
    expect(rec.turn(-30)).toMatch(/use right\(\) or right\(90\), not right\(30\)/)
    expect(rec.forward(1.5)).toBe(
      'error|On a grid, forward() moves whole squares: use forward() or forward(2), not forward(1.5).'
    )
    expect(rec.setHeading(45)).toMatch(/setheading\(\) takes 0, 90, 180 or 270/)
    expect(rec.goto(0, 0)).toMatch(/goto\(\) can't be used on a grid course/)
    expect(rec.home()).toMatch(/home\(\) can't be used/)
    expect(rec.reset()).toMatch(/reset\(\) can't be used/)
    expect(rec.markCommand('circle')).toMatch(/circle\(\) can't be used on a grid course/)
    at(rec, 1, 1)
    expect(rec.state.heading).toBe(0)
  })

  it('collects a pickup by driving over it', () => {
    const rec = grid()
    rec.turn(-90)
    rec.forward(2)
    rec.turn(90)
    expect(rec.sense('collected')).toBe('0')
    rec.forward(3)
    at(rec, 3, 4)
    expect(rec.sense('collected')).toBe('1')
    expect(rec.sense('on_pickup')).toBe('true')
    expect(rec.commands.filter((c) => c.type === 'pickup')).toEqual([
      expect.objectContaining({ type: 'pickup', index: 0 }),
    ])
    // Driving over it again doesn't collect it twice.
    rec.forward(-1)
    rec.forward(1)
    expect(rec.sense('collected')).toBe('1')
  })

  it('crashes into a wall: stops, bumps, marks the crash and ends the run', () => {
    const rec = grid()
    const answer = rec.forward(5)
    expect(answer).toBe('stop|The rover hit a wall at row 2, column 5.')
    at(rec, 1, 3)
    const tail = rec.commands.slice(-3)
    expect(tail.map((c) => c.type)).toEqual(['move', 'move', 'crash'])
    expect(tail[0].x2).toBeGreaterThan(tail[0].x1)
    expect(tail[1].x2).toBeCloseTo(tail[0].x1)
    expect(rec.state.crashed).toBe(true)
    expect(rec.course).toMatchObject({
      crashed: true,
      goalReached: false,
      crash: { message: 'The rover hit a wall at row 2, column 5.' },
      stopped: null,
    })
    expect(rec.courseHalt).toEqual({
      kind: 'crash',
      message: 'The rover hit a wall at row 2, column 5.',
    })
    // Nothing moves after a crash.
    expect(rec.forward(1)).toMatch(/^stop\|/)
    expect(rec.sense('at_goal')).toMatch(/^stop\|/)
    at(rec, 1, 3)
  })

  it('says when the vehicle drives off the edge of an unwalled map', () => {
    const rec = grid('>.G', 'car')
    rec.turn(180)
    expect(rec.forward(1)).toBe('stop|The car hit the edge of the map at row 1, column 1.')
    expect(rec.course.crash.message).toBe('The car hit the edge of the map at row 1, column 1.')
  })
})

describe('course mode: grid sensors', () => {
  it('looks ahead, left and right of the heading', () => {
    const rec = grid()
    expect(rec.sense('wall_ahead')).toBe('false')
    expect(rec.sense('wall_left')).toBe('true')
    expect(rec.sense('wall_right')).toBe('false')
    rec.forward(2)
    expect(rec.sense('wall_ahead')).toBe('true')
    expect(rec.sense('at_goal')).toBe('false')
  })

  it('reaches the goal with a wall-following program', () => {
    const rec = grid()
    let guard = 0
    while (rec.sense('at_goal') !== 'true' && guard < 100) {
      guard += 1
      if (rec.sense('wall_right') === 'false') {
        rec.turn(-90)
        rec.forward(1)
      } else if (rec.sense('wall_ahead') === 'false') rec.forward(1)
      else rec.turn(90)
    }
    expect(rec.course).toMatchObject({
      goalReached: true,
      crashed: false,
      pickups: 1,
      pickupsTotal: 1,
    })
  })

  it('stops a program that never stops moving or never stops asking', () => {
    const rec = grid('#>.G#')
    let answer = ''
    for (let i = 0; i <= COURSE_MAX_MOVES && !answer.startsWith('stop'); i += 1) {
      answer = rec.turn(90)
    }
    expect(answer).toMatch(/made 1000 moves without the program finishing/)
    expect(rec.course.stopped).toBe('moves')

    const asker = grid('#>.G#')
    let reply = ''
    for (let i = 0; i <= COURSE_MAX_SENSOR_CHECKS && !reply.startsWith('stop'); i += 1) {
      reply = asker.sense('at_goal')
    }
    expect(reply).toMatch(/checked the sensors 20000 times/)
    expect(asker.course.stopped).toBe('sensors')
  })

  it("doesn't count circle()'s own steps as moves", () => {
    const rec = createTurtleRecorder()
    rec.setCourse({ type: 'track', map: { start: { x: 0, y: -100 }, goal: { x: 150, y: 150 } } })
    expect(rec.markCommand('circle')).toBe('')
    rec.forward(5, true)
    rec.turn(10, true)
    expect(rec.course.moves).toBe(1)
  })
})

describe('course mode: tracks', () => {
  const track = {
    start: { x: -150, y: 0, heading: 0 },
    goal: { x: 150, y: 0, r: 20 },
    walls: [[0, -50, 0, 50]],
    pickups: [[-100, 0]],
  }

  function drive(map = track, vehicle = 'car') {
    const rec = createTurtleRecorder()
    expect(rec.setCourse({ type: 'track', vehicle, map })).toBe('')
    return rec
  }

  it('stops at the wall, collecting pickups on the way, in order', () => {
    const rec = drive()
    const answer = rec.forward(300)
    expect(answer).toBe('stop|The car hit a wall at x -10, y 0.')
    expect(rec.state.x).toBeCloseTo(-10, 1)
    const types = rec.commands.map((c) => c.type)
    expect(types.indexOf('pickup')).toBeLessThan(types.lastIndexOf('line'))
    expect(rec.course).toMatchObject({ pickups: 1, crashed: true })
    // The crash mark is where the car's front meets the wall.
    expect(rec.course.crash.x).toBeCloseTo(0, 1)
    expect(rec.course.crash.y).toBeCloseTo(0, 5)
  })

  it('drives round the wall to the goal', () => {
    const rec = drive()
    expect(rec.forward(50)).toBe('')
    rec.turn(90)
    expect(rec.forward(80)).toBe('')
    rec.turn(-90)
    expect(rec.forward(250)).toBe('')
    rec.turn(-90)
    expect(rec.forward(80)).toBe('')
    expect(rec.sense('at_goal')).toBe('true')
    expect(rec.course).toMatchObject({ goalReached: true, crashed: false, pickups: 1, moves: 7 })
  })

  it('answers a plain error for a distance that is not a number', () => {
    const rec = drive()
    expect(rec.forward('ten')).toBe('error|forward() needs a number.')
  })

  it('senses walls a short distance ahead and to the sides', () => {
    const rec = drive()
    rec.forward(130)
    expect(rec.state.x).toBeCloseTo(-20)
    expect(rec.sense('wall_ahead')).toBe('true')
    const far = drive()
    expect(far.sense('wall_ahead')).toBe('false')
    rec.turn(90)
    expect(rec.sense('wall_right')).toBe('true')
    expect(rec.sense('wall_left')).toBe('false')
  })

  it('names the edge of the picture', () => {
    const rec = drive()
    rec.turn(90)
    expect(rec.forward(500)).toBe('stop|The car hit the edge of the picture at x -150, y 190.')
  })

  it('drives goto() along a straight line, with walls in the way', () => {
    const rec = drive()
    expect(rec.goto(100, 0)).toMatch(/^stop\|The car hit a wall/)
    const clear = drive()
    expect(clear.goto(-150, 100)).toBe('')
    expect(clear.state.y).toBe(100)
  })
})
