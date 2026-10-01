import { describe, expect, it, vi } from 'vitest'
import {
  getSelectableScratchSprites,
  isSpriteStudentEditable,
  wrapScratchBubbleText,
  isSpriteCheckable,
  filterCheckableSpriteWorkspaces,
  isSpriteRemovable,
  isValidNewVariableName,
  computeBlockScale,
  computeStageScale,
  cloneSpriteStates,
  evalSingleCheckPartial,
  blockPlacedCheckHasFailed,
  routeWorkspaceEdit,
} from '../ScratchWorkspace'
import { FEEDBACK_TIMING, evaluateCheckWithCustomFeedback } from '../../checks'

// Workspace stub where blocks form named chains, for blocks_in_order checks.
function makeChainWorkspace(chains) {
  const allBlocks = []
  for (const chain of chains) {
    const cb = chain.map((type) => ({
      type,
      getNextBlock: null,
      previousConnection: { isConnected: () => false },
    }))
    for (let i = 0; i < cb.length; i++) {
      const next = cb[i + 1] ?? null
      cb[i].getNextBlock = () => next
      if (i > 0) cb[i].previousConnection = { isConnected: () => true }
    }
    allBlocks.push(...cb)
  }
  return { getAllBlocks: () => allBlocks }
}

describe('computeBlockScale', () => {
  it('returns the default (max) scale at/above the wide reference size', () => {
    expect(computeBlockScale(1000, 600)).toBeCloseTo(0.75)
    expect(computeBlockScale(2000, 2000)).toBeCloseTo(0.75)
  })

  it('interpolates down as either dimension shrinks below the reference size', () => {
    expect(computeBlockScale(500, 600)).toBeCloseTo(0.675) // half width, full height
    expect(computeBlockScale(1000, 300)).toBeCloseTo(0.675) // full width, half height
  })

  it('is bound by the smaller of width/height factor (both must be roomy for full scale)', () => {
    expect(computeBlockScale(1000, 300)).toBeCloseTo(computeBlockScale(500, 600))
  })

  it('never goes below the readability floor, even at zero size', () => {
    expect(computeBlockScale(0, 0)).toBeCloseTo(0.6)
    expect(computeBlockScale(0, 0)).toBeGreaterThanOrEqual(0.6)
  })
})

describe('computeStageScale', () => {
  it('is full size when both dimensions are roomy', () => {
    expect(computeStageScale(1600, 900, { compact: false, flyoutCollapsed: false })).toBe(1)
  })

  it('shrinks the stage when the container is short, even though it stays wide — this is what lets the stage scale down instead of disappearing behind a Blocks/Stage tab switcher when a banner shrinks the available height', () => {
    const scale = computeStageScale(1600, 300, { compact: false, flyoutCollapsed: false })
    expect(scale).toBeCloseTo(0.685, 3)
    expect(scale).toBeLessThan(1)
  })

  it('never goes below the readability floor, even when height is near zero', () => {
    expect(computeStageScale(1600, 100, { compact: false, flyoutCollapsed: false })).toBeCloseTo(
      0.35
    )
  })

  it('ignores height entirely when it is not measured yet (0)', () => {
    expect(computeStageScale(1600, 0, { compact: false, flyoutCollapsed: false })).toBe(1)
  })

  it('reserves less width for the editor in compact mode, since Blocks/Stage share the full width in turn instead of sitting side-by-side', () => {
    const nonCompact = computeStageScale(500, 0, { compact: false, flyoutCollapsed: false })
    const compact = computeStageScale(500, 0, { compact: true, flyoutCollapsed: false })
    expect(nonCompact).toBeCloseTo(0.357, 3)
    expect(compact).toBe(1)
  })
})

describe('ScratchWorkspace student-editable sprite helpers', () => {
  it('treats sprites as student-editable by default', () => {
    expect(isSpriteStudentEditable({ id: 'sprite1' })).toBe(true)
    expect(isSpriteStudentEditable({ id: 'sprite2', studentEditable: true })).toBe(true)
  })

  it('filters locked sprites only when student editability is respected', () => {
    const sprites = [
      { id: 'sprite1', name: 'Editable' },
      { id: 'sprite2', name: 'Locked', studentEditable: false },
    ]

    expect(getSelectableScratchSprites(sprites, false)).toEqual(sprites)
    expect(getSelectableScratchSprites(sprites, true)).toEqual([sprites[0]])
  })
})

