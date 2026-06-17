import { describe, it, expect } from 'vitest'
import { DEFAULT_SPRITES, createSpriteState, evaluateScratchCheck, partialEvaluateScratchCheck, compare } from '../checks'

// Minimal workspace stub used by block_used / block_count checks.
function makeWorkspace(blockTypes) {
  return {
    getAllBlocks: () => blockTypes.map(type => ({ type, previousConnection: { isConnected: () => false }, getNextBlock: () => null, getInputTargetBlock: () => null })),
  }
}

// Block stub with controllable input values for field-value checks.
function makeBlock(type, inputValues = {}) {
  return {
    type,
    previousConnection: { isConnected: () => false },
    getNextBlock: () => null,
    getInputTargetBlock: (inputName) => {
      if (!(inputName in inputValues)) return null
      const val = String(inputValues[inputName])
      return { getFieldValue: () => val }
    },
  }
}

// Workspace stub where blocks form named chains for blocks_in_order checks.
// chains is an array of opcode-string arrays, each representing one connected stack.
function makeChainWorkspace(chains) {
  const allBlocks = []
  for (const chain of chains) {
    const cb = chain.map(type => ({
      type,
      getNextBlock: null,
      previousConnection: { isConnected: () => false },
    }))
    for (let i = 0; i < cb.length; i++) {
      const next = cb[i + 1] ?? null
      cb[i].getNextBlock = () => next
      if (i > 0) cb[i].previousConnection = { isConnected: () => true }
    }
    allBlocks.push(...cb)
  }
  return { getAllBlocks: () => allBlocks }
}

describe('DEFAULT_SPRITES', () => {
  it('contains one sprite with id sprite1', () => {
    expect(DEFAULT_SPRITES).toHaveLength(1)
    expect(DEFAULT_SPRITES[0].id).toBe('sprite1')
  })
})

describe('createSpriteState', () => {
  it('returns a sprite at the origin facing right', () => {
    const state = createSpriteState()
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)
    expect(state.direction).toBe(90)
    expect(state.size).toBe(100)
    expect(state.visible).toBe(true)
  })

  it('returns a fresh object on every call', () => {
    const a = createSpriteState()
    const b = createSpriteState()
    expect(a).not.toBe(b)
  })

  it('includes all 7 graphic effect keys initialised to 0', () => {
    const state = createSpriteState()
    expect(state.effect_color).toBe(0)
    expect(state.effect_fisheye).toBe(0)
    expect(state.effect_whirl).toBe(0)
    expect(state.effect_pixelate).toBe(0)
    expect(state.effect_mosaic).toBe(0)
    expect(state.effect_brightness).toBe(0)
    expect(state.effect_ghost).toBe(0)
  })
})

describe('sprite_property check on graphic effects', () => {
  it('reads effect_ghost from sprite state via sprite_property check', () => {
    const state = { ...createSpriteState(), effect_ghost: 50 }
    const check = { type: 'sprite_property', property: 'effect_ghost', operator: 'equals', value: 50 }
    expect(evaluateScratchCheck(check, null, state)).toBe(true)
  })

  it('returns false when effect value does not match', () => {
    const state = { ...createSpriteState(), effect_ghost: 25 }
    const check = { type: 'sprite_property', property: 'effect_ghost', operator: 'equals', value: 50 }
    expect(evaluateScratchCheck(check, null, state)).toBe(false)
  })

  it('supports greater_than comparison on effect values', () => {
    const state = { ...createSpriteState(), effect_brightness: 75 }
    const check = { type: 'sprite_property', property: 'effect_brightness', operator: 'greater_than', value: 50 }
    expect(evaluateScratchCheck(check, null, state)).toBe(true)
  })
})

