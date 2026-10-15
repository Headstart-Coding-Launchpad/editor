// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import {
  courseCardChip,
  courseMapHeading,
  mergeCourseRunResults,
  runTurtleTask,
  summarizeCourseResult,
} from '../courseRun.js'
import { buildTurtleProgram } from '../shim.js'
import { getTaskCourse } from '../course.js'

const MAP_A = '#>.G#'
const MAP_B = '#>..G#\n#.*..#'

function mapRun(status, outcome = {}) {
  return {
    status,
    variables: { x: { type: 'int', json: '1' } },
    turtle: {
      state: { x: 1, y: 2, heading: 0 },
      commands: [{ type: 'line', x1: 0, y1: 0, x2: 1, y2: 2 }],
      calls: [{ name: 'forward', args: [] }],
      course: {
        type: 'grid',
        vehicle: 'rover',
        goalReached: true,
        crashed: false,
        crash: null,
        pickups: 0,
        pickupsTotal: 0,
        moves: 2,
        stopped: null,
        message: null,
        ...outcome,
      },
    },
  }
}

describe('runTurtleTask', () => {
  it('runs an ordinary task once, with the first-run options', async () => {
    const runPython = vi.fn(async () => ({ status: 'success' }))
    const onOutput = vi.fn()
    await runTurtleTask(
      'turtle.forward(10)',
      { id: 1 },
      {
        runPython,
        onOutput,
        firstRunOptions: { capture: { panel: true } },
      }
    )
    expect(runPython).toHaveBeenCalledTimes(1)
    expect(runPython.mock.calls[0][0]).toBe(buildTurtleProgram('turtle.forward(10)'))
    expect(runPython.mock.calls[0][1]).toEqual({ onOutput, capture: { panel: true } })
  })

  it('runs a course once per map, setting up each map on line 2, headed in the output', async () => {
    const task = { id: 7, course: { type: 'grid', vehicle: 'rover', maps: [MAP_A, MAP_B] } }
    const runPython = vi.fn(async () => mapRun('success'))
    const onOutput = vi.fn()
    const result = await runTurtleTask('turtle.forward()', task, {
      runPython,
      onOutput,
      firstRunOptions: { record: { lineOffset: 2 } },
    })
    expect(runPython).toHaveBeenCalledTimes(2)
    const [first, second] = runPython.mock.calls
    const course = getTaskCourse(task)
    expect(first[0].split('\n')[1]).toBe(
      `_turtle_course_setup(${JSON.stringify(JSON.stringify({ type: 'grid', vehicle: 'rover', map: MAP_A, index: 0, count: 2, taskId: '7' }))})`
    )
    expect(first[0].split('\n').slice(2).join('\n')).toBe('turtle.forward()')
    expect(second[0]).toContain(JSON.stringify(JSON.stringify(course.maps[1])).slice(1, 20))
    // Slow-mo / the name-tag panel follow map 1 only.
    expect(first[1].record).toEqual({ lineOffset: 2 })
    expect(second[1]).not.toHaveProperty('record')
    expect(onOutput.mock.calls.map((call) => call[0])).toEqual([
      courseMapHeading(0, 2),
      courseMapHeading(1, 2),
    ])
    expect(result.status).toBe('success')
    expect(result.turtle.course).toMatchObject({ type: 'grid', vehicle: 'rover', taskId: '7' })
    expect(result.turtle.course.maps).toHaveLength(2)
  })

  it('heads nothing for a single map', async () => {
    const onOutput = vi.fn()
    await runTurtleTask(
      '',
      { course: { type: 'grid', map: MAP_A } },
      {
        runPython: async () => mapRun('success'),
        onOutput,
      }
    )
    expect(onOutput).not.toHaveBeenCalled()
  })

  it('stops after a map whose run errors; the rest are not run', async () => {
    const runPython = vi.fn(async () => mapRun('error', { goalReached: false }))
    const result = await runTurtleTask(
      '',
      { course: { type: 'grid', maps: [MAP_A, MAP_B] } },
      {
        runPython,
      }
    )
    expect(runPython).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('error')
    expect(result.turtle.course.maps[1]).toMatchObject({
      status: 'not_run',
      goalReached: false,
      pickupsTotal: 1,
      commands: [],
    })
  })

  it('carries on after a crash (not an error)', async () => {
    const runPython = vi.fn(async () =>
      mapRun('success', {
        crashed: true,
        goalReached: false,
        crash: { message: 'Bump.', x: 0, y: 0 },
      })
    )
    const result = await runTurtleTask(
      '',
      { course: { type: 'grid', maps: [MAP_A, MAP_B] } },
      {
        runPython,
      }
    )
    expect(runPython).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('success')
  })

  it('is stopped when any map is stopped, or Stop is pressed between maps', async () => {
    const stopped = await runTurtleTask(
      '',
      { course: { type: 'grid', maps: [MAP_A, MAP_B] } },
      {
        runPython: async () => ({ status: 'stopped' }),
      }
    )
    expect(stopped.status).toBe('stopped')

    let stops = 0
    const runPython = vi.fn(async () => {
      stops += 1
      return mapRun('success')
    })
    const between = await runTurtleTask(
      '',
      { course: { type: 'grid', maps: [MAP_A, MAP_B] } },
      {
        runPython,
        getStopCount: () => stops,
      }
    )
    expect(runPython).toHaveBeenCalledTimes(1)
    expect(between.status).toBe('stopped')
  })
})

