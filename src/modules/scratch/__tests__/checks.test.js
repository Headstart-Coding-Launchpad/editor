import { describe, it, expect } from 'vitest'
import { DEFAULT_SPRITES, createSpriteState, evaluateScratchCheck, compare } from '../checks'

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
})
