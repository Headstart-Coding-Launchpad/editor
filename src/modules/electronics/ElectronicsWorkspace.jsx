import React, { useEffect, useMemo, useRef, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import OutputPanel from '../../app/components/OutputPanel'
import {
  COMPONENT_LABELS,
  COMPONENT_TYPES,
  LED_COLOR_OPTIONS,
  RESISTOR_OPTIONS,
  WIRE_COLORS,
  arePinsConnected,
  circuitHasShort,
  cloneCircuit,
  getComponentState,
  getComponentResistanceOhms,
  getWireCurrentDirection,
  getWireColorForPins,
  makeComponent,
  normalizeAvailableComponents,
  pinRef,
} from './circuit'

const PALETTE = COMPONENT_TYPES.map(type => [type, COMPONENT_LABELS[type] ?? type])

const GRID_X = 28
const GRID_Y = 24
const BOARD_PAD = 24
const PART_W = 112
const PART_H = 70
const PIN_SNAP_RADIUS = 34
const WIRE_CLEARANCE = 18
const WIRE_OBSTACLE_PAD = 8
const WIRE_EXIT_STUB = 12
const WIRE_LANE_GAP = 10
const WIRE_OVERLAP_PENALTY = 5000
const WIRE_CROSSING_PENALTY = 900
const WIRE_BEND_PENALTY = 70

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
  availableComponents = null,
  setupMode = false,
}) {
  const boardRef = useRef(null)
  const [tab, setTab] = useState('breadboard')
  const [selectedId, setSelectedId] = useState(circuit.components[0]?.id ?? null)
  const [selectedWireId, setSelectedWireId] = useState(null)
  const [drag, setDrag] = useState(null)
  const [wireColor, setWireColor] = useState('auto')
  const [outputCollapsed, setOutputCollapsed] = useState(!showCodeTab)
  const selected = circuit.components.find(c => c.id === selectedId) ?? null
  const selectedWire = circuit.wires.find(wire => wire.id === selectedWireId) ?? null
  const paletteTypes = useMemo(() => normalizeAvailableComponents(availableComponents), [availableComponents])
  const boardRows = Number(circuit.board?.rows ?? 14)
  const boardCols = Number(circuit.board?.cols ?? 20)
  const boardWidth = BOARD_PAD * 2 + (boardCols - 1) * GRID_X + PART_W + 24
  const boardHeight = BOARD_PAD * 2 + (boardRows - 1) * GRID_Y + PART_H + 24
  const stats = useMemo(() => ({
    ledsOn: circuit.components.filter(c => c.type === 'led' && getComponentState(circuit, c.id).on).length,
    motorsOn: circuit.components.filter(c => c.type === 'motor' && getComponentState(circuit, c.id).on).length,
    buzzersOn: circuit.components.filter(c => c.type === 'buzzer' && getComponentState(circuit, c.id).on).length,
  }), [circuit])
  const hasShort = useMemo(() => circuitHasShort(circuit), [circuit])

  useEffect(() => {
    if (stats.buzzersOn === 0 || typeof window === 'undefined') return undefined
    const AudioContext = window.AudioContext ?? window.webkitAudioContext
    if (!AudioContext) return undefined

    let context
    let oscillator
    let gain
    try {
      context = new AudioContext()
      oscillator = context.createOscillator()
      gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = 150
      gain.gain.value = 0.035
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      context.resume?.().catch(() => {})
    } catch {
      return undefined
    }

    return () => {
      try {
        gain.gain.setTargetAtTime(0, context.currentTime, 0.015)
        oscillator.stop(context.currentTime + 0.04)
        window.setTimeout(() => context.close?.(), 80)
      } catch {}
    }
  }, [stats.buzzersOn])

  function update(next) {
    if (!readOnly) onChange?.(cloneCircuit(next))
  }

  function clampPosition(position) {
    return {
      row: Math.min(boardRows, Math.max(1, position.row)),
      col: Math.min(boardCols, Math.max(1, position.col)),
    }
  }

  function componentPoint(component) {
    const position = clampPosition(component.position ?? { row: 1, col: 1 })
    return {
      x: BOARD_PAD + (position.col - 1) * GRID_X,
      y: BOARD_PAD + (position.row - 1) * GRID_Y,
    }
  }

  function boardPoint(event) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function positionFromPoint(point, offset = { x: PART_W / 2, y: PART_H / 2 }) {
    return clampPosition({
      col: Math.round((point.x - offset.x - BOARD_PAD) / GRID_X) + 1,
      row: Math.round((point.y - offset.y - BOARD_PAD) / GRID_Y) + 1,
    })
  }

  function addComponent(type, position) {
    if (!paletteTypes.includes(type)) return
    const count = circuit.components.filter(c => c.type === type).length + 1
    const next = cloneCircuit(circuit)
    const fallback = { row: 2 + (count % Math.max(1, boardRows - 2)), col: 3 + (count % Math.max(1, boardCols - 4)) }
    const component = makeComponent(type, count, clampPosition(position ?? fallback))
    next.components.push(component)
    selectComponent(component.id)
    update(next)
  }

  function moveComponent(id, position) {
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === id
      ? { ...component, position: clampPosition(position) }
      : component)
    update(next)
  }

  function selectComponent(id) {
    setSelectedId(id)
    setSelectedWireId(null)
    boardRef.current?.focus?.()
  }

  function selectWire(id) {
    setSelectedWireId(id)
    setSelectedId(null)
    boardRef.current?.focus?.()
  }

  function removeSelected() {
    if (!selected && !selectedWire) return
    const next = cloneCircuit(circuit)
    if (selectedWire) {
      next.wires = next.wires.filter(wire => wire.id !== selectedWire.id)
      setSelectedWireId(null)
      setSelectedId(next.components[0]?.id ?? null)
    } else if (selected) {
      if (selected.locked && !setupMode) return
      next.components = next.components.filter(c => c.id !== selected.id)
      next.wires = next.wires.filter(w => !w.from.startsWith(`${selected.id}.`) && !w.to.startsWith(`${selected.id}.`))
      delete next.controls[selected.id]
      setSelectedId(next.components[0]?.id ?? null)
    }
    update(next)
  }

  function updateSelectedWireColor(color) {
    if (!selectedWire) return
    const next = cloneCircuit(circuit)
    next.wires = next.wires.map(wire => wire.id === selectedWire.id ? { ...wire, color } : wire)
    update(next)
  }

  function updateSelectedComponentProps(props) {
    if (!selected) return
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === selected.id
      ? { ...component, props: { ...(component.props ?? {}), ...props } }
      : component)
    update(next)
  }

  function updateSelectedComponent(updates) {
    if (!selected) return
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === selected.id
      ? { ...component, ...updates }
      : component)
    update(next)
  }

  function rotateSelectedComponent() {
    if (!selected || (selected.locked && !setupMode)) return
    const rotation = normalizeRotation((Number(selected.rotation ?? 0) + 90) % 360)
    updateSelectedComponent({ rotation })
  }

  function connectPins(from, to) {
    if (readOnly) return
    if (from && to && from !== to) {
      const next = cloneCircuit(circuit)
      next.wires.push({ id: `wire${Date.now()}`, from, to, color: getWireColorForPins(from, to, wireColor) })
      setSelectedWireId(next.wires.at(-1)?.id ?? null)
      setSelectedId(null)
      update(next)
    }
  }

  function updateControlFor(componentId, key, value) {
    const next = cloneCircuit(circuit)
    next.controls[componentId] = { ...(next.controls[componentId] ?? {}), [key]: value }
    update(next)
  }

  function pinPoint(ref) {
    const [componentId, pin] = String(ref ?? '').split('.')
    const component = circuit.components.find(c => c.id === componentId)
    if (!component) return null
    const pinIndex = Math.max(0, component.pins.indexOf(pin))
    const part = componentPoint(component)
    const offset = pinOffset(component, pin, pinIndex)
    return {
      x: part.x + offset.x,
      y: part.y + offset.y,
    }
  }

  function nearestPin(point, excludeRef = null, radius = PIN_SNAP_RADIUS) {
    let nearest = null
    circuit.components.forEach(component => {
      component.pins.forEach(pin => {
        const ref = pinRef(component.id, pin)
        if (ref === excludeRef) return
        const target = pinPoint(ref)
        if (!target) return
        const distance = Math.hypot(target.x - point.x, target.y - point.y)
        if (distance <= radius && (!nearest || distance < nearest.distance)) {
          nearest = { ref, point: target, distance }
        }
      })
    })
    return nearest
  }

  function isWireEnergized(wire) {
    if (hasShort || stats.ledsOn + stats.motorsOn + stats.buzzersOn === 0) return false
    const batteries = circuit.components.filter(component => component.type === 'battery')
    return batteries.some(battery => {
      const positive = pinRef(battery.id, 'positive')
      const negative = pinRef(battery.id, 'negative')
      return [wire.from, wire.to].some(ref => arePinsConnected(circuit, ref, positive) || arePinsConnected(circuit, ref, negative))
    })
  }

  function handleWorkspaceKeyDown(event) {
    if (readOnly || (event.key !== 'Delete' && event.key !== 'Backspace')) return
    const target = event.target
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || target?.isContentEditable) return
    if (!selected && !selectedWire) return
    event.preventDefault()
    removeSelected()
  }

  function startComponentDrag(event, component) {
    if (readOnly || (component.locked && !setupMode) || event.button !== 0 || event.target.closest('[data-pin-ref]') || event.target.closest('[data-control-action]')) return
    event.preventDefault()
    selectComponent(component.id)
    const point = boardPoint(event)
    const part = componentPoint(component)
    setDrag({ type: 'component', id: component.id, offset: { x: point.x - part.x, y: point.y - part.y } })
    boardRef.current?.setPointerCapture?.(event.pointerId)
  }

  function startWireDrag(event, ref) {
    if (readOnly || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    selectComponent(String(ref).split('.')[0])
    setDrag({ type: 'wire', from: ref, current: pinPoint(ref) ?? boardPoint(event), to: null })
    boardRef.current?.setPointerCapture?.(event.pointerId)
  }

  function handleBoardPointerMove(event) {
    if (!drag) return
    const point = boardPoint(event)
    if (drag.type === 'component') {
      moveComponent(drag.id, positionFromPoint(point, drag.offset))
    } else if (drag.type === 'wire') {
      const snap = nearestPin(point, drag.from)
      setDrag(current => current?.type === 'wire' ? { ...current, current: snap?.point ?? point, to: snap?.ref ?? null } : current)
    }
  }

  function handleBoardPointerUp(event) {
    if (drag?.type === 'wire') {
      const point = boardPoint(event)
      const snap = nearestPin(point, drag.from)
      connectPins(drag.from, snap?.ref ?? drag.to)
    }
    boardRef.current?.releasePointerCapture?.(event.pointerId)
    setDrag(null)
  }

  function handlePaletteDragStart(event, type) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-hsc-component', type)
  }

  function handleBoardDrop(event) {
    if (readOnly) return
    const type = event.dataTransfer.getData('application/x-hsc-component')
    if (!paletteTypes.includes(type)) return
    event.preventDefault()
    addComponent(type, positionFromPoint(boardPoint(event)))
  }

  const componentRects = circuit.components.map(component => {
    const point = componentPoint(component)
    return {
      id: component.id,
      type: component.type,
      ...rotatedComponentRect(point, component.rotation),
    }
  })
  const wireRoutes = []
  const usedWireSegments = []
  circuit.wires.forEach(wire => {
    const from = pinPoint(wire.from)
    const to = pinPoint(wire.to)
    if (!from || !to) {
      wireRoutes.push({ wire, from, to, points: [], path: null })
      return
    }
    const points = wireRoutePoints(from, to, componentRects, wire.from, wire.to, { width: boardWidth, height: boardHeight }, usedWireSegments)
    wireRoutes.push({ wire, from, to, points, path: pathFromPoints(points) })
    usedWireSegments.push(...segmentsFromPoints(points))
  })

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
            {PALETTE.filter(([type]) => paletteTypes.includes(type)).map(([type, label]) => (
              <button key={type} type="button" disabled={readOnly} draggable={!readOnly} style={s.paletteBtn} onClick={() => addComponent(type)} onDragStart={event => handlePaletteDragStart(event, type)}>
                <span style={s.paletteIcon}><PaletteGlyph type={type} /></span>
                <span>{label}</span>
              </button>
            ))}
            <label style={s.wireColorField}>
              <span style={s.wireColorLabel}>Wire colour</span>
              <select disabled={readOnly} value={wireColor} onChange={event => setWireColor(event.target.value)} style={s.wireColorSelect}>
                {WIRE_COLORS.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
              </select>
            </label>
          </div>
          <div style={s.boardWrap}>
            <div
              ref={boardRef}
              style={{ ...s.board, width: boardWidth, height: boardHeight }}
              tabIndex={readOnly ? undefined : 0}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerCancel={handleBoardPointerUp}
              onKeyDown={handleWorkspaceKeyDown}
              onDragOver={event => event.preventDefault()}
              onDrop={handleBoardDrop}
            >
              {Array.from({ length: boardRows }).map((_, row) => (
                Array.from({ length: boardCols }).map((__, col) => (
                  <span
                    key={`${row}-${col}`}
                    style={{
                      ...s.hole,
                      left: BOARD_PAD + col * GRID_X,
                      top: BOARD_PAD + row * GRID_Y,
                    }}
                  />
                ))
              ))}
              <svg
                style={{ ...s.wires, width: boardWidth, height: boardHeight }}
                width={boardWidth}
                height={boardHeight}
                viewBox={`0 0 ${boardWidth} ${boardHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {wireRoutes.map(({ wire, points, path }) => {
                  if (!path) return null
                  const energized = isWireEnergized(wire)
                  const isSelected = selectedWireId === wire.id
                  const currentPath = getWireCurrentDirection(circuit, wire) === 'reverse'
                    ? pathFromPoints([...points].reverse())
                    : path
                  return (
                    <g key={wire.id}>
                      <path
                        d={path}
                        stroke="transparent"
                        strokeWidth="18"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        style={{ pointerEvents: readOnly ? 'none' : 'stroke', cursor: readOnly ? 'default' : 'pointer' }}
                        onPointerDown={event => {
                          if (readOnly || event.button !== 0) return
                          event.preventDefault()
                          event.stopPropagation()
                          selectWire(wire.id)
                        }}
                      />
                      <path d={path} stroke={isSelected ? '#7c3aed' : '#1f2937'} strokeWidth={isSelected ? '9' : '7'} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={isSelected ? '0.34' : '0.22'} />
                      <path d={path} stroke={wire.color ?? '#ef4444'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      {energized && (
                        <path d={currentPath} stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 12" fill="none">
                          <animate attributeName="stroke-dashoffset" from="13" to="0" dur="0.45s" repeatCount="indefinite" />
                        </path>
                      )}
                    </g>
                  )
                })}
                {drag?.type === 'wire' && pinPoint(drag.from) && (
                  <path d={directWirePath(pinPoint(drag.from), drag.current)} stroke="#0f172a" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.72" />
                )}
              </svg>
              {circuit.components.map(component => {
                const state = getComponentState(circuit, component.id)
                const point = componentPoint(component)
                const isLockedForUser = component.locked && !setupMode
                return (
                  <div
                    key={component.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      ...s.component,
                      left: point.x,
                      top: point.y,
                      borderColor: selectedId === component.id ? '#7c3aed' : state.on ? '#16a34a' : '#94a3b8',
                      zIndex: selectedId === component.id ? 5 : 4,
                      cursor: readOnly || isLockedForUser ? 'default' : drag?.type === 'component' && drag.id === component.id ? 'grabbing' : 'grab',
                    }}
                    onClick={() => selectComponent(component.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') selectComponent(component.id)
                    }}
                    onPointerDown={event => startComponentDrag(event, component)}
                  >
                    <ComponentBody
                      component={component}
                      state={state}
                      controls={circuit.controls[component.id] ?? {}}
                      readOnly={readOnly || isLockedForUser}
                      rotation={component.rotation ?? 0}
                      onControl={(key, value) => updateControlFor(component.id, key, value)}
                    />
                    {component.pins.map((pin, pinIndex) => {
                      const ref = pinRef(component.id, pin)
                      const offset = pinOffset(component, pin, pinIndex)
                      return (
                        <span
                          key={pin}
                          data-pin-ref={ref}
                          title={`${component.label} ${pin}`}
                          style={{
                            ...s.pinHandle,
                            ...pinHandleStyle(pin),
                            left: offset.x,
                            top: offset.y,
                            boxShadow: drag?.type === 'wire' && drag.from === ref
                              ? '0 0 0 5px rgba(124,58,237,0.24)'
                              : drag?.type === 'wire' && drag.to === ref
                                ? '0 0 0 6px rgba(22,163,74,0.28)'
                                : s.pinHandle.boxShadow,
                          }}
                          onPointerDown={event => startWireDrag(event, ref)}
                        />
                      )
                    })}
                    <strong style={s.componentLabel}>{component.label}</strong>
                    {component.locked && <span style={s.fixedBadge}>Fixed</span>}
                    <span style={s.componentType}>{component.type}</span>
                  </div>
                )
              })}
            </div>
            <div style={s.status}>
              <span>{circuit.components.length} parts</span>
              <span>{circuit.wires.length} wires</span>
              <span>{stats.ledsOn} LEDs on</span>
              <span>{stats.motorsOn} motors on</span>
              <span>{stats.buzzersOn} buzzers on</span>
              {hasShort && <span style={s.shortStatus}>Short circuit</span>}
            </div>
          </div>
          <div style={s.inspector}>
            {selectedWire ? (
              <>
                <h3 style={s.inspectorTitle}>Wire</h3>
                <div style={s.wireDetails}>
                  <span>{selectedWire.from}</span>
                  <span>{selectedWire.to}</span>
                </div>
                <label style={s.wireColorField}>
                  <span style={s.wireColorLabel}>Wire colour</span>
                  <select disabled={readOnly} value={selectedWire.color ?? '#ef4444'} onChange={event => updateSelectedWireColor(event.target.value)} style={s.wireColorSelect}>
                    {WIRE_COLORS.filter(color => color.value !== 'auto').map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
                  </select>
                </label>
                <button disabled={readOnly} className="btn-danger" style={s.removeBtn} onClick={removeSelected}>Delete wire</button>
              </>
            ) : selected ? (
              <>
                <h3 style={s.inspectorTitle}>{selected.label}</h3>
                {setupMode && (
                  <>
                    <label style={s.field}>
                      <span style={s.fieldLabel}>Label</span>
                      <input
                        disabled={readOnly}
                        value={selected.label ?? ''}
                        onChange={event => updateSelectedComponent({ label: event.target.value })}
                        style={s.textInput}
                      />
                    </label>
                    <label style={s.toggle}>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={selected.locked === true}
                        onChange={event => updateSelectedComponent({ locked: event.target.checked })}
                      />
                      Fixed for students
                    </label>
                  </>
                )}
                <ComponentStateSummary component={selected} state={getComponentState(circuit, selected.id)} />
                <button
                  disabled={readOnly || (selected.locked && !setupMode)}
                  className="btn-ghost-outline"
                  style={s.rotateBtn}
                  onClick={rotateSelectedComponent}
                >
                  Rotate 90 deg
                </button>
                {selected.type === 'resistor' && (
                  <label style={s.field}>
                    <span style={s.fieldLabel}>Resistance</span>
                    <select
                      disabled={readOnly || (selected.locked && !setupMode)}
                      value={getComponentResistanceOhms(selected)}
                      onChange={event => updateSelectedComponentProps({ resistanceOhms: Number(event.target.value) })}
                      style={s.wireColorSelect}
                    >
                      {RESISTOR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                )}
                {selected.type === 'led' && (
                  <label style={s.field}>
                    <span style={s.fieldLabel}>LED colour</span>
                    <select
                      disabled={readOnly || (selected.locked && !setupMode)}
                      value={selected.props?.color ?? 'red'}
                      onChange={event => updateSelectedComponentProps({ color: event.target.value })}
                      style={s.wireColorSelect}
                    >
                      {LED_COLOR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                )}
                {selected.type === 'slide_switch' && (
                  <label style={s.toggle}><input type="checkbox" disabled={readOnly || (selected.locked && !setupMode)} checked={circuit.controls[selected.id]?.closed === true} onChange={e => updateControlFor(selected.id, 'closed', e.target.checked)} /> Closed</label>
                )}
                {selected.type === 'push_button' && (
                  <label style={s.toggle}><input type="checkbox" disabled={readOnly || (selected.locked && !setupMode)} checked={circuit.controls[selected.id]?.pressed === true} onChange={e => updateControlFor(selected.id, 'pressed', e.target.checked)} /> Pressed</label>
                )}
                {selected.type === 'potentiometer' && (
                  <label style={s.range}>Value <input type="range" disabled={readOnly || (selected.locked && !setupMode)} min="0" max="100" value={circuit.controls[selected.id]?.value ?? 50} onChange={e => updateControlFor(selected.id, 'value', Number(e.target.value))} /></label>
                )}
                <button disabled={readOnly || (selected.locked && !setupMode)} className="btn-danger" style={s.removeBtn} onClick={removeSelected}>Delete part</button>
              </>
            ) : <p style={s.emptySelection}>No selection</p>}
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

function wirePath(from, to, componentRects = [], fromRef = '', toRef = '', bounds = null, usedWireSegments = []) {
  return pathFromPoints(wireRoutePoints(from, to, componentRects, fromRef, toRef, bounds, usedWireSegments))
}

function wireRoutePoints(from, to, componentRects = [], fromRef = '', toRef = '', bounds = null, usedWireSegments = []) {
  const fromComponentId = String(fromRef).split('.')[0]
  const toComponentId = String(toRef).split('.')[0]
  const obstacles = componentRects
    .map(rect => ({
      ...rect,
      left: rect.left - WIRE_OBSTACLE_PAD,
      right: rect.right + WIRE_OBSTACLE_PAD,
      top: rect.top - WIRE_OBSTACLE_PAD,
      bottom: rect.bottom + WIRE_OBSTACLE_PAD,
    }))
  const fromRect = componentRects.find(rect => rect.id === fromComponentId)
  const toRect = componentRects.find(rect => rect.id === toComponentId)
  const fromExit = pinExitPoint(from, fromRef, fromRect)
  const toExit = pinExitPoint(to, toRef, toRect)
  const outerLane = outsideFacingRoute(fromExit, toExit, fromRef, toRef, fromRect, toRect, obstacles, bounds, usedWireSegments)
  const middle = outerLane ?? routeOrthogonal(fromExit, toExit, obstacles, bounds, usedWireSegments)
  const points = compactPathPoints([from, ...middle, to], { preserveIndexes: new Set([1, middle.length]) })
  return points
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(point.x)} ${Math.round(point.y)}`).join(' ')
}

