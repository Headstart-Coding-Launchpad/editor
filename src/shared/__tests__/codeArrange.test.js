import { describe, expect, it } from 'vitest'
import {
  assembleCodeArrangement,
  buildSolutionSlotState,
  deriveSlotStateFromCode,
  fragmentIdExists,
  getAllSlots,
  getCodeArrangeEntryFile,
  getDistractors,
  getFragmentCodeById,
  getLineParts,
  getLineSlots,
  getLines,
  getSlotIds,
  getTaskPool,
  isArrangementComplete,
} from '../codeArrange'
import { evaluateCheck, evaluateSingleCheck } from '../../modules/checks'

// Two lines, each just a single blank with no surrounding text — the
// "whole line" shape, now just the degenerate case of the general parts
// model. Distractors are authored once, task-wide.
const WHOLE_TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'for i in range(5):' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: '    print(i * 2)' }] },
  ],
  distractors: [
    { id: 'D1', code: '    print(i + 2)' },
    { id: 'D2', code: 'for i in range(10):' },
  ],
  check: { type: 'output', operator: 'equals', value: '0\n2\n4\n6\n8' },
}

// One line with two blanks and fixed text around/between them, plus a
// second whole-style line, all drawing from the one shared task pool.
const INLINE_TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    {
      id: 'L1',
      parts: [
        { type: 'text', text: 'x = ' },
        { type: 'slot', id: 'S1', code: '2' },
        { type: 'text', text: ' + ' },
        { type: 'slot', id: 'S2', code: '3' },
      ],
    },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'print(x)' }] },
  ],
  distractors: [
    { id: 'S1d1', code: '20' },
    { id: 'S2d1', code: '30' },
  ],
  check: { type: 'output', operator: 'equals', value: '5' },
}

// A task mixing a whole-style line and an inline-style line, to exercise
// both render/derive shapes within a single assembled program, all sharing
// one task-level pool.
const MIXED_TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'total = 0' }] },
    {
      id: 'L2',
      parts: [
        { type: 'text', text: 'for i in range(' },
        { type: 'slot', id: 'S1', code: '5' },
        { type: 'text', text: '):' },
      ],
    },
  ],
  distractors: [
    { id: 'D1', code: 'total = 1' },
    { id: 'S1d1', code: '10' },
  ],
}

describe('line/slot introspection', () => {
  it('reads lines, defaulting a missing array to empty', () => {
    expect(getLines(WHOLE_TASK)).toHaveLength(2)
    expect(getLines({})).toEqual([])
  })

  it('reads distractors, defaulting a missing array to empty', () => {
    expect(getDistractors(WHOLE_TASK)).toHaveLength(2)
    expect(getDistractors({})).toEqual([])
  })

  it("returns a single-slot line's one slot", () => {
    expect(getLineSlots(WHOLE_TASK.lines[0])).toEqual([
      { type: 'slot', id: 'L1', code: 'for i in range(5):' },
    ])
  })

  it('returns only the slot parts of a line mixing text and blanks', () => {
    expect(getLineParts(INLINE_TASK.lines[0])).toHaveLength(4)
    expect(getLineSlots(INLINE_TASK.lines[0]).map((slot) => slot.id)).toEqual(['S1', 'S2'])
  })

  it('flattens every slot across the task in authoring order', () => {
    expect(getAllSlots(MIXED_TASK).map((slot) => slot.id)).toEqual(['L1', 'S1'])
    expect(getSlotIds(MIXED_TASK)).toEqual(['L1', 'S1'])
  })

  it("builds one shared task pool from every slot's own correct code plus the task-level distractors", () => {
    const pool = getTaskPool(WHOLE_TASK)
    expect(pool.map((f) => f.id).sort()).toEqual(['D1', 'D2', 'L1', 'L2'])
    expect(getTaskPool(WHOLE_TASK)).toEqual(pool)
  })

  it("looks up a fragment's code by id across the shared pool", () => {
    expect(getFragmentCodeById(WHOLE_TASK, 'D2')).toBe('for i in range(10):')
    expect(getFragmentCodeById(INLINE_TASK, 'S2d1')).toBe('30')
    expect(getFragmentCodeById(WHOLE_TASK, 'nope')).toBe('')
  })

  it('checks whether a fragment id exists anywhere in the shared pool', () => {
    expect(fragmentIdExists(WHOLE_TASK, 'D2')).toBe(true)
    expect(fragmentIdExists(INLINE_TASK, 'S1')).toBe(true)
    expect(fragmentIdExists(WHOLE_TASK, 'nope')).toBe(false)
  })
})