describe('compare', () => {
  describe('numeric comparison', () => {
    it('returns true for equals when numbers match', () => {
      expect(compare(50, 'equals', 50)).toBe(true)
    })

    it('returns false for equals when numbers differ', () => {
      expect(compare(50, 'equals', 49)).toBe(false)
    })

    it('returns true for greater_than when a > e', () => {
      expect(compare(51, 'greater_than', 50)).toBe(true)
    })

    it('returns false for greater_than when a === e', () => {
      expect(compare(50, 'greater_than', 50)).toBe(false)
    })

    it('returns true for less_than when a < e', () => {
      expect(compare(49, 'less_than', 50)).toBe(true)
    })

    it('returns false for less_than when a > e', () => {
      expect(compare(51, 'less_than', 50)).toBe(false)
    })

    it('coerces string numbers to numeric comparison', () => {
      expect(compare('100', 'equals', 100)).toBe(true)
      expect(compare(100, 'greater_than', '99')).toBe(true)
    })
  })

  describe('string comparison', () => {
    it('returns true for equals when strings match', () => {
      expect(compare('hello', 'equals', 'hello')).toBe(true)
    })

    it('returns false for equals when strings differ', () => {
      expect(compare('hello', 'equals', 'world')).toBe(false)
    })

    it('falls back to string comparison when one value is non-numeric', () => {
      expect(compare('abc', 'greater_than', 'def')).toBe(false)
    })
  })
})

