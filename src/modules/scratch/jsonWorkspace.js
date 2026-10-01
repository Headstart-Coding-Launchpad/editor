// Wraps saved Blockly workspace JSON (the `starterBlocks` / `completeBlocks` /
// `codeStages[].blocks` shape, see docs/authoring/scratch.md "Populated Block-State JSON") in the
// duck-typed workspace interface checks.js reads, so Scratch block checks can be evaluated in
// plain Node (the CLI) without Blockly. Pure: no Blockly, no DOM.
//
// Mirrors what a loaded Blockly workspace reports:
// - getAllBlocks(false) returns every block, shadows included;
// - getNextBlock() follows `next.block`;
// - getInputTargetBlock(name) is the input's real block, else its shadow;
// - getFieldValue(name) reads the block's own `fields` (null when absent);
// - previousConnection: a top-level block's is unconnected; a block under `next` or inside a
//   statement input (SUBSTACK, SUBSTACK2) is connected; a block plugged into a value input is a
//   reporter or shadow with no previous connection (null), as in Blockly.

import { DEFAULT_SPRITES } from './checks.js'
import { migrateBroadcastState, migrateVariableFields } from './scratchPersistence.js'

const STATEMENT_INPUT = /^SUBSTACK\d*$/

// Parses a stored blocks value: an object, a JSON string, or null. Throws on a bad string.
export function parseScratchBlocksState(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') return JSON.parse(raw)
  return raw
}

function fieldValue(value) {
  if (value == null) return null
  if (typeof value === 'object') return value.name ?? value.id ?? null
  return value
}

function wrapBlock(json, connection, all) {
  if (!json || typeof json !== 'object') return null
  const block = {
    type: json.type,
    id: json.id ?? null,
    previousConnection:
      connection === 'value' ? null : { isConnected: () => connection === 'connected' },
    getFieldValue: (name) => fieldValue(json.fields?.[name]),
    getNextBlock: () => next,
    getInputTargetBlock: (name) => inputs[name] ?? null,
  }
  all.push(block)
  const inputs = {}
  for (const [name, input] of Object.entries(json.inputs ?? {})) {
    const child = input?.block ?? input?.shadow
    // A real block covers its shadow; Blockly keeps the shadow only as a hidden fallback.
    if (input?.block && input?.shadow) wrapBlock(input.shadow, 'value', all)
    inputs[name] = wrapBlock(child, STATEMENT_INPUT.test(name) ? 'connected' : 'value', all)
  }
  const next = wrapBlock(json.next?.block, 'connected', all)
  return block
}

// One sprite's workspace snapshot (`{ blocks: { blocks: [...] } }`) → workspace interface.
export function createJsonWorkspace(state) {
  const migrated = migrateVariableFields(migrateBroadcastState(state ?? null))
  const all = []
  const topBlocks = (migrated?.blocks?.blocks ?? [])
    .map((json) => wrapBlock(json, 'top', all))
    .filter(Boolean)
  return {
    getAllBlocks: () => [...all],
    getTopBlocks: () => [...topBlocks],
  }
}

// The task's sprites, as the workspace resolves them (an empty list means the default cat).
export function getScratchTaskSprites(task) {
  return task?.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
}

// A whole stored workspace state (keyed by sprite id, plus `__stage__`) → the
// `spriteWorkspaces` array checkDispatch.js takes. A state not keyed by the first sprite's id
// belongs to the first sprite, as ScratchWorkspace's loader treats it. Only author sprites are
// included (student-added sprites are never checkable); the Stage is added when the task has
// stage code. `state` is null: sprite-state checks need a run, which this never does.
export function buildJsonSpriteWorkspaces(task, rawState) {
  const sprites = getScratchTaskSprites(task)
  const parsed = parseScratchBlocksState(rawState)
  let states = {}
  if (parsed && typeof parsed === 'object') {
    states =
      sprites[0] && Object.prototype.hasOwnProperty.call(parsed, sprites[0].id)
        ? parsed
        : sprites[0]
          ? { [sprites[0].id]: parsed }
          : {}
  }
  const result = sprites.map((sprite) => ({
    id: sprite.id,
    name: sprite.name,
    workspace: createJsonWorkspace(states[sprite.id]),
    state: null,
  }))
  if (task?.enableStageCode) {
    result.push({
      id: '__stage__',
      name: '__stage__',
      workspace: createJsonWorkspace(states.__stage__),
      state: null,
    })
  }
  return result
}
