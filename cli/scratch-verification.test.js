import { describe, expect, it } from 'vitest'
import { getStageVerifiableTasks, testLessonChecks, testStageChecks } from './check-tests.mjs'
import { validateLessonForMcp } from './validate.mjs'
import { validateLesson } from '../src/builder/lessonUtils.js'

// Per-check Scratch verification (`lessons test-checks` with no --cases, and the
// `lessons validate` block-check warnings). Only static block checks are evaluated.

const stack = (...opcodes) =>
  opcodes.reduceRight((next, opcode) => {
    const block = typeof opcode === 'string' ? { type: opcode } : { ...opcode }
    if (next) block.next = { block: next }
    return block
  }, null)

const move = (steps) => ({
  type: 'motion_movesteps',
  inputs: { STEPS: { shadow: { type: 'math_number', fields: { NUM: String(steps) } } } },
})

const blocksFor = (...stacks) => ({ sprite1: { blocks: { blocks: stacks } } })

function scratchTask(overrides = {}) {
  return {
    id: 7,
    title: 'Move the rocket',
    sprites: [{ id: 'sprite1', name: 'Rocket' }],
    starterBlocks: blocksFor(stack('event_whenflagclicked', 'motion_turnright')),
    completeBlocks: blocksFor(stack('event_whenflagclicked', move(20))),
    check: [
      {
        type: 'blocks_in_order',
        sequence: [
          'event_whenflagclicked',
          { opcode: 'motion_movesteps', fieldValues: { STEPS: '20' } },
        ],
      },
      { type: 'block_used', opcode: 'motion_movesteps', spriteName: 'Rocket' },
      { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 5 },
    ],
    feedbackChecks: [
      { type: 'block_used', opcode: 'motion_turnright', hint: 'Remove the turn block.' },
    ],
    ...overrides,
  }
}

function scratchLesson(tasks) {
  return {
    id: 'scratch-verify',
    type: 'scratch',
    title: 'Scratch verify',
    description: 'Checks against stages.',
    tasks,
  }
}

const stage = (task, name) => task.stages.find((entry) => entry.stage === name)

