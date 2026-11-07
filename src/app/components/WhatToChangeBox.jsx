import React, { useState } from 'react'

/**
 * The calm code screen's one "What to change" box above the editor (Python): the Type this out
 * lines (CopyCodePanel) or a Complete stage's change view (SupportStagePanel), never both. Open on
 * a task's first view; LessonTaskContent folds it after a passing Run (never a failed one), to
 * one readable line with the first new line in it. A tap on the header folds or reopens it.
 *
 * `headerAction`: a control at the right of the open header ("Show all the code").
 * `preview`: the folded line's code (the first added line), or ''.
 * `sourceLabel`: where it came from, small in the header ("Opened by your teacher"), or none.
 * With `folded` left undefined the box keeps its own fold (open at first, changed only by a tap):
 * a reference the tutor put there never folds with the student's pass.
 */
export default function WhatToChangeBox({
  folded: foldedProp,
  onToggle: onToggleProp,
  preview = '',
  headerAction = null,
  sourceLabel = '',
  children,
}) {
  const [ownFolded, setOwnFolded] = useState(false)
  const controlled = foldedProp !== undefined
  const folded = controlled ? !!foldedProp : ownFolded
  const onToggle = controlled ? onToggleProp : () => setOwnFolded((value) => !value)
  const source = sourceLabel ? <span style={s.source}>{sourceLabel}</span> : null
  if (folded) {
    return (
      <section style={s.box} aria-label="What to change">
        <button
          type="button"
          style={s.foldedButton}
          aria-expanded="false"
          onClick={onToggle}
          disabled={!onToggle}
        >
          <span aria-hidden="true" style={s.chevron}>
            ▸
          </span>
          <span style={s.foldedTitle}>Show what to change</span>
          {preview && <span style={s.preview}>+ {preview}</span>}
          {source}
        </button>
      </section>
    )
  }
  return (
    <section
      style={s.box}
      aria-label="What to change"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={s.header}>
        <button
          type="button"
          style={s.titleButton}
          aria-expanded="true"
          onClick={onToggle}
          disabled={!onToggle}
        >
          <span aria-hidden="true" style={s.chevron}>
            ▾
          </span>
          What to change
          {source}
        </button>
        {headerAction}
      </div>
      <div style={s.body}>{children}</div>
    </section>
  )
}

const s = {
  box: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    maxHeight: 260,
    border: '1px solid #93c5fd',
    borderRadius: 8,
    background: '#eff6ff',
    overflow: 'hidden',
    marginBottom: 8,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px 0 0',
    background: '#dbeafe',
    borderBottom: '1px solid #93c5fd',
    minWidth: 0,
  },
  titleButton: {
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
    border: 'none',
    background: 'transparent',
    color: '#1e3a8a',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
  },
  foldedButton: {
    width: '100%',
    minWidth: 0,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
    border: 'none',
    background: '#dbeafe',
    color: '#1e3a8a',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
  },
  foldedTitle: { flexShrink: 0 },
  // As the full reference panel's source line (SupportStagePanel): small, after the title.
  source: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 600,
    color: '#1d4ed8',
    whiteSpace: 'nowrap',
  },
  chevron: { width: 14, flexShrink: 0, color: '#1d4ed8', fontSize: 12 },
  preview: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-code)',
    fontVariantLigatures: 'none',
    fontWeight: 400,
    fontSize: 14,
    color: '#166534',
  },
  // The changes scroll inside the box's maxHeight, so a tablet keeps the editor.
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 0,
    overflow: 'auto',
    padding: '6px 0',
    background: '#f8fafc',
  },
}
