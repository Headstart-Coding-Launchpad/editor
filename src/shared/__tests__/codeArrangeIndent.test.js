import { describe, expect, it } from 'vitest'
import {
  assembleCodeArrangement,
  buildSolutionSlotState,
  deriveSlotStateFromCode,
  isArrangementComplete,
  pruneSlotState,
} from '../codeArrange'
import {
  countMovedLines,
  getLineDepth,
  getMovableLineIds,
  getStartDepth,
  isIndentArrangementCorrect,
  setLineDepth,
} from '../codeArrangeIndent'
import definition from '../../activities/code_arrange/definition.js'
import { switchArrangeMode } from '../../activities/code_arrange/codeArrangeBuilder.js'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { INDENT_CODE_ARRANGE_TASK as INDENT_TASK } from '../../test/fixtures/legacyActivityTasks.js'

const SOLVED =
  'guess = 15\nmode = "warmer"\nif guess < 20:\n    print("Too low")\n    if mode == "warmer":\n        print("Heating up!")\nprint("Round over")'

describe('indent mode state', () => {
  it('starts every movable line at depth 0 and locked lines at their depth', () => {
    expect(getMovableLineIds(INDENT_TASK)).toEqual(['L3', 'L4', 'L5', 'L6', 'L7'])
    expect(assembleCodeArrangement(INDENT_TASK, {})).toBe(
      'guess = 15\nmode = "warmer"\nif guess < 20:\nprint("Too low")\nif mode == "warmer":\nprint("Heating up!")\nprint("Round over")'
    )
    expect(isArrangementComplete(INDENT_TASK, {})).toBe(true)
  })

  it('assembles the chosen depths with four spaces per step', () => {
    expect(assembleCodeArrangement(INDENT_TASK, buildSolutionSlotState(INDENT_TASK))).toBe(SOLVED)
    expect(buildSolutionSlotState(INDENT_TASK)).toEqual({ L3: 0, L4: 1, L5: 1, L6: 2, L7: 0 })
  })

  it('starts a line at its `start` depth, and clamps moves to 0..4', () => {
    const task = { ...INDENT_TASK, lines: [{ id: 'A', code: 'x()', depth: 1, start: 3 }] }
    expect(getStartDepth(task.lines[0])).toBe(3)
    expect(getLineDepth(task.lines[0], {})).toBe(3)
    expect(setLineDepth({}, 'A', 9)).toEqual({ A: 4 })
    expect(setLineDepth({}, 'A', -2)).toEqual({ A: 0 })
  })

  it('keeps a locked line at its depth whatever the state says', () => {
    expect(getLineDepth(INDENT_TASK.lines[0], { L1: 3 })).toBe(0)
  })

  it('prunes unknown lines, locked lines and bad depths', () => {
    expect(pruneSlotState(INDENT_TASK, { L1: 2, L3: 1, L4: 1.5, X: 1, L5: 7, L6: 2 })).toEqual({
      L3: 1,
      L6: 2,
    })
    expect(pruneSlotState(INDENT_TASK, 'nope')).toEqual({})
  })

  it('counts moved lines and grades the authored depths', () => {
    expect(countMovedLines(INDENT_TASK, { L4: 1, L6: 0 })).toBe(1)
    expect(isIndentArrangementCorrect(INDENT_TASK, buildSolutionSlotState(INDENT_TASK))).toBe(true)
    expect(isIndentArrangementCorrect(INDENT_TASK, { L4: 1 })).toBe(false)
  })

  it('reads depths back from streamed code, or nothing when it does not match', () => {
    expect(deriveSlotStateFromCode(INDENT_TASK, SOLVED)).toEqual({
      L3: 0,
      L4: 1,
      L5: 1,
      L6: 2,
      L7: 0,
    })
    expect(deriveSlotStateFromCode(INDENT_TASK, SOLVED.replace('Too low', 'Too high'))).toEqual({})
    expect(
      deriveSlotStateFromCode(INDENT_TASK, SOLVED.replace('    print("Too', '  print("Too'))
    ).toEqual({})
    expect(deriveSlotStateFromCode(INDENT_TASK, 'one line')).toEqual({})
  })
})

