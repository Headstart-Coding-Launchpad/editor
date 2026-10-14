// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getTaskScrub,
  scrubCapabilityOf,
  scrubCapabilityProblem,
  scrubPreviewMode,
  validateScrub,
} from '../scrubConfig.js'
import { scrubReportFields, summarizeScrubUse } from '../scrubUse.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

describe('getTaskScrub', () => {
  it('is off unless set, and defaults numbers and colours on', () => {
    expect(getTaskScrub({})).toBeNull()
    expect(getTaskScrub({ scrub: { enabled: false } })).toBeNull()
    expect(getTaskScrub({ scrub: true })).toEqual({ numbers: true, colours: true, ranges: [] })
    expect(getTaskScrub({ scrub: { enabled: true, colours: false } })).toEqual({
      numbers: true,
      colours: false,
      ranges: [],
    })
    expect(getTaskScrub({ scrub: { numbers: false, colours: false } })).toBeNull()
  })

  it('keeps valid ranges, the first per line', () => {
    const scrub = getTaskScrub({
      scrub: {
        enabled: true,
        ranges: [
          { line: 3, min: 10, max: 200 },
          { line: 3, min: 0, max: 5 },
          { line: 0, min: 0, max: 5 },
          { line: 4, min: 5, max: 5 },
          { line: 5, min: '1', max: 9 },
        ],
      },
    })
    expect(scrub.ranges).toEqual([
      { line: 3, min: 10, max: 200 },
      { line: 5, min: 1, max: 9 },
    ])
  })
})

describe('capabilities.scrub', () => {
  it('validates the module capability', () => {
    expect(scrubCapabilityProblem(null)).toBeNull()
    expect(scrubCapabilityProblem({ liveRerun: 'preview' })).toBeNull()
    expect(scrubCapabilityProblem({ liveRerun: 'always' })).toMatch(/liveRerun/)
    expect(scrubCapabilityProblem({ liveRerun: 'none', inputCall: 'a b' })).toMatch(/inputCall/)
    expect(scrubCapabilityProblem('yes')).toMatch(/object or null/)
  })

  it('is declared by python, turtle and html only', () => {
    expect(scrubCapabilityOf(getModuleDefinition('python'))).toEqual({
      liveRerun: 'preview',
      needsImport: 'stage',
      inputCall: 'input',
    })
    expect(scrubCapabilityOf(getModuleDefinition('turtle'))?.needsImport).toBeNull()
    expect(scrubCapabilityOf(getModuleDefinition('html'))?.inputCall).toBeNull()
    expect(scrubCapabilityOf(getModuleDefinition('arcade'))).toBeNull()
  })
})

describe('scrubPreviewMode', () => {
  const python = { liveRerun: 'preview', needsImport: 'stage', inputCall: 'input' }
  const turtle = { liveRerun: 'preview', needsImport: null, inputCall: 'input' }

  it('re-runs drawing programs live', () => {
    expect(scrubPreviewMode(python, 'from stage import *\nrect(1, 2, 3, 4)')).toBe('preview')
    expect(scrubPreviewMode(python, 'import stage\nstage.circle(5, 5, 5)')).toBe('preview')
    expect(scrubPreviewMode(turtle, 'import turtle\nturtle.forward(100)')).toBe('preview')
    expect(
      scrubPreviewMode({ liveRerun: 'preview', needsImport: null, inputCall: null }, '<p></p>')
    ).toBe('preview')
  })

  it('asks for Run without the needed import, with input(), or with no live re-run', () => {
    expect(scrubPreviewMode(python, 'print(5)')).toBe('press-run')
    expect(scrubPreviewMode(python, 'import stage\nname = input("?")')).toBe('press-run')
    expect(scrubPreviewMode(turtle, 'n = input ("size")')).toBe('press-run')
    expect(scrubPreviewMode(turtle, 'x = box.input(1)')).toBe('preview')
    expect(scrubPreviewMode({ liveRerun: 'none' }, 'x')).toBe('press-run')
    expect(scrubPreviewMode(null, 'x')).toBe('press-run')
  })
})

describe('validateScrub', () => {
  const run = (scrub, starterCode = null) => {
    const errors = []
    const warnings = []
    validateScrub({ scrub }, 4, errors, warnings, { starterCode })
    return { errors, warnings }
  }

  it('accepts the documented shapes', () => {
    expect(run(true)).toEqual({ errors: [], warnings: [] })
    expect(
      run({ enabled: true, numbers: true, colours: false, ranges: [{ line: 2, min: 0, max: 9 }] })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('reports bad shapes and ranges', () => {
    expect(run('yes').errors).toEqual([
      'Task 4 has a scrub that is not an object — write it as scrub: { enabled: true }',
    ])
    expect(run({ enabled: 'yes' }).errors).toEqual([
      'Task 4 has scrub enabled that is not true or false',
    ])
    expect(run({ enabled: true, ranges: { line: 1 } }).errors[0]).toMatch(/not a list/)
    const { errors, warnings } = run(
      {
        enabled: true,
        extra: 1,
        ranges: [{ line: 0 }, { line: 9, min: 5, max: 1 }, { line: 9, min: 0, max: 2 }],
      },
      'a\nb'
    )
    expect(errors).toEqual([
      'Task 4 has a scrub range without a line number of 1 or more',
      'Task 4 has a scrub range on line 9 whose min is not less than its max',
    ])
    expect(warnings).toEqual([
      'Task 4 has scrub fields it does not use (extra) — they are ignored',
      'Task 4 has a scrub range on line 9, but the starter code has only 2 lines',
      'Task 4 has two scrub ranges for line 9 — only the first is used',
    ])
  })

  it('warns when both kinds are off', () => {
    expect(run({ enabled: true, numbers: false, colours: false }).warnings).toEqual([
      'Task 4 has scrub with numbers and colours both off — nothing can be scrubbed',
    ])
  })
})

describe('scrub report fields', () => {
  it('reports counts per student task and the summary count', () => {
    expect(scrubReportFields(null)).toEqual({})
    expect(scrubReportFields({ numbers: 0, colours: 0 })).toEqual({})
    expect(scrubReportFields({ numbers: 3, colours: 1, lastAt: 5 })).toEqual({
      scrubs: 4,
      scrubNumbers: 3,
      scrubColours: 1,
    })
    expect(summarizeScrubUse([{ scrubs: 2 }, {}, { scrubs: 1 }])).toEqual({ scrubUsedCount: 2 })
    expect(summarizeScrubUse([{}])).toEqual({})
  })
})
