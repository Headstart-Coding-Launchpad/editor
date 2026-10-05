// Pure Scratch check evaluation helpers and default sprite state.
// No Blockly dependency — all inputs are plain JS values or workspace references.

import { compareText, compareValues } from '../../shared/checkHelpers.js'

export const DEFAULT_SPRITES = [
  { id: 'sprite1', name: 'Sprite 1', type: 'cat', x: 0, y: 0, size: 100, direction: 90 },
]

export function createSpriteState() {
  return {
    x: 0,
    y: 0,
    direction: 90,
    size: 100,
    visible: true,
    bubble: '',
    bubbleType: 'say',
    rotationStyle: 'all around',
    costume: null,
    effect_color: 0,
    effect_fisheye: 0,
    effect_whirl: 0,
    effect_pixelate: 0,
    effect_mosaic: 0,
    effect_brightness: 0,
    effect_ghost: 0,
  }
}

// Normalize a blocks_in_order sequence item to {opcode, fieldValues}. `opcode` is the item's
// opcode spec: a string, or a list of alternatives (see opcodeAlternatives). A bare list as
// the item itself isn't supported — Firestore can't store a list directly inside a list — so
// alternatives go in the object form, { opcode: [...] }.
export function normalizeSequenceItem(item) {
  if (typeof item === 'string') return { opcode: item, fieldValues: null }
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { opcode: null, fieldValues: null }
  }
  return { opcode: item.opcode, fieldValues: item.fieldValues ?? null }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// An opcode spec (a check's or sequence item's `opcode`) is one opcode name, or a list of
// alternatives where any one counts:
//   'motion_turnright'                                   — one opcode
//   ['motion_turnright', 'motion_turnleft']              — short form; shared fieldValues
//   [{ opcode: 'motion_turnright', fieldValues: {...} }] — long form; per-alternative values
// Returns [{ opcode, fieldValues }], each alternative's own fieldValues merged over the shared
// ones (its own key wins). Malformed entries are dropped (validation reports them).
export function opcodeAlternatives(opcodeSpec, sharedFieldValues = null) {
  const shared = isPlainObject(sharedFieldValues) ? sharedFieldValues : null
  const list = Array.isArray(opcodeSpec) ? opcodeSpec : [opcodeSpec]
  return list.flatMap((alt) => {
    if (typeof alt === 'string') return alt ? [{ opcode: alt, fieldValues: shared }] : []
    if (isPlainObject(alt) && typeof alt.opcode === 'string' && alt.opcode) {
      const own = isPlainObject(alt.fieldValues) ? alt.fieldValues : null
      return [{ opcode: alt.opcode, fieldValues: own ? { ...(shared ?? {}), ...own } : shared }]
    }
    return []
  })
}

// The opcode names an opcode spec accepts (block_count, labels).
export function opcodeSpecOpcodes(opcodeSpec) {
  return opcodeAlternatives(opcodeSpec).map((alt) => alt.opcode)
}

function traverseChain(startBlock) {
  const chain = []
  let current = startBlock
  while (current) {
    chain.push(current)
    current = current.getNextBlock()
  }
  return chain
}

function getInputValue(block, inputName) {
  // Dropdown/checkbox fields (e.g. motion_goto's TO) live directly on the block, not as a
  // connected input — check those before falling back to shadow-block value inputs (e.g. a
  // number/text input like STEPS, which plugs in a math_number/text shadow block).
  const directValue = block.getFieldValue?.(inputName)
  if (directValue !== null && directValue !== undefined) return directValue
  const inputBlock = block.getInputTargetBlock?.(inputName)
  if (!inputBlock) return null
  return inputBlock.getFieldValue?.('NUM') ?? inputBlock.getFieldValue?.('TEXT') ?? null
}

const NUMBER_PATTERN = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/

// Block input and field conditions use the shared operator semantics (see compareText):
// text ignores case and surrounding spaces, supports * wildcards and "a","b" option lists,
// and regex honours `flags`. Two numbers compare as numbers, so 10 equals 10.0.
function fieldConditionMatches(actualValue, expectedConfig) {
  const config =
    expectedConfig && typeof expectedConfig === 'object' && !Array.isArray(expectedConfig)
      ? expectedConfig
      : { operator: 'equals', value: expectedConfig }
  const operator = config.operator ?? 'equals'
  const actual = String(actualValue ?? '')
  const expected = String(config.value ?? '')
  const bothNumbers = NUMBER_PATTERN.test(actual) && NUMBER_PATTERN.test(expected)
  if (bothNumbers && (operator === 'equals' || operator === 'not_equals')) {
    return compareValues(actual, operator, expected)
  }
  const textResult = compareText(actual, operator, expected, { flags: config.flags })
  if (textResult !== null) return textResult
  return bothNumbers ? compareValues(actual, operator, expected) : false
}

