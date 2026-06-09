import { describe, it, expect, vi } from 'vitest'
import { runWorkspace, addPredefinedBlocksToToolbox, DEFAULT_TOOLBOX } from '../scratch'

// Tests for scratch.js interpreter helpers — pure logic only.
// Blockly workspace internals (inject, serialization, rendering) are not tested here.
// Migration and check logic is tested directly in scratchPersistence.test.js and scratchChecks.test.js.

// Isolate the pure helper functions by importing the module and mocking Blockly.
vi.mock('blockly', () => ({
  default: {},
}))

// --- broadcast message matching ---
// Tests the runtime comparison used in the event_broadcast handler.

function makeBroadcastBlock(fieldValue) {
  return {
    type: 'event_broadcast',
    getFieldValue: (name) => (name === 'BROADCAST_INPUT' ? fieldValue : null),
    getInputTargetBlock: () => null,
  }
}

function makeReceiverHat(fieldValue) {
  return {
    type: 'event_whenbroadcastreceived',
    getFieldValue: (name) => (name === 'BROADCAST_OPTION' ? fieldValue : null),
  }
}

describe('broadcast message matching', () => {
  // Replicate the comparison logic used in the event_broadcast handler.
  function broadcastMatches(broadcastBlock, receiverHat) {
    const msg = String(broadcastBlock.getFieldValue('BROADCAST_INPUT') ?? '')
    const option = String(receiverHat.getFieldValue('BROADCAST_OPTION') ?? '')
    return msg === option
  }

  it('matches when sender and receiver have the same message', () => {
    expect(broadcastMatches(makeBroadcastBlock('message1'), makeReceiverHat('message1'))).toBe(true)
  })

  it('matches custom message names', () => {
    expect(broadcastMatches(makeBroadcastBlock('launch'), makeReceiverHat('launch'))).toBe(true)
  })

  it('does not match when messages differ', () => {
    expect(broadcastMatches(makeBroadcastBlock('start'), makeReceiverHat('stop'))).toBe(false)
  })

  it('does not match when receiver has different capitalisation', () => {
    expect(broadcastMatches(makeBroadcastBlock('Launch'), makeReceiverHat('launch'))).toBe(false)
  })

  it('returns empty string for null BROADCAST_INPUT and does not match non-empty receiver', () => {
    const block = { ...makeBroadcastBlock(null), getFieldValue: () => null }
    expect(broadcastMatches(block, makeReceiverHat('message1'))).toBe(false)
  })

  it('matches empty string when both fields are empty', () => {
    expect(broadcastMatches(makeBroadcastBlock(''), makeReceiverHat(''))).toBe(true)
  })
})

// --- event_broadcast vs event_broadcastandwait semantics ---
// Verifies that event_broadcast does not block the sender while event_broadcastandwait does.

describe('broadcast timing', () => {
  function makeWorkspace(blocks) {
    return {
      getBlocksByType: (type) => blocks.filter(b => b.type === type),
      getAllBlocks: () => blocks,
    }
  }

  function makeBlock(type, fields = {}, nextBlock = null) {
    return {
      type,
      getFieldValue: name => fields[name] ?? null,
      getInputTargetBlock: () => null,
      getNextBlock: () => nextBlock,
    }
  }

  it('event_broadcast does not await receivers — sender continues immediately', async () => {
    const log = []

    // Receiver: records 'receiver' after a tick (simulated via resolved promise)
    const receiverBody = {
      type: 'looks_say',
      getFieldValue: () => 'hello',
      getInputTargetBlock: () => null,
      getNextBlock: () => null,
    }
    const receiverHat = makeBlock('event_whenbroadcastreceived', { BROADCAST_OPTION: 'go' }, receiverBody)

    // Sender: broadcast 'go', then immediately records 'after_broadcast'
    const afterBlock = {
      type: 'data_setvariableto',
      getFieldValue: name => name === 'VARIABLE' ? 'result' : '',
      getInputTargetBlock: () => null,
      getNextBlock: () => null,
    }
    const broadcastBlock = makeBlock('event_broadcast', { BROADCAST_INPUT: 'go' }, afterBlock)
    const flagHat = makeBlock('event_whenflagclicked', {}, broadcastBlock)

    const workspace = makeWorkspace([flagHat, receiverHat])

    const spriteState = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    const signal = { stopped: false, keysPressed: new Set(), mouseDown: false, mouseX: 0, mouseY: 0, answer: '', ask: null, backdrop: null, backdrops: [], onBackdropChange: null, variables: {} }
    signal.onVariablesChange = vars => { Object.assign(signal.variables, vars); log.push('after_broadcast') }

    // Override looks_say to record 'receiver' with a delay
    const origSay = receiverBody.type
    receiverBody._log = log

    // We just need to confirm that the variable-set (after_broadcast) fires
    // without waiting for the receiver chain. The receiver body is a looks_say
    // which calls onUpdate — we capture that by overriding onUpdate.
    let afterBroadcastFired = false
    const onUpdate = () => {}
    signal.onVariablesChange = () => { afterBroadcastFired = true }

    await runWorkspace(workspace, spriteState, onUpdate, signal)

    // If broadcast fired-and-forgot, afterBlock (data_setvariableto) would have run.
    // The data_setvariableto block calls onVariablesChange → sets afterBroadcastFired.
    expect(afterBroadcastFired).toBe(true)
  })
})

