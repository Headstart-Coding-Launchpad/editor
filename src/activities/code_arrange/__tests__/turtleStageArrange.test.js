// @vitest-environment node
// Code Arrange on Turtle (course mode too) and on the Python Stage (P6-15): which arrangements
// sit in the host module's own workspace, and that both validators accept them.
import { describe, expect, it } from 'vitest'
import definition, { hostModuleFor, usesHostWorkspace } from '../definition.js'
import { validateLesson } from '../../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../../cli/validate.mjs'

const ROVER_TASK = {
  id: 72,
  title: 'Get the rover to the flag',
  taskType: 'code_arrange',
  moduleType: 'turtle',
  explainer: 'Drag the lines into place so the rover reaches the flag on both maps.',
  course: {
    type: 'grid',
    vehicle: 'rover',
    maps: ['########\n#>....G#\n########\n', '#####\n#>..#\n###.#\n###G#\n#####\n'],
  },
  lines: [
    { id: 'L1', parts: [{ type: 'text', text: 'import turtle' }] },
    { id: 'L2', parts: [{ type: 'text', text: 'while not turtle.at_goal():' }] },
    {
      id: 'L3',
      parts: [
        { type: 'text', text: '    if turtle.' },
        { type: 'slot', id: 'S1', code: 'wall_ahead' },
        { type: 'text', text: '():' },
      ],
    },
    { id: 'L4', parts: [{ type: 'slot', id: 'L4', code: '        turtle.right()' }] },
    { id: 'L5', parts: [{ type: 'text', text: '    else:' }] },
    { id: 'L6', parts: [{ type: 'slot', id: 'L6', code: '        turtle.forward()' }] },
  ],
  distractors: [
    { id: 'D1', code: 'at_goal' },
    { id: 'D2', code: '        turtle.left()' },
  ],
  check: [
    { type: 'course_goal_reached', hint: 'Watch where the rover stops.' },
    { type: 'course_no_crash', hint: 'Look before every move.' },
  ],
}

const DRAWING_TASK = {
  id: 73,
  title: 'Draw a square',
  taskType: 'code_arrange',
  moduleType: 'turtle',
  lines: [
    { id: 'L1', parts: [{ type: 'text', text: 'import turtle' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'for side in range(4):' }] },
    { id: 'L3', parts: [{ type: 'slot', id: 'L3', code: '    turtle.forward(100)' }] },
    { id: 'L4', parts: [{ type: 'slot', id: 'L4', code: '    turtle.left(90)' }] },
  ],
  distractors: [{ id: 'D1', code: '    turtle.right(45)' }],
  check: { type: 'turtle_segment_count', operator: 'equals', value: '4' },
}

const STAGE_TASK = {
  id: 74,
  title: 'Draw the sun',
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'text', text: 'from stage import *' }] },
    {
      id: 'L2',
      parts: [
        { type: 'text', text: 'circle(50, "' },
        { type: 'slot', id: 'S1', code: 'yellow' },
        { type: 'text', text: '")' },
      ],
    },
  ],
  distractors: [{ id: 'D1', code: 'blue' }],
  stageTarget: { code: 'from stage import *\ncircle(50, "yellow")' },
  check: { type: 'stage_shape_count', kind: 'circle', min: 1 },
}

const PLAIN_PYTHON_TASK = {
  id: 75,
  title: 'Print it',
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print("Hi")' }] }],
  check: { type: 'output', operator: 'contains', value: 'Hi' },
}

const TURTLE_INDENT_TASK = {
  id: 76,
  title: 'Indent the square',
  taskType: 'code_arrange',
  explainer: 'Slide the two moves into the loop so the turtle draws a square.',
  moduleType: 'turtle',
  arrangeMode: 'indent',
  lines: [
    { id: 'L1', code: 'import turtle', depth: 0, locked: true },
    { id: 'L2', code: 'for side in range(4):', depth: 0, locked: true },
    { id: 'L3', code: 'turtle.forward(100)', depth: 1 },
    { id: 'L4', code: 'turtle.left(90)', depth: 1 },
  ],
  check: { type: 'turtle_segment_count', operator: 'equals', value: '4' },
}

function lessonWith(...tasks) {
  return { id: 'arrange-visual', type: 'composed', title: 'Arrange', description: 'x', tasks }
}

// The Builder also asks for a preview run before publishing; that isn't about the task.
const untested = (warnings) => warnings.filter((w) => !w.includes("hasn't been tested"))

