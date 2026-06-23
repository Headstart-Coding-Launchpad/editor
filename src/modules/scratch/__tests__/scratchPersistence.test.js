import { describe, it, expect } from 'vitest'
import { migrateBroadcastState, migrateVariableFields } from '../scratchPersistence'

// saveWorkspace/loadWorkspace are thin wrappers around Blockly serialization.
// Tested here only via the migration layer they call.

function oldFormatBroadcastState(text) {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'event_broadcast',
        inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: text } } } },
      }],
    },
  }
}

describe('migrateBroadcastState', () => {
  it('moves shadow TEXT into fields.BROADCAST_INPUT for event_broadcast', () => {
    const result = migrateBroadcastState(oldFormatBroadcastState('launch'))
    const block = result.blocks.blocks[0]
    expect(block.fields?.BROADCAST_INPUT).toBe('launch')
    expect(block.inputs).toBeUndefined()
  })

  it('preserves the default message1 text', () => {
    const result = migrateBroadcastState(oldFormatBroadcastState('message1'))
    expect(result.blocks.blocks[0].fields?.BROADCAST_INPUT).toBe('message1')
  })

  it('migrates broadcast blocks inside a next chain', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_whenflagclicked',
          next: {
            block: {
              type: 'event_broadcast',
              inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'go' } } } },
            },
          },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    const broadcast = result.blocks.blocks[0].next.block
    expect(broadcast.fields?.BROADCAST_INPUT).toBe('go')
    expect(broadcast.inputs).toBeUndefined()
  })

  it('does not overwrite an already-migrated field', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_broadcast',
          fields: { BROADCAST_INPUT: 'existing' },
          inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'shadow' } } } },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    expect(result.blocks.blocks[0].fields.BROADCAST_INPUT).toBe('existing')
  })

  it('returns state unchanged when blocks array is absent', () => {
    const state = { something: 'else' }
    expect(migrateBroadcastState(state)).toBe(state)
  })

  it('migrates event_broadcastandwait as well', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_broadcastandwait',
          inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'done' } } } },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    expect(result.blocks.blocks[0].fields?.BROADCAST_INPUT).toBe('done')
  })
})

describe('migrateVariableFields', () => {
  it('converts an object field reference to the variable name by id', () => {
    const state = {
      variables: [{ id: 'v1', name: 'score' }],
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'data_setvariableto',
          fields: { VARIABLE: { id: 'v1', name: 'score' } },
        }],
      },
    }
    const result = migrateVariableFields(state)
    expect(result.blocks.blocks[0].fields.VARIABLE).toBe('score')
  })

  it('converts a string id to the mapped name', () => {
    const state = {
      variables: [{ id: 'v1', name: 'lives' }],
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'data_changevariableby',
          fields: { VARIABLE: 'v1' },
        }],
      },
    }
    const result = migrateVariableFields(state)
    expect(result.blocks.blocks[0].fields.VARIABLE).toBe('lives')
  })

  it('strips the variables array from the output', () => {
    const state = {
      variables: [{ id: 'v1', name: 'score' }],
      blocks: { languageVersion: 0, blocks: [{ type: 'data_variable', fields: { VARIABLE: { id: 'v1', name: 'score' } } }] },
    }
    const result = migrateVariableFields(state)
    expect(result.variables).toBeUndefined()
  })

  it('returns state unchanged when blocks array is empty', () => {
    const state = { blocks: { languageVersion: 0, blocks: [] } }
    expect(migrateVariableFields(state)).toBe(state)
  })

  it('falls back to "score" when id is not in the variable map', () => {
    const state = {
      variables: [],
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'data_variable',
          fields: { VARIABLE: { id: 'unknown-id', name: undefined } },
        }],
      },
    }
    const result = migrateVariableFields(state)
    expect(result.blocks.blocks[0].fields.VARIABLE).toBe('score')
  })
})
