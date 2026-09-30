import React from 'react'

/**
 * A student's coding moments as a sheet of stickers: the session-end screen uses it, and the
 * Badge Summary task (PR 6) can too.
 *
 * @param {object} props
 * @param {{ badgeId: string, badge: object }[]} props.moments From `listMyMoments`
 *   (src/badges/celebration.js): each `badge` is resolved for display (emoji, title, blurb).
 * @param {boolean} [props.animate] Flip the stickers in one by one (a plain fade under
 *   prefers-reduced-motion).
 * @param {number} [props.staggerMs] The delay between stickers when animating.
 * @param {string} [props.label] The list's accessible name.
 */
export default function BadgeStickerSheet({
  moments = [],
  animate = false,
  staggerMs = 180,
  label = 'My coding moments',
}) {
  if (moments.length === 0) return null
  return (
    <ul className="sv-sticker-sheet" aria-label={label}>
      {moments.map(({ badgeId, badge }, index) => (
        <li
          key={badgeId}
          className={animate ? 'sv-sticker sv-sticker--animate' : 'sv-sticker'}
          style={animate ? { '--sv-sticker-delay': `${index * staggerMs}ms` } : undefined}
        >
          <span className="sv-sticker__emoji" aria-hidden="true">
            {badge?.emoji ?? '🏅'}
          </span>
          <span className="sv-sticker__title">{badge?.title ?? badgeId}</span>
          {badge?.blurb && <span className="sv-sticker__blurb">{badge.blurb}</span>}
        </li>
      ))}
    </ul>
  )
}
