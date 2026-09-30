import React from 'react'

// One badge's emoji (and, by default, its title), for the tutor's suggestions panel and picker,
// and later the student's pill and toasts. `badge` is a registry definition or a resolved
// catalogue badge (src/badges/badgeDisplay.js resolveBadge). The emoji is decorative when the
// title is shown, and carries the title as its accessible name when it isn't.
export function BadgeEmoji({ badge, size = '1rem', style }) {
  return (
    <span
      role="img"
      aria-label={badge?.title ?? 'Badge'}
      style={{ fontSize: size, lineHeight: 1, flexShrink: 0, ...style }}
    >
      {badge?.emoji ?? '🏅'}
    </span>
  )
}

export default function BadgeChip({ badge, showTitle = true, size = '1rem', title, style }) {
  if (!showTitle) return <BadgeEmoji badge={badge} size={size} style={style} />
  return (
    <span style={{ ...s.chip, ...style }} title={title}>
      <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>
        {badge?.emoji ?? '🏅'}
      </span>
      <span style={s.title}>{badge?.title ?? 'Badge'}</span>
    </span>
  )
}

const s = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    color: 'var(--colour-ink-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