describe('evaluateScratchCheck', () => {
  describe('block_used', () => {
    it('returns true when the opcode is present in the workspace', () => {
      const ws = makeWorkspace(['motion_movesteps', 'looks_say'])
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, ws, null)).toBe(true)
    })

    it('returns false when the opcode is absent', () => {
      const ws = makeWorkspace(['looks_say'])
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, ws, null)).toBe(false)
    })

    it('returns false when workspace is null', () => {
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('sprite_property', () => {
    it('returns true when the property satisfies the operator', () => {
      const state = { x: 100, y: 0, size: 100 }
      const check = { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 50 }
      expect(evaluateScratchCheck(check, null, state)).toBe(true)
    })

    it('returns false when the condition is not met', () => {
      const state = { x: 30, y: 0, size: 100 }
      const check = { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 50 }
      expect(evaluateScratchCheck(check, null, state)).toBe(false)
    })

    it('returns false when spriteState is null', () => {
      const check = { type: 'sprite_property', property: 'x', operator: 'equals', value: 0 }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('variable_equals', () => {
    it('returns true when the variable equals the expected value', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 10 }
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(true)
    })

    it('returns false when the variable has a different value', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 10 }
      const runState = { variables: { score: 5 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(false)
    })

    it('falls back to "score" when variableName is missing', () => {
      const check = { type: 'variable_equals', value: 10 }
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(true)
    })

    it('returns false when runState is null', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 0 }
      expect(evaluateScratchCheck(check, null, null, null)).toBe(false)
    })
  })

  describe('unknown type', () => {
    it('returns false', () => {
      const check = { type: 'unknown_type' }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('null/missing check', () => {
    it('returns false when check is null', () => {
      expect(evaluateScratchCheck(null, null, null)).toBe(false)
    })

    it('returns false when check.type is missing', () => {
      expect(evaluateScratchCheck({}, null, null)).toBe(false)
    })
  })

  describe('blocks_in_order', () => {
    it('returns true when the exact sequence matches the only chain', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps', 'motion_turnright']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws, null)).toBe(true)
    })

    it('returns true when the sequence is a prefix of the chain', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps', 'motion_turnright', 'control_wait']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps'] }, ws, null)).toBe(true)
    })

    it('returns true when the sequence appears in the middle of the chain', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps', 'motion_turnright', 'control_wait']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['motion_movesteps', 'motion_turnright'] }, ws, null)).toBe(true)
    })

    it('returns false when the opcodes are present but in the wrong order', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_turnright', 'motion_movesteps']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['motion_movesteps', 'motion_turnright'] }, ws, null)).toBe(false)
    })

    it('returns false when there is a gap between consecutive required blocks', () => {
      const ws = makeChainWorkspace([['motion_movesteps', 'control_wait', 'motion_turnright']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['motion_movesteps', 'motion_turnright'] }, ws, null)).toBe(false)
    })

    it('returns true when the sequence appears in one of several chains', () => {
      const ws = makeChainWorkspace([
        ['event_whenkeypressed', 'looks_say'],
        ['event_whenflagclicked', 'motion_movesteps'],
      ])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps'] }, ws, null)).toBe(true)
    })

    it('returns false when workspace is null', () => {
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['motion_movesteps'] }, null, null)).toBe(false)
    })

    it('returns false when sequence is an empty array', () => {
      const ws = makeChainWorkspace([['motion_movesteps']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: [] }, ws, null)).toBe(false)
    })

    it('returns false when sequence is longer than any chain', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws, null)).toBe(false)
    })

    it('handles a single-item sequence as a top-level block check', () => {
      const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps']])
      expect(evaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked'] }, ws, null)).toBe(true)
    })
  })

  describe('block_count', () => {
    it('returns true when block count equals the expected value', () => {
      const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps', 'looks_say'])
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 2 }, ws, null)).toBe(true)
    })

    it('returns false when block count does not match equals', () => {
      const ws = makeWorkspace(['motion_movesteps', 'looks_say'])
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 3 }, ws, null)).toBe(false)
    })

    it('returns true when count satisfies greater_than', () => {
      const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps', 'motion_movesteps'])
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'greater_than', value: 2 }, ws, null)).toBe(true)
    })

    it('returns true when count satisfies less_than', () => {
      const ws = makeWorkspace(['motion_movesteps'])
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'less_than', value: 3 }, ws, null)).toBe(true)
    })

    it('returns true when count is zero and check expects zero', () => {
      const ws = makeWorkspace(['looks_say'])
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 0 }, ws, null)).toBe(true)
    })

    it('returns false when workspace is null', () => {
      expect(evaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 1 }, null, null)).toBe(false)
    })
  })

  describe('variable_compare', () => {
    it('returns true when variable equals the expected value', () => {
      const runState = { variables: { score: 5 } }
      expect(evaluateScratchCheck({ type: 'variable_compare', variableName: 'score', operator: 'equals', value: 5 }, null, null, runState)).toBe(true)
    })

    it('returns true when variable satisfies greater_than', () => {
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck({ type: 'variable_compare', variableName: 'score', operator: 'greater_than', value: 3 }, null, null, runState)).toBe(true)
    })

    it('returns true when variable satisfies less_than', () => {
      const runState = { variables: { score: 2 } }
      expect(evaluateScratchCheck({ type: 'variable_compare', variableName: 'score', operator: 'less_than', value: 10 }, null, null, runState)).toBe(true)
    })

    it('returns false when runState is null', () => {
      expect(evaluateScratchCheck({ type: 'variable_compare', variableName: 'score', operator: 'equals', value: 0 }, null, null, null)).toBe(false)
    })

    it('returns false when the variable is not in runState', () => {
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck({ type: 'variable_compare', variableName: 'lives', operator: 'equals', value: 3 }, null, null, runState)).toBe(false)
    })
  })

  describe('costume_is', () => {
    it('returns true when the costume matches', () => {
      const spriteState = { x: 0, y: 0, costume: 'costume2' }
      expect(evaluateScratchCheck({ type: 'costume_is', value: 'costume2' }, null, spriteState)).toBe(true)
    })

    it('returns false when the costume does not match', () => {
      const spriteState = { x: 0, y: 0, costume: 'costume1' }
      expect(evaluateScratchCheck({ type: 'costume_is', value: 'costume2' }, null, spriteState)).toBe(false)
    })

    it('returns false when spriteState is null', () => {
      expect(evaluateScratchCheck({ type: 'costume_is', value: 'costume2' }, null, null)).toBe(false)
    })

    it('returns false when costume is null and value is a string', () => {
      const spriteState = { x: 0, y: 0, costume: null }
      expect(evaluateScratchCheck({ type: 'costume_is', value: 'costume2' }, null, spriteState)).toBe(false)
    })
  })

  describe('block_run', () => {
    it('returns true when the opcode is in executedBlocks', () => {
      const runState = { executedBlocks: new Set(['motion_movesteps', 'looks_say']) }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps' }, null, null, runState)).toBe(true)
    })

    it('returns false when the opcode is not in executedBlocks', () => {
      const runState = { executedBlocks: new Set(['looks_say']) }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps' }, null, null, runState)).toBe(false)
    })

    it('returns false when runState is null', () => {
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps' }, null, null, null)).toBe(false)
    })

    it('returns false when executedBlocks is empty', () => {
      const runState = { executedBlocks: new Set() }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps' }, null, null, runState)).toBe(false)
    })

    it('returns false when executedBlocks is absent', () => {
      const runState = { variables: {} }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps' }, null, null, runState)).toBe(false)
    })
  })

  describe('block_used with fieldValues', () => {
    it('returns true when block has matching field values', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '50' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null)).toBe(true)
    })

    it('returns false when block exists but field values do not match', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '10' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null)).toBe(false)
    })

    it('returns true when fieldValues is empty and block exists', () => {
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: {} }, makeWorkspace(['motion_movesteps']), null)).toBe(true)
    })

    it('returns false when block does not exist even if fieldValues is specified', () => {
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, makeWorkspace([]), null)).toBe(false)
    })

    it('coerces numeric string values when comparing', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '10' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: { STEPS: '10' } }, ws, null)).toBe(true)
    })
  })

  describe('blocks_in_order with fieldValues', () => {
    function makeChain(typeValuePairs) {
      const blocks = typeValuePairs.map(([type, vals]) => makeBlock(type, vals ?? {}))
      for (let i = 0; i < blocks.length; i++) {
        const next = blocks[i + 1] ?? null
        blocks[i].getNextBlock = () => next
        if (i > 0) blocks[i].previousConnection = { isConnected: () => true }
      }
      return { getAllBlocks: () => blocks }
    }

    it('returns true when sequence with field values matches', () => {
      const ws = makeChain([['event_whenflagclicked', {}], ['motion_movesteps', { STEPS: '50' }]])
      const check = { type: 'blocks_in_order', sequence: ['event_whenflagclicked', { opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }] }
      expect(evaluateScratchCheck(check, ws, null)).toBe(true)
    })

    it('returns false when field values do not match', () => {
      const ws = makeChain([['event_whenflagclicked', {}], ['motion_movesteps', { STEPS: '10' }]])
      const check = { type: 'blocks_in_order', sequence: ['event_whenflagclicked', { opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }] }
      expect(evaluateScratchCheck(check, ws, null)).toBe(false)
    })

    it('returns true for mixed sequence (some with fieldValues, some without)', () => {
      const ws = makeChain([['event_whenflagclicked', {}], ['motion_movesteps', { STEPS: '50' }], ['motion_turnright', { DEGREES: '15' }]])
      const check = { type: 'blocks_in_order', sequence: [{ opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, 'motion_turnright'] }
      expect(evaluateScratchCheck(check, ws, null)).toBe(true)
    })
  })

  describe('block_run with fieldValues', () => {
    it('returns true when block ran and workspace has matching field values', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '50' })] }
      const runState = { executedBlocks: new Set(['motion_movesteps']) }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null, runState)).toBe(true)
    })

    it('returns false when block ran but workspace field values do not match', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '10' })] }
      const runState = { executedBlocks: new Set(['motion_movesteps']) }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null, runState)).toBe(false)
    })

    it('returns false when block did not run regardless of field values in workspace', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '50' })] }
      const runState = { executedBlocks: new Set() }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null, runState)).toBe(false)
    })

    it('returns true when block ran with empty fieldValues (no value constraint)', () => {
      const runState = { executedBlocks: new Set(['motion_movesteps']) }
      expect(evaluateScratchCheck({ type: 'block_run', opcode: 'motion_movesteps', fieldValues: {} }, null, null, runState)).toBe(true)
    })
  })

  describe('partialEvaluateScratchCheck', () => {
    describe('block_used', () => {
      it('returns pass when the required block is present', () => {
        const ws = makeWorkspace(['motion_movesteps', 'looks_say'])
        expect(partialEvaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps' }, ws)).toBe('pass')
      })

      it('returns pending when the required block is absent', () => {
        const ws = makeWorkspace(['looks_say'])
        expect(partialEvaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps' }, ws)).toBe('pending')
      })

      it('returns pending when workspace is null', () => {
        expect(partialEvaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps' }, null)).toBe('pending')
      })
    })

    describe('blocks_in_order', () => {
      it('returns pass when the full sequence is present', () => {
        const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps', 'motion_turnright']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('pass')
      })

      it('returns pending when only the first block of the sequence is placed', () => {
        const ws = makeChainWorkspace([['event_whenflagclicked']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('pending')
      })

      it('returns pending when the first two blocks of the sequence are correctly placed', () => {
        const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('pending')
      })

      it('returns fail when a wrong block follows the correct start', () => {
        const ws = makeChainWorkspace([['event_whenflagclicked', 'looks_say']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('fail')
      })

      it('returns fail when the second block is correct but the third is wrong', () => {
        const ws = makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps', 'looks_say']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('fail')
      })

      it('returns pending when workspace has an unrelated block (not the sequence start)', () => {
        const ws = makeChainWorkspace([['looks_say']])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps'] }, ws)).toBe('pending')
      })

      it('returns pending when workspace is empty', () => {
        const ws = makeChainWorkspace([])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps'] }, ws)).toBe('pending')
      })

      it('returns pending when an on-track chain coexists with an unrelated floating block', () => {
        const ws = makeChainWorkspace([
          ['event_whenflagclicked', 'motion_movesteps'],
          ['looks_say'],
        ])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('pending')
      })

      it('returns fail when an on-track chain has a violation even if another chain is unrelated', () => {
        const ws = makeChainWorkspace([
          ['event_whenflagclicked', 'looks_say'],
          ['motion_turnright'],
        ])
        expect(partialEvaluateScratchCheck({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'] }, ws)).toBe('fail')
      })
    })

    describe('block_count', () => {
      it('returns pass when count matches equals target', () => {
        const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 2 }, ws)).toBe('pass')
      })

      it('returns pending when count is below equals target', () => {
        const ws = makeWorkspace(['motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 2 }, ws)).toBe('pending')
      })

      it('returns fail when count exceeds equals target', () => {
        const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps', 'motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'equals', value: 2 }, ws)).toBe('fail')
      })

      it('returns pass when count satisfies greater_than', () => {
        const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps', 'motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'greater_than', value: 2 }, ws)).toBe('pass')
      })

      it('returns pending when count has not yet reached greater_than threshold', () => {
        const ws = makeWorkspace(['motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'greater_than', value: 2 }, ws)).toBe('pending')
      })

      it('returns pass when count satisfies less_than', () => {
        const ws = makeWorkspace(['motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'less_than', value: 3 }, ws)).toBe('pass')
      })

      it('returns fail when count violates less_than', () => {
        const ws = makeWorkspace(['motion_movesteps', 'motion_movesteps', 'motion_movesteps'])
        expect(partialEvaluateScratchCheck({ type: 'block_count', opcode: 'motion_movesteps', operator: 'less_than', value: 3 }, ws)).toBe('fail')
      })
    })

    describe('unknown or non-block types', () => {
      it('returns pending for sprite_property (not a block placement check)', () => {
        expect(partialEvaluateScratchCheck({ type: 'sprite_property', property: 'x', operator: 'equals', value: 0 }, null)).toBe('pending')
      })

      it('returns fail when check has no type', () => {
        expect(partialEvaluateScratchCheck({}, null)).toBe('fail')
      })

      it('returns fail when check is null', () => {
        expect(partialEvaluateScratchCheck(null, null)).toBe('fail')
      })
    })
  })

  describe('wildcard * in fieldValues', () => {
    it('block_used passes when field value matches a wildcard pattern', () => {
      const ws = { getAllBlocks: () => [makeBlock('looks_saywaitfor', { MESSAGE: 'Hello world', SECS: '2' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'looks_saywaitfor', fieldValues: { MESSAGE: 'Hello*' } }, ws, null)).toBe(true)
    })

    it('block_used fails when field value does not match the wildcard', () => {
      const ws = { getAllBlocks: () => [makeBlock('looks_saywaitfor', { MESSAGE: 'Goodbye world', SECS: '2' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'looks_saywaitfor', fieldValues: { MESSAGE: 'Hello*' } }, ws, null)).toBe(false)
    })

    it('block_used exact match still works when no wildcard', () => {
      const ws = { getAllBlocks: () => [makeBlock('motion_movesteps', { STEPS: '50' })] }
      expect(evaluateScratchCheck({ type: 'block_used', opcode: 'motion_movesteps', fieldValues: { STEPS: '50' } }, ws, null)).toBe(true)
    })

    it('blocks_in_order passes when a sequence item uses a wildcard field value', () => {
      function makeChain(typeValuePairs) {
        const blocks = typeValuePairs.map(([type, vals]) => makeBlock(type, vals ?? {}))
        for (let i = 0; i < blocks.length; i++) {
          const next = blocks[i + 1] ?? null
          blocks[i].getNextBlock = () => next
          if (i > 0) blocks[i].previousConnection = { isConnected: () => true }
        }
        return { getAllBlocks: () => blocks }
      }
      const ws = makeChain([['event_whenflagclicked', {}], ['looks_saywaitfor', { MESSAGE: 'Hi there', SECS: '3' }]])
      const check = { type: 'blocks_in_order', sequence: ['event_whenflagclicked', { opcode: 'looks_saywaitfor', fieldValues: { MESSAGE: 'Hi*' } }] }
      expect(evaluateScratchCheck(check, ws, null)).toBe(true)
    })
  })
})