describe('mergeCourseRunResults', () => {
  it("keeps map 1's run for the usual checks and adds every map's outcome and drawing", () => {
    const course = getTaskCourse({
      course: { type: 'grid', vehicle: 'rover', maps: [MAP_A, MAP_B] },
    })
    const merged = mergeCourseRunResults(
      course,
      [mapRun('success'), mapRun('success', { goalReached: false, pickups: 1, pickupsTotal: 1 })],
      12
    )
    expect(merged.variables).toEqual({ x: { type: 'int', json: '1' } })
    expect(merged.turtle.calls).toEqual([{ name: 'forward', args: [] }])
    expect(merged.turtle.course.taskId).toBe('12')
    expect(merged.turtle.course.maps[0]).toMatchObject({
      index: 0,
      status: 'success',
      goalReached: true,
      commands: [expect.objectContaining({ type: 'line' })],
      state: { x: 1, y: 2, heading: 0 },
    })
    expect(merged.turtle.course.maps[1]).toMatchObject({ index: 1, goalReached: false, pickups: 1 })
  })
})

describe('course summaries for the tutor', () => {
  const twoMaps = (second) =>
    mergeCourseRunResults(
      getTaskCourse({ course: { type: 'grid', maps: [MAP_A, MAP_B] } }),
      [mapRun('success'), second],
      5
    ).turtle

  it('counts maps reached, crashes and pickups', () => {
    expect(
      summarizeCourseResult(
        twoMaps(
          mapRun('success', { crashed: true, goalReached: false, pickups: 1, pickupsTotal: 1 })
        )
      )
    ).toEqual({ maps: 2, reached: 1, crashed: 1, pickups: 1, pickupsTotal: 1 })
    expect(summarizeCourseResult({ commands: [] })).toBeNull()
  })

  it('shows "2/3 maps"-style chips with several maps', () => {
    const task = { id: 5, course: { type: 'grid', maps: [MAP_A, MAP_B] } }
    expect(courseCardChip(task, twoMaps(mapRun('success')))).toMatchObject({
      label: '2/2 maps',
      tone: 'good',
    })
    expect(
      courseCardChip(task, twoMaps(mapRun('success', { crashed: true, goalReached: false })))
    ).toMatchObject({
      label: '1/2 maps',
      tone: 'bad',
      title: expect.stringMatching(/crashed on 1/),
    })
  })

  it('shows "Reached goal" or "Crashed" with one map, and nothing for another task', () => {
    const task = { id: 9, course: { type: 'grid', map: MAP_A } }
    const one = (outcome) =>
      mergeCourseRunResults(getTaskCourse(task), [mapRun('success', outcome)], 9).turtle
    expect(courseCardChip(task, one({}))).toMatchObject({ icon: '🏁', label: 'Reached goal' })
    expect(
      courseCardChip(
        task,
        one({
          goalReached: false,
          crashed: true,
          crash: { message: 'The rover hit a wall at row 1, column 3.' },
        })
      )
    ).toMatchObject({
      icon: '💥',
      label: 'Crashed',
      title: 'The rover hit a wall at row 1, column 3.',
    })
    expect(courseCardChip(task, one({ goalReached: false }))).toMatchObject({
      label: 'Not at goal',
    })
    expect(courseCardChip({ ...task, id: 10 }, one({}))).toBeNull()
    expect(courseCardChip({ id: 9 }, one({}))).toBeNull()
  })
})
