import React from 'react'
import { useLiveInkConfig } from './liveInkContext'

const TOOL_LABELS = { pointer: 'Pointer', ink: 'Ink', highlight: 'Highlight' }

/**
 * The presentation window's "Draw" button (calm presenter bar): opens and closes the Pointer /
 * Ink / Highlight / Clear toolbar (PresentationInkToolbar), which starts closed. While a tool is
 * on the button names it. Closing turns the tool off and clears the marks, so nothing stays on
 * the class's screens unexpectedly. Renders nothing outside the Presentation window
 * (LiveInkProvider `drawToggle`).
 */
export default function PresentationDrawButton({ className = 'btn-ghost', style }) {
  const config = useLiveInkConfig()
  if (!config || config.role !== 'teacher' || !config.drawToggle) return null
  const { toolsOpen, setToolsOpen, tool, hasSurface } = config
  const toolLabel = toolsOpen && tool ? TOOL_LABELS[tool] : null
  return (
    <button
      type="button"
      className={`${className} presentation-draw-btn${toolLabel ? ' is-drawing' : ''}`}
      style={style}
      aria-pressed={!!toolsOpen}
      data-tool={toolLabel ? tool : undefined}
      disabled={!hasSurface}
      title={
        hasSurface
          ? toolsOpen
            ? 'Hide the drawing tools (turns the tool off and clears the marks)'
            : 'Show the drawing tools: Pointer, Ink, Highlight'
          : 'Nothing on this task to draw on'
      }
      onClick={() => setToolsOpen(!toolsOpen)}
    >
      <span aria-hidden="true">✏️</span> Draw{toolLabel ? `: ${toolLabel}` : ''}
    </button>
  )
}
