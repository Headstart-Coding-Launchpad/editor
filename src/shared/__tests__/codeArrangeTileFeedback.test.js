// Code_arrange tile feedback: a tile dropped into a blank where it is known to be wrong (a
// distractor anywhere, or one of that blank's wrongTiles) is flagged with its hint; nothing else
// is, and a right tile is never marked.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DISTRACTOR_TILE_HINT,
  DEFAULT_WRONG_TILE_HINT,
  getAttemptPlacements,
  getNewTileMisses,
  getTileFlag,
  getTileFlags,
  usesTileFeedback,
} from '../codeArrange'
import { validateCodeArrangeTask } from '../../activities/legacyValidation'
import {
  getSlotTileFeedback,
  setSlotTileFeedback,
} from '../../activities/code_arrange/codeArrangeBuilder'

const TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    {
      id: 'l1',
      parts: [
        { type: 'text', text: 'score = ' },
        {
          type: 'slot',
          id: 's1',
          code: 'int',
          wrongTiles: [{ tileId: 's3', hint: 'That one updates a total.' }],
        },
        { type: 'text', text: '(code_text)' },
      ],
    },
    {
      id: 'l2',
      parts: [
        { type: 'text', text: 'print(f"Welcome back, ' },
        { type: 'slot', id: 's2', code: '{pet}' },
        { type: 'text', text: '!")' },
      ],
    },
    { id: 'l3', parts: [{ type: 'slot', id: 's3', code: 'total += 1' }] },
    { id: 'l4', parts: [{ type: 'slot', id: 's4', code: 'a = 1', alsoAccepts: ['s5', 'd2'] }] },
    { id: 'l5', parts: [{ type: 'slot', id: 's5', code: 'b = 2', alsoAccepts: ['s4'] }] },
  ],
  distractors: [
    { id: 'd1', code: '{"pet"}', hint: 'Quote marks mean use exactly this text.' },
    { id: 'd2', code: 'c = 3' },
  ],
  check: { type: 'output', operator: 'contains', value: 'Welcome' },
}

describe('getTileFlag', () => {
  it('flags a distractor in any blank with its hint, or the default', () => {
    expect(getTileFlag(TASK, 's2', 'd1')).toEqual({
      hint: 'Quote marks mean use exactly this text.',
    })
    expect(getTileFlag(TASK, 's3', 'd2')).toEqual({ hint: DEFAULT_DISTRACTOR_TILE_HINT })
  })

  it("flags a blank's wrongTiles entry with that entry's hint", () => {
    expect(getTileFlag(TASK, 's1', 's3')).toEqual({ hint: 'That one updates a total.' })
  })

  it('never flags a blank’s own tile, an alsoAccepts tile, or an unlisted tile', () => {
    expect(getTileFlag(TASK, 's1', 's1')).toBeNull()
    expect(getTileFlag(TASK, 's4', 's5')).toBeNull()
    expect(getTileFlag(TASK, 's5', 's4')).toBeNull()
    // alsoAccepts beats a distractor too.
    expect(getTileFlag(TASK, 's4', 'd2')).toBeNull()
    // Another blank's tile that isn't listed: run decides.
    expect(getTileFlag(TASK, 's2', 's1')).toBeNull()
    expect(getTileFlag(TASK, 's3', 's1')).toBeNull()
  })

  it('falls back to a default hint for a wrongTiles entry without one', () => {
    const task = structuredClone(TASK)
    task.lines[0].parts[1].wrongTiles = [{ tileId: 's2' }]
    expect(getTileFlag(task, 's1', 's2')).toEqual({ hint: DEFAULT_WRONG_TILE_HINT })
  })

  it('flags nothing on a task that authors none of the new fields (existing lessons)', () => {
    const plain = structuredClone(TASK)
    for (const line of plain.lines) {
      for (const part of line.parts) {
        delete part.wrongTiles
        delete part.alsoAccepts
      }
    }
    plain.distractors = plain.distractors.map(({ hint: _hint, ...d }) => d)
    expect(usesTileFeedback(plain)).toBe(false)
    expect(getTileFlag(plain, 's1', 's3')).toBeNull()
    expect(getTileFlag(plain, 's2', 'd1')).toBeNull()
    expect(getTileFlags(plain, { s2: 'd1', s1: 'd2' })).toEqual({})
    // One authored field opts the task in: every distractor is then flagged.
    plain.distractors[0].hint = 'Quotes!'
    expect(usesTileFeedback(plain)).toBe(true)
    expect(getTileFlag(plain, 's1', 'd2')).toEqual({ hint: DEFAULT_DISTRACTOR_TILE_HINT })
  })
})

