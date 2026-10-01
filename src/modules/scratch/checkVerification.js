// Static verification of a Scratch task's checks against its authored block stages, for the
// CLI (`lessons test-checks`, and `lessons validate` via warnCompleteBlocks). Pure: saved block
// JSON is wrapped by jsonWorkspace.js and dispatched exactly as the workspace does
// (checkDispatch.js). Only checks decided by the blocks alone are evaluated; run-time checks
// (sprite state, variables, costumes, block_run) are reported as skipped.

import { normalizeChecks, normalizeFeedbackChecks } from '../checks.js'
import { getStageRole, getStarterStage } from '../../shared/taskStages.js'
import { evaluateScratchCheck, normalizeSequenceItem, opcodeSpecOpcodes } from './checks.js'
import {
  evaluateScratchCheckForSprites,
  findScratchCheckTarget,
  isScratchStaticCheck,
} from './checkDispatch.js'
import { buildJsonSpriteWorkspaces } from './jsonWorkspace.js'

// The stages worth checking: the task's Complete blocks, its starter (the first Starter stage's
// blocks, else `starterBlocks` — what Reset loads) and each Complete-role code stage (legacy
// `solution` stages included). `kind` is 'complete' or 'starter'.
export function getScratchVerificationStages(task) {
  const stages = []
  if (task?.completeBlocks != null) {
    stages.push({ stage: 'complete', kind: 'complete', blocks: task.completeBlocks })
  }
  stages.push({
    stage: 'starter',
    kind: 'starter',
    blocks: getStarterStage(task)?.stage?.blocks ?? task?.starterBlocks ?? null,
  })
  ;(task?.codeStages ?? []).forEach((codeStage, index) => {
    if (getStageRole(codeStage) !== 'complete' || codeStage?.blocks == null) return
    const label = String(codeStage.label ?? '').trim() || `stage ${index + 1}`
    stages.push({ stage: `complete:${label}`, kind: 'complete', blocks: codeStage.blocks })
  })
  return stages
}

// `opcode` may be one opcode or a list of alternatives (short or long form).
function blockCount(workspace, opcode) {
  const opcodes = opcodeSpecOpcodes(opcode)
  return workspace.getAllBlocks(false).filter((block) => opcodes.includes(block.type)).length
}

function opcodeLabel(opcode) {
  return opcodeSpecOpcodes(opcode).join(' or ')
}

// The opcode spec with every per-alternative fieldValues dropped.
function bareOpcodeSpec(opcode) {
  return Array.isArray(opcode) ? opcodeSpecOpcodes(opcode) : opcode
}

// Each top-level script as its list of opcodes (reporters plugged into inputs are left out).
function scriptOpcodes(workspace) {
  return workspace
    .getAllBlocks(false)
    .filter((block) => block.previousConnection && !block.previousConnection.isConnected())
    .map((block) => {
      const opcodes = []
      for (let current = block; current; current = current.getNextBlock()) {
        opcodes.push(current.type)
      }
      return opcodes
    })
}

// { spriteName: value } over the sprites a check looks at, or the bare value for one sprite.
function perSprite(sprites, fn) {
  if (sprites.length === 1) return fn(sprites[0].workspace)
  return Object.fromEntries(sprites.map((sprite) => [sprite.name, fn(sprite.workspace)]))
}

function withoutFieldValues(check) {
  if (check.type === 'blocks_in_order') {
    return {
      ...check,
      sequence: (check.sequence ?? []).map((item) => ({
        opcode: bareOpcodeSpec(normalizeSequenceItem(item).opcode),
      })),
    }
  }
  return { ...check, opcode: bareOpcodeSpec(check.opcode), fieldValues: null }
}

/**
 * One check against one stage's sprite workspaces:
 * `{ result: 'pass' | 'fail' | 'skipped', sprite?, reason?, actual? }`.
 * `sprite` is the sprite that decided it (the named one, or the first sprite that passes; `any`
 * when a check with no spriteName fails on every sprite). `actual` is given on a fail, and
 * always for block_count.
 */
