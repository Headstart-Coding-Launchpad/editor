import React, { useEffect, useRef, useState } from 'react'
import { MOTION_STAGGER_CAP } from '../../../shared/motion'

/**
 * One sticker. Its motion is worked out once, when it mounts, so a live update that re-renders
 * the sheet never restarts or re-delays a sticker that is already there. A strip sticker is a
 * ringed emoji circle and its name, the blurb a tooltip.
 */
function Sticker({ badgeId, badge, strip, initialMotion }) {
  const [motion] = useState(initialMotion)
  const css = strip ? 'sv-sticker-strip' : 'sv-sticker'
  return (
    <li
      className={motion.className}
      style={motion.style}
      title={(strip && badge?.blurb) || undefined}
    >
      <span className={strip ? `${css}__face` : `${css}__emoji`} aria-hidden="true">
        {badge?.emoji ?? '🏅'}
      </span>
      <span className={strip ? `${css}__name` : `${css}__title`}>{badge?.title ?? badgeId}</span>
      {!strip && badge?.blurb && <span className="sv-sticker__blurb">{badge.blurb}</span>}
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
 * @param {'sheet'|'strip'} [props.variant] `strip`: a wrapping row of round stickers, names only;
 *   with `animate` they pop in one by one, and a later one (a live award) drops in plainly.
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
  const strip = variant === 'strip'
  const base = strip ? 'sv-sticker-strip__item' : 'sv-sticker'
  const motionFor = (index) => {
    if (!strip && entrance !== 'tumble')
      return animate
        ? {
            className: 'sv-sticker sv-sticker--animate',
            style: { '--sv-sticker-delay': `${index * staggerMs}ms` },
          }
        : { className: 'sv-sticker' }
    if (mounted.current) return { className: `${base} motion-drop-in motion-now` }
    if (!animate) return { className: base }
    return {
      className: strip ? `${base} ${base}--pop` : `${base} sv-sticker--tumble motion-tumble-in`,
      style: { '--sv-sticker-delay': `${Math.min(index, MOTION_STAGGER_CAP) * staggerMs}ms` },
    }
  }
  const shown = max > 0 ? moments.slice(-max) : moments
  const listClass = strip
    ? `sv-sticker-strip${small ? ' sv-sticker-strip--small' : ''}`
    : 'sv-sticker-sheet'
  return (
    <ul className={listClass} aria-label={label}>
      {shown.map(({ badgeId, badge }, index) => (
        <Sticker
          key={badgeId}
          badgeId={badgeId}
          badge={badge}
          strip={strip}
          initialMotion={() => motionFor(index)}
        />
      ))}
    </ul>
  )
}
