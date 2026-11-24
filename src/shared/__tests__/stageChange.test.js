import { describe, expect, it } from 'vitest'
import {
  CHANGE_LIMITS,
  cleanCodeLines,
  computeStageChange,
  copyAnchorRows,
  pairInlineRows,
  lessonStageChange,
  pickStageChange,
  stageChangeBases,
  stageChangeIsExcerpt,
  stageShowsChange,
} from '../stageChange.js'

// Platform request 134 (Plans/Stage diff view - plan.md, section 6): the change view a Complete
// stage can show instead of the whole program.
const lines = (...rows) => rows.join('\n')

describe('cleanCodeLines', () => {
  it('drops #@lock, #@slot and #> marker lines and trims trailing whitespace', () => {
    const code = lines(
      '#@lock',
      'x = 1   ',
      '#@slot 2',
      '#> Change me',
      'print(x)\t',
      '#@lock-values'
    )
    expect(cleanCodeLines(code)).toEqual(['x = 1', 'print(x)'])
  })

  it('reads Windows line endings', () => {
    expect(cleanCodeLines('a = 1\r\nb = 2\r\n')).toEqual(['a = 1', 'b = 2', ''])
  })
})

describe('computeStageChange', () => {
  it('1. pure add: one anchor line and the green line', () => {
    const base = lines('size = 100', 'step = 5', 'size -= step')
    const target = lines('size = 100', 'step = 5', 'size -= step', 'turn += 10')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['size -= step'], position: 'after' },
        rows: [{ type: 'add', text: 'turn += 10' }],
        indent: null,
      },
    ])
  })

  it('2. one-line swap: one red and one green line, anchored by the line before', () => {
    const base = lines('from turtle import *', 'for i in range(5):', '    forward(50)')
    const target = lines('from turtle import *', 'for i in range(3):', '    forward(50)')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toHaveLength(1)
    expect(change.hunks[0].anchor).toEqual({ lines: ['from turtle import *'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([
      { type: 'remove', text: 'for i in range(5):' },
      { type: 'add', text: 'for i in range(3):' },
    ])
  })

  it('2b. a swap on line 1 has no anchor and does not fall back', () => {
    const change = computeStageChange(lines('x = 5', 'print(x)'), lines('x = 3', 'print(x)'))
    expect(change.kind).toBe('changes')
    expect(change.hunks[0].anchor).toBeNull()
    expect(change.hunks[0].rows.map((row) => row.type)).toEqual(['remove', 'add'])
  })

  it('3. insert in the middle: an anchor above, the green lines, nothing else', () => {
    const base = lines('a = 1', 'b = 2', 'c = 3', 'd = 4')
    const target = lines('a = 1', 'b = 2', 'x = 9', 'y = 8', 'c = 3', 'd = 4')
    const change = computeStageChange(base, target)
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['b = 2'], position: 'after' },
        rows: [
          { type: 'add', text: 'x = 9' },
          { type: 'add', text: 'y = 8' },
        ],
        indent: null,
      },
    ])
  })

  it('an add at the very top is anchored by the line after it ("before this line")', () => {
    const change = computeStageChange(
      lines('forward(50)', 'done()'),
      lines('speed(0)', 'forward(50)', 'done()')
    )
    expect(change.hunks[0].anchor).toEqual({ lines: ['forward(50)'], position: 'before' })
  })

  it('new lines keep their indentation', () => {
    const change = computeStageChange(
      lines('for i in range(3):', '    forward(50)', 'done()'),
      lines('for i in range(3):', '    forward(50)', '    right(120)', 'done()')
    )
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: '    right(120)' }])
  })

  it('4. indent-only: one note with the count and no red or green', () => {
    const base = lines('x = 1', 'forward(100)', 'right(90)', 'print(x)', 'y = 2', 'z = 3')
    const target = lines(
      'x = 1',
      '    forward(100)',
      '    right(90)',
      '    print(x)',
      'y = 2',
      'z = 3'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toEqual([
      {
        anchor: null,
        rows: [],
        indent: {
          lines: ['    forward(100)', '    right(90)', '    print(x)'],
          direction: 'in',
          spaces: 4,
        },
      },
    ])
  })

  it('4b. mixed indent and add: the anchor, the new line in green and the indent note', () => {
    const base = lines(
      'from turtle import *',
      'forward(100)',
      'right(90)',
      'print(1)',
      'done()',
      'a = 1',
      'b = 2',
      'c = 3'
    )
    const target = lines(
      'from turtle import *',
      'for i in range(4):',
      '    forward(100)',
      '    right(90)',
      '    print(1)',
      'done()',
      'a = 1',
      'b = 2',
      'c = 3'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toHaveLength(1)
    expect(change.hunks[0].anchor).toEqual({ lines: ['from turtle import *'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'for i in range(4):' }])
    expect(change.hunks[0].indent).toEqual({
      lines: ['    forward(100)', '    right(90)', '    print(1)'],
      direction: 'in',
      spaces: 4,
    })
  })

  it('5. #@lock, #@slot and #> lines never show as changes', () => {
    const base = lines('#@lock', 'x = 1', '#> Add a line under this one', 'y = 2')
    const target = lines('x = 1', '#@slot', 'z = 3', 'y = 2')
    const change = computeStageChange(base, target)
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['x = 1'], position: 'after' },
        rows: [{ type: 'add', text: 'z = 3' }],
        indent: null,
      },
    ])
    const allText = JSON.stringify(change)
    expect(allText).not.toMatch(/#@|#>/)
  })

  it('5b. the anchor is always text, never a line number', () => {
    const change = computeStageChange(lines('a = 1', 'b = 2'), lines('a = 1', 'c = 3', 'b = 2'))
    expect(change.hunks[0].anchor.lines.every((line) => typeof line === 'string')).toBe(true)
    expect(change.hunks[0]).not.toHaveProperty('line')
  })

  it('6a. falls back when the change is more than half of the Complete', () => {
    const change = computeStageChange(lines('a = 1'), lines('a = 1', 'b = 2', 'c = 3'))
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('most')
  })

  it('6b. falls back on more than 3 separate changes', () => {
    const base = lines('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l')
    const target = lines(
      'a',
      'A1',
      'b',
      'c',
      'd',
      'B1',
      'e',
      'f',
      'g',
      'C1',
      'h',
      'i',
      'D1',
      'j',
      'k',
      'l'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('many')
  })

  it('6c. falls back on an added block over 8 lines', () => {
    const before = Array.from({ length: 20 }, (_, i) => `keep${i} = ${i}`)
    const added = Array.from(
      { length: CHANGE_LIMITS.maxAddedBlock + 1 },
      (_, i) => `new${i} = ${i}`
    )
    const change = computeStageChange(
      lines(...before),
      lines(...before.slice(0, 10), ...added, ...before.slice(10))
    )
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('big-add')
  })

  it('6e. a fall-back has no hunks, whatever the reason (only the whole program shows)', () => {
    const most = computeStageChange(lines('a = 1'), lines('a = 1', 'b = 2', 'c = 3'))
    const base = lines('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l')
    const many = computeStageChange(
      base,
      lines('a', 'A1', 'b', 'c', 'd', 'B1', 'e', 'f', 'g', 'C1', 'h', 'i', 'D1', 'j', 'k', 'l')
    )
    expect([most.reason, many.reason]).toEqual(['most', 'many'])
    expect(most.hunks).toEqual([])
    expect(many.hunks).toEqual([])
  })

  it('6d. the fall-back keeps every line, marked', () => {
    const change = computeStageChange(
      lines('from turtle import *', 'right(90)', 'done()'),
      lines(
        'from turtle import *',
        'speed(0)',
        'for i in range(36):',
        '    forward(100)',
        '    right(10)',
        'done()'
      )
    )
    expect(change.kind).toBe('fallback')
    expect(change.fullRows).toEqual([
      { type: 'same', text: 'from turtle import *' },
      { type: 'remove', text: 'right(90)' },
      { type: 'add', text: 'speed(0)' },
      { type: 'add', text: 'for i in range(36):' },
      { type: 'add', text: '    forward(100)' },
      { type: 'add', text: '    right(10)' },
      { type: 'same', text: 'done()' },
    ])
  })

  it('7a. two identical lines: the anchor names the right one', () => {
    const base = lines('print("hi")', 'x = 1', 'print("hi")')
    const target = lines('print("hi")', 'x = 1', 'print("hi")', 'y = 2')
    const change = computeStageChange(base, target)
    // "after print("hi")" alone would be ambiguous: the line above it makes it the second one.
    expect(change.hunks[0].anchor).toEqual({ lines: ['x = 1', 'print("hi")'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'y = 2' }])
  })

  it('7a. a repeated line uses the unique line after it when that is clearer', () => {
    const base = lines('print("hi")', 'print("hi")', 'done()')
    const target = lines('print("hi")', 'print("hi")', 'x = 1', 'done()')
    // Before-line repeated (and its pair is repeated in a 2-line run? no: unique pair), but the
    // line after is unique, so the single line wins over a two-line anchor.
    expect(computeStageChange(base, target).hunks[0].anchor).toEqual({
      lines: ['done()'],
      position: 'before',
    })
  })

  it('7b. a moved line shows as red and green', () => {
    const base = lines('speed(0)', 'a = 1', 'b = 2', 'c = 3', 'd = 4', 'e = 5')
    const target = lines('a = 1', 'b = 2', 'c = 3', 'd = 4', 'e = 5', 'speed(0)')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    const rows = change.hunks.flatMap((hunk) => hunk.rows)
    expect(rows).toEqual([
      { type: 'remove', text: 'speed(0)' },
      { type: 'add', text: 'speed(0)' },
    ])
    expect(change.hunks[1].anchor).toEqual({ lines: ['e = 5'], position: 'after' })
  })

  it('8a. an empty base falls back to the full code, all new', () => {
    const change = computeStageChange('', lines('print("hi")'))
    expect(change.kind).toBe('fallback')
    expect(change.fullRows).toEqual([{ type: 'add', text: 'print("hi")' }])
  })

  it('8b. a comment-only base anchors on the comment', () => {
    const change = computeStageChange(
      lines('# Draw a circle under this line', 'x = 0', 'y = 0'),
      lines('# Draw a circle under this line', 'circle(x, y, 50)', 'x = 0', 'y = 0')
    )
    expect(change.hunks[0].anchor).toEqual({
      lines: ['# Draw a circle under this line'],
      position: 'after',
    })
  })

  it('8c. blank-line-only differences are ignored', () => {
    const change = computeStageChange(
      lines('a = 1', '', '', 'b = 2  '),
      lines('a = 1', 'b = 2', '')
    )
    expect(change.kind).toBe('same')
    expect(change.hunks).toEqual([])
  })

  it('8d. tabs and spaces of the same width are the same indent', () => {
    const change = computeStageChange(
      lines('for i in range(3):', '\tprint(i)'),
      lines('for i in range(3):', '    print(i)')
    )
    expect(change.kind).toBe('same')
  })

  it('8e. a base equal to the Complete says it already matches', () => {
    const code = lines('x = 1', 'print(x)')
    expect(computeStageChange(code, code).kind).toBe('same')
  })

  it('the full rows keep the Complete blank lines in place', () => {
    const change = computeStageChange(lines('a = 1', 'c = 3'), lines('a = 1', '', 'b = 2', 'c = 3'))
    expect(change.fullRows).toEqual([
      { type: 'same', text: 'a = 1' },
      { type: 'same', text: '' },
      { type: 'add', text: 'b = 2' },
      { type: 'same', text: 'c = 3' },
    ])
  })

  it('falls back when an add has no usable anchor', () => {
    // Every line around the add repeats, alone and in pairs.
    const base = lines('x', 'x', 'x', 'x', 'x', 'x')
    const target = lines('x', 'x', 'x', 'y', 'x', 'x', 'x')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('no-anchor')
  })
})

