import React, { useEffect, useState } from 'react'
import {
  formatEstimatedMinutes,
  getEstimatedMinutes,
  getTotalEstimatedMinutes,
} from '../../shared/taskUtils'

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function TeacherTimers({ session, task, tasks }) {
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