function directWirePath(from, to) {
  return `M ${Math.round(from.x)} ${Math.round(from.y)} L ${Math.round(to.x)} ${Math.round(to.y)}`
}

function pinExitPoint(point, ref, rect) {
  if (!rect) return point
  const side = pinExitSide(point, rect)
  if (side === 'left') return { x: rect.left - WIRE_EXIT_STUB, y: point.y }
  if (side === 'right') return { x: rect.right + WIRE_EXIT_STUB, y: point.y }
  if (side === 'top') return { x: point.x, y: rect.top - WIRE_EXIT_STUB }
  return { x: point.x, y: rect.bottom + WIRE_EXIT_STUB }
}

function pinExitSide(point, rect) {
  const distances = [
    ['left', Math.abs(point.x - rect.left)],
    ['right', Math.abs(point.x - rect.right)],
    ['top', Math.abs(point.y - rect.top)],
    ['bottom', Math.abs(point.y - rect.bottom)],
  ]
  distances.sort((a, b) => a[1] - b[1])
  return distances[0]?.[0] ?? 'bottom'
}

function outsideFacingRoute(start, end, fromRef, toRef, fromRect, toRect, obstacles, bounds = null, usedWireSegments = []) {
  if (!fromRect || !toRect) return null
  const fromSide = pinExitSide(start, fromRect)
  const toSide = pinExitSide(end, toRect)
  const leftToRightAway = fromSide === 'left' && toSide === 'right' && start.x < end.x
  const rightToLeftAway = fromSide === 'right' && toSide === 'left' && start.x > end.x
  if (!leftToRightAway && !rightToLeftAway) return null

  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const minSpanX = Math.min(start.x, end.x)
  const maxSpanX = Math.max(start.x, end.x)
  const relevant = obstacles.filter(rect => rect.right >= minSpanX && rect.left <= maxSpanX)
  const topLane = clamp(Math.min(start.y, end.y, ...relevant.map(rect => rect.top)) - WIRE_CLEARANCE * 1.5, minY, maxY)
  const bottomLane = clamp(Math.max(start.y, end.y, ...relevant.map(rect => rect.bottom)) + WIRE_CLEARANCE * 1.5, minY, maxY)
  const candidates = [
    [start, { x: start.x, y: topLane }, { x: end.x, y: topLane }, end],
    [start, { x: start.x, y: bottomLane }, { x: end.x, y: bottomLane }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1, 2]) }))
    .filter(points => !pathHitsObstacles(points, obstacles))
    .map(points => ({ points, score: scoreWireRoute(points, usedWireSegments) }))
    .sort((a, b) => a.score - b.score)

  return candidates[0]?.points ?? null
}

