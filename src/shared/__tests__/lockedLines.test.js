import { describe, expect, it } from 'vitest'
import {
  anchorLockedLines,
  chooseLockedLines,
  getTaskLockSets,
  isLockMarkerLine,
  mergeLocks,
  onlyEditLocks,
  taskHasLocks,
  taskHasValueLocks,
} from '../lockedLines.js'
import { parseLineHints, stripLessonLineHints, stripTaskLineHints } from '../lineHints.js'

describe('#@lock markers', () => {
  it('recognises the marker in Python syntax only', () => {
    expect(isLockMarkerLine('#@lock', 'python')).toBe(true)
    expect(isLockMarkerLine('    #@lock  this one', 'python')).toBe(true)
    expect(isLockMarkerLine('#@locked', 'python')).toBe(false)
    expect(isLockMarkerLine('#@lock', 'html')).toBe(false)
  })

  it('strips the marker and locks the next non-blank line', () => {
    const parsed = parseLineHints(
      'from stage import *\n#@lock\npixels = [1, 2]\n\n#@lock\n\ngrid(pixels)\n',
      'python'
    )
    expect(parsed.code).toBe('from stage import *\npixels = [1, 2]\n\n\ngrid(pixels)\n')
    expect(parsed.locks).toEqual([
      { line: 2, target: 'pixels = [1, 2]' },
      { line: 5, target: 'grid(pixels)' },
    ])
  })

  it('keeps hints and locks on the same line apart', () => {
    const parsed = parseLineHints('#> Do not change this\n#@lock\nx = 1\n', 'python')
    expect(parsed.code).toBe('x = 1\n')
    expect(parsed.hints).toEqual([{ line: 1, text: 'Do not change this', target: 'x = 1' }])
    expect(parsed.locks).toEqual([{ line: 1, target: 'x = 1' }])
  })

  it('locks nothing for a trailing marker', () => {
    const parsed = parseLineHints('x = 1\n#@lock\n', 'python')
    expect(parsed.code).toBe('x = 1\n')
    expect(parsed.locks).toEqual([])
  })

  it('returns no locks for code without markers', () => {
    expect(parseLineHints('x = 1\n', 'python').locks).toEqual([])
  })
})

describe('anchorLockedLines', () => {
  const locks = [
    { line: 1, target: 'a = 1' },
    { line: 3, target: 'c = 3' },
  ]

  it('keeps locks on lines that still read the same', () => {
    expect(anchorLockedLines('a = 1\nb = 2\nc = 3', locks)).toEqual([1, 3])
  })

  it('follows lines that moved, by their text', () => {
    expect(anchorLockedLines('# new\na = 1\nb = 2\nx\nc = 3', locks)).toEqual([2, 5])
  })

  it('keeps the locks in order', () => {
    expect(
      anchorLockedLines('x\nx\nx', [
        { line: 1, target: 'x' },
        { line: 2, target: 'x' },
      ])
    ).toEqual([1, 2])
  })

  it('drops a lock whose text is gone', () => {
    expect(anchorLockedLines('a = 1\nb = 2', locks)).toEqual([1])
  })

  it('chooses the set that anchors most', () => {
    expect(chooseLockedLines('c = 3', [locks, [{ line: 1, target: 'c = 3' }]])).toEqual([1])
    expect(chooseLockedLines('zzz', [locks])).toEqual([])
  })
})

describe('puzzle.onlyEdit', () => {
  it('locks every non-blank line but the listed ones', () => {
    expect(onlyEditLocks('import turtle\nturtle.forward(50)\n\nturtle.done()\n', [2])).toEqual([
      { line: 1, target: 'import turtle' },
      { line: 4, target: 'turtle.done()' },
    ])
  })

  it('merges with marker locks, one per line', () => {
    expect(
      mergeLocks(
        [{ line: 3, target: 'c' }],
        [
          { line: 1, target: 'a' },
          { line: 3, target: 'c' },
        ]
      )
    ).toEqual([
      { line: 1, target: 'a' },
      { line: 3, target: 'c' },
    ])
  })
})

