// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  evaluateCodeStructureCheck,
  parsePythonBlockLines,
  pythonBlockAncestors,
} from '../../../shared/checkHelpers.js'
import {
  checkAllowedForSubmit,
  checkRequiresRun,
  evaluateCheckWithCode,
  evaluateSingleCheck,
  getCheckDefinition,
} from '../../checks.js'
import { getModuleDefinition } from '../../definitions.js'
import { assembleCodeArrangement, buildSolutionSlotState } from '../../../shared/codeArrange.js'
import { validateLesson } from '../../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../../cli/validate.mjs'

const check = (operator, inner, outer, extra = {}) => ({
  type: 'code_structure',
  operator,
  inner,
  outer,
  ...extra,
})

const NESTED = [
  'has_backpack = True',
  'has_water_bottle = True',
  'if has_backpack:',
  '    print("Backpack packed")',
  '    if has_water_bottle:',
  '        print("Ready for the hike")',
].join('\n')

const SIBLINGS = [
  'if has_backpack:',
  '    print("Backpack packed")',
  'if has_water_bottle:',
  '    print("Ready for the hike")',
].join('\n')

const ELIF = [
  'if has_backpack:',
  '    print("Backpack packed")',
  'elif has_water_bottle:',
  '    print("Ready for the hike")',
].join('\n')

const WATER_IN_BACKPACK = check('nested_in', 'if has_water_bottle:', 'if has_backpack:')

describe('parsePythonBlockLines', () => {
  it('records indentation and block openers for each logical line', () => {
    expect(parsePythonBlockLines(SIBLINGS)).toEqual([
      { line: 1, indent: 0, text: 'if has_backpack:', opensBlock: true },
      { line: 2, indent: 4, text: 'print("Backpack packed")', opensBlock: false },
      { line: 3, indent: 0, text: 'if has_water_bottle:', opensBlock: true },
      { line: 4, indent: 4, text: 'print("Ready for the hike")', opensBlock: false },
    ])
  })

  it('skips blank and comment-only lines and strips trailing comments', () => {
    const lines = parsePythonBlockLines('# setup\n\nif ok:  # check it\n    # inside\n    go()\n')
    expect(lines.map((l) => [l.line, l.indent, l.text])).toEqual([
      [3, 0, 'if ok:'],
      [5, 4, 'go()'],
    ])
    expect(lines[0].opensBlock).toBe(true)
  })

  it('keeps a # inside a string', () => {
    expect(parsePythonBlockLines('print("#1")  # note')[0].text).toBe('print("#1")')
  })

  it('expands tabs to four spaces', () => {
    expect(parsePythonBlockLines('if a:\n\tif b:\n\t\tgo()').map((l) => l.indent)).toEqual([
      0, 4, 8,
    ])
  })

  it('handles CRLF line endings', () => {
    expect(parsePythonBlockLines('if a:\r\n    go()\r\n').map((l) => [l.indent, l.text])).toEqual([
      [0, 'if a:'],
      [4, 'go()'],
    ])
  })

  it('joins continuation lines inside open brackets', () => {
    const lines = parsePythonBlockLines('if (a and\nb):\n    total = [1,\n  2]\n    go()')
    expect(lines.map((l) => [l.line, l.indent, l.text, l.opensBlock])).toEqual([
      [1, 0, 'if (a and b):', true],
      [3, 4, 'total = [1, 2]', false],
      [5, 4, 'go()', false],
    ])
  })

  it('joins backslash continuations', () => {
    expect(parsePythonBlockLines('if a and \\\n  b:\n    go()').map((l) => l.text)).toEqual([
      'if a and b:',
      'go()',
    ])
  })

  it('treats the inside of a triple-quoted string as part of its statement', () => {
    const code = 'def f():\n    """Docs\nif fake:\n  still docs\n    """\n    go()'
    const lines = parsePythonBlockLines(code)
    expect(lines.map((l) => [l.line, l.indent])).toEqual([
      [1, 0],
      [2, 4],
      [6, 4],
    ])
    expect(lines.some((l) => l.text === 'if fake:')).toBe(false)
  })

  it('finds the enclosing block openers, nearest first', () => {
    const lines = parsePythonBlockLines(NESTED)
    expect(pythonBlockAncestors(lines, 5).map((l) => l.text)).toEqual([
      'if has_water_bottle:',
      'if has_backpack:',
    ])
    expect(pythonBlockAncestors(lines, 2)).toEqual([])
  })
})

