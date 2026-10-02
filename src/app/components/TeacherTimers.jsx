import React, { useEffect, useState } from 'react'
import {
  formatEstimatedMinutes,
  getEstimatedMinutes,
  getTotalEstimatedMinutes,
} from '../../shared/taskUtils'
import { formatClock } from '../../shared/timeAgo'
import ClassCountdownPill from './ClassCountdownPill'

export default function TeacherTimers({ session, task, tasks, serverTimeOffset = 0 }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    if (!session?.startedAt || session.state === 'ended') return undefined
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [session?.startedAt, session?.currentTaskStartedAt, session?.state, task?.id])

  if (!session?.startedAt || session.state === 'waiting') return null

  const displayNow = session.state === 'ended' && session.endedAt ? session.endedAt : now
  const elapsedSeconds = Math.floor((displayNow - session.startedAt) / 1000)
  const estimatedMinutes = getEstimatedMinutes(task)
  const totalEstimatedMinutes = getTotalEstimatedMinutes(tasks)
  const showTaskCountdown =
    session.state === 'active' && estimatedMinutes != null && session.currentTaskStartedAt != null
  const remainingSeconds = showTaskCountdown
    ? Math.ceil((session.currentTaskStartedAt + estimatedMinutes * 60 * 1000 - now) / 1000)
    : null
  const taskExpired = showTaskCountdown && remainingSeconds <= 0

  return (
    <div className="teacher-timers" aria-label="Teacher timers">
      <div className="teacher-timer-card">
        <span className="teacher-timer-label">Lesson elapsed</span>
        <strong>{formatClock(elapsedSeconds)}</strong>
        {totalEstimatedMinutes > 0 && (
          <span className="teacher-timer-plan">
            planned {formatEstimatedMinutes(totalEstimatedMinutes)}
          </span>
        )}
      </div>
      {/* The class countdown the students see (started from ⏱ Countdown in the top bar). */}
      {session.state !== 'ended' && (
        <ClassCountdownPill
          countdown={session.classCountdown}
          serverTimeOffset={serverTimeOffset}
          variant="teacher"
        />
      )}
      {showTaskCountdown && (
        <div
          className={`teacher-timer-card teacher-timer-card--task${taskExpired ? ' teacher-timer-card--expired' : ''}`}
        >
          <span className="teacher-timer-label">Task time</span>
          <strong>{taskExpired ? 'Time up' : formatClock(remainingSeconds)}</strong>
          {!taskExpired && <span className="teacher-timer-plan">remaining</span>}
        </div>
      )}
    </div>
  )
}
