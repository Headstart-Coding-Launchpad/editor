// One `lessons test-checks --cases` case for a Scratch task (the module's `testCheckCase`): a
// student variation given as whole `blocks`, or as one of the task's stages plus `edits`
// (blockEdits.js), judged per check against an expectation. Pure / Node-safe: blocks go through
// jsonWorkspace.js and the same per-check rules as `lessons test-checks` without --cases
// (checkVerification.js). Run-time checks are reported as skipped. See docs/authoring/scratch.md
// "Testing student variations".

import { normalizeChecks, normalizeFeedbackChecks } from '../checks.js'
import { applyScratchBlockEdits } from './blockEdits.js'
import { evaluateScratchStage, getScratchVerificationStages } from './checkVerification.js'
import { getScratchTaskSprites, parseScratchBlocksState } from './jsonWorkspace.js'
import { isScratchStillBuilding, scratchStatesHaveLooseBlock } from './stillBuilding.js'

const PASS_FAIL = new Set(['pass', 'fail'])

// A stored blocks value keyed by sprite id, as buildJsonSpriteWorkspaces reads it: a state not
// keyed by the first sprite's id belongs to the first sprite. Returns a copy.
export function toScratchSpriteStates(task, raw) {
  const parsed = parseScratchBlocksState(raw)
  if (!parsed || typeof parsed !== 'object') return {}
  const sprites = getScratchTaskSprites(task)
  const first = sprites[0]?.id
  const keyed =
    first && !Object.prototype.hasOwnProperty.call(parsed, first) && 'blocks' in parsed
      ? { [first]: parsed }
      : parsed
  return JSON.parse(JSON.stringify(keyed))
}

// `stage` is a stage id from `lessons test-checks` (complete, starter, complete:<label>,
// support:<label>), or a role (complete, starter, support) for the first stage of that role.
// Labels match ignoring case.
function resolveStage(task, wanted) {
  const stages = getScratchVerificationStages(task, { includeSupport: true })
  const key = String(wanted).trim().toLowerCase()
  const match =
    stages.find((entry) => entry.stage.toLowerCase() === key) ??
    stages.find((entry) => entry.kind === key && entry.blocks != null)
  if (!match) {
    const ids = stages.map((entry) => entry.stage).join(', ')
    throw new Error(`stage "${wanted}" was not found (stages: ${ids || 'none'})`)
  }
  return match
}

function starterBlocks(task) {
  return getScratchVerificationStages(task).find((entry) => entry.kind === 'starter')?.blocks
}

// Feedback expectation entries → 0-based feedback check indexes. A number (or digits) is the
// check's 1-based index; any other string matches a check's `id`, else a hint containing it
// (ignoring case). Throws when an entry matches no check, or more than one hint.
function resolveFeedbackRefs(refs, feedbackChecks, where) {
  if (!Array.isArray(refs)) throw new Error(`${where} expect.feedback must be a list`)
  const indexes = new Set()
  for (const ref of refs) {
    const text = String(ref ?? '').trim()
    if (/^\d+$/.test(text)) {
      const index = Number(text) - 1
      if (!feedbackChecks[index]) {
        throw new Error(`${where} expect.feedback ${text}: the task has no feedback check ${text}`)
      }
      indexes.add(index)
      continue
    }
    const byId = feedbackChecks.findIndex((check) => check.id != null && String(check.id) === text)
    if (byId !== -1) {
      indexes.add(byId)
      continue
    }
    const lower = text.toLowerCase()
    const byHint = feedbackChecks
      .map((check, index) => ({ index, hint: String(check.hint ?? '').toLowerCase() }))
      .filter((entry) => lower && entry.hint.includes(lower))
    if (byHint.length === 0) {
      throw new Error(`${where} expect.feedback "${text}" matches no feedback check id or hint`)
    }
    if (byHint.length > 1) {
      throw new Error(
        `${where} expect.feedback "${text}" matches the hints of feedback checks ${byHint.map((e) => e.index + 1).join(', ')}; use an index`
      )
    }
    indexes.add(byHint[0].index)
  }
  return indexes
}

function readExpectation(testCase, where) {
  const expect = testCase.expect ?? {}
  if (typeof expect !== 'object' || Array.isArray(expect)) {
    throw new Error(`${where} expect must be an object`)
  }
  const completion = expect.completion ?? testCase.completion
  if (!PASS_FAIL.has(completion)) {
    throw new Error(`${where} expect.completion must be "pass" or "fail"`)
  }
  const out = { completion }
  if (expect.blocking != null) {
    if (!PASS_FAIL.has(expect.blocking)) {
      throw new Error(`${where} expect.blocking must be "pass" or "fail"`)
    }
    out.blocking = expect.blocking
  }
  if (expect.feedback != null) out.feedback = expect.feedback
  return out
}

