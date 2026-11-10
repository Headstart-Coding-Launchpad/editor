import React, { useState } from 'react'

/**
 * "😴 Python fell asleep. Your code is safe 💾" with one Reload button (deep review 2026-11-10,
 * R3; sketch OK'd by Ryan 10 Nov). Shown in the code pane in place of "Getting Python ready…"
 * when Python is stuck or failed to load (pyodideStatus 'error'). `onReload` saves the student's
 * code and reloads the page (useStudentCodeState.reloadAfterPythonStuck); without one it just
 * reloads.
 */
export default function PythonAsleepPrompt({ onReload, style }) {
  const [reloading, setReloading] = useState(false)
  return (
    <div role="alert" data-testid="python-asleep" style={{ ...s.bar, ...style }}>
      <span style={s.text}>😴 Python fell asleep. Your code is safe 💾</span>
      <button
        type="button"
        className="btn-primary"
        style={s.button}
        disabled={reloading}
        onClick={() => {
          setReloading(true)
          if (onReload) onReload()
          else window.location.reload()
        }}
      >
        Reload 🔄
      </button>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    padding: '6px 8px 6px 12px',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 6,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#92400e',
  },
  button: {
    // Apple's minimum tap size: this is the one thing to press on the screen.
    minHeight: 44,
    padding: '6px 16px',
    fontSize: '0.9rem',
    fontWeight: 700,
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },
}
