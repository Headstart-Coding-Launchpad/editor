// A Markdown `scratch` fence drawn by the real Scratch editor's Blockly engine
// (./blocklyStack.js), so explainer blocks look exactly like the blocks the student drags.
// Inline `scratch:` blocks are drawn the same way, one block in a line of text. For any text
// Blockly cannot draw, while Blockly is still loading, and wherever there is no real browser
// (jsdom tests), the text itself shows as plain monospace code (ScratchFenceText).
import React from 'react'
import { inlineScratchCode } from './scratchFence.js'
import {
  canDrawRealBlocks,
  peekScratchFenceSvg,
  renderScratchFenceSvg,
  scopeSvgIds,
} from './blocklyStack.js'

// Same size as the blocks the student drags on the calm Scratch screen (CALM_BLOCK_SCALE). A
// stack wider than its column is scaled down to fit (max-width), never cropped or scrolled.
export const EXPLAINER_BLOCK_SCALE = 0.65

const FENCE_TEXT_STYLE = {
  margin: '6px 0',
  padding: '6px 10px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '0.9em',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  color: 'inherit',
  background: 'rgba(127, 127, 127, 0.12)',
  borderRadius: 6,
}
const INLINE_TEXT_STYLE = { ...FENCE_TEXT_STYLE, margin: 0, padding: '1px 5px', borderRadius: 4 }
const INLINE_PICTURE_STYLE = { display: 'inline-block', verticalAlign: 'middle', margin: '2px' }

const labelFor = (code) => code.replace(/\s+/g, ' ').trim()

/** The block text as plain monospace code, read out with the same label as the picture. */
export function ScratchFenceText({ code, inline = false }) {
  const Tag = inline ? 'code' : 'pre'
  return (
    <Tag
      role="img"
      aria-label={labelFor(code)}
      data-scratch-stack={inline ? undefined : 'true'}
      data-scratch-text="true"
      style={inline ? INLINE_TEXT_STYLE : FENCE_TEXT_STYLE}
    >
      {code}
    </Tag>
  )
}

// While Blockly loads, the fallback text holds the space but stays invisible, so the reader
// never sees one drawing swap for another. If the load is slow it shows after this long.
export const SHOW_FALLBACK_AFTER_MS = 1500

// The SVG goes on the page as HTML, so anything active is taken out first, whatever made it:
// scripts, embedded HTML, event handlers, and links that are not to the picture's own ids or
// to an embedded image.
function stripActive(root) {
  for (const el of [...root.querySelectorAll('script, foreignObject')]) el.remove()
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      else if (
        /(^|:)href$/.test(name) &&
        !value.startsWith('#') &&
        !value.startsWith('data:image/')
      )
        el.removeAttribute(attr.name)
    }
  }
}

// The picture at the calm block size, scaled down to fit its column. Null when the SVG cannot
// be read or has no size: the caller then shows the fence text rather than a picture at
// the wrong size.
function sizedSvg(result, scope) {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(scopeSvgIds(result.svg, scope), 'image/svg+xml')
  const root = doc.documentElement
  if (root?.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null
  stripActive(root)
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
// fence text shows meanwhile (visible). The first drawing of a fence is not delayed.
export const EDIT_DEBOUNCE_MS = 250
// Text that changes this soon after it last changed (or after the fence first showed) is being
// typed. A change after longer (the same fence reused for another task) draws at once.
export const LIVE_EDIT_WINDOW_MS = 1000

// A render that may differ next time (it threw, or the block font was not there yet) is tried
// again this many times, this far apart; the fence text shows meanwhile.
export const RETRY_LIMIT = 2
export const RETRY_DELAY_MS = 400

// `text` is what the fallback shows and the label reads (the fence text unless an inline block
// was rewritten to draw).
function BlocklyFence({ code, text = code, inline = false }) {
  // Stored with the text it belongs to, so a picture never shows under different text.
  const [drawnFor, setDrawnFor] = React.useState(() => ({
    code,
    result: peekScratchFenceSvg(code),
  }))
  const [slowFor, setSlowFor] = React.useState(null)
  // When the text last changed, kept in state and updated during render the way React allows
  // (setState for the props just seen), not by writing to a ref.
  const [lastChange, setLastChange] = React.useState(() => ({
    code,
    at: Date.now(),
    edited: false,
  }))
  let change = lastChange
  if (change.code !== code) {
    const now = Date.now()
    change = { code, at: now, edited: now - lastChange.at < LIVE_EDIT_WINDOW_MS }
    setLastChange(change)
  }
  const scope = React.useId()
  const result = drawnFor.code === code ? drawnFor.result : peekScratchFenceSvg(code)
  // A fence being typed shows its text at once, so the author never types blind.
  const edited = change.edited
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
    const Wrap = inline ? 'span' : 'div'
    return (
      <Wrap
        data-real-blocks={result ? 'fallback' : 'pending'}
        aria-hidden={hidden || undefined}
        style={hidden ? { visibility: 'hidden' } : undefined}
      >
        <ScratchFenceText code={text} inline={inline} />
      </Wrap>
    )
  }
  if (inline) {
    return (
      <span
        role="img"
        aria-label={labelFor(text)}
        data-real-blocks="blockly"
        style={INLINE_PICTURE_STYLE}
        dangerouslySetInnerHTML={{ __html: drawn.svg }}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={labelFor(code)}
      data-real-blocks="blockly"
      data-scratch-stack="true"
      style={{ margin: '6px 0', width: drawn.width, maxWidth: '100%', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: drawn.svg }}
    />
  )
}

export function RealScratchBlocks({ code }) {
  if (!canDrawRealBlocks()) return <ScratchFenceText code={code} />
  return <BlocklyFence code={code} />
}

/** One `scratch:` block in a line of text, drawn by Blockly like a one-line fence. */
export function InlineScratchBlock({ text }) {
  const shown = String(text ?? '').trim()
  if (!canDrawRealBlocks()) return <ScratchFenceText code={shown} inline />
  return <BlocklyFence code={inlineScratchCode(shown)} text={shown} inline />
}
