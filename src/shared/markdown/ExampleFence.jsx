import React from 'react'
import { createPortal } from 'react-dom'

// A "See example" fence (./exampleFence.js) in rendered Markdown: a button that opens the worked
// example in a wide, portalled dialog, so code too wide for a narrow explainer panel reads
// properly. The intro and the code are drawn by the caller (MarkdownRenderer), which owns the
// highlighting. Without a document to portal into (server rendering) it falls back to
// showing the example inline as a plain block.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ExampleFenceButton({ example, renderIntro, renderCode, onOpen, disableCopy }) {
  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef(null)
  const titleId = React.useId()
  const canPortal = typeof document !== 'undefined' && !!document.body

  function handleOpen() {
    setOpen(true)
    onOpen?.(example.index, example)
  }

  function handleClose() {
    setOpen(false)
    // Back to the button that opened it, for keyboard users.
    requestAnimationFrame(() => buttonRef.current?.focus())
  }

  if (!canPortal) {
    return (
      <div data-testid="example-inline">
        {example.intro ? renderIntro(example.intro) : null}
        {renderCode(example.language, example.code)}
      </div>
    )
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="md-example-button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        style={s.button}
      >
        <span aria-hidden="true">🔍</span> {example.label}
      </button>
      {open &&
        createPortal(
          <ExampleDialog
            example={example}
            titleId={titleId}
            renderIntro={renderIntro}
            renderCode={renderCode}
            onClose={handleClose}
            disableCopy={disableCopy}
          />,
          document.body
        )}
    </>
  )
}

function ExampleDialog({ example, titleId, renderIntro, renderCode, onClose, disableCopy }) {
  const dialogRef = React.useRef(null)

  React.useEffect(() => {
    dialogRef.current?.querySelector('[data-example-close]')?.focus()
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      // Stop here, so a dialog behind this one (the tutor's student modal) stays open.
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    // Focus trap: Tab and Shift+Tab cycle inside the dialog.
    const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const copyGuard = disableCopy
    ? {
        onCopy: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        onContextMenu: (e) => e.preventDefault(),
      }
    : {}

  return (
    // React events bubble through portals to the explainer behind, so stop them here.
    <div
      className="ui-modal-backdrop md-example-backdrop"
      style={s.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="md-example-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={s.dialog}
      >
        <div style={s.header}>
          <span id={titleId} style={s.title}>
            {example.label}
          </span>
          <button
            type="button"
            data-example-close
            aria-label="Close"
            title="Close"
            onClick={onClose}
            style={s.close}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            ...s.body,
            ...(disableCopy ? { userSelect: 'none', WebkitUserSelect: 'none' } : {}),
          }}
          {...copyGuard}
        >
          {example.intro ? <div style={s.intro}>{renderIntro(example.intro)}</div> : null}
          {renderCode(example.language, example.code)}
        </div>
      </div>
    </div>
  )
}

const s = {
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    margin: '8px 0',
    padding: '7px 14px',
    border: '1px solid #ded1f3',
    borderRadius: 999,
    background: '#f7f2ff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.9em',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    width: 'min(960px, 100%)',
    maxHeight: 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.95rem',
    flexShrink: 0,
  },
  body: {
    padding: '14px 18px 18px',
    overflow: 'auto',
    fontFamily: "'Quicksand', sans-serif",
    color: 'var(--colour-text)',
  },
  intro: {
    marginBottom: 6,
  },
}