// The change view compares a stage with the lesson's step before it, never the student's code
// (Plans/Show only the changing bit - facts - 24 Nov.md, option E).
describe('stageChangeBases', () => {
  const START = 'total = 0\nfor n in range(5):\n    total += n\nprint(total)'
  const STEP = 'total = 0\nfor n in range(5):\n    total += n\n    print(n)\nprint(total)'
  const DONE = `${STEP}\nprint("done")`
  const task = (...stages) => ({ id: 2, codeStages: stages })

  it('is the earlier Complete or whole Support stages, nearest first, then the starter', () => {
    const t = task(
      { role: 'starter', code: START },
      { role: 'support', code: STEP },
      { role: 'support', show: 'change', code: '    print(n)' },
      { role: 'complete', code: DONE }
    )
    expect(stageChangeBases(t, 3)).toEqual([STEP, START])
    expect(stageChangeBases(t, 2)).toEqual([STEP, START])
    expect(stageChangeBases(t, 1)).toEqual([START])
  })

  it('never compares with a short Support hint: a 10-line Complete diffs against the starter', () => {
    const starter = 'a = 1\nb = 2\nc = 3\nprint(a)'
    const complete = `${starter}\nfor i in range(3):\n    a += i\n    b += i\nprint(b)\nprint(c)\nprint(a + b)`
    const t = task(
      { role: 'starter', code: starter },
      { role: 'support', code: 'for i in range(3):\n    a += i\n    b += i' },
      { role: 'complete', code: complete }
    )
    expect(stageChangeBases(t, 2)).toEqual([starter])
    expect(lessonStageChange(t, 2).kind).toBe('fallback')
  })

  it('shows the whole stage unmarked when the nearest step is the same, never an older one', () => {
    const t = task(
      { role: 'starter', code: START },
      { role: 'complete', code: STEP },
      { role: 'complete', code: STEP }
    )
    expect(lessonStageChange(t, 2)).toMatchObject({ kind: 'fallback', reason: 'same' })
    expect(lessonStageChange(t, 1).kind).toBe('changes')
  })

  it('uses the carried task Complete when the task has no starter of its own', () => {
    const t = { id: 2, carryCodeFrom: 1, codeStages: [{ role: 'complete', code: DONE }] }
    const lessonTasks = [
      { type: 'group', subtasks: [{ id: 1, codeStages: [{ role: 'complete', code: STEP }] }] },
      t,
    ]
    expect(stageChangeBases(t, 0, lessonTasks)).toEqual([STEP])
    expect(stageChangeBases(t, 0)).toEqual([])
    // A placeholder starter never wins over the carried Complete.
    const withStarter = {
      ...t,
      codeStages: [{ role: 'starter', code: '# carry on' }, ...t.codeStages],
    }
    expect(stageChangeBases(withStarter, 1, lessonTasks)).toEqual([STEP])
  })

  it('has no base for code carried from another lesson, or an empty starter', () => {
    const fromLesson = {
      carryCodeFromLesson: { lesson: 'l1', task: 3 },
      codeStages: [
        { role: 'starter', code: START },
        { role: 'complete', code: STEP },
      ],
    }
    expect(stageChangeBases(fromLesson, 1)).toEqual([])
    expect(lessonStageChange(fromLesson, 1)).toMatchObject({ kind: 'fallback', reason: 'same' })
    expect(
      stageChangeBases({ starterCode: '', codeStages: [{ role: 'complete', code: STEP }] }, 0)
    ).toEqual([])
  })
})

