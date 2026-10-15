import { describe, expect, it } from 'vitest'
import {
  findSetupSyntaxProblem,
  getTaskSetupCode,
  getTaskSetupNote,
  setupRunOptions,
  validateSetupCode,
} from '../setupCode.js'
import { formatPythonError, normalizeSetupConfig } from '../../../modules/python/pyodide.worker.js'
import { SETUP_ERROR_TEXT } from '../setupCode.js'

function validate(task) {
  const errors = []
  const warnings = []
  validateSetupCode(task, 1, errors, warnings)
  return { errors, warnings }
}

describe('setup fields', () => {
  it('reads the code and the note', () => {
    expect(getTaskSetupCode({ setupCode: 'x = 1' })).toBe('x = 1')
    expect(getTaskSetupCode({ setupCode: '   ' })).toBeNull()
    expect(getTaskSetupNote({ setupNote: ' x exists ' })).toBe('x exists')
  })

  it('builds the run options, after the runtime prefix', () => {
    expect(setupRunOptions({ setupCode: 'x = 1' })).toEqual({ code: 'x = 1', afterLine: 0 })
    expect(setupRunOptions({ setupCode: 'x = 1' }, { afterLine: 2 })).toEqual({
      code: 'x = 1',
      afterLine: 2,
    })
    expect(setupRunOptions({})).toBeNull()
  })
})

describe('findSetupSyntaxProblem', () => {
  it('passes ordinary code', () => {
    expect(
      findSetupSyntaxProblem(
        'playlist = ["Intro", "Theme (live)"]  # [not a bracket\nx = {"a": (1, 2)}\n'
      )
    ).toBeNull()
    expect(findSetupSyntaxProblem('s = """one\n(two\n"""\n')).toBeNull()
  })

  it('finds unclosed brackets and strings', () => {
    expect(findSetupSyntaxProblem('x = [1, 2\n')).toBe('a "[" on line 1 is never closed')
    expect(findSetupSyntaxProblem('x = 1)\n')).toBe('line 1 has a ")" with no matching opener')
    expect(findSetupSyntaxProblem('x = 1\ny = "abc\n')).toBe('a string on line 2 is never closed')
  })

  it('finds an indented first line', () => {
    expect(findSetupSyntaxProblem('  x = 1\n')).toBe('its first line of code is indented')
  })
})

describe('validateSetupCode', () => {
  it('accepts setup with a note', () => {
    expect(validate({ setupCode: 'x = [1]', setupNote: 'x already exists' })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('reports a syntax problem', () => {
    expect(validate({ setupCode: 'x = [1' }).errors).toEqual([
      'Task 1 setupCode has a syntax problem: a "[" on line 1 is never closed',
    ])
  })

  it('warns about input(), a submit task, a lone note and a long note', () => {
    expect(validate({ setupCode: 'name = input()' }).warnings).toContain(
      'Task 1 setupCode calls input(), which would ask the student a question before their code runs'
    )
    expect(validate({ setupCode: 'x = 1', interactionMode: 'submit' }).warnings).toContain(
      'Task 1 setupCode never runs: the task is submitted, not run'
    )
    expect(validate({ setupNote: 'x exists' }).warnings).toEqual([
      'Task 1 has a setupNote but no setupCode',
    ])
    expect(validate({ setupCode: 'x = 1', setupNote: 'x'.repeat(121) }).warnings).toEqual([
      'Task 1 setupNote is over 120 characters; keep it to one short line',
    ])
  })

  it('rejects non-text', () => {
    expect(validate({ setupCode: 5, setupNote: 5 }).errors).toEqual([
      'Task 1 setupCode must be Python code (text)',
      'Task 1 setupNote must be text',
    ])
  })
})

describe('setup in the worker', () => {
  it('normalises the setup config', () => {
    expect(normalizeSetupConfig({ code: 'x = 1', afterLine: 2 })).toEqual({
      code: 'x = 1',
      afterLine: 2,
    })
    expect(normalizeSetupConfig({ code: '  ' })).toEqual({})
    expect(normalizeSetupConfig(null)).toEqual({})
  })

  it("never shows the setup's traceback", () => {
    // Student code of 3 lines: the setup's statements start at line 5.
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 5, in __hs_run__',
      'ZeroDivisionError: division by zero',
    ].join('\n')
    expect(formatPythonError(traceback, { setupFrom: 5 })).toEqual({
      text: SETUP_ERROR_TEXT,
      line: null,
      setupError: true,
    })
  })

  it('treats a SyntaxError in the setup as the setup’s', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<setup>", line 1',
      '    x = [',
      'SyntaxError: unexpected EOF while parsing',
    ].join('\n')
    expect(formatPythonError(traceback, { setupFrom: 4 }).text).toBe(SETUP_ERROR_TEXT)
  })

  it("reports the student's line when their call fails inside setup code", () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 2, in __hs_run__',
      '  File "<student>", line 7, in helper',
      'TypeError: bad operand',
    ].join('\n')
    expect(formatPythonError(traceback, { setupFrom: 5 })).toEqual({
      text: 'Line 2: TypeError: bad operand',
      line: 2,
    })
  })

  it("keeps the student's own errors as they were", () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 3, in __hs_run__',
      "NameError: name 'y' is not defined",
    ].join('\n')
    expect(formatPythonError(traceback, { setupFrom: 6 })).toEqual({
      text: "Line 3: NameError: name 'y' is not defined",
      line: 3,
    })
  })
})
