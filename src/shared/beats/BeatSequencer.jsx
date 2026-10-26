import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { beatGain, useBeatSound } from './beatSoundSettings.js'
import { describeBeatSong, stepHit } from './patterns.js'
import { installBeatAudioUnlock, playBeat, setBeatGain } from './player.js'
import { downloadWav, renderBeatWav } from './render.js'

/**
 * Beat Maker's step sequencer (docs/authoring/beats.md), shown in the Stage pane when a run
 * called play(): each pattern a row of squares, lit where there's an x, with a playhead sweeping
 * across in time. The grid is enough on its own: with the sound off everything can still be seen.
 *
 * - `song`: readBeatSong's `{ parts, autoPlay }`.
 * - `autoPlay`: start playing as soon as it shows (the student's own Run). Never on the tutor's
 *   views, so a class of beats doesn't play at once.
 * - `controls`: 'full' (Play/Stop, sound on/off, volume, Save my beat), 'play' (Play/Stop and
 *   sound on/off: the tutor's modal and Show it), or 'none' (the tutor's small card).
 */
const INSTRUMENT_COLOURS = Object.freeze({
  kick: '#e11d48',
  snare: '#f59e0b',
  hat: '#0ea5e9',
  clap: '#8b5cf6',
})

const NUMBERS_UP_TO = 32

