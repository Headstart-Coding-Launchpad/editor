import React, { useMemo, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import OutputPanel from '../../app/components/OutputPanel'
import { COMPONENT_TYPES, cloneCircuit, getComponentState, makeComponent, pinRef } from './circuit'

const PALETTE = [
  ['led', 'LED'],
  ['resistor', 'Resistor'],
  ['push_button', 'Button'],
  ['slide_switch', 'Switch'],
  ['potentiometer', 'Pot'],
  ['motor', 'Motor'],
  ['buzzer', 'Buzzer'],
  ['terminal', 'Terminal'],
]

export default function ElectronicsWorkspace({
  circuit,
  onChange,
  readOnly = false,
  showCodeTab = false,
  code = '',
  onCodeChange,
  onCheck,
  onReset,
  output = '',
  runStatus = null,
  checkPassed = false,
  title = 'Breadboard',
}) {
  const [tab, setTab] = useState('breadboard')
  const [selectedId, setSelectedId] = useState(circuit.components[0]?.id ?? null)
  const [wireFrom, setWireFrom] = useState('')
  const [outputCollapsed, setOutputCollapsed] = useState(!showCodeTab)
  const selected = circuit.components.find(c => c.id === selectedId) ?? null
  const stats = useMemo(() => ({
    ledsOn: circuit.components.filter(c => c.type === 'led' && getComponentState(circuit, c.id).on).length,
    motorsOn: circuit.components.filter(c => c.type === 'motor' && getComponentState(circuit, c.id).on).length,
  }), [circuit])

  function update(next) {
    if (!readOnly) onChange?.(cloneCircuit(next))
  }

  function addComponent(type) {
    const count = circuit.components.filter(c => c.type === type).length + 1
    const next = cloneCircuit(circuit)
    next.components.push(makeComponent(type, count, { row: 2 + (count % 8), col: 3 + (count % 12) }))
    update(next)
  }

  function moveSelected(deltaRow, deltaCol) {
    if (!selected) return
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === selected.id
      ? { ...component, position: { row: Math.max(1, component.position.row + deltaRow), col: Math.max(1, component.position.col + deltaCol) } }
      : component)
    update(next)
  }

  function removeSelected() {
    if (!selected) return
    const next = cloneCircuit(circuit)
    next.components = next.components.filter(c => c.id !== selected.id)
    next.wires = next.wires.filter(w => !w.from.startsWith(`${selected.id}.`) && !w.to.startsWith(`${selected.id}.`))
    delete next.controls[selected.id]
    setSelectedId(next.components[0]?.id ?? null)
    update(next)
  }

  function connectPin(ref) {
    if (readOnly) return
    if (!wireFrom) {
      setWireFrom(ref)
      return
    }
    if (wireFrom !== ref) {
      const next = cloneCircuit(circuit)
      next.wires.push({ id: `wire${Date.now()}`, from: wireFrom, to: ref, color: '#ef4444' })
      update(next)
    }
    setWireFrom('')
  }

  function updateControl(key, value) {
    if (!selected) return
    const next = cloneCircuit(circuit)
    next.controls[selected.id] = { ...(next.controls[selected.id] ?? {}), [key]: value }
    update(next)
  }

  function pinPoint(ref) {
    const [componentId, pin] = String(ref ?? '').split('.')
    const component = circuit.components.find(c => c.id === componentId)
    if (!component) return null
    const pinIndex = Math.max(0, component.pins.indexOf(pin))
    return {
      x: component.position.col * 24 + 12 + (pinIndex % 2) * 50,
      y: component.position.row * 22 + 16 + Math.floor(pinIndex / 2) * 16,
    }
  }

  const breadboard = (
    <div style={s.shell}>
      <div style={s.header} className="ui-tabs ui-tabs--editor">
        <span style={s.title}>{title}</span>
        <div style={s.tabs}>
          <button className={tab === 'breadboard' ? 'ui-tab is-active' : 'ui-tab'} onClick={() => setTab('breadboard')}>Breadboard</button>
          {showCodeTab && <button className={tab === 'code' ? 'ui-tab is-active' : 'ui-tab'} onClick={() => setTab('code')}>Code</button>}
        </div>
        <div style={s.actions}>
          {onCheck && <button className="btn-primary" style={s.actionBtn} onClick={onCheck}>Check Circuit</button>}
          {onReset && <button className="btn-ghost-outline" style={s.actionBtn} onClick={onReset}>Reset</button>}
        </div>
      </div>
      {tab === 'code' ? (
        <div style={s.codePane}>
          <textarea
            value={code}
            onChange={event => onCodeChange?.(event.target.value)}
            readOnly={readOnly}
            placeholder="MicroPython support will run here when a virtual microcontroller is enabled."
            style={s.codeTextarea}
          />
        </div>
      ) : (
        <div style={s.workspace}>
          <div style={s.palette}>
            {PALETTE.filter(([type]) => COMPONENT_TYPES.includes(type)).map(([type, label]) => (
              <button key={type} type="button" disabled={readOnly} style={s.paletteBtn} onClick={() => addComponent(type)}>
                <span style={s.paletteIcon}>{label.slice(0, 2).toUpperCase()}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div style={s.boardWrap}>
            <div style={s.board}>
              {Array.from({ length: 14 }).map((_, row) => (
                <div key={row} style={s.boardRow}>
                  {Array.from({ length: 20 }).map((__, col) => <span key={col} style={s.hole} />)}
                </div>
              ))}
              <svg style={s.wires} viewBox="0 0 620 390" aria-hidden="true">
                {circuit.wires.map(wire => {
                  const from = pinPoint(wire.from)
                  const to = pinPoint(wire.to)
                  if (!from || !to) return null
                  return (
                    <line
                      key={wire.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={wire.color ?? '#ef4444'}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
              {circuit.components.map(component => {
                const state = getComponentState(circuit, component.id)
                return (
                  <button
                    key={component.id}
                    type="button"
                    style={{
                      ...s.component,
                      left: `${component.position.col * 24}px`,
                      top: `${component.position.row * 22}px`,
                      borderColor: selectedId === component.id ? '#7c3aed' : state.on ? '#16a34a' : '#94a3b8',
                      background: state.on ? '#dcfce7' : '#fff',
                    }}
                    onClick={() => setSelectedId(component.id)}
                  >
                    <strong>{component.label}</strong>
                    <span style={s.componentType}>{component.type}</span>
                  </button>
                )
              })}
            </div>
            <div style={s.status}>
              <span>{circuit.components.length} parts</span>
              <span>{circuit.wires.length} wires</span>
              <span>{stats.ledsOn} LEDs on</span>
              <span>{stats.motorsOn} motors on</span>
            </div>
          </div>
          <div style={s.inspector}>
            {selected ? (
              <>
                <h3 style={s.inspectorTitle}>{selected.label}</h3>
                <div style={s.pinGrid}>
                  {selected.pins.map(pin => {
                    const ref = pinRef(selected.id, pin)
                    return <button key={pin} type="button" disabled={readOnly} style={wireFrom === ref ? s.pinActive : s.pinBtn} onClick={() => connectPin(ref)}>{pin}</button>
                  })}
                </div>
                <div style={s.moveRow}>
                  <button disabled={readOnly} onClick={() => moveSelected(-1, 0)}>Up</button>
                  <button disabled={readOnly} onClick={() => moveSelected(0, -1)}>Left</button>
                  <button disabled={readOnly} onClick={() => moveSelected(0, 1)}>Right</button>
                  <button disabled={readOnly} onClick={() => moveSelected(1, 0)}>Down</button>
                </div>
                {selected.type === 'slide_switch' && (
                  <label style={s.toggle}><input type="checkbox" disabled={readOnly} checked={circuit.controls[selected.id]?.closed === true} onChange={e => updateControl('closed', e.target.checked)} /> Closed</label>
                )}
                {selected.type === 'push_button' && (
                  <label style={s.toggle}><input type="checkbox" disabled={readOnly} checked={circuit.controls[selected.id]?.pressed === true} onChange={e => updateControl('pressed', e.target.checked)} /> Pressed</label>
                )}
                {selected.type === 'potentiometer' && (
                  <label style={s.range}>Value <input type="range" disabled={readOnly} min="0" max="100" value={circuit.controls[selected.id]?.value ?? 50} onChange={e => updateControl('value', Number(e.target.value))} /></label>
                )}
                <button disabled={readOnly} className="btn-danger" style={s.removeBtn} onClick={removeSelected}>Delete</button>
                {wireFrom && <p style={s.hint}>Select another pin to finish the wire.</p>}
              </>
            ) : <p style={s.hint}>Select a component to inspect pins and values.</p>}
          </div>
        </div>
      )}
    </div>
  )

  if (!showCodeTab) return breadboard

  return (
    <SplitPane
      style={s.split}
      defaultSplit={72}
      rightCollapsed={outputCollapsed}
      collapsedRightWidth={44}
      collapsedRight={<button style={s.outputRail} onClick={() => setOutputCollapsed(false)}>Output</button>}
      left={breadboard}
      right={<OutputPanel output={output} runStatus={runStatus} checkPassed={checkPassed} hasCheck fill leadingActions={<button style={s.collapseOutput} onClick={() => setOutputCollapsed(true)}>Hide</button>} />}
    />
  )
}

const s = {
  split: { flex: 1, minHeight: 0 },
  shell: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { flexShrink: 0 },
  title: { fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--colour-primary)', padding: '0 10px' },
  tabs: { display: 'flex', alignItems: 'center' },
  actions: { marginLeft: 'auto', display: 'flex', gap: 8, paddingRight: 8 },
  actionBtn: { fontSize: 13, padding: '7px 12px' },
  workspace: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '132px minmax(360px, 1fr) 220px', overflow: 'hidden' },
  palette: { padding: 10, borderRight: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  paletteBtn: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 7, padding: '8px 9px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 650 },
  paletteIcon: { width: 28, height: 24, borderRadius: 5, background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', fontSize: 11 },
  boardWrap: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#e2e8f0' },
  board: { position: 'relative', width: 620, height: 390, margin: 16, padding: 18, borderRadius: 8, background: '#fff7ed', boxShadow: 'inset 0 0 0 2px #fed7aa' },
  wires: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 },
  boardRow: { display: 'flex', gap: 12, height: 20, alignItems: 'center' },
  hole: { width: 7, height: 7, borderRadius: '50%', background: '#334155', opacity: 0.55 },
  component: { position: 'absolute', zIndex: 2, minWidth: 74, minHeight: 42, border: '2px solid #94a3b8', borderRadius: 7, padding: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,0.16)', fontFamily: 'var(--font-body)' },
  componentType: { fontSize: 10, color: '#64748b' },
  status: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#334155' },
  inspector: { padding: 12, borderLeft: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto', fontFamily: 'var(--font-body)' },
  inspectorTitle: { margin: '0 0 10px', fontSize: 16 },
  pinGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pinBtn: { border: '1px solid #cbd5e1', borderRadius: 999, padding: '4px 9px', background: '#fff', cursor: 'pointer' },
  pinActive: { border: '1px solid #7c3aed', borderRadius: 999, padding: '4px 9px', background: '#ede9fe', color: '#5b21b6', cursor: 'pointer' },
  moveRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 },
  toggle: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  range: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  removeBtn: { width: '100%', padding: '7px 10px', fontSize: 13 },
  hint: { margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.5 },
  codePane: { flex: 1, padding: 12, background: '#0f172a' },
  codeTextarea: { width: '100%', height: '100%', resize: 'none', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: 12, fontFamily: 'var(--font-code)', fontSize: 13 },
  outputRail: { writingMode: 'vertical-rl', height: '100%', border: 0, background: '#f8fafc', color: '#7c3aed', fontWeight: 700, cursor: 'pointer' },
  collapseOutput: { border: '1px solid #fff', background: '#fff', borderRadius: 5, color: '#7c3aed', fontSize: 12 },
}
