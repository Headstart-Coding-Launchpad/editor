import { describe, expect, it } from 'vitest'
import {
  declaresPythonSlowMo,
  getPythonSlowMo,
  slowMoRecordOptions,
  slowMoThroughRun,
  validatePythonSlowMo,
} from '../config.js'
import pythonDefinition from '../../definition.js'
import turtleDefinition from '../../../turtle/definition.js'
import scratchDefinition from '../../../scratch/definition.js'

function validate(slowMo) {
  const errors = []
  const warnings = []
  validatePythonSlowMo({ slowMo }, 1, errors, warnings)
  return { errors, warnings }
}

describe('getPythonSlowMo', () => {
  it('is off unless enabled is true', () => {
    expect(getPythonSlowMo({})).toBeNull()
    expect(getPythonSlowMo({ slowMo: { speed: 2 } })).toBeNull()
    expect(getPythonSlowMo({ slowMo: { enabled: 'yes' } })).toBeNull()
  })

  it('fills in the defaults and clamps the speed', () => {
    expect(getPythonSlowMo({ slowMo: { enabled: true } })).toEqual({
      speed: 1,
      showVariables: false,
      question: null,
      separateButton: false,
    })
    expect(
      getPythonSlowMo({
        slowMo: { enabled: true, speed: 9, showVariables: true, question: '  What is total? ' },
      })
    ).toEqual({ speed: 4, showVariables: true, question: 'What is total?', separateButton: false })
    expect(getPythonSlowMo({ slowMo: { enabled: true, speed: 0.1 } }).speed).toBe(0.25)
  })
})

describe('slowMoThroughRun', () => {
  it('makes Run play in slow-mo by default, and not with separateButton', () => {
    expect(slowMoThroughRun(getPythonSlowMo({ slowMo: { enabled: true } }))).toBe(true)
    expect(
      slowMoThroughRun(getPythonSlowMo({ slowMo: { enabled: true, separateButton: true } }))
    ).toBe(false)
    expect(
      slowMoThroughRun(getPythonSlowMo({ slowMo: { enabled: true, separateButton: 'yes' } }))
    ).toBe(true)
  })

  it('is off when slow-mo is off', () => {
    expect(slowMoThroughRun(getPythonSlowMo({}))).toBe(false)
    expect(slowMoThroughRun(getPythonSlowMo({ slowMo: { separateButton: false } }))).toBe(false)
  })
})

describe('slowMoRecordOptions', () => {
  it('passes the line offset and the name-tag panel hidden names', () => {
    expect(
      slowMoRecordOptions({ showVariables: { hide: ['secret', 3] } }, { lineOffset: 2 })
    ).toEqual({ lineOffset: 2, hide: ['secret'] })
    expect(slowMoRecordOptions({})).toEqual({ lineOffset: 0, hide: [] })
  })
})

describe('validatePythonSlowMo', () => {
  it('accepts a full field', () => {
    expect(
      validate({ enabled: true, speed: 1.5, showVariables: true, question: 'What is total?' })
    ).toEqual({ errors: [], warnings: [] })
    expect(validate({ enabled: true, separateButton: true })).toEqual({ errors: [], warnings: [] })
  })

  it('rejects wrong types', () => {
    expect(validate('on').errors).toHaveLength(1)
    const { errors } = validate({ enabled: 'yes', speed: 'fast', showVariables: 1, question: 3 })
    expect(errors).toHaveLength(4)
    expect(validate({ enabled: true, separateButton: 'yes' }).errors[0]).toMatch(/separateButton/)
  })

  it('warns about out-of-range speed, unknown keys, long questions and a field left off', () => {
    expect(validate({ enabled: true, speed: 10 }).warnings[0]).toMatch(/clamped/)
    expect(validate({ enabled: true, timeline: [] }).warnings[0]).toMatch(/unknown key/)
    expect(validate({ enabled: true, question: 'x'.repeat(201) }).warnings[0]).toMatch(/200/)
    expect(validate({ speed: 1 }).warnings[0]).toMatch(/not enabled/)
  })
})

describe('module definitions', () => {
  it('python and turtle declare the slow-mo field (the CLI and Builder read it)', () => {
    expect(declaresPythonSlowMo(pythonDefinition)).toBe(true)
    expect(declaresPythonSlowMo(turtleDefinition)).toBe(true)
    expect(declaresPythonSlowMo(scratchDefinition)).toBe(false)
  })
})
