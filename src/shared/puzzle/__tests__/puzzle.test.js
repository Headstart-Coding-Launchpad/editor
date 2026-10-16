import { describe, expect, it } from 'vitest'
import {
  countChangesFromStarter,
  countCodeLines,
  evaluateMaxLinesCheck,
  getTaskPuzzle,
  lineCounter,
  maxLinesHint,
  parResult,
  puzzleCardNote,
  puzzleReportFields,
  resolveLessonPuzzleChecks,
  resolvePuzzleChecks,
  validateLockedLines,
  validatePuzzle,
} from '../puzzle.js'
import { evaluateSingleCheck, getCheckDefinition } from '../../../modules/checks.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

function validate(task) {
  const errors = []
  const warnings = []
  validatePuzzle(task, 1, errors, warnings)
  validateLockedLines(task, 1, warnings)
  return { errors, warnings }
}

describe('getTaskPuzzle', () => {
  it('normalises the rules', () => {
    expect(getTaskPuzzle({ puzzle: { onlyEdit: [2, 'x'], maxLines: 4, par: 0 } })).toEqual({
      onlyEdit: [2],
      maxLines: 4,
      par: 0,
      noNewLines: false,
    })
    expect(getTaskPuzzle({ puzzle: { noNewLines: true } })).toEqual({
      onlyEdit: null,
      maxLines: null,
      par: null,
      noNewLines: true,
    })
    expect(getTaskPuzzle({ puzzle: { maxLines: 0 } })).toBeNull()
    expect(getTaskPuzzle({})).toBeNull()
  })
})

describe('counting lines', () => {
  it('counts lines of code, not blank or comment-only lines', () => {
    expect(countCodeLines('a = 1\n\n# note\n  b = 2  # trailing\n')).toBe(2)
    expect(countCodeLines(null)).toBe(0)
  })

  it('counts changed, added and deleted lines against the starter', () => {
    const starter = 'a = 1\nb = 2\nc = 3'
    expect(countChangesFromStarter(starter, starter)).toBe(0)
    expect(countChangesFromStarter('a = 1\nB = 2\nc = 3', starter)).toBe(1)
    expect(countChangesFromStarter('a = 1\nb = 2\nx\ny\nc = 3', starter)).toBe(2)
    expect(countChangesFromStarter('a = 1\nc = 3', starter)).toBe(1)
    expect(countChangesFromStarter('a = 1\n\n# hi\nb = 2\nc = 3\n', starter)).toBe(0)
    // Re-indenting a line changes it (indentation matters in Python).
    expect(countChangesFromStarter('a = 1\n    b = 2\nc = 3', starter)).toBe(1)
  })

  it('shows a live counter only with maxLines', () => {
    expect(lineCounter('a\n# c\n\nb', { maxLines: 1 })).toEqual({
      used: 2,
      max: 1,
      over: true,
      text: '2 / 1 lines',
    })
    expect(lineCounter('a', { maxLines: null })).toBeNull()
  })
})

describe('par', () => {
  const task = { puzzle: { par: 1 }, starterCode: '#@lock\nx = 1\nprint(x)\n' }

  it('says "Solved at par" with a star when matched', () => {
    expect(parResult('x = 2\nprint(x)\n', task)).toEqual({
      changes: 1,
      par: 1,
      atPar: true,
      text: 'Solved at par ⭐',
    })
  })

  it('says how many changes it took when over par', () => {
    expect(parResult('x = 2\ny = 3\nprint(x)', task).text).toBe('Solved in 2 changes (par 1)')
  })

  it('says under par with a star', () => {
    const result = parResult('x = 1\nprint(x)', { ...task, puzzle: { par: 1 } })
    expect(result.text).toBe('Solved in 0 changes, under par (par 1) ⭐')
    expect(result.atPar).toBe(true)
  })

  it('is null without par', () => {
    expect(parResult('x', { puzzle: { maxLines: 2 } })).toBeNull()
  })
})

