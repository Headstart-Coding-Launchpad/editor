import { describe, it, expect } from 'vitest'
import {
  SLOW_MO_SNAPSHOT_CAP,
  appendSlowMoSnapshot,
  captureSlowMoSnapshot,
  describeSlowMoSnapshot,
  slowMoSnapshotFields,
} from '../timeline.js'

const ALL = ['costume', 'backdrop', 'x', 'y', 'variables']

function snap(overrides = {}) {
  return captureSlowMoSnapshot({
    step: 3,
    spriteId: 'cat',
    spriteName: 'Cat',
    blockId: 'b1',
    blockText: 'switch costume to  costume2 ',
    spriteStates: { cat: { x: 10.4, y: -20.6, costume: 'costume2' }, dog: { x: 0, y: 0 } },
    cloneStates: {},
    backdropName: 'Blue Sky',
    variables: { score: 2 },
    ...overrides,
  })
}

describe('captureSlowMoSnapshot', () => {
  it('records the running sprite’s costume and rounded position, the backdrop and variables', () => {
    const s = snap()
    expect(s).toMatchObject({
      step: 3,
      spriteId: 'cat',
      costume: 'costume2',
      x: 10,
      y: -21,
      backdropName: 'Blue Sky',
      variables: { score: 2 },
      blockText: 'switch costume to  costume2',
    })
  })

  it('copies the whole stage, so later changes don’t rewrite history', () => {
    const spriteStates = { cat: { x: 1, y: 2, costume: 'a' } }
    const variables = { score: 1 }
    const s = snap({ spriteStates, variables })
    spriteStates.cat.x = 99
    variables.score = 5
    expect(s.spriteStates.cat.x).toBe(1)
    expect(s.variables.score).toBe(1)
  })

  it('uses a clone’s own state when given', () => {
    const s = snap({
      spriteId: 'clone-1',
      baseSpriteId: 'cat',
      actorState: { x: 5, y: 6, costume: 'c' },
    })
    expect(s).toMatchObject({ spriteId: 'clone-1', baseSpriteId: 'cat', x: 5, y: 6, costume: 'c' })
  })
})

describe('appendSlowMoSnapshot', () => {
  it('adds snapshots until the cap, then reports it is full', () => {
    let list = []
    for (let i = 0; i < 3; i++) list = appendSlowMoSnapshot(list, snap({ step: i }), 3).snapshots
    expect(list).toHaveLength(3)
    const result = appendSlowMoSnapshot(list, snap({ step: 4 }), 3)
    expect(result.capped).toBe(true)
    expect(result.snapshots).toBe(list)
  })

  it('caps at 500 by default', () => {
    expect(SLOW_MO_SNAPSHOT_CAP).toBe(500)
  })
})

describe('slowMoSnapshotFields / describeSlowMoSnapshot', () => {
  it('shows only the task’s timeline fields, in order, with a row per variable', () => {
    expect(slowMoSnapshotFields(snap(), ['x', 'variables'])).toEqual([
      { field: 'x', label: 'x', value: '10' },
      { field: 'variables', label: 'score', value: '2' },
    ])
  })

  it('labels a snapshot in words for screen readers', () => {
    expect(describeSlowMoSnapshot(snap(), ALL)).toBe(
      'Step 3. Cat: switch costume to  costume2. Costume costume2, Backdrop Blue Sky, x 10, y -21, score 2'
    )
  })
})