describe('isArrangementComplete', () => {
  it('is not complete until every slot has a fragment assigned', () => {
    expect(isArrangementComplete(WHOLE_TASK, {})).toBe(false)
    expect(isArrangementComplete(WHOLE_TASK, { L1: 'L1' })).toBe(false)
    expect(isArrangementComplete(WHOLE_TASK, { L1: 'L1', L2: 'L2' })).toBe(true)
    // A distractor in every slot still counts as "complete" (it will just run wrong).
    expect(isArrangementComplete(WHOLE_TASK, { L1: 'D2', L2: 'D1' })).toBe(true)

    expect(isArrangementComplete(INLINE_TASK, { S1: 'S1', L2: 'L2' })).toBe(false)
    expect(isArrangementComplete(INLINE_TASK, { S1: 'S1', S2: 'S2', L2: 'L2' })).toBe(true)
  })
})

describe('assembleCodeArrangement — single-slot ("whole line") lines', () => {
  it('returns null while incomplete and does not run partial arrangements', () => {
    expect(assembleCodeArrangement(WHOLE_TASK, {})).toBeNull()
    expect(assembleCodeArrangement(WHOLE_TASK, { L1: 'L1' })).toBeNull()
  })

  it('assembles the correct-order arrangement into runnable code', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'L1', L2: 'L2' })
    expect(code).toBe('for i in range(5):\n    print(i * 2)')
  })

  it('assembles a distractor-containing arrangement too — distractors are not excluded from execution', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'D2', L2: 'D1' })
    expect(code).toBe('for i in range(10):\n    print(i + 2)')
  })

  it("lets any tile in the shared pool be dropped into any slot, including another line's own correct tile", () => {
    // L2's own correct tile placed into L1's slot: still assembles for real.
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'L2', L2: 'L1' })
    expect(code).toBe('    print(i * 2)\nfor i in range(5):')
  })

  it('builds the authored-solution slot state for the Builder "load solution" preview', () => {
    expect(buildSolutionSlotState(WHOLE_TASK)).toEqual({ L1: 'L1', L2: 'L2' })
  })

  it('resolves the HTML entry file, falling back through starterFiles then a default', () => {
    expect(getCodeArrangeEntryFile({ entryFile: 'page.html' })).toBe('page.html')
    expect(getCodeArrangeEntryFile({ starterFiles: [{ name: 'home.html' }] })).toBe('home.html')
    expect(getCodeArrangeEntryFile({})).toBe('index.html')
  })
})

describe('assembleCodeArrangement — lines with inline blanks', () => {
  it("splices the currently selected tile into each blank's exact position", () => {
    const code = assembleCodeArrangement(INLINE_TASK, { S1: 'S1', S2: 'S2', L2: 'L2' })
    expect(code).toBe('x = 2 + 3\nprint(x)')
  })

  it('a distractor in an inline blank is spliced in and assembles real (wrong) code too', () => {
    const code = assembleCodeArrangement(INLINE_TASK, { S1: 'S1d1', S2: 'S2d1', L2: 'L2' })
    expect(code).toBe('x = 20 + 30\nprint(x)')
  })

  it("builds the authored solution from every blank's own correct id", () => {
    expect(buildSolutionSlotState(INLINE_TASK)).toEqual({ S1: 'S1', S2: 'S2', L2: 'L2' })
  })
})

