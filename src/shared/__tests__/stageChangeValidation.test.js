import { describe, expect, it } from 'vitest'
import { validateStageChange } from '../stageChangeValidation.js'
import { validateLesson } from '../../builder/lessonUtils.js'

function run(task, options = { changeView: true }) {
  const errors = []
  const warnings = []
  validateStageChange(task, 1, errors, warnings, options)
  return { errors, warnings }
}

const starter = { label: 'Starter', role: 'starter', code: 'size = 100\nsize -= step' }

describe('validateStageChange', () => {
  it('accepts show: change on a Complete stage and full anywhere', () => {
    const result = run({
      codeStages: [
        { ...starter, show: 'full' },
        { label: 'Complete', role: 'complete', code: 'x', show: 'change' },
      ],
    })
    expect(result).toEqual({ errors: [], warnings: [] })
  })

  it('rejects an unknown show value', () => {
    expect(run({ codeStages: [{ ...starter, show: 'diff' }] }).errors).toEqual([
      'Task 1 stage 1 show must be "full" or "change"',
    ])
  })

  it('accepts show: change on a Support stage', () => {
    const result = run({
      codeStages: [{ label: 'Hint', role: 'support', code: 'x', show: 'change' }],
    })
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('warns that show: change on a Starter stage is ignored', () => {
    expect(run({ codeStages: [{ ...starter, show: 'change' }] }).warnings).toEqual([
      'Task 1 stage 1 show: "change" works on a Complete or Support stage only; this stage shows in full',
    ])
  })

  it('warns outside Python', () => {
    const task = {
      codeStages: [{ label: 'Complete', role: 'complete', code: 'x', show: 'change' }],
    }
    expect(run(task, { changeView: false }).warnings).toEqual([
      'Task 1 stage 1 show: "change" works in Python lessons only; it is ignored here',
    ])
  })

  it('accepts copyAfter naming a starter line', () => {
    expect(
      run({ codeStages: [starter], copyCode: 'turn += 10', copyAfter: '  size -= step' })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('flags both anchors, an empty anchor and an anchor with no copyCode', () => {
    expect(
      run({
        codeStages: [starter],
        copyCode: 'x',
        copyAfter: 'size = 100',
        copyBefore: 'size -= step',
      }).errors
    ).toEqual(['Task 1 has both copyAfter and copyBefore; use one'])
    expect(run({ codeStages: [starter], copyCode: 'x', copyAfter: 42 }).errors).toEqual([
      'Task 1 copyAfter must be the text of one line of code',
    ])
    expect(run({ codeStages: [starter], copyBefore: 'size = 100' }).warnings).toEqual([
      'Task 1 copyBefore has no copyCode to place; it is ignored',
    ])
  })

  it('an empty place line is unset, as the export drops it (the Builder mode with no text yet)', () => {
    expect(run({ codeStages: [starter], copyCode: 'x', copyAfter: '' })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(run({ codeStages: [starter], copyCode: 'x', copyBefore: '   ' })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('reports copyAfter and copyBefore problems both, not only the first', () => {
    expect(
      run({ codeStages: [starter], copyAfter: 'size = 100', copyBefore: 'size -= step' })
    ).toEqual({
      errors: [],
      warnings: [
        'Task 1 copyAfter has no copyCode to place; it is ignored',
        'Task 1 copyBefore has no copyCode to place; it is ignored',
      ],
    })
    expect(
      run({ codeStages: [starter], copyCode: 'x', copyAfter: 5, copyBefore: 6 }).errors
    ).toEqual([
      'Task 1 copyAfter must be the text of one line of code',
      'Task 1 copyBefore must be the text of one line of code',
      'Task 1 has both copyAfter and copyBefore; use one',
    ])
  })

  it('an ignored place line (no copyCode) only warns, never also errors', () => {
    expect(run({ codeStages: [starter], copyAfter: 7 })).toEqual({
      errors: [],
      warnings: ['Task 1 copyAfter has no copyCode to place; it is ignored'],
    })
  })

  it('warns when the anchor is not a starter line, unless the task carries code', () => {
    const task = { codeStages: [starter], copyCode: 'x', copyAfter: 'speed(0)' }
    expect(run(task).warnings).toEqual([
      'Task 1 copyAfter "speed(0)" is not a line of the starter code, so students may not find it',
    ])
    expect(run({ ...task, carryCodeFrom: 'task-1' }).warnings).toEqual([])
  })
})

describe('validateLesson with the change view fields', () => {
  it('runs through the Python module', () => {
    const lesson = {
      title: 'L',
      type: 'python',
      tasks: [
        {
          id: 't1',
          title: 'T',
          explainer: 'Do it',
          check: { type: 'output_contains', value: 'x' },
          codeStages: [starter, { label: 'Complete', role: 'complete', code: 'x', show: 'wrong' }],
        },
      ],
    }
    expect(validateLesson(lesson).errors).toContain(
      'Task 1 stage 2 show must be "full" or "change"'
    )
  })
})
