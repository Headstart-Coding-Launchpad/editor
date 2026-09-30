import React, { useEffect, useRef, useState } from 'react'
import { MOTION_STAGGER_CAP } from '../../../shared/motion'

/**
 * One tumble-entrance sticker. Its motion is worked out once, when it mounts, so a live update
 * that re-renders the sheet never restarts or re-delays a sticker that is already there.
 */
function TumbleSticker({ badgeId, badge, initialMotion }) {
  const [motion] = useState(initialMotion)
  return (
    <li className={motion.className} style={motion.style}>
      <StickerBody badgeId={badgeId} badge={badge} />
    </li>
  )
}

function StickerBody({ badgeId, badge }) {
  return (
    <>
      <span className="sv-sticker__emoji" aria-hidden="true">
        {badge?.emoji ?? '🏅'}
      </span>
      <span className="sv-sticker__title">{badge?.title ?? badgeId}</span>
      {badge?.blurb && <span className="sv-sticker__blurb">{badge.blurb}</span>}
    </>
  )
}

/**
 * A student's coding moments as a sheet of stickers: the session-end screen, the coding-moments
 * pill and the Badge Summary task use it.
 *
 * @param {object} props
 * @param {{ badgeId: string, badge: object }[]} props.moments From `listMyMoments`
 *   (src/badges/celebration.js): each `badge` is resolved for display (emoji, title, blurb).
 * @param {boolean} [props.animate] Play the entrance for the stickers there when the sheet
 *   mounts (a plain fade under prefers-reduced-motion).
 * @param {'flip'|'tumble'} [props.entrance] `flip` (the default): the stickers flip in one by
 *   one. `tumble` (the Badge Summary): they fall in rotating, one by one (`motion-tumble-in`, the
 *   stagger capped at MOTION_STAGGER_CAP stickers), and a sticker that arrives after the sheet
 *   mounted (a live award) drops in plainly with no delay, whether or not `animate` is set.
 * @param {number} [props.staggerMs] The delay between stickers when animating.
 * @param {string} [props.label] The list's accessible name.
 */
export default function BadgeStickerSheet({
  moments = [],
  animate = false,
  entrance = 'flip',
  staggerMs = 180,
  label = 'My coding moments',
}) {
  // False while the sheet renders for the first time: stickers mounting then are its entrance.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])

  if (moments.length === 0) return null

  if (entrance === 'tumble') {
    const motionFor = (index) => {
      if (mounted.current) return { className: 'sv-sticker motion-drop-in', style: undefined }
      if (!animate) return { className: 'sv-sticker', style: undefined }
      return {
        className: 'sv-sticker sv-sticker--tumble motion-tumble-in',
        style: { '--sv-sticker-delay': `${Math.min(index, MOTION_STAGGER_CAP) * staggerMs}ms` },
      }
    }
    return (
      <ul className="sv-sticker-sheet" aria-label={label}>
        {moments.map(({ badgeId, badge }, index) => (
          <TumbleSticker
            key={badgeId}
            badgeId={badgeId}
            badge={badge}
            initialMotion={() => motionFor(index)}
          />
        ))}
      </ul>
    )
  }

  return (
    <ul className="sv-sticker-sheet" aria-label={label}>
      {moments.map(({ badgeId, badge }, index) => (
        <li
          key={badgeId}
          className={animate ? 'sv-sticker sv-sticker--animate' : 'sv-sticker'}
          style={animate ? { '--sv-sticker-delay': `${index * staggerMs}ms` } : undefined}
        >
          <StickerBody badgeId={badgeId} badge={badge} />
        </li>
      ))}
    </ul>
  )
}