describe('lessons test-checks: Scratch mode', () => {
  it('reports each check per stage, skipping run-time checks', () => {
    const result = testStageChecks(scratchLesson([scratchTask()]))
    expect(result.success).toBe(true)
    expect(result.mode).toBe('stages')
    expect(result.warnings).toEqual([])
    expect(result.summary).toEqual({
      tasks: 1,
      stagesChecked: 2,
      failed: 0,
      skippedRuntimeChecks: 1,
    })

    const [task] = result.tasks
    expect(task).toMatchObject({ taskId: 7, title: 'Move the rocket' })
    expect(task.stages.map((entry) => entry.stage)).toEqual(['complete', 'starter'])

    const complete = stage(task, 'complete')
    expect(complete.completion.result).toBe('incomplete')
    expect(complete.completion.checks).toEqual([
      { index: 1, type: 'blocks_in_order', result: 'pass', sprite: 'Rocket' },
      {
        index: 2,
        type: 'block_used',
        opcode: 'motion_movesteps',
        spriteName: 'Rocket',
        result: 'pass',
        sprite: 'Rocket',
      },
      expect.objectContaining({ index: 3, type: 'sprite_property', result: 'skipped' }),
    ])
    expect(complete.feedback).toEqual([
      expect.objectContaining({ index: 1, mode: 'blocking', result: 'silent' }),
    ])

    const starter = stage(task, 'starter')
    expect(starter.completion.result).toBe('fail')
    expect(starter.completion.checks[0]).toMatchObject({
      result: 'fail',
      sprite: 'any',
      actual: [['event_whenflagclicked', 'motion_turnright']],
      reason: 'no script has these blocks joined in this order',
    })
    expect(starter.completion.checks[1]).toMatchObject({
      result: 'fail',
      actual: 0,
      reason: 'no motion_movesteps block',
    })
    expect(starter.feedback[0].result).toBe('fires')
  })

  it('warns when a Complete stage fails a check, says why, and reports the fields', () => {
    const task = scratchTask({
      completeBlocks: blocksFor(stack('event_whenflagclicked', move(10))),
    })
    const result = testStageChecks(scratchLesson([task]))
    expect(result.success).toBe(false)
    expect(result.warnings).toEqual([
      'Task 7 complete stage fails completion check 1 (blocks_in_order)',
    ])
    expect(result.summary.failed).toBe(1)
    expect(stage(result.tasks[0], 'complete').completion.checks[0]).toMatchObject({
      result: 'fail',
      reason: "the blocks are in this order but a fieldValues condition doesn't match",
    })
  })

  it('checks every Complete-role code stage, including legacy solution stages', () => {
    const task = scratchTask({
      completeBlocks: undefined,
      codeStages: [
        { label: 'Hint', role: 'support', blocks: blocksFor(stack('event_whenflagclicked')) },
        {
          label: 'Model answer',
          role: 'solution',
          blocks: JSON.stringify(blocksFor(stack('event_whenflagclicked', move(20)))),
        },
      ],
    })
    const result = testStageChecks(scratchLesson([task]))
    expect(result.tasks[0].stages.map((entry) => entry.stage)).toEqual([
      'starter',
      'complete:Model answer',
    ])
    expect(stage(result.tasks[0], 'complete:Model answer').completion.result).toBe('incomplete')
  })

  it('uses the first Starter stage as the starter', () => {
    const task = scratchTask({
      codeStages: [
        {
          label: 'Start here',
          role: 'starter',
          blocks: blocksFor(stack('event_whenflagclicked', move(20))),
        },
      ],
      check: [{ type: 'block_used', opcode: 'motion_movesteps' }],
    })
    const result = testStageChecks(scratchLesson([task]))
    expect(stage(result.tasks[0], 'starter').completion.result).toBe('pass')
    expect(result.warnings).toContain('Task 7 starter already passes every completion check')
  })

  it('warns when a feedback check fires on the Complete stage', () => {
    const task = scratchTask({
      feedbackChecks: [{ type: 'block_used', opcode: 'event_whenflagclicked', mode: 'nudge' }],
    })
    const result = testStageChecks(scratchLesson([task]))
    expect(result.warnings).toEqual([
      'Task 7 feedback check 1 (block_used) fires on the complete stage',
    ])
  })

  it('warns when a Debug task has no blocking feedback check firing on the starter', () => {
    const debugTask = scratchTask({
      taskActivity: 'Code Task, Debug Code Task',
      feedbackChecks: [{ type: 'block_used', opcode: 'looks_say', hint: 'Not this one.' }],
    })
    expect(testStageChecks(scratchLesson([debugTask])).warnings).toEqual([
      'Task 7 is a Debug task but none of its blocking feedback checks fires on the starter',
    ])
    // The default fixture's blocking check (the turn block) does fire on its starter.
    const fires = scratchTask({ taskActivity: 'Code Task, Debug Code Task' })
    expect(testStageChecks(scratchLesson([fires])).warnings).toEqual([])
  })

  it('reports a missing spriteName and falls back to the first sprite, as the workspace does', () => {
    const task = scratchTask({
      check: [{ type: 'block_used', opcode: 'motion_movesteps', spriteName: 'Bird' }],
    })
    const complete = stage(testStageChecks(scratchLesson([task])).tasks[0], 'complete')
    expect(complete.completion.checks[0]).toMatchObject({
      result: 'pass',
      sprite: 'Rocket',
      reason: 'no sprite is named "Bird", so the first sprite was checked',
    })
  })

  it('picks Scratch tasks by each task’s own module in a composed lesson', () => {
    const lesson = {
      ...scratchLesson([
        { id: 1, title: 'Python', moduleType: 'python', starterCode: 'x = 1' },
        { ...scratchTask(), moduleType: 'scratch' },
        { id: 9, title: 'Read me', taskType: 'information', explainer: 'Hi' },
      ]),
      type: 'composed',
    }
    expect(getStageVerifiableTasks(lesson).map((task) => task.id)).toEqual([7])
    expect(testStageChecks(lesson).tasks.map((task) => task.taskId)).toEqual([7])
    expect(getStageVerifiableTasks({ ...lesson, tasks: lesson.tasks.slice(0, 1) })).toEqual([])
  })

  it('limits to one task, and rejects lessons with no Scratch tasks', () => {
    const lesson = scratchLesson([scratchTask(), scratchTask({ id: 8, title: 'Again' })])
    expect(testStageChecks(lesson, { taskId: '8' }).tasks.map((t) => t.taskId)).toEqual([8])
    expect(() => testStageChecks(lesson, { taskId: 99 })).toThrow('Scratch task 99 was not found')
    expect(() => testStageChecks({ ...lesson, type: 'python' })).toThrow(
      'The lesson has no Scratch tasks'
    )
  })

  it('reports unparseable stage blocks instead of throwing', () => {
    const result = testStageChecks(scratchLesson([scratchTask({ completeBlocks: '{bad' })]))
    expect(stage(result.tasks[0], 'complete')).toEqual({
      stage: 'complete',
      error: 'blocks are not valid JSON',
    })
    expect(result.warnings[0]).toMatch(/^Task 7 complete blocks are not valid JSON/)
  })

  it('leaves the source-code cases mode unchanged', () => {
    const python = {
      id: 'py',
      type: 'python',
      title: 'Py',
      description: 'Py',
      tasks: [{ id: 1, title: 'Say', check: { type: 'code', operator: 'contains', value: 'x' } }],
    }
    const result = testLessonChecks(python, {
      tasks: [{ id: 1, cases: [{ name: 'has x', code: 'x = 1', completion: 'pass' }] }],
    })
    expect(result.success).toBe(true)
    expect(result.mode).toBe('cases')
  })
})