describe('student-added sprite/backdrop check-invisibility', () => {
  it('treats author-authored sprites as checkable and student-added ones as not', () => {
    expect(isSpriteCheckable({ id: 'sprite1', name: 'Rocket' })).toBe(true)
    expect(isSpriteCheckable({ id: 'sprite2', name: 'Rocket', studentAdded: false })).toBe(true)
    expect(isSpriteCheckable({ id: 'sprite3', name: 'Extra', studentAdded: true })).toBe(false)
  })

  it('filters student-added sprite workspaces out of check evaluation, keeping authored ones (and their order)', () => {
    const spriteWorkspaces = [
      { id: 'sprite1', name: 'Sprite 1' },
      { id: 'sprite2', name: 'Extra', studentAdded: true },
      { id: 'sprite3', name: 'Sprite 3' },
    ]

    expect(filterCheckableSpriteWorkspaces(spriteWorkspaces)).toEqual([
      spriteWorkspaces[0],
      spriteWorkspaces[2],
    ])
  })

  it('handles an empty/missing list', () => {
    expect(filterCheckableSpriteWorkspaces([])).toEqual([])
    expect(filterCheckableSpriteWorkspaces(undefined)).toEqual([])
  })
})

describe('isSpriteRemovable', () => {
  const starterSprite = { id: 'sprite1', name: 'Rocket' }
  const addedSprite = { id: 'sprite2', name: 'Extra', studentAdded: true }

  it('never allows removal when the task does not opt in', () => {
    expect(isSpriteRemovable(starterSprite, {})).toBe(false)
    expect(isSpriteRemovable(addedSprite, {})).toBe(false)
    expect(isSpriteRemovable(addedSprite, { allowRemoveStarterSprites: true })).toBe(false)
  })

  it('only allows removing student-added sprites by default, never author-placed ones', () => {
    const task = { allowRemoveSprite: true }
    expect(isSpriteRemovable(addedSprite, task)).toBe(true)
    expect(isSpriteRemovable(starterSprite, task)).toBe(false)
  })

  it('allows removing author-placed sprites too when allowRemoveStarterSprites is set', () => {
    const task = { allowRemoveSprite: true, allowRemoveStarterSprites: true }
    expect(isSpriteRemovable(starterSprite, task)).toBe(true)
    expect(isSpriteRemovable(addedSprite, task)).toBe(true)
  })
})

describe('evalSingleCheckPartial multi-sprite aggregation (no spriteName)', () => {
  it('does not fail because one unrelated sprite happens to violate the sequence', () => {
    // sprite1 is what the check targets and hasn't been touched yet (still 'pending').
    // sprite2 is unrelated, but starts with the same hat block and then diverges —
    // that alone must not fail a check that can still be satisfied via sprite1.
    const check = {
      type: 'blocks_in_order',
      sequence: ['event_whenflagclicked', 'motion_movesteps'],
    }
    const spriteWorkspaces = [
      { name: 'sprite1', workspace: makeChainWorkspace([['event_whenflagclicked']]) },
      {
        name: 'sprite2',
        workspace: makeChainWorkspace([['event_whenflagclicked', 'looks_say']]),
      },
    ]

    expect(evalSingleCheckPartial(check, spriteWorkspaces)).toBe('pending')
  })

  it('still fails once every sprite has ruled the check out', () => {
    const check = {
      type: 'blocks_in_order',
      sequence: ['event_whenflagclicked', 'motion_movesteps'],
    }
    const spriteWorkspaces = [
      { name: 'sprite1', workspace: makeChainWorkspace([['event_whenflagclicked', 'looks_say']]) },
      { name: 'sprite2', workspace: makeChainWorkspace([['event_whenflagclicked', 'looks_say']]) },
    ]

    expect(evalSingleCheckPartial(check, spriteWorkspaces)).toBe('fail')
  })

  it('still passes as soon as any sprite satisfies the sequence', () => {
    const check = {
      type: 'blocks_in_order',
      sequence: ['event_whenflagclicked', 'motion_movesteps'],
    }
    const spriteWorkspaces = [
      { name: 'sprite1', workspace: makeChainWorkspace([['event_whenflagclicked', 'looks_say']]) },
      {
        name: 'sprite2',
        workspace: makeChainWorkspace([['event_whenflagclicked', 'motion_movesteps']]),
      },
    ]

    expect(evalSingleCheckPartial(check, spriteWorkspaces)).toBe('pass')
  })
})

