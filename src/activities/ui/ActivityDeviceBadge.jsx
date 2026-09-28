import React from 'react'
import { describeActivityDevice } from '../device.js'

// Teacher-facing badge: which device an activity attempt used (touch screen, on-screen
// keyboard), read from the activity state itself. Renders nothing for a mouse and keyboard.
export default function ActivityDeviceBadge({ state }) {
  const device = describeActivityDevice(state)
  if (!device) return null
  return (
    <span className="act-badge" title={`Done on: ${device.label}`} data-testid="activity-device">
      {device.icon} {device.label}
    </span>
  )
}