export function explainScratchCheck(check, spriteWorkspaces) {
  if (!isScratchStaticCheck(check)) {
    const skipped = { result: 'skipped' }
    if (check.spriteName && spriteWorkspaces.length > 0) {
      skipped.sprite = findScratchCheckTarget(check, spriteWorkspaces).name
    }
    skipped.reason = 'run-time check: needs a Run, which the CLI never does'
    return skipped
  }
  if (spriteWorkspaces.length === 0) return { result: 'fail', reason: 'the task has no sprites' }

  const passed = evaluateScratchCheckForSprites(check, spriteWorkspaces, null)
  const out = { result: passed ? 'pass' : 'fail' }
  let considered = spriteWorkspaces
  const reasons = []
  if (check.spriteName) {
    const target = findScratchCheckTarget(check, spriteWorkspaces)
    considered = [target]
    out.sprite = target.name
    if (target.name !== check.spriteName) {
      reasons.push(`no sprite is named "${check.spriteName}", so the first sprite was checked`)
    }
  } else {
    const winner = spriteWorkspaces.find((sprite) =>
      evaluateScratchCheck(check, sprite.workspace, null, null)
    )
    out.sprite = passed ? (winner?.name ?? 'any') : 'any'
  }

  if (check.type === 'block_count') {
    out.actual = perSprite(considered, (ws) => blockCount(ws, check.opcode))
  }
  if (!passed) {
    const looseMatch = considered.some((sprite) =>
      evaluateScratchCheck(withoutFieldValues(check), sprite.workspace, null, null)
    )
    if (check.type === 'block_used') {
      out.actual = perSprite(considered, (ws) => blockCount(ws, check.opcode))
      reasons.push(
        looseMatch
          ? `a ${opcodeLabel(check.opcode)} block is there but its fields don't match fieldValues`
          : `no ${opcodeLabel(check.opcode)} block`
      )
    } else if (check.type === 'blocks_in_order') {
      out.actual = perSprite(considered, scriptOpcodes)
      reasons.push(
        looseMatch
          ? "the blocks are in this order but a fieldValues condition doesn't match"
          : 'no script has these blocks joined in this order'
      )
    } else if (check.type === 'block_count') {
      reasons.push(`${opcodeLabel(check.opcode)} count is not ${check.operator} ${check.value}`)
    }
  }
  if (reasons.length > 0) out.reason = reasons.join('; ')
  return out
}

function checkSummary(check, index) {
  const summary = { index: index + 1, type: check.type }
  if (check.opcode) summary.opcode = check.opcode
  return summary
}

/**
 * Every completion and feedback check of a task against one stage's blocks. Returns
 * `{ completion: { result, checks }, feedback }`, where completion `result` is 'pass' (every
 * check passes), 'fail' (a static check fails), 'incomplete' (static checks pass but run-time
 * ones were skipped) or 'none' (no completion check). Feedback `result` is 'fires', 'silent'
 * or 'skipped'. Throws when the stage's blocks are an unparseable JSON string.
 */
export function evaluateScratchStage(task, blocks) {
  const spriteWorkspaces = buildJsonSpriteWorkspaces(task, blocks)
  const checks = normalizeChecks(task?.check).map((check, index) => ({
    ...checkSummary(check, index),
    ...(check.spriteName ? { spriteName: check.spriteName } : {}),
    ...explainScratchCheck(check, spriteWorkspaces),
  }))
  let result = 'pass'
  if (checks.length === 0) result = 'none'
  else if (checks.some((check) => check.result === 'fail')) result = 'fail'
  else if (checks.some((check) => check.result === 'skipped')) result = 'incomplete'

  const feedback = normalizeFeedbackChecks(task ?? {}).map((check, index) => {
    const entry = { ...checkSummary(check, index), mode: check.mode, show: check.show }
    if (check.hint) entry.hint = check.hint
    if (!isScratchStaticCheck(check)) return { ...entry, result: 'skipped' }
    const fires = evaluateScratchCheckForSprites(check, spriteWorkspaces, null)
    return { ...entry, result: fires ? 'fires' : 'silent' }
  })
  return { completion: { result, checks }, feedback }
}

// `activityPattern` is the task's taskActivity pattern id, resolved by the caller (the CLI) so
// this module stays free of the activity registry.
function isDebugTask(activityPattern) {
  return activityPattern === 'debug_code_task'
}

/**
 * Verifies one Scratch task: per-stage results plus warnings, each starting `Task ${label}`.
 * Warnings: a Complete stage fails a static completion check; a feedback check fires on a
 * Complete stage; the starter already passes every completion check; a Debug Code Task whose
 * static blocking feedback checks all stay silent on the starter.
 */
export function verifyScratchTask(task, label = task?.id, { activityPattern = null } = {}) {
  const warnings = []
  const stages = getScratchVerificationStages(task).map(({ stage, kind, blocks }) => {
    let evaluated
    try {
      evaluated = evaluateScratchStage(task, blocks)
    } catch (error) {
      warnings.push(`Task ${label} ${stage} blocks are not valid JSON (${error.message})`)
      return { stage, error: 'blocks are not valid JSON' }
    }
    const { completion, feedback } = evaluated
    if (kind === 'complete') {
      for (const check of completion.checks.filter((c) => c.result === 'fail')) {
        warnings.push(
          `Task ${label} ${stage} stage fails completion check ${check.index} (${check.type})`
        )
      }
      for (const check of feedback.filter((c) => c.result === 'fires')) {
        warnings.push(
          `Task ${label} feedback check ${check.index} (${check.type}) fires on the ${stage} stage`
        )
      }
    } else if (kind === 'starter') {
      if (completion.result === 'pass') {
        warnings.push(`Task ${label} starter already passes every completion check`)
      }
      const blocking = feedback.filter((c) => c.mode === 'blocking' && c.result !== 'skipped')
      if (
        isDebugTask(activityPattern) &&
        blocking.length > 0 &&
        !blocking.some((c) => c.result === 'fires')
      ) {
        warnings.push(
          `Task ${label} is a Debug task but none of its blocking feedback checks fires on the starter`
        )
      }
    }
    return { stage, completion, feedback }
  })
  return { taskId: task?.id ?? null, title: task?.title ?? '', stages, warnings }
}