describe('assembleCodeArrangement — mixed single-slot and inline-blank lines', () => {
  it('assembles a program combining both line styles from the one shared pool', () => {
    const code = assembleCodeArrangement(MIXED_TASK, { L1: 'L1', S1: 'S1' })
    expect(code).toBe('total = 0\nfor i in range(5):')
  })

  it('a wrong tile in either slot runs for real', () => {
    const code = assembleCodeArrangement(MIXED_TASK, { L1: 'D1', S1: 'S1d1' })
    expect(code).toBe('total = 1\nfor i in range(10):')
  })
})

// Integration-style: the check evaluator (src/modules/checks.js) is a pure
// function of {code, output/status, ...} exactly as it is for an ordinary
// Python/HTML task. It never inspects task.lines — it only ever sees
// whatever assembleCodeArrangement() produced.
describe('codeArrange + checks integration', () => {
  it('a correct ordering assembles code that passes an output check', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'L1', L2: 'L2' })
    const simulatedOutput = '0\n2\n4\n6\n8'
    expect(evaluateCheck(WHOLE_TASK.check, simulatedOutput, { code, status: 'success' })).toBe(true)
  })

  it('a distractor-containing ordering assembles different code that fails the same check', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'D2', L2: 'D1' })
    const simulatedOutput = '2\n4\n6\n8\n10\n12\n14\n16\n18\n20'
    expect(code).not.toBe(assembleCodeArrangement(WHOLE_TASK, { L1: 'L1', L2: 'L2' }))
    expect(evaluateCheck(WHOLE_TASK.check, simulatedOutput, { code, status: 'success' })).toBe(
      false
    )
  })

  it('a `code` check is a pure function of the assembled string with no execution needed', () => {
    const codeCheck = { type: 'code', operator: 'contains', value: 'range(5)' }
    const goodCode = assembleCodeArrangement(WHOLE_TASK, { L1: 'L1', L2: 'L2' })
    const badCode = assembleCodeArrangement(WHOLE_TASK, { L1: 'D2', L2: 'D1' })
    expect(evaluateSingleCheck(codeCheck, '', { code: goodCode })).toBe(true)
    expect(evaluateSingleCheck(codeCheck, '', { code: badCode })).toBe(false)
  })

  it("an inline distractor that produces wrong output fails the task's output check", () => {
    const code = assembleCodeArrangement(INLINE_TASK, { S1: 'S1d1', S2: 'S2d1', L2: 'L2' })
    expect(evaluateCheck(INLINE_TASK.check, '50', { code, status: 'success' })).toBe(false)
    const goodCode = assembleCodeArrangement(INLINE_TASK, { S1: 'S1', S2: 'S2', L2: 'L2' })
    expect(evaluateCheck(INLINE_TASK.check, '5', { code: goodCode, status: 'success' })).toBe(true)
  })
})