function blockMatchesFieldValues(block, fieldValues) {
  if (!fieldValues || Object.keys(fieldValues).length === 0) return true
  return Object.entries(fieldValues).every(([inputName, expectedValue]) => {
    const actual = getInputValue(block, inputName)
    return actual !== null && fieldConditionMatches(actual, expectedValue)
  })
}

// True if `block` is one of the opcode spec's alternatives and meets that alternative's
// fieldValues (its own merged over `sharedFieldValues`). The one block matcher the block
// checks share, so a plain opcode string and a list of alternatives behave the same way.
export function matchesOpcodeSpec(block, opcodeSpec, sharedFieldValues = null) {
  if (!block) return false
  return opcodeAlternatives(opcodeSpec, sharedFieldValues).some(
    (alt) => block.type === alt.opcode && blockMatchesFieldValues(block, alt.fieldValues)
  )
}

// block_count counts by opcode only: any alternative's opcode, fieldValues ignored.
function hasSpecOpcode(block, opcodeSpec) {
  return opcodeSpecOpcodes(opcodeSpec).includes(block?.type)
}

function itemMatches(block, item) {
  return matchesOpcodeSpec(block, item.opcode, item.fieldValues)
}

function containsSubsequence(haystack, needle) {
  if (needle.length === 0) return true
  const normalizedNeedle = needle.map(normalizeSequenceItem)
  outer: for (let i = 0; i <= haystack.length - normalizedNeedle.length; i++) {
    for (let j = 0; j < normalizedNeedle.length; j++) {
      if (!itemMatches(haystack[i + j], normalizedNeedle[j])) continue outer
    }
    return true
  }
  return false
}

function chainContainsBlock(chain, item) {
  return chain.some((block) => itemMatches(block, item))
}

// True if `block` matches some sequence item other than the one at `skipIndex` — i.e. it
// genuinely belongs to the required sequence, just not at this position.
function blockMatchesOtherSequenceItem(block, normalized, skipIndex) {
  return normalized.some((item, idx) => idx !== skipIndex && itemMatches(block, item))
}

// Returns 'on_track', 'violation', or 'unrelated' for a chain against a required sequence.
// Used by partialEvaluateScratchCheck to distinguish "still building" from "placed wrong block".
function findChainStatus(chain, sequence) {
  const normalized = sequence.map(normalizeSequenceItem)
  for (let i = 0; i < chain.length; i++) {
    if (!itemMatches(chain[i], normalized[0])) continue
    // Found sequence start at index i — verify that subsequent blocks continue correctly.
    for (let j = 1; j < normalized.length && i + j < chain.length; j++) {
      const block = chain[i + j]
      if (itemMatches(block, normalized[j])) continue
      // The next required block isn't here. That's only a genuine violation once
      // something is actually wrong — either the block sitting here doesn't belong to
      // the sequence at all (a foreign block), or the required block has already been
      // placed somewhere else in the chain (wrongly positioned — e.g. the pause before
      // the first move, or after the second, that an authored hint like "not before the
      // first one or after the second" is meant to catch). If the block here legitimately
      // belongs to the sequence AND the required one hasn't been placed anywhere yet, the
      // student just hasn't gotten to it — still on track, not a violation. Starter
      // content commonly begins with exactly this gap, since "insert a block between
      // these two" starts from the two blocks already connected to each other.
      const sittingBlockBelongsToSequence = blockMatchesOtherSequenceItem(block, normalized, j)
      const requiredBlockPlacedElsewhere = chainContainsBlock(chain, normalized[j])
      if (!sittingBlockBelongsToSequence || requiredBlockPlacedElsewhere) return 'violation'
      return 'on_track'
    }
    return 'on_track'
  }
  return 'unrelated'
}

