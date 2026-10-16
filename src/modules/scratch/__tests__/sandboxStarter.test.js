// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseScratchSandboxStarter, scratchSandboxTask } from '../sandboxStarter.js'
import { getModuleDefinition } from '../../definitions.js'

const STARTER = { sprite1: { blocks: { blocks: [] } } }

describe('parseScratchSandboxStarter (audit #28)', () => {
  it('accepts a JSON string or the state object', () => {
    expect(parseScratchSandboxStarter(JSON.stringify(STARTER))).toEqual(STARTER)
    expect(parseScratchSandboxStarter(STARTER)).toBe(STARTER)
  })

  it('returns null for nothing or something unreadable', () => {
    for (const value of [null, undefined, '', '{not json', '[1]', [], 3]) {
      expect(parseScratchSandboxStarter(value)).toBeNull()
    }
  })

  it('is what the Scratch definition hands the teacher and student sandboxes', () => {
    const scratch = getModuleDefinition('scratch')
    expect(scratch.lifecycle.sandboxStarter({ sandboxStarter: STARTER }, null)).toEqual(STARTER)
    expect(scratch.workSlot.sandbox({ sandboxStarter: STARTER })).toEqual(STARTER)
    expect(
      scratch.lifecycle.sandboxStarter({ sandboxStarter: JSON.stringify(STARTER) }, null)
    ).toEqual(STARTER)
    expect(scratch.lifecycle.sandboxStarter({}, { starterBlocks: STARTER })).toEqual(STARTER)
  })
})

describe('scratchSandboxTask', () => {
  it('is null when the lesson sets no sandbox sprites, toolbox or backdrops', () => {
    expect(scratchSandboxTask({})).toBeNull()
    expect(scratchSandboxTask({ sandboxSprites: [], sandboxToolbox: '  ' })).toBeNull()
  })

  it('carries the sandbox sprites, toolbox and backdrops and nothing else', () => {
    const sprites = [{ id: 'cat', name: 'Cat' }]
    const backdrops = [{ id: 'b1', name: 'Sky', colour: '#87ceeb' }]
    expect(
      scratchSandboxTask({
        sandboxSprites: sprites,
        sandboxBackdrops: backdrops,
        sandboxToolbox: '<xml></xml>',
      })
    ).toEqual({ id: 'scratch-sandbox', sprites, backdrops, toolbox: '<xml></xml>' })
    expect(scratchSandboxTask({ sandboxSprites: sprites })).toEqual({
      id: 'scratch-sandbox',
      sprites,
    })
  })
})
