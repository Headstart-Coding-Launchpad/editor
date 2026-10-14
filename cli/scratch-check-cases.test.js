// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { testLessonChecks } from './check-tests.mjs'

// `lessons test-checks --cases` for Scratch tasks: student variations given as blocks, or as a
// stage plus edits, judged per check (src/modules/scratch/checkCases.js).

const stack = (...opcodes) =>
  opcodes.reduceRight((next, opcode) => {
    const block = typeof opcode === 'string' ? { type: opcode } : { ...opcode }
    if (next) block.next = { block: next }
    return block
  }, null)

const blocksFor = (...stacks) => ({ sprite1: { blocks: { blocks: stacks } } })

function soundTask(overrides = {}) {
  return {
    id: 7,
    title: 'Play the sound',
    sprites: [{ id: 'sprite1', name: 'Cat' }],
    starterBlocks: blocksFor(stack('event_whenflagclicked')),
    completeBlocks: blocksFor(stack('event_whenflagclicked', 'sound_playuntildone')),
    codeStages: [
      {
        label: 'Hint',
        role: 'support',
        blocks: blocksFor(stack('event_whenflagclicked', 'sound_play')),
      },
    ],
    check: [
      {
        type: 'blocks_in_order',
        evaluation: 'after_block_placed',
        sequence: ['event_whenflagclicked', 'sound_playuntildone'],
      },
    ],
    feedbackChecks: [
      { type: 'block_used', opcode: 'sound_play', hint: 'Use play sound until done.' },
      {
        type: 'block_used',
        opcode: 'motion_movesteps',
        mode: 'nudge',
        hint: 'No moving needed.',
      },
    ],
    ...overrides,
  }
}

const lesson = (task = soundTask()) => ({
  id: 'scratch-cases',
  type: 'scratch',
  title: 'Scratch cases',
  description: 'Cases.',
  tasks: [task],
})

const run = (cases, task) => testLessonChecks(lesson(task), { cases })

