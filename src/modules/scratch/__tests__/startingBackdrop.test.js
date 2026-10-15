// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  getStartingBackdrop,
  getStartingBackdropName,
  setStartingBackdrop,
  validateStartingBackdrop,
} from '../startingBackdrop.js'
import scratchModuleDefinition from '../definition.js'

const beach = { id: 'beach', name: 'Beach', image: 'b.png' }
const farm = { id: 'farm', name: 'Farm', image: 'f.png' }
const forest = { id: 'forest', name: 'Forest', colour: '#0a0' }

describe('getStartingBackdrop', () => {
  it('defaults to the first backdrop', () => {
    expect(getStartingBackdrop([beach, farm])).toBe(beach)
    expect(getStartingBackdropName([beach, farm])).toBe('Beach')
  })

  it('uses the backdrop marked current', () => {
    const list = [beach, { ...farm, current: true }, forest]
    expect(getStartingBackdrop(list)).toBe(list[1])
    expect(getStartingBackdropName(list)).toBe('Farm')
  })

  it('takes the first marked when several are', () => {
    expect(
      getStartingBackdropName([beach, { ...farm, current: true }, { ...forest, current: true }])
    ).toBe('Farm')
  })

  it('ignores a non-true current value', () => {
    expect(getStartingBackdropName([beach, { ...farm, current: 'yes' }])).toBe('Beach')
  })

  it('handles no backdrops', () => {
    expect(getStartingBackdrop([])).toBeNull()
    expect(getStartingBackdrop(undefined)).toBeNull()
    expect(getStartingBackdropName(null)).toBeNull()
  })
})

describe('setStartingBackdrop', () => {
  it('marks only the chosen backdrop', () => {
    const next = setStartingBackdrop([{ ...beach }, { ...farm, current: true }, forest], 'forest')
    expect(next.map((b) => b.current)).toEqual([undefined, undefined, true])
    expect(getStartingBackdropName(next)).toBe('Forest')
  })

  it('choosing the first clears the flag everywhere', () => {
    const next = setStartingBackdrop([beach, { ...farm, current: true }], 'beach')
    expect(next.some((b) => 'current' in b)).toBe(false)
    expect(getStartingBackdropName(next)).toBe('Beach')
  })
})

describe('validateStartingBackdrop', () => {
  function run(task) {
    const errors = []
    const warnings = []
    validateStartingBackdrop(task, 3, errors, warnings)
    return { errors, warnings }
  }

  it('accepts one current backdrop', () => {
    expect(run({ backdrops: [beach, { ...farm, current: true }] })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('warns when more than one is current', () => {
    const { errors, warnings } = run({
      backdrops: [
        { ...beach, current: true },
        { ...farm, current: true },
      ],
    })
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/Task 3 has 2 backdrops marked current/)
    expect(warnings[0]).toMatch(/"Beach"/)
  })

  it('rejects a non-boolean current', () => {
    const { errors } = run({ backdrops: [{ ...farm, current: 'yes' }] })
    expect(errors[0]).toMatch(/Task 3 backdrop "Farm" current must be true or false/)
  })

  it('is wired into the Scratch module validateTask', () => {
    const errors = []
    const warnings = []
    scratchModuleDefinition.validateTask(
      {
        backdrops: [
          { ...beach, current: true },
          { ...farm, current: true },
        ],
      },
      { n: 1, errors, warnings }
    )
    expect(warnings.some((w) => /backdrops marked current/.test(w))).toBe(true)
  })
})
