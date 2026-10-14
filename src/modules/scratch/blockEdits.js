// Small, pure edits to stored Scratch workspace JSON, for `lessons test-checks --cases`: a case
// starts from one of the task's stages and applies edits to make a student variation (a block
// appended at the bottom, the wrong sound block, a dropdown left on its default). No Blockly, no
// DOM. Each edit throws an Error naming the edit (`edit N (op)`) when it can't be applied.
//
// States are keyed by sprite id (plus `__stage__`), each `{ blocks: { blocks: [...] } }`, as
// stillBuilding.js and jsonWorkspace.js read them. See docs/authoring/scratch.md "Testing
// student variations".
//
// Edits (`op`):
// - appendBlock: add a block (`block`: raw Blockly JSON, or `opcode` + `fields` + `inputs`).
//   Where: `after` a block, `inside` a C block's `input` (default SUBSTACK, at its end),
//   `newScript: true` (loose on the canvas), else at the bottom of `script` N (default 1).
// - replaceOpcode: change `target`'s opcode to `opcode`, keeping its fields and inputs; `fields`
//   and `inputs` are merged over them.
// - setField: set `field` on `target` to `value` (its own field, else the shadow or block in the
//   input of that name: NUM, TEXT, or the menu's only field).
// - removeBlock: remove `target`; the blocks below it move up, unless `withBelow: true`.
//
// A `target` (and `after` / `inside`) is an opcode string, `{ opcode, nth }` (the nth block with
// that opcode in reading order: scripts in order, each block before its inputs and the blocks
// below it; nth counts from 1), or `{ path: [script, position] }` (counting from 1 down the
// script's top-level stack). `sprite` (name or id; default the first sprite) picks the workspace.

import { DEFAULT_SPRITES } from './checks.js'

export const BLOCK_EDIT_OPS = ['appendBlock', 'replaceOpcode', 'setField', 'removeBlock']

const STAGE_ID = '__stage__'
const STATEMENT_INPUT = /^SUBSTACK\d*$/

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function resolveSpriteId(sprite, spriteList) {
  const sprites = spriteList.length > 0 ? spriteList : DEFAULT_SPRITES
  if (sprite == null || sprite === '') return sprites[0].id
  const wanted = String(sprite)
  if (wanted === STAGE_ID || wanted.toLowerCase() === 'stage') return STAGE_ID
  const match =
    sprites.find((s) => String(s.id) === wanted) ??
    sprites.find((s) => String(s.name).toLowerCase() === wanted.toLowerCase())
  if (!match) {
    const names = sprites.map((s) => s.name).join(', ')
    throw new Error(`no sprite is named "${wanted}" (sprites: ${names || 'none'})`)
  }
  return match.id
}

function topBlocks(states, spriteId) {
  if (!isPlainObject(states[spriteId])) states[spriteId] = {}
  const state = states[spriteId]
  if (!isPlainObject(state.blocks)) state.blocks = { languageVersion: 0, blocks: [] }
  if (!Array.isArray(state.blocks.blocks)) state.blocks.blocks = []
  return state.blocks.blocks
}

// Every block in reading order, each with a `detach()` that unhooks it from where it sits
// (keeping the blocks below it when `keepBelow`) and a `parent` description.
function walk(top) {
  const found = []
  function visit(block, place) {
    if (!isPlainObject(block)) return
    found.push({ block, place })
    for (const [name, input] of Object.entries(block.inputs ?? {})) {
      if (isPlainObject(input?.block)) {
        visit(input.block, { kind: 'input', owner: block, input: name })
      }
    }
    if (isPlainObject(block.next?.block)) {
      visit(block.next.block, { kind: 'next', owner: block })
    }
  }
  top.forEach((block, index) => visit(block, { kind: 'top', list: top, index }))
  return found
}

function findBlock(top, locator) {
  if (Array.isArray(locator?.path)) {
    const [scriptNo, position = 1] = locator.path.map(Number)
    let block = top[scriptNo - 1]
    if (!block) throw new Error(`there is no script ${scriptNo} (${top.length} scripts)`)
    for (let i = 1; i < position && block; i++) block = block.next?.block
    if (!block) throw new Error(`script ${scriptNo} has no block at position ${position}`)
    return walk(top).find((entry) => entry.block === block)
  }
  const opcode = typeof locator === 'string' ? locator : locator?.opcode
  if (!opcode) throw new Error('a block is located by an opcode, { opcode, nth } or { path }')
  const nth = Number(typeof locator === 'object' ? (locator.nth ?? 1) : 1)
  const matches = walk(top).filter((entry) => entry.block.type === opcode)
  if (matches.length === 0) throw new Error(`no ${opcode} block`)
  if (!matches[nth - 1]) throw new Error(`only ${matches.length} ${opcode} block(s), not ${nth}`)
  return matches[nth - 1]
}

function lastInChain(block) {
  let current = block
  while (isPlainObject(current.next?.block)) current = current.next.block
  return current
}

function shadowFor(value) {
  if (typeof value === 'number') {
    return { shadow: { type: 'math_number', fields: { NUM: String(value) } } }
  }
  return { shadow: { type: 'text', fields: { TEXT: String(value ?? '') } } }
}

// `inputs` values: raw Blockly input JSON ({ block } / { shadow }) passes through; a number
// becomes a math_number shadow and any other value a text shadow.
function buildInputs(inputs) {
  const out = {}
  for (const [name, value] of Object.entries(inputs ?? {})) {
    out[name] =
      isPlainObject(value) && (value.block || value.shadow) ? clone(value) : shadowFor(value)
  }
  return out
}

let generatedId = 0

