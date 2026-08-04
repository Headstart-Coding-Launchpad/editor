import React, { useEffect, useRef, useState } from 'react'
import Window from './Window.jsx'
import {
  focusWindow,
  moveWindow,
  resizeWindow,
  setWindowMinimized,
  setWindowMaximized,
  closeWindow,
} from './desktopState.js'

// Renders every open window for the current desktop state and wires window-chrome
// interactions (drag/resize/minimize/maximize/close/focus) back into desktopState's
// pure operations. `apps` maps appId -> { title, icon, render(props) }.
export default function WindowManager({ state, onStateChange, apps, disabled = false }) {
  const containerRef = useRef(null)
  const [bounds, setBounds] = useState({ width: 1200, height: 700 })
  const [focusedId, setFocusedId] = useState(() => topWindow(state)?.id ?? null)

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setBounds({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  function focus(windowId) {
    if (disabled) return
    setFocusedId(windowId)
    onStateChange(focusWindow(state, windowId))
  }

  const sortedWindows = [...state.windows].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {sortedWindows.map(win => {
        const app = apps[win.appId]
        if (!app) return null
        return (
          <Window
            key={win.id}
            win={win}
            title={app.title}
            icon={app.icon}
            isFocused={!disabled && focusedId === win.id}
            bounds={bounds}
            onFocus={() => focus(win.id)}
            onMove={(x, y) => !disabled && onStateChange(moveWindow(state, win.id, x, y))}
            onResize={(w, h) => !disabled && onStateChange(resizeWindow(state, win.id, w, h))}
            onMinimize={minimized => !disabled && onStateChange(setWindowMinimized(state, win.id, minimized))}
            onMaximize={maximized => !disabled && onStateChange(setWindowMaximized(state, win.id, maximized))}
            onClose={() => !disabled && onStateChange(closeWindow(state, win.id))}
          >
            {app.render({ win, state, onStateChange, disabled, focused: focusedId === win.id })}
          </Window>
        )
      })}
    </div>
  )
}

function topWindow(state) {
  return [...state.windows].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0] ?? null
}