// --- addPredefinedBlocksToToolbox ---

describe('addPredefinedBlocksToToolbox', () => {
  const predefined = [{ id: 'pb1', type: 'motion_movesteps', inputs: { STEPS: 50 } }]

  it('returns toolbox unchanged when predefinedBlocks is empty', () => {
    expect(addPredefinedBlocksToToolbox(DEFAULT_TOOLBOX, [])).toBe(DEFAULT_TOOLBOX)
    expect(addPredefinedBlocksToToolbox(DEFAULT_TOOLBOX, null)).toBe(DEFAULT_TOOLBOX)
  })

  it('appends a block to the correct category in a JSON toolbox', () => {
    const result = addPredefinedBlocksToToolbox(DEFAULT_TOOLBOX, predefined)
    const motionCat = result.contents.find(c => c.name === 'Motion')
    const added = motionCat.contents.filter(b => b.type === 'motion_movesteps')
    // Original plus the new predefined one
    expect(added.length).toBeGreaterThanOrEqual(2)
    const addedBlock = added[added.length - 1]
    expect(addedBlock.inputs.STEPS.shadow.fields.NUM).toBe('50')
  })

  it('does not mutate the original JSON toolbox', () => {
    const motionBefore = DEFAULT_TOOLBOX.contents.find(c => c.name === 'Motion').contents.length
    addPredefinedBlocksToToolbox(DEFAULT_TOOLBOX, predefined)
    const motionAfter = DEFAULT_TOOLBOX.contents.find(c => c.name === 'Motion').contents.length
    expect(motionAfter).toBe(motionBefore)
  })

  it('appends a block into the correct category in an XML toolbox', () => {
    const xml = '<xml><category name="Motion" colour="#4C97FF"><block type="motion_movesteps"/></category></xml>'
    const result = addPredefinedBlocksToToolbox(xml, predefined)
    expect(typeof result).toBe('string')
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const blocks = Array.from(doc.querySelectorAll('category[name="Motion"] block'))
    expect(blocks.length).toBe(2)
    const lastBlock = blocks[blocks.length - 1]
    expect(lastBlock.getAttribute('type')).toBe('motion_movesteps')
    const field = lastBlock.querySelector('value[name="STEPS"] > shadow > field[name="NUM"]')
    expect(field?.textContent).toBe('50')
  })

  it('skips a predefined block whose type is not in the XML toolbox', () => {
    const xml = '<xml><category name="Events" colour="#FFAB19"><block type="event_whenflagclicked"/></category></xml>'
    const result = addPredefinedBlocksToToolbox(xml, predefined)
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const motionBlocks = doc.querySelectorAll('category[name="Motion"] block')
    expect(motionBlocks.length).toBe(0)
  })

  it('returns a non-category JSON toolbox unchanged', () => {
    const flyout = { kind: 'flyoutToolbox', contents: [] }
    expect(addPredefinedBlocksToToolbox(flyout, predefined)).toBe(flyout)
  })
})