function compactPathPoints(points, options = {}) {
  return points.filter((point, index, all) => {
    const previous = all[index - 1]
    const next = all[index + 1]
    if (previous && Math.abs(previous.x - point.x) < 0.5 && Math.abs(previous.y - point.y) < 0.5) return false
    if (!previous || !next) return true
    if (options.preserveIndexes?.has(index) && !isTinyReversal(previous, point, next)) return true
    const sameVertical = Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5
    const sameHorizontal = Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5
    return !sameVertical && !sameHorizontal
  })
}

function isTinyReversal(previous, point, next) {
  const sameHorizontal = Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5
  const sameVertical = Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5
  if (sameHorizontal) {
    const turnsBack = Math.sign(point.x - previous.x) !== Math.sign(next.x - point.x)
    return turnsBack && Math.min(Math.abs(point.x - previous.x), Math.abs(next.x - point.x)) <= WIRE_EXIT_STUB
  }
  if (sameVertical) {
    const turnsBack = Math.sign(point.y - previous.y) !== Math.sign(next.y - point.y)
    return turnsBack && Math.min(Math.abs(point.y - previous.y), Math.abs(next.y - point.y)) <= WIRE_EXIT_STUB
  }
  return false
}

function routeOrthogonal(start, end, obstacles, bounds = null, usedWireSegments = []) {
  const directHitsComponent = obstacles.some(rect => segmentIntersectsRect(start, end, rect))
  const directIsOrthogonal = isHorizontalSegment(start, end) || isVerticalSegment(start, end)
  if (directIsOrthogonal && !directHitsComponent && wireLanePenalty(start, end, usedWireSegments) === 0) return [start, end]

  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const xs = new Set([roundCoord(start.x), roundCoord(end.x), minX, maxX])
  const ys = new Set([roundCoord(start.y), roundCoord(end.y), minY, maxY])
  ;[start, end].forEach(point => {
    xs.add(roundCoord(clamp(point.x - WIRE_LANE_GAP, minX, maxX)))
    xs.add(roundCoord(clamp(point.x + WIRE_LANE_GAP, minX, maxX)))
    ys.add(roundCoord(clamp(point.y - WIRE_LANE_GAP, minY, maxY)))
    ys.add(roundCoord(clamp(point.y + WIRE_LANE_GAP, minY, maxY)))
  })

  obstacles.forEach(rect => {
    xs.add(roundCoord(clamp(rect.left - WIRE_CLEARANCE, minX, maxX)))
    xs.add(roundCoord(clamp(rect.right + WIRE_CLEARANCE, minX, maxX)))
    ys.add(roundCoord(clamp(rect.top - WIRE_CLEARANCE, minY, maxY)))
    ys.add(roundCoord(clamp(rect.bottom + WIRE_CLEARANCE, minY, maxY)))
  })
  usedWireSegments.forEach(segment => {
    xs.add(roundCoord(clamp(segment.a.x, minX, maxX)))
    xs.add(roundCoord(clamp(segment.b.x, minX, maxX)))
    ys.add(roundCoord(clamp(segment.a.y, minY, maxY)))
    ys.add(roundCoord(clamp(segment.b.y, minY, maxY)))
    if (isHorizontalSegment(segment.a, segment.b)) {
      ys.add(roundCoord(clamp(segment.a.y - WIRE_LANE_GAP, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y + WIRE_LANE_GAP, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y - WIRE_LANE_GAP * 2, minY, maxY)))
      ys.add(roundCoord(clamp(segment.a.y + WIRE_LANE_GAP * 2, minY, maxY)))
    } else if (isVerticalSegment(segment.a, segment.b)) {
      xs.add(roundCoord(clamp(segment.a.x - WIRE_LANE_GAP, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x + WIRE_LANE_GAP, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x - WIRE_LANE_GAP * 2, minX, maxX)))
      xs.add(roundCoord(clamp(segment.a.x + WIRE_LANE_GAP * 2, minX, maxX)))
    }
  })

  const xValues = [...xs].sort((a, b) => a - b)
  const yValues = [...ys].sort((a, b) => a - b)
  const nodes = []
  yValues.forEach(y => {
    xValues.forEach(x => {
      const point = { x, y }
      if (!obstacles.some(rect => pointInsideRect(point, rect))) nodes.push(point)
    })
  })

  const keyFor = point => `${point.x},${point.y}`
  const nodeMap = new Map(nodes.map(point => [keyFor(point), point]))
  const startKey = keyFor({ x: roundCoord(start.x), y: roundCoord(start.y) })
  const endKey = keyFor({ x: roundCoord(end.x), y: roundCoord(end.y) })
  if (!nodeMap.has(startKey)) nodeMap.set(startKey, { x: roundCoord(start.x), y: roundCoord(start.y) })
  if (!nodeMap.has(endKey)) nodeMap.set(endKey, { x: roundCoord(end.x), y: roundCoord(end.y) })

  const graph = new Map()
  const byY = new Map()
  const byX = new Map()
  nodeMap.forEach(point => {
    if (!byY.has(point.y)) byY.set(point.y, [])
    if (!byX.has(point.x)) byX.set(point.x, [])
    byY.get(point.y).push(point)
    byX.get(point.x).push(point)
  })
  byY.forEach(row => connectVisibleNeighbours(row.sort((a, b) => a.x - b.x), graph, obstacles, keyFor, usedWireSegments))
  byX.forEach(col => connectVisibleNeighbours(col.sort((a, b) => a.y - b.y), graph, obstacles, keyFor, usedWireSegments))

  const simple = simpleOrthogonalRoutes(start, end)
    .filter(points => !pathHitsObstacles(points, obstacles))
    .map(points => ({ points, score: scoreWireRoute(points, usedWireSegments) }))
    .sort((a, b) => a.score - b.score)[0]
  if (simple && simple.score < WIRE_OVERLAP_PENALTY) return simple.points

  const path = shortestPath(graph, startKey, endKey)
  if (!path.length) return fallbackOrthogonalRoute(start, end, obstacles, bounds, usedWireSegments)
  return path.map(key => {
    const [x, y] = key.split(',').map(Number)
    return { x, y }
  })
}

