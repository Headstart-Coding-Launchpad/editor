// SPIKE (spike/explainer-real-blockly): a Markdown `scratch` fence drawn by the real Scratch
// editor's Blockly engine. Shows the current renderer until the SVG is ready, and keeps it
// for any fence the Blockly path cannot draw. On only with `?realBlocks=1` in the URL.
import React from 'react'
import { ScratchBlocks } from './ScratchBlocks.jsx'
import { renderScratchFenceSvg } from './blocklyStack.js'

// Same size as the blocks the student drags on the calm Scratch screen (CALM_BLOCK_SCALE).
export const EXPLAINER_BLOCK_SCALE = 0.65

export function realBlocksEnabled() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1])
    return params.get('realBlocks') === '1'
  } catch {
    return false
  }
}

export function RealScratchBlocks({ code, scale = EXPLAINER_BLOCK_SCALE, onRendered }) {
  const [result, setResult] = React.useState(null)
  React.useEffect(() => {
    let active = true
    renderScratchFenceSvg(code).then((r) => {
      if (!active) return
      setResult(r)
      onRendered?.(r)
    })
    return () => {
      active = false
    }
  }, [code])

  if (!result?.ok) {
    return (
      <div data-real-blocks={result ? 'fallback' : 'pending'}>
        <ScratchBlocks code={code} />
      </div>
    )
  }
  const width = Math.round(result.width * scale)
  const height = Math.round(result.height * scale)
  const svg = result.svg.replace(
    /<svg([^>]*?) width="[\d.]+" height="[\d.]+"/,
    `<svg$1 width="${width}" height="${height}"`
  )
  return (
    <div
      role="img"
      aria-label={code.replace(/\s+/g, ' ').trim()}
      data-real-blocks="blockly"
      data-scratch-stack="true"
      style={{ margin: '6px 0', width, height, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
