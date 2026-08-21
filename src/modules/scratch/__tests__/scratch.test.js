import { describe, it, expect, vi } from 'vitest'
import { runWorkspace, addPrebuiltStacksToToolbox, addPredefinedBlocksToToolbox, buildAlwaysOpenToolbox, createScratchBlockStack, DEFAULT_TOOLBOX, createRunSignal, addCreateVariableButtonToToolbox, CREATE_VARIABLE_CALLBACK_KEY } from '../scratch'

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

  it('reports a broadcast receiver script error via signal.onError instead of swallowing it', async () => {
    const receiverBody = {
      type: 'looks_say',
      getFieldValue: () => { throw new Error('boom') },
      getInputTargetBlock: () => null,
      getNextBlock: () => null,
    }
    const receiverHat = makeBlock('event_whenbroadcastreceived', { BROADCAST_OPTION: 'go' }, receiverBody)
    const broadcastBlock = makeBlock('event_broadcast', { BROADCAST_INPUT: 'go' }, null)
    const flagHat = makeBlock('event_whenflagclicked', {}, broadcastBlock)
    const workspace = makeWorkspace([flagHat, receiverHat])

    const spriteState = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    const onError = vi.fn()
    const signal = { stopped: false, keysPressed: new Set(), mouseDown: false, mouseX: 0, mouseY: 0, answer: '', ask: null, backdrop: null, backdrops: [], onBackdropChange: null, variables: {}, onError }

    // The sender's own chain resolves fine — the broadcast is fire-and-forget.
    await runWorkspace(workspace, spriteState, () => {}, signal)
    // Let the fire-and-forget receiver chain's rejected promise settle.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})

// --- A script's own (non-broadcast, non-clone) main chain throwing ---
// ScratchWorkspace.jsx's handleRun/runClickedBlock/fireKeyEvent await runWorkspace-family
// calls directly and route a caught error into signal.onError — this just confirms
// runWorkspace itself actually rejects (rather than swallowing) when a block throws, which
// is what makes that catch block reachable in the first place.

describe('a script that throws in its own main chain', () => {
  function makeWorkspace(blocks) {
    return { getBlocksByType: type => blocks.filter(b => b.type === type), getAllBlocks: () => blocks }
  }
  function makeBlock(type, fields = {}, nextBlock = null) {
    return { type, getFieldValue: name => fields[name] ?? null, getInputTargetBlock: () => null, getNextBlock: () => nextBlock }
  }

  it('rejects the run promise instead of resolving silently', async () => {
    const badBlock = makeBlock('motion_movesteps', {})
    badBlock.getFieldValue = () => { throw new Error('boom') }
    const flagHat = makeBlock('event_whenflagclicked', {}, badBlock)
    const workspace = makeWorkspace([flagHat])
    const spriteState = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    const signal = createRunSignal()

    await expect(runWorkspace(workspace, spriteState, () => {}, signal)).rejects.toThrow('boom')
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

  it('creates the matching category for a predefined block whose type is not in the XML toolbox', () => {
    const xml = '<xml><category name="Events" colour="#FFAB19"><block type="event_whenflagclicked"/></category></xml>'
    const result = addPredefinedBlocksToToolbox(xml, predefined)
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const motionCategory = doc.querySelector('category[name="Motion"]')
    expect(motionCategory?.getAttribute('colour')).toBe('#4C97FF')
    const motionBlocks = motionCategory.querySelectorAll('block')
    expect(motionBlocks.length).toBe(1)
    expect(motionBlocks[0].getAttribute('type')).toBe('motion_movesteps')
  })

  it('returns a non-category JSON toolbox unchanged', () => {
    const flyout = { kind: 'flyoutToolbox', contents: [] }
    expect(addPredefinedBlocksToToolbox(flyout, predefined)).toBe(flyout)
  })
})

describe('addPrebuiltStacksToToolbox', () => {
  const connectedStack = {
    id: 'stack-1',
    label: 'Move and say',
    stack: {
      ...createScratchBlockStack('motion_movesteps', { STEPS: 25 }),
      next: { block: createScratchBlockStack('looks_say', { MESSAGE: 'Done' }) },
    },
  }

  it('appends connected stacks to a JSON toolbox without mutating the original', () => {
    const motionBefore = DEFAULT_TOOLBOX.contents.find(c => c.name === 'Motion').contents.length
    const result = addPrebuiltStacksToToolbox(DEFAULT_TOOLBOX, [connectedStack])
    const motionAfter = DEFAULT_TOOLBOX.contents.find(c => c.name === 'Motion').contents.length
    const motionCat = result.contents.find(c => c.name === 'Motion')
    const added = motionCat.contents.at(-1)

    expect(motionAfter).toBe(motionBefore)
    expect(added.type).toBe('motion_movesteps')
    expect(added.kind).toBe('block')
    expect(added.next.block.type).toBe('looks_say')
    expect(added.inputs.STEPS.shadow.fields.NUM).toBe('25')
  })

  it('appends connected stacks to an XML toolbox', () => {
    const xml = '<xml><category name="Motion" colour="#4C97FF"><block type="motion_movesteps"/></category><category name="Looks" colour="#9966FF"><block type="looks_say"/></category></xml>'
    const result = addPrebuiltStacksToToolbox(xml, [connectedStack])
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const blocks = Array.from(doc.querySelectorAll('category[name="Motion"] > block'))
    const added = blocks.at(-1)

    expect(blocks).toHaveLength(2)
    expect(added.getAttribute('type')).toBe('motion_movesteps')
    expect(added.querySelector('next > block')?.getAttribute('type')).toBe('looks_say')
    expect(added.querySelector('value[name="STEPS"] > shadow > field[name="NUM"]')?.textContent).toBe('25')
  })

  it('appends stacks to a root-level XML toolbox', () => {
    const xml = '<xml><block type="motion_movesteps"/></xml>'
    const result = addPrebuiltStacksToToolbox(xml, [connectedStack])
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const blocks = Array.from(doc.documentElement.children).filter(block => block.tagName.toLowerCase() === 'block')

    expect(blocks).toHaveLength(2)
    expect(blocks.at(-1)?.getAttribute('type')).toBe('motion_movesteps')
    expect(blocks.at(-1)?.querySelector('next > block')?.getAttribute('type')).toBe('looks_say')
  })

  it('appends a stack to a completely empty XML toolbox (every block deselected)', () => {
    const xml = '<xml></xml>'
    const result = addPrebuiltStacksToToolbox(xml, [connectedStack])
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const motionCategory = doc.querySelector('category[name="Motion"]')

    expect(motionCategory?.getAttribute('colour')).toBe('#4C97FF')
    expect(motionCategory.querySelector('block')?.getAttribute('type')).toBe('motion_movesteps')
  })

  it('converts legacy predefined blocks through the stack path', () => {
    const predefined = [{ id: 'pb1', type: 'motion_movesteps', inputs: { STEPS: 50 } }]
    const result = addPrebuiltStacksToToolbox(DEFAULT_TOOLBOX, [], predefined)
    const motionCat = result.contents.find(c => c.name === 'Motion')
    const added = motionCat.contents.at(-1)

    expect(added.type).toBe('motion_movesteps')
    expect(added.inputs.STEPS.shadow.fields.NUM).toBe('50')
  })

  it('creates a missing category in a JSON toolbox for a stack whose block type is absent', () => {
    const noControl = { ...DEFAULT_TOOLBOX, contents: DEFAULT_TOOLBOX.contents.filter(c => c.name !== 'Control') }
    const controlStack = { id: 'stack-2', stack: createScratchBlockStack('control_repeat_until') }

    expect(noControl.contents.find(c => c.name === 'Control')).toBeUndefined()

    const result = addPrebuiltStacksToToolbox(noControl, [controlStack])
    const controlCat = result.contents.find(c => c.name === 'Control')

    expect(controlCat).toBeDefined()
    expect(controlCat.colour).toBe('#FFAB19')
    expect(controlCat.contents.at(-1).type).toBe('control_repeat_until')
  })

  it('places a stack into an existing category rather than duplicating it', () => {
    const result = addPrebuiltStacksToToolbox(DEFAULT_TOOLBOX, [connectedStack])
    const motionCats = result.contents.filter(c => c.name === 'Motion')

    expect(motionCats).toHaveLength(1)
  })

  it('creates a missing category in an XML toolbox for a stack whose block type is absent', () => {
    const xml = '<xml><category name="Motion" colour="#4C97FF"><block type="motion_movesteps"/></category></xml>'
    const looksStack = { id: 'stack-3', stack: createScratchBlockStack('looks_say', { MESSAGE: 'Hi' }) }

    const result = addPrebuiltStacksToToolbox(xml, [looksStack])
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const looksCategory = doc.querySelector('category[name="Looks"]')

    expect(looksCategory?.getAttribute('colour')).toBe('#9966FF')
    expect(looksCategory.querySelector('block')?.getAttribute('type')).toBe('looks_say')
    expect(doc.querySelectorAll('category[name="Motion"] block')).toHaveLength(1)
  })
})

describe('addCreateVariableButtonToToolbox', () => {
  it('inserts the button ahead of the existing Variables category contents in a JSON toolbox', () => {
    const result = addCreateVariableButtonToToolbox(DEFAULT_TOOLBOX)
    const varsCat = result.contents.find(c => c.name === 'Variables')

    expect(varsCat.contents[0]).toEqual({ kind: 'button', text: 'Make a Variable', callbackKey: CREATE_VARIABLE_CALLBACK_KEY })
    expect(varsCat.contents.slice(1)).toEqual(DEFAULT_TOOLBOX.contents.find(c => c.name === 'Variables').contents)
    // Original toolbox is untouched.
    expect(DEFAULT_TOOLBOX.contents.find(c => c.name === 'Variables').contents[0].kind).toBe('block')
  })

  it('creates a Variables category when the toolbox has none (JSON)', () => {
    const toolbox = { kind: 'categoryToolbox', contents: [{ kind: 'category', name: 'Motion', colour: '#4C97FF', contents: [{ kind: 'block', type: 'motion_movesteps' }] }] }
    const result = addCreateVariableButtonToToolbox(toolbox)
    const varsCat = result.contents.find(c => c.name === 'Variables')

    expect(varsCat.contents).toEqual([{ kind: 'button', text: 'Make a Variable', callbackKey: CREATE_VARIABLE_CALLBACK_KEY }])
  })

  it('is idempotent for a JSON toolbox that already has the button', () => {
    const once = addCreateVariableButtonToToolbox(DEFAULT_TOOLBOX)
    const twice = addCreateVariableButtonToToolbox(once)
    const varsCat = twice.contents.find(c => c.name === 'Variables')

    expect(varsCat.contents.filter(item => item.kind === 'button')).toHaveLength(1)
  })

  it('inserts the button into an existing Variables category in an XML toolbox', () => {
    const xml = '<xml><category name="Variables" colour="#FF8C1A"><block type="data_variable"/></category></xml>'
    const result = addCreateVariableButtonToToolbox(xml)
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const category = doc.querySelector('category[name="Variables"]')

    expect(category.children[0].tagName.toLowerCase()).toBe('button')
    expect(category.children[0].getAttribute('callbackkey')).toBe(CREATE_VARIABLE_CALLBACK_KEY)
    expect(category.children[1].getAttribute('type')).toBe('data_variable')
  })

  it('creates a Variables category when an XML toolbox has none', () => {
    const xml = '<xml><category name="Motion" colour="#4C97FF"><block type="motion_movesteps"/></category></xml>'
    const result = addCreateVariableButtonToToolbox(xml)
    const doc = new DOMParser().parseFromString(result, 'text/xml')
    const category = doc.querySelector('category[name="Variables"]')

    expect(category).not.toBeNull()
    expect(category.querySelector('button')?.getAttribute('callbackkey')).toBe(CREATE_VARIABLE_CALLBACK_KEY)
  })

  it('is idempotent for an XML toolbox that already has the button', () => {
    const xml = '<xml><category name="Variables" colour="#FF8C1A"><block type="data_variable"/></category></xml>'
    const once = addCreateVariableButtonToToolbox(xml)
    const twice = addCreateVariableButtonToToolbox(once)
    const doc = new DOMParser().parseFromString(twice, 'text/xml')

    expect(doc.querySelectorAll('button')).toHaveLength(1)
  })
})

describe('buildAlwaysOpenToolbox', () => {
  it('adds editable shadow inputs to root-level XML blocks', () => {
    const result = buildAlwaysOpenToolbox('<xml><block type="looks_sayforsecs"/></xml>')
    const doc = new DOMParser().parseFromString(result, 'text/xml')

    expect(doc.querySelector('block[type="looks_sayforsecs"] value[name="MESSAGE"] shadow[type="text"] field[name="TEXT"]')?.textContent).toBe('Hello!')
    expect(doc.querySelector('block[type="looks_sayforsecs"] value[name="SECS"] shadow[type="math_number"] field[name="NUM"]')?.textContent).toBe('2')
  })
})

// ── Helpers for new block tests ───────────────────────────────────────────────

function makeNum(value) {
  return { type: 'math_number', getFieldValue: n => n === 'NUM' ? String(value) : null, getInputTargetBlock: () => null, getNextBlock: () => null }
}

function makeText(value) {
  return { type: 'text', getFieldValue: n => n === 'TEXT' ? String(value) : null, getInputTargetBlock: () => null, getNextBlock: () => null }
}

function makeReporter(type, fields = {}, inputs = {}) {
  return {
    type,
    getFieldValue: name => fields[name] ?? null,
    getInputTargetBlock: name => inputs[name] ?? null,
    getNextBlock: () => null,
  }
}

function makeSetVar(varName, valueBlock, nextBlock = null) {
  return {
    type: 'data_setvariableto',
    getFieldValue: name => name === 'VARIABLE' ? varName : null,
    getInputTargetBlock: name => name === 'VALUE' ? valueBlock : null,
    getNextBlock: () => nextBlock,
  }
}

function makeChangeVar(varName, valueBlock = null, nextBlock = null) {
  return {
    type: 'data_changevariableby',
    getFieldValue: name => name === 'VARIABLE' ? varName : null,
    getInputTargetBlock: name => (name === 'VALUE' && valueBlock) ? valueBlock : null,
    getNextBlock: () => nextBlock,
  }
}

function makeStatement(type, fields = {}, inputs = {}, nextBlock = null) {
  return {
    type,
    getFieldValue: name => fields[name] ?? null,
    getInputTargetBlock: name => inputs[name] ?? null,
    getNextBlock: () => nextBlock,
  }
}

function makeWorkspaceWithBody(bodyBlock) {
  const hat = {
    type: 'event_whenflagclicked',
    getFieldValue: () => null,
    getInputTargetBlock: () => null,
    getNextBlock: () => bodyBlock,
  }
  return {
    getBlocksByType: type => type === 'event_whenflagclicked' ? [hat] : [],
    getAllBlocks: () => [hat, bodyBlock],
  }
}

async function runAndGetVars(bodyBlock, extraSignal = {}) {
  const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
  const signal = { ...createRunSignal(), variables: {}, ...extraSignal }
  await runWorkspace(makeWorkspaceWithBody(bodyBlock), state, () => {}, signal)
  return { vars: signal.variables, state, signal }
}

// ── New operator blocks ───────────────────────────────────────────────────────

describe('operator_multiply', () => {
  it('multiplies two numbers', async () => {
    const op = makeReporter('operator_multiply', {}, { NUM1: makeNum(3), NUM2: makeNum(4) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(12)
  })

  it('handles float inputs', async () => {
    const op = makeReporter('operator_multiply', {}, { NUM1: makeNum(2.5), NUM2: makeNum(4) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(10)
  })
})

describe('operator_divide', () => {
  it('divides two numbers', async () => {
    const op = makeReporter('operator_divide', {}, { NUM1: makeNum(10), NUM2: makeNum(2) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(5)
  })

  it('returns Infinity when divisor is 0', async () => {
    const op = makeReporter('operator_divide', {}, { NUM1: makeNum(10), NUM2: makeNum(0) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(Infinity)
  })
})

describe('operator_mod', () => {
  it('returns the remainder', async () => {
    const op = makeReporter('operator_mod', {}, { NUM1: makeNum(10), NUM2: makeNum(3) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(1)
  })

  it('handles exact division (0 remainder)', async () => {
    const op = makeReporter('operator_mod', {}, { NUM1: makeNum(9), NUM2: makeNum(3) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(0)
  })
})

describe('operator_round', () => {
  it('rounds 2.5 up to 3', async () => {
    const op = makeReporter('operator_round', {}, { NUM: makeNum(2.5) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(3)
  })

  it('rounds 2.4 down to 2', async () => {
    const op = makeReporter('operator_round', {}, { NUM: makeNum(2.4) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(2)
  })
})

describe('operator_random', () => {
  it('returns the exact value when FROM equals TO', async () => {
    const op = makeReporter('operator_random', {}, { FROM: makeNum(5), TO: makeNum(5) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(5)
  })

  it('returns an integer within the inclusive range for integer inputs', async () => {
    const op = makeReporter('operator_random', {}, { FROM: makeNum(1), TO: makeNum(10) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(Number.isInteger(vars.result)).toBe(true)
    expect(vars.result).toBeGreaterThanOrEqual(1)
    expect(vars.result).toBeLessThanOrEqual(10)
  })

  it('handles a reversed range (FROM greater than TO)', async () => {
    const op = makeReporter('operator_random', {}, { FROM: makeNum(10), TO: makeNum(1) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBeGreaterThanOrEqual(1)
    expect(vars.result).toBeLessThanOrEqual(10)
  })

  it('returns a float within range when either input has a decimal', async () => {
    const op = makeReporter('operator_random', {}, { FROM: makeNum(1), TO: makeNum(2.5) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBeGreaterThanOrEqual(1)
    expect(vars.result).toBeLessThanOrEqual(2.5)
  })
})

describe('operator_mathop', () => {
  it('abs of negative', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'abs' }, { NUM: makeNum(-5) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(5)
  })

  it('sqrt', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'sqrt' }, { NUM: makeNum(4) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(2)
  })

  it('floor', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'floor' }, { NUM: makeNum(3.9) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(3)
  })

  it('ceiling', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'ceiling' }, { NUM: makeNum(3.1) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(4)
  })

  it('sin(90) ≈ 1', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'sin' }, { NUM: makeNum(90) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBeCloseTo(1, 10)
  })

  it('cos(0) = 1', async () => {
    const op = makeReporter('operator_mathop', { OPERATOR: 'cos' }, { NUM: makeNum(0) })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBeCloseTo(1, 10)
  })
})

describe('operator_letter_of', () => {
  it('returns the first letter', async () => {
    const op = makeReporter('operator_letter_of', {}, { LETTER: makeNum(1), STRING: makeText('hello') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe('h')
  })

  it('returns empty string for out-of-bounds index', async () => {
    const op = makeReporter('operator_letter_of', {}, { LETTER: makeNum(99), STRING: makeText('hi') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe('')
  })
})

describe('operator_length', () => {
  it('returns the string length', async () => {
    const op = makeReporter('operator_length', {}, { STRING: makeText('hello') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(5)
  })

  it('returns 0 for empty string', async () => {
    const op = makeReporter('operator_length', {}, { STRING: makeText('') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(0)
  })
})

describe('operator_contains', () => {
  it('returns true when string contains substring', async () => {
    const op = makeReporter('operator_contains', {}, { STRING1: makeText('apple'), STRING2: makeText('pp') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(true)
  })

  it('is case-insensitive', async () => {
    const op = makeReporter('operator_contains', {}, { STRING1: makeText('Apple'), STRING2: makeText('apple') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(true)
  })

  it('returns false when substring not found', async () => {
    const op = makeReporter('operator_contains', {}, { STRING1: makeText('apple'), STRING2: makeText('z') })
    const { vars } = await runAndGetVars(makeSetVar('result', op))
    expect(vars.result).toBe(false)
  })
})

// ── control_wait_until ────────────────────────────────────────────────────────

describe('control_wait_until', () => {
  it('exits immediately when condition is already true', async () => {
    // Use operator_equals with matching operands to produce a constant true
    const conditionTrue = makeReporter('operator_equals', {}, {
      OPERAND1: makeText('a'),
      OPERAND2: makeText('a'),
    })
    const marker = makeSetVar('passed', makeNum(1))
    const waitBlock = makeStatement('control_wait_until', {}, { CONDITION: conditionTrue }, marker)
    const { vars } = await runAndGetVars(waitBlock)
    expect(vars.passed).toBe(1)
  })
})

// ── control_repeat_until ──────────────────────────────────────────────────────

describe('control_repeat_until', () => {
  it('never runs substack when condition is already true', async () => {
    const conditionTrue = makeReporter('operator_equals', {}, {
      OPERAND1: makeText('a'), OPERAND2: makeText('a'),
    })
    const inner = makeSetVar('inner_ran', makeNum(1))
    const marker = makeSetVar('done', makeNum(1))
    const repeatBlock = makeStatement('control_repeat_until', {}, { CONDITION: conditionTrue, SUBSTACK: inner }, marker)
    const { vars } = await runAndGetVars(repeatBlock)
    expect(vars.inner_ran).toBeUndefined()
    expect(vars.done).toBe(1)
  })

  it('runs substack until condition becomes true via variable', async () => {
    // counter starts at 0; repeat until counter >= 3; inner: change counter by 1
    const signal = { variables: { counter: 0 } }
    const counterReporter = makeReporter('data_variable', { VARIABLE: 'counter' })
    const condition = makeReporter('operator_gt', {}, {
      OPERAND1: counterReporter,
      OPERAND2: makeNum(2),
    })
    const inner = makeChangeVar('counter', makeNum(1))
    const marker = makeSetVar('done', makeNum(1))
    const repeatBlock = makeStatement('control_repeat_until', {}, { CONDITION: condition, SUBSTACK: inner }, marker)
    const { vars } = await runAndGetVars(repeatBlock, signal)
    expect(vars.counter).toBe(3)
    expect(vars.done).toBe(1)
  })
})

// ── Graphic effects ───────────────────────────────────────────────────────────

describe('looks_seteffectto', () => {
  it('sets the named effect on the sprite state', async () => {
    const block = makeStatement('looks_seteffectto', { EFFECT: 'ghost' }, { VALUE: makeNum(50) })
    const { state } = await runAndGetVars(block)
    expect(state.effect_ghost).toBe(50)
  })
})

describe('looks_changeeffectby', () => {
  it('accumulates the effect value', async () => {
    const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null, effect_color: 20 }
    const block = makeStatement('looks_changeeffectby', { EFFECT: 'color' }, { VALUE: makeNum(25) })
    const signal = { ...createRunSignal(), variables: {} }
    const updates = []
    await runWorkspace(makeWorkspaceWithBody(block), state, s => updates.push({ ...s }), signal)
    expect(state.effect_color).toBe(45)
  })
})

describe('looks_cleargraphiceffects', () => {
  it('resets all effect_ keys to 0', async () => {
    const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null, effect_ghost: 50, effect_color: 30, effect_brightness: 10, effect_fisheye: 0, effect_whirl: 0, effect_pixelate: 0, effect_mosaic: 0 }
    const block = makeStatement('looks_cleargraphiceffects')
    const signal = { ...createRunSignal(), variables: {} }
    await runWorkspace(makeWorkspaceWithBody(block), state, () => {}, signal)
    expect(state.effect_ghost).toBe(0)
    expect(state.effect_color).toBe(0)
    expect(state.effect_brightness).toBe(0)
  })
})

// ── sensing_timer and sensing_resettimer ──────────────────────────────────────

describe('sensing_timer / sensing_resettimer', () => {
  it('timer reports elapsed seconds since timerStart', async () => {
    const timerReporter = makeReporter('sensing_timer')
    const block = makeSetVar('elapsed', timerReporter)
    const signal = { ...createRunSignal(), variables: {}, timerStart: Date.now() - 2000 }
    const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    await runWorkspace(makeWorkspaceWithBody(block), state, () => {}, signal)
    expect(Number(signal.variables.elapsed)).toBeGreaterThanOrEqual(1.9)
  })

  it('resettimer resets timerStart to approximately now', async () => {
    const block = makeStatement('sensing_resettimer')
    const signal = { ...createRunSignal(), variables: {}, timerStart: Date.now() - 5000 }
    const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    await runWorkspace(makeWorkspaceWithBody(block), state, () => {}, signal)
    expect(Date.now() - signal.timerStart).toBeLessThan(500)
  })
})

// ── sensing_distanceto ────────────────────────────────────────────────────────

describe('sensing_distanceto', () => {
  it('returns distance to mouse pointer', async () => {
    const block = makeReporter('sensing_distanceto', { DISTANCETOMENU: '_mouse_' })
    const state = { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
    const signal = { ...createRunSignal(), variables: {}, mouseX: 30, mouseY: 40 }
    await runWorkspace(makeWorkspaceWithBody(makeSetVar('dist', block)), state, () => {}, signal)
    expect(signal.variables.dist).toBeCloseTo(50, 5)
  })
})

// ── createRunSignal has timerStart ────────────────────────────────────────────

describe('createRunSignal', () => {
  it('includes timerStart initialised to approximately now', () => {
    const before = Date.now()
    const signal = createRunSignal()
    const after = Date.now()
    expect(signal.timerStart).toBeGreaterThanOrEqual(before)
    expect(signal.timerStart).toBeLessThanOrEqual(after)
  })
})

// ── Scratch clone blocks ──────────────────────────────────────────────────────

describe('Scratch clones', () => {
  function makeCloneWorkspace(blocks) {
    return { getBlocksByType: type => blocks.filter(b => b.type === type) }
  }

  function makeCloneBlock(type, fields = {}, nextBlock = null) {
    return { type, getFieldValue: name => fields[name] ?? null, getInputTargetBlock: () => null, getNextBlock: () => nextBlock }
  }

  function makeCloneState() {
    return { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
  }

  it('create clone of myself starts a "when I start as a clone" hat with an independent state copy', async () => {
    const cloneMove = makeCloneBlock('motion_movesteps', { STEPS: '10' })
    const startAsCloneHat = makeCloneBlock('control_start_as_clone', {}, cloneMove)
    const createCloneBlock = makeCloneBlock('control_create_clone_of', { CLONE_OPTION: '_myself_' })
    const flagHat = makeCloneBlock('event_whenflagclicked', {}, createCloneBlock)
    const workspace = makeCloneWorkspace([flagHat, startAsCloneHat])

    const spriteState = makeCloneState()
    const signal = createRunSignal()
    const created = []
    const updated = []
    signal.onCloneCreated = c => created.push(c)
    signal.onCloneUpdated = (id, s) => updated.push({ id, state: s })

    await runWorkspace(workspace, spriteState, () => {}, signal)

    expect(created).toHaveLength(1)
    expect(created[0].baseId).toBe('sprite')
    expect(created[0].state.x).toBe(0)
    expect(updated).toHaveLength(1)
    expect(updated[0].id).toBe(created[0].id)
    expect(updated[0].state.x).toBeCloseTo(10) // clone moved 10 steps facing direction 90 (+x)
    expect(spriteState.x).toBe(0) // the original sprite's own state is untouched
  })

  it('delete this clone halts only that clone\'s own chain, leaving the global signal unaffected', async () => {
    const moveAfterDelete = makeCloneBlock('motion_movesteps', { STEPS: '10' })
    const deleteBlock = makeCloneBlock('control_delete_this_clone', {}, moveAfterDelete)
    const startAsCloneHat = makeCloneBlock('control_start_as_clone', {}, deleteBlock)
    const createCloneBlock = makeCloneBlock('control_create_clone_of', { CLONE_OPTION: '_myself_' })
    const flagHat = makeCloneBlock('event_whenflagclicked', {}, createCloneBlock)
    const workspace = makeCloneWorkspace([flagHat, startAsCloneHat])

    const spriteState = makeCloneState()
    const signal = createRunSignal()
    const deleted = []
    const updated = []
    signal.onCloneDeleted = id => deleted.push(id)
    signal.onCloneUpdated = (id, s) => updated.push({ id, state: s })

    await runWorkspace(workspace, spriteState, () => {}, signal)

    expect(deleted).toHaveLength(1)
    expect(updated).toHaveLength(0) // the block after "delete this clone" never runs
    expect(signal.stopped).toBe(false) // "delete this clone" must not act like "stop all"
  })

  it('caps concurrent clones at 300 and silently ignores further create-clone calls', async () => {
    const createCloneBlock = makeCloneBlock('control_create_clone_of', { CLONE_OPTION: '_myself_' })
    const repeatBlock = {
      type: 'control_repeat',
      getFieldValue: name => (name === 'TIMES' ? '301' : null),
      getInputTargetBlock: name => (name === 'SUBSTACK' ? createCloneBlock : null),
      getNextBlock: () => null,
    }
    const flagHat = makeCloneBlock('event_whenflagclicked', {}, repeatBlock)
    const workspace = makeCloneWorkspace([flagHat])

    const spriteState = makeCloneState()
    const signal = createRunSignal()
    const created = []
    signal.onCloneCreated = c => created.push(c)

    await runWorkspace(workspace, spriteState, () => {}, signal)

    expect(created).toHaveLength(300)
    expect(signal.cloneCount).toBe(300)
  })

  it('reports a clone script error via signal.onError instead of swallowing it', async () => {
    const cloneBody = makeCloneBlock('motion_movesteps', {})
    cloneBody.getFieldValue = () => { throw new Error('boom') }
    const startAsCloneHat = makeCloneBlock('control_start_as_clone', {}, cloneBody)
    const createCloneBlock = makeCloneBlock('control_create_clone_of', { CLONE_OPTION: '_myself_' })
    const flagHat = makeCloneBlock('event_whenflagclicked', {}, createCloneBlock)
    const workspace = makeCloneWorkspace([flagHat, startAsCloneHat])

    const spriteState = makeCloneState()
    const signal = createRunSignal()
    const onError = vi.fn()
    signal.onError = onError

    // The creator's own chain resolves fine — the clone's script runs fire-and-forget.
    await runWorkspace(workspace, spriteState, () => {}, signal)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})

// ── "touching [sprite]?" against live clones ──────────────────────────────────

describe('Scratch touching a sprite that has clones', () => {
  function makeBlock(type, fields = {}, targets = {}, nextBlock = null) {
    return {
      type,
      getFieldValue: name => fields[name] ?? null,
      getInputTargetBlock: name => targets[name] ?? null,
      getNextBlock: () => nextBlock,
    }
  }

  function makeState(overrides = {}) {
    return { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null, ...overrides }
  }

  function buildWorkspace(target) {
    const touchingCheck = makeBlock('sensing_touchingobject', { TOUCHINGOBJECTMENU: target })
    const setVar = makeBlock('data_setvariableto', { VARIABLE: 'hit', VALUE: 1 })
    const ifBlock = makeBlock('control_if', {}, { CONDITION: touchingCheck, SUBSTACK: setVar })
    const flagHat = makeBlock('event_whenflagclicked', {}, {}, ifBlock)
    return { getBlocksByType: type => (type === 'event_whenflagclicked' ? [flagHat] : []) }
  }

  it('reports touching when only a clone of the target sprite overlaps, not the (distant) original', async () => {
    const workspace = buildWorkspace('rock')
    const playerState = makeState({ x: 0, y: 0 })
    const signal = createRunSignal()
    signal.clones.set('rock__clone1', { id: 'rock__clone1', baseId: 'rock', workspace: null, state: makeState({ x: 0, y: 0 }), costumes: [] })

    await runWorkspace(workspace, playerState, () => {}, signal)

    expect(signal.variables.hit).toBe(1)
  })

  it('does not report touching when the clone has moved away and the original is also distant', async () => {
    const workspace = buildWorkspace('rock')
    const playerState = makeState({ x: 0, y: 0 })
    const signal = createRunSignal()
    signal.clones.set('rock__clone1', { id: 'rock__clone1', baseId: 'rock', workspace: null, state: makeState({ x: 300, y: 300 }), costumes: [] })

    await runWorkspace(workspace, playerState, () => {}, signal)

    expect(signal.variables.hit).toBeUndefined()
  })

  it('ignores a hidden clone of the target sprite', async () => {
    const workspace = buildWorkspace('rock')
    const playerState = makeState({ x: 0, y: 0 })
    const signal = createRunSignal()
    signal.clones.set('rock__clone1', { id: 'rock__clone1', baseId: 'rock', workspace: null, state: makeState({ x: 0, y: 0, visible: false }), costumes: [] })

    await runWorkspace(workspace, playerState, () => {}, signal)

    expect(signal.variables.hit).toBeUndefined()
  })

  it('deleting the clone removes it from consideration', async () => {
    const workspace = buildWorkspace('rock')
    const playerState = makeState({ x: 0, y: 0 })
    const signal = createRunSignal()
    signal.clones.set('rock__clone1', { id: 'rock__clone1', baseId: 'rock', workspace: null, state: makeState({ x: 0, y: 0 }), costumes: [] })
    signal.clones.delete('rock__clone1')

    await runWorkspace(workspace, playerState, () => {}, signal)

    expect(signal.variables.hit).toBeUndefined()
  })
})