function simpleOrthogonalRoutes(start, end) {
  if (isHorizontalSegment(start, end) || isVerticalSegment(start, end)) return [[start, end]]
  return [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1]) }))
}

function fallbackOrthogonalRoute(start, end, obstacles, bounds = null, usedWireSegments = []) {
  const minX = 8
  const minY = 8
  const maxX = Math.max(minX, (bounds?.width ?? Math.max(start.x, end.x)) - 8)
  const maxY = Math.max(minY, (bounds?.height ?? Math.max(start.y, end.y)) - 8)
  const relevant = obstacles.filter(rect => {
    const minSpanX = Math.min(start.x, end.x)
    const maxSpanX = Math.max(start.x, end.x)
    const minSpanY = Math.min(start.y, end.y)
    const maxSpanY = Math.max(start.y, end.y)
    return rect.right >= minSpanX && rect.left <= maxSpanX && rect.bottom >= minSpanY && rect.top <= maxSpanY
  })
  const topLane = clamp(Math.min(start.y, end.y, ...relevant.map(rect => rect.top)) - WIRE_CLEARANCE * 1.5, minY, maxY)
  const bottomLane = clamp(Math.max(start.y, end.y, ...relevant.map(rect => rect.bottom)) + WIRE_CLEARANCE * 1.5, minY, maxY)
  const leftLane = clamp(Math.min(start.x, end.x, ...relevant.map(rect => rect.left)) - WIRE_CLEARANCE * 1.5, minX, maxX)
  const rightLane = clamp(Math.max(start.x, end.x, ...relevant.map(rect => rect.right)) + WIRE_CLEARANCE * 1.5, minX, maxX)
  const candidates = [
    ...simpleOrthogonalRoutes(start, end),
    [start, { x: start.x, y: topLane }, { x: end.x, y: topLane }, end],
    [start, { x: start.x, y: bottomLane }, { x: end.x, y: bottomLane }, end],
    [start, { x: leftLane, y: start.y }, { x: leftLane, y: end.y }, end],
    [start, { x: rightLane, y: start.y }, { x: rightLane, y: end.y }, end],
  ].map(points => compactPathPoints(points, { preserveIndexes: new Set([1, points.length - 2]) }))
    .map(points => ({
      points,
      obstacleHits: countPathObstacleHits(points, obstacles),
      score: scoreWireRoute(points, usedWireSegments),
    }))
    .sort((a, b) => a.obstacleHits - b.obstacleHits || a.score - b.score)
  return candidates[0]?.points ?? simpleOrthogonalRoutes(start, end)[0]
}

