import React from 'react'

export default function PresenceBadge({ student, session }) {
  const isWaiting = session?.state === 'waiting'
  // Connected but the tab/window isn't focused (see useStudentPresenceReporting).
  const isAway = !isWaiting && student.online && student.windowFocused === false
  const className = isWaiting
    ? 'presence-badge presence-badge--waiting'
    : isAway
      ? 'presence-badge presence-badge--away'
      : student.online
        ? 'presence-badge presence-badge--online'
        : 'presence-badge presence-badge--offline'
  const label = isWaiting ? 'Waiting' : isAway ? 'Away' : student.online ? 'Online' : 'Offline'
  const title = isAway
    ? "Student is connected but their tab isn't focused"
    : student.online
      ? 'Student is connected now'
      : 'Student is offline'

  return (
    <span className={className} title={title}>
      <span className="presence-badge__dot" />
      {label}
    </span>
  )
}