describe('after_block_placed hint selection (blockPlacedCheckHasFailed)', () => {
  const sequence = ['event_whenflagclicked', 'motion_movesteps']
  const runCheck = { type: 'block_run', opcode: 'motion_movesteps', hint: 'Run hint' }
  const pendingCheck = {
    type: 'block_used',
    opcode: 'looks_say',
    evaluation: 'after_block_placed',
    hint: 'Pending hint',
  }
  const orderCheck = {
    type: 'blocks_in_order',
    sequence,
    evaluation: 'after_block_placed',
    hint: 'Order hint',
  }
  const sws = [
    { name: 'sprite1', workspace: makeChainWorkspace([['event_whenflagclicked', 'looks_turn']]) },
  ]

  it('only counts block-placement checks that definitively failed', () => {
    expect(evalSingleCheckPartial(orderCheck, sws)).toBe('fail')
    expect(blockPlacedCheckHasFailed(orderCheck, sws)).toBe(true)
    // looks_say isn't placed yet: pending, not failed.
    expect(evalSingleCheckPartial(pendingCheck, sws)).toBe('pending')
    expect(blockPlacedCheckHasFailed(pendingCheck, sws)).toBe(false)
    // Run-time checks are never judged before a Run.
    expect(blockPlacedCheckHasFailed(runCheck, sws)).toBe(false)
  })

  it('a run-time or pending check listed first does not steal the hint from the failed one', () => {
    const task = { check: [runCheck, pendingCheck, orderCheck] }
    const evaluation = evaluateCheckWithCustomFeedback(
      task,
      false,
      () => false, // the full evaluator reports every check as not passed (stale run signal)
      '',
      {},
      {
        feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT,
        isCompletionCheckFailed: (c) => blockPlacedCheckHasFailed(c, sws),
      }
    )
    expect(evaluation.suggestion).toBe('Order hint')
  })
})

describe('isValidNewVariableName', () => {
  const existing = [{ name: 'score' }, { name: 'Lives' }]

  it('rejects empty or whitespace-only names', () => {
    expect(isValidNewVariableName('', existing)).toBe(false)
    expect(isValidNewVariableName('   ', existing)).toBe(false)
    expect(isValidNewVariableName(undefined, existing)).toBe(false)
  })

  it('rejects a name that collides case-insensitively with an existing variable', () => {
    expect(isValidNewVariableName('score', existing)).toBe(false)
    expect(isValidNewVariableName('SCORE', existing)).toBe(false)
    expect(isValidNewVariableName('lives', existing)).toBe(false)
  })

  it('accepts a trimmed, non-colliding name', () => {
    expect(isValidNewVariableName('  combo  ', existing)).toBe(true)
    expect(isValidNewVariableName('combo', [])).toBe(true)
  })
})

describe('cloneSpriteStates', () => {
  it('returns per-sprite state objects that are not the same reference as the originals', () => {
    const original = { sprite1: { x: 0, y: 0 }, sprite2: { x: 5, y: -5 } }
    const clone = cloneSpriteStates(original)

    expect(clone).toEqual(original)
    expect(clone.sprite1).not.toBe(original.sprite1)
    expect(clone.sprite2).not.toBe(original.sprite2)
  })

  it('is unaffected when the run mutates the live sprite state object in place afterwards', () => {
    // Regression: run-block handlers (scratch.js's motion cases) mutate a sprite's state
    // object directly, e.g. `state.x += steps`, before eventually swapping in a fresh clone
    // via onUpdate. A pre-run snapshot taken with a shallow `{ ...spriteStatesRef.current }`
    // copy still shares each sprite's state object with the live run, so that in-place
    // mutation corrupts the "before" snapshot too — making sprite_property_delta/_changed
    // checks always compare a state against itself (delta always 0, "changed" always false).
    const live = { sprite1: { x: 0, y: 0 } }
    const preRunSnapshot = cloneSpriteStates(live)

    live.sprite1.x += -10 // simulates runBlock's `state.x += steps` in-place mutation

    expect(live.sprite1.x).toBe(-10)
    expect(preRunSnapshot.sprite1.x).toBe(0)
  })
})

