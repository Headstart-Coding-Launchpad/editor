import React, { useEffect, useRef, useState } from 'react'
import {
  CLASS_COUNTDOWN_MAX_MINUTES,
  CLASS_COUNTDOWN_MIN_MINUTES,
  CLASS_COUNTDOWN_PRESET_MINUTES,
  isClassCountdown,
  MINUTE_MS,
  parseCountdownMinutes,
} from '../../shared/classCountdown'
import ClassCountdownPill from './ClassCountdownPill'

/**
 * The teacher's ⏱ Countdown button and popover (TeacherSessionControls): quick presets, custom
 * minutes, +1 min and Stop. The countdown shows on every student screen and the presentation
 * window, survives task changes and locks nothing at zero (see useClassCountdown).
 */
export default function ClassCountdownControl({
  countdown,
  serverTimeOffset = 0,
  onStart,
  onAddTime,
  onClear,
}) {
  const [open, setOpen] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)
  const running = isClassCountdown(countdown)

  useEffect(() => {
    if (!open) return undefined
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      console.warn('Class countdown update failed:', err)
      setError('Could not update the countdown.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleStart(minutes) {
    const ok = await run(() => onStart(Math.round(minutes * MINUTE_MS)))
    if (ok) setOpen(false)
  }

  async function handleCustomStart(e) {
    e.preventDefault()
    const minutes = parseCountdownMinutes(customMinutes)
    if (minutes == null) {
      setError(`Enter a number of minutes (up to ${CLASS_COUNTDOWN_MAX_MINUTES}).`)
      return
    }
    await handleStart(minutes)
    setCustomMinutes('')
  }

  return (
    <div ref={wrapRef} style={s.wrap}>
      <button
        type="button"
        className="btn-ghost teacher-session-controls__action"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Class countdown"
        title="Show a countdown on every student screen and the presentation window"
      >
        ⏱ {running ? 'Countdown ●' : 'Countdown'}
      </button>
      {open && (
        <div style={s.panel} className="ui-popover" role="dialog" aria-label="Class countdown">
          {running && (
            <div style={s.runningRow}>
              <ClassCountdownPill
                countdown={countdown}
                serverTimeOffset={serverTimeOffset}
                variant="student"
              />
              <button
                type="button"
                style={s.item}
                disabled={busy}
                onClick={() => run(() => onAddTime(MINUTE_MS))}
              >
                +1 min
              </button>
              <button
                type="button"
                style={{ ...s.item, ...s.stop }}
                disabled={busy}
                onClick={async () => {
                  if (await run(onClear)) setOpen(false)
                }}
              >
                Stop
              </button>
            </div>
          )}
          <span style={s.heading}>{running ? 'Restart with' : 'Start a countdown'}</span>
          <div style={s.presets}>
            {CLASS_COUNTDOWN_PRESET_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                style={s.preset}
                disabled={busy}
                onClick={() => handleStart(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </div>
          <form style={s.customRow} onSubmit={handleCustomStart}>
            <label style={s.customLabel}>
              Minutes
              <input
                style={s.input}
                type="number"
                min={CLASS_COUNTDOWN_MIN_MINUTES}
                max={CLASS_COUNTDOWN_MAX_MINUTES}
                step="any"
                inputMode="decimal"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                aria-label="Custom countdown minutes"
              />
            </label>
            <button type="submit" style={{ ...s.item, ...s.primary }} disabled={busy}>
              Start
            </button>
          </form>
          {error && (
            <span style={s.error} role="alert">
              {error}
            </span>
          )}
          <span style={s.note}>
            Students see it at the top of their screen. Nothing locks at zero.
          </span>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { position: 'relative', display: 'inline-block' },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: 260,
    zIndex: 200,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
  },
  runningRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottom: '1px solid #e5e7eb',
  },
  heading: { fontSize: 12, fontWeight: 700, color: '#374151' },
  presets: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 },
  preset: {
    padding: '7px 0',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  customRow: { display: 'flex', alignItems: 'flex-end', gap: 6 },
  customLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '7px 9px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  },
  item: {
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primary: {
    background: 'var(--colour-primary)',
    color: '#fff',
    borderColor: 'var(--colour-primary)',
  },
  stop: { color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' },
  error: { fontSize: 11.5, color: '#dc2626' },
  note: { fontSize: 11.5, color: 'var(--colour-muted)' },
}