function connectVisibleNeighbours(points, graph, obstacles, keyFor, usedWireSegments) {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (obstacles.some(rect => segmentIntersectsRect(a, b, rect))) continue
    const aKey = keyFor(a)
    const bKey = keyFor(b)
    const cost = Math.hypot(b.x - a.x, b.y - a.y) + wireLanePenalty(a, b, usedWireSegments)
    if (!graph.has(aKey)) graph.set(aKey, [])
    if (!graph.has(bKey)) graph.set(bKey, [])
    graph.get(aKey).push({ key: bKey, cost })
    graph.get(bKey).push({ key: aKey, cost })
  }
}

function segmentsFromPoints(points) {
  const segments = []
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue
    segments.push({ a, b })
  }
  return segments
}

function pathHitsObstacles(points, obstacles) {
  return countPathObstacleHits(points, obstacles) > 0
}

function countPathObstacleHits(points, obstacles) {
  return segmentsFromPoints(points).reduce((count, segment) => (
    count + obstacles.filter(rect => segmentIntersectsRect(segment.a, segment.b, rect)).length
  ), 0)
}

function scoreWireRoute(points, usedWireSegments = []) {
  return segmentsFromPoints(points).reduce((score, segment) => {
    return score + Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y) + wireLanePenalty(segment.a, segment.b, usedWireSegments)
  }, points.length * 8 + countBends(points) * WIRE_BEND_PENALTY)
}

