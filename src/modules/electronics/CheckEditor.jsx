import React from 'react'
import { COMPONENT_LABELS, COMPONENT_PINS, COMPONENT_TYPES } from './circuit'
import {
  subjectOpFromCheck,
  getAspectOptions,
  getOperatorOptions,
  defaultOperatorForAspect,
  checkFromSubjectOp,
} from '../../builder/components/task-editor/check-editors/checkEditorUtils'
import { CheckValueEditor } from '../../builder/components/task-editor/CheckEditors'

// Matches controlAffectsComponentPower's own control-type filter in circuit.js.
const CONTROL_TYPES = ['slide_switch', 'push_button', 'transistor']

// Generic code checks — shared with Python/HTML/Arcade via `evaluateCodeCheck`
// (see modules/checks.js and modules/electronics/circuit.js). Evaluated against
// the circuit's Micro Controller MicroPython source, not the raw circuit.
const CODE_CHECK_TYPES = [
  'code',
  'code_contains',
  'code_does_not_contain',
  'code_not_contains',
  'code_equals',
  'code_not_equals',
  'code_matches_regex',
  'code_not_matches_regex',
]

const CHECK_OPTIONS = [
  ['circuit_no_short', 'No short circuit'],
  ['circuit_has_component', 'Part exists'],
  ['circuit_component_powered', 'Part is powered'],
  ['circuit_component_unpowered', 'Part is not powered'],
  ['circuit_control_affects_power', 'Control turns part on/off'],
  ['circuit_path_exists', 'Connection path exists'],
  ['circuit_path_includes', 'Connection path includes part'],
]

const SUBJECT_OPTIONS = [
  { value: 'safety', label: 'Safety' },
  { value: 'part', label: 'Part' },
  { value: 'control', label: 'Control' },
  { value: 'connection', label: 'Connection' },
  { value: 'code', label: 'Code' },
]

function uiFromCheck(check) {
  if (check.type === 'circuit_has_component')
    return { subject: 'part', aspect: 'presence', operator: 'exists' }
  if (check.type === 'circuit_component_powered')
    return { subject: 'part', aspect: 'power', operator: 'powered' }
  if (check.type === 'circuit_component_unpowered')
    return { subject: 'part', aspect: 'power', operator: 'unpowered' }
  if (check.type === 'circuit_control_affects_power')
    return { subject: 'control', aspect: 'effect', operator: 'affects_power' }
  if (check.type === 'circuit_path_exists')
    return { subject: 'connection', aspect: 'path', operator: 'exists' }
  if (check.type === 'circuit_path_includes')
    return { subject: 'connection', aspect: 'path', operator: 'includes' }
  if (CODE_CHECK_TYPES.includes(check.type)) {
    const { operator } = subjectOpFromCheck(check)
    return { subject: 'code', aspect: 'source', operator }
  }
  return { subject: 'safety', aspect: 'short', operator: 'no_short' }
}

function aspectOptions(subject) {
  if (subject === 'part')
    return [
      { value: 'presence', label: 'Presence' },
      { value: 'power', label: 'Power' },
    ]
  if (subject === 'control') return [{ value: 'effect', label: 'Effect' }]
  if (subject === 'connection') return [{ value: 'path', label: 'Path' }]
  if (subject === 'code') return getAspectOptions('code')
  return [{ value: 'short', label: 'Short circuit' }]
}

function defaultAspect(subject) {
  return aspectOptions(subject)[0]?.value ?? 'short'
}

function defaultOperator(subject, aspect) {
  if (subject === 'part' && aspect === 'power') return 'powered'
  if (subject === 'part') return 'exists'
  if (subject === 'control') return 'affects_power'
  if (subject === 'connection') return 'exists'
  if (subject === 'code') return defaultOperatorForAspect('code', aspect)
  return 'no_short'
}

function operatorOptions(subject, aspect) {
  if (subject === 'part' && aspect === 'power')
    return [
      { value: 'powered', label: 'is powered' },
      { value: 'unpowered', label: 'is not powered' },
    ]
  if (subject === 'part') return [{ value: 'exists', label: 'exists' }]
  if (subject === 'control') return [{ value: 'affects_power', label: 'turns part on/off' }]
  if (subject === 'connection')
    return [
      { value: 'exists', label: 'path exists' },
      { value: 'includes', label: 'path includes part' },
    ]
  if (subject === 'code') return getOperatorOptions('code', null, aspect)
  return [{ value: 'no_short', label: 'has no short' }]
}

