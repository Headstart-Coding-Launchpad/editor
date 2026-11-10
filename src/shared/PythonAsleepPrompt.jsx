import React, { useEffect, useRef, useState } from 'react'

/**
 * "😴 Python fell asleep." with one Reload button (deep review 2026-11-10, R3; sketch OK'd by Ryan
 * 10 Nov). Shown in the code pane in place of "Getting Python ready…" when Python is stuck or
 * failed to load (pyodideStatus 'error'). `onReload` saves the student's code and reloads the
 * page (useStudentCodeState.reloadAfterPythonStuck); without one it just reloads. `codeSafe`
 * adds "Your code is safe 💾", only where the reload really brings the code back
 * (useStudentCodeState.pythonReloadRestoresCode); otherwise "Tap Reload to start Python again".
 * If the page has not gone after RETRY_AFTER_MS (the browser blocked the reload, or a "leave
 * site?" box was cancelled), the button comes back with a small "Still there? Tap again".
 */
const RETRY_AFTER_MS = 5000

export default function PythonAsleepPrompt({ onReload, codeSafe = false, style }) {
  const [reloading, setReloading] = useState(false)
  const [again, setAgain] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])
  return (
    <div role="alert" data-testid="python-asleep" style={{ ...s.bar, ...style }}>
      <span style={s.text}>
        {codeSafe
          ? '😴 Python fell asleep. Your code is safe 💾'
          : '😴 Python fell asleep. Tap Reload to start Python again'}
        {again && <span style={s.again}> Still there? Tap again</span>}
      </span>
      <button
        type="button"
        className="btn-primary"
        style={s.button}
        disabled={reloading}
        onClick={() => {
          setReloading(true)
          clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setReloading(false)
            setAgain(true)
          }, RETRY_AFTER_MS)
          try {
            if (onReload) onReload()
            else window.location.reload()
          } catch (err) {
            // The page did not reload: the button comes back for another go.
            console.warn('[python reload] reload failed', err)
            clearTimeout(timerRef.current)
            setReloading(false)
          }
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
  again: { fontWeight: 400, fontSize: '0.8rem', whiteSpace: 'nowrap' },
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
