import React, { useEffect, useRef, useState } from 'react'
import { useIsTouchDevice } from '../../shared/useIsTouchDevice'

// An icon-only (or short-label) button whose name is also visible on touch: a long-press (about
// half a second) shows the label in a small bubble for two seconds, since `title` never appears
// without a hover. Mouse and keyboard users still get `title`, and `aria-label` names it for
// screen readers. `minTouch` raises the hit area to 44px on touch devices (the tablet target size).
//
// The long-press doesn't fire the click: the press that showed the bubble is swallowed.
export default function TipButton({
  label,
  children,
  onClick,
  style,
  minTouch = true,
  disabled = false,
  ...rest
}) {
  const touch = useIsTouchDevice()
  const [show, setShow] = useState(false)
  const timer = useRef(null)
  const hide = useRef(null)
  const swallow = useRef(false)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(hide.current)
    },
    []
  )

  function start(event) {
    if (event.pointerType !== 'touch') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      swallow.current = true
      setShow(true)
      clearTimeout(hide.current)
      hide.current = setTimeout(() => setShow(false), 2000)
    }, 500)
  }

  function cancel() {
    clearTimeout(timer.current)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        {...rest}
        style={{
          ...(minTouch && touch ? { minWidth: 44, minHeight: 44 } : null),
          touchAction: 'manipulation',
          ...style,
        }}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => {
          if (swallow.current) event.preventDefault()
        }}
        onClick={(event) => {
          if (swallow.current) {
            swallow.current = false
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onClick?.(event)
        }}
      >
        {children}
      </button>
      {show && (
        <span role="tooltip" style={s.bubble}>
          {label}
        </span>
      )}
    </span>
  )
}

const s = {
  bubble: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'var(--colour-ink-strong, #111827)',
    color: '#fff',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    zIndex: 400,
    pointerEvents: 'none',
  },
}