describe('code_arrange definition in indent mode', () => {
  it('reports lines moved, not slots filled', () => {
    expect(definition.getProgress(INDENT_TASK, { L4: 1, L6: 2 })).toEqual({
      kind: 'code_arrange',
      filled: 2,
      total: 5,
      correct: null,
      unit: 'lines',
      verb: 'moved',
    })
    expect(definition.summarize(INDENT_TASK, {}).text).toBe('0/5 lines moved')
  })

  it('grades and loads the authored solution', () => {
    const solution = definition.solutionState(INDENT_TASK)
    expect(definition.grade(INDENT_TASK, solution).passed).toBe(true)
    expect(definition.grade(INDENT_TASK, {}).passed).toBe(false)
    expect(definition.deserialize(JSON.stringify({ L4: 1, L1: 2 }), INDENT_TASK)).toEqual({ L4: 1 })
  })
})

describe('switching Arrange modes in the Builder', () => {
  it('turns tile lines into indent lines and back, keeping the program', () => {
    const slots = {
      id: 2,
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [
        {
          id: 'a',
          parts: [
            { type: 'text', text: 'for i in range(' },
            { type: 'slot', id: 's', code: '3' },
            { type: 'text', text: '):' },
          ],
        },
        { id: 'b', parts: [{ type: 'slot', id: 'b', code: '    print(i)' }] },
      ],
      distractors: [{ id: 'd', code: '4' }],
      check: { type: 'output', value: '0' },
    }
    const indent = switchArrangeMode(slots, 'indent')
    expect(indent.arrangeMode).toBe('indent')
    expect(indent.distractors).toBeUndefined()
    expect(indent.lines).toEqual([
      { id: 'a', code: 'for i in range(3):', depth: 0 },
      { id: 'b', code: 'print(i)', depth: 1 },
    ])
    const back = switchArrangeMode({ ...indent, showBlocks: false }, 'slots')
    expect(back.arrangeMode).toBeUndefined()
    expect(back.showBlocks).toBeUndefined()
    expect(back.lines[1]).toEqual({
      id: 'b',
      parts: [{ type: 'slot', id: 'b-slot-1', code: '    print(i)' }],
    })
    expect(switchArrangeMode(indent, 'indent')).toBe(indent)
  })
})

function lessonWith(task) {
  return {
    id: 'indent-demo',
    type: 'composed',
    title: 'Indent demo',
    description: 'x',
    tasks: [task],
  }
}

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s indent arrange validation', (_name, validate) => {
  const check = (task) => validate(lessonWith(task))
  const withLine = (index, patch) => ({
    ...INDENT_TASK,
    lines: INDENT_TASK.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
  })

  it('accepts the example task', () => {
    const { errors, warnings } = check(INDENT_TASK)
    expect(errors).toEqual([])
    // The Builder also asks for a preview run before publishing; that isn't about the task.
    expect(warnings.filter((w) => !w.includes("hasn't been tested"))).toEqual([])
  })

  it.each([
    [{ ...INDENT_TASK, arrangeMode: 'spin' }, 'Task 1 arrangeMode must be slots or indent'],
    [
      { ...INDENT_TASK, moduleType: 'html' },
      'Task 1 is an indent arrange task but must use the Python module',
    ],
    [withLine(2, { code: '' }), 'Task 1 line 3 has no code'],
    [
      withLine(2, { code: '  if guess < 20:' }),
      'Task 1 line 3 code starts with spaces (set its depth instead)',
    ],
    [withLine(2, { depth: 5 }), 'Task 1 line 3 depth must be a whole number from 0 to 4'],
    [withLine(2, { start: 1.5 }), 'Task 1 line 3 start must be a whole number from 0 to 4'],
    [withLine(2, { locked: 'yes' }), 'Task 1 line 3 locked must be true or false'],
    [
      withLine(2, { parts: [] }),
      'Task 1 line 3 has parts (indent arrange lines use code and depth)',
    ],
    [
      { ...INDENT_TASK, lines: INDENT_TASK.lines.map((l) => ({ ...l, locked: true })) },
      'Task 1 is an indent arrange task but every line is locked',
    ],
    [
      { ...INDENT_TASK, distractors: [{ id: 'd', code: 'x' }] },
      'Task 1 is an indent arrange task but has distractors (not used in this mode)',
    ],
  ])('reports %#', (task, message) => {
    expect(check(task).errors).toContain(message)
  })

  it('warns when every movable line already starts at its answer', () => {
    const task = {
      ...INDENT_TASK,
      lines: INDENT_TASK.lines.map((l) => ({ ...l, start: l.depth })),
    }
    expect(check(task).warnings).toContain(
      'Task 1 is an indent arrange task but every movable line already starts at its correct depth'
    )
  })

  it('warns when the answer indents a line Python would reject', () => {
    expect(check(withLine(3, { depth: 2 })).warnings).toContain(
      'Task 1 line 4 is indented deeper than the line before it allows'
    )
  })
})
