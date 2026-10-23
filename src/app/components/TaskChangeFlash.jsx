import React, { useEffect, useRef, useState } from 'react'
import { MOTION_MS } from '../../shared/motion'

// The "the class moved to a new task" flash: a full-width title band across the top of the task
// area, held for a moment and then slid or faded away. `taskKey` is the class's current task
// (the session's currentTaskId), never the one the student is browsing, so a student looking
// back at an earlier task doesn't trigger it. It only fires when the key changes from one real
// task to another while `enabled`: not on first load, not when a reconnect or refresh restores
// the same task, not when the session loads after mount (null to a task). Like the 👍 toast it
// is non-blocking: pointer-events none, no focus change. A screen reader gets the same words
// from an always-mounted polite region (a region inserted with its text is often not
// announced). Reduced motion is a static band that fades (`.task-change-flash` in index.css).
export default function TaskChangeFlash({ taskKey, number, title, enabled = true }) {
  const previousKeyRef = useRef(taskKey)
  const [flash, setFlash] = useState(null)

  // Decided during the render that changes the key, so the band never lags a frame behind the
  // new task. The previous key is tracked even while disabled, so enabling later isn't a change.
  if (previousKeyRef.current !== taskKey) {
    const hadTask = previousKeyRef.current != null
    previousKeyRef.current = taskKey
    if (enabled && hadTask && taskKey != null) {
      setFlash({ number, title: title ?? '', count: (flash?.count ?? 0) + 1 })
    }
  }

  useEffect(() => {
    if (!flash) return undefined
    const timer = setTimeout(() => setFlash(null), MOTION_MS.taskFlash)
    return () => clearTimeout(timer)
  }, [flash])

  const label = flash
    ? flash.title
      ? `Task ${flash.number} · ${flash.title}`
      : `Task ${flash.number}`
    : ''
  const spoken = flash
    ? flash.title
      ? `Now on task ${flash.number}: ${flash.title}`
      : `Now on task ${flash.number}`
    : ''

  return (
    <>
      <div
        className="task-change-flash__sr"
        role="status"
        aria-live="polite"
        data-testid="task-change-flash-live"
      >
        {spoken}
      </div>
      {flash && (
        <div className="task-change-flash-wrap" aria-hidden="true">
          <div key={flash.count} className="task-change-flash" data-testid="task-change-flash">
            {label}
          </div>
        </div>
      )}
    </>
  )
}
