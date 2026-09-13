import React from 'react'
import { TURTLE_COMMAND_NAMES } from './checks.js'
import { CheckFeedbackControls } from '../../builder/components/task-editor/CheckEditors'

const CHECK_OPTIONS = [
  ['turtle_position', 'Final position'],
  ['turtle_heading', 'Final heading'],
  ['turtle_path_closed', 'Path forms a closed shape'],
  ['turtle_segment_count', 'Number of lines drawn'],
  ['turtle_path_length', 'Total path length'],
  ['turtle_command_used', 'Command used'],
  ['turtle_color_used', 'Colour used'],
  ['turtle_stamp_count', 'Number of stamps'],
]

const COMMAND_LABELS = {
  forward: 'Move forward/backward',
  backward: 'Move forward/backward',
  turn: 'Turn (left/right)',
  goto: 'Move to position (goto)',
  setheading: 'Set heading',
  home: 'Return home',
  reset: 'Reset/clear',
  penup: 'Lift pen (penup)',
  pendown: 'Lower pen (pendown)',
  pencolor: 'Change pen colour',
  fillcolor: 'Change fill colour',
  bgcolor: 'Change background colour',
  beginfill: 'Start filling (begin_fill)',
  endfill: 'Finish filling (end_fill)',
  circle: 'Draw a circle',
  stamp: 'Stamp',
  write: 'Write text',
}

const NUMBER_OPERATORS = [
  ['greater_than_or_equal', 'at least'],
  ['equals', 'exactly'],
  ['less_than_or_equal', 'at most'],
  ['greater_than', 'more than'],
  ['less_than', 'less than'],
  ['not_equals', 'not'],
]

function normalize(checks) {
  if (!checks) return []
  return Array.isArray(checks) ? checks : [checks]
}

function preserveFeedbackMeta(prev = {}) {
  return {
    ...(prev.hint ? { hint: prev.hint } : {}),
    ...(prev.mode ? { mode: prev.mode } : {}),
    ...(prev.show ? { show: prev.show } : {}),
  }
}

