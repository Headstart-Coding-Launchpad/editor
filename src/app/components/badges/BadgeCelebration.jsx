import React, { useEffect, useRef, useState } from 'react'
import { CELEBRATION_CARD_MS, CELEBRATION_DOCK_MS } from '../../../badges/celebration'

export function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch {
    return false
  }
}

/** Where the card docks: the 🎖️ moments button in the top bar, when it's on screen. */
export const BADGE_DOCK_SELECTOR = '[data-badge-dock]'

function dockOffset(cardEl) {
  const target = document.querySelector(BADGE_DOCK_SELECTOR)
  if (!cardEl || !target) return null
  const from = cardEl.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!to.width && !to.height) return null
  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
  }
}

/**
 * The recipient's celebration: a small card that drops down top-centre, just under the top bar,
 * flips in with one shine sweep, shows for CELEBRATION_CARD_MS, then docks into the 🎖️ moments
 * button and calls `onDone`.
 *
 * It never takes focus: nothing in it is focusable, the layer is only as big as the card and
 * ignores pointer events, and a mousedown on the card itself is cancelled so the editor keeps its
 * focus and typing continues.
 * The polite live region is always mounted, so screen readers hear each award once.
 *
 * @param {object} props
 * @param {{ key: string }|null} props.award The award showing now (useBadgeCelebrations `card`).
 * @param {object|null} props.badge The award's badge, resolved for display.
 * @param {() => void} props.onDone Called once the card has docked.
 */
export default function BadgeCelebration({ award, badge, onDone }) {
  const cardRef = useRef(null)
  const [stage, setStage] = useState('show')
  const [offset, setOffset] = useState(null)
  const [reduced] = useState(prefersReducedMotion)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!award) return undefined
    setStage('show')
    setOffset(null)
    const dockTimer = setTimeout(() => {
      setOffset(dockOffset(cardRef.current))
      setStage('dock')
    }, CELEBRATION_CARD_MS)
    const doneTimer = setTimeout(
      () => onDoneRef.current?.(),
      CELEBRATION_CARD_MS + CELEBRATION_DOCK_MS
    )
    return () => {
      clearTimeout(dockTimer)
      clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [award?.key])

  const announcement =
    award && badge ? `Coding moment: ${badge.title}.${badge.blurb ? ` ${badge.blurb}` : ''}` : ''

  const className = [
    'sv-badge-card',
    stage === 'dock' && 'sv-badge-card--docking',
    reduced && 'sv-badge-card--reduced',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div style={srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {award && badge && (
        <div className="sv-badge-layer sv-badge-layer--top" data-testid="badge-celebration">
          <div
            ref={cardRef}
            key={award.key}
            className={className}
            aria-hidden="true"
            style={
              offset
                ? { '--sv-dock-x': `${offset.x}px`, '--sv-dock-y': `${offset.y}px` }
                : undefined
            }
            onMouseDown={(event) => event.preventDefault()}
          >
            <span className="sv-badge-card__emoji">{badge.emoji}</span>
            <span className="sv-badge-card__text">
              <span className="sv-badge-card__label">Coding moment</span>
              <span className="sv-badge-card__title">{badge.title}</span>
              {badge.blurb && <span className="sv-badge-card__blurb">{badge.blurb}</span>}
            </span>
          </div>
        </div>
      )}
    </>
  )
}

const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