function typeFromUi(subject, aspect, operator) {
  if (subject === 'part' && aspect === 'presence') return 'circuit_has_component'
  if (subject === 'part' && operator === 'unpowered') return 'circuit_component_unpowered'
  if (subject === 'part' && aspect === 'power') return 'circuit_component_powered'
  if (subject === 'control') return 'circuit_control_affects_power'
  if (subject === 'connection' && operator === 'includes') return 'circuit_path_includes'
  if (subject === 'connection') return 'circuit_path_exists'
  return 'circuit_no_short'
}

// Sourced from circuit.js's COMPONENT_PINS — the simulator's own pin table — instead of a
// second, hand-copied list, so adding a component type there can't silently leave check
// authoring unable to target its real pins (previously six types, including transistor,
// diode, sensor, servo_motor, rgb_led, and microcontroller, fell back to a generic ['a','b']
// here even though none of them actually have pins named 'a'/'b').
const PIN_OPTIONS = COMPONENT_PINS

function normalize(checks) {
  if (!checks) return []
  return Array.isArray(checks) ? checks : [checks]
}

function part(type, label = '') {
  return { type, ...(label ? { label } : {}) }
}

function endpoint(type, pin) {
  return { type, pin }
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
  if (type === 'circuit_no_short') return { type, ...meta }
  if (type === 'circuit_has_component')
    return { type, component: part('led'), minCount: '1', ...meta }
  if (type === 'circuit_component_powered') return { type, component: part('motor'), ...meta }
  if (type === 'circuit_component_unpowered') return { type, component: part('motor'), ...meta }
  if (type === 'circuit_control_affects_power') {
    return { type, control: part('slide_switch'), component: part('motor'), ...meta }
  }
  if (type === 'circuit_path_includes') {
    return {
      type,
      from: endpoint('battery', 'positive'),
      to: endpoint('motor', 'positive'),
      includes: part('slide_switch'),
      ...meta,
    }
  }
  return { type, from: endpoint('battery', 'positive'), to: endpoint('motor', 'positive'), ...meta }
}

function componentTypeOptions(types = COMPONENT_TYPES) {
  return types.map((type) => (
    <option key={type} value={type}>
      {COMPONENT_LABELS[type] ?? type}
    </option>
  ))
}

function pinOptions(type, current) {
  const options = PIN_OPTIONS[type] ?? ['a', 'b']
  return current && !options.includes(current) ? [...options, current] : options
}

function ComponentSelector({ title, value = {}, onChange, types = COMPONENT_TYPES }) {
  const selectedType = value.type && types.includes(value.type) ? value.type : types[0]
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>{title}</label>
      <select
        className="te-select"
        value={selectedType}
        onChange={(e) => onChange({ ...value, type: e.target.value })}
      >
        {componentTypeOptions(types)}
      </select>
      <input
        className="te-input"
        value={value.label ?? ''}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        placeholder="Optional label"
      />
    </div>
  )
}

function EndpointSelector({ title, value = {}, onChange }) {
  const selectedType = value.type && COMPONENT_TYPES.includes(value.type) ? value.type : 'battery'
  const pins = pinOptions(selectedType, value.pin)
  const selectedPin = value.pin && pins.includes(value.pin) ? value.pin : pins[0]
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>{title}</label>
      <select
        className="te-select"
        value={selectedType}
        onChange={(e) => {
          const nextType = e.target.value
          onChange({ ...value, type: nextType, pin: PIN_OPTIONS[nextType]?.[0] ?? 'a' })
        }}
      >
        {componentTypeOptions()}
      </select>
      <select
        className="te-select"
        value={selectedPin}
        onChange={(e) => onChange({ ...value, pin: e.target.value })}
      >
        {pins.map((pin) => (
          <option key={pin} value={pin}>
            {pin}
          </option>
        ))}
      </select>
      <input
        className="te-input"
        value={value.label ?? ''}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        placeholder="Optional label"
      />
    </div>
  )
}