describe('evaluateCodeStructureCheck', () => {
  it('passes a nested if and fails two sibling ifs', () => {
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, NESTED)).toBe(true)
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, SIBLINGS)).toBe(false)
  })

  it('treats an elif lined up with the outer if as a sibling, not nested', () => {
    expect(
      evaluateCodeStructureCheck(
        check('nested_in', 'print("Ready for the hike")', 'if has_backpack:'),
        ELIF
      )
    ).toBe(false)
    expect(
      evaluateCodeStructureCheck(
        check('directly_nested_in', 'print("Ready for the hike")', 'elif has_water_bottle:'),
        ELIF
      )
    ).toBe(true)
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, ELIF)).toBe(false)
  })

  it('matches whole lines ignoring spacing and case, with * wildcards', () => {
    expect(
      evaluateCodeStructureCheck(check('nested_in', 'IF has_water_bottle :', 'if  *:'), NESTED)
    ).toBe(true)
    // Whole-line match: a fragment of the line is not enough.
    expect(
      evaluateCodeStructureCheck(check('nested_in', 'has_water_bottle', 'if *:'), NESTED)
    ).toBe(false)
  })

  it('separates any depth from direct nesting', () => {
    const code = 'def greet():\n    for name in names:\n        print(name)\n'
    const print = 'print(name)'
    expect(evaluateCodeStructureCheck(check('nested_in', print, 'def greet():'), code)).toBe(true)
    expect(
      evaluateCodeStructureCheck(check('directly_nested_in', print, 'def greet():'), code)
    ).toBe(false)
    expect(
      evaluateCodeStructureCheck(check('directly_nested_in', print, 'for * in names:'), code)
    ).toBe(true)
  })

  it('passes when any one inner occurrence satisfies nested_in', () => {
    const code = 'print("hi")\nif ok:\n    print("hi")'
    expect(evaluateCodeStructureCheck(check('nested_in', 'print("hi")', 'if ok:'), code)).toBe(true)
  })

  it('not_nested_in needs the inner line present and never inside the outer block', () => {
    const op = (code) =>
      evaluateCodeStructureCheck(check('not_nested_in', 'print(total)', 'for * in *:'), code)
    expect(op('total = 0\nfor n in nums:\n    total += n\nprint(total)')).toBe(true)
    expect(op('total = 0\nfor n in nums:\n    total += n\n    print(total)')).toBe(false)
    expect(op('print(total)\nfor n in nums:\n    print(total)')).toBe(false)
    expect(op('total = 0')).toBe(false)
  })

  it('fails when no line matches inner, and on a missing operator, inner or outer', () => {
    expect(evaluateCodeStructureCheck(check('nested_in', 'if nothing:', 'if *:'), NESTED)).toBe(
      false
    )
    expect(
      evaluateCodeStructureCheck(check(undefined, 'if has_water_bottle:', 'if *:'), NESTED)
    ).toBe(false)
    expect(evaluateCodeStructureCheck(check('nested_in', '', 'if *:'), NESTED)).toBe(false)
    expect(evaluateCodeStructureCheck(check('nested_in', 'if *:', '  '), NESTED)).toBe(false)
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, '')).toBe(false)
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, undefined)).toBe(false)
  })

  it('handles tabs, comments and blank lines between the blocks', () => {
    const code =
      'if has_backpack:\r\n\t# pack water too\r\n\r\n\tif has_water_bottle:\r\n\t\tgo()\r\n'
    expect(evaluateCodeStructureCheck(WATER_IN_BACKPACK, code)).toBe(true)
  })
})

