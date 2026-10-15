// @vitest-environment node
// Student-made maps (P6-16): course.studentMap and turtle.course_map(text).
import { describe, it, expect, vi } from 'vitest'
import {
  codeCallsCourseMap,
  courseMapsShown,
  courseRunSpec,
  findStudentMapCall,
  getTaskCourse,
  gridCellCentre,
  buildCourseWorld,
  normalizeStudentMapText,
  readStudentMapFromCode,
  studentMapProblems,
  validateTurtleCourse,
  writeStudentMapToCode,
} from '../course.js'
import { createTurtleRecorder } from '../recorder.js'
import { courseMapHeading, runTurtleTask } from '../courseRun.js'
import { evaluateCourseCheck } from '../courseChecks.js'
import { compactTurtleResultForSync } from '../sync.js'
import { TURTLE_SHIM } from '../shim.js'

const AUTHORED = '#######\n#>...G#\n#######'
const OWN = '#####\n#>..#\n###.#\n#G..#\n#####'

describe('reading the task field', () => {
  it('keeps studentMap on a grid course and passes it to the run', () => {
    const course = getTaskCourse({ course: { type: 'grid', map: AUTHORED, studentMap: true } })
    expect(course).toEqual({ type: 'grid', vehicle: 'turtle', maps: [AUTHORED], studentMap: true })
    expect(courseRunSpec(course, 0, 5)).toMatchObject({ studentMap: true, map: AUTHORED })
  })

  it('leaves it off a track and a plain grid course', () => {
    expect(getTaskCourse({ course: { type: 'grid', map: AUTHORED } })).not.toHaveProperty(
      'studentMap'
    )
    const track = getTaskCourse({
      course: { type: 'track', studentMap: true, map: { goal: { x: 0, y: 0 } } },
    })
    expect(track).not.toHaveProperty('studentMap')
    expect(
      courseRunSpec(getTaskCourse({ course: { type: 'grid', map: AUTHORED } }), 0)
    ).not.toHaveProperty('studentMap')
  })
})

