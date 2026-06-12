// Pure Scratch check evaluation helpers and default sprite state.
// No Blockly dependency — all inputs are plain JS values or workspace references.

export const DEFAULT_SPRITES = [
  { id: 'sprite1', name: 'Sprite 1', type: 'cat', x: 0, y: 0, size: 100, direction: 90 },
]

export function createSpriteState() {
  return { x: 0, y: 0, direction: 90, size: 100, visible: true, bubble: '', bubbleType: 'say', rotationStyle: 'all around', costume: null }
}

function traverseChain(startBlock) {
  const chain = []
  let current = startBlock
  while (current) {
    chain.push(current.type)
    current = current.getNextBlock()
  }
  return chain
}

function containsSubsequence(haystack, needle) {
  if (needle.length === 0) return true
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

// preRunSpriteState is the state of the specific matched sprite before running (for delta checks).
export function evaluateScratchCheck(check, workspace, spriteState, runState = null, preRunSpriteState = null) {
  if (!check?.type) return false
  try {
    switch (check.type) {
      case 'sprite_property':
        return spriteState ? compare(spriteState[check.property], check.operator, check.value) : false
      case 'variable_equals':
        return compare(runState?.variables?.[check.variableName ?? check.name ?? 'score'], 'equals', check.value)
      case 'block_used':
        return workspace ? workspace.getAllBlocks(false).some(b => b.type === check.opcode) : false
      case 'sprite_property_delta': {
        if (!spriteState || !preRunSpriteState) return false
        const delta = Number(spriteState[check.property]) - Number(preRunSpriteState[check.property] ?? 0)
        return compare(delta, check.operator, check.value)
      }
      case 'sprite_property_changed': {
        if (!spriteState || !preRunSpriteState) return false
        return spriteState[check.property] !== preRunSpriteState[check.property]
      }
      case 'blocks_in_order': {
        if (!workspace || !Array.isArray(check.sequence) || check.sequence.length === 0) return false
        const topLevelBlocks = workspace.getAllBlocks(false).filter(b => !b.previousConnection?.isConnected())
        return topLevelBlocks.some(block => containsSubsequence(traverseChain(block), check.sequence))
      }
      case 'block_count': {
        if (!workspace) return false
        const count = workspace.getAllBlocks(false).filter(b => b.type === check.opcode).length
        return compare(count, check.operator, check.value)
      }
      case 'variable_compare':
        return compare(runState?.variables?.[check.variableName], check.operator, check.value)
      case 'costume_is':
        return spriteState ? spriteState.costume === check.value : false
      case 'block_run':
        return runState?.executedBlocks?.has(check.opcode) ?? false
      default:
        return false
    }
  } catch {
    return false
  }
}

export function compare(actual, operator, expected) {
  const a = Number(actual)
  const e = Number(expected)
  if (!Number.isNaN(a) && !Number.isNaN(e)) {
    if (operator === 'equals') return a === e
    if (operator === 'greater_than') return a > e
    if (operator === 'less_than') return a < e
  }
  return operator === 'equals' && String(actual) === String(expected)
}
