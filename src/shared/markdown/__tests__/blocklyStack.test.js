import {
  canDrawRealBlocks,
  loadFenceRuntime,
  scopeSvgIds,
  scratchFenceToState,
  tidySvgIds,
} from '../blocklyStack.js'

let rt
beforeAll(async () => {
  rt = await loadFenceRuntime()
})

const toState = (lines) => scratchFenceToState(rt, lines.join('\n'))
const tops = (r) => r.state.blocks.blocks

describe('scratchFenceToState', () => {
  it('maps a fence to Blockly blocks, children inside the C block mouth', () => {
    const r = toState([
      'when green flag clicked',
      'forever',
      '  next costume',
      '  say [Twinkle!] for (1) seconds',
      'end',
    ])
    expect(r.ok).toBe(true)
    expect(tops(r)).toHaveLength(1)
    const hat = tops(r)[0]
    expect(hat.type).toBe('event_whenflagclicked')
    const forever = hat.next.block
    expect(forever.type).toBe('control_forever')
    const inner = forever.inputs.SUBSTACK.block
    expect(inner.type).toBe('looks_nextcostume')
    const say = inner.next.block
    expect(say.type).toBe('looks_sayforsecs')
    expect(say.inputs.MESSAGE.shadow.fields.TEXT).toBe('Twinkle!')
    expect(say.inputs.SECS.shadow.fields.NUM).toBe('1')
  })

  it('falls back (ok: false) when a line is not a Scratch block', () => {
    const r = toState(['when green flag clicked', 'wiggle [a lot]'])
    expect(r.ok).toBe(false)
    expect(r.problems.join(' ')).toMatch(/unknown block text/)
  })

  it('draws a block written under forever as its own stack, as Scratch would', () => {
    // Never Stop Dancing (u4057rbh6c) quiz option B, and the Brrr! fence in 0sdnhw63b4.
    const r = toState([
      'when green flag clicked',
      'forever',
      '  next costume',
      'end',
      'switch backdrop to [Castle]',
    ])
    expect(r.ok).toBe(true)
    expect(tops(r).map((b) => b.type)).toEqual(['event_whenflagclicked', 'looks_switchbackdropto'])
    expect(tops(r)[0].next.block.next).toBeUndefined()
  })

  it('falls back when a block is written under forever inside another mouth', () => {
    const r = toState([
      'repeat (2)',
      '  forever',
      '    next costume',
      '  end',
      '  move (10) steps',
      'end',
    ])
    expect(r.ok).toBe(false)
  })

  it('draws if … else as the two-mouth block', () => {
    const r = toState([
      'if <touching [edge]?> then',
      '  turn right (15) degrees',
      'else',
      '  move (10) steps',
      'end',
    ])
    expect(r.ok).toBe(true)
    const ifElse = tops(r)[0]
    expect(ifElse.type).toBe('control_if_else')
    expect(ifElse.inputs.SUBSTACK.block.type).toBe('motion_turnright')
    expect(ifElse.inputs.SUBSTACK2.block.type).toBe('motion_movesteps')
  })

  it('makes a bare word in a number slot a variable reporter and offers it in the menus', () => {
    const r = toState(['when green flag clicked', 'move (speed) steps'])
    expect(r.ok).toBe(true)
    expect(tops(r)[0].next.block.inputs.STEPS.block).toEqual({
      type: 'data_variable',
      fields: { VARIABLE: 'speed' },
    })
    expect(r.values).toContain('speed')
  })

  it('starts a new stack at each hat block', () => {
    const r = toState([
      'when [space] key pressed',
      'broadcast [jump]',
      'when I receive [jump]',
      'change y by (10)',
    ])
    expect(r.ok).toBe(true)
    expect(tops(r)).toHaveLength(2)
  })

  it('gives every block its own id', () => {
    const r = toState([
      'when green flag clicked',
      'repeat (3)',
      '  next costume',
      '  next costume',
      'end',
    ])
    const ids = []
    const walk = (b) => {
      if (!b) return
      if (b.id) ids.push(b.id)
      Object.values(b.inputs ?? {}).forEach((i) => walk(i.block))
      walk(b.next?.block)
    }
    tops(r).forEach(walk)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('svg ids', () => {
  const svg =
    '<svg><defs><filter id="glow123"/><pattern id="unused9"/></defs>' +
    '<g data-id="b0"><path style="filter:url(#glow123)"/></g><use href="#glow123"/></svg>'

  it('drops block data-ids and unreferenced ids, renames the rest', () => {
    const out = tidySvgIds(svg)
    expect(out).not.toMatch(/data-id/)
    expect(out).not.toMatch(/unused9/)
    expect(out).toMatch(/id="hsc-sb-0"/)
    expect(out).toMatch(/url\(#hsc-sb-0\)/)
    expect(out).toMatch(/href="#hsc-sb-0"/)
  })

  it('scopes ids per picture so two copies on a page never clash', () => {
    const tidy = tidySvgIds(svg)
    const a = scopeSvgIds(tidy, ':r1:')
    const b = scopeSvgIds(tidy, ':r2:')
    expect(a).toMatch(/id="hsc-sb-r1-0"/)
    expect(a).toMatch(/url\(#hsc-sb-r1-0\)/)
    expect(b).toMatch(/id="hsc-sb-r2-0"/)
  })
})

it('does not try to draw with Blockly in jsdom', () => {
  expect(canDrawRealBlocks()).toBe(false)
})
