import { describe, expect, it } from 'vitest'
import { formatPythonError } from '../pyodide.worker.js'

// formatPythonError is pure traceback-parsing logic that doesn't touch Pyodide
// or postMessage, so it's safe to unit test directly even though the worker
// file as a whole is excluded from coverage (see docs/TESTING.md).

describe('formatPythonError', () => {
  it('extracts the innermost <student> frame line number', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 3, in <module>',
      '  File "<student>", line 7, in foo',
      "NameError: name 'x' is not defined",
    ].join('\n')

    const result = formatPythonError(traceback)

    expect(result.line).toBe(7)
    expect(result.text).toBe("Line 7: NameError: name 'x' is not defined")
  })

  it('picks the deepest <student> frame when the traceback has nested calls', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 1, in <module>',
      '  File "<student>", line 5, in outer',
      '  File "<student>", line 9, in inner',
      'ZeroDivisionError: division by zero',
    ].join('\n')

    expect(formatPythonError(traceback).line).toBe(9)
  })

  it('returns no line number when there is no <student> frame (e.g. a raw SyntaxError)', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 1, in <module>',
      'SyntaxError: invalid syntax',
    ].join('\n')

    const result = formatPythonError(traceback)

    expect(result.line).toBeNull()
    expect(result.text).toBe('SyntaxError: invalid syntax')
  })

  it('handles an empty traceback without throwing', () => {
    expect(formatPythonError('')).toEqual({ text: '', line: null })
  })

  it('ignores blank lines when finding the final error line', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<student>", line 2, in <module>',
      '',
      'TypeError: bad operand',
      '',
    ].join('\n')

    const result = formatPythonError(traceback)

    expect(result.line).toBe(2)
    expect(result.text).toBe('Line 2: TypeError: bad operand')
  })
})
