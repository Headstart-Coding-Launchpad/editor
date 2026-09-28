import {
  validateMouseTask,
  gradeMouseItem,
  gradeMouseTask,
  activeMouseItems,
  describeMouseItem,
} from '../mouse.js'

const task = {
  touch: 'equivalent',
  targets: [
    { id: 'folder', label: 'folder', x: 0.2, y: 0.5 },
    { id: 'bin', label: 'recycle bin', x: 0.8, y: 0.5 },
  ],
  items: [
    { id: 'a', action: 'double_click', target: 'folder' },
    { id: 'b', action: 'drag', target: 'folder', to: 'bin' },
    { id: 'c', action: 'hover', target: 'bin' },
  ],
}

describe('validateMouseTask', () => {
  it('accepts a valid stage and warns that hover is skipped on touch', () => {
    expect(validateMouseTask(task, 1)).toEqual({
      errors: [],
      warnings: [
        `Task 1 item 3: touch screens can't hover, so this item is skipped on touch devices.`,
      ],
    })
  })

  it('reports bad targets, positions and actions', () => {
    const bad = {
      targets: [{ id: 't', x: 1.5, y: 0.2, size: 'huge' }],
      items: [
        { id: 'a', action: 'drag', target: 't' },
        { id: 'b', action: 'tickle', target: 't' },
        { id: 'c', action: 'click', target: 'missing' },
      ],
    }
    expect(validateMouseTask(bad, 3).errors).toEqual([
      'Task 3 target 1: x and y must be between 0 and 1 (fractions of the stage).',
      'Task 3 target 1: size must be one of large, medium, small.',
      'Task 3 item 1: a drag needs a "to" target that is on the stage.',
      'Task 3 item 2: action must be one of click, double_click, right_click, drag, scroll, hover.',
      'Task 3 item 3: target "missing" is not on the stage.',
    ])
  })
})

describe('grading', () => {
  it('describes items in plain words', () => {
    expect(describeMouseItem(task, task.items[1])).toBe('Drag the folder to the recycle bin')
  })

  it('tells a single click apart from a double-click', () => {
    expect(gradeMouseItem(task, task.items[0], { via: 'double_click' }).correct).toBe(true)
    expect(gradeMouseItem(task, task.items[0], { via: 'click' })).toEqual({
      correct: false,
      hint: 'That was a click. Double-click the folder.',
    })
  })

  it('accepts touch equivalents unless touch is blocked', () => {
    expect(gradeMouseItem(task, task.items[0], { via: 'double_tap' }).correct).toBe(true)
    expect(
      gradeMouseItem({ ...task, touch: 'block' }, task.items[0], { via: 'double_tap' }).correct
    ).toBe(false)
  })

  it('skips hover on touch devices when grading', () => {
    expect(activeMouseItems(task, { touch: true }).map((i) => i.id)).toEqual(['a', 'b'])
    const state = { items: { a: { via: 'double_tap' }, b: { via: 'drag' } } }
    expect(gradeMouseTask(task, state, { touch: true }).done).toBe(true)
    expect(gradeMouseTask(task, state, { touch: false })).toMatchObject({
      total: 3,
      correct: 2,
      done: false,
    })
  })
})