// Returns 'pass', 'pending', or 'fail' for after_block_placed evaluation.
// 'pending' means the workspace is consistent with in-progress correct work — do not show a fail yet.
export function partialEvaluateScratchCheck(check, workspace) {
  if (!check?.type) return 'fail'
  try {
    switch (check.type) {
      case 'block_used': {
        if (!workspace) return 'pending'
        const found = workspace
          .getAllBlocks(false)
          .some((b) => matchesOpcodeSpec(b, check.opcode, check.fieldValues))
        return found ? 'pass' : 'pending'
      }
      case 'blocks_in_order': {
        if (!workspace || !Array.isArray(check.sequence) || check.sequence.length === 0)
          return 'pending'
        const topBlocks = workspace
          .getAllBlocks(false)
          .filter((b) => !b.previousConnection?.isConnected())
        const chains = topBlocks.map(traverseChain)
        if (chains.some((chain) => containsSubsequence(chain, check.sequence))) return 'pass'
        if (chains.some((chain) => findChainStatus(chain, check.sequence) === 'violation'))
          return 'fail'
        return 'pending'
      }
      case 'block_count': {
        if (!workspace) return 'pending'
        const count = workspace
          .getAllBlocks(false)
          .filter((b) => hasSpecOpcode(b, check.opcode)).length
        const target = Number(check.value)
        if (check.operator === 'equals') {
          if (count === target) return 'pass'
          return count < target ? 'pending' : 'fail'
        }
        if (check.operator === 'greater_than') return count > target ? 'pass' : 'pending'
        if (check.operator === 'less_than') return count < target ? 'pass' : 'fail'
        return 'pending'
      }
      default:
        return 'pending'
    }
  } catch {
    return 'pending'
  }
}

// preRunSpriteState is the state of the specific matched sprite before running (for delta checks).
export function evaluateScratchCheck(
  check,
  workspace,
  spriteState,
  runState = null,
  preRunSpriteState = null
) {
  if (!check?.type) return false
  try {
    switch (check.type) {
      case 'sprite_property':
        return spriteState
          ? compare(spriteState[check.property], check.operator, check.value)
          : false
      case 'variable_equals':
        return compare(
          runState?.variables?.[check.variableName ?? check.name ?? 'score'],
          'equals',
          check.value
        )
      case 'block_used':
        if (!workspace) return false
        return workspace
          .getAllBlocks(false)
          .some((b) => matchesOpcodeSpec(b, check.opcode, check.fieldValues))
      case 'sprite_property_delta': {
        if (!spriteState || !preRunSpriteState) return false
        const delta =
          Number(spriteState[check.property]) - Number(preRunSpriteState[check.property] ?? 0)
        return compare(delta, check.operator, check.value)
      }
      case 'sprite_property_changed': {
        if (!spriteState || !preRunSpriteState) return false
        return spriteState[check.property] !== preRunSpriteState[check.property]
      }
      case 'blocks_in_order': {
        if (!workspace || !Array.isArray(check.sequence) || check.sequence.length === 0)
          return false
        const topLevelBlocks = workspace
          .getAllBlocks(false)
          .filter((b) => !b.previousConnection?.isConnected())
        return topLevelBlocks.some((block) =>
          containsSubsequence(traverseChain(block), check.sequence)
        )
      }
      case 'block_count': {
        if (!workspace) return false
        const count = workspace
          .getAllBlocks(false)
          .filter((b) => hasSpecOpcode(b, check.opcode)).length
        return compare(count, check.operator, check.value)
      }
      case 'variable_compare':
        return compare(runState?.variables?.[check.variableName], check.operator, check.value)
      case 'costume_is':
        return spriteState ? spriteState.costume === check.value : false
      case 'run_attempted':
        // The green flag was pressed at least once on this task (ScratchWorkspace stamps every
        // run signal with it); clicking a single script never counts. No error status exists in
        // Scratch, so `requireSuccess` is ignored.
        return runState?.greenFlagPressed === true
      case 'block_run': {
        // Passes when any alternative ran. The run only records opcodes, so an alternative
        // with fieldValues also needs a block of it in the workspace holding those values.
        const executed = runState?.executedBlocks
        if (!executed) return false
        return opcodeAlternatives(check.opcode, check.fieldValues).some((alt) => {
          if (!executed.has(alt.opcode)) return false
          if (!alt.fieldValues || Object.keys(alt.fieldValues).length === 0) return true
          if (!workspace) return true
          return workspace
            .getAllBlocks(false)
            .some((b) => matchesOpcodeSpec(b, alt.opcode, alt.fieldValues))
        })
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

// Re-exported under the Scratch-local name kept for existing check-type call sites
// (sprite_property, sprite_property_delta, block_count, variable_compare) and for
// `scratch.js`'s re-export — this now delegates to the shared comparator so Scratch
// checks gain not_equals/greater_than_or_equal/less_than_or_equal for free instead of
// maintaining a second, narrower copy of the same logic.
export const compare = compareValues
