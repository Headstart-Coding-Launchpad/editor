import { describe, expect, it } from 'vitest'
import { explainPythonError, findPythonError } from '../pythonErrors.js'

describe('findPythonError', () => {
  it('reads the last error line, with or without a line number', () => {
    expect(findPythonError('hi\nLine 3: NameError: name x is not defined')).toEqual({
      line: 3,
      type: 'NameError',
      message: 'name x is not defined',
      text: 'Line 3: NameError: name x is not defined',
    })
    expect(findPythonError('ZeroDivisionError: division by zero')?.line).toBeNull()
    expect(findPythonError('all fine\n')).toBeNull()
  })
})

describe('explainPythonError', () => {
  const explain = (text, code) => explainPythonError(text, { code })

  it('range without brackets (the session report case)', () => {
    const help = explain('Line 1: SyntaxError: invalid syntax', 'for i in range 4:\n    print(i)')
    expect(help.title).toBe('range needs brackets around its number')
    expect(help.rungs).toHaveLength(4)
    expect(help.rungs[3]).toBe('Change range 4 to range(4) on line 1.')
  })

  it('a missing colon, from the message or the line', () => {
    expect(explain("Line 2: SyntaxError: expected ':'").title).toBe('A colon : is missing')
    const help = explain('Line 1: SyntaxError: invalid syntax', 'if x > 3\n    print(x)')
    expect(help.rungs[3]).toBe('Add a : at the end of line 1, after the if line.')
  })

  it('brackets and quotes', () => {
    expect(explain("Line 4: SyntaxError: '(' was never closed").rungs[3]).toBe(
      'Add the missing ) on line 4.'
    )
    expect(explain("Line 4: SyntaxError: unmatched ')'").title).toBe('There is an extra )')
    expect(
      explain('Line 1: SyntaxError: unterminated string literal (detected at line 1)').title
    ).toBe('Some writing is missing its closing quote')
  })

  it('indentation', () => {
    expect(
      explain(
        "Line 2: IndentationError: expected an indented block after 'for' statement on line 1"
      ).rungs[0]
    ).toBe('Look at the line after the for on line 1.')
    expect(explain('Line 3: IndentationError: unexpected indent').rungs[3]).toContain('Shift+Tab')
    expect(
      explain('Line 3: IndentationError: unindent does not match any outer indentation level').title
    ).toBe('The lines in this block are not lined up')
  })

  it("names, using Python's own suggestion for the fix", () => {
    const help = explain("Line 2: NameError: name 'scroe' is not defined. Did you mean: 'score'?")
    expect(help.title).toBe("Python doesn't know the name scroe")
    expect(help.rungs[3]).toBe('Did you mean score? Change scroe to score.')
    expect(explain("Line 1: NameError: name 'hello' is not defined").rungs[3]).toContain(
      'put quotes around it'
    )
  })

  it('common runtime errors', () => {
    expect(explain('Line 2: TypeError: can only concatenate str (not "int") to str').title).toBe(
      "Writing and numbers can't be joined with +"
    )
    expect(explain("Line 1: ValueError: invalid literal for int() with base 10: 'ten'").title).toBe(
      "That writing can't become a whole number"
    )
    expect(explain('Line 5: ZeroDivisionError: division by zero').type).toBe('ZeroDivisionError')
    expect(explain('Line 2: IndexError: list index out of range').rungs[1]).toContain('start at 0')
    expect(explain("Line 2: KeyError: 'Ben'").title).toBe('The dictionary has no Ben')
    expect(explain("Line 1: ModuleNotFoundError: No module named 'numpyy'").title).toContain(
      'numpyy'
    )
  })

  it('a SyntaxError we have no special help for still gets plain words', () => {
    const help = explain('Line 2: SyntaxError: invalid syntax', 'x = = 3')
    expect(help.title).toBe("Python can't read this line")
  })

  it('reads well with no line number', () => {
    expect(explain('ZeroDivisionError: division by zero').rungs[3]).toContain(
      'the line with the error'
    )
  })

  it('returns null for an error it does not know, so the raw message stands alone', () => {
    expect(explain('Line 1: OSError: something odd')).toBeNull()
    expect(explain('')).toBeNull()
  })
})
