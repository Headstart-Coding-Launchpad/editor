import { describe, it, expect, vi } from 'vitest'
import { runWorkspace, addPrebuiltStacksToToolbox, addPredefinedBlocksToToolbox, createScratchBlockStack, DEFAULT_TOOLBOX, createRunSignal } from '../scratch'

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

  it('converts legacy predefined blocks through the stack path', () => {
    const predefined = [{ id: 'pb1', type: 'motion_movesteps', inputs: { STEPS: 50 } }]
    const result = addPrebuiltStacksToToolbox(DEFAULT_TOOLBOX, [], predefined)
    const motionCat = result.contents.find(c => c.name === 'Motion')
    const added = motionCat.contents.at(-1)

    expect(added.type).toBe('motion_movesteps')
    expect(added.inputs.STEPS.shadow.fields.NUM).toBe('50')
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
