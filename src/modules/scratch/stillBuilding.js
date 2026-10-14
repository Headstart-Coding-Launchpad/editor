// "Still building" for Scratch after_block_placed checks. Pure: no Blockly, no DOM, so the CLI
// (jsonWorkspace.js callers) can use it on stored workspace JSON too.
//
// A student is still building when either:
// - the workspace equals the one the task opened with (the starter, or the carried blocks), or
// - a non-hat block sits loose at the top level (a stack with no hat on top, or a reporter
//   dropped on the canvas): it was dragged out and not yet attached.
// While still building, an after_block_placed failure shows no fail state or hint and logs no
// attempt. Passes always count. See docs/authoring/scratch.md "When checks run and what logs an
// attempt".
//
// States are keyed by sprite id (plus `__stage__`), each a Blockly workspace save:
// `{ blocks: { blocks: [ ...top-level blocks ] }, variables: [...] }`. Only blocks are compared.

import { SCRATCH_BLOCK_BY_OPCODE } from '../../shared/scratchBlockCatalog.js'

const IGNORED_KEYS = new Set(['id', 'x', 'y'])

// A block JSON with ids and positions removed, keys sorted, so equal scripts compare equal.
function normaliseBlock(value) {
  if (Array.isArray(value)) return value.map(normaliseBlock)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value).sort()) {
    if (IGNORED_KEYS.has(key)) continue
    out[key] = normaliseBlock(value[key])
  }
  return out
}

function topBlocksOf(state) {
  const blocks = state?.blocks?.blocks
  return Array.isArray(blocks) ? blocks : []
}

// One sprite's scripts as a sorted list of strings: stack order on the canvas doesn't matter.
function scriptSignature(state) {
  return topBlocksOf(state)
    .map((block) => JSON.stringify(normaliseBlock(block)))
    .sort()
}

// Whether two workspace state maps hold the same scripts, ignoring block ids and positions.
// A sprite missing from one side counts as empty.
export function scratchStatesStructurallyEqual(a, b) {
  const left = a ?? {}
  const right = b ?? {}
  const ids = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const id of ids) {
    if (id === '__meta__') continue
    const x = scriptSignature(left[id])
    const y = scriptSignature(right[id])
    if (x.length !== y.length || x.some((s, i) => s !== y[i])) return false
  }
  return true
}

// Hats have neither a previous nor an output connection, so they're the only blocks that may sit
// at the top level. An opcode the catalog doesn't know is treated as connectable (loose).
export function isHatOpcode(opcode) {
  return SCRATCH_BLOCK_BY_OPCODE[opcode]?.shape === 'hat'
}

// Whether any sprite's workspace has a loose (top-level, non-hat) block.
export function scratchStatesHaveLooseBlock(states) {
  for (const [id, state] of Object.entries(states ?? {})) {
    if (id === '__meta__') continue
    if (topBlocksOf(state).some((block) => block?.type && !isHatOpcode(block.type))) return true
  }
  return false
}

// The still-building rule. `baseline` is the state map the task opened with (null when unknown:
// only the loose-block half applies then).
export function isScratchStillBuilding(current, baseline) {
  if (scratchStatesHaveLooseBlock(current)) return true
  if (baseline && scratchStatesStructurallyEqual(current, baseline)) return true
  return false
}
