import {
  canDrawRealBlocks,
  clearScratchFenceCache,
  loadFenceRuntime,
  peekScratchFenceSvg,
  renderScratchFenceSvg,
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
    expect(tops(r)[0].next.block.inputs.STEPS.block).toMatchObject({
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

  it('falls back when a condition slot holds text that is not a block', () => {
    // An empty hexagon would draw a different block from the one written.
    for (const line of ['if <score > 5> then', 'if <score is big> then']) {
      const r = toState([line, '  move (10) steps', 'end'])
      expect(r.ok, line).toBe(false)
      expect(r.problems.join(' '), line).toMatch(/condition/)
    }
  })

  it('still draws an empty condition and a real boolean block in a condition slot', () => {
    expect(toState(['if <> then', '  move (10) steps', 'end']).ok).toBe(true)
    const r = toState(['if <touching [edge]?> then', '  move (10) steps', 'end'])
    expect(r.ok).toBe(true)
    expect(tops(r)[0].inputs.CONDITION.block.type).toBe('sensing_touchingobject')
    const gt = toState(['if <(score) > (5)> then', '  move (10) steps', 'end'])
    expect(gt.ok).toBe(true)
    expect(tops(gt)[0].inputs.CONDITION.block.type).toBe('operator_gt')
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

  it('keeps ids referenced with quoted url() forms, as computed styles write them', () => {
    const quoted =
      '<svg><defs><filter id="a1"/><filter id="b2"/></defs>' +
      '<path style="filter:url(&quot;#a1&quot;)"/><path style="filter: url(\'#b2\')"/></svg>'
    const out = tidySvgIds(quoted)
    expect(out).toMatch(/id="hsc-sb-0"/)
    expect(out).toMatch(/url\(&quot;#hsc-sb-0&quot;\)/)
    expect(out).toMatch(/id="hsc-sb-1"/)
    expect(out).toMatch(/url\('#hsc-sb-1'\)/)
    const scoped = scopeSvgIds(out, 'p')
    expect(scoped).toMatch(/url\(&quot;#hsc-sb-p-0&quot;\)/)
    expect(scoped).toMatch(/url\('#hsc-sb-p-1'\)/)
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

describe('render cache', () => {
  const FENCE = ['when green flag clicked', 'move (10) steps'].join('\n')
  let realSvg
  beforeEach(() => {
    clearScratchFenceCache()
    realSvg = rt.svg
  })
  afterEach(() => {
    rt.svg = realSvg
    clearScratchFenceCache()
  })

  it('caches a fence Blockly cannot draw', async () => {
    const r = await renderScratchFenceSvg('wiggle [a lot]')
    expect(r.ok).toBe(false)
    expect(peekScratchFenceSvg('wiggle [a lot]')).toBe(r)
  })

  it('does not cache a render that threw, so the next request tries again', async () => {
    rt.svg = {
      ...realSvg,
      workspaceToSvg: async () => {
        throw new Error('chunk failed')
      },
    }
    const first = await renderScratchFenceSvg(FENCE)
    expect(first.ok).toBe(false)
    expect(peekScratchFenceSvg(FENCE)).toBeUndefined()
    const second = await renderScratchFenceSvg(FENCE)
    expect(second).not.toBe(first)
  })

  it('drops a queued render nobody wants any more', async () => {
    const drawn = []
    rt.svg = {
      ...realSvg,
      workspaceToSvg: async (ws) => {
        drawn.push(ws.getTopBlocks(false).length)
        return { svg: '<svg width="10" height="10"></svg>', width: 10, height: 10 }
      },
    }
    const typed = ['move (1) steps', 'move (12) steps'].map((l) => `when green flag clicked\n${l}`)
    const controllers = typed.map(() => new AbortController())
    const jobs = typed.map((code, i) =>
      renderScratchFenceSvg(code, { signal: controllers[i].signal })
    )
    controllers[0].abort()
    const [dropped, kept] = await Promise.all(jobs)
    expect(drawn).toHaveLength(1)
    expect(dropped.ok).toBe(false)
    expect(peekScratchFenceSvg(typed[0])).toBeUndefined()
    expect(kept.ok).toBe(true)
    expect(peekScratchFenceSvg(typed[1])).toBe(kept)
  })

  it('does not cache a picture measured before the block font loaded', async () => {
    rt.svg = {
      ...realSvg,
      workspaceToSvg: async () => ({
        svg: '<svg width="10" height="10"></svg>',
        width: 10,
        height: 10,
      }),
    }
    const fonts = { load: async () => [], check: () => false }
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
    try {
      const r = await renderScratchFenceSvg(FENCE)
      expect(r.ok).toBe(true)
      expect(peekScratchFenceSvg(FENCE)).toBeUndefined()
      fonts.check = () => true
      const again = await renderScratchFenceSvg(FENCE)
      expect(peekScratchFenceSvg(FENCE)).toBe(again)
    } finally {
      delete document.fonts
    }
  })

  it('leaves no render workspace or host on the page between renders', async () => {
    rt.svg = {
      ...realSvg,
      workspaceToSvg: async () => ({
        svg: '<svg width="10" height="10"></svg>',
        width: 10,
        height: 10,
      }),
    }
    // The student's own workspace keeps the keyboard shortcuts (copy, paste, delete, undo).
    const studentDiv = document.createElement('div')
    document.body.appendChild(studentDiv)
    const student = rt.Blockly.inject(studentDiv, { renderer: 'zelos' })
    try {
      await renderScratchFenceSvg(FENCE)
      expect(rt.Blockly.getMainWorkspace()).toBe(student)
      expect(document.querySelectorAll('.injectionDiv')).toHaveLength(1)
      expect(document.getElementById('hsc-explainer-blockly-host')).toBeNull()
    } finally {
      student.dispose()
      studentDiv.remove()
    }
  })

  it('never leaves a disposed render workspace as Blockly main when there was no main', async () => {
    // A page with no student workspace (an explainer on its own).
    rt.Blockly.common.setMainWorkspace(null)
    const host = rt.svg.createRenderHost(100)
    const ws = rt.svg.injectRenderWorkspace(rt.Blockly, host)
    ws.dispose()
    host.remove()
    expect(rt.Blockly.getMainWorkspace()).toBeFalsy()
  })

  it('puts the student workspace back as main after a render workspace is disposed', () => {
    const studentDiv = document.createElement('div')
    document.body.appendChild(studentDiv)
    const student = rt.Blockly.inject(studentDiv, { renderer: 'zelos' })
    try {
      const host = rt.svg.createRenderHost(100)
      const ws = rt.svg.injectRenderWorkspace(rt.Blockly, host)
      // Something (a click on it, a focus) made the render workspace main meanwhile.
      rt.Blockly.common.setMainWorkspace(ws)
      ws.dispose()
      host.remove()
      expect(rt.Blockly.getMainWorkspace()).toBe(student)
    } finally {
      student.dispose()
      studentDiv.remove()
      rt.Blockly.common.setMainWorkspace(null)
    }
  })

  const stubDraw = () => ({
    ...realSvg,
    workspaceToSvg: async () => ({
      svg: '<svg width="10" height="10"></svg>',
      width: 10,
      height: 10,
    }),
  })

  it('falls back when Blockly changes a number shadow value (no other number drawn)', async () => {
    rt.svg = stubDraw()
    const r = await renderScratchFenceSvg('when green flag clicked\nmove (1e3) steps')
    expect(r.ok).toBe(false)
    expect(r.problems.join(' ')).toMatch(/math_number\.NUM: 1e3/)
  })

  it('falls back when a variable reporter name is refused by its menu', async () => {
    rt.svg = stubDraw()
    const realScratch = rt.scratch
    // A menu with no variables at all: Blockly would draw some other name.
    rt.scratch = {
      ...realScratch,
      setWorkspaceBlocklyContext: (ws) =>
        realScratch.setWorkspaceBlocklyContext(ws, () => ({
          sprites: [],
          costumes: [],
          backdrops: [],
          variables: [{ id: 'other', name: 'other' }],
          sounds: [],
        })),
    }
    try {
      const r = await renderScratchFenceSvg('when green flag clicked\nmove (speed) steps')
      expect(r.ok).toBe(false)
      expect(r.problems.join(' ')).toMatch(/data_variable\.VARIABLE: speed/)
    } finally {
      rt.scratch = realScratch
    }
  })

  it('loads the block font for the fence text itself, and does not cache a stand-in', async () => {
    rt.svg = stubDraw()
    const asked = []
    const fonts = {
      load: async (font, text) => {
        asked.push(text)
        return []
      },
      // Latin is there; the accented letter's subset is not.
      check: (font, text) => !(text ?? '').includes('é'),
    }
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
    const CAFE = 'when green flag clicked\nsay [café]'
    try {
      const r = await renderScratchFenceSvg(CAFE)
      expect(r.ok).toBe(true)
      expect(asked.some((t) => t?.includes('café'))).toBe(true)
      expect(peekScratchFenceSvg(CAFE)).toBeUndefined()
      await renderScratchFenceSvg(FENCE)
      expect(peekScratchFenceSvg(FENCE)).toBeDefined()
    } finally {
      delete document.fonts
    }
  })
})

describe('block ids', () => {
  it('gives variable reporters and shadow blocks ids, so refused values are found', () => {
    const r = toState(['when green flag clicked', 'move (speed) steps', 'turn right (15) degrees'])
    const move = tops(r)[0].next.block
    expect(move.inputs.STEPS.block.id).toBeTruthy()
    expect(move.inputs.STEPS.shadow.id).toBeTruthy()
    expect(move.next.block.inputs.DEGREES.shadow.id).toBeTruthy()
  })
})

it('does not try to draw with Blockly in jsdom', () => {
  expect(canDrawRealBlocks()).toBe(false)
})
