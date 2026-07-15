import React from 'react'
import { COMPONENT_LABELS, COMPONENT_TYPES } from './circuit'

const CONTROL_TYPES = ['slide_switch', 'push_button']

const CHECK_OPTIONS = [
  ['circuit_no_short', 'No short circuit'],
  ['circuit_has_component', 'Part exists'],
  ['circuit_component_powered', 'Part is powered'],
  ['circuit_component_unpowered', 'Part is not powered'],
  ['circuit_control_affects_power', 'Control turns part on/off'],
  ['circuit_path_exists', 'Connection path exists'],
  ['circuit_path_includes', 'Connection path includes part'],
]

const PIN_OPTIONS = {
  battery: ['positive', 'negative'],
  led: ['anode', 'cathode'],
  motor: ['positive', 'negative'],
  buzzer: ['positive', 'negative'],
  resistor: ['a', 'b'],
  push_button: ['a', 'b'],
  slide_switch: ['a', 'b'],
  potentiometer: ['left', 'wiper', 'right'],
  terminal: ['pin'],
}

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

function skeleton(type) {
  if (type === 'circuit_no_short') return { type }
  if (type === 'circuit_has_component') return { type, component: part('led'), minCount: '1' }
  if (type === 'circuit_component_powered') return { type, component: part('motor') }
  if (type === 'circuit_component_unpowered') return { type, component: part('motor') }
  if (type === 'circuit_control_affects_power') {
    return { type, control: part('slide_switch'), component: part('motor') }
  }
  if (type === 'circuit_path_includes') {
    return {
      type,
      from: endpoint('battery', 'positive'),
      to: endpoint('motor', 'positive'),
      includes: part('slide_switch'),
    }
  }
  return { type, from: endpoint('battery', 'positive'), to: endpoint('motor', 'positive') }
}

function componentTypeOptions(types = COMPONENT_TYPES) {
  return types.map(type => (
    <option key={type} value={type}>{COMPONENT_LABELS[type] ?? type}</option>
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
        onChange={e => onChange({ ...value, type: e.target.value })}
      >
        {componentTypeOptions(types)}
      </select>
      <input
        className="te-input"
        value={value.label ?? ''}
        onChange={e => onChange({ ...value, label: e.target.value })}
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
        onChange={e => {
          const nextType = e.target.value
          onChange({ ...value, type: nextType, pin: PIN_OPTIONS[nextType]?.[0] ?? 'a' })
        }}
      >
        {componentTypeOptions()}
      </select>
      <select
        className="te-select"
        value={selectedPin}
        onChange={e => onChange({ ...value, pin: e.target.value })}
      >
        {pins.map(pin => <option key={pin} value={pin}>{pin}</option>)}
      </select>
      <input
        className="te-input"
        value={value.label ?? ''}
        onChange={e => onChange({ ...value, label: e.target.value })}
        placeholder="Optional label"
      />
    </div>
  )
}

function CheckFields({ check, onChange }) {
  if (check.type === 'circuit_no_short') {
    return <div style={s.help}>Passes when no battery has its positive and negative sides directly connected.</div>
  }

  if (check.type === 'circuit_has_component') {
    return (
      <>
        <ComponentSelector title="Part" value={check.component} onChange={component => onChange({ ...check, component })} />
        <div style={s.fieldGroup}>
          <label style={s.label}>Minimum</label>
          <input
            className="te-input"
            type="number"
            min="1"
            value={check.minCount ?? '1'}
            onChange={e => onChange({ ...check, minCount: e.target.value })}
          />
        </div>
      </>
    )
  }

  if (check.type === 'circuit_component_powered' || check.type === 'circuit_component_unpowered') {
    return <ComponentSelector title="Part" value={check.component} onChange={component => onChange({ ...check, component })} />
  }

  if (check.type === 'circuit_control_affects_power') {
    return (
      <>
        <ComponentSelector title="Control" value={check.control} onChange={control => onChange({ ...check, control })} types={CONTROL_TYPES} />
        <ComponentSelector title="Controlled part" value={check.component} onChange={component => onChange({ ...check, component })} />
      </>
    )
  }

  if (check.type === 'circuit_path_exists') {
    return (
      <>
        <EndpointSelector title="From" value={check.from} onChange={from => onChange({ ...check, from })} />
        <EndpointSelector title="To" value={check.to} onChange={to => onChange({ ...check, to })} />
      </>
    )
  }

  if (check.type === 'circuit_path_includes') {
    return (
      <>
        <EndpointSelector title="From" value={check.from} onChange={from => onChange({ ...check, from })} />
        <EndpointSelector title="To" value={check.to} onChange={to => onChange({ ...check, to })} />
        <ComponentSelector title="Must include" value={check.includes} onChange={includes => onChange({ ...check, includes })} />
      </>
    )
  }

  return null
}

export default function CheckEditor({ task, onUpdate }) {
  const checks = normalize(task.check)

  function setChecks(next) {
    onUpdate({ ...task, check: next.length ? next : null, _checkTested: false })
  }

  function updateCheck(index, updated) {
    setChecks(checks.map((check, i) => i === index ? updated : check))
  }

  return (
    <div style={s.wrap}>
      {checks.map((check, index) => {
        const knownType = CHECK_OPTIONS.some(([value]) => value === check.type)
        const activeCheck = knownType ? check : skeleton('circuit_no_short')
        return (
          <div key={index} style={s.card}>
            {checks.length > 1 && <span style={s.index}>#{index + 1}</span>}
            <select
              className="te-select"
              value={activeCheck.type}
              onChange={e => updateCheck(index, skeleton(e.target.value))}
            >
              {CHECK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <CheckFields check={activeCheck} onChange={updated => updateCheck(index, updated)} />
            <input
              className="te-input"
              style={s.hint}
              placeholder="Hint"
              value={activeCheck.hint ?? ''}
              onChange={e => updateCheck(index, { ...activeCheck, hint: e.target.value })}
            />
            <button type="button" className="btn-ghost" onClick={() => setChecks(checks.filter((_, i) => i !== index))}>Remove</button>
          </div>
        )
      })}
      <button type="button" className="btn-ghost" onClick={() => setChecks([...checks, skeleton('circuit_no_short')])}>+ Add electronics check</button>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'grid', gridTemplateColumns: 'auto repeat(auto-fit, minmax(160px, 1fr)) auto', gap: 8, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', alignItems: 'start' },
  index: { alignSelf: 'center', fontFamily: 'var(--font-body)', fontSize: 12, color: '#64748b', fontWeight: 700 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  label: { fontFamily: 'var(--font-body)', fontSize: 12, color: '#475569', fontWeight: 700 },
  help: { fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.4, color: '#475569' },
  hint: { gridColumn: '1 / -1' },
}
