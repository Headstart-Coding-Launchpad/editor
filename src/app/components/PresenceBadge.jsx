import React from 'react'

/** online | away | offline — the student's real connection state. */
function getPresenceState(student) {
  // Connected but the tab/window isn't focused (see useStudentPresenceReporting).
  if (student?.online && student.windowFocused === false) return 'away'
  return student?.online ? 'online' : 'offline'
}

const PRESENCE_LABELS = { online: 'Online', away: 'Away', offline: 'Offline' }
const PRESENCE_TITLES = {
  online: 'Student is connected now',
  away: "Student is connected but their tab isn't focused",
  offline: 'Student is offline',
}

export default function PresenceBadge({ student, session }) {
  const isWaiting = session?.state === 'waiting'
  const presence = getPresenceState(student)
  // While the session waits to start, the badge says "Waiting" but its dot still carries
  // the real presence, so the teacher can see who in the waiting room is still connected.
  const className = isWaiting
    ? `presence-badge presence-badge--waiting presence-badge--dot-${presence}`
    : `presence-badge presence-badge--${presence}`
  const label = isWaiting ? 'Waiting' : PRESENCE_LABELS[presence]
  const title = isWaiting
    ? `Waiting for the lesson to start · ${PRESENCE_LABELS[presence]}`
    : PRESENCE_TITLES[presence]

  return (
    <span className={className} title={title} data-presence={presence}>
      <span className="presence-badge__dot" />
      {label}
    </span>
  )
}
