import React from 'react'

/**
 * The calm Scratch screen's Blocks button (ScratchWorkspace): the only control that opens or
 * closes the block palette. A tap on the stage, the script or a dropped block never closes it.
 * While the palette is closed it carries `data-highlight-reveal="category"`, so a tutor's or a
 * task's category highlight pulses this button (src/shared/controlHighlight.js).
 */
export function CalmPaletteToggle({ open, onToggle, highlighted = false }) {
  return (
    <button
      type="button"
      data-testid="scratch-palette-toggle"
      className={highlighted ? 'pane-highlight-pulse' : undefined}
      aria-expanded={open}
      data-highlight-reveal={open ? undefined : 'category'}
      title={open ? 'Close the blocks palette' : 'Open the blocks palette'}
      onClick={onToggle}
      style={{ ...s.toggle, ...(open ? s.toggleOpen : null) }}
    >
      <span aria-hidden="true" style={s.icon}>
        🧱
      </span>
      Blocks
    </button>
  )
}

const s = {
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '6px 16px',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#c4b5fd',
    background: '#fff',
    color: '#5b21b6',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  toggleOpen: {
    background: '#ede9fe',
    borderColor: '#8b5cf6',
    boxShadow: 'inset 0 0 0 1px #8b5cf6',
  },
  icon: { fontSize: 17, lineHeight: 1 },
}
