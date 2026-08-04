import React, { useCallback, useRef } from 'react'

const MIN_WIDTH = 320
const MIN_HEIGHT = 220

// A single OS-style window: draggable title bar, one bottom-right resize handle,
// minimize/maximize/close controls. Position/size are fully controlled by the parent
// (WindowManager) — this component only reports pointer deltas upward.
export default function Window({
  win,
  title,
  icon,
  isFocused,
  bounds,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onClose,
  children,
}) {
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  const handleTitleBarPointerDown = useCallback(e => {
    if (win.maximized) return
    if (e.target.closest('[data-window-control]')) return
    onFocus?.()
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: win.x, originY: win.y }
    const handleMove = ev => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const maxX = Math.max(0, (bounds?.width ?? 1200) - win.width)
      const maxY = Math.max(0, (bounds?.height ?? 700) - 32)
      const nextX = Math.min(Math.max(0, dragRef.current.originX + dx), maxX)
      const nextY = Math.min(Math.max(0, dragRef.current.originY + dy), maxY)
      onMove?.(nextX, nextY)
    }
    const handleUp = () => {
      dragRef.current = null
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }, [win.maximized, win.x, win.y, win.width, bounds, onFocus, onMove])

  const handleResizePointerDown = useCallback(e => {
    if (win.maximized) return
    e.preventDefault()
    e.stopPropagation()
    onFocus?.()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, originW: win.width, originH: win.height }
    const handleMove = ev => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      const nextW = Math.max(MIN_WIDTH, resizeRef.current.originW + dx)
      const nextH = Math.max(MIN_HEIGHT, resizeRef.current.originH + dy)
      onResize?.(nextW, nextH)
    }
    const handleUp = () => {
      resizeRef.current = null
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }, [win.maximized, win.width, win.height, onFocus, onResize])

  if (win.minimized) return null

  const style = win.maximized
    ? { position: 'absolute', inset: 0, zIndex: win.zIndex }
    : {
      position: 'absolute',
      left: win.x,
      top: win.y,
      width: win.width,
      height: win.height,
      zIndex: win.zIndex,
    }

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: win.maximized ? 0 : 8,
        boxShadow: isFocused ? '0 12px 32px rgba(0,0,0,0.28)' : '0 4px 14px rgba(0,0,0,0.16)',
        border: isFocused ? '1.5px solid var(--colour-primary)' : '1.5px solid var(--ui-border)',
        overflow: 'hidden',
      }}
      onPointerDown={() => onFocus?.()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          background: isFocused ? 'var(--colour-primary)' : '#e5e0f5',
          color: isFocused ? '#fff' : 'var(--colour-text)',
          cursor: win.maximized ? 'default' : 'grab',
          userSelect: 'none',
          flex: '0 0 auto',
        }}
        onPointerDown={handleTitleBarPointerDown}
        onDoubleClick={() => onMaximize?.(!win.maximized)}
      >
        {icon && <span style={{ fontSize: '1rem' }}>{icon}</span>}
        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <button
          data-window-control
          aria-label="Minimize"
          onClick={() => onMinimize?.(true)}
          style={windowControlStyle}
        >
          &#x2013;
        </button>
        <button
          data-window-control
          aria-label={win.maximized ? 'Restore' : 'Maximize'}
          onClick={() => onMaximize?.(!win.maximized)}
          style={windowControlStyle}
        >
          {win.maximized ? '❐' : '☐'}
        </button>
        <button
          data-window-control
          aria-label="Close"
          onClick={() => onClose?.()}
          style={{ ...windowControlStyle, color: '#fecaca' }}
        >
          &#x2715;
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
      {!win.maximized && (
        <div
          onPointerDown={handleResizePointerDown}
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
          }}
        >
          <div style={{
            position: 'absolute', right: 3, bottom: 3, width: 8, height: 8,
            borderRight: '2px solid var(--ui-border)', borderBottom: '2px solid var(--ui-border)',
          }} />
        </div>
      )}
    </div>
  )
}

const windowControlStyle = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '0.85rem',
  lineHeight: 1,
  padding: '4px 7px',
  borderRadius: 4,
}
