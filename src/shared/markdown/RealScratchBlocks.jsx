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

function sizedSvg(result, scope) {
  const width = Math.round(result.width * EXPLAINER_BLOCK_SCALE)
  const height = Math.round(result.height * EXPLAINER_BLOCK_SCALE)
  const svg = scopeSvgIds(result.svg, scope).replace(
    /<svg([^>]*?) width="[\d.]+" height="[\d.]+"/,
    `<svg$1 width="${width}" height="${height}" style="display:block;max-width:100%;height:auto" focusable="false" aria-hidden="true"`
  )
  return { svg, width }
}

function BlocklyFence({ code }) {
  const [result, setResult] = React.useState(() => peekScratchFenceSvg(code))
  const [slow, setSlow] = React.useState(false)
  const scope = React.useId()

  React.useEffect(() => {
    const ready = peekScratchFenceSvg(code)
    setResult(ready)
    setSlow(false)
    if (ready) return undefined
    let active = true
    const timer = setTimeout(() => active && setSlow(true), SHOW_FALLBACK_AFTER_MS)
    renderScratchFenceSvg(code).then((r) => {
      if (active) setResult(r)
    })
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [code])

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
