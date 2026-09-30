import React, { useEffect, useRef, useState } from 'react'

// A button that opens a small popover menu (`children`, or `children(close)`). Used by the
// student modal header (Support, More, Focus, Override), the teacher top bar and the student
// grid's ⋯ menu. `caret: false` drops the ▾ (an icon-only trigger such as ⋯, which then needs
// `ariaLabel`); `indicator` draws a small attention dot on the trigger.
export default function DropdownMenu({
  label,
  children,
  buttonClassName = 'btn-ghost',
  buttonStyle,
  caret = true,
  ariaLabel,
  title,
  indicator = false,
  panelStyle,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function onKeyDown(e) {
    // Close the menu, not whatever modal it sits in.
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={buttonClassName}
        style={{ fontSize: 13, padding: '5px 12px', whiteSpace: 'nowrap', ...buttonStyle }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
      >
        {label}
        {caret ? ' ▾' : null}
        {indicator && <span style={s.dot} data-testid="dropdown-indicator" aria-hidden="true" />}
      </button>
      {open && (
        <div style={{ ...s.panel, ...panelStyle }} className="ui-popover">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

const s = {
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--colour-secondary)',
    boxShadow: '0 0 0 2px var(--colour-primary)',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: 180,
    zIndex: 200,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    borderRadius: 8,
  },
}