describe('pickStageChange', () => {
  const START = 'a = 1\nb = 2\nprint(a)'
  const DONE = 'a = 1\nb = 2\nprint(a)\nprint(b)'

  it('takes the nearest base it reads as a small change, skipping a hint excerpt', () => {
    const change = pickStageChange(['print(b)'], DONE)
    expect(change.kind).toBe('fallback')
    const picked = pickStageChange(['print(b)', START], DONE)
    expect(picked.kind).toBe('changes')
    expect(picked.hunks[0].rows).toEqual([{ type: 'add', text: 'print(b)' }])
  })

  it('shows the whole stage, unmarked, when no step before it differs', () => {
    const change = pickStageChange([DONE], DONE)
    expect(change).toMatchObject({ kind: 'fallback', reason: 'same' })
    expect(change.fullRows.every((row) => row.type === 'same')).toBe(true)
    // No base at all: the whole stage, unmarked, with no "A lot changed" note.
    expect(pickStageChange([], DONE)).toMatchObject({ kind: 'fallback', reason: 'same' })
  })

  it('the nearest base wins when it gives changes; a farther one only after nearer fall-backs', () => {
    const near = 'a = 1\nb = 2'
    expect(pickStageChange([START, near], DONE).hunks[0].rows).toEqual([
      { type: 'add', text: 'print(b)' },
    ])
    expect(pickStageChange([near, START], DONE).hunks[0].rows).toHaveLength(2)
  })
})

