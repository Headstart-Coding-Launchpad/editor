import React, { useState } from 'react'
import { useCountdownRemaining } from '../hooks/useClassCountdown'

/**
 * The light amber strip under the top bar once the class countdown reaches zero, on the teacher
 * view and the presentation window: three separate one-click choices.
 * - "+1 min": one more minute (the countdown restarts from now).
 * - "Clear: stay here": the countdown goes; the class stays on this task (a countdown is often
 *   just "time to explain").
 * - "Next task": the whole class moves on (skipping optional tasks when the tutor's switch is
 *   on) and the countdown goes.
 * Nothing happens by itself at zero. It ticks on its own (useCountdownRemaining), so the view
 * that renders it does not re-render every second, and renders nothing until time is up.
 */
export default function ClassCountdownEndedStrip({
  countdown,
  serverTimeOffset = 0,
  onAddMinute,
  onClear,
  // null when the class is on the last task Next can reach (the button shows, disabled).
  onNextTask,
  note = null,
  variant = 'teacher',
}) {
  const remainingMs = useCountdownRemaining(countdown, serverTimeOffset)
  const [busy, setBusy] = useState(false)
  if (remainingMs == null || remainingMs > 0) return null

  async function run(action) {
    if (!action || busy) return
    setBusy(true)
    try {
      await action()
    } catch (err) {
      console.warn('Countdown action failed:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`countdown-ended-strip countdown-ended-strip--${variant}`}
      role="region"
      aria-label="Countdown finished"
      data-testid="countdown-ended-strip"
    >
      <span className="countdown-ended-strip__title">
        <span aria-hidden="true">⏰</span> Time’s up
      </span>
      <button
        type="button"
        className="countdown-ended-strip__btn"
        disabled={busy}
        onClick={() => run(onAddMinute)}
      >
        +1 min
      </button>
      <button
        type="button"
        className="countdown-ended-strip__btn"
        disabled={busy}
        title="Clear the countdown and stay on this task"
        onClick={() => run(onClear)}
      >
        Clear: stay here
      </button>
      <button
        type="button"
        className="countdown-ended-strip__btn countdown-ended-strip__btn--next"
        disabled={busy || !onNextTask}
        title={
          onNextTask
            ? 'Move the whole class to the next task and clear the countdown'
            : 'The class is on the last task'
        }
        onClick={() => run(onNextTask)}
      >
        Next task →
      </button>
      {note && <span className="countdown-ended-strip__note">{note}</span>}
    </div>
  )
}
