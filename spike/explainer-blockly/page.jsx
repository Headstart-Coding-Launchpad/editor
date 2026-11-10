// SPIKE page (never part of the app): the current Markdown Scratch renderer beside the real
// Blockly render of the same fence text. Views: ?view=compare | sweep | perf
import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ScratchBlocks } from '../../src/shared/markdown/ScratchBlocks.jsx'
import { RealScratchBlocks, EXPLAINER_BLOCK_SCALE } from '../../src/shared/markdown/RealScratchBlocks.jsx'
import {
  renderScratchFenceSvg,
  blocklyRuntimeLoadMs,
  clearScratchFenceCache,
} from '../../src/shared/markdown/blocklyStack.js'
import { SCRATCH_BLOCK_CATALOG } from '../../src/shared/scratchBlockCatalog.js'

const params = new URLSearchParams(location.search)
const view = params.get('view') || 'compare'
const scale = Number(params.get('scale') || EXPLAINER_BLOCK_SCALE)

const COMPARE = `when green flag clicked
forever
  next costume
  say [Twinkle!] for (1) seconds
  play sound [chime] until done
end`

const DOC_EXAMPLES = [
  `when green flag clicked
repeat (10)
  move (10) steps
  turn (15) degrees
end`,
  `when green flag clicked
forever
  if <touching [edge]?> then
    turn right (15) degrees
  else
    move (pick random (1) to (10)) steps
  end
end`,
  `when I start as a clone
repeat until <(score) > (10)>
  change [score] by (1)
end
delete this clone`,
  `if <touching [edge]?> then
  turn right (15) degrees
else
  move (10) steps
end`,
  `when green flag clicked
say [Hello!] for (2) seconds`,
  `when [space] key pressed
broadcast [jump]
when I receive [jump]
change y by (10)`,
]

const box = (el) => el.getBoundingClientRect()
const r1 = (n) => Math.round(n * 10) / 10

// ---- measurements (CSS px on screen) ----
function measureOurs(root) {
  const c = root.querySelector('[data-scratch-shape="c"]')
  const cBox = box(c)
  const mouth = c.querySelector('[data-scratch-mouth-stack="children"]')
  const kids = [...mouth.children].map((k) => k.firstElementChild)
  const first = box(kids[0])
  const last = box(kids[kids.length - 1])
  const lastBodyBottom = last.bottom - 7 // its bottom tab sits inside the foot
  const icon = box(root.querySelector('[data-scratch-opcode="looks_nextcostume"] [data-scratch-icon-badge]'))
  const say = root.querySelector('[data-scratch-opcode="looks_sayforsecs"]')
  const pill = box(say.querySelector('[data-scratch-slot="value"]'))
  const dd = box(root.querySelector('[data-scratch-opcode="sound_playuntildone"] [data-scratch-slot="dropdown"]'))
  const nc = box(root.querySelector('[data-scratch-opcode="looks_nextcostume"]'))
  return {
    'icon (w x h)': `${r1(icon.width)} x ${r1(icon.height)}`,
    'text size': parseFloat(getComputedStyle(say).fontSize),
    'say pill (w x h)': `${r1(pill.width)} x ${r1(pill.height)}`,
    'dropdown (w x h)': `${r1(dd.width)} x ${r1(dd.height)}`,
    'next costume block h': r1(nc.height - 7),
    'A top arm width': r1(cBox.width),
    'B foot': r1(cBox.bottom - lastBodyBottom),
    'C indent': r1(first.left - cBox.left),
    _boxes: { c: cBox, first, last, icon, pill, dd, lastBodyBottom },
  }
}

function measureReal(root) {
  const g = (id) => root.querySelector(`[data-id="${id}"]`)
  const path = (id) => g(id).querySelector(':scope > path.blocklyPath') ?? g(id).querySelector('path')
  const cPath = box(path('md1'))
  const first = box(path('md2'))
  const lastG = g('md4')
  const last = box(path('md4'))
  // zelos bottom notch: the tab under a stack block hangs below its body.
  const notch = 8 * scale
  const own = (id, sel) =>
    [...g(id).querySelectorAll(sel)].filter((el) => el.closest('g[data-id]') === g(id))
  const icon = box(own('md2', 'image')[0])
  const sayShadow = [...g('md3').querySelectorAll('g[data-id]')][0]
  const pill = box(sayShadow.querySelector('path'))
  const ddText = lastG.querySelector('.blocklyDropdownText')
  const dd = box(ddText.closest('g'))
  const text = root.querySelector('.blocklyText')
  const fs = parseFloat(getComputedStyle(text).fontSize) * scale
  const header = box(path('md1'))
  // The forever path's top row: its widest point in the first row = header width.
  return {
    'icon (w x h)': `${r1(icon.width)} x ${r1(icon.height)}`,
    'text size': r1(fs),
    'say pill (w x h)': `${r1(pill.width)} x ${r1(pill.height)}`,
    'dropdown (w x h)': `${r1(dd.width)} x ${r1(dd.height)}`,
    'next costume block h': r1(first.height - notch),
    'A top arm width': r1(header.width),
    'B foot': r1(cPath.bottom - (last.bottom - notch)),
    'C indent': r1(first.left - cPath.left),
    _boxes: { c: cPath, first, last, icon, pill, dd, lastBodyBottom: last.bottom - notch },
  }
}

