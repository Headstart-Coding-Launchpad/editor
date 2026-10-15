import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CourseMapEditor, {
  gridFromMapText,
  mapTextFromGrid,
  paintGrid,
  resizeGrid,
} from '../CourseMapEditor.jsx'
import { getTaskCourse } from '../course.js'

const AUTHORED = '#######\n#>...G#\n#######'
const course = getTaskCourse({
  course: { type: 'grid', vehicle: 'rover', map: AUTHORED, studentMap: true },
})

describe('map editor grid helpers', () => {
  it('reads a map into an even grid: off-map squares and unknown characters become walls', () => {
    expect(mapTextFromGrid(gridFromMapText('#>G\n# x .'))).toBe('#>G##\n####.\n#####')
  })

  it('keeps one start: placing it moves it, tapping it again turns it', () => {
    let grid = gridFromMapText(AUTHORED)
    grid = paintGrid(grid, 1, 3, 'start')
    expect(mapTextFromGrid(grid)).toBe('#######\n#..>.G#\n#######')
    grid = paintGrid(grid, 1, 3, 'start', { turnStart: true })
    expect(grid[1][3]).toBe('v')
    expect(paintGrid(grid, 1, 3, 'start')).toBe(grid)
  })

  it('paints walls, road, goals and stars', () => {
    let grid = gridFromMapText(AUTHORED)
    grid = paintGrid(grid, 1, 2, 'wall')
    grid = paintGrid(grid, 1, 3, 'star')
    grid = paintGrid(grid, 1, 5, 'road')
    grid = paintGrid(grid, 1, 4, 'goal')
    expect(grid[1].join('')).toBe('#>#*G.#')
  })

  it('adds and takes away rows and columns within 3 to 30', () => {
    const grid = gridFromMapText(AUTHORED)
    expect(resizeGrid(grid, { rows: 1 })).toHaveLength(4)
    expect(resizeGrid(grid, { rows: -1 })).toHaveLength(3)
    expect(resizeGrid(grid, { cols: 1 })[0]).toHaveLength(8)
    expect(resizeGrid(grid, { cols: -1 })[0]).toHaveLength(6)
  })
})

describe('CourseMapEditor', () => {
  it("opens on the code's map, and writes the painted map back into the code", () => {
    const code =
      'import turtle\nturtle.course_map("""\n#####\n#>.G#\n#####\n""")\nturtle.forward(2)'
    const onApply = vi.fn()
    render(<CourseMapEditor code={code} course={course} onApply={onApply} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Map editor' })).toBeTruthy()
    const square = screen.getByRole('button', { name: 'Row 2, column 3: road' })
    expect(square.style.width).toBe('44px')
    fireEvent.click(screen.getByRole('button', { name: /Star$/ }))
    // A keyboard press (detail 0) paints the square.
    fireEvent.click(square, { detail: 0 })
    expect(screen.getByRole('button', { name: 'Row 2, column 3: star' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use this map' }))
    expect(onApply).toHaveBeenCalledWith(
      'import turtle\nturtle.course_map("""\n#####\n#>*G#\n#####\n""")\nturtle.forward(2)'
    )
  })

  it("starts from the task's map when the code has none, and says what's missing", () => {
    const onApply = vi.fn()
    render(
      <CourseMapEditor code="import turtle" course={course} onApply={onApply} onClose={() => {}} />
    )
    expect(screen.getByRole('status').textContent).toBe('Your map is ready to drive.')
    fireEvent.click(screen.getByRole('button', { name: /Road/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Row 2, column 6: goal' }), { detail: 0 })
    expect(screen.getByRole('status').textContent).toBe('Your map needs a G for the goal.')
    const use = screen.getByRole('button', { name: 'Use this map' })
    expect(use.disabled).toBe(true)
    fireEvent.click(use)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('adds the call after import turtle', () => {
    const onApply = vi.fn()
    render(
      <CourseMapEditor
        code={'import turtle\nturtle.forward()'}
        course={course}
        onApply={onApply}
        onClose={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use this map' }))
    expect(onApply).toHaveBeenCalledWith(
      `import turtle\nturtle.course_map("""\n${AUTHORED}\n""")\nturtle.forward()`
    )
  })

  it('closes with Escape or Close', () => {
    const onClose = vi.fn()
    render(<CourseMapEditor code="" course={course} onApply={() => {}} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