function countBends(points) {
  let bends = 0
  for (let index = 2; index < points.length; index += 1) {
    const a = points[index - 2]
    const b = points[index - 1]
    const c = points[index]
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1 || Math.hypot(c.x - b.x, c.y - b.y) < 1) continue
    const firstHorizontal = isHorizontalSegment(a, b)
    const secondHorizontal = isHorizontalSegment(b, c)
    if (firstHorizontal !== secondHorizontal) bends += 1
  }
  return bends
}

function wireLanePenalty(a, b, usedWireSegments = []) {
  if (!usedWireSegments.length) return 0
  return usedWireSegments.reduce((penalty, segment) => {
    if (segmentsOverlap(a, b, segment.a, segment.b)) return penalty + WIRE_OVERLAP_PENALTY
    if (segmentsCross(a, b, segment.a, segment.b)) return penalty + WIRE_CROSSING_PENALTY
    return penalty
  }, 0)
}

function segmentsOverlap(a, b, c, d) {
  if (isHorizontalSegment(a, b) && isHorizontalSegment(c, d) && Math.abs(a.y - c.y) < 0.5) {
    return rangesOverlap(a.x, b.x, c.x, d.x)
  }
  if (isVerticalSegment(a, b) && isVerticalSegment(c, d) && Math.abs(a.x - c.x) < 0.5) {
    return rangesOverlap(a.y, b.y, c.y, d.y)
  }
  return false
}

function segmentsCross(a, b, c, d) {
  if (isHorizontalSegment(a, b) && isVerticalSegment(c, d)) {
    return between(c.x, a.x, b.x) && between(a.y, c.y, d.y)
  }
  if (isVerticalSegment(a, b) && isHorizontalSegment(c, d)) {
    return between(a.x, c.x, d.x) && between(c.y, a.y, b.y)
  }
  return false
}

function isHorizontalSegment(a, b) {
  return Math.abs(a.y - b.y) < 0.5
}

function isVerticalSegment(a, b) {
  return Math.abs(a.x - b.x) < 0.5
}

function rangesOverlap(a1, a2, b1, b2) {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.max(minA, minB) < Math.min(maxA, maxB)
}

function between(value, a, b) {
  return value > Math.min(a, b) && value < Math.max(a, b)
}

function shortestPath(graph, startKey, endKey) {
  const distances = new Map([[startKey, 0]])
  const previous = new Map()
  const queue = [startKey]

  while (queue.length) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))
    const current = queue.shift()
    if (current === endKey) break
    graph.get(current)?.forEach(edge => {
      const nextDistance = (distances.get(current) ?? Infinity) + edge.cost
      if (nextDistance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, nextDistance)
        previous.set(edge.key, current)
        if (!queue.includes(edge.key)) queue.push(edge.key)
      }
    })
  }

  if (!distances.has(endKey)) return []
  const path = []
  let current = endKey
  while (current) {
    path.unshift(current)
    if (current === startKey) break
    current = previous.get(current)
  }
  return path[0] === startKey ? path : []
}

function segmentIntersectsRect(a, b, rect) {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) return false
  if (Math.abs(a.x - b.x) < 0.5) return a.x >= rect.left && a.x <= rect.right
  if (Math.abs(a.y - b.y) < 0.5) return a.y >= rect.top && a.y <= rect.bottom
  return true
}

function pointInsideRect(point, rect) {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom
}

