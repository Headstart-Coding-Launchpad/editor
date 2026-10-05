// Per-sprite dispatch for Scratch checks. Pure (no Blockly, no React): the workspace runs
// these against its live Blockly workspaces, and the CLI (`lessons validate`,
// `lessons test-checks`) runs them against saved block JSON wrapped by jsonWorkspace.js.
//
// `spriteWorkspaces` is an array of `{ id, name, workspace, state }` — one entry per checkable
// sprite (plus `__stage__` when stage code is on), in the task's sprite order. `workspace` is
// anything with the duck-typed interface checks.js reads (getAllBlocks(false), and blocks with
// type / getNextBlock / previousConnection / getFieldValue / getInputTargetBlock).

import { evaluateScratchCheck, partialEvaluateScratchCheck } from './checks.js'

// Checks decided by the blocks alone, so they can be verified against saved block JSON.
export const SCRATCH_STATIC_CHECK_TYPES = ['block_used', 'blocks_in_order', 'block_count']

export function isScratchStaticCheck(check) {
  return SCRATCH_STATIC_CHECK_TYPES.includes(check?.type)
}

// Checks the workspace judges after a run (green flag, key press, clicked script): every check
// not marked `manual` or `after_block_placed`.
export function isScratchAfterRunCheck(check) {
  return check?.evaluation !== 'manual' && check?.evaluation !== 'after_block_placed'
}

// Whether every after-run check is a run_attempted: the task is then decided the moment the green
// flag is pressed (ScratchWorkspace judges it then, since a forever loop never finishes and Stop
// skips the end-of-run check).
export function isScratchRunAttemptedOnly(checks) {
  const afterRun = (checks ?? []).filter((check) => check?.type && isScratchAfterRunCheck(check))
  return afterRun.length > 0 && afterRun.every((check) => check.type === 'run_attempted')
}

// A check naming a sprite targets that sprite; an unknown name falls back to the first sprite.
export function findScratchCheckTarget(check, spriteWorkspaces) {
  return spriteWorkspaces.find((sp) => sp.name === check.spriteName) ?? spriteWorkspaces[0]
}

// True/false for a check at Run (or on demand). A block check with no spriteName passes when
// ANY sprite satisfies it; sprite-state checks target the named sprite or the first one.
export function evaluateScratchCheckForSprites(
  check,
  spriteWorkspaces,
  signal,
  preRunSpriteStates = {}
) {
  if (!check?.type) return false
  try {
    // Reads the run signal only (was the green flag pressed?), never a sprite.
    if (check.type === 'run_attempted') return evaluateScratchCheck(check, null, null, signal)
    if (check.type === 'block_used') {
      if (check.spriteName) {
        const target = findScratchCheckTarget(check, spriteWorkspaces)
        return target ? evaluateScratchCheck(check, target.workspace, null, null) : false
      }
      return spriteWorkspaces.some((sp) => evaluateScratchCheck(check, sp.workspace, null, null))
    }
    if (check.type === 'variable_equals' || check.type === 'variable_compare') {
      return evaluateScratchCheck(check, null, null, signal)
    }
    if (check.type === 'block_run') {
      if (check.spriteName) {
        const target = findScratchCheckTarget(check, spriteWorkspaces)
        return target ? evaluateScratchCheck(check, target.workspace, null, signal) : false
      }
      return spriteWorkspaces.some((sp) => evaluateScratchCheck(check, sp.workspace, null, signal))
    }
    if (check.type === 'blocks_in_order' || check.type === 'block_count') {
      if (check.spriteName) {
        const target = findScratchCheckTarget(check, spriteWorkspaces)
        if (!target) return false
        return evaluateScratchCheck(check, target.workspace, null, null)
      }
      return spriteWorkspaces.some((sp) => evaluateScratchCheck(check, sp.workspace, null, null))
    }
    // sprite_property / sprite_property_delta / sprite_property_changed / costume_is: match by name or fall back to first
    const target = findScratchCheckTarget(check, spriteWorkspaces)
    if (!target) return false
    const preRunState = preRunSpriteStates[target.id] ?? null
    return evaluateScratchCheck(check, target.workspace, target.state, signal, preRunState)
  } catch {
    return false
  }
}

// Returns 'pass', 'pending', or 'fail' — used for after_block_placed evaluation.
// A check with no spriteName passes if ANY sprite satisfies it (see
// evaluateScratchCheckForSprites above), so it must only report 'fail' once EVERY sprite has
// ruled it out — one unrelated sprite whose starter blocks happen to share the sequence's first
// opcode (e.g. the near-universal "when green flag clicked" hat) would otherwise flag a
// 'violation' against its own unrelated next block and fail the check for everyone, before the
// student has touched the sprite the check actually targets.
export function partialEvaluateScratchCheckForSprites(check, spriteWorkspaces) {
  if (!check?.type) return 'fail'
  try {
    const bySprite = (fn) => {
      if (check.spriteName) {
        const target = findScratchCheckTarget(check, spriteWorkspaces)
        return target ? fn(target.workspace) : 'pending'
      }
      const results = spriteWorkspaces.map((sp) => fn(sp.workspace))
      if (results.some((r) => r === 'pass')) return 'pass'
      if (results.length > 0 && results.every((r) => r === 'fail')) return 'fail'
      return 'pending'
    }
    return bySprite((ws) => partialEvaluateScratchCheck(check, ws))
  } catch {
    return 'pending'
  }
}
