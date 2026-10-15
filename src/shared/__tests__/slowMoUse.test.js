import { describe, it, expect } from 'vitest'
import { slowMoReportFields, summarizeSlowMoUse } from '../slowMoUse.js'

describe('slowMoReportFields', () => {
  it('is empty when slow-mo was never used on the task', () => {
    expect(slowMoReportFields(undefined)).toEqual({})
    expect(slowMoReportFields({ runs: 0, steps: 0 })).toEqual({})
    expect(slowMoReportFields({ runs: -2, steps: 'x' })).toEqual({})
  })

  it('reports use with the run and step counts', () => {
    expect(slowMoReportFields({ runs: 2, steps: 7.9, lastAt: 1 })).toEqual({
      slowMoUsed: true,
      slowMoRuns: 2,
      slowMoSteps: 7,
    })
    expect(slowMoReportFields({ steps: 1 })).toEqual({
      slowMoUsed: true,
      slowMoRuns: 0,
      slowMoSteps: 1,
    })
  })
})

describe('summarizeSlowMoUse', () => {
  it('counts the students who used slow-mo', () => {
    expect(summarizeSlowMoUse([{ slowMoUsed: true }, {}, { slowMoUsed: true }])).toEqual({
      slowMoUsedCount: 2,
    })
    expect(summarizeSlowMoUse([{}])).toEqual({})
  })
})