describe('studentMapProblems', () => {
  it('accepts a usable map, with blank lines and shared indentation', () => {
    expect(studentMapProblems(`\n    ${OWN.split('\n').join('\n    ')}\n`)).toEqual([])
    expect(normalizeStudentMapText('\n  ###\n  #>#\n   G\n')).toBe('###\n#>#\n G')
  })

  it('says what is wrong in plain words', () => {
    expect(studentMapProblems('#>..#')).toEqual(['Your map needs a G for the goal'])
    expect(studentMapProblems('#>.>G#')).toEqual(['Your map has two starts (>): keep just one'])
    expect(studentMapProblems('#>.^G<#')[0]).toBe(
      'Your map has three starts (> ^ <): keep just one'
    )
    expect(studentMapProblems('#..G#', 'rover')[0]).toMatch(
      /^Your map needs a start: put > where the rover begins/
    )
    expect(studentMapProblems('#>.xG#')[0]).toMatch(/^Your map uses "x": use # for walls/)
    expect(studentMapProblems('  \n \n')[0]).toMatch(/^Your map is empty/)
    expect(studentMapProblems(42)[0]).toMatch(/needs your map as text/)
  })

  it('keeps the 30 × 30 limit', () => {
    const wide = `#>G${'.'.repeat(28)}#`
    expect(studentMapProblems(wide)[0]).toBe('Your map is 32 squares wide; the most is 30')
    const tall = ['#>G#', ...Array.from({ length: 30 }, () => '#..#')].join('\n')
    expect(studentMapProblems(tall)[0]).toBe('Your map is 31 rows tall; the most is 30')
  })
})

describe('reading and writing the map in the code', () => {
  const code = `import turtle\nturtle.course_map("""\n${OWN}\n""")\nturtle.forward()`

  it('finds a triple-quoted map, and a one-line one with \\n escapes', () => {
    expect(findStudentMapCall(code).text).toBe(`\n${OWN}\n`)
    expect(findStudentMapCall("turtle.course_map('#>G#\\n####')").text).toBe('#>G#\n####')
    expect(findStudentMapCall('# turtle.course_map("""#>G#""")')).toBeNull()
    expect(findStudentMapCall('turtle.course_map(my_map)')).toBeNull()
    expect(readStudentMapFromCode(code)).toBe(OWN)
    expect(readStudentMapFromCode('turtle.course_map("""#..#""")')).toBeNull()
  })

  it('tells whether code calls course_map (not in a comment)', () => {
    expect(codeCallsCourseMap(code)).toBe(true)
    expect(codeCallsCourseMap('# turtle.course_map("""…""")\nturtle.forward()')).toBe(false)
  })

  it('replaces the map already there', () => {
    const next = writeStudentMapToCode(code, '#>G#')
    expect(next).toBe('import turtle\nturtle.course_map("""\n#>G#\n""")\nturtle.forward()')
  })

  it('adds a call after import turtle (keeping an alias), or at the top with the import', () => {
    expect(writeStudentMapToCode('import turtle\nturtle.forward()', '#>G#')).toBe(
      'import turtle\nturtle.course_map("""\n#>G#\n""")\nturtle.forward()'
    )
    expect(writeStudentMapToCode('import turtle as t\nt.forward()', '#>G#')).toBe(
      'import turtle as t\nt.course_map("""\n#>G#\n""")\nt.forward()'
    )
    expect(writeStudentMapToCode('', '#>G#')).toBe(
      'import turtle\nturtle.course_map("""\n#>G#\n""")\n'
    )
  })
})

describe('turtle.course_map in the recorder', () => {
  function course(extra = {}) {
    const rec = createTurtleRecorder()
    expect(
      rec.setCourse({ type: 'grid', vehicle: 'rover', map: AUTHORED, studentMap: true, ...extra })
    ).toBe('')
    return rec
  }

  it("swaps in the student's map before the first move, and drives it", () => {
    const rec = course()
    expect(rec.setStudentMap(`\n${OWN}\n`)).toBe('')
    const world = buildCourseWorld('grid', OWN, 'rover')
    const start = gridCellCentre(world, 1, 1)
    expect(rec.state.x).toBeCloseTo(start.x)
    expect(rec.state.y).toBeCloseTo(start.y)
    expect(rec.commands.map((c) => c.type)).toEqual(['visible', 'move', 'visible'])
    expect(rec.forward(2)).toBe('')
    expect(rec.turn(-90)).toBe('')
    expect(rec.forward(2)).toBe('')
    expect(rec.turn(-90)).toBe('')
    expect(rec.forward(2)).toBe('')
    expect(rec.course).toMatchObject({ goalReached: true, crashed: false, studentMap: OWN })
  })

  it('keeps the pen settings chosen before it', () => {
    const rec = course()
    rec.setColor('red')
    rec.setSpeed(5)
    expect(rec.setStudentMap(OWN)).toBe('')
    expect(rec.state.color).toBe('red')
    expect(rec.commands).toContainEqual({ type: 'speed', speed: 5 })
  })

  it('refuses it after the vehicle has moved', () => {
    const rec = course()
    rec.forward(1)
    expect(rec.setStudentMap(OWN)).toMatch(/^error\|Call course_map\(\) before the rover moves/)
  })

  it('answers a plain error for a map with a mistake', () => {
    expect(course().setStudentMap('#>..#')).toBe('error|Your map needs a G for the goal.')
    expect(course().setStudentMap('#>>G#')).toMatch(/^error\|Your map has two starts \(>\)/)
  })

  it('refuses it on a task without studentMap, or with no course', () => {
    const rec = createTurtleRecorder()
    expect(rec.setStudentMap(OWN)).toMatch(/^error\|course_map\(\) only works on a course task/)
    rec.setCourse({ type: 'grid', map: AUTHORED })
    expect(rec.setStudentMap(OWN)).toMatch(/^error\|This task's map is set for you/)
    expect(rec.course).not.toHaveProperty('studentMap')
  })

  it('is on the turtle module in the shim', () => {
    expect(TURTLE_SHIM).toContain('def course_map(self, text=None):')
    expect(TURTLE_SHIM).toContain('_js.__hsTurtleCourse("map", text)')
  })
})

function mapRun(outcome = {}) {
  return {
    status: 'success',
    turtle: {
      state: { x: 0, y: 0, heading: 0 },
      commands: [],
      calls: [],
      course: {
        type: 'grid',
        vehicle: 'rover',
        goalReached: true,
        crashed: false,
        crash: null,
        pickups: 0,
        pickupsTotal: 0,
        moves: 3,
        stopped: null,
        message: null,
        ...outcome,
      },
    },
  }
}

describe('running a studentMap task', () => {
  const code = `import turtle\nturtle.course_map("""\n${OWN}\n""")`

  it("runs once on the student's map in place of several maps, with no map headings", async () => {
    const task = {
      id: 3,
      course: { type: 'grid', vehicle: 'rover', studentMap: true, maps: [AUTHORED, AUTHORED] },
    }
    const runPython = vi.fn(async () => mapRun({ studentMap: OWN }))
    const onOutput = vi.fn()
    const result = await runTurtleTask(code, task, { runPython, onOutput })
    expect(runPython).toHaveBeenCalledTimes(1)
    expect(onOutput).not.toHaveBeenCalled()
    expect(result.turtle.course.maps).toHaveLength(1)
    expect(result.turtle.course.maps[0]).toMatchObject({ studentMap: OWN, goalReached: true })
    expect(evaluateCourseCheck({ type: 'course_goal_reached' }, { turtle: result.turtle })).toBe(
      true
    )
  })

  it("drives every authored map when the code doesn't set its own", async () => {
    const task = { course: { type: 'grid', studentMap: true, maps: [AUTHORED, AUTHORED] } }
    const runPython = vi.fn(async () => mapRun())
    const onOutput = vi.fn()
    const result = await runTurtleTask('import turtle', task, { runPython, onOutput })
    expect(runPython).toHaveBeenCalledTimes(2)
    expect(onOutput.mock.calls.map((call) => call[0])).toEqual([
      courseMapHeading(0, 2),
      courseMapHeading(1, 2),
    ])
    expect(result.turtle.course.maps).toHaveLength(2)
  })
})

describe('showing and syncing the student map', () => {
  const course = getTaskCourse({ course: { type: 'grid', map: AUTHORED, studentMap: true } })

  it("shows the run's own map, else the code's map before a run, else the task's", () => {
    expect(courseMapsShown(course, { maps: [{ studentMap: OWN }] })).toEqual({
      maps: [OWN],
      studentMap: true,
    })
    expect(courseMapsShown(course, { maps: [{ goalReached: true }] }, OWN)).toEqual({
      maps: [AUTHORED],
      studentMap: false,
    })
    expect(courseMapsShown(course, null, OWN)).toEqual({ maps: [OWN], studentMap: true })
    expect(courseMapsShown(course, null, null)).toEqual({ maps: [AUTHORED], studentMap: false })
    const plain = getTaskCourse({ course: { type: 'grid', map: AUTHORED } })
    expect(courseMapsShown(plain, null, OWN).maps).toEqual([AUTHORED])
  })

  it('sends the map text to the tutor and Go Live screens', () => {
    const synced = compactTurtleResultForSync({
      state: null,
      commands: [],
      course: { type: 'grid', vehicle: 'rover', maps: [{ status: 'success', studentMap: OWN }] },
    })
    expect(synced.course.maps[0].studentMap).toBe(OWN)
    const tooLong = compactTurtleResultForSync({
      course: { type: 'grid', maps: [{ studentMap: 'x'.repeat(5000) }] },
    })
    expect(tooLong.course.maps[0]).not.toHaveProperty('studentMap')
  })
})

describe('validation', () => {
  function validate(course, extra = {}) {
    const errors = []
    const warnings = []
    validateTurtleCourse({ course, ...extra }, 2, errors, warnings)
    return { errors, warnings }
  }

  it('accepts studentMap on a grid course, which still needs its map', () => {
    expect(validate({ type: 'grid', map: AUTHORED, studentMap: true })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(validate({ type: 'grid', studentMap: true }).errors).toEqual([
      'Task 2 course has no map: add map: with the grid as text',
    ])
  })

  it('errors on a track, or a value that is not true or false', () => {
    expect(
      validate({ type: 'track', studentMap: true, map: { goal: { x: 0, y: 0 } } }).errors
    ).toEqual([
      "Task 2 course.studentMap only works on grid courses: students can't make their own track yet",
    ])
    expect(validate({ type: 'grid', map: AUTHORED, studentMap: 'yes' }).errors).toEqual([
      'Task 2 course.studentMap must be true or false',
    ])
  })

  it('warns when a starter map row starts with #> (a line hint marker)', () => {
    const { warnings } = validate(
      { type: 'grid', map: AUTHORED, studentMap: true },
      {
        codeStages: [
          { role: 'starter', code: 'import turtle\nturtle.course_map("""\n####\n#>G#\n####\n""")' },
        ],
      }
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^Task 2 code stage 1: a course_map\(\) map row starts with #>/)
  })
})