// deriveSlotStateFromCode is the inverse of assembleCodeArrangement(), used to
// redraw the tile board for a teacher watching/editing a student from synced
// code alone (no access to the student's own slot-placement bookkeeping).
describe('deriveSlotStateFromCode — single-slot ("whole line") lines', () => {
  it('reconstructs the exact slot state for a correctly-ordered assembled code string', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'L1', L2: 'L2' })
    expect(deriveSlotStateFromCode(WHOLE_TASK, code)).toEqual({ L1: 'L1', L2: 'L2' })
  })

  it('reconstructs a distractor-containing arrangement the same way', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'D2', L2: 'D1' })
    expect(deriveSlotStateFromCode(WHOLE_TASK, code)).toEqual({ L1: 'D2', L2: 'D1' })
  })

  it('reconstructs a cross-line tile placement (fully shared pool) correctly', () => {
    const code = assembleCodeArrangement(WHOLE_TASK, { L1: 'L2', L2: 'L1' })
    expect(deriveSlotStateFromCode(WHOLE_TASK, code)).toEqual({ L1: 'L2', L2: 'L1' })
  })

  it('round-trips through assemble -> derive for every shared-pool member', () => {
    const pool = getTaskPool(WHOLE_TASK)
    for (const first of pool) {
      for (const second of pool) {
        if (first.id === second.id) continue
        const slotState = { L1: first.id, L2: second.id }
        const code = assembleCodeArrangement(WHOLE_TASK, slotState)
        expect(deriveSlotStateFromCode(WHOLE_TASK, code)).toEqual(slotState)
      }
    }
  })

  it('returns an empty (not-derivable) arrangement when a line does not match any known fragment', () => {
    expect(
      deriveSlotStateFromCode(WHOLE_TASK, 'for i in range(5):\nsomething nobody authored')
    ).toEqual({})
  })

  it('returns an empty arrangement when the line count does not match the authored line count', () => {
    expect(deriveSlotStateFromCode(WHOLE_TASK, 'for i in range(5):')).toEqual({})
    expect(
      deriveSlotStateFromCode(WHOLE_TASK, 'for i in range(5):\n    print(i * 2)\nprint("extra")')
    ).toEqual({})
  })

  it('handles empty, null, and non-string code without throwing', () => {
    expect(deriveSlotStateFromCode(WHOLE_TASK, '')).toEqual({})
    expect(deriveSlotStateFromCode(WHOLE_TASK, null)).toEqual({})
    expect(deriveSlotStateFromCode(WHOLE_TASK, undefined)).toEqual({})
  })

  it('returns an empty arrangement for a task with no lines, without throwing', () => {
    expect(deriveSlotStateFromCode({ ...WHOLE_TASK, lines: [] }, 'anything')).toEqual({})
  })
})

describe('deriveSlotStateFromCode — lines with inline blanks', () => {
  it('reconstructs every blank from a fully-assembled program using the known fixed text as anchors', () => {
    const code = assembleCodeArrangement(INLINE_TASK, { S1: 'S1', S2: 'S2', L2: 'L2' })
    expect(deriveSlotStateFromCode(INLINE_TASK, code)).toEqual({ S1: 'S1', S2: 'S2', L2: 'L2' })
  })

  it('reconstructs a distractor-filled arrangement the same way', () => {
    const code = assembleCodeArrangement(INLINE_TASK, { S1: 'S1d1', S2: 'S2d1', L2: 'L2' })
    expect(deriveSlotStateFromCode(INLINE_TASK, code)).toEqual({ S1: 'S1d1', S2: 'S2d1', L2: 'L2' })
  })

  it('reconstructs a mixed single-slot + inline-blank program from its single assembled string', () => {
    const code = assembleCodeArrangement(MIXED_TASK, { L1: 'D1', S1: 'S1d1' })
    expect(deriveSlotStateFromCode(MIXED_TASK, code)).toEqual({ L1: 'D1', S1: 'S1d1' })
  })

  it('disambiguates two adjacent slots with no fixed text between them by backtracking over the shared pool', () => {
    const adjacentTask = {
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [
        {
          id: 'L1',
          parts: [
            { type: 'slot', id: 'A', code: '1' },
            { type: 'slot', id: 'B', code: '23' },
          ],
        },
      ],
      distractors: [
        { id: 'Ad1', code: '12' },
        { id: 'Bd1', code: '3' },
      ],
    }
    // "123" is ambiguous by raw text split, but only A="1"/B="23" uses two
    // real pool members that together reproduce the string exactly (A="12"
    // would need B to start with "3", and nothing in the pool starting at
    // that position resolves to the end of the line — only the correct
    // split works here since the whole pool is known in advance).
    expect(deriveSlotStateFromCode(adjacentTask, '123')).toEqual({ A: 'A', B: 'B' })
  })

  it('returns an empty arrangement when a line cannot be resolved from any combination of the shared pool', () => {
    expect(deriveSlotStateFromCode(INLINE_TASK, 'x = 999 + 3\nprint(x)')).toEqual({})
  })
})
