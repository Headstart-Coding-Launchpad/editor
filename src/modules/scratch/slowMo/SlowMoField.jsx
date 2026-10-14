import { SLOW_MO_TIMELINE_FIELDS } from './config.js'
import { SLOW_MO_DEFAULT_SPEED, SLOW_MO_MAX_SPEED, SLOW_MO_MIN_SPEED } from './gate.js'

const FIELD_LABELS = {
  costume: 'Costume',
  backdrop: 'Backdrop',
  x: 'x',
  y: 'y',
  variables: 'Variables',
}

/**
 * Builder control for a Scratch task's `slowMo` (docs/authoring/scratch.md "Slow-mo"): the
 * on/off switch, the starting speed and which fields the timeline shows.
 */
export default function SlowMoField({ task, onUpdate }) {
  const config = task?.slowMo ?? null
  const enabled = config?.enabled === true
  const timeline = Array.isArray(config?.timeline) ? config.timeline : [...SLOW_MO_TIMELINE_FIELDS]

  function update(patch) {
    onUpdate({ ...task, slowMo: { ...(config ?? {}), enabled: true, ...patch } })
  }

  function toggleField(field, on) {
    const next = SLOW_MO_TIMELINE_FIELDS.filter((f) => (f === field ? on : timeline.includes(f)))
    update({ timeline: next })
  }

  return (
    <div style={s.wrap}>
      <label style={s.toggle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onUpdate({
              ...task,
              slowMo: e.target.checked
                ? { enabled: true, speed: config?.speed ?? SLOW_MO_DEFAULT_SPEED, timeline }
                : undefined,
            })
          }
        />
        <span style={{ fontWeight: 600 }}>
          Slow-mo: Slow-mo, Pause, Step and Restart buttons, a glow on the running block and a
          timeline of each step
        </span>
      </label>
      {enabled && (
        <div style={s.inner}>
          <label style={s.row}>
            <span>Starting speed (blocks a second)</span>
            <input
              type="number"
              className="te-input"
              style={s.number}
              min={SLOW_MO_MIN_SPEED}
              max={SLOW_MO_MAX_SPEED}
              step={0.25}
              value={config?.speed ?? SLOW_MO_DEFAULT_SPEED}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (Number.isFinite(value) && value > 0) update({ speed: value })
              }}
            />
          </label>
          <div style={s.row} role="group" aria-label="Timeline shows">
            <span>Timeline shows</span>
            {SLOW_MO_TIMELINE_FIELDS.map((field) => (
              <label key={field} style={s.chip}>
                <input
                  type="checkbox"
                  checked={timeline.includes(field)}
                  onChange={(e) => toggleField(field, e.target.checked)}
                />
                {FIELD_LABELS[field]}
              </label>
            ))}
          </div>
          <p style={s.help}>
            Students can still press the green flag for a normal run. Untick every field to hide the
            timeline.
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
  number: { width: 80 },
  chip: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' },
  help: { margin: 0, fontSize: '0.78rem', color: '#6b7280' },
}