describe('usesHostWorkspace', () => {
  it('puts every Turtle arrangement in the Turtle workspace, course or not', () => {
    expect(usesHostWorkspace(ROVER_TASK)).toBe(true)
    expect(usesHostWorkspace(DRAWING_TASK)).toBe(true)
    expect(usesHostWorkspace(TURTLE_INDENT_TASK)).toBe(true)
    expect(definition.usesHostWorkspace(ROVER_TASK)).toBe(true)
  })

  it('puts a Python arrangement that imports stage in the Python workspace', () => {
    expect(usesHostWorkspace(STAGE_TASK)).toBe(true)
    const { stageTarget: _target, ...withoutTarget } = STAGE_TASK
    expect(usesHostWorkspace(withoutTarget)).toBe(true)
  })

  it('counts a stage import inside a blank (the solution tile)', () => {
    expect(
      usesHostWorkspace({
        ...PLAIN_PYTHON_TASK,
        lines: [
          { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'from stage import *' }] },
          { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'background("navy")' }] },
        ],
      })
    ).toBe(true)
  })

  it('counts a stageTarget on its own, and a Stage arrangement in indent mode', () => {
    expect(usesHostWorkspace({ ...PLAIN_PYTHON_TASK, stageTarget: { code: 'import stage' } })).toBe(
      true
    )
    expect(
      usesHostWorkspace({
        ...TURTLE_INDENT_TASK,
        moduleType: 'python',
        lines: [
          { id: 'L1', code: 'from stage import *', depth: 0, locked: true },
          { id: 'L2', code: 'for x in range(3):', depth: 0, locked: true },
          { id: 'L3', code: 'circle(40, "red", x=x * 100)', depth: 1 },
        ],
      })
    ).toBe(true)
  })

  it('leaves plain Python and HTML arrangements on the board with their console / preview', () => {
    expect(usesHostWorkspace(PLAIN_PYTHON_TASK)).toBe(false)
    expect(usesHostWorkspace({ ...PLAIN_PYTHON_TASK, stageTarget: { code: '  ' } })).toBe(false)
    expect(usesHostWorkspace({ ...PLAIN_PYTHON_TASK, moduleType: 'html' })).toBe(false)
    expect(usesHostWorkspace(null)).toBe(false)
  })
})

describe('host modules', () => {
  it('offers turtle as a host module, keeping python as the default', () => {
    expect(definition.hostModules).toContain('turtle')
    expect(hostModuleFor('turtle')).toBe('turtle')
    expect(hostModuleFor('scratch')).toBe('python')
    expect(hostModuleFor(undefined)).toBe('python')
  })

  it("validates a turtle arrangement's structure with the shared rules", () => {
    expect(definition.validateTask(ROVER_TASK, { n: 1 }).errors).toEqual([])
    expect(definition.validateTask(TURTLE_INDENT_TASK, { n: 1 }).errors).toEqual([])
  })
})

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s validation of Turtle and Stage arrangements', (_name, validate) => {
  it('accepts a course-mode Turtle arrangement with course checks', () => {
    const { errors, warnings } = validate(lessonWith(ROVER_TASK))
    expect(errors).toEqual([])
    expect(untested(warnings)).toEqual([])
  })

  it('accepts a drawing Turtle arrangement with a Turtle check', () => {
    expect(validate(lessonWith(DRAWING_TASK)).errors).toEqual([])
  })

  it('accepts a Turtle arrangement in indent mode', () => {
    const { errors, warnings } = validate(lessonWith(TURTLE_INDENT_TASK))
    expect(errors).toEqual([])
    expect(untested(warnings)).toEqual([])
  })

  it('accepts a Stage arrangement with a stageTarget and a stage check', () => {
    expect(validate(lessonWith(STAGE_TASK)).errors).toEqual([])
  })

  it("runs the Turtle module's own rules on the arrangement (a bad course map)", () => {
    const { errors } = validate(
      lessonWith({ ...ROVER_TASK, course: { type: 'grid', maps: ['#####\n#...#\n#####\n'] } })
    )
    expect(errors.length).toBeGreaterThan(0)
  })

  it('still rejects a host module that cannot run an arrangement', () => {
    const { errors } = validate(lessonWith({ ...DRAWING_TASK, moduleType: 'scratch' }))
    expect(errors).toContain(
      'Task 1 is a code-arrange task but must use the Python, Python Turtle or HTML module'
    )
  })

  it('warns when a Turtle solution forgets to indent after a ":"', () => {
    const { warnings } = validate(
      lessonWith({
        ...DRAWING_TASK,
        lines: DRAWING_TASK.lines.map((line) =>
          line.id === 'L3'
            ? { id: 'L3', parts: [{ type: 'slot', id: 'L3', code: 'turtle.forward(100)' }] }
            : line
        ),
      })
    )
    expect(warnings).toContain('Task 1 line 3 follows a line ending in ":" but is not indented')
  })
})
