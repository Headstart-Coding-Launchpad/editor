import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../shared/motion'

const ENDED_VISIBLE_MS = 3000
const FADE_MS = 600

/**
 * A thin bar on a student's screen while the tutor's Go Live has them locked onto the tutor's
 * screen, and a short "Live has ended" note that fades when it stops. Never rendered for the
 * tutor or the presenter (the caller passes `active` only for students locked onto the tutor).
 */
export default function TutorLiveBanner({ active, taskLabel = '' }) {
  const [phase, setPhase] = useState(active ? 'live' : 'idle')
  const wasActive = useRef(active)

  useEffect(() => {
    if (active) {
      wasActive.current = true
      setPhase('live')
      return undefined
    }
    if (!wasActive.current) return undefined
    wasActive.current = false
    setPhase('ended')
    const reduced = prefersReducedMotion()
    const fadeTimer = setTimeout(() => setPhase('fading'), ENDED_VISIBLE_MS)
    const hideTimer = setTimeout(() => setPhase('idle'), ENDED_VISIBLE_MS + (reduced ? 0 : FADE_MS))
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [active])

  if (phase === 'idle') return null
  const live = phase === 'live'
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="tutor-live-banner"
      style={{
        ...s.bar,
        background: live ? '#b3261e' : '#2f5d3a',
        opacity: phase === 'fading' ? 0 : 1,
        transition: prefersReducedMotion() ? 'none' : `opacity ${FADE_MS}ms ease`,
      }}
    >
      {live
        ? `🔴 Your tutor is live: watch their screen${taskLabel ? ` · ${taskLabel}` : ''}`
        : 'Live has ended, back to your work'}
    </div>
  )
}

const s = {
  bar: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    padding: '4px 12px',
    flexShrink: 0,
  },
}
