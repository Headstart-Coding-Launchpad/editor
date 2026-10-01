import React from 'react'
import { useCountdownRemaining } from '../hooks/useClassCountdown'
import { formatClock } from '../../shared/timeAgo'

// The last minute turns the pill amber so the class sees time is nearly up.
export const COUNTDOWN_WARNING_MS = 60_000

const LABELS = {
  student: 'Time left',
  presentation: 'Time left',
  teacher: 'Class countdown',
}

/**
 * The teacher's class countdown as a small pill (student top bar), a large one (presentation
 * window) or a card in the teacher's timer row. It ticks on its own, so the view that renders
 * it doesn't re-render every second. Renders nothing without a countdown. At zero it reads
 * "Time's up" until the teacher adds time or stops it; nothing is locked.
 */
export default function ClassCountdownPill({
  countdown,
  serverTimeOffset = 0,
  variant = 'student',
}) {
  const remainingMs = useCountdownRemaining(countdown, serverTimeOffset)
  if (remainingMs == null) return null

  const expired = remainingMs <= 0
  const warning = !expired && remainingMs <= COUNTDOWN_WARNING_MS
  const label = LABELS[variant] ?? LABELS.student
  const className = [
    'class-countdown',
    `class-countdown--${variant}`,
    warning ? 'class-countdown--warning' : '',
    expired ? 'class-countdown--expired' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} role="timer" aria-label={label} data-testid="class-countdown">
      <span className="class-countdown__icon" aria-hidden="true">
        ⏱
      </span>
      {variant === 'teacher' && <span className="class-countdown__label">{label}</span>}
      <strong className="class-countdown__time">
        {expired ? 'Time’s up' : formatClock(Math.ceil(remainingMs / 1000))}
      </strong>
    </div>
  )
}
