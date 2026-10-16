import { useEffect, useState } from 'react'
import {
  PYTHON_SLOW_MO_DEFAULT_SPEED,
  PYTHON_SLOW_MO_MAX_SPEED,
  PYTHON_SLOW_MO_MIN_SPEED,
} from './config.js'

/**
 * Builder control for a Python or Turtle task's `slowMo` (docs/authoring/python.md "Slow-mo"):
 * the on/off switch, the starting speed, step-by-step name tags, the question shown while
 * paused, and a separate Slow-mo button (separateButton) instead of Run playing in slow-mo. The
 * question keeps its own draft and saves on blur.
 */
export default function PythonSlowMoField({ task, onUpdate }) {
  const config = task?.slowMo ?? null
  const enabled = config?.enabled === true
  const [question, setQuestion] = useState(config?.question ?? '')

  useEffect(() => {
    setQuestion(task?.slowMo?.question ?? '')
  }, [task?.id, task?.slowMo?.question])

  function update(patch) {
    const next = { ...(config ?? {}), enabled: true, ...patch }
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key]
    onUpdate({ ...task, slowMo: next })
  }

  function setEnabled(on) {
    if (!on) {
      const { slowMo: _removed, ...rest } = task ?? {}
      onUpdate(rest)
      return
    }
    onUpdate({
      ...task,
      slowMo: {
        enabled: true,
        speed: config?.speed ?? PYTHON_SLOW_MO_DEFAULT_SPEED,
        showVariables: config?.showVariables ?? true,
        ...(config?.question ? { question: config.question } : {}),
        ...(config?.separateButton === true ? { separateButton: true } : {}),
      },
    })
  }

  return (
    <div style={s.wrap}>
      <label style={s.toggle}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ fontWeight: 600 }}>
          Slow-mo: Run plays the program back one line at a time, with Pause, Step, Step back,
          Restart and Finish buttons
        </span>
      </label>
      {enabled && (
        <div style={s.inner}>
          <label style={s.row}>
            <span>Starting speed (lines a second)</span>
            <input
              type="number"
              className="te-input"
              style={s.number}
              min={PYTHON_SLOW_MO_MIN_SPEED}
              max={PYTHON_SLOW_MO_MAX_SPEED}
              step={0.25}
              value={config?.speed ?? PYTHON_SLOW_MO_DEFAULT_SPEED}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (Number.isFinite(value) && value > 0) update({ speed: value })
              }}
            />
          </label>
          <label style={s.row}>
            <input
              type="checkbox"
              checked={config?.showVariables === true}
              onChange={(e) => update({ showVariables: e.target.checked })}
            />
            <span>Show name tags for the variables, step by step</span>
          </label>
          <label style={s.column}>
            <span>Question while paused (optional)</span>
            <input
              type="text"
              className="te-input"
              value={question}
              placeholder="e.g. After pass 3, what is total?"
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={() => update({ question: question.trim() || undefined })}
            />
          </label>
          <label style={s.row}>
            <input
              type="checkbox"
              checked={config?.separateButton === true}
              onChange={(e) => update({ separateButton: e.target.checked || undefined })}
            />
            <span>Keep a separate 🐢 Slow-mo button (Run runs the program normally)</span>
          </label>
          <p style={s.help}>
            Pair it with a prediction or a question: students predict first, then watch. Checks work
            the same either way: once, when the run plays to the end or Finish is pressed.
          </p>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    margin: '2px 0 0 24px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
  },
  row: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  column: { display: 'flex', flexDirection: 'column', gap: 4 },
  number: { width: 80 },
  help: { margin: 0, fontSize: '0.78rem', color: '#6b7280' },
}