function skeleton(type, prev = {}) {
  const meta = preserveFeedbackMeta(prev)
  if (type === 'turtle_position') return { type, x: '0', y: '0', tolerance: '2', ...meta }
  if (type === 'turtle_heading') return { type, value: '0', tolerance: '2', ...meta }
  if (type === 'turtle_path_closed') return { type, tolerance: '2', ...meta }
  if (type === 'turtle_segment_count')
    return { type, operator: 'greater_than_or_equal', value: '1', ...meta }
  if (type === 'turtle_path_length')
    return { type, operator: 'greater_than_or_equal', value: '100', ...meta }
  if (type === 'turtle_command_used') return { type, command: 'forward', minCount: '1', ...meta }
  if (type === 'turtle_color_used') return { type, kind: 'pen', color: 'red', ...meta }
  if (type === 'turtle_stamp_count')
    return { type, operator: 'greater_than_or_equal', value: '1', ...meta }
  return { type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1', ...meta }
}

function NumberField({ label, value, onChange, width = 90 }) {
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>{label}</label>
      <input
        className="te-input"
        style={{ width }}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function OperatorSelect({ value, onChange }) {
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>Comparison</label>
      <select className="te-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {NUMBER_OPERATORS.map(([op, label]) => (
          <option key={op} value={op}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

function CheckFields({ check, onChange }) {
  if (check.type === 'turtle_position') {
    return (
      <>
        <NumberField label="X" value={check.x} onChange={(x) => onChange({ ...check, x })} />
        <NumberField label="Y" value={check.y} onChange={(y) => onChange({ ...check, y })} />
        <NumberField
          label="Tolerance"
          value={check.tolerance}
          onChange={(tolerance) => onChange({ ...check, tolerance })}
        />
      </>
    )
  }

  if (check.type === 'turtle_heading') {
    return (
      <>
        <NumberField
          label="Degrees"
          value={check.value}
          onChange={(value) => onChange({ ...check, value })}
        />
        <NumberField
          label="Tolerance"
          value={check.tolerance}
          onChange={(tolerance) => onChange({ ...check, tolerance })}
        />
      </>
    )
  }

  if (check.type === 'turtle_path_closed') {
    return (
      <NumberField
        label="Tolerance"
        value={check.tolerance}
        onChange={(tolerance) => onChange({ ...check, tolerance })}
      />
    )
  }

  if (check.type === 'turtle_segment_count') {
    return (
      <>
        <OperatorSelect
          value={check.operator ?? 'greater_than_or_equal'}
          onChange={(operator) => onChange({ ...check, operator })}
        />
        <NumberField
          label="Lines"
          value={check.value}
          onChange={(value) => onChange({ ...check, value })}
        />
      </>
    )
  }

  if (check.type === 'turtle_path_length') {
    return (
      <>
        <OperatorSelect
          value={check.operator ?? 'greater_than_or_equal'}
          onChange={(operator) => onChange({ ...check, operator })}
        />
        <NumberField
          label="Length (units)"
          value={check.value}
          onChange={(value) => onChange({ ...check, value })}
          width={110}
        />
      </>
    )
  }

  if (check.type === 'turtle_command_used') {
    return (
      <>
        <div style={s.fieldGroup}>
          <label style={s.label}>Command</label>
          <select
            className="te-select"
            value={check.command ?? 'forward'}
            onChange={(e) => onChange({ ...check, command: e.target.value })}
          >
            {TURTLE_COMMAND_NAMES.map((name) => (
              <option key={name} value={name}>
                {COMMAND_LABELS[name] ?? name}
              </option>
            ))}
          </select>
        </div>
        <NumberField
          label="Minimum times"
          value={check.minCount}
          onChange={(minCount) => onChange({ ...check, minCount })}
        />
      </>
    )
  }

  if (check.type === 'turtle_color_used') {
    return (
      <>
        <div style={s.fieldGroup}>
          <label style={s.label}>Which colour</label>
          <select
            className="te-select"
            value={check.kind ?? 'pen'}
            onChange={(e) => onChange({ ...check, kind: e.target.value })}
          >
            <option value="pen">Pen colour</option>
            <option value="fill">Fill colour</option>
          </select>
        </div>
        <div style={s.fieldGroup}>
          <label style={s.label}>Colour</label>
          <input
            className="te-input"
            style={{ width: 120 }}
            value={check.color ?? ''}
            onChange={(e) => onChange({ ...check, color: e.target.value })}
            placeholder="e.g. red, #ff0000"
          />
        </div>
      </>
    )
  }

  if (check.type === 'turtle_stamp_count') {
    return (
      <>
        <OperatorSelect
          value={check.operator ?? 'greater_than_or_equal'}
          onChange={(operator) => onChange({ ...check, operator })}
        />
        <NumberField
          label="Stamps"
          value={check.value}
          onChange={(value) => onChange({ ...check, value })}
        />
      </>
    )
  }

  return null
}

export default function CheckEditor({
  task,
  onUpdate,
  checks: checksProp,
  onChange,
  feedbackEditor = false,
}) {
  const checks = normalize(checksProp ?? task.check)

  function setChecks(next) {
    if (onChange) onChange(next.length ? next : null)
    else onUpdate({ ...task, check: next.length ? next : null, _checkTested: false })
  }

  function updateCheck(index, updated) {
    setChecks(checks.map((check, i) => (i === index ? updated : check)))
  }

  return (
    <div style={s.wrap}>
      {checks.map((check, index) => {
        const knownType = CHECK_OPTIONS.some(([value]) => value === check.type)
        const activeCheck = knownType ? check : skeleton('turtle_segment_count')
        return (
          <div key={index} style={s.card}>
            {checks.length > 1 && <span style={s.index}>#{index + 1}</span>}
            <select
              className="te-select"
              value={activeCheck.type}
              onChange={(e) => updateCheck(index, skeleton(e.target.value, activeCheck))}
            >
              {CHECK_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <CheckFields check={activeCheck} onChange={(updated) => updateCheck(index, updated)} />
            {feedbackEditor && (
              <CheckFeedbackControls
                check={activeCheck}
                style={s.feedbackControls}
                onChange={(updated) => updateCheck(index, updated)}
              />
            )}
            <input
              className="te-input"
              style={s.hint}
              placeholder="Hint"
              value={activeCheck.hint ?? ''}
              onChange={(e) => updateCheck(index, { ...activeCheck, hint: e.target.value })}
            />
            <button
              type="button"
              className="te-check-remove-btn"
              onClick={() => setChecks(checks.filter((_, i) => i !== index))}
              title="Remove check"
            >
              ×
            </button>
          </div>
        )
      })}
      <button
        type="button"
        className="btn-ghost te-add-check-btn"
        onClick={() =>
          setChecks([
            ...checks,
            skeleton(
              'turtle_segment_count',
              feedbackEditor ? { mode: 'blocking', show: 'after_attempt' } : {}
            ),
          ])
        }
      >
        + Add turtle check
      </button>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'grid',
    gridTemplateColumns: 'auto repeat(auto-fit, minmax(140px, 1fr)) auto',
    gap: 8,
    padding: 10,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    alignItems: 'start',
  },
  index: {
    alignSelf: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: '#64748b',
    fontWeight: 700,
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  label: { fontFamily: 'var(--font-body)', fontSize: 12, color: '#475569', fontWeight: 700 },
  feedbackControls: { gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' },
  hint: { gridColumn: '1 / -1' },
}
