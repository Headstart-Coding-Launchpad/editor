import React, { useEffect, useState } from 'react'

const ACTIVITY_LABELS = {
  copy: 'Copied text',
  paste: 'Pasted text',
  click: 'Clicked in the editor',
  block_drag: 'Dragging a block',
  block_click: 'Ran a block',
  green_flag: 'Clicked green flag',
  stop: 'Stopped scripts',
  sprite_drag: 'Moving a sprite',
}

export default function LiveActivityToast({ activity, showClicks = true, style }) {
  const [visibleActivity, setVisibleActivity] = useState(null)

  useEffect(() => {
    if (!activity?.at || !ACTIVITY_LABELS[activity.type]) return undefined
    if (activity.type === 'click' && !showClicks) return undefined
    if (Date.now() - activity.at > 2000) return undefined
    setVisibleActivity(activity)
    const timer = window.setTimeout(() => setVisibleActivity(null), 1400)
    return () => window.clearTimeout(timer)
  }, [activity?.at, activity?.type, showClicks])

  if (!visibleActivity) return null

  return (
    <div role="status" style={{ ...s.toast, ...style }}>
      {ACTIVITY_LABELS[visibleActivity.type]}
    </div>
  )
}

const s = {
  toast: {
    position: 'fixed',
    top: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1200,
    padding: '7px 14px',
    borderRadius: 999,
    background: '#312e81',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
    pointerEvents: 'none',
  },
}
