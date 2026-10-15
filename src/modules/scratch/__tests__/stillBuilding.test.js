// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isHatOpcode,
  isScratchStillBuilding,
  scratchStatesHaveLooseBlock,
  scratchStatesStructurallyEqual,
} from '../stillBuilding.js'

const flagScript = (id = 'h1', x = 20, y = 30, moveSteps = 10) => ({
  type: 'event_whenflagclicked',
  id,
  x,
  y,
  next: {
    block: {
      type: 'motion_movesteps',
      id: `${id}-move`,
      inputs: {
        STEPS: { shadow: { type: 'math_number', id: `${id}-num`, fields: { NUM: moveSteps } } },
      },
    },
  },
})

const state = (...blocks) => ({ blocks: { languageVersion: 0, blocks } })

describe('scratchStatesStructurallyEqual', () => {
  it('ignores block ids and positions', () => {
    const a = { cat: state(flagScript('a', 0, 0)) }
    const b = { cat: state(flagScript('zz', 300, 120)) }
    expect(scratchStatesStructurallyEqual(a, b)).toBe(true)
  })

  it('ignores the order of top-level stacks', () => {
    const key = { type: 'event_whenkeypressed', id: 'k', fields: { KEY_OPTION: 'space' } }
    const a = { cat: state(flagScript(), key) }
    const b = { cat: state({ ...key, id: 'k2' }, flagScript('other')) }
    expect(scratchStatesStructurallyEqual(a, b)).toBe(true)
  })

  it('sees a changed field value', () => {
    const a = { cat: state(flagScript('a', 0, 0, 10)) }
    const b = { cat: state(flagScript('a', 0, 0, 20)) }
    expect(scratchStatesStructurallyEqual(a, b)).toBe(false)
  })

  it('sees an added block', () => {
    const a = { cat: state(flagScript()) }
    const b = { cat: state(flagScript(), { type: 'looks_show', id: 'x' }) }
    expect(scratchStatesStructurallyEqual(a, b)).toBe(false)
  })

  it('treats a missing sprite and an empty workspace as equal', () => {
    expect(scratchStatesStructurallyEqual({ cat: state() }, {})).toBe(true)
    expect(scratchStatesStructurallyEqual({ cat: { blocks: undefined } }, { cat: state() })).toBe(
      true
    )
  })

  it('compares every sprite', () => {
    const a = { cat: state(flagScript()), dog: state() }
    const b = { cat: state(flagScript()), dog: state(flagScript()) }
    expect(scratchStatesStructurallyEqual(a, b)).toBe(false)
  })

  it('skips the __meta__ entry', () => {
    const a = { cat: state(), __meta__: { addedSprites: [1] } }
    expect(scratchStatesStructurallyEqual(a, { cat: state() })).toBe(true)
  })
})

describe('scratchStatesHaveLooseBlock', () => {
  it('hats are never loose', () => {
    expect(isHatOpcode('event_whenflagclicked')).toBe(true)
    expect(isHatOpcode('control_start_as_clone')).toBe(true)
    expect(scratchStatesHaveLooseBlock({ cat: state(flagScript()) })).toBe(false)
  })

  it('a top-level stack block is loose', () => {
    expect(isHatOpcode('motion_movesteps')).toBe(false)
    const loose = { type: 'motion_movesteps', id: 'm', x: 200, y: 200 }
    expect(scratchStatesHaveLooseBlock({ cat: state(flagScript(), loose) })).toBe(true)
  })

  it('a top-level reporter is loose', () => {
    const reporter = { type: 'operator_add', id: 'r' }
    expect(scratchStatesHaveLooseBlock({ cat: state(flagScript(), reporter) })).toBe(true)
  })

  it('an unknown opcode counts as loose', () => {
    expect(scratchStatesHaveLooseBlock({ cat: state({ type: 'mystery_block' }) })).toBe(true)
  })

  it('checks the stage workspace too', () => {
    expect(
      scratchStatesHaveLooseBlock({ cat: state(), __stage__: state({ type: 'looks_show' }) })
    ).toBe(true)
  })
})

describe('isScratchStillBuilding', () => {
  const opened = { cat: state(flagScript('a', 10, 10)) }

  it('is still building when unchanged since the task opened', () => {
    expect(isScratchStillBuilding({ cat: state(flagScript('b', 99, 99)) }, opened)).toBe(true)
  })

  it('is still building with a loose block', () => {
    const current = { cat: state(flagScript('a', 10, 10, 50), { type: 'looks_hide', id: 'l' }) }
    expect(isScratchStillBuilding(current, opened)).toBe(true)
  })

  it('is judged once changed and every block is attached', () => {
    expect(isScratchStillBuilding({ cat: state(flagScript('a', 10, 10, 50)) }, opened)).toBe(false)
  })

  it('without a baseline, only the loose-block rule applies', () => {
    expect(isScratchStillBuilding({ cat: state(flagScript()) }, null)).toBe(false)
    expect(isScratchStillBuilding({ cat: state({ type: 'looks_hide' }) }, null)).toBe(true)
  })

  it('an empty starter left empty is still building', () => {
    expect(isScratchStillBuilding({ cat: state() }, { cat: state() })).toBe(true)
  })
})
