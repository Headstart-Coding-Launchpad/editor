// @vitest-environment node
import {
  validateKeyboardTask,
  gradeKeyboardItem,
  gradeKeyboardTask,
  describeItem,
} from '../keyboard.js'

const typeText = {
  mode: 'type_text',
  requireShiftForCapitals: true,
  items: [{ id: 'a', text: 'Hi Sam' }],
}

describe('validateKeyboardTask', () => {
  it('accepts a valid task in every mode', () => {
    expect(validateKeyboardTask(typeText, 1).errors).toEqual([])
    const findKey = {
      mode: 'find_key',
      items: [
        { id: 'a', key: 'Enter' },
        { id: 'b', key: '@' },
      ],
    }
    expect(validateKeyboardTask(findKey, 1).errors).toEqual([])
    expect(
      validateKeyboardTask({ mode: 'symbols', items: [{ id: 'a', char: '£' }] }, 1).errors
    ).toEqual([])
    expect(
      validateKeyboardTask(
        { mode: 'shortcuts', items: [{ id: 'a', combo: 'Ctrl+C', prompt: 'Copy' }] },
        1
      )
    ).toEqual({ errors: [], warnings: [] })
  })

  it('rejects browser-reserved shortcuts and suggests a quiz instead', () => {
    const { errors } = validateKeyboardTask(
      { mode: 'shortcuts', items: [{ id: 'a', combo: 'Ctrl+W', prompt: 'Close tab' }] },
      2
    )
    expect(errors).toEqual([
      `Task 2 item 1: "Ctrl+W" is kept by the browser, so students can't press it here. Teach it with a quiz question instead.`,
    ])
  })

  it('accepts Shift with a non-typing key but rejects Shift with a character', () => {
    const task = (combo) => ({ mode: 'shortcuts', items: [{ id: 'a', combo, prompt: 'Do it' }] })
    expect(validateKeyboardTask(task('Shift+ArrowLeft'), 1).errors).toEqual([])
    expect(validateKeyboardTask(task('Shift+Tab'), 1).errors).toEqual([])
    expect(validateKeyboardTask(task('Shift+A'), 1).errors).toEqual([
      'Task 1 item 1: "Shift+A" just types a character. Use Ctrl, Cmd or Alt, or Shift with a key like Tab or an arrow key.',
    ])
    expect(validateKeyboardTask(task('Ctrl+Shift'), 1).errors).toEqual([
      'Task 1 item 1: combo must be a shortcut like "Ctrl+C".',
    ])
  })

  it('reports untypeable text, bad layouts, bad settings and duplicate ids', () => {
    expect(
      validateKeyboardTask({ ...typeText, items: [{ id: 'a', text: 'Price €5' }] }, 1).errors
    ).toEqual([`Task 1 item 1: can't be typed on a UK keyboard: €`])
    expect(validateKeyboardTask({ ...typeText, layout: 'us' }, 1).errors).toEqual([
      'Task 1: keyboard layout "us" is not supported (use "uk").',
    ])
    expect(validateKeyboardTask({ ...typeText, minAccuracy: 2, targetWpm: -1 }, 1).errors).toEqual([
      'Task 1: minAccuracy must be a number above 0 and at most 1.',
      'Task 1: targetWpm must be a positive number.',
    ])
    const symbols = {
      mode: 'symbols',
      items: [
        { id: 'a', char: '"' },
        { id: 'a', char: 'ab' },
      ],
    }
    expect(validateKeyboardTask(symbols, 1).errors).toEqual([
      'Task 1 item 2: id "a" is used more than once.',
      'Task 1 item 2: char must be one character that can be typed on a UK keyboard.',
    ])
    expect(validateKeyboardTask({ mode: 'dance' }, 1).errors[0]).toMatch(/keyboard mode must be/)
  })
})

describe('grading', () => {
  const item = typeText.items[0]

  it('passes correct typing with Shift and explains Caps Lock', () => {
    expect(
      gradeKeyboardItem(typeText, item, { typed: 'Hi Sam', accuracy: 1, capsLockCapitals: 0 })
        .correct
    ).toBe(true)
    expect(
      gradeKeyboardItem(typeText, item, { typed: 'Hi Sam', accuracy: 1, capsLockCapitals: 1 })
    ).toEqual({
      correct: false,
      hint: 'Try holding Shift for capital letters instead of Caps Lock.',
    })
    expect(gradeKeyboardItem(typeText, item, { typed: 'Hi Sa' }).correct).toBe(false)
  })

  it('applies accuracy and optional speed targets', () => {
    const lenient = { ...typeText, minAccuracy: 0.8, targetWpm: 10 }
    expect(
      gradeKeyboardItem(lenient, item, { typed: 'Hi Sxm', accuracy: 0.83, wpm: 12 }).correct
    ).toBe(true)
    expect(
      gradeKeyboardItem(lenient, item, { typed: 'Hi Sxm', accuracy: 0.83, wpm: 5 }).hint
    ).toMatch(/aim for 10 words a minute/)
  })

  it('needs Shift for shifted symbols and the keys (not the menu) for shortcuts', () => {
    const symbols = { mode: 'symbols', items: [{ id: 'a', char: '"' }] }
    expect(
      gradeKeyboardItem(symbols, symbols.items[0], { typedChar: '"', shift: true }).correct
    ).toBe(true)
    expect(gradeKeyboardItem(symbols, symbols.items[0], {}).hint).toBe('Press Shift + 2.')
    const shortcuts = { mode: 'shortcuts', items: [{ id: 'a', combo: 'ctrl+v' }] }
    expect(
      gradeKeyboardItem(shortcuts, shortcuts.items[0], { performed: true, via: 'keyboard' }).correct
    ).toBe(true)
    expect(
      gradeKeyboardItem(shortcuts, shortcuts.items[0], { performed: true, via: 'menu' }).hint
    ).toBe('Use the keys this time: Ctrl + V.')
  })

  it('refuses on-screen keyboard input for hardware-only items', () => {
    const task = { mode: 'find_key', items: [{ id: 'a', key: 'Enter', hardwareOnly: true }] }
    expect(
      gradeKeyboardItem(task, task.items[0], { pressed: true, source: 'virtual' }).correct
    ).toBe(false)
    expect(
      gradeKeyboardItem(task, task.items[0], { pressed: true, source: 'hardware' }).correct
    ).toBe(true)
  })

  it('summarises the task and describes items in words', () => {
    const task = {
      mode: 'find_key',
      items: [
        { id: 'a', key: 'Enter' },
        { id: 'b', key: '@' },
      ],
    }
    expect(gradeKeyboardTask(task, { items: { a: { pressed: true } } })).toEqual({
      total: 2,
      correct: 1,
      done: false,
      hint: `Look for the Shift + ' key.`,
    })
    expect(describeItem({ mode: 'shortcuts' }, { combo: 'cmd+shift+z' })).toBe('Ctrl + Shift + Z')
  })
})