describe('max_lines check', () => {
  it('passes within the limit and fails over it', () => {
    expect(evaluateMaxLinesCheck({ value: 2 }, { code: 'a\n# x\nb' })).toBe(true)
    expect(evaluateMaxLinesCheck({ value: 2 }, { code: 'a\nb\nc' })).toBe(false)
    expect(evaluateMaxLinesCheck({}, { code: 'a' })).toBe(false)
  })

  it('is registered, needs no run, and applies to Python and Turtle', () => {
    expect(evaluateSingleCheck({ type: 'max_lines', value: 1 }, '', { code: 'a' })).toBe(true)
    const def = getCheckDefinition('max_lines')
    expect(def.requiresRun).toBe(false)
    expect(def.appliesTo(getModuleDefinition('python'))).toBe(true)
    expect(def.appliesTo(getModuleDefinition('turtle'))).toBe(true)
    expect(def.appliesTo(getModuleDefinition('html'))).toBe(false)
  })

  it('takes its limit and default hint from puzzle.maxLines', () => {
    const task = { puzzle: { maxLines: 4 }, check: [{ type: 'max_lines' }] }
    expect(resolvePuzzleChecks(task).check).toEqual([
      { type: 'max_lines', value: 4, hint: 'Can you do it in 4 lines? A loop might help.' },
    ])
    expect(maxLinesHint(1)).toBe('Can you do it in 1 line? A loop might help.')
  })

  it('keeps an authored value and hint', () => {
    const task = {
      puzzle: { maxLines: 4 },
      check: { type: 'max_lines', value: 3, hint: 'Use a loop.' },
    }
    expect(resolvePuzzleChecks(task)).toBe(task)
  })

  it('resolves the checks of every task in a lesson', () => {
    const lesson = {
      tasks: [
        { id: 1, puzzle: { maxLines: 2 }, check: { type: 'max_lines' } },
        { id: 2, check: { type: 'output', value: 'x' } },
      ],
    }
    const resolved = resolveLessonPuzzleChecks(lesson)
    expect(resolved.tasks[0].check.value).toBe(2)
    expect(resolved.tasks[1]).toBe(lesson.tasks[1])
    expect(resolveLessonPuzzleChecks({ tasks: [lesson.tasks[1]] }).tasks[0]).toBe(lesson.tasks[1])
  })
})

