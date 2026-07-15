import React from 'react'

const CHECK_OPTIONS = [
  ['circuit_no_short', 'No short circuit'],
  ['circuit_component_exists', 'Component exists'],
  ['circuit_connected', 'Pins connected'],
  ['circuit_not_connected', 'Pins not connected'],
  ['circuit_component_state', 'Component state'],
  ['circuit_pin_value', 'Pin/control value'],
]

function normalize(checks) {
  if (!checks) return []
  return Array.isArray(checks) ? checks : [checks]
}

function skeleton(type) {
  if (type === 'circuit_no_short') return { type }
  if (type === 'circuit_component_exists') return { type, componentType: '', id: '' }
  if (type === 'circuit_component_state') return { type, componentId: '', property: 'on', value: 'true' }
  if (type === 'circuit_pin_value') return { type, componentId: '', pin: 'value', value: '' }
  return { type, from: '', to: '' }
}

export default function CheckEditor({ task, onUpdate }) {
  const checks = normalize(task.check)
  function setChecks(next) {
    onUpdate({ ...task, check: next.length ? next : null, _checkTested: false })
  }
  return (
    <div style={s.wrap}>
      {checks.map((check, index) => (
        <div key={index} style={s.card}>
          <select value={check.type} onChange={e => {
            const next = [...checks]
            next[index] = skeleton(e.target.value)
            setChecks(next)
          }}>
            {CHECK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {check.type === 'circuit_component_exists' && (
            <>
              <input placeholder="Component type, e.g. led" value={check.componentType ?? check.typeName ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, type: check.type, componentType: e.target.value }; setChecks(next) }} />
              <input placeholder="Optional id" value={check.id ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, id: e.target.value }; setChecks(next) }} />
            </>
          )}
          {(check.type === 'circuit_connected' || check.type === 'circuit_not_connected') && (
            <>
              <input placeholder="From pin, e.g. battery1.positive" value={check.from ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, from: e.target.value }; setChecks(next) }} />
              <input placeholder="To pin, e.g. led1.anode" value={check.to ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, to: e.target.value }; setChecks(next) }} />
            </>
          )}
          {check.type === 'circuit_component_state' && (
            <>
              <input placeholder="Component id" value={check.componentId ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, componentId: e.target.value }; setChecks(next) }} />
              <input placeholder="Property, e.g. on" value={check.property ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, property: e.target.value }; setChecks(next) }} />
              <input placeholder="Value" value={check.value ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, value: e.target.value }; setChecks(next) }} />
            </>
          )}
          {check.type === 'circuit_pin_value' && (
            <>
              <input placeholder="Component id" value={check.componentId ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, componentId: e.target.value }; setChecks(next) }} />
              <input placeholder="Pin/control" value={check.pin ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, pin: e.target.value }; setChecks(next) }} />
              <input placeholder="Value" value={check.value ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, value: e.target.value }; setChecks(next) }} />
            </>
          )}
          <input placeholder="Hint" value={check.hint ?? ''} onChange={e => { const next = [...checks]; next[index] = { ...check, hint: e.target.value }; setChecks(next) }} />
          <button type="button" className="btn-ghost" onClick={() => setChecks(checks.filter((_, i) => i !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => setChecks([...checks, skeleton('circuit_no_short')])}>+ Add electronics check</button>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc' },
}
