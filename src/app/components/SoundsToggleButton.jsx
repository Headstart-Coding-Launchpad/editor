import React from 'react'
import { useSoundsMuted } from '../soundSettings'

/**
 * The student's 🔊/🔇 button in the top bar (solo and live): the one app-wide Sounds mute
 * (`headstart_sounds_muted`), shared with the Coding moments popover. Disabled while the tutor has
 * Sounds off for the class. Not rendered in the presentation window, previews or the teacher view.
 *
 * @param {object} props
 * @param {boolean} [props.soundsOff] The tutor turned sounds off for the class (live only).
 */
export default function SoundsToggleButton({ soundsOff = false }) {
  const [muted, setMuted] = useSoundsMuted()
  const silenced = muted || soundsOff
  const label = muted ? 'Turn sounds on' : 'Mute sounds'

  return (
    <button
      type="button"
      className="btn-ghost"
      style={s.btn}
      onClick={() => setMuted(!muted)}
      disabled={soundsOff}
      aria-pressed={muted}
      aria-label={label}
      title={soundsOff ? 'Your teacher has turned sounds off' : label}
    >
      <span aria-hidden="true">{silenced ? '🔇' : '🔊'}</span>
    </button>
  )
}

const s = {
  btn: {
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 999,
    fontSize: 16,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}