describe('validatePuzzle', () => {
  const base = {
    codeStages: [
      { role: 'starter', code: 'for i in range(3):\n    print(i)\n' },
      { role: 'complete', code: 'for i in range(5):\n    print(i)\n' },
    ],
    check: [{ type: 'max_lines' }],
  }

  it('accepts a solvable puzzle', () => {
    expect(validate({ ...base, puzzle: { onlyEdit: [1], maxLines: 2, par: 1 } })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('rejects a complete solution over maxLines', () => {
    const { errors } = validate({ ...base, puzzle: { maxLines: 1 } })
    expect(errors).toContain('Task 1 complete code has 2 lines of code, over puzzle.maxLines 1')
  })

  it('warns when the complete solution is over par', () => {
    const { warnings } = validate({ ...base, puzzle: { par: 0 } })
    expect(warnings).toContain(
      'Task 1 complete code takes 1 changes from the starter, more than puzzle.par 0'
    )
  })

  it('rejects onlyEdit lines past the starter', () => {
    const { errors } = validate({ ...base, puzzle: { onlyEdit: [9] } })
    expect(errors).toContain(
      'Task 1 puzzle.onlyEdit line 9 is past the end of the starter code (3 lines, not counting marker lines)'
    )
  })

  it('rejects bad shapes', () => {
    expect(validate({ ...base, puzzle: 4 }).errors).toEqual([
      'Task 1 puzzle must be an object, e.g. { maxLines: 4 }',
    ])
    const { errors } = validate({ ...base, puzzle: { maxLines: 'x', par: -1, onlyEdit: 'two' } })
    expect(errors).toEqual(
      expect.arrayContaining([
        'Task 1 puzzle.maxLines must be a whole number of lines, 1 or more',
        'Task 1 puzzle.par must be a whole number of changes, 0 or more',
        'Task 1 puzzle.onlyEdit must be a list of starter line numbers, e.g. [2, 3]',
      ])
    )
  })

  it('needs a limit for a max_lines check', () => {
    expect(validate({ ...base }).errors).toContain(
      "Task 1 has a max_lines check but no limit: set puzzle.maxLines or the check's value"
    )
  })

  it('warns when maxLines has no check enforcing it', () => {
    const { warnings } = validate({ ...base, check: null, puzzle: { maxLines: 2 } })
    expect(warnings).toContain(
      'Task 1 puzzle.maxLines shows a line counter, but no max_lines check enforces it — add { type: max_lines } to the check'
    )
  })
})

describe('edit zones validation (P6-30)', () => {
  it('passes a robot task whose complete code fills the slot', () => {
    const { errors, warnings } = validate({
      puzzle: { noNewLines: true },
      codeStages: [
        {
          role: 'starter',
          code: '#@lock-first\nfrom stage import *\n#@slot\n\n#@lock-last\ndraw(robot)\n',
        },
        { role: 'complete', code: 'from stage import *\nrobot = {}\ndraw(robot)\n' },
      ],
    })
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('warns about two fences, a fence with no line, and code on a fenced side', () => {
    const { warnings } = validate({
      codeStages: [
        { role: 'starter', code: '#@lock-last\na()\n#@lock-last\nb()\n#@lock-first' },
        { role: 'complete', code: 'a()\nb()\nc()\n' },
      ],
    })
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Task 1 has 2 #@lock-last markers; only one line can stay last',
        'Task 1 has a #@lock-first marker with no line after it; it locks nothing',
        'Task 1 complete code has lines after its #@lock-last line ("a()"), which students can\'t add',
      ])
    )
  })

  it('noNewLines must be true or false', () => {
    const { errors } = validate({ puzzle: { noNewLines: 'yes' }, starterCode: 'x = 1' })
    expect(errors).toEqual(['Task 1 puzzle.noNewLines must be true or false'])
  })
})

describe('validateLockedLines', () => {
  it('warns when a locked line would need re-indenting', () => {
    const { warnings } = validate({
      codeStages: [
        { role: 'starter', code: 'for i in range(3):\n    #@lock\n    print(i)\n' },
        { role: 'complete', code: 'for i in range(3):\n    if i:\n        print(i)\n' },
      ],
    })
    expect(warnings).toEqual([
      'Task 1 locked line 2 ("print(i)") is indented differently in the complete code — students can\'t re-indent a locked line',
    ])
  })

  it('warns when the complete code drops a locked line', () => {
    const { warnings } = validate({
      puzzle: { onlyEdit: [2] },
      starterCode: 'x = 1\ny = 2\n',
      completeCode: 'y = 3\n',
    })
    expect(warnings).toContain(
      'Task 1 locked line 1 ("x = 1") is not in the complete code — students can\'t change or remove a locked line'
    )
  })

  it('warns about a #@lock with nothing after it', () => {
    const { warnings } = validate({ starterCode: 'x = 1\n#@lock\n' })
    expect(warnings).toEqual(['Task 1 has a #@lock marker with no line after it; it locks nothing'])
  })
})

describe('report and card', () => {
  const task = {
    puzzle: { maxLines: 2, par: 1 },
    starterCode: 'x = 1\nprint(x)\n',
  }

  it('reports lines used and changes at the passing run', () => {
    expect(puzzleReportFields(task, 'x = 5\nprint(x)\n')).toEqual({
      linesUsed: 2,
      changesFromStarter: 1,
    })
    expect(puzzleReportFields(task, undefined)).toEqual({})
    expect(puzzleReportFields({ starterCode: 'x' }, 'x')).toEqual({})
  })

  it('notes "Solved at par" and "Over line limit" on the tutor card', () => {
    expect(puzzleCardNote(task, 'x = 5\nprint(x)', true)).toBe('Solved at par')
    expect(puzzleCardNote(task, 'x = 5\nprint(x)', false)).toBeNull()
    expect(puzzleCardNote(task, 'a\nb\nc', false)).toBe('Over line limit')
    expect(puzzleCardNote({ starterCode: 'x' }, 'a\nb\nc', true)).toBeNull()
  })
})