function caseStates(task, testCase, where) {
  const hasBlocks = testCase.blocks != null
  const hasStage = testCase.stage != null && testCase.stage !== ''
  if (testCase.code != null) {
    throw new Error(`${where}: Scratch cases give blocks or a stage, not code`)
  }
  if (hasBlocks === hasStage) {
    throw new Error(`${where} must give either blocks or a stage (with optional edits)`)
  }
  let base
  let source
  if (hasBlocks) {
    try {
      base = toScratchSpriteStates(task, testCase.blocks)
    } catch (error) {
      throw new Error(`${where} blocks are not valid JSON (${error.message})`)
    }
    source = { blocks: true }
  } else {
    const stage = resolveStage(task, testCase.stage)
    try {
      base = toScratchSpriteStates(task, stage.blocks)
    } catch (error) {
      throw new Error(`${where} stage ${stage.stage} blocks are not valid JSON (${error.message})`)
    }
    source = { stage: stage.stage }
  }
  const edits = testCase.edits ?? []
  try {
    const sprites = getScratchTaskSprites(task)
    const states = applyScratchBlockEdits(base, edits, { sprites })
    // Keyed by the first sprite's id, so jsonWorkspace.js reads the map as keyed.
    if (sprites[0] && !states[sprites[0].id]) states[sprites[0].id] = {}
    if (Array.isArray(edits) && edits.length > 0) source.edits = edits.length
    return { states, source }
  } catch (error) {
    throw new Error(`${where} ${error.message}`)
  }
}

// The still-building rule (stillBuilding.js) against the task's starter: while it holds, a
// failing after_block_placed check shows no fail state or hint in class.
function stillBuildingFor(task, states, completion) {
  let baseline = null
  try {
    baseline = toScratchSpriteStates(task, starterBlocks(task))
  } catch {
    baseline = null
  }
  const value = isScratchStillBuilding(states, baseline)
  const out = { value }
  if (value) {
    out.reason = scratchStatesHaveLooseBlock(states)
      ? 'a block is loose on the canvas'
      : 'the blocks are the same as the starter'
  }
  const hasPlacedCheck = normalizeChecks(task?.check).some(
    (check) => check.evaluation === 'after_block_placed'
  )
  out.failsHeldBack = value && hasPlacedCheck && completion !== 'pass'
  return out
}

function blockingResult(feedback) {
  const blocking = feedback.filter((check) => check.mode === 'blocking')
  if (blocking.some((check) => check.result === 'fires')) return 'fail'
  if (blocking.some((check) => check.result === 'skipped')) return 'skipped'
  return 'pass'
}

/**
 * Evaluates one Scratch case. `testCase`: `{ name, blocks | stage, edits?, expect: {
 * completion, blocking?, feedback? } }` (a top-level `completion` is accepted too). Returns
 * `{ taskId, name, source, expected, actual: { completion, blocking, checks, feedback },
 * matchedFeedback, stillBuilding, mismatches, unconfirmed? }`. Throws on a malformed case.
 *
 * - completion: 'pass' | 'fail' | 'incomplete' (block checks pass, run-time ones skipped) |
 *   'none'. 'none' compares as 'fail'; 'incomplete' isn't compared (listed in `unconfirmed`).
 * - blocking: 'fail' when a blocking feedback check fires, 'skipped' when none fires but a
 *   blocking one needs a run (not compared), else 'pass'.
 * - feedback: the feedback checks expected to fire; each other one is expected silent. A
 *   skipped feedback check isn't compared.
 */
export function evaluateScratchCheckCase(task, testCase, { taskId = task?.id } = {}) {
  const where = `Task ${taskId} case "${testCase.name}"`
  const expected = readExpectation(testCase, where)
  const feedbackChecks = normalizeFeedbackChecks(task ?? {})
  const expectedFires =
    expected.feedback != null ? resolveFeedbackRefs(expected.feedback, feedbackChecks, where) : null
  const { states, source } = caseStates(task, testCase, where)
  const { completion, feedback } = evaluateScratchStage(task, states)

  const mismatches = []
  const unconfirmed = []
  const actualCompletion = completion.result
  if (actualCompletion === 'incomplete') {
    unconfirmed.push('completion: the block checks pass but run-time checks were skipped')
  } else {
    const verdict = actualCompletion === 'none' ? 'fail' : actualCompletion
    if (verdict !== expected.completion) {
      mismatches.push(`completion: expected ${expected.completion}, got ${verdict}`)
    }
  }

  const blocking = blockingResult(feedback)
  if (expected.blocking) {
    if (blocking === 'skipped') {
      unconfirmed.push('blocking: a blocking feedback check needs a run')
    } else if (blocking !== expected.blocking) {
      mismatches.push(`blocking: expected ${expected.blocking}, got ${blocking}`)
    }
  }

  const feedbackResults = feedback.map((check, index) => {
    if (!expectedFires) return check
    const shouldFire = expectedFires.has(index)
    const entry = { ...check, expected: shouldFire ? 'fires' : 'silent' }
    if (check.result === 'skipped') {
      if (shouldFire) unconfirmed.push(`feedback check ${check.index} needs a run`)
    } else if (check.result !== entry.expected) {
      entry.mismatch = true
      mismatches.push(
        `feedback check ${check.index} (${check.type}): expected it to ${shouldFire ? 'fire' : 'stay silent'}, but it ${check.result === 'fires' ? 'fires' : 'stays silent'}`
      )
    }
    return entry
  })

  const result = {
    taskId,
    name: testCase.name,
    source,
    expected,
    actual: {
      completion: actualCompletion,
      blocking,
      checks: completion.checks,
      feedback: feedbackResults,
    },
    matchedFeedback: feedbackResults.filter((check) => check.result === 'fires'),
    stillBuilding: stillBuildingFor(task, states, actualCompletion),
    mismatches,
  }
  if (unconfirmed.length > 0) result.unconfirmed = unconfirmed
  const skipped = [...completion.checks, ...feedback].filter((c) => c.result === 'skipped').length
  if (skipped > 0) result.skippedRuntimeChecks = skipped
  return result
}
