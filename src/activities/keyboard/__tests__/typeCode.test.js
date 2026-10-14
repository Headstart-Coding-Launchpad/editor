// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyTypeCodeKey,
  codeColourClasses,
  gradeTypeCodeItem,
  markTypedCode,
  normaliseCode,
  typeCodeSolution,
  typeCodeStats,
} from '../typeCode.js'
import keyboard from '../definition.js'

const key = (k, mods = {}) => ({ key: k, mods })

// Types a list of keys (strings of one character are typed as they are).
function type(keys, language = 'python', start = '') {
  let typed = start
  let corrections = 0
  for (const k of keys) {
    const applied = applyTypeCodeKey(typed, typeof k === 'string' ? key(k) : k, language)
    if (!applied) continue
    typed = applied.typed
    if (applied.correction) corrections += 1
  }
  return { typed, corrections }
}

const chars = (text) => [...text]

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'type_code',
  language: 'python',
  minAccuracy: 0.95,
  items: [{ id: 'a', code: 'for i in range(3):\n    print("Hi")\n' }],
}
const errorsOf = (task) => keyboard.validateTask(task, { n: 1 }).errors

describe('type_code: normaliseCode', () => {
  it('drops the final newline, trailing spaces and Windows line endings', () => {
    expect(normaliseCode('a = 1  \r\nb = 2\n\n')).toBe('a = 1\nb = 2')
  })

  it('turns indentation tabs into spaces by language', () => {
    expect(normaliseCode('if x:\n\tprint(x)', 'python')).toBe('if x:\n    print(x)')
    expect(normaliseCode('<ul>\n\t<li>Milk</li>\n</ul>', 'html')).toBe(
      '<ul>\n  <li>Milk</li>\n</ul>'
    )
  })
})

describe('type_code: typing keys', () => {
  it('Enter types a newline with no auto-indent', () => {
    expect(type([...chars('if x:'), 'Enter']).typed).toBe('if x:\n')
  })

  it('Tab at the start of a line types spaces to the next tab stop (4 for Python)', () => {
    expect(type(['Tab']).typed).toBe('    ')
    expect(type([' ', 'Tab']).typed).toBe('    ')
    expect(type(['Tab', 'Tab']).typed).toBe('        ')
    expect(type(['x', 'Enter', 'Tab'], 'python').typed).toBe('x\n    ')
  })

  it('Tab is 2 spaces for HTML', () => {
    expect(type(['Tab'], 'html').typed).toBe('  ')
    expect(type(['Tab', 'Tab'], 'html').typed).toBe('    ')
  })

  it('Tab after code on a line does nothing', () => {
    expect(type(['x', 'Tab']).typed).toBe('x')
    expect(type([key('Tab', { shift: true })]).typed).toBe('')
  })

  it('Tab and the right number of spaces give the same text', () => {
    const viaTab = type([...chars('for i in range(3):'), 'Enter', 'Tab', ...chars('print("Hi")')])
    const viaSpaces = type([...chars('for i in range(3):'), 'Enter', ...chars('    print("Hi")')])
    expect(viaTab.typed).toBe(viaSpaces.typed)
    expect(viaTab.typed).toBe(normaliseCode(TASK.items[0].code))
  })

  it('Backspace removes a character, or a whole tab stop in the indentation, as a correction', () => {
    expect(type(['a', 'b', 'Backspace'])).toEqual({ typed: 'a', corrections: 1 })
    expect(type(['Tab', 'Backspace'])).toEqual({ typed: '', corrections: 1 })
    expect(type(['Tab', ' ', 'Backspace']).typed).toBe('    ')
    expect(type(['x', 'Enter', 'Backspace']).typed).toBe('x')
    expect(type(['Backspace'])).toEqual({ typed: '', corrections: 0 })
  })

  it('leaves shortcuts and other keys to the browser', () => {
    expect(applyTypeCodeKey('', key('c', { mod: true }))).toBeNull()
    expect(applyTypeCodeKey('', key('ArrowLeft'))).toBeNull()
  })
})

