import { describe, it, expect } from 'vitest'
import { buildSlowMoLive, readSlowMoLive, slowMoStatusText } from '../live.js'
import { applySlowMoGlow, sameSlowMoGlow, SLOW_MO_GLOW_CLASS } from '../glow.js'

describe('slow-mo live payload', () => {
  it('is null unless a slow-mo run is playing, paused or finished', () => {
    expect(buildSlowMoLive({ mode: 'idle', step: 0, glow: [] })).toBeNull()
    expect(buildSlowMoLive(null)).toBeNull()
  })

  it('keeps the mode, step, speed and glow list', () => {
    expect(
      buildSlowMoLive({
        mode: 'paused',
        step: 4,
        speed: 2,
        glow: [{ spriteId: 'cat', blockId: 'b1', extra: 1 }, { bad: true }],
      })
    ).toEqual({ mode: 'paused', step: 4, speed: 2, glow: [{ spriteId: 'cat', blockId: 'b1' }] })
  })

  it('reads a glow list that Realtime Database turned into an object', () => {
    expect(
      readSlowMoLive({
        mode: 'playing',
        step: 2,
        speed: 1,
        glow: { 0: { spriteId: 'a', blockId: 'x' } },
      }).glow
    ).toEqual([{ spriteId: 'a', blockId: 'x' }])
    expect(readSlowMoLive({ mode: 'weird' })).toBeNull()
  })

  it('describes the state for the mirror', () => {
    expect(slowMoStatusText({ mode: 'paused', step: 3 })).toBe('Slow-mo · step 3 · paused')
    expect(slowMoStatusText(null)).toBe('')
  })
})

describe('applySlowMoGlow', () => {
  function workspaceWith(ids) {
    const blocks = Object.fromEntries(
      ids.map((id) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        return [id, { getSvgRoot: () => el }]
      })
    )
    return { getBlockById: (id) => blocks[id] ?? null, el: (id) => blocks[id].getSvgRoot() }
  }

  it('glows several blocks at once and moves the glow on', () => {
    const cat = workspaceWith(['a', 'b'])
    const dog = workspaceWith(['c'])
    const workspaces = { cat, dog }
    let glowing = applySlowMoGlow(workspaces, [
      { spriteId: 'cat', blockId: 'a' },
      { spriteId: 'dog', blockId: 'c' },
    ])
    expect(cat.el('a').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(true)
    expect(dog.el('c').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(true)
    glowing = applySlowMoGlow(workspaces, [{ spriteId: 'cat', blockId: 'b' }], glowing)
    expect(cat.el('a').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(false)
    expect(dog.el('c').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(false)
    expect(cat.el('b').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(true)
    expect(applySlowMoGlow(workspaces, [], glowing)).toEqual([])
    expect(cat.el('b').classList.contains(SLOW_MO_GLOW_CLASS)).toBe(false)
  })

  it('ignores missing sprites and blocks', () => {
    expect(applySlowMoGlow({}, [{ spriteId: 'x', blockId: 'y' }])).toEqual([])
  })

  it('compares glow lists', () => {
    expect(
      sameSlowMoGlow([{ spriteId: 'a', blockId: '1' }], [{ spriteId: 'a', blockId: '1' }])
    ).toBe(true)
    expect(sameSlowMoGlow([], [{ spriteId: 'a', blockId: '1' }])).toBe(false)
  })
})
