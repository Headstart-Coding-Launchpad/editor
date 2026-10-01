import { describe, it, expect } from 'vitest'
import {
  evaluateScratchCheckForSprites,
  findScratchCheckTarget,
  isScratchStaticCheck,
  partialEvaluateScratchCheckForSprites,
} from '../checkDispatch.js'
import { createJsonWorkspace } from '../jsonWorkspace.js'

// One sprite workspace from a list of stacks, each a list of opcodes joined by next.block.
function sprite(name, stacks = [], state = null) {
  const toStack = (opcodes) =>
    opcodes.reduceRight(
      (next, type) => ({ type, ...(next ? { next: { block: next } } : {}) }),
      null
    )
  return {
    id: name.toLowerCase(),
    name,
    state,
    workspace: createJsonWorkspace({ blocks: { blocks: stacks.map(toStack) } }),
  }
}

describe('isScratchStaticCheck', () => {
  it('is true only for checks decided by the blocks alone', () => {
    for (const type of ['block_used', 'blocks_in_order', 'block_count']) {
      expect(isScratchStaticCheck({ type })).toBe(true)
    }
    for (const type of ['block_run', 'sprite_property', 'variable_equals', 'costume_is']) {
      expect(isScratchStaticCheck({ type })).toBe(false)
    }
    expect(isScratchStaticCheck(null)).toBe(false)
  })
})

describe('findScratchCheckTarget', () => {
  it('finds the named sprite, else falls back to the first', () => {
    const sprites = [sprite('Cat'), sprite('Dog')]
    expect(findScratchCheckTarget({ spriteName: 'Dog' }, sprites).name).toBe('Dog')
    expect(findScratchCheckTarget({ spriteName: 'Bird' }, sprites).name).toBe('Cat')
    expect(findScratchCheckTarget({}, [])).toBeUndefined()
  })
})

describe('evaluateScratchCheckForSprites', () => {
  const sprites = [
    sprite('Cat', [['event_whenflagclicked']]),
    sprite('Dog', [['motion_movesteps']]),
  ]

  it('passes a block check with no spriteName when any sprite satisfies it', () => {
    expect(
      evaluateScratchCheckForSprites({ type: 'block_used', opcode: 'motion_movesteps' }, sprites)
    ).toBe(true)
  })

  it('only looks at the named sprite when spriteName is set', () => {
    const check = { type: 'block_used', opcode: 'motion_movesteps', spriteName: 'Cat' }
    expect(evaluateScratchCheckForSprites(check, sprites)).toBe(false)
    expect(evaluateScratchCheckForSprites({ ...check, spriteName: 'Dog' }, sprites)).toBe(true)
  })

  it('checks the first sprite when the named sprite does not exist', () => {
    const check = { type: 'block_used', opcode: 'event_whenflagclicked', spriteName: 'Bird' }
    expect(evaluateScratchCheckForSprites(check, sprites)).toBe(true)
  })

  it('evaluates sprite-state checks against the target sprite state', () => {
    const withState = [sprite('Cat', [], { x: 0 }), sprite('Dog', [], { x: 80 })]
    const check = { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 50 }
    expect(evaluateScratchCheckForSprites(check, withState)).toBe(false)
    expect(evaluateScratchCheckForSprites({ ...check, spriteName: 'Dog' }, withState)).toBe(true)
  })

  it('evaluates sprite_property_delta against the pre-run state of the target', () => {
    const withState = [sprite('Cat', [], { x: 30 })]
    const check = {
      type: 'sprite_property_delta',
      property: 'x',
      operator: 'greater_than',
      value: 10,
    }
    expect(evaluateScratchCheckForSprites(check, withState, null, { cat: { x: 0 } })).toBe(true)
    expect(evaluateScratchCheckForSprites(check, withState, null, {})).toBe(false)
  })

  it('reads variables from the run signal', () => {
    const check = { type: 'variable_equals', variableName: 'score', value: 3 }
    expect(evaluateScratchCheckForSprites(check, sprites, { variables: { score: 3 } })).toBe(true)
    expect(evaluateScratchCheckForSprites(check, sprites, null)).toBe(false)
  })

  it('fails safely with no sprites or no check type', () => {
    expect(evaluateScratchCheckForSprites({ type: 'sprite_property' }, [])).toBe(false)
    expect(evaluateScratchCheckForSprites({}, sprites)).toBe(false)
  })
})

describe('partialEvaluateScratchCheckForSprites', () => {
  const check = { type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps'] }

  it('stays pending while one sprite is untouched and another violates the sequence', () => {
    const sprites = [
      sprite('Cat', [['event_whenflagclicked']]),
      sprite('Dog', [['event_whenflagclicked', 'looks_say']]),
    ]
    expect(partialEvaluateScratchCheckForSprites(check, sprites)).toBe('pending')
  })

  it('fails only once every sprite rules the check out', () => {
    const sprites = [
      sprite('Cat', [['event_whenflagclicked', 'looks_say']]),
      sprite('Dog', [['event_whenflagclicked', 'looks_say']]),
    ]
    expect(partialEvaluateScratchCheckForSprites(check, sprites)).toBe('fail')
  })

  it('passes when any sprite satisfies it, and targets the named sprite when set', () => {
    const sprites = [
      sprite('Cat', [['event_whenflagclicked', 'looks_say']]),
      sprite('Dog', [['event_whenflagclicked', 'motion_movesteps']]),
    ]
    expect(partialEvaluateScratchCheckForSprites(check, sprites)).toBe('pass')
    expect(partialEvaluateScratchCheckForSprites({ ...check, spriteName: 'Cat' }, sprites)).toBe(
      'fail'
    )
    expect(partialEvaluateScratchCheckForSprites(check, [])).toBe('pending')
    expect(partialEvaluateScratchCheckForSprites({}, sprites)).toBe('fail')
  })
})
