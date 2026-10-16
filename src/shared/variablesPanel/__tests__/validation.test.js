// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  validateShowVariables,
  validateTypesPredictedCheck,
  validateVariablesPredictedCheck,
} from '../validation.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

function run(task) {
  const errors = []
  const warnings = []
  validateShowVariables(task, 1, errors, warnings)
  return { errors, warnings }
}

describe('validateShowVariables', () => {
  it('accepts the three modes as documented', () => {
    expect(run({ showVariables: { mode: 'view', at: 'end', hide: ['x'] } })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(
      run({
        showVariables: { mode: 'predict', predict: ['score', 'lives'] },
        check: [{ type: 'variables_predicted', names: ['score'] }],
      })
    ).toEqual({ errors: [], warnings: [] })
    expect(run({ showVariables: { mode: 'target', target: { score: 10 } } }).errors).toEqual([])
  })

  it('rejects bad shapes', () => {
    expect(run({ showVariables: 'yes' }).errors).toEqual([
      'Task 1 has a showVariables that is not an object — use { mode, at, … }',
    ])
    expect(run({ showVariables: { mode: 'guess' } }).errors[0]).toContain('mode "guess"')
    expect(run({ showVariables: { at: 'start' } }).errors[0]).toContain('at "start"')
    expect(run({ showVariables: { hide: 'x' } }).errors[0]).toContain('hide that is not a list')
    expect(run({ showVariables: { hide: ['my score'] } }).errors[0]).toContain('my score')
    expect(run({ showVariables: { mode: 'predict' } }).errors[0]).toContain(
      'no predict or predictType list'
    )
    expect(run({ showVariables: { mode: 'target' } }).errors[0]).toContain('no target values')
    expect(run({ showVariables: { mode: 'target', target: { '1x': 2 } } }).errors[0]).toContain(
      '1x'
    )
  })

  it('checks visuals and stageLists', () => {
    expect(run({ showVariables: { visuals: false } })).toEqual({ errors: [], warnings: [] })
    expect(run({ showVariables: { stageLists: 'picture' } })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(run({ showVariables: { visuals: 'yes' } }).errors).toEqual([
      'Task 1 has showVariables visuals that is not true or false',
    ])
    expect(run({ showVariables: { stageLists: 'big' } }).errors).toEqual([
      'Task 1 has showVariables stageLists "big" — use one of: picture, tiles, size',
    ])
    expect(run({ showVariables: { visuals: false, stageLists: 'tiles' } }).warnings).toEqual([
      'Task 1 has showVariables stageLists but visuals is false — every tag is plain, so it is ignored',
    ])
  })

  it('warns about unused lists and a marker with no #@peek line', () => {
    expect(
      run({ showVariables: { mode: 'view', predict: ['a'], target: { a: 1 } } }).warnings
    ).toHaveLength(2)
    expect(run({ showVariables: { at: 'marker' }, starterCode: 'x = 1' }).warnings[0]).toContain(
      '#@peek'
    )
    expect(
      run({
        showVariables: { at: 'marker' },
        codeStages: [{ role: 'starter', code: 'x = 1\n  #@peek\ny = 2' }],
      }).warnings
    ).toEqual([])
  })

  it('ties a variables_predicted check to predict mode and its names', () => {
    expect(run({ check: { type: 'variables_predicted' } }).errors[0]).toContain(
      'no showVariables with mode: predict'
    )
    expect(
      run({ showVariables: { mode: 'view' }, check: [{ type: 'variables_predicted' }] }).errors[0]
    ).toContain('mode is not predict')
    expect(
      run({
        showVariables: { mode: 'predict', predict: ['a'] },
        check: [{ type: 'variables_predicted', names: ['a', 'b'] }],
      }).errors[0]
    ).toContain('naming b')
  })
})

describe('validateShowVariables lockRun (P6-18)', () => {
  it('accepts true or false in predict mode', () => {
    expect(run({ showVariables: { mode: 'predict', predict: ['a'], lockRun: false } })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('rejects a value that is not true or false, and warns outside predict mode', () => {
    expect(
      run({ showVariables: { mode: 'predict', predict: ['a'], lockRun: 'no' } }).errors
    ).toEqual(['Task 1 has showVariables lockRun that is not true or false'])
    expect(run({ showVariables: { mode: 'view', lockRun: true } }).warnings).toEqual([
      'Task 1 has showVariables lockRun but its mode is not predict — only predict mode locks Run, so it is ignored',
    ])
  })
})

describe('validateVariablesPredictedCheck', () => {
  it('only allows modules with the panel, and Python names', () => {
    const python = getModuleDefinition('python')
    const turtle = getModuleDefinition('turtle')
    const html = getModuleDefinition('html')
    const check = { type: 'variables_predicted', names: ['a'] }
    expect(validateVariablesPredictedCheck(check, { n: 2, moduleDefinition: python })).toEqual([])
    expect(validateVariablesPredictedCheck(check, { n: 2, moduleDefinition: turtle })).toEqual([])
    expect(validateVariablesPredictedCheck(check, { n: 2, moduleDefinition: html })[0]).toContain(
      'only works in Python and Turtle'
    )
    expect(
      validateVariablesPredictedCheck({ type: 'variables_predicted', names: [] }, { n: 2 })[0]
    ).toContain('whose names is not a list')
    expect(
      validateVariablesPredictedCheck({ type: 'variables_predicted', names: ['a b'] }, { n: 2 })[0]
    ).toContain('not Python variable names')
  })
})

describe('validateShowVariables typed answers and predictType (P6-27)', () => {
  it('accepts plain names, answer kinds, choices and predictType', () => {
    expect(
      run({
        showVariables: {
          mode: 'predict',
          predict: [
            { name: 'door_open', answer: 'boolean' },
            { name: 'coins', answer: 'number' },
            { name: 'colour', choices: ['red', 'blue', 'green'] },
            'greeting',
          ],
          predictType: ['typed', { name: 'age', choices: ['text', 'number'] }],
        },
        check: [{ type: 'variables_predicted' }, { type: 'types_predicted', names: ['age'] }],
      })
    ).toEqual({ errors: [], warnings: [] })
    // predictType alone is enough for predict mode.
    expect(run({ showVariables: { mode: 'predict', predictType: ['age'] } }).errors).toEqual([])
  })

  it('rejects unknown answer kinds, bad choices and bad names', () => {
    expect(
      run({ showVariables: { mode: 'predict', predict: [{ name: 'a', answer: 'colour' }] } }).errors
    ).toEqual([
      'Task 1 has showVariables predict a with answer "colour" — use one of: text, number, boolean',
    ])
    expect(
      run({ showVariables: { mode: 'predict', predict: [{ name: 'a', choices: ['red'] }] } })
        .errors[0]
    ).toContain('choices that are not a list of at least two values')
    expect(
      run({
        showVariables: { mode: 'predict', predictType: [{ name: 'a', choices: ['text', 'word'] }] },
      }).errors[0]
    ).toContain('predictType a with choices that are not at least two of')
    expect(
      run({ showVariables: { mode: 'predict', predict: [{ name: 'my score' }] } }).errors[0]
    ).toContain('my score')
    expect(run({ showVariables: { mode: 'predict', predictType: 'age' } }).errors[0]).toContain(
      'predictType that is not a list'
    )
  })

  it('warns about answer with choices, a name in both lists, and predictType outside predict', () => {
    expect(
      run({
        showVariables: {
          mode: 'predict',
          predict: [{ name: 'a', answer: 'number', choices: [1, 2] }],
        },
      }).warnings[0]
    ).toContain('both answer and choices')
    expect(
      run({ showVariables: { mode: 'predict', predict: ['a'], predictType: ['a'] } }).warnings[0]
    ).toContain('predict and predictType both naming a')
    expect(run({ showVariables: { mode: 'view', predictType: ['a'] } }).warnings).toEqual([
      'Task 1 has showVariables predictType but mode is not predict — it is ignored',
    ])
  })

  it('ties a types_predicted check to predictType and its names', () => {
    expect(run({ check: { type: 'types_predicted' } }).errors[0]).toContain(
      'types_predicted check but no showVariables predictType list'
    )
    expect(
      run({
        showVariables: { mode: 'predict', predict: ['a'] },
        check: [{ type: 'types_predicted' }],
      }).errors[0]
    ).toContain('no showVariables predictType list')
    expect(
      run({
        showVariables: { mode: 'predict', predictType: ['a'] },
        check: [{ type: 'types_predicted', names: ['b'] }],
      }).errors[0]
    ).toContain('naming b, which showVariables predictType does not list')
    expect(
      run({
        showVariables: { mode: 'predict', predictType: ['a'] },
        check: [{ type: 'variables_predicted' }],
      }).errors[0]
    ).toContain('use types_predicted for predictType')
  })

  it('validates the types_predicted check shape like variables_predicted', () => {
    const html = getModuleDefinition('html')
    const python = getModuleDefinition('python')
    const check = { type: 'types_predicted', names: ['a'] }
    expect(validateTypesPredictedCheck(check, { n: 2, moduleDefinition: python })).toEqual([])
    expect(validateTypesPredictedCheck(check, { n: 2, moduleDefinition: html })).toEqual([
      'Task 2 has a types_predicted check, but it only works in Python and Turtle tasks',
    ])
    expect(validateTypesPredictedCheck({ names: [] }, { n: 2 })).toEqual([
      'Task 2 has a types_predicted check whose names is not a list of variable names',
    ])
  })
})

describe('validateShowVariables link (P6-19)', () => {
  it('accepts true or false and rejects anything else', () => {
    expect(run({ showVariables: { mode: 'view', link: false } })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(run({ showVariables: { mode: 'view', link: 'off' } }).errors).toEqual([
      'Task 1 has showVariables link that is not true or false',
    ])
  })
})