function roundCoord(value) {
  return Math.round(value)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pinOffset(component, pin, pinIndex) {
  return rotateOffset(basePinOffset(component, pin, pinIndex), component.rotation)
}

function basePinOffset(component, pin, pinIndex) {
  if (component.type === 'potentiometer') {
    const xs = [26, PART_W / 2, PART_W - 26]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (component.type === 'terminal') return { x: PART_W / 2, y: PART_H - 4 }
  if (component.type === 'battery') {
    if (pin === 'positive') return { x: PART_W, y: PART_H / 2 }
    if (pin === 'negative') return { x: 0, y: PART_H / 2 }
  }
  if (pin === 'positive' || pin === 'anode' || pin === 'a' || pin === 'left') return { x: 0, y: PART_H / 2 }
  if (pin === 'negative' || pin === 'cathode' || pin === 'b' || pin === 'right') return { x: PART_W, y: PART_H / 2 }
  return { x: pinIndex % 2 === 0 ? 0 : PART_W, y: PART_H / 2 }
}

function normalizeRotation(rotation = 0) {
  const numeric = Number(rotation)
  if (!Number.isFinite(numeric)) return 0
  return ((Math.round(numeric / 90) * 90) % 360 + 360) % 360
}

function rotatedComponentRect(point, rotation = 0) {
  const normalized = normalizeRotation(rotation)
  if (normalized === 90 || normalized === 270) {
    const centerX = point.x + PART_W / 2
    const centerY = point.y + PART_H / 2
    return {
      left: centerX - PART_H / 2,
      top: centerY - PART_W / 2,
      right: centerX + PART_H / 2,
      bottom: centerY + PART_W / 2,
    }
  }
  return {
    left: point.x,
    top: point.y,
    right: point.x + PART_W,
    bottom: point.y + PART_H,
  }
}

function rotateOffset(offset, rotation = 0) {
  const normalized = normalizeRotation(rotation)
  if (normalized === 0) return offset
  const centerX = PART_W / 2
  const centerY = PART_H / 2
  const x = offset.x - centerX
  const y = offset.y - centerY
  if (normalized === 90) return { x: centerX - y, y: centerY + x }
  if (normalized === 180) return { x: centerX - x, y: centerY - y }
  if (normalized === 270) return { x: centerX + y, y: centerY - x }
  return offset
}

function pinHandleStyle(pin) {
  if (pin === 'positive' || pin === 'anode') return { background: '#ef4444', borderColor: '#fecaca' }
  if (pin === 'negative' || pin === 'cathode') return { background: '#111827', borderColor: '#94a3b8' }
  return { background: '#f59e0b', borderColor: '#fde68a' }
}

function formatResistance(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  if (numeric >= 1000) return `${numeric / 1000}k ohm`
  return `${numeric} ohm`
}

function ComponentStateSummary({ component, state }) {
  const rows = []
  if (component.type === 'resistor') rows.push(['Value', formatResistance(state.resistanceOhms)])
  if (component.type === 'led') rows.push(['Brightness', `${state.brightness ?? 0}%`], ['Voltage', `${state.voltage ?? 0}V`])
  if (component.type === 'motor') rows.push(['Speed', `${state.speed ?? 0}%`], ['Voltage', `${state.voltage ?? 0}V`])
  if (component.type === 'buzzer') rows.push(['Volume', `${state.volume ?? 0}%`], ['Voltage', `${state.voltage ?? 0}V`])
  if (state.seriesResistanceOhms > 0) rows.push(['Series resistance', formatResistance(state.seriesResistanceOhms)])
  if (rows.length === 0) return null
  return (
    <dl style={s.stateList}>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={s.stateTerm}>{label}</dt>
          <dd style={s.stateValue}>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function PaletteGlyph({ type }) {
  return (
    <svg viewBox="0 0 32 24" width="28" height="22" aria-hidden="true">
      {type === 'led' && <><circle cx="16" cy="10" r="6" fill="#f43f5e" /><path d="M10 18h12M12 18v4M20 18v4" stroke="#334155" strokeWidth="2" /></>}
      {type === 'battery' && <><rect x="5" y="7" width="21" height="12" rx="3" fill="#f8fafc" stroke="#64748b" strokeWidth="2" /><rect x="26" y="10" width="3" height="6" rx="1" fill="#64748b" /><text x="9" y="16" fontSize="11" fontWeight="700" fill="#111827">-</text><text x="18" y="16" fontSize="10" fontWeight="700" fill="#ef4444">+</text></>}
      {type === 'resistor' && <><path d="M2 12h7l2-5 4 10 4-10 4 10 2-5h5" fill="none" stroke="#334155" strokeWidth="2" /></>}
      {type === 'push_button' && <><rect x="7" y="12" width="18" height="7" rx="3" fill="#94a3b8" /><rect x="11" y="5" width="10" height="9" rx="3" fill="#38bdf8" /></>}
      {type === 'slide_switch' && <><rect x="5" y="8" width="22" height="10" rx="5" fill="#cbd5e1" /><circle cx="20" cy="13" r="5" fill="#475569" /></>}
      {type === 'potentiometer' && <><circle cx="16" cy="12" r="8" fill="#f59e0b" /><path d="M16 12l5-5" stroke="#7c2d12" strokeWidth="2" /></>}
      {type === 'motor' && <><circle cx="16" cy="12" r="8" fill="#e2e8f0" stroke="#475569" strokeWidth="2" /><path d="M16 4v16M8 12h16" stroke="#475569" strokeWidth="2" /></>}
      {type === 'buzzer' && <><path d="M7 15h5l6 5V4l-6 5H7z" fill="#a78bfa" /><path d="M22 8c3 2 3 6 0 8" fill="none" stroke="#6d28d9" strokeWidth="2" /></>}
      {type === 'terminal' && <><circle cx="16" cy="12" r="8" fill="#f8fafc" stroke="#64748b" strokeWidth="2" /><path d="M11 12h10" stroke="#64748b" strokeWidth="2" /></>}
    </svg>
  )
}

function ComponentBody({ component, state, controls, readOnly, rotation = 0, onControl }) {
  const pressed = controls.pressed === true
  const closed = controls.closed === true
  const value = Number(controls.value ?? component.props?.value ?? 50)
  const outputLevel = Math.max(0.15, Math.min(1, state.level ?? 1))
  const motorDuration = `${Math.max(0.22, 1.1 - outputLevel * 0.75).toFixed(2)}s`
  const ledColor = LED_COLOR_OPTIONS.find(option => option.value === component.props?.color) ?? LED_COLOR_OPTIONS[0]
  return (
    <svg style={{ ...s.componentDrawing, transform: `rotate(${normalizeRotation(rotation)}deg)` }} viewBox="0 0 112 70" aria-hidden="true">
      {component.type === 'battery' && (
        <>
          <path d="M0 35h20M98 35h14" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="20" y="18" width="72" height="34" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
          <rect x="92" y="28" width="6" height="14" rx="2" fill="#64748b" />
          <text x="35" y="40" fontSize="18" fontWeight="700" fill="#111827">-</text>
          <text x="70" y="40" fontSize="16" fontWeight="700" fill="#ef4444">+</text>
        </>
      )}
      {component.type === 'led' && (
        <>
          <path d="M0 35h37M75 35h37" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="35" r="18" fill={state.on ? ledColor.fill : ledColor.offFill} stroke={ledColor.stroke} strokeWidth="3" opacity={state.on ? 0.55 + outputLevel * 0.45 : 1} />
          {state.on && <circle cx="56" cy="35" r="27" fill={ledColor.glow} opacity={0.08 + outputLevel * 0.22} />}
          <path d="M50 24l13 11-13 11z" fill="#fff" opacity="0.72" />
        </>
      )}
      {component.type === 'resistor' && (
        <>
          <path d="M0 35h30M82 35h30" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="30" y="20" width="52" height="30" rx="10" fill="#facc15" stroke="#a16207" strokeWidth="2" />
          <rect x="41" y="21" width="5" height="28" fill="#ef4444" />
          <rect x="54" y="21" width="5" height="28" fill="#111827" />
          <rect x="67" y="21" width="5" height="28" fill="#2563eb" />
          <text x="56" y="62" textAnchor="middle" fontSize="10" fontWeight="700" fill="#713f12">{formatResistance(getComponentResistanceOhms(component))}</text>
        </>
      )}
      {component.type === 'push_button' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="30" width="56" height="22" rx="9" fill="#94a3b8" />
          <rect
            data-control-action
            x="41"
            y={pressed ? 17 : 10}
            width="30"
            height="24"
            rx="8"
            fill={pressed ? '#0284c7' : '#38bdf8'}
            stroke="#075985"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', true) } }}
            onPointerUp={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', false) } }}
            onPointerLeave={event => { if (!readOnly) { event.stopPropagation(); onControl('pressed', false) } }}
          />
        </>
      )}
      {component.type === 'slide_switch' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="23" width="56" height="24" rx="12" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          <circle
            data-control-action
            cx={closed ? 70 : 42}
            cy="35"
            r="10"
            fill={closed ? '#16a34a' : '#475569'}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={event => { if (!readOnly) { event.stopPropagation(); onControl('closed', !closed) } }}
          />
        </>
      )}
      {component.type === 'potentiometer' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="32" r="25" fill="#f59e0b" stroke="#92400e" strokeWidth="3" />
          <path d={`M56 32 L${56 + 18 * Math.cos((value * 2.7 - 225) * Math.PI / 180)} ${32 + 18 * Math.sin((value * 2.7 - 225) * Math.PI / 180)}`} stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {component.type === 'motor' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="17" width="56" height="36" rx="8" fill="#bae6fd" stroke="#0369a1" strokeWidth="2" />
          <circle cx="56" cy="35" r="14" fill="#f8fafc" stroke="#075985" strokeWidth="3">
            {state.on && <animateTransform attributeName="transform" type="rotate" from="0 56 35" to="360 56 35" dur={motorDuration} repeatCount="indefinite" />}
          </circle>
          <path d="M56 21v28M42 35h28" stroke="#075985" strokeWidth="3" strokeLinecap="round">
            {state.on && <animateTransform attributeName="transform" type="rotate" from="0 56 35" to="360 56 35" dur={motorDuration} repeatCount="indefinite" />}
          </path>
        </>
      )}
      {component.type === 'buzzer' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M33 45h15l23 15V10L48 25H33z" fill="#c4b5fd" stroke="#6d28d9" strokeWidth="3" />
          <path d="M76 24c8 6 8 16 0 22" fill="none" stroke="#6d28d9" strokeWidth="3" opacity={state.on ? '1' : '0.35'} />
          {state.on && <path d="M84 16c13 10 13 28 0 38" fill="none" stroke="#a855f7" strokeWidth="3" opacity="0.75"><animate attributeName="opacity" values="0.2;1;0.2" dur="0.5s" repeatCount="indefinite" /></path>}
        </>
      )}
      {component.type === 'terminal' && (
        <>
          <circle cx="56" cy="35" r="23" fill="#f8fafc" stroke="#64748b" strokeWidth="3" />
          <path d="M42 35h28M56 21v45" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
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
  workspace: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '132px minmax(360px, 1fr) 230px', overflow: 'hidden' },
  palette: { padding: 10, borderRight: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  paletteBtn: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 7, padding: '8px 9px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 650 },
  paletteIcon: { width: 30, height: 26, borderRadius: 5, background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', fontSize: 11 },
  wireColorField: { display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 2, fontFamily: 'var(--font-body)' },
  wireColorLabel: { fontSize: 12, fontWeight: 700, color: '#475569' },
  wireColorSelect: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', fontSize: 12, padding: '6px 7px' },
  boardWrap: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#e2e8f0' },
  board: { position: 'relative', margin: 16, borderRadius: 8, background: '#fff7ed', boxShadow: 'inset 0 0 0 2px #fed7aa', touchAction: 'none', outline: 'none' },
  wires: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 3 },
  hole: { position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: '#334155', opacity: 0.45, transform: 'translate(-50%, -50%)' },
  component: { position: 'absolute', width: PART_W, height: PART_H, border: '2px solid #94a3b8', borderRadius: 7, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(15,23,42,0.16)', fontFamily: 'var(--font-body)', userSelect: 'none' },
  componentDrawing: { position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', transformOrigin: 'center' },
  componentLabel: { position: 'absolute', zIndex: 4, left: 6, top: 4, fontSize: 11, color: '#0f172a', background: 'rgba(255,255,255,0.72)', borderRadius: 4, padding: '1px 4px' },
  fixedBadge: { position: 'absolute', zIndex: 4, right: 6, top: 4, fontSize: 10, fontWeight: 700, color: '#7c2d12', background: '#fed7aa', borderRadius: 4, padding: '1px 4px' },
  componentType: { position: 'absolute', zIndex: 4, left: 6, bottom: 4, fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.72)', borderRadius: 4, padding: '1px 4px' },
  pinHandle: { position: 'absolute', zIndex: 4, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', transform: 'translate(-50%, -50%)', cursor: 'crosshair', boxShadow: '0 1px 5px rgba(15,23,42,0.28)' },
  status: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#334155' },
  shortStatus: { color: '#b91c1c', fontWeight: 700 },
  inspector: { padding: 12, borderLeft: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto', fontFamily: 'var(--font-body)' },
  inspectorTitle: { margin: '0 0 10px', fontSize: 16 },
  wireDetails: { display: 'grid', gap: 6, margin: '10px 0', fontSize: 12, color: '#334155' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#475569' },
  textInput: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', fontSize: 13, padding: '7px 8px' },
  stateList: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 10px', margin: '10px 0', padding: 8, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', fontSize: 12, color: '#334155' },
  stateTerm: { margin: 0, color: '#64748b' },
  stateValue: { margin: 0, fontWeight: 700, color: '#0f172a' },
  toggle: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  range: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  rotateBtn: { width: '100%', padding: '7px 10px', fontSize: 13, marginBottom: 10 },
  removeBtn: { width: '100%', padding: '7px 10px', fontSize: 13 },
  emptySelection: { margin: 0, color: '#64748b', fontSize: 13 },
  codePane: { flex: 1, padding: 12, background: '#0f172a' },
  codeTextarea: { width: '100%', height: '100%', resize: 'none', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: 12, fontFamily: 'var(--font-code)', fontSize: 13 },
  outputRail: { writingMode: 'vertical-rl', height: '100%', border: 0, background: '#f8fafc', color: '#7c3aed', fontWeight: 700, cursor: 'pointer' },
  collapseOutput: { border: '1px solid #fff', background: '#fff', borderRadius: 5, color: '#7c3aed', fontSize: 12 },
}