describe('getTileFlags / getNewTileMisses', () => {
  it('maps every flagged blank of an arrangement and ignores unknown tiles', () => {
    expect(getTileFlags(TASK, { s1: 's3', s2: 'd1', s3: 's1', s4: 'ghost' })).toEqual({
      s1: { tileId: 's3', hint: 'That one updates a total.' },
      s2: { tileId: 'd1', hint: 'Quote marks mean use exactly this text.' },
    })
  })

  it('reports only the flagged placements a drop newly makes', () => {
    const prev = { s2: 'd1' }
    expect(getNewTileMisses(TASK, prev, { s2: 'd1', s1: 's3' })).toEqual([
      { slotId: 's1', tileId: 's3' },
    ])
    expect(getNewTileMisses(TASK, prev, { s2: 'd1', s3: 's1' })).toEqual([])
    expect(getNewTileMisses(TASK, {}, { s1: 's1' })).toEqual([])
  })

  it('never flags an indent task', () => {
    expect(getTileFlags({ arrangeMode: 'indent', lines: [] }, { a: 1 })).toEqual({})
  })
})

describe('getAttemptPlacements', () => {
  it('keeps the real placements, or null for an empty board or an indent task', () => {
    expect(getAttemptPlacements(TASK, { s1: 's1', s2: 'd1', zz: 's1' })).toEqual({
      s1: 's1',
      s2: 'd1',
    })
    expect(getAttemptPlacements(TASK, {})).toBeNull()
    expect(getAttemptPlacements({ arrangeMode: 'indent', lines: [] }, {})).toBeNull()
  })
})

describe('Builder: setSlotTileFeedback', () => {
  const slot = { type: 'slot', id: 's1', code: 'int' }

  it('keeps a tile in at most one list and drops empty lists', () => {
    const wrong = setSlotTileFeedback(slot, 's3', { kind: 'wrong', hint: 'Not that one.' })
    expect(wrong.wrongTiles).toEqual([{ tileId: 's3', hint: 'Not that one.' }])
    expect(getSlotTileFeedback(wrong, 's3')).toEqual({ kind: 'wrong', hint: 'Not that one.' })

    const accepted = setSlotTileFeedback(wrong, 's3', { kind: 'accept' })
    expect(accepted).not.toHaveProperty('wrongTiles')
    expect(accepted.alsoAccepts).toEqual(['s3'])

    const cleared = setSlotTileFeedback(accepted, 's3', { kind: 'none' })
    expect(cleared).toEqual(slot)
  })

  it('edits a hint in place without reordering the list', () => {
    let next = setSlotTileFeedback(slot, 'a', { kind: 'wrong', hint: 'A' })
    next = setSlotTileFeedback(next, 'b', { kind: 'wrong', hint: 'B' })
    next = setSlotTileFeedback(next, 'a', { kind: 'wrong', hint: 'A2' })
    expect(next.wrongTiles).toEqual([
      { tileId: 'a', hint: 'A2' },
      { tileId: 'b', hint: 'B' },
    ])
  })
})

describe('validateCodeArrangeTask: tile feedback fields', () => {
  function validate(task) {
    const errors = []
    const warnings = []
    validateCodeArrangeTask(task, { n: 1, moduleType: 'python', errors, warnings })
    return { errors, warnings }
  }

  it('accepts the example task with no tile-feedback warnings', () => {
    const { errors, warnings } = validate(TASK)
    expect(errors).toEqual([])
    expect(warnings.filter((w) => /wrongTiles|alsoAccepts/.test(w))).toEqual([])
  })

  it('warns when a listed tile id is not in the pool', () => {
    const task = structuredClone(TASK)
    task.lines[0].parts[1].wrongTiles = [{ tileId: 'nope', hint: 'x' }]
    task.lines[1].parts[1].alsoAccepts = ['missing']
    const { errors, warnings } = validate(task)
    expect(errors).toEqual([])
    expect(warnings).toContain(
      'Task 1 line 1 blank 2 wrongTiles lists "nope", which is not a blank or distractor id in this task'
    )
    expect(warnings).toContain(
      'Task 1 line 2 blank 2 alsoAccepts lists "missing", which is not a blank or distractor id in this task'
    )
  })

  it('warns when a tile is in both lists for the same blank', () => {
    const task = structuredClone(TASK)
    task.lines[0].parts[1].alsoAccepts = ['s3']
    const { warnings } = validate(task)
    expect(warnings.some((w) => /both wrongTiles and alsoAccepts/.test(w))).toBe(true)
  })

  it('fails malformed lists and hints', () => {
    const task = structuredClone(TASK)
    task.lines[0].parts[1].wrongTiles = 's3'
    task.lines[1].parts[1].alsoAccepts = [3]
    task.distractors[0].hint = 5
    const { errors } = validate(task)
    expect(errors).toEqual(
      expect.arrayContaining([
        'Task 1 distractor 1 hint must be text',
        'Task 1 line 1 blank 2 wrongTiles must be a list of { tileId, hint }',
        'Task 1 line 2 blank 2 alsoAccepts entry 1 is not a tile id',
      ])
    )
  })
})
