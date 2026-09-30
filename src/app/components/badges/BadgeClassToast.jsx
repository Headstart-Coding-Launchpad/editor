import React, { useEffect, useRef, useState } from 'react'
import {
  CLASS_TOAST_ICON,
  CLASS_TOAST_MS,
  PRESENTATION_TOAST_MS,
  classToastLabel,
} from '../../../badges/celebration'

const LEAVE_MS = 300

/**
 * The silent class toast for a classmate's award, bottom-left: "🎖️ Alex earned a badge: 🐛 Bug
 * Hunter", or one merged "🎖️ 12 students earned a badge: ⌨️ Keyboard Wizard" for a bulk award. It
 * slides in with a soft glow and the blurb is only in the hover title. The presentation window
 * shows it larger and for a little longer. Calls `onDone` when it has gone, so the next queued
 * toast can show.
 *
 * @param {object} props
 * @param {{ id: string, recipientIds: string[], names: string[] }|null} props.toast
 * @param {object|null} props.badge The toast's badge, resolved for display.
 * @param {boolean} [props.presentation]
 * @param {() => void} props.onDone
 */
export default function BadgeClassToast({ toast, badge, presentation = false, onDone }) {
  const [leaving, setLeaving] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!toast) return undefined
    setLeaving(false)
    const duration = presentation ? PRESENTATION_TOAST_MS : CLASS_TOAST_MS
    const leaveTimer = setTimeout(() => setLeaving(true), duration - LEAVE_MS)
    const doneTimer = setTimeout(() => onDoneRef.current?.(), duration)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id, presentation])

  if (!toast) return null
  const className = [
    'sv-badge-toast',
    presentation && 'sv-badge-toast--presentation',
    leaving && 'sv-badge-toast--leaving',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} role="status" title={badge?.blurb || undefined}>
      <span className="sv-badge-toast__icon" aria-hidden="true">
        {CLASS_TOAST_ICON}
      </span>
      <span className="sv-badge-toast__text">{classToastLabel(toast, badge)}</span>
    </div>
  )
}
