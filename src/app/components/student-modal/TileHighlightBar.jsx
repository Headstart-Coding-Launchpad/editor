import React from 'react'
import { TILE_HIGHLIGHT_NOTE_MAX_LENGTH } from '../../../shared/tutorTileHighlights.js'

/**
 * StudentModal's strip above a drag-and-drop board for tutor tile highlights
 * (src/shared/tutorTileHighlights.js). In highlight mode (`active`) it says what to do, holds the
 * optional note for the next tap, and offers Clear all and Done; out of it, it only shows how
 * many highlights the student can see, with Clear all. Buttons and a plain text field: works by
 * tap on a tablet, no hover.
 */
export default function TileHighlightBar({
  active,
  count,
  note,
  onNoteChange,
  onClearAll,
  onDone,
}) {
  if (!active && count === 0) return null
  return (
    <div style={s.bar} data-testid="tile-highlight-bar">
      <span style={s.label}>
        👀{' '}
        {active
          ? 'Tap a tile on the board to highlight it for the student (tap again to remove).'
          : `${count} tile${count === 1 ? '' : 's'} highlighted for the student.`}
      </span>
      {active && (
        <input
          type="text"
          style={s.note}
          placeholder="Optional note for the next tile…"
          aria-label="Note for the next highlighted tile"
          maxLength={TILE_HIGHLIGHT_NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      )}
      {count > 0 && (
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.button}
          onClick={onClearAll}
          data-testid="tile-highlight-clear-all"
        >
          Clear all ({count})
        </button>
      )}
      {active && (
        <button type="button" className="btn-primary" style={s.button} onClick={onDone}>
          Done
        </button>
      )}
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '6px 12px',
    background: '#fef2f2',
    borderBottom: '1px solid #fecaca',
    flexShrink: 0,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    color: '#991b1b',
    fontWeight: 600,
  },
  note: {
    flex: '1 1 180px',
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    padding: '6px 8px',
    border: '1px solid #fecaca',
    borderRadius: 6,
  },
  button: {
    fontSize: 13,
    padding: '5px 12px',
    whiteSpace: 'nowrap',
  },
}
