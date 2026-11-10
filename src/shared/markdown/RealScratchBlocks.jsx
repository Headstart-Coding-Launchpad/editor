// A Markdown `scratch` fence drawn by the real Scratch editor's Blockly engine
// (./blocklyStack.js), so explainer blocks look exactly like the blocks the student drags.
// The Markdown renderer (./ScratchBlocks.jsx) stays as the fallback: for any fence Blockly cannot
// draw, while Blockly is still loading, and wherever there is no real browser (jsdom tests).
import React from 'react'
import { ScratchBlocks } from './ScratchBlocks.jsx'
import {
  canDrawRealBlocks,
  peekScratchFenceSvg,
  renderScratchFenceSvg,
  scopeSvgIds,
} from './blocklyStack.js'

// Same size as the blocks the student drags on the calm Scratch screen (CALM_BLOCK_SCALE). A
// stack wider than its column is scaled down to fit (max-width), never cropped or scrolled.
export const EXPLAINER_BLOCK_SCALE = 0.65

// While Blockly loads, the Markdown picture holds the space but stays invisible, so the reader
// never sees one drawing swap for another. If the load is slow it shows after this long.
export const SHOW_FALLBACK_AFTER_MS = 1500

// The picture at the calm block size, scaled down to fit its column. Null when the SVG cannot
// be read or has no size: the caller then shows the Markdown drawing rather than a picture at
// the wrong size.
function sizedSvg(result, scope) {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(scopeSvgIds(result.svg, scope), 'image/svg+xml')
  const root = doc.documentElement
  if (root?.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null
  if (!(Number(root.getAttribute('width')) > 0) || !(Number(root.getAttribute('height')) > 0))
    return null
  const width = Math.round(result.width * EXPLAINER_BLOCK_SCALE)
  const height = Math.round(result.height * EXPLAINER_BLOCK_SCALE)
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  const own = (root.getAttribute('style') ?? '').trim().replace(/;?$/, ';')
  root.setAttribute('style', `${own === ';' ? '' : own}display:block;max-width:100%;height:auto`)
  root.setAttribute('focusable', 'false')
  root.setAttribute('aria-hidden', 'true')
  return { svg: new XMLSerializer().serializeToString(root), width }
}

// A fence edited live (the Builder preview) is drawn once typing pauses for this long; the
// Markdown drawing shows meanwhile (visible). The first drawing of a fence is not delayed.
export const EDIT_DEBOUNCE_MS = 250
// Text that changes this soon after it last changed (or after the fence first showed) is being
// typed. A change after longer (the same fence reused for another task) draws at once.
export const LIVE_EDIT_WINDOW_MS = 1000

// A render that may differ next time (it threw, or the block font was not there yet) is tried
// again this many times, this far apart; the Markdown drawing shows meanwhile.
export const RETRY_LIMIT = 2
export const RETRY_DELAY_MS = 400

function BlocklyFence({ code }) {
  // Stored with the text it belongs to, so a picture never shows under different text.
  const [drawnFor, setDrawnFor] = React.useState(() => ({
    code,
    result: peekScratchFenceSvg(code),
  }))
  const [slowFor, setSlowFor] = React.useState(null)
  const lastChange = React.useRef(null)
  if (!lastChange.current) lastChange.current = { code, at: Date.now(), edited: false }
  if (lastChange.current.code !== code) {
    const now = Date.now()
    const edited = now - lastChange.current.at < LIVE_EDIT_WINDOW_MS
    lastChange.current = { code, at: now, edited }
  }
  const scope = React.useId()
  const result = drawnFor.code === code ? drawnFor.result : peekScratchFenceSvg(code)
  // A fence being typed shows the Markdown drawing at once, so the author never types blind.
  const edited = lastChange.current.edited
  const slow = slowFor === code || edited

  React.useEffect(() => {
    const ready = peekScratchFenceSvg(code)
    if (ready) {
      setDrawnFor({ code, result: ready })
      return undefined
    }
    const controller = new AbortController()
    let tries = 0
    let retryTimer = null
    const start = () =>
      renderScratchFenceSvg(code, { signal: controller.signal }).then((r) => {
        if (controller.signal.aborted) return
        setDrawnFor({ code, result: r })
        if (r.retry && tries < RETRY_LIMIT) {
          tries += 1
          retryTimer = setTimeout(start, RETRY_DELAY_MS)
        }
      })
    const startTimer = edited ? setTimeout(start, EDIT_DEBOUNCE_MS) : null
    if (!edited) start()
    const slowTimer = setTimeout(() => setSlowFor(code), SHOW_FALLBACK_AFTER_MS)
    return () => {
      controller.abort()
      clearTimeout(startTimer)
      clearTimeout(retryTimer)
      clearTimeout(slowTimer)
    }
  }, [code, edited])

  const drawn = React.useMemo(() => (result?.ok ? sizedSvg(result, scope) : null), [result, scope])

  if (!drawn) {
    const hidden = !result && !slow
    return (
      <div
        data-real-blocks={result ? 'fallback' : 'pending'}
        aria-hidden={hidden || undefined}
        style={hidden ? { visibility: 'hidden' } : undefined}
      >
        <ScratchBlocks code={code} />
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={code.replace(/\s+/g, ' ').trim()}
      data-real-blocks="blockly"
      data-scratch-stack="true"
      style={{ margin: '6px 0', width: drawn.width, maxWidth: '100%', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: drawn.svg }}
    />
  )
}

export function RealScratchBlocks({ code }) {
  if (!canDrawRealBlocks()) return <ScratchBlocks code={code} />
  return <BlocklyFence code={code} />
}
