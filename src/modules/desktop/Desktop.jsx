import React, { useEffect, useState } from 'react'
import WindowManager from './WindowManager.jsx'
import { openWindow, setWindowMinimized, focusWindow } from './desktopState.js'

// The desktop shell: background, app icon grid, taskbar with a clock and
// open-window buttons, and the window manager itself.
export default function Desktop({ state, onStateChange, apps, availableApps, disabled = false }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const iconApps = (availableApps ?? Object.keys(apps)).filter(appId => apps[appId])

  function openOrFocusApp(appId) {
    if (disabled) return
    const existing = state.windows.find(w => w.appId === appId)
    onStateChange(existing ? focusWindow(state, existing.id) : openWindow(state, appId))
  }

  function toggleTaskbarWindow(win) {
    if (disabled) return
    if (win.minimized) {
      onStateChange(focusWindow(setWindowMinimized(state, win.id, false), win.id))
    } else {
      onStateChange(setWindowMinimized(state, win.id, true))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(160deg, #efe9fb 0%, #f8f6ff 100%)',
        fontFamily: 'var(--font-body)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--ui-border)',
      }}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: 4,
            padding: 12,
            pointerEvents: 'none',
          }}
        >
          {iconApps.map(appId => (
            <button
              key={appId}
              onClick={() => openOrFocusApp(appId)}
              disabled={disabled}
              style={{
                pointerEvents: 'auto',
                width: 84,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 4px',
                background: 'none',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>{apps[appId]?.icon ?? '🗔'}</span>
              <span style={{ fontSize: '0.72rem', textAlign: 'center', color: 'var(--colour-text)' }}>
                {apps[appId]?.title ?? appId}
              </span>
            </button>
          ))}
        </div>
        <WindowManager state={state} onStateChange={onStateChange} apps={apps} disabled={disabled} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.85)',
          borderTop: '1px solid var(--ui-border)',
          flex: '0 0 auto',
        }}
      >
        {state.windows.map(win => {
          const app = apps[win.appId]
          if (!app) return null
          return (
            <button
              key={win.id}
              onClick={() => toggleTaskbarWindow(win)}
              disabled={disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--ui-border)',
                background: win.minimized ? 'transparent' : 'var(--colour-primary)',
                color: win.minimized ? 'var(--colour-text)' : '#fff',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span>{app.icon}</span>
              <span>{app.title}</span>
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--colour-text)', fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