function Marker({ host, b, label, color = '#e11d48' }) {
  if (!b || !host) return null
  const h = host.getBoundingClientRect()
  return (
    <div
      style={{
        position: 'absolute',
        left: b.left - h.left,
        top: b.top - h.top,
        width: b.width,
        height: b.height,
        outline: `2px solid ${color}`,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -4,
          top: -4,
          transform: 'translate(-100%,-50%)',
          background: color,
          color: '#fff',
          font: '700 11px sans-serif',
          padding: '1px 4px',
          borderRadius: 8,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function Panel({ title, sub, children, measure, onMeasured }) {
  const ref = React.useRef(null)
  const [m, setM] = React.useState(null)
  const tryMeasure = React.useCallback(() => {
    try {
      const out = measure(ref.current)
      setM(out)
      onMeasured?.(out)
    } catch (e) {
      setTimeout(tryMeasure, 150)
    }
  }, [])
  React.useEffect(() => {
    const t = setTimeout(() => document.fonts.ready.then(tryMeasure), 400)
    return () => clearTimeout(t)
  }, [])
  const b = m?._boxes
  return (
    <div style={{ flex: 1, padding: 16 }}>
      <div style={{ font: '700 20px sans-serif' }}>{title}</div>
      <div style={{ font: '13px sans-serif', color: '#555', marginBottom: 8 }}>{sub}</div>
      <div
        ref={ref}
        style={{ position: 'relative', border: '1px solid #ccc', padding: '20px 20px 20px 60px', minHeight: 300 }}
      >
        {children}
        {b && (
          <>
            <Marker host={ref.current} b={b.icon} label="icon" color="#7c3aed" />
            <Marker host={ref.current} b={b.pill} label="pill" color="#0891b2" />
            <Marker host={ref.current} b={b.dd} label="dropdown" color="#ea580c" />
            <Marker
              host={ref.current}
              b={{ left: b.c.left, top: b.c.top - 4, width: m['A top arm width'], height: 2 }}
              label="A"
            />
            <Marker
              host={ref.current}
              b={{ left: b.first.left - 16, top: b.lastBodyBottom, width: 2, height: m['B foot'] }}
              label="B"
            />
            <Marker
              host={ref.current}
              b={{ left: b.c.left, top: b.first.top + b.first.height / 2, width: m['C indent'], height: 2 }}
              label="C"
            />
          </>
        )}
      </div>
      {m && (
        <table style={{ font: '13px sans-serif', marginTop: 8, borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(m)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '1px 12px 1px 0', color: '#555' }}>{k}</td>
                  <td style={{ fontWeight: 700 }}>{v}px</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Compare() {
  const [out, setOut] = React.useState({})
  React.useEffect(() => {
    window.__spikeCompare = out
  }, [out])
  return (
    <div style={{ width: 1100 }}>
      <div style={{ font: '700 22px sans-serif', padding: '12px 16px 0' }}>
        Same fence text, same page, shown at explainer size (CSS px)
      </div>
      <div style={{ display: 'flex' }}>
        <Panel
          title="Before: LaunchPad Markdown renderer"
          sub="src/shared/markdown/ScratchBlocks.jsx (main)"
          measure={measureOurs}
          onMeasured={(m) => setOut((o) => ({ ...o, ours: m }))}
        >
          <ScratchBlocks code={COMPARE} />
        </Panel>
        <Panel
          title="After: real Blockly (zelos) render"
          sub={`spike blocklyStack.js, app block definitions, scale ${scale}`}
          measure={measureReal}
          onMeasured={(m) => setOut((o) => ({ ...o, real: m }))}
        >
          <RealScratchBlocks code={COMPARE} scale={scale} />
        </Panel>
      </div>
    </div>
  )
}

function Sweep() {
  const [rows, setRows] = React.useState([])
  React.useEffect(() => {
    ;(async () => {
      let corpus = { fences: [], inline: [] }
      try {
        corpus = await (await fetch('./corpus.local.json')).json()
      } catch {}
      const fences = [
        ...SCRATCH_BLOCK_CATALOG.flatMap((b) =>
          [b.sample, ...(b.aliases ?? [])].map((code) => ({ name: b.opcode, code, src: 'catalog' }))
        ),
        ...DOC_EXAMPLES.map((code, i) => ({ name: `doc example ${i + 1}`, code, src: 'docs' })),
        ...corpus.fences.map((f, i) => ({ name: `lesson fence ${i}`, code: f.code, src: 'lessons' })),
        ...corpus.inline.map((code, i) => ({ name: `lesson inline ${i}`, code, src: 'inline' })),
      ]
      const out = []
      for (const f of fences) {
        const r = await renderScratchFenceSvg(f.code)
        out.push({ ...f, ok: r.ok, problems: r.problems ?? [], mismatches: r.mismatches ?? [], ms: r.renderMs })
      }
      setRows(out)
      window.__spikeSweep = out
    })()
  }, [])
  return (
    <div style={{ padding: 16, font: '12px sans-serif' }}>
      <div style={{ font: '700 18px sans-serif' }}>
        Sweep: {rows.filter((r) => r.ok && !r.mismatches.length).length} clean /{' '}
        {rows.filter((r) => r.ok && r.mismatches.length).length} with menu mismatch /{' '}
        {rows.filter((r) => !r.ok).length} fallback, of {rows.length}
      </div>
      {DOC_EXAMPLES.map((code, i) => (
        <div key={i} style={{ display: 'flex', gap: 24, borderTop: '1px solid #ddd', padding: 8 }}>
          <div style={{ width: 420 }}>
            <ScratchBlocks code={code} />
          </div>
          <RealScratchBlocks code={code} />
        </div>
      ))}
      <table>
        <tbody>
          {rows
            .filter((r) => !r.ok || r.mismatches.length)
            .map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.code}</td>
                <td>{r.ok ? 'mismatch' : 'FALLBACK'}</td>
                <td>{[...r.problems, ...r.mismatches].join('; ')}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

function makeStacks(n) {
  const verbs = ['move (10) steps', 'turn right (15) degrees', 'next costume', 'say [Hi!] for (2) seconds', 'change [score] by (1)', 'play sound [pop] until done', 'wait (1) seconds', 'set x to (0)']
  return Array.from({ length: n }, (_, i) => {
    const a = verbs[i % verbs.length]
    const b = verbs[(i * 3 + 1) % verbs.length]
    return `when green flag clicked\nrepeat (${i + 2})\n  ${a}\n  ${b}\nend\nsay [Done ${i}!]`
  })
}

function Perf() {
  const n = Number(params.get('n') || 20)
  const stacks = React.useMemo(() => makeStacks(n), [n])
  const [res, setRes] = React.useState(null)
  React.useEffect(() => {
    ;(async () => {
      clearScratchFenceCache()
      const t0 = performance.now()
      const loadMs = await blocklyRuntimeLoadMs()
      const tFirst = performance.now()
      const each = []
      await Promise.all(
        stacks.map((code) =>
          renderScratchFenceSvg(code).then((r) => each.push(r.renderMs))
        )
      )
      const total = performance.now() - t0
      // Cached second pass (what a re-render / slide change costs).
      const t2 = performance.now()
      await Promise.all(stacks.map((code) => renderScratchFenceSvg(code)))
      const cached = performance.now() - t2
      // Same 20 stacks with the current renderer (React mount, measured to next frame).
      const out = {
        n,
        blocklyLoadMs: Math.round(loadMs),
        firstAfterLoadMs: Math.round(tFirst - t0),
        totalMs: Math.round(total),
        perStackMs: {
          min: Math.round(Math.min(...each)),
          median: Math.round(each.sort((a, b) => a - b)[Math.floor(each.length / 2)]),
          max: Math.round(Math.max(...each)),
        },
        cachedMs: Math.round(cached),
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
      }
      setRes(out)
      window.__spikePerf = out
    })()
  }, [])
  return (
    <div style={{ padding: 16, font: '12px sans-serif' }}>
      <pre>{JSON.stringify(res, null, 2)}</pre>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {stacks.map((c, i) => (
          <RealScratchBlocks key={i} code={c} />
        ))}
      </div>
    </div>
  )
}

function OursPerf() {
  const n = Number(params.get('n') || 20)
  const stacks = React.useMemo(() => makeStacks(n), [n])
  React.useEffect(() => {
    const t0 = window.__oursStart
    requestAnimationFrame(() => {
      window.__spikeOursPerf = { n, mountMs: Math.round(performance.now() - t0) }
    })
  }, [])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {stacks.map((c, i) => (
        <ScratchBlocks key={i} code={c} />
      ))}
    </div>
  )
}

const View = { compare: Compare, sweep: Sweep, perf: Perf, oursperf: OursPerf }[view] ?? Compare
window.__oursStart = performance.now()
createRoot(document.getElementById('root')).render(<View />)
