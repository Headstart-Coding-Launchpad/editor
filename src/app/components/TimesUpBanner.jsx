import React from 'react'

// The "Time's up" moment of the teacher's class countdown (see useClassCountdown). Like the 👍
// toast it is non-blocking: no button, no focus change, clicks pass through and the editor stays
// usable. Keyed on the deadline so adding time and running out again pops it in again. Larger on
// the presentation window, where the class reads it from the board.
export default function TimesUpBanner({ shownAt, presentation = false }) {
  if (shownAt == null) return null
  return (
    <div className="times-up-banner-wrap">
      <div
        key={shownAt}
        className={`times-up-banner motion-pop-in${presentation ? ' times-up-banner--presentation' : ''}`}
        role="status"
        aria-live="polite"
        data-testid="times-up-banner"
      >
        <span className="times-up-banner__icon" aria-hidden="true">
          ⏰
        </span>
        <span className="times-up-banner__text">Time’s up!</span>
      </div>
    </div>
  )
}