export default function BeatSequencer({ song, autoPlay = false, controls = 'full', compact }) {
  const { muted, volume, setMuted, setVolume } = useBeatSound()
  const [position, setPosition] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [silent, setSilent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const handleRef = useRef(null)
  const gainRef = useRef(beatGain({ muted, volume }))
  gainRef.current = beatGain({ muted, volume })
  const description = useMemo(() => describeBeatSong(song), [song])

  useEffect(() => {
    installBeatAudioUnlock()
  }, [])

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
  }, [])

  const start = useCallback(() => {
    stop()
    if (!song?.parts?.length) return
    setPlaying(true)
    setSilent(false)
    let handle = null
    handle = playBeat(song, {
      gain: gainRef.current,
      onStep: setPosition,
      onSound: (audible) => setSilent(!audible),
      onEnd: () => {
        if (handle && handleRef.current === handle) handleRef.current = null
        setPlaying(false)
        setPosition(null)
      },
    })
    handleRef.current = handle
  }, [song, stop])

  // A new run's beat plays straight away; leaving the task, a new Run or Stop (which all take
  // the beat away) stops it.
  useEffect(() => {
    if (autoPlay && song?.autoPlay) start()
    return stop
  }, [autoPlay, song, start, stop])

  useEffect(() => {
    if (handleRef.current) setBeatGain(beatGain({ muted, volume }))
  }, [muted, volume])

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const bytes = await renderBeatWav(song)
      if (bytes) downloadWav(bytes, 'my-beat.wav')
      else setSaveError("This browser can't save sound files.")
    } catch {
      setSaveError("Your beat couldn't be saved. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!song?.parts?.length) return null
  const showNumbers = !compact && song.parts.every((part) => part.length <= NUMBERS_UP_TO)
  const status = !playing
    ? song.autoPlay
      ? ''
      : 'stop() ended this beat. Press Play to hear it anyway.'
    : muted
      ? 'Sound is off: watch the grid.'
      : silent
        ? 'No sound yet: press Play again to hear it.'
        : ''

  return (
    <div style={s.wrap} data-testid="beat-sequencer">
      {controls !== 'none' && (
        <div style={s.toolbar}>
          <button
            type="button"
            className="btn-ghost-outline"
            style={{ ...s.button, ...(playing ? s.buttonOn : null) }}
            onClick={playing ? stop : start}
            data-testid="beat-play"
          >
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.button}
            aria-pressed={!muted}
            onClick={() => setMuted(!muted)}
            title={muted ? 'Turn the beat sound on' : 'Turn the beat sound off'}
            data-testid="beat-mute"
          >
            {muted ? '🔇 Sound off' : '🔊 Sound on'}
          </button>
          {controls === 'full' && (
            <>
              <label style={s.volume}>
                <span style={s.volumeLabel}>Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(volume * 100)}
                  onChange={(event) => setVolume(Number(event.target.value) / 100)}
                  disabled={muted}
                  aria-label="Beat volume"
                  style={s.slider}
                />
              </label>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.button}
                onClick={save}
                disabled={saving}
                data-testid="beat-save"
              >
                {saving ? 'Saving…' : '💾 Save my beat'}
              </button>
            </>
          )}
        </div>
      )}
      {(status || saveError) && (
        <p style={s.status} aria-live="polite">
          {saveError || status}
        </p>
      )}
      <div style={s.parts} role="img" aria-label={description}>
        {song.parts.map((part, partIndex) => (
          <BeatPart
            key={partIndex}
            part={part}
            heading={song.parts.length > 1 ? `Part ${partIndex + 1} · tempo ${part.tempo}` : null}
            tempoNote={song.parts.length > 1 ? null : `tempo ${part.tempo}`}
            playStep={position && position.part === partIndex ? position.step : null}
            showNumbers={showNumbers}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}

function BeatPart({ part, heading, tempoNote, playStep, showNumbers, compact }) {
  const columns = `minmax(${compact ? 8 : 44}px, auto) repeat(${part.length}, minmax(0, 1fr))`
  const steps = Array.from({ length: part.length }, (_, i) => i)
  return (
    <div style={s.part}>
      {(heading || (tempoNote && !compact)) && (
        <div style={s.partHeading}>{heading ?? tempoNote}</div>
      )}
      <div style={{ ...s.grid, gridTemplateColumns: columns, gap: compact ? 1 : 3 }}>
        {showNumbers && (
          <>
            <span aria-hidden="true" />
            {steps.map((i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{ ...s.number, ...(i === playStep ? s.numberOn : null) }}
              >
                {i}
              </span>
            ))}
          </>
        )}
        {part.rows.map((row) => (
          <BeatRow key={row.name} row={row} steps={steps} playStep={playStep} compact={compact} />
        ))}
      </div>
    </div>
  )
}

function BeatRow({ row, steps, playStep, compact }) {
  const colour = INSTRUMENT_COLOURS[row.name]
  return (
    <>
      <span
        style={{
          ...s.label,
          fontSize: compact ? 9 : 13,
          paddingRight: compact ? 2 : 6,
          color: colour,
        }}
        aria-hidden="true"
        title={row.name}
      >
        {compact ? row.name[0].toUpperCase() : row.name}
      </span>
      {steps.map((i) => {
        const { hit, accent } = stepHit(row.steps, i)
        const repeat = i >= row.steps.length
        const now = i === playStep
        const shade = Math.floor(i / 4) % 2 === 0 ? '#f3f4f6' : '#e5e7eb'
        return (
          <span
            key={i}
            aria-hidden="true"
            data-hit={hit ? '1' : undefined}
            style={{
              ...s.cell,
              borderRadius: compact ? 2 : 5,
              background: hit ? colour : shade,
              borderColor: hit ? colour : '#d1d5db',
              borderStyle: repeat ? 'dashed' : 'solid',
              opacity: repeat ? 0.55 : 1,
              boxShadow: accent ? 'inset 0 0 0 3px rgba(255,255,255,0.65)' : undefined,
              ...(now ? (hit ? s.cellHitNow : s.cellNow) : null),
            }}
          />
        )
      })}
    </>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
    minWidth: 0,
    flex: '1 1 auto',
  },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  button: {
    minHeight: 44,
    minWidth: 44,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  buttonOn: { background: '#eef2ff', borderColor: '#6366f1', color: '#3730a3' },
  volume: { display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 },
  volumeLabel: { fontFamily: 'var(--font-body)', fontSize: 12, color: '#4b5563' },
  slider: { width: 90 },
  status: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#4b5563',
  },
  parts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'auto',
    minHeight: 0,
    padding: 4,
  },
  part: { display: 'flex', flexDirection: 'column', gap: 4 },
  partHeading: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 12,
    color: '#4b5563',
  },
  grid: { display: 'grid', alignItems: 'center' },
  number: {
    textAlign: 'center',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 10,
    color: '#9ca3af',
  },
  numberOn: { color: '#111827', fontWeight: 700 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    paddingRight: 6,
    whiteSpace: 'nowrap',
  },
  cell: {
    width: '100%',
    maxWidth: 34,
    justifySelf: 'center',
    boxSizing: 'border-box',
    aspectRatio: '1 / 1',
    borderWidth: 1,
    transition: 'transform 80ms ease-out',
  },
  cellNow: { borderColor: '#111827', borderWidth: 2 },
  cellHitNow: { transform: 'scale(1.18)', filter: 'brightness(1.15)', borderColor: '#111827' },
}