describe('wrapScratchBubbleText', () => {
  const ctx = { measureText: (value) => ({ width: value.length * 10 }) }

  it('wraps speech text instead of letting it overflow a capped bubble', () => {
    expect(wrapScratchBubbleText(ctx, 'Why was the cat sitting on the computer?', 120)).toEqual([
      'Why was the',
      'cat sitting',
      'on the',
      'computer?',
    ])
  })

  it('splits an unbroken long value to keep it inside the bubble', () => {
    expect(wrapScratchBubbleText(ctx, 'abcdefghijkl', 40)).toEqual(['abcd', 'efgh', 'ijkl'])
  })
})

describe('routeWorkspaceEdit', () => {
  function makeActions({ feedback = true } = {}) {
    return {
      hasCheckFeedback: vi.fn(() => feedback),
      clearCheckFeedback: vi.fn(),
      syncNow: vi.fn(),
      scheduleSync: vi.fn(),
      scheduleChecks: vi.fn(),
    }
  }

  it('syncs each keystroke in an open text field without clearing feedback or running checks', () => {
    const actions = makeActions()
    for (const [oldValue, newValue] of [
      ['Hello!', 'h'],
      ['h', 'ha'],
      ['ha', 'hav'],
    ]) {
      routeWorkspaceEdit(
        { type: 'block_field_intermediate_change', name: 'MESSAGE', oldValue, newValue },
        actions
      )
    }
    expect(actions.scheduleSync).toHaveBeenCalledTimes(3)
    expect(actions.syncNow).not.toHaveBeenCalled()
    expect(actions.clearCheckFeedback).not.toHaveBeenCalled()
    expect(actions.scheduleChecks).not.toHaveBeenCalled()
  })

  it('runs checks once when the field edit is committed', () => {
    const actions = makeActions()
    routeWorkspaceEdit(
      { type: 'block_field_intermediate_change', oldValue: 'Hello!', newValue: 'h' },
      actions
    )
    routeWorkspaceEdit(
      { type: 'block_field_intermediate_change', oldValue: 'h', newValue: 'hi' },
      actions
    )
    routeWorkspaceEdit(
      { type: 'change', element: 'field', name: 'MESSAGE', oldValue: 'Hello!', newValue: 'hi' },
      actions
    )
    expect(actions.clearCheckFeedback).toHaveBeenCalledTimes(1)
    expect(actions.scheduleChecks).toHaveBeenCalledTimes(1)
    expect(actions.scheduleSync).toHaveBeenCalledTimes(3)
  })

  it('clears feedback and runs checks for block edits, syncing a new block at once', () => {
    const actions = makeActions()
    routeWorkspaceEdit({ type: 'create', blockId: 'b1' }, actions)
    expect(actions.syncNow).toHaveBeenCalledTimes(1)
    expect(actions.scheduleSync).not.toHaveBeenCalled()
    routeWorkspaceEdit({ type: 'move', blockId: 'b1', newParentId: 'p1' }, actions)
    routeWorkspaceEdit({ type: 'delete', blockId: 'b1' }, actions)
    expect(actions.scheduleSync).toHaveBeenCalledTimes(2)
    expect(actions.clearCheckFeedback).toHaveBeenCalledTimes(3)
    expect(actions.scheduleChecks).toHaveBeenCalledTimes(3)
  })

  it('leaves feedback alone when there is none to clear', () => {
    const actions = makeActions({ feedback: false })
    routeWorkspaceEdit({ type: 'delete', blockId: 'b1' }, actions)
    expect(actions.clearCheckFeedback).not.toHaveBeenCalled()
    expect(actions.scheduleChecks).toHaveBeenCalledTimes(1)
  })
})
