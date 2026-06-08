import React from 'react'

export default function PresenceBadge({ student, session }) {
  const isWaiting = session?.state === 'waiting'
  const className = isWaiting
    ? 'presence-badge presence-badge--waiting'
    : student.online
    ? 'presence-badge presence-badge--online'
    : 'presence-badge presence-badge--offline'
  const label = isWaiting ? 'Waiting' : student.online ? 'Online' : 'Offline'
  const title = student.online ? 'Student is connected now' : 'Student is offline'

  return (
    <span className={className} title={title}>
      <span className="presence-badge__dot" />
      {label}
    </span>
  )
}
