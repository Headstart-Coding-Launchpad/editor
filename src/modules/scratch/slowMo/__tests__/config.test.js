import { describe, it, expect } from 'vitest'
import { normalizeSlowMo, validateScratchSlowMo } from '../config.js'
import scratchDefinition from '../../definition.js'

function validate(slowMo) {
  const errors = []
  const warnings = []
  validateScratchSlowMo({ slowMo }, 1, errors, warnings)
  return { errors, warnings }
}

describe('normalizeSlowMo', () => {
  it('is off unless enabled is true', () => {
    expect(normalizeSlowMo(undefined)).toBeNull()
    expect(normalizeSlowMo({ speed: 2 })).toBeNull()
    expect(normalizeSlowMo({ enabled: false })).toBeNull()
  })

  it('defaults to 1 block a second and all five timeline fields', () => {
    expect(normalizeSlowMo({ enabled: true })).toEqual({
      speed: 1,
      timeline: ['costume', 'backdrop', 'x', 'y', 'variables'],
    })
  })

  it('clamps the speed and keeps known timeline fields in a fixed order', () => {
    expect(
      normalizeSlowMo({ enabled: true, speed: 9, timeline: ['y', 'bogus', 'costume'] })
    ).toEqual({ speed: 4, timeline: ['costume', 'y'] })
    expect(normalizeSlowMo({ enabled: true, timeline: [] }).timeline).toEqual([])
  })
})

describe('validateScratchSlowMo', () => {
  it('accepts the documented shape', () => {
    expect(
      validate({
        enabled: true,
        speed: 1,
        timeline: ['costume', 'backdrop', 'x', 'y', 'variables'],
      })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('rejects bad types', () => {
    expect(validate('yes').errors).toHaveLength(1)
    expect(validate({ enabled: 'yes' }).errors).toHaveLength(1)
    expect(validate({ enabled: true, speed: 0 }).errors).toHaveLength(1)
    expect(validate({ enabled: true, timeline: 'costume' }).errors).toHaveLength(1)
  })

  it('warns about out-of-range speeds, unknown fields and a forgotten enabled', () => {
    expect(validate({ enabled: true, speed: 8 }).warnings).toHaveLength(1)
    expect(validate({ enabled: true, timeline: ['size'] }).warnings).toHaveLength(1)
    expect(validate({ enabled: true, colour: 'red' }).warnings).toHaveLength(1)
    expect(validate({ speed: 1 }).warnings).toHaveLength(1)
  })

  it('runs as part of the scratch module validation and is a declared task field', () => {
    const errors = []
    const warnings = []
    scratchDefinition.validateTask({ slowMo: { enabled: 'on' } }, { n: 2, errors, warnings })
    expect(errors.some((e) => e.includes('slowMo.enabled'))).toBe(true)
    expect(scratchDefinition.taskFields.some((field) => field.name === 'slowMo')).toBe(true)
  })
})
