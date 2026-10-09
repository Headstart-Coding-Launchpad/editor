// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildJsonSpriteWorkspaces,
  createJsonWorkspace,
  parseScratchBlocksState,
} from '../jsonWorkspace.js'
import { evaluateScratchCheck, partialEvaluateScratchCheck } from '../checks.js'

const say = (text) => ({
  type: 'looks_sayforsecs',
  inputs: {
    MESSAGE: { shadow: { type: 'text', fields: { TEXT: text } } },
    SECS: { shadow: { type: 'math_number', fields: { NUM: '2' } } },
  },
})

const flagThenSay = {
  blocks: {
    blocks: [{ type: 'event_whenflagclicked', x: 24, y: 24, next: { block: say('Hello!') } }],
  },
}

describe('createJsonWorkspace', () => {
  it('lists every block, shadows included, like Blockly getAllBlocks(false)', () => {
    const types = createJsonWorkspace(flagThenSay)
      .getAllBlocks(false)
      .map((block) => block.type)
    expect(types.sort()).toEqual(
      ['event_whenflagclicked', 'looks_sayforsecs', 'math_number', 'text'].sort()
    )
  })

  it('follows next.block with getNextBlock and marks only top-level blocks unconnected', () => {
    const workspace = createJsonWorkspace(flagThenSay)
    const [hat] = workspace.getTopBlocks()
    expect(hat.type).toBe('event_whenflagclicked')
    expect(hat.previousConnection.isConnected()).toBe(false)
    const next = hat.getNextBlock()
    expect(next.type).toBe('looks_sayforsecs')
    expect(next.previousConnection.isConnected()).toBe(true)
    expect(next.getNextBlock()).toBeNull()
  })

  it('reads input values through the input shadow and own fields through getFieldValue', () => {
    const block = createJsonWorkspace(flagThenSay).getTopBlocks()[0].getNextBlock()
    expect(block.getInputTargetBlock('MESSAGE').getFieldValue('TEXT')).toBe('Hello!')
    expect(block.getInputTargetBlock('SECS').getFieldValue('NUM')).toBe('2')
    expect(block.getInputTargetBlock('MISSING')).toBeNull()
    expect(block.getFieldValue('MESSAGE')).toBeNull()

    const dropdown = createJsonWorkspace({
      blocks: { blocks: [{ type: 'motion_goto', fields: { TO: '_random_' } }] },
    }).getTopBlocks()[0]
    expect(dropdown.getFieldValue('TO')).toBe('_random_')
  })

  it('prefers a real input block over its shadow', () => {
    const workspace = createJsonWorkspace({
      blocks: {
        blocks: [
          {
            type: 'motion_movesteps',
            inputs: {
              STEPS: {
                shadow: { type: 'math_number', fields: { NUM: '10' } },
                block: { type: 'data_variable', fields: { VARIABLE: 'score' } },
              },
            },
          },
        ],
      },
    })
    const target = workspace.getTopBlocks()[0].getInputTargetBlock('STEPS')
    expect(target.type).toBe('data_variable')
    // A reporter plugged into a value input has no previous connection.
    expect(target.previousConnection).toBeNull()
  })

  it('treats a C-block SUBSTACK as connected, so it is not a separate top-level stack', () => {
    const workspace = createJsonWorkspace({
      blocks: {
        blocks: [
          {
            type: 'control_repeat',
            inputs: {
              TIMES: { shadow: { type: 'math_number', fields: { NUM: '4' } } },
              SUBSTACK: { block: { type: 'motion_movesteps' } },
            },
          },
        ],
      },
    })
    const inner = workspace.getAllBlocks(false).find((block) => block.type === 'motion_movesteps')
    expect(inner.previousConnection.isConnected()).toBe(true)
    expect(workspace.getTopBlocks()[0].getInputTargetBlock('SUBSTACK')).toBe(inner)
  })

  it('applies the loader migrations (legacy variable fields read as names)', () => {
    const workspace = createJsonWorkspace({
      variables: [{ id: 'v1', name: 'score' }],
      blocks: {
        blocks: [{ type: 'data_setvariableto', fields: { VARIABLE: { id: 'v1' } } }],
      },
    })
    expect(workspace.getTopBlocks()[0].getFieldValue('VARIABLE')).toBe('score')
  })

  it('is empty for a missing or empty state', () => {
    expect(createJsonWorkspace(null).getAllBlocks(false)).toEqual([])
    expect(createJsonWorkspace({}).getAllBlocks(false)).toEqual([])
  })

  it('drives the pure Scratch check evaluators', () => {
    const workspace = createJsonWorkspace(flagThenSay)
    const inOrder = {
      type: 'blocks_in_order',
      sequence: [
        'event_whenflagclicked',
        { opcode: 'looks_sayforsecs', fieldValues: { MESSAGE: 'hello!' } },
      ],
    }
    expect(evaluateScratchCheck(inOrder, workspace, null)).toBe(true)
    expect(partialEvaluateScratchCheck(inOrder, workspace)).toBe('pass')
    expect(
      evaluateScratchCheck(
        { type: 'block_used', opcode: 'looks_sayforsecs', fieldValues: { SECS: '3' } },
        workspace,
        null
      )
    ).toBe(false)
    expect(
      evaluateScratchCheck(
        { type: 'block_count', opcode: 'looks_sayforsecs', operator: 'equals', value: 1 },
        workspace,
        null
      )
    ).toBe(true)
  })
})

describe('parseScratchBlocksState', () => {
  it('accepts an object, a JSON string, or nothing', () => {
    expect(parseScratchBlocksState(null)).toBeNull()
    expect(parseScratchBlocksState('')).toBeNull()
    expect(parseScratchBlocksState({ a: 1 })).toEqual({ a: 1 })
    expect(parseScratchBlocksState('{"a":1}')).toEqual({ a: 1 })
    expect(() => parseScratchBlocksState('{nope')).toThrow()
  })
})

describe('buildJsonSpriteWorkspaces', () => {
  const sprites = [
    { id: 's1', name: 'Cat' },
    { id: 's2', name: 'Dog' },
  ]

  it('builds one entry per author sprite in task order, keyed by sprite id', () => {
    const result = buildJsonSpriteWorkspaces({ sprites }, { s1: null, s2: flagThenSay })
    expect(result.map((sprite) => [sprite.id, sprite.name])).toEqual([
      ['s1', 'Cat'],
      ['s2', 'Dog'],
    ])
    expect(result[0].workspace.getAllBlocks(false)).toEqual([])
    expect(result[1].workspace.getAllBlocks(false).length).toBe(4)
  })

  it('gives a state not keyed by the first sprite id to the first sprite, as the loader does', () => {
    const result = buildJsonSpriteWorkspaces({ sprites }, flagThenSay)
    expect(result[0].workspace.getAllBlocks(false).length).toBe(4)
  })

  it('falls back to the default sprite and adds the Stage when stage code is on', () => {
    const result = buildJsonSpriteWorkspaces(
      { enableStageCode: true },
      JSON.stringify({ sprite1: flagThenSay, __stage__: flagThenSay })
    )
    expect(result.map((sprite) => sprite.id)).toEqual(['sprite1', '__stage__'])
    expect(result[1].workspace.getAllBlocks(false).length).toBe(4)
  })
})
