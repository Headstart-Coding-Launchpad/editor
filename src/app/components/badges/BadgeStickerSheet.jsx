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

/** One round strip sticker: the emoji in a ringed circle, the name under it, the blurb a tooltip. */
function StripSticker({ badgeId, badge, initialMotion }) {
  const [motion] = useState(initialMotion)
  return (
    <li className={motion.className} style={motion.style} title={badge?.blurb || undefined}>
      <span className="sv-sticker-strip__face" aria-hidden="true">
        {badge?.emoji ?? '🏅'}
      </span>
      <span className="sv-sticker-strip__name">{badge?.title ?? badgeId}</span>
    </li>
  )
}

/**
 * A student's coding moments as a sheet of stickers: the coding-moments pill and the Badge
 * Summary task use it; `variant="strip"` is the row of round stickers on the Lesson complete and
 * Session ended screens.
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
 * @param {'sheet'|'strip'} [props.variant] `strip`: a centred, wrapping row of round stickers
 *   with names only (the blurb is the tooltip). With `animate` they pop in one by one; a sticker
 *   that arrives later (a live award) drops in plainly.
 * @param {boolean} [props.small] The strip's smaller size (the Session ended screen).
 * @param {number} [props.max] Show only the newest `max` moments (`moments` is oldest first).
 */
export default function BadgeStickerSheet({
  moments = [],
  animate = false,
  entrance = 'flip',
  staggerMs = 180,
  label = 'My coding moments',
  variant = 'sheet',
  small = false,
  max,
}) {
  // False while the sheet renders for the first time: stickers mounting then are its entrance.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])

  if (moments.length === 0) return null

  if (variant === 'strip') {
    const shown = max > 0 ? moments.slice(-max) : moments
    const motionFor = (index) => {
      if (mounted.current)
        return { className: 'sv-sticker-strip__item motion-drop-in motion-now', style: undefined }
      if (!animate) return { className: 'sv-sticker-strip__item', style: undefined }
      return {
        className: 'sv-sticker-strip__item sv-sticker-strip__item--pop',
        style: { '--sv-sticker-delay': `${Math.min(index, MOTION_STAGGER_CAP) * staggerMs}ms` },
      }
    }
    return (
      <ul
        className={`sv-sticker-strip${small ? ' sv-sticker-strip--small' : ''}`}
        aria-label={label}
      >
        {shown.map(({ badgeId, badge }, index) => (
          <StripSticker
            key={badgeId}
            badgeId={badgeId}
            badge={badge}
            initialMotion={() => motionFor(index)}
          />
        ))}
      </ul>
    )
  }

  if (entrance === 'tumble') {
    const motionFor = (index) => {
      if (mounted.current)
        return { className: 'sv-sticker motion-drop-in motion-now', style: undefined }
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
