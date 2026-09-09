// Pure Scratch check evaluation helpers and default sprite state.
// No Blockly dependency — all inputs are plain JS values or workspace references.

import { wildcardEquals, compareValues } from '../../shared/checkHelpers.js'

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

// Normalize a blocks_in_order sequence item to {opcode, fieldValues}.
export function normalizeSequenceItem(item) {
  if (typeof item === 'string') return { opcode: item, fieldValues: null }
  return { opcode: item.opcode, fieldValues: item.fieldValues ?? null }
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
  const inputBlock = block.getInputTargetBlock?.(inputName)
  if (!inputBlock) return null
  return inputBlock.getFieldValue?.('NUM') ?? inputBlock.getFieldValue?.('TEXT') ?? null
}

function fieldConditionMatches(actualValue, expectedConfig) {
  const actual = String(actualValue)
  const config =
    expectedConfig && typeof expectedConfig === 'object' && !Array.isArray(expectedConfig)
      ? expectedConfig
      : { operator: 'equals', value: expectedConfig }
  const operator = config.operator ?? 'equals'
  const expected = String(config.value ?? '')
  const actualNumber = Number(actual)
  const expectedNumber = Number(expected)
  if (operator === 'contains') return actual.toLowerCase().includes(expected.toLowerCase())
  if (operator === 'not_contains') return !actual.toLowerCase().includes(expected.toLowerCase())
  if (operator === 'not_equals') return !wildcardEquals(actual, expected)
  if (operator === 'greater_than' && !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber))
    return actualNumber > expectedNumber
  if (
    operator === 'greater_than_or_equal' &&
    !Number.isNaN(actualNumber) &&
    !Number.isNaN(expectedNumber)
  )
    return actualNumber >= expectedNumber
  if (operator === 'less_than' && !Number.isNaN(actualNumber) && !Number.isNaN(expectedNumber))
    return actualNumber < expectedNumber
  if (
    operator === 'less_than_or_equal' &&
    !Number.isNaN(actualNumber) &&
    !Number.isNaN(expectedNumber)
  )
    return actualNumber <= expectedNumber
  if (operator === 'matches_regex') {
    try {
      return new RegExp(expected).test(actual)
    } catch {
      return false
    }
  }
  if (operator === 'not_matches_regex') {
    try {
      return !new RegExp(expected).test(actual)
    } catch {
      return false
    }
  }
  return wildcardEquals(actual, expected)
}

function blockMatchesFieldValues(block, fieldValues) {
  if (!fieldValues || Object.keys(fieldValues).length === 0) return true
  return Object.entries(fieldValues).every(([inputName, expectedValue]) => {
    const actual = getInputValue(block, inputName)
    return actual !== null && fieldConditionMatches(actual, expectedValue)
  })
}

function containsSubsequence(haystack, needle) {
  if (needle.length === 0) return true
  const normalizedNeedle = needle.map(normalizeSequenceItem)
  outer: for (let i = 0; i <= haystack.length - normalizedNeedle.length; i++) {
    for (let j = 0; j < normalizedNeedle.length; j++) {
      const block = haystack[i + j]
      const { opcode, fieldValues } = normalizedNeedle[j]
      if (block.type !== opcode) continue outer
      if (!blockMatchesFieldValues(block, fieldValues)) continue outer
    }
    return true
  }
  return false
}

function chainContainsBlock(chain, opcode, fieldValues) {
  return chain.some((block) => block.type === opcode && blockMatchesFieldValues(block, fieldValues))
}

// True if `block` matches some sequence item other than the one at `skipIndex` — i.e. it
// genuinely belongs to the required sequence, just not at this position.
function blockMatchesOtherSequenceItem(block, normalized, skipIndex) {
  return normalized.some(
    (item, idx) =>
      idx !== skipIndex && block.type === item.opcode && blockMatchesFieldValues(block, item.fieldValues)
  )
}

// Returns 'on_track', 'violation', or 'unrelated' for a chain against a required sequence.
// Used by partialEvaluateScratchCheck to distinguish "still building" from "placed wrong block".
function findChainStatus(chain, sequence) {
  const normalized = sequence.map(normalizeSequenceItem)
  for (let i = 0; i < chain.length; i++) {
    if (chain[i].type !== normalized[0].opcode) continue
    if (!blockMatchesFieldValues(chain[i], normalized[0].fieldValues)) continue
    // Found sequence start at index i — verify that subsequent blocks continue correctly.
    for (let j = 1; j < normalized.length && i + j < chain.length; j++) {
      const block = chain[i + j]
      if (block.type === normalized[j].opcode && blockMatchesFieldValues(block, normalized[j].fieldValues))
        continue
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
      const requiredBlockPlacedElsewhere = chainContainsBlock(
        chain,
        normalized[j].opcode,
        normalized[j].fieldValues
      )
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
          .some((b) => b.type === check.opcode && blockMatchesFieldValues(b, check.fieldValues))
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
        const count = workspace.getAllBlocks(false).filter((b) => b.type === check.opcode).length
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
          .some((b) => b.type === check.opcode && blockMatchesFieldValues(b, check.fieldValues))
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
        const count = workspace.getAllBlocks(false).filter((b) => b.type === check.opcode).length
        return compare(count, check.operator, check.value)
      }
      case 'variable_compare':
        return compare(runState?.variables?.[check.variableName], check.operator, check.value)
      case 'costume_is':
        return spriteState ? spriteState.costume === check.value : false
      case 'block_run': {
        const ran = runState?.executedBlocks?.has(check.opcode) ?? false
        if (!ran) return false
        if (!check.fieldValues || Object.keys(check.fieldValues).length === 0) return true
        if (!workspace) return true
        return workspace
          .getAllBlocks(false)
          .some((b) => b.type === check.opcode && blockMatchesFieldValues(b, check.fieldValues))
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
