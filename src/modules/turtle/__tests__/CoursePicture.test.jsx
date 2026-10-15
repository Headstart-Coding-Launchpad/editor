import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoursePicture from '../CoursePicture.jsx'
import { mergeCourseRunResults } from '../courseRun.js'
import { buildCourseWorld, getTaskCourse, gridCellCentre } from '../course.js'

// jsdom has no canvas: a 2D context that accepts every call, so the map and vehicle really draw.
function recordingContext(canvas) {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'canvas') return canvas
        return () => {}
      },
      set() {
        return true
      },
    }
  )
}

let originalGetContext

beforeEach(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return recordingContext(this)
  }
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

const MAP_A = '#####\n#>.G#\n#####'
const MAP_B = '#####\n#>.*G#\n######'
const task = { id: 4, course: { type: 'grid', vehicle: 'rover', maps: [MAP_A, MAP_B] } }

function mapRun(map, outcome) {
  const world = buildCourseWorld('grid', map, 'rover')
  const end = gridCellCentre(world, 1, outcome.col)
  return {
    status: 'success',
    turtle: {
      state: { x: end.x, y: end.y, heading: 0, visible: true },
      commands: [
        { type: 'line', x1: world.start.x, y1: world.start.y, x2: end.x, y2: end.y, heading: 0 },
      ],
      calls: [],
      course: {
        goalReached: false,
        crashed: false,
        crash: null,
        pickups: 0,
        pickupsTotal: world.pickups.length,
        moves: 1,
        stopped: null,
        message: null,
        ...outcome,
      },
    },
  }
}

function runResult(runId) {
  const merged = mergeCourseRunResults(
    getTaskCourse(task),
    [
      mapRun(MAP_A, { col: 3, goalReached: true }),
      mapRun(MAP_B, {
        col: 2,
        crashed: true,
        crash: { message: 'The rover hit a wall at row 2, column 4.', x: 0, y: 0 },
        message: 'The rover hit a wall at row 2, column 4.',
      }),
    ],
    task.id
  )
  return { ...merged.turtle, runId }
}

describe('CoursePicture', () => {
  it('is the plain Turtle picture for a task with no course', () => {
    render(<CoursePicture task={{ id: 1 }} result={null} animate={false} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Turtle drawing/)
    expect(screen.queryByRole('group', { name: 'Maps' })).toBeNull()
  })

  it('shows the map and the vehicle at the start before any run, with a tab per map', () => {
    render(<CoursePicture task={task} result={null} animate={false} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Map 1 of 2. Rover at row 2, column 2, facing east. Goal at row 2, column 4.'
    )
    expect(screen.getByRole('button', { name: 'Map 1: not played yet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Map 2: not played yet' })).toBeTruthy()
  })

  it('ticks and crosses each map after a run, shows the first miss and announces it', () => {
    const onPlayingChange = vi.fn()
    const { rerender } = render(
      <CoursePicture task={task} result={null} animate={false} onPlayingChange={onPlayingChange} />
    )
    rerender(
      <CoursePicture
        task={task}
        result={runResult('r1')}
        animate={false}
        onPlayingChange={onPlayingChange}
      />
    )
    const first = screen.getByRole('button', { name: 'Map 1: reached the goal' })
    const second = screen.getByRole('button', { name: 'Map 2: crashed' })
    expect(first.textContent).toContain('✓')
    expect(second.textContent).toContain('✕')
    expect(second.getAttribute('aria-pressed')).toBe('true')
    expect(
      screen.getByText(/The rover hit a wall at row 2, column 4\./, { selector: 'div' })
    ).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(
      'Map 2: The rover hit a wall at row 2, column 4.'
    )
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      '0 of 1 pickups collected.'
    )
    expect(onPlayingChange).not.toHaveBeenCalledWith(true)

    fireEvent.click(first)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/The rover reached the goal!/, { selector: 'div' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Map 1: The rover reached the goal!')
  })

  it('draws a result with no course part (slow-mo, a preview) on map 1', () => {
    render(
      <CoursePicture
        task={task}
        result={{ commands: [], state: { x: 0, y: 0, heading: 90 } }}
        animate={false}
      />
    )
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
      /^Map 1 of 2\. .*facing north/
    )
  })
})

describe('CoursePicture: student-made maps (course.studentMap)', () => {
  const OWN = '#####\n#.>.#\n#..G#\n#####'
  const ownTask = {
    id: 9,
    course: { type: 'grid', vehicle: 'rover', map: MAP_A, studentMap: true },
  }

  it("shows the map in the student's code before any run, described like an authored map", () => {
    const code = `import turtle\nturtle.course_map("""\n${OWN}\n""")`
    render(<CoursePicture task={ownTask} code={code} result={null} animate={false} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Your map. Rover at row 2, column 3, facing east. Goal at row 3, column 4.'
    )
  })

  it("shows the task's map while the code's map can't be used", () => {
    const code = 'import turtle\nturtle.course_map("""\n#>..#\n""")'
    render(<CoursePicture task={ownTask} code={code} result={null} animate={false} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Rover at row 2, column 2, facing east. Goal at row 2, column 4.'
    )
  })

  it("shows the run's own map (from the synced result), even with no code", () => {
    const result = {
      commands: [],
      state: null,
      course: {
        type: 'grid',
        vehicle: 'rover',
        maps: [{ status: 'success', goalReached: false, studentMap: OWN, commands: [] }],
      },
    }
    render(<CoursePicture task={ownTask} result={result} animate={false} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
      /^Your map\. Rover at row 2, column 3, facing east\. Goal at row 3, column 4\./
    )
  })
})