function buildBlock(edit) {
  if (edit.block != null) {
    if (!isPlainObject(edit.block) || !edit.block.type) {
      throw new Error('`block` must be a Blockly block object with a type')
    }
    return clone(edit.block)
  }
  if (!edit.opcode) throw new Error('needs an `opcode` (or a whole `block`)')
  generatedId += 1
  const block = { type: edit.opcode, id: `case-${generatedId}` }
  if (edit.fields != null) {
    if (!isPlainObject(edit.fields)) throw new Error('`fields` must be an object')
    block.fields = clone(edit.fields)
  }
  if (edit.inputs != null) {
    if (!isPlainObject(edit.inputs)) throw new Error('`inputs` must be an object')
    block.inputs = buildInputs(edit.inputs)
  }
  return block
}

function appendBlock(top, edit) {
  const block = buildBlock(edit)
  if (edit.after != null) {
    const { block: anchor } = findBlock(top, edit.after)
    if (anchor.next?.block) lastInChain(block).next = { block: anchor.next.block }
    anchor.next = { block }
    return
  }
  if (edit.inside != null) {
    const { block: owner } = findBlock(top, edit.inside)
    const input = edit.input ?? 'SUBSTACK'
    if (!STATEMENT_INPUT.test(input)) {
      throw new Error(`"${input}" is not a statement input (SUBSTACK, SUBSTACK2)`)
    }
    owner.inputs = owner.inputs ?? {}
    const first = owner.inputs[input]?.block
    if (first) lastInChain(first).next = { block }
    else owner.inputs[input] = { ...(owner.inputs[input] ?? {}), block }
    return
  }
  if (edit.newScript) {
    const bottom = top.reduce((y, b) => Math.max(y, Number(b.y) || 0), 0)
    top.push({ ...block, x: block.x ?? 0, y: block.y ?? bottom + 200 })
    return
  }
  const scriptNo = Number(edit.script ?? 1)
  const script = top[scriptNo - 1]
  if (!script) {
    if (top.length === 0 && edit.script == null) {
      top.push({ ...block, x: 0, y: 0 })
      return
    }
    throw new Error(`there is no script ${scriptNo} (${top.length} scripts)`)
  }
  lastInChain(script).next = { block }
}

function replaceOpcode(top, edit) {
  if (!edit.opcode) throw new Error('needs the new `opcode`')
  const { block } = findBlock(top, edit.target)
  block.type = edit.opcode
  if (edit.fields != null) block.fields = { ...(block.fields ?? {}), ...clone(edit.fields) }
  if (edit.inputs != null) block.inputs = { ...(block.inputs ?? {}), ...buildInputs(edit.inputs) }
}

function setInputField(child, value, name) {
  const fields = child.fields ?? {}
  const key = ['NUM', 'TEXT', name].find((k) => k in fields) ?? Object.keys(fields)[0]
  if (!key) throw new Error(`the ${name} input's ${child.type} block has no field to set`)
  child.fields = { ...fields, [key]: value }
}

function setField(top, edit) {
  const name = edit.field
  if (!name) throw new Error('needs a `field` name')
  if (!('value' in edit)) throw new Error('needs a `value`')
  const { block } = findBlock(top, edit.target)
  if (block.fields && name in block.fields) {
    block.fields[name] = edit.value
    return
  }
  const input = block.inputs?.[name]
  const child = input?.block ?? input?.shadow
  if (isPlainObject(child)) {
    setInputField(child, edit.value, name)
    return
  }
  const known = [...Object.keys(block.fields ?? {}), ...Object.keys(block.inputs ?? {})]
  throw new Error(
    `the ${block.type} block has no field or input "${name}" (it has: ${known.join(', ') || 'none'})`
  )
}

function removeBlock(top, edit) {
  const { block, place } = findBlock(top, edit.target)
  const below = edit.withBelow ? null : (block.next?.block ?? null)
  if (place.kind === 'top') {
    if (below) {
      place.list[place.index] = { ...below, x: block.x ?? 0, y: block.y ?? 0 }
    } else {
      place.list.splice(place.index, 1)
    }
    return
  }
  if (place.kind === 'next') {
    if (below) place.owner.next = { block: below }
    else delete place.owner.next
    return
  }
  const input = place.owner.inputs[place.input]
  if (below && STATEMENT_INPUT.test(place.input)) {
    input.block = below
  } else {
    delete input.block
    if (!input.shadow) delete place.owner.inputs[place.input]
  }
}

const APPLY = { appendBlock, replaceOpcode, setField, removeBlock }

/**
 * Applies `edits` in order to a copy of `states` (keyed by sprite id) and returns the copy.
 * `sprites` is the task's sprite list, for resolving `sprite` names. Throws on the first edit
 * that can't be applied: `edit 2 (setField): no motion_glideto block`.
 */
export function applyScratchBlockEdits(states, edits, { sprites = [] } = {}) {
  if (edits == null) return clone(states ?? {})
  if (!Array.isArray(edits)) throw new Error('`edits` must be a list')
  const out = clone(states ?? {})
  edits.forEach((edit, index) => {
    const label = `edit ${index + 1}${edit?.op ? ` (${edit.op})` : ''}`
    try {
      if (!isPlainObject(edit)) throw new Error('must be an object')
      const apply = APPLY[edit.op]
      if (!apply) throw new Error(`op must be one of: ${BLOCK_EDIT_OPS.join(', ')}`)
      if (edit.op !== 'appendBlock' && edit.target == null) throw new Error('needs a `target`')
      apply(topBlocks(out, resolveSpriteId(edit.sprite, sprites)), edit)
    } catch (error) {
      throw new Error(`${label}: ${error.message}`)
    }
  })
  return out
}
