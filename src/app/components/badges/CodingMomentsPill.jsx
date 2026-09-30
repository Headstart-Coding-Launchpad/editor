import React, { useEffect, useRef, useState } from 'react'
import BadgeStickerSheet from './BadgeStickerSheet'

/**
 * The student's 🎖️ Coding moments button in the top bar: a compact icon-only button (no count,
 * so it never reads as a score) that opens a small popover of their own awarded badges (a revoked
 * one disappears silently) with the speaker toggle for the student's app-wide Sounds setting (the
 * same mute as the top-bar 🔊 button; StudentView wires it to `useSoundsMuted`). Hidden until the first moment arrives. The celebration card docks into it
 * (data-badge-dock).
 *
 * @param {object} props
 * @param {{ badgeId: string, badge: object }[]} props.moments From `listMyMoments`.
 * @param {boolean} props.muted The student's own Sounds mute (`useSoundsMuted`).
 * @param {(muted: boolean) => void} props.onMutedChange
 * @param {boolean} [props.soundsOff] The tutor turned sounds off for the class.
 */
export default function CodingMomentsPill({
  moments = [],
  muted,
  onMutedChange,
  soundsOff = false,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (moments.length === 0) return null
  const silenced = muted || soundsOff

  return (
    <div ref={ref} style={s.wrap} data-badge-dock="">
      <button
        type="button"
        className="btn-ghost"
        style={s.iconBtn}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Coding moments"
        title="Your coding moments this lesson"
      >
        <span aria-hidden="true">🎖️</span>
      </button>
      {open && (
        <div style={s.panel} className="ui-popover" role="group" aria-label="Your coding moments">
          <div style={s.panelHead}>
            <span style={s.panelTitle}>Your coding moments</span>
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.muteBtn}
              onClick={() => onMutedChange?.(!muted)}
              disabled={soundsOff}
              aria-pressed={muted}
              aria-label={muted ? 'Turn sounds on' : 'Mute sounds'}
              title={
                soundsOff
                  ? 'Your teacher has turned sounds off'
                  : muted
                    ? 'Turn sounds on'
                    : 'Mute sounds'
              }
            >
              <span aria-hidden="true">{silenced ? '🔇' : '🔈'}</span>{' '}
              {soundsOff ? 'Sounds off' : muted ? 'Muted' : 'Sound on'}
            </button>
          </div>
          {/* Not role="dialog": the global dialog styles would paint it as a modal overlay. */}
          <BadgeStickerSheet moments={moments} />
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 999,
    fontSize: 16,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    zIndex: 200,
    width: 'min(320px, calc(100vw - 32px))',
    maxHeight: '60vh',
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--colour-primary)',
  },
  muteBtn: {
    fontSize: 12,
    padding: '3px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
}