describe('code_structure check type', () => {
  it('is registered to Python, needs no run and is allowed in submit mode', () => {
    const definition = getCheckDefinition('code_structure')
    expect(definition.owner).toBe('module:python')
    expect(definition.timing).toBe('on_change')
    expect(checkRequiresRun(WATER_IN_BACKPACK)).toBe(false)
    expect(checkAllowedForSubmit(WATER_IN_BACKPACK)).toBe(true)
  })

  it('evaluates through evaluateSingleCheck and evaluateCheckWithCode', () => {
    expect(evaluateSingleCheck(WATER_IN_BACKPACK, '', { code: NESTED })).toBe(true)
    expect(evaluateSingleCheck(WATER_IN_BACKPACK, '', { code: SIBLINGS })).toBe(false)
    expect(evaluateSingleCheck(WATER_IN_BACKPACK, '', {})).toBe(false)
    expect(evaluateCheckWithCode([WATER_IN_BACKPACK], NESTED)).toBe(true)
    expect(evaluateCheckWithCode([WATER_IN_BACKPACK], SIBLINGS)).toBe(false)
  })

  it('sees the nesting of an assembled code_arrange program', () => {
    const task = {
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [
        { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'if has_backpack:' }] },
        { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: '    if has_water_bottle:' }] },
        {
          id: 'L3',
          parts: [
            { type: 'text', text: '        print(' },
            { type: 'slot', id: 'S1', code: '"Ready"' },
            { type: 'text', text: ')' },
          ],
        },
      ],
      // The misconception: the same if, flush left.
      distractors: [{ id: 'D1', code: 'if has_water_bottle:' }],
      check: WATER_IN_BACKPACK,
    }
    const solution = assembleCodeArrangement(task, buildSolutionSlotState(task))
    expect(evaluateSingleCheck(task.check, '', { code: solution })).toBe(true)
    const flat = assembleCodeArrangement(task, { L1: 'L1', L2: 'D1', S1: 'S1' })
    expect(evaluateSingleCheck(task.check, '', { code: flat })).toBe(false)
  })
})

describe('code_structure validation', () => {
  const python = getModuleDefinition('python')
  const html = getModuleDefinition('html')
  const validate = (c, moduleDefinition = python, kind = 'completion') =>
    getCheckDefinition('code_structure').validate(c, { n: 1, kind, moduleDefinition })

  it('accepts a complete check on Python', () => {
    expect(validate(WATER_IN_BACKPACK)).toEqual([])
    expect(validate(check('not_nested_in', 'print(x)', 'for *:'))).toEqual([])
  })

  it('rejects other modules', () => {
    expect(validate(WATER_IN_BACKPACK, html)).toEqual([
      'Task 1 has a code_structure check, but code_structure checks only work in Python tasks',
    ])
  })

  it('requires an operator, inner and outer', () => {
    expect(validate({ type: 'code_structure' })).toEqual([
      'Task 1 has a code_structure check with operator "" — use one of: nested_in, directly_nested_in, not_nested_in',
      'Task 1 has a code_structure check but no inner line',
      'Task 1 has a code_structure check but no outer line',
    ])
    expect(validate(check('inside', 'if a:', 'if b:'), python, 'feedback')).toEqual([
      'Task 1 has a code_structure feedback check with operator "inside" — use one of: nested_in, directly_nested_in, not_nested_in',
    ])
  })

  it('runs in both lesson validators without asking for a value', () => {
    const lesson = (taskCheck) => ({
      id: 'structure',
      type: 'python',
      title: 'Structure',
      description: 'd',
      tasks: [{ id: 1, title: 'T', starterCode: 'x = 1', check: taskCheck }],
    })
    for (const validator of [validateLesson, validateLessonForMcp]) {
      const ok = validator(lesson(WATER_IN_BACKPACK)).errors
      expect(ok.filter((e) => /check value|code_structure/.test(e))).toEqual([])
      const missing = validator(lesson({ type: 'code_structure', operator: 'nested_in' })).errors
      expect(missing).toContain('Task 1 has a code_structure check but no inner line')
      expect(missing).toContain('Task 1 has a code_structure check but no outer line')
    }
  })
})
