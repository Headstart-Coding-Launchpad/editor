import {
  PYTHON_SLOW_MO_CAP_MESSAGE,
  PYTHON_SLOW_MO_MAX_SPEED,
  PYTHON_SLOW_MO_MIN_SPEED,
} from './config.js'
import './slowMo.css'

function speedWords(speed) {
  const n = Math.round(speed * 100) / 100
  return n === 1 ? '1 step a second' : `${n} steps a second`
}

function statusWords(slowMo) {
  const { view, mode, pending, throughRun } = slowMo
  if (pending) return 'Recording your program… answer any questions it asks.'
  if (!view && throughRun) return 'Press Run to watch your program one line at a time.'
  if (!view)
    return 'Press Slow-mo to watch your program one line at a time, or Step to go line by line.'
  if (view.count === 0) return 'There were no lines to step through.'
  const where =
    view.position === 0 ? 'Ready' : `Step ${view.position} of ${view.count} · line ${view.line}`
  if (mode === 'playing') return `Playing · ${where}`
  if (view.finished) return `Finished · ${view.count} ${view.count === 1 ? 'step' : 'steps'}`
  return `Paused · ${where}`
}

function ControlButton({ icon, word, title, onClick, disabled, pressed }) {
  return (
    <button
      type="button"
      className="py-slowmo-btn"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      <span className="py-slowmo-btn-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="py-slowmo-btn-word">{word}</span>
    </button>
  )
}

/**
 * The Run button's words on a task where Run plays the run in slow-mo (slowMoThroughRun):
 * "▶ Run (slow-mo)", the ▶ hidden from screen readers.
 */
export function SlowMoRunLabel() {
  return (
    <>
      <span aria-hidden="true">▶ </span>Run (slow-mo)
    </>
  )
}

/**
 * Python slow-mo's controls (src/modules/python/slowMo/usePythonSlowMo.js): Pause, Step, Step
 * back, Restart and Finish (44px+ buttons, an icon and a word each), the speed slider, the
 * task's question while paused, and a live region that reads out each step (the line and the
 * variables that changed). A Go Live viewer gets the status and question only: the presenter's
 * buttons drive their screen.
 *
 * Two layouts:
 * - `throughRun` (the default): the workspace's Run starts slow-mo, so there's no Slow-mo
 *   button. The step buttons show once a run is playing or paused, Pause turning into ▶ Play
 *   (carry on) while paused; before that only the speed slider and the status show.
 * - `separateButton: true`: 🐢 Slow-mo beside the step buttons, all shown from the start, and
 *   Run runs normally.
 */
export default function SlowMoBar({ slowMo, runDisabled = false }) {
  if (!slowMo?.config) return null
  const { view, mode, pending, isViewer, config, throughRun } = slowMo
  if (isViewer && !view) return null
  const playing = mode === 'playing'
  const hasRecording = !!view
  const atStart = !view || view.position === 0
  const finished = hasRecording && view.finished
  const busy = pending || runDisabled
  const showQuestion =
    !!config.question && hasRecording && !playing && view.position > 0 && view.count > 0
  const showButtons = !throughRun || hasRecording

  return (
    <div className="py-slowmo" role="group" aria-label="Slow-mo">
      {!isViewer && (
        <div className="py-slowmo-row">
          {showButtons && (
            <div className="py-slowmo-buttons">
              {!throughRun && (
                <ControlButton
                  icon="🐢"
                  word="Slow-mo"
                  title="Run your program slowly, one line at a time"
                  pressed={playing}
                  disabled={busy || playing}
                  onClick={slowMo.slowMo}
                />
              )}
              {throughRun && !playing ? (
                // Paused (or finished): the same button carries on (or plays again from the start).
                <ControlButton
                  icon="▶"
                  word="Play"
                  title={finished ? 'Play it again from the start' : 'Carry on playing from here'}
                  disabled={pending}
                  onClick={slowMo.slowMo}
                />
              ) : (
                <ControlButton
                  icon="⏸"
                  word="Pause"
                  title="Stop on this line"
                  disabled={!playing}
                  onClick={slowMo.pause}
                />
              )}
              <ControlButton
                icon="👣"
                word="Step"
                title="Run just the next line"
                disabled={(throughRun ? pending : busy) || finished}
                onClick={slowMo.step}
              />
              <ControlButton
                icon="↩"
                word="Step back"
                title="Go back one line"
                disabled={!hasRecording || atStart}
                onClick={slowMo.back}
              />
              <ControlButton
                icon="⏮"
                word="Restart"
                title="Back to before the first line"
                disabled={!hasRecording || atStart}
                onClick={slowMo.restart}
              />
              <ControlButton
                icon="⏭"
                word="Finish"
                title="Skip to the end of the run"
                disabled={!hasRecording || finished}
                onClick={slowMo.finish}
              />
            </div>
          )}
          <label className="py-slowmo-speed">
            <span className="py-slowmo-speed-label">Speed</span>
            <input
              type="range"
              min={PYTHON_SLOW_MO_MIN_SPEED}
              max={PYTHON_SLOW_MO_MAX_SPEED}
              step={0.25}
              value={slowMo.speed}
              onChange={(event) => slowMo.setSpeed(Number(event.target.value))}
              aria-valuetext={speedWords(slowMo.speed)}
            />
            <span className="py-slowmo-speed-value">{speedWords(slowMo.speed)}</span>
          </label>
        </div>
      )}
      <p className="py-slowmo-status">
        <span aria-hidden="true">🐢 </span>
        {isViewer ? `Slow-mo · ${statusWords(slowMo)}` : statusWords(slowMo)}
      </p>
      {view?.status === 'capped' && (
        <p className="py-slowmo-note" role="note">
          {PYTHON_SLOW_MO_CAP_MESSAGE}
        </p>
      )}
      {view?.varsDropped && (
        <p className="py-slowmo-note">
          The variables were too big to send, so only the lines show.
        </p>
      )}
      {showQuestion && (
        <p className="py-slowmo-question">
          <span aria-hidden="true">🤔 </span>
          {config.question}
        </p>
      )}
      {/* What each step did, in words (the editor band and tags are visual). */}
      <p className="py-slowmo-sr" role="status" aria-live="polite">
        {view && (!playing || slowMo.speed <= 1) ? view.description : ''}
      </p>
    </div>
  )
}