describe('type_code: marking and stats', () => {
  it('marks every typed character, newlines and indentation included', () => {
    expect(markTypedCode('a\n  b', 'a\n  b')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
    expect(markTypedCode('a\n  b', 'a\n   ')).toEqual(['ok', 'ok', 'ok', 'ok', 'bad'])
    expect(markTypedCode('a\nb', 'ab')).toEqual(['ok', 'bad'])
  })

  it('works out accuracy, characters a minute and words a minute', () => {
    const stats = typeCodeStats('abcdefghij', 'abcdefghiX', 30000)
    expect(stats.accuracy).toBe(0.9)
    expect(stats.cpm).toBe(18)
    expect(stats.wpm).toBe(3.6)
    expect(typeCodeStats('abc', '', 0)).toMatchObject({ accuracy: 1, cpm: 0 })
  })
})

describe('type_code: grading', () => {
  const item = TASK.items[0]
  const target = normaliseCode(item.code)

  it('needs the whole block', () => {
    expect(gradeTypeCodeItem(TASK, item, { typed: 'for' }).hint).toMatch(/whole block/)
  })

  it('passes at or above minAccuracy', () => {
    expect(gradeTypeCodeItem(TASK, item, { typed: target, accuracy: 1, cpm: 50 }).correct).toBe(
      true
    )
    expect(gradeTypeCodeItem(TASK, item, { typed: target, accuracy: 0.9 }).correct).toBe(false)
  })

  it('points at indentation slips', () => {
    const typed = target.replace('    print', '  print("')
    const result = { typed, accuracy: typeCodeStats(target, typed, 1000).accuracy }
    expect(gradeTypeCodeItem(TASK, item, result).hint).toMatch(/spaces at the start of each line/)
  })

  it('defaults minAccuracy to 0.9', () => {
    const lenient = { ...TASK, minAccuracy: undefined }
    expect(gradeTypeCodeItem(lenient, item, { typed: target, accuracy: 0.9 }).correct).toBe(true)
  })

  it('checks speed only when targetCpm is set', () => {
    const fast = { ...TASK, targetCpm: 90 }
    expect(gradeTypeCodeItem(fast, item, { typed: target, accuracy: 1, cpm: 60 }).hint).toMatch(
      /90 characters a minute/
    )
    expect(gradeTypeCodeItem(fast, item, { typed: target, accuracy: 1, cpm: 95 }).correct).toBe(
      true
    )
  })

  it('the solution passes and has the shared typing-result shape', () => {
    const solution = typeCodeSolution(TASK, item)
    expect(solution).toMatchObject({ mode: 'type_code', accuracy: 1, corrections: 0, done: true })
    expect(keyboard.grade(TASK, keyboard.solutionState(TASK)).passed).toBe(true)
  })
})

describe('type_code: validation', () => {
  it('accepts the example task', () => {
    expect(errorsOf(TASK)).toEqual([])
  })

  it('needs code', () => {
    expect(errorsOf({ ...TASK, items: [{ id: 'a', code: '  ' }] })).toEqual([
      'Task 1 item 1: code is required.',
    ])
  })

  it('limits length and lines', () => {
    expect(errorsOf({ ...TASK, items: [{ id: 'a', code: 'x'.repeat(1001) }] })[0]).toMatch(
      /at most 1000 characters/
    )
    expect(errorsOf({ ...TASK, items: [{ id: 'a', code: 'x\n'.repeat(31) + 'x' }] })[0]).toMatch(
      /at most 30 lines/
    )
  })

  it('rejects a Tab after the start of a line and characters with no key', () => {
    expect(errorsOf({ ...TASK, items: [{ id: 'a', code: 'x =\t1' }] })[0]).toMatch(/Tab after/)
    expect(errorsOf({ ...TASK, items: [{ id: 'a', code: 'print(“hi”)' }] })[0]).toMatch(
      /can't be typed: “ ”/
    )
  })

  it('checks language and targetCpm', () => {
    expect(errorsOf({ ...TASK, language: 'java' })).toEqual([
      'Task 1: type_code language must be one of python, html.',
    ])
    expect(errorsOf({ ...TASK, targetCpm: 0 })).toEqual([
      'Task 1: targetCpm must be a positive number.',
    ])
  })
})

describe('type_code: summary and colouring', () => {
  it('summarises blocks done with average accuracy and speed', () => {
    const task = { ...TASK, items: [...TASK.items, { id: 'b', code: 'x = 1' }] }
    const state = {
      v: 1,
      items: { a: { ...typeCodeSolution(task, task.items[0]), accuracy: 0.96, cpm: 71 }, b: {} },
    }
    expect(keyboard.summarize(task, state).text).toBe('1/2 done · 96% · 71 cpm')
  })

  it('colours Python keywords, strings and comments', () => {
    const classes = codeColourClasses('for x in "a" # c', 'python')
    expect(classes.slice(0, 3)).toEqual(['kw', 'kw', 'kw'])
    expect(classes[9]).toBe('str')
    expect(classes[15]).toBe('com')
  })

  it('colours HTML tags, attributes and values', () => {
    const classes = codeColourClasses('<a href="x">', 'html')
    expect(classes[0]).toBe('tag')
    expect(classes[1]).toBe('tag')
    expect(classes[3]).toBe('attr')
    expect(classes[8]).toBe('str')
    expect(classes[11]).toBe('tag')
  })
})