function CheckFields({ check, onChange }) {
  if (check.type === 'circuit_no_short') {
    return (
      <div style={s.help}>
        Passes when no battery has its positive and negative sides directly connected.
      </div>
    )
  }

  if (check.type === 'circuit_has_component') {
    return (
      <>
        <ComponentSelector
          title="Part"
          value={check.component}
          onChange={(component) => onChange({ ...check, component })}
        />
        <div style={s.fieldGroup}>
          <label style={s.label}>Minimum</label>
          <input
            className="te-input"
            type="number"
            min="1"
            value={check.minCount ?? '1'}
            onChange={(e) => onChange({ ...check, minCount: e.target.value })}
          />
        </div>
      </>
    )
  }

  if (check.type === 'circuit_component_powered' || check.type === 'circuit_component_unpowered') {
    return (
      <ComponentSelector
        title="Part"
        value={check.component}
        onChange={(component) => onChange({ ...check, component })}
      />
    )
  }

  if (check.type === 'circuit_control_affects_power') {
    return (
      <>
        <ComponentSelector
          title="Control"
          value={check.control}
          onChange={(control) => onChange({ ...check, control })}
          types={CONTROL_TYPES}
        />
        <ComponentSelector
          title="Controlled part"
          value={check.component}
          onChange={(component) => onChange({ ...check, component })}
        />
      </>
    )
  }

  if (check.type === 'circuit_path_exists') {
    return (
      <>
        <EndpointSelector
          title="From"
          value={check.from}
          onChange={(from) => onChange({ ...check, from })}
        />
        <EndpointSelector
          title="To"
          value={check.to}
          onChange={(to) => onChange({ ...check, to })}
        />
      </>
    )
  }

  if (check.type === 'circuit_path_includes') {
    return (
      <>
        <EndpointSelector
          title="From"
          value={check.from}
          onChange={(from) => onChange({ ...check, from })}
        />
        <EndpointSelector
          title="To"
          value={check.to}
          onChange={(to) => onChange({ ...check, to })}
        />
        <ComponentSelector
          title="Must include"
          value={check.includes}
          onChange={(includes) => onChange({ ...check, includes })}
        />
      </>
    )
  }

  if (CODE_CHECK_TYPES.includes(check.type)) {
    const { operator } = subjectOpFromCheck(check)
    return <CheckValueEditor check={check} subject="code" operator={operator} onChange={onChange} />
  }

  return null
}

function FeedbackControls({ check, onChange }) {
  return (
    <div style={s.feedbackControls}>
      <select
        className="te-select"
        value={check.mode ?? 'blocking'}
        onChange={(e) => onChange({ ...check, mode: e.target.value })}
        title="Feedback behaviour"
      >
        <option value="blocking">Blocking</option>
        <option value="nudge">Nudge</option>
      </select>
      <select
        className="te-select"
        value={check.show === 'on_pause' ? 'on_idle' : (check.show ?? 'after_attempt')}
        onChange={(e) => onChange({ ...check, show: e.target.value })}
        title="When to show feedback"
      >
        <option value="after_attempt">After attempt</option>
        <option value="on_idle">On idle</option>
      </select>
    </div>
  )
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

  function updateFromUi(index, subject, aspect, operator, prev) {
    if (subject === 'code') {
      updateCheck(index, checkFromSubjectOp('code', operator, prev))
      return
    }
    updateCheck(index, skeleton(typeFromUi(subject, aspect, operator), prev))
  }

  return (
    <div style={s.wrap}>
      {checks.map((check, index) => {
        const knownType =
          CHECK_OPTIONS.some(([value]) => value === check.type) ||
          CODE_CHECK_TYPES.includes(check.type)
        const activeCheck = knownType ? check : skeleton('circuit_no_short')
        const ui = uiFromCheck(activeCheck)
        const aspects = aspectOptions(ui.subject)
        const operators = operatorOptions(ui.subject, ui.aspect)
        return (
          <div key={index} style={s.card}>
            {checks.length > 1 && <span style={s.index}>#{index + 1}</span>}
            <select
              className="te-select"
              value={ui.subject}
              onChange={(e) => {
                const nextSubject = e.target.value
                const nextAspect = defaultAspect(nextSubject)
                updateFromUi(
                  index,
                  nextSubject,
                  nextAspect,
                  defaultOperator(nextSubject, nextAspect),
                  activeCheck
                )
              }}
            >
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="te-select"
              value={ui.aspect}
              onChange={(e) => {
                const nextAspect = e.target.value
                updateFromUi(
                  index,
                  ui.subject,
                  nextAspect,
                  defaultOperator(ui.subject, nextAspect),
                  activeCheck
                )
              }}
            >
              {aspects.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="te-select"
              value={ui.operator}
              onChange={(e) =>
                updateFromUi(index, ui.subject, ui.aspect, e.target.value, activeCheck)
              }
            >
              {operators.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <CheckFields check={activeCheck} onChange={(updated) => updateCheck(index, updated)} />
            {feedbackEditor && (
              <FeedbackControls
                check={activeCheck}
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
              'circuit_no_short',
              feedbackEditor ? { mode: 'blocking', show: 'after_attempt' } : {}
            ),
          ])
        }
      >
        + Add electronics check
      </button>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'grid',
    gridTemplateColumns: 'auto repeat(auto-fit, minmax(160px, 1fr)) auto',
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
  help: { fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, color: '#475569' },
  feedbackControls: { gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' },
  hint: { gridColumn: '1 / -1' },
}
