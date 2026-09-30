import React, { useEffect, useRef, useState } from 'react'
import BadgeStickerSheet from './BadgeStickerSheet'

/**
 * The student's "🎖️ Coding moments" pill in the top bar: their own awarded badges only (a revoked
 * one disappears silently), opening a small sheet of them, with a speaker toggle that mutes the
 * celebration chime on this device for the session. Hidden until the first moment arrives. The
 * celebration card docks into it (data-badge-dock).
 *
 * @param {object} props
 * @param {{ badgeId: string, badge: object }[]} props.moments From `listMyMoments`.
 * @param {boolean} props.muted The student's own mute (in memory only).
 * @param {(muted: boolean) => void} props.onMutedChange
 * @param {boolean} [props.soundsOff] The tutor turned badge sounds off for the class.
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
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (moments.length === 0) return null
  const silenced = muted || soundsOff

  return (
    <div ref={ref} style={s.wrap} data-badge-dock="">
      <button
        type="button"
        className="btn-ghost"
        style={s.pillBtn}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Your coding moments this lesson"
      >
        <span aria-hidden="true">🎖️</span> Coding moments
        <span style={s.emojiRow} aria-hidden="true">
          {moments.slice(-4).map(({ badgeId, badge }) => (
            <span key={badgeId}>{badge?.emoji ?? '🏅'}</span>
          ))}
        </span>
      </button>
      <button
        type="button"
        className="btn-ghost"
        style={s.muteBtn}
        onClick={() => onMutedChange?.(!muted)}
        disabled={soundsOff}
        aria-pressed={muted}
        aria-label={muted ? 'Turn badge sounds on' : 'Mute badge sounds'}
        title={
          soundsOff
            ? 'Your teacher has turned badge sounds off'
            : muted
              ? 'Turn badge sounds on'
              : 'Mute badge sounds'
        }
      >
        <span aria-hidden="true">{silenced ? '🔇' : '🔈'}</span>
      </button>
      {open && (
        <div style={s.panel} className="ui-popover">
          <span style={s.panelTitle}>Your coding moments</span>
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
    gap: 2,
    flexShrink: 0,
  },
  pillBtn: {
    fontSize: 13,
    padding: '5px 12px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
  emojiRow: {
    display: 'inline-flex',
    gap: 2,
  },
  muteBtn: {
    fontSize: 13,
    padding: '5px 8px',
    borderRadius: 999,
    lineHeight: 1,
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
  panelTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--colour-primary)',
  },
}
