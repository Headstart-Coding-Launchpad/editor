// Helpers for the calm code screen's "What to change" box (WhatToChangeBox.jsx).

/** The first added line of change rows ({ type, text }), for the folded box's preview. */
export function firstAddedLine(rows) {
  const row = (rows ?? []).find((item) => item?.type === 'add' && String(item.text).trim())
  return row ? String(row.text).trim() : ''
}

// The header action ("Show all the code"): a quiet link-style button, still 44px tall to tap.
export const whatToChangeLinkStyle = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 6px',
  border: 'none',
  background: 'transparent',
  color: '#1d4ed8',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