describe('lessons validate: Scratch block-check warnings', () => {
  const failMessage = 'Task 1 complete solution fails a block check — review the complete blocks'
  const starterMessage =
    'Task 1 starter already passes every completion check — students can finish without changing anything'

  it('warns when the Complete blocks fail a static check, in the CLI and the Builder', () => {
    const lesson = scratchLesson([
      scratchTask({ id: 1, completeBlocks: blocksFor(stack('event_whenflagclicked', move(10))) }),
    ])
    expect(validateLessonForMcp(lesson).warnings).toContain(failMessage)
    expect(validateLesson(lesson).warnings).toContain(failMessage)
  })

  it('warns when a Complete-role code stage fails a static check', () => {
    const lesson = scratchLesson([
      scratchTask({
        id: 1,
        codeStages: [
          {
            label: 'Answer',
            role: 'complete',
            blocks: blocksFor(stack('event_whenflagclicked')),
          },
        ],
      }),
    ])
    expect(validateLessonForMcp(lesson).warnings).toContain(failMessage)
  })

  it('stays quiet when the Complete blocks pass every static check', () => {
    const { warnings } = validateLessonForMcp(scratchLesson([scratchTask({ id: 1 })]))
    expect(warnings).not.toContain(failMessage)
    expect(warnings).not.toContain(starterMessage)
  })

  it('warns when the starter already passes a completion made of block checks only', () => {
    const lesson = scratchLesson([
      scratchTask({ id: 1, check: { type: 'block_used', opcode: 'motion_turnright' } }),
    ])
    expect(validateLessonForMcp(lesson).warnings).toContain(starterMessage)
    expect(validateLesson(lesson).warnings).toContain(starterMessage)
  })

  it('does not judge run-time checks, or a starter whose completion needs a Run', () => {
    const lesson = scratchLesson([
      scratchTask({
        id: 1,
        completeBlocks: blocksFor(stack('event_whenflagclicked')),
        check: [
          { type: 'block_used', opcode: 'motion_turnright' },
          { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 5 },
        ],
      }),
    ])
    const { warnings } = validateLessonForMcp(lesson)
    // The complete stage has no turn block, so the static check fails there...
    expect(warnings).toContain(failMessage)
    // ...but the starter can't "already pass" while a run-time check is still undecided.
    expect(warnings).not.toContain(starterMessage)
  })
})
