import { SLOW_MO_MAX_SPEED, SLOW_MO_MIN_SPEED } from './gate.js'
import './slowMo.css'

function speedWords(speed) {
  const n = Math.round(speed * 100) / 100
  return n === 1 ? '1 block a second' : `${n} blocks a second`
}

/**
 * The four slow-mo buttons under the stage (ages 7–11: big, an icon and a word each) and the speed
 * slider. Only rendered when the task has `slowMo.enabled`; hidden in read-only mirrors, which
 * follow the broadcast instead (see SlowMoMirrorStatus).
 */
export default function SlowMoControls({
  mode, // 'idle' | 'playing' | 'paused' | 'finished'
  step,
  speed,
  disabled = false,
  onPlay,
  onPause,
  onStep,
  onRestart,
  onSpeedChange,
}) {
  const playing = mode === 'playing'
  const status =
    mode === 'playing'
      ? `Playing slowly · step ${step}`
      : mode === 'paused'
        ? `Paused · step ${step}`
        : mode === 'finished'
          ? `Finished · ${step} steps`
          : 'Press Slow-mo or Step to watch each block run'

  return (
    <div className="slowmo-controls" role="group" aria-label="Slow-mo controls">
      <div className="slowmo-buttons">
        <button
          type="button"
          className="slowmo-btn slowmo-btn--play"
          aria-pressed={playing}
          disabled={disabled}
          onClick={onPlay}
          title="Run the scripts slowly, one block at a time"
        >
          <span className="slowmo-btn-icon" aria-hidden="true">
            🐢
          </span>
          <span className="slowmo-btn-word">Slow-mo</span>
        </button>
        <button
          type="button"
          className="slowmo-btn"
          disabled={disabled || !playing}
          onClick={onPause}
          title="Pause on this block"
        >
          <span className="slowmo-btn-icon" aria-hidden="true">
            ⏸️
          </span>
          <span className="slowmo-btn-word">Pause</span>
        </button>
        <button
          type="button"
          className="slowmo-btn"
          disabled={disabled}
          onClick={onStep}
          title="Run just the next block"
        >
          <span className="slowmo-btn-icon" aria-hidden="true">
            👣
          </span>
          <span className="slowmo-btn-word">Step</span>
        </button>
        <button
          type="button"
          className="slowmo-btn"
          disabled={disabled}
          onClick={onRestart}
          title="Stop and put the stage back to the start"
        >
          <span className="slowmo-btn-icon" aria-hidden="true">
            ⏮️
          </span>
          <span className="slowmo-btn-word">Restart</span>
        </button>
      </div>
      <label className="slowmo-speed">
        <span className="slowmo-speed-label">Speed</span>
        <input
          type="range"
          min={SLOW_MO_MIN_SPEED}
          max={SLOW_MO_MAX_SPEED}
          step={0.25}
          value={speed}
          disabled={disabled}
          onChange={(e) => onSpeedChange?.(Number(e.target.value))}
          aria-valuetext={speedWords(speed)}
        />
        <span className="slowmo-speed-value">{speedWords(speed)}</span>
      </label>
      <p className="slowmo-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

/** A mirror's (Go Live viewer, tutor watching) read-only line: what the source's slow-mo is doing. */
export function SlowMoMirrorStatus({ text }) {
  if (!text) return null
  return (
    <p className="slowmo-mirror-status" role="status">
      <span aria-hidden="true">🐢 </span>
      {text}
    </p>
  )
}