describe('lessons test-checks --cases: Scratch tasks', () => {
  it('judges a stage plus edits against completion, blocking and feedback expectations', () => {
    const result = run([
      {
        task: 7,
        name: 'start sound instead',
        stage: 'complete',
        edits: [{ op: 'replaceOpcode', target: 'sound_playuntildone', opcode: 'sound_play' }],
        expect: { completion: 'fail', blocking: 'fail', feedback: ['play sound until done'] },
      },
    ])
    expect(result.success).toBe(true)
    const [testCase] = result.cases
    expect(testCase.source).toEqual({ stage: 'complete', edits: 1 })
    expect(testCase.actual.completion).toBe('fail')
    expect(testCase.actual.blocking).toBe('fail')
    expect(testCase.actual.feedback.map((c) => [c.result, c.expected])).toEqual([
      ['fires', 'fires'],
      ['silent', 'silent'],
    ])
    expect(testCase.matchedFeedback.map((c) => c.index)).toEqual([1])
    expect(testCase.mismatches).toEqual([])
  })

  it('flags mismatches, including a feedback check that fires unexpectedly', () => {
    const result = run([
      {
        task: 7,
        name: 'extra move appended',
        stage: 'complete',
        edits: [{ op: 'appendBlock', opcode: 'motion_movesteps', inputs: { STEPS: 10 } }],
        expect: { completion: 'fail', feedback: [] },
      },
    ])
    expect(result.success).toBe(false)
    expect(result.summary).toMatchObject({ total: 1, failed: 1, passed: 0 })
    expect(result.cases[0].mismatches).toEqual([
      'completion: expected fail, got pass',
      'feedback check 2 (block_used): expected it to stay silent, but it fires',
    ])
    expect(result.cases[0].actual.feedback[1].mismatch).toBe(true)
  })

  it('takes whole blocks, a role as the stage, and the tasks-list format', () => {
    const result = testLessonChecks(lesson(), {
      tasks: [
        {
          id: 7,
          cases: [
            {
              name: 'whole blocks',
              blocks: blocksFor(stack('event_whenflagclicked', 'sound_playuntildone')),
              expect: { completion: 'pass', blocking: 'pass', feedback: [] },
            },
            {
              name: 'Support resubmitted',
              stage: 'support',
              completion: 'fail',
            },
          ],
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.cases[0].source).toEqual({ blocks: true })
    expect(result.cases[1].source).toEqual({ stage: 'support:Hint' })
    expect(result.cases[1].actual.blocking).toBe('fail')
  })

  it('reports whether the variant counts as still building', () => {
    const result = run([
      { task: 7, name: 'untouched starter', stage: 'starter', expect: { completion: 'fail' } },
      {
        task: 7,
        name: 'loose block',
        stage: 'starter',
        edits: [{ op: 'appendBlock', opcode: 'sound_playuntildone', newScript: true }],
        expect: { completion: 'fail' },
      },
      {
        task: 7,
        name: 'attached wrong block',
        stage: 'starter',
        edits: [{ op: 'appendBlock', opcode: 'looks_say' }],
        expect: { completion: 'fail' },
      },
    ])
    expect(result.cases.map((c) => c.stillBuilding)).toEqual([
      { value: true, reason: 'the blocks are the same as the starter', failsHeldBack: true },
      { value: true, reason: 'a block is loose on the canvas', failsHeldBack: true },
      { value: false, failsHeldBack: false },
    ])
  })

  it('does not compare a completion that needs a run', () => {
    const task = soundTask({
      check: [
        { type: 'block_used', opcode: 'sound_playuntildone' },
        { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 5 },
      ],
    })
    const result = run(
      [{ task: 7, name: 'complete', stage: 'complete', expect: { completion: 'fail' } }],
      task
    )
    expect(result.success).toBe(true)
    expect(result.cases[0].actual.completion).toBe('incomplete')
    expect(result.cases[0].unconfirmed).toEqual([
      'completion: the block checks pass but run-time checks were skipped',
    ])
    expect(result.summary).toMatchObject({ skipped: 1, skippedRuntimeChecks: 1 })
  })

  it('throws clear errors for malformed cases', () => {
    expect(() =>
      run([{ task: 7, name: 'both', stage: 'complete', blocks: {}, completion: 'pass' }])
    ).toThrow('Task 7 case "both" must give either blocks or a stage (with optional edits)')
    expect(() => run([{ task: 7, name: 'code', code: 'x', completion: 'pass' }])).toThrow(
      'Scratch cases give blocks or a stage, not code'
    )
    expect(() =>
      run([{ task: 7, name: 'stage', stage: 'complete:Nope', completion: 'pass' }])
    ).toThrow('stage "complete:Nope" was not found (stages: complete, starter, support:Hint)')
    expect(() =>
      run([
        {
          task: 7,
          name: 'edit',
          stage: 'complete',
          edits: [{ op: 'removeBlock', target: 'looks_say' }],
          completion: 'pass',
        },
      ])
    ).toThrow('Task 7 case "edit" edit 1 (removeBlock): no looks_say block')
    expect(() =>
      run([
        { task: 7, name: 'fb', stage: 'complete', expect: { completion: 'pass', feedback: [9] } },
      ])
    ).toThrow('the task has no feedback check 9')
    expect(() =>
      run([
        {
          task: 7,
          name: 'fb',
          stage: 'complete',
          expect: { completion: 'pass', feedback: ['zzz'] },
        },
      ])
    ).toThrow('"zzz" matches no feedback check id or hint')
    expect(() => run([{ task: 7, name: 'no expect', stage: 'complete' }])).toThrow(
      'expect.completion must be "pass" or "fail"'
    )
    expect(() => run([{ name: 'no task', stage: 'complete' }])).toThrow(
      'Check case 1 in cases must name its task'
    )
  })
})
