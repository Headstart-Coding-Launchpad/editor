import React, { useEffect, useRef, useState } from 'react'
import EmojiPicker, { EmojiStyle } from 'emoji-picker-react'

// Native emoji style renders the picker's grid using the browser/OS emoji font
// instead of fetching image sprites from a CDN, so this stays fully offline —
// consistent with the rest of the app having no backend/CDN calls.
export default function EmojiPickerButton({ onInsert, disabled = false }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={wrapRef} style={s.wrap}>
      <button
        type="button"
        style={s.trigger}
        disabled={disabled}
        aria-label="Insert emoji"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        😊
      </button>
      {open && (
        <div style={s.panel} className="ui-popover">
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              onInsert(emojiData.emoji)
              setOpen(false)
            }}
            emojiStyle={EmojiStyle.NATIVE}
            previewConfig={{ showPreview: false }}
            width={380}
            height={400}
          />
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { position: 'relative', display: 'inline-flex' },
  trigger: {
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    fontSize: '1rem',
    lineHeight: 1,
    color: 'var(--colour-text)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    zIndex: 200,
  },
}