describe('stageShowsChange', () => {
  it('is on for a Complete code stage unless show: full, and a Support one with show: change', () => {
    expect(stageShowsChange({ role: 'complete', show: 'change', code: 'x' })).toBe(true)
    expect(stageShowsChange({ role: 'support', show: 'change', code: 'x' })).toBe(true)
    expect(stageShowsChange({ role: 'complete', code: 'x' })).toBe(true)
    expect(stageShowsChange({ role: 'complete', show: 'full', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'support', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'starter', show: 'change', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'complete', show: 'change', files: [] })).toBe(false)
    expect(stageShowsChange(null)).toBe(false)
  })

  it('a Support stage is an excerpt; a Complete stage is the whole program', () => {
    expect(stageChangeIsExcerpt({ role: 'support' })).toBe(true)
    expect(stageChangeIsExcerpt({ role: 'complete' })).toBe(false)
  })
})

describe('computeStageChange on an excerpt (Support stage)', () => {
  const PROGRAM = lines(
    'from stage import *',
    'background("skyblue")',
    'circle(50, "gold", x=200, y=150)',
    'square(40, "brown", x=80, y=260)',
    'print("done")'
  )
  const excerpt = (target, base = PROGRAM) => computeStageChange(base, target, { excerpt: true })

  it('places a new line by a line of the student code and drops the lines it skips', () => {
    const change = excerpt(lines('circle(50, "gold", x=200, y=150)', 'text("Hi!", x=200, y=240)'))
    expect(change.kind).toBe('changes')
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['circle(50, "gold", x=200, y=150)'], position: 'after' },
        rows: [{ type: 'add', text: 'text("Hi!", x=200, y=240)' }],
        indent: null,
      },
    ])
    expect(change.fullRows.map((row) => row.type)).toEqual(['same', 'add'])
  })

  it('the same excerpt as a whole program would remove the skipped lines', () => {
    const target = lines('circle(50, "gold", x=200, y=150)', 'text("Hi!", x=200, y=240)')
    const rows = computeStageChange(PROGRAM, target).fullRows
    expect(rows.filter((row) => row.type === 'remove')).toHaveLength(4)
  })

  it('a new line at the top is placed before the line after it', () => {
    const change = excerpt(lines('stamp("🚀")', 'background("skyblue")'))
    expect(change.hunks[0].anchor).toEqual({ lines: ['background("skyblue")'], position: 'before' })
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'stamp("🚀")' }])
  })

  it('keeps a removed line only when the new line only changes a small piece of it', () => {
    const change = excerpt(lines('background("navy")', 'circle(50, "gold", x=200, y=150)'))
    expect(change.kind).toBe('changes')
    expect(change.hunks[0].rows).toEqual([
      { type: 'remove', text: 'background("skyblue")' },
      { type: 'add', text: 'background("navy")' },
    ])
  })

  it('a new line unlike the skipped lines around it stays a plain add', () => {
    const change = excerpt(
      lines('circle(50, "gold", x=200, y=150)', 'stamp("🚀", x=80, y=320)', 'print("done")')
    )
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'stamp("🚀", x=80, y=320)' }])
  })

  it('re-indented lines still show as the indent note', () => {
    const change = excerpt(
      lines('for i in range(3):', '    circle(50)', '    rect(10, 10)'),
      lines('x = 1', 'for i in range(3):', '    circle(50)', 'rect(10, 10)', 'print(x)')
    )
    expect(change.kind).toBe('changes')
    expect(change.hunks[0].indent).toMatchObject({ lines: ['    rect(10, 10)'], direction: 'in' })
  })

  it('every line already in the student code is "same"', () => {
    expect(excerpt(lines('background("skyblue")', 'print("done")')).kind).toBe('same')
  })

  it('new lines with nothing to place them by fall back to the excerpt, all green', () => {
    const change = excerpt(lines('text("Hi!")', 'stamp("🚀")'))
    expect(change).toMatchObject({ kind: 'fallback', reason: 'no-anchor', hunks: [] })
    expect(change.fullRows).toEqual([
      { type: 'add', text: 'text("Hi!")' },
      { type: 'add', text: 'stamp("🚀")' },
    ])
  })

  it('a mostly new excerpt is not a "most" fall-back', () => {
    const change = excerpt(
      lines('circle(50, "gold", x=200, y=150)', 'text("A")', 'text("B")', 'text("C")')
    )
    expect(change.kind).toBe('changes')
  })

  it('still falls back for more than 3 separate changes or a big new block', () => {
    const many = excerpt(
      lines(
        'from stage import *',
        'a = 1',
        'background("skyblue")',
        'b = 2',
        'circle(50, "gold", x=200, y=150)',
        'c = 3',
        'square(40, "brown", x=80, y=260)',
        'd = 4'
      )
    )
    expect(many.reason).toBe('many')
    const big = excerpt(
      lines(
        'background("skyblue")',
        ...Array.from({ length: CHANGE_LIMITS.maxAddedBlock + 1 }, (_, i) => `n${i} = ${i}`)
      )
    )
    expect(big.reason).toBe('big-add')
  })

  // An excerpt is often lifted out of a block, so its indent need not match the student's.
  const IN_DRAW = lines(
    'def draw():',
    '    background("skyblue")',
    '    circle(50, "gold", x=200, y=150)',
    '    print("done")'
  )

  it('an excerpt indented less than the student code is not a re-indent', () => {
    const change = excerpt(
      lines('circle(50, "gold", x=200, y=150)', 'text("Hi!", x=200, y=240)'),
      IN_DRAW
    )
    expect(change.kind).toBe('changes')
    expect(change.hunks).toHaveLength(1)
    expect(change.hunks[0].indent).toBeNull()
    expect(change.fullRows.map((row) => row.type)).toEqual(['same', 'add'])
  })

  it('a small swap in a dedented excerpt still pairs into one ± row', () => {
    const change = excerpt(lines('background("navy")', 'circle(50, "gold", x=200, y=150)'), IN_DRAW)
    expect(change.kind).toBe('changes')
    const rows = pairInlineRows(change.hunks[0].rows)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'change', text: 'background("navy")' })
  })

  it('a line the hint moves into a new block is still a re-indent', () => {
    const change = excerpt(
      lines('x = 1', 'for i in range(3):', '    circle(50)'),
      lines('x = 1', 'circle(50)', 'print(x)')
    )
    expect(change.hunks[0].indent).toMatchObject({ lines: ['    circle(50)'], direction: 'in' })
  })

  it('in a long run of skipped lines, the line nearest the next shared line can pair', () => {
    const filler = Array.from(
      { length: CHANGE_LIMITS.inlineMaxRunLines + 2 },
      (_, i) => `n${i} = ${i}`
    )
    const base = lines('from stage import *', ...filler, 'background("skyblue")', 'print("done")')
    const change = excerpt(
      lines('from stage import *', 'background("navy")', 'print("done")'),
      base
    )
    expect(change.kind).toBe('changes')
    expect(change.hunks[0].rows).toEqual([
      { type: 'remove', text: 'background("skyblue")' },
      { type: 'add', text: 'background("navy")' },
    ])
  })
})

describe('copyAnchorRows', () => {
  it('copyAfter: the line before, dimmed, then the typed lines', () => {
    expect(copyAnchorRows({ code: 'turn += 10\nprint(turn)\n', after: '  size -= step' })).toEqual({
      anchor: { lines: ['  size -= step'], position: 'after' },
      rows: [
        { type: 'add', text: 'turn += 10' },
        { type: 'add', text: 'print(turn)' },
      ],
    })
  })

  it('copyBefore: the typed lines go above the named line', () => {
    expect(copyAnchorRows({ code: 'speed(0)', before: 'forward(50)' })).toEqual({
      anchor: { lines: ['forward(50)'], position: 'before' },
      rows: [{ type: 'add', text: 'speed(0)' }],
    })
  })

  it('is null with neither field (the panel looks as today)', () => {
    expect(copyAnchorRows({ code: 'x = 1' })).toBeNull()
    expect(copyAnchorRows({ code: 'x = 1', after: '   ' })).toBeNull()
  })
})