describe('stripTaskLineHints lock sets', () => {
  it('keeps each code stage’s locks on the runtime-only lockSets', () => {
    const task = {
      id: 1,
      codeStages: [
        { role: 'starter', code: '#@lock\nx = 1\ny = 2\n' },
        { role: 'complete', code: '#@lock\nx = 1\ny = 3\n' },
      ],
    }
    const stripped = stripTaskLineHints(task, 'python')
    expect(stripped.codeStages[0].code).toBe('x = 1\ny = 2\n')
    expect(stripped.lockSets).toEqual([
      { source: 'starter', stageIndex: 0, file: null, locks: [{ line: 1, target: 'x = 1' }] },
      { source: 'stage', stageIndex: 1, file: null, locks: [{ line: 1, target: 'x = 1' }] },
    ])
    expect(getTaskLockSets(stripped)).toEqual([
      [{ line: 1, target: 'x = 1' }],
      [{ line: 1, target: 'x = 1' }],
    ])
    expect(taskHasLocks(stripped)).toBe(true)
  })

  it('adds puzzle.onlyEdit locks to the starter set (marker lines do not count)', () => {
    const task = {
      id: 2,
      puzzle: { onlyEdit: [2] },
      codeStages: [
        {
          role: 'starter',
          code: '#> Change this line\nimport turtle\nturtle.fd(5)\n#@lock\nturtle.done()\n',
        },
      ],
    }
    const stripped = stripTaskLineHints(task, 'python')
    // Starter as the student sees it: import turtle / turtle.fd(5) / turtle.done().
    expect(stripped.lockSets).toEqual([
      {
        source: 'starter',
        stageIndex: 0,
        file: null,
        locks: [
          { line: 1, target: 'import turtle' },
          { line: 3, target: 'turtle.done()' },
        ],
        onlyEdit: true,
      },
    ])
  })

  it('gives a task with onlyEdit and no markers its locks too', () => {
    const task = { id: 3, puzzle: { onlyEdit: [1] }, starterCode: 'a = 1\nb = 2' }
    const stripped = stripTaskLineHints(task, 'python')
    expect(stripped).not.toBe(task)
    expect(stripped.starterCode).toBe('a = 1\nb = 2')
    expect(getTaskLockSets(stripped)).toEqual([[{ line: 2, target: 'b = 2' }]])
  })

  it('is safe to run twice', () => {
    const task = { id: 4, puzzle: { onlyEdit: [1] }, starterCode: '#@lock\na = 1\nb = 2' }
    const once = stripTaskLineHints(task, 'python')
    expect(stripTaskLineHints(once, 'python')).toBe(once)
  })

  it('leaves a task without locks or markers alone', () => {
    const task = { id: 5, starterCode: 'a = 1' }
    expect(stripTaskLineHints(task, 'python')).toBe(task)
    expect(getTaskLockSets(task)).toEqual([])
  })

  it('reaches tasks through a lesson', () => {
    const lesson = { tasks: [{ id: 6, starterCode: '#@lock\nx = 1\n' }] }
    const prepared = stripLessonLineHints(lesson, () => 'python')
    expect(getTaskLockSets(prepared.tasks[0])).toEqual([[{ line: 1, target: 'x = 1' }]])
  })
})

describe('taskHasValueLocks', () => {
  it('is true only with a #@lock-values lock', () => {
    const code = 'from stage import *\n#@lock-values\nhero = "Zara"\n#@lock\ntext(hero)'
    const task = stripTaskLineHints({ id: 't', starterCode: code }, 'python')
    expect(taskHasValueLocks(task)).toBe(true)
    const plain = stripTaskLineHints({ id: 't', starterCode: '#@lock\nprint(1)' }, 'python')
    expect(taskHasLocks(plain)).toBe(true)
    expect(taskHasValueLocks(plain)).toBe(false)
    expect(taskHasValueLocks({})).toBe(false)
  })
})
