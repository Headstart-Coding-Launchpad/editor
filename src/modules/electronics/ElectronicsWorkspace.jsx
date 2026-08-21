import React, { useEffect, useMemo, useRef, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import OutputPanel from '../../app/components/OutputPanel'
import PythonEditor from '../python/PythonEditor.jsx'
import {
  BATTERY_VOLTAGE_OPTIONS,
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  COMPONENT_TYPES,
  DEFAULT_MICROPYTHON_CODE,
  LED_COLOR_OPTIONS,
  RESISTOR_OPTIONS,
  WIRE_COLORS,
  circuitHasShort,
  cloneCircuit,
  getCircuitMetrics,
  getComponentState,
  getComponentResistanceOhms,
  getMicrocontrollerCode,
  getWireCurrentDirection,
  getWireColorForPins,
  getWireState,
  isMicrocontrollerSignalPin,
  makeNextGpioPinName,
  makeComponent,
  normalizeGpioPinName,
  normalizeMicrocontrollerPins,
  normalizeAvailableComponents,
  pinRef,
} from './circuit'

const PALETTE = COMPONENT_TYPES.map(type => [type, COMPONENT_LABELS[type] ?? type])

const GRID_X = 28
const GRID_Y = 24
const BOARD_PAD = 24
const PART_W = 112
const PART_H = 70
const LCD_PART_W = 196
const LCD_PART_H = 118
const PIN_SNAP_RADIUS = 34
const CONTROL_SLIDE_RANGE_PX = 64
const WIRE_CLEARANCE = 18
const WIRE_OBSTACLE_PAD = 8
const WIRE_EXIT_STUB = 12
const WIRE_LANE_GAP = 10
const WIRE_OVERLAP_PENALTY = 5000
const WIRE_CROSSING_PENALTY = 900
const WIRE_BEND_PENALTY = 70
const SENSOR_KIND_OPTIONS = ['light', 'temperature', 'distance']
const HIDDEN_EDGE_HOLE_ROWS = 1
const BOARD_SCALE_MIN = 0.5
const BOARD_SCALE_MAX = 1.5
const BOARD_SCALE_STEP = 0.1

function clampBoardScale(value) {
  return Math.min(BOARD_SCALE_MAX, Math.max(BOARD_SCALE_MIN, Math.round(value * 100) / 100))
}

export default function ElectronicsWorkspace({
  circuit,
  onChange,
  readOnly = false,
  showCodeTab = false,
  code = '',
  onCodeChange,
  onRunMicroPython,
  onStopMicroPython,
  onCheck,
  onReset,
  output = '',
  runStatus = null,
  running = false,
  checkPassed = false,
  title = 'Breadboard',
  availableComponents = null,
  setupMode = false,
  activeTab,
  onTabChange,
  onActivity,
  isInSandbox,
}) {
  const boardRef = useRef(null)
  const boardWrapRef = useRef(null)
  const panRef = useRef(null)
  const [tab, setTab] = useState('breadboard')
  const [selectedId, setSelectedId] = useState(circuit.components[0]?.id ?? null)
  const [selectedWireId, setSelectedWireId] = useState(null)
  const [drag, setDrag] = useState(null)
  const [isPanning, setIsPanning] = useState(false)
  const [wireColor, setWireColor] = useState('auto')
  const [boardScale, setBoardScale] = useState(1)
  const [outputCollapsed, setOutputCollapsed] = useState(!showCodeTab)
  const selectedTab = activeTab ?? tab
  const selected = circuit.components.find(c => c.id === selectedId) ?? null
  const selectedWire = circuit.wires.find(wire => wire.id === selectedWireId) ?? null
  const selectedWireState = selectedWire ? getWireState(circuit, selectedWire) : null
  const activeMicrocontroller = circuit.components.find(component => component.type === 'microcontroller') ?? null
  const hasCodeTab = showCodeTab || Boolean(activeMicrocontroller)
  const microPythonCode = activeMicrocontroller ? getMicrocontrollerCode(circuit) : code
  const selectedMicrocontrollerPins = selected?.type === 'microcontroller' ? normalizeMicrocontrollerPins(selected.pins) : []
  const selectedSupplyPins = selectedMicrocontrollerPins.filter(pin => !isMicrocontrollerSignalPin(pin))
  const selectedGpioPins = selectedMicrocontrollerPins.filter(isMicrocontrollerSignalPin)
  const paletteTypes = useMemo(() => normalizeAvailableComponents(availableComponents), [availableComponents])
  const boardRows = Number(circuit.board?.rows ?? 14)
  const boardCols = Number(circuit.board?.cols ?? 20)
  const boardGridWidth = BOARD_PAD * 2 + (boardCols - 1) * GRID_X
  const boardGridHeight = BOARD_PAD * 2 + (boardRows - 1) * GRID_Y
  const largestPart = circuit.components.reduce((largest, component) => {
    const size = componentDimensions(component)
    return { width: Math.max(largest.width, size.width), height: Math.max(largest.height, size.height) }
  }, { width: PART_W, height: PART_H })
  const boardWidth = boardGridWidth + largestPart.width + 24
  const boardHeight = boardGridHeight + largestPart.height + 24
  const stats = useMemo(() => ({
    ledsOn: circuit.components.filter(c => c.type === 'led' && getComponentState(circuit, c.id).on).length,
    rgbLedsOn: circuit.components.filter(c => c.type === 'rgb_led' && getComponentState(circuit, c.id).on).length,
    motorsOn: circuit.components.filter(c => c.type === 'motor' && getComponentState(circuit, c.id).on).length,
    servosOn: circuit.components.filter(c => c.type === 'servo_motor' && getComponentState(circuit, c.id).on).length,
    buzzersOn: circuit.components.filter(c => c.type === 'buzzer' && getComponentState(circuit, c.id).on).length,
  }), [circuit])
  const hasShort = useMemo(() => circuitHasShort(circuit), [circuit])
  const circuitMetrics = useMemo(() => getCircuitMetrics(circuit), [circuit])

  function selectTab(nextTab) {
    if (activeTab == null) setTab(nextTab)
  }

  // Reports the tab actually on screen, including its initial value and changes driven by
  // the controlled `activeTab` prop (teacher-live), not just local clicks.
  useEffect(() => {
    onTabChange?.(selectedTab)
  }, [selectedTab, onTabChange])

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

  function clampComponentPosition(position, component) {
    const { width, height } = componentDimensions(component)
    const anchor = componentAnchorOffset(component)
    const offsets = (component.pins?.length ? component.pins : ['a']).map((pin, index) => pinOffset(component, pin, index))
    const lastHoleX = BOARD_PAD + (boardCols - 1) * GRID_X
    const lastHoleY = BOARD_PAD + (boardRows - 1) * GRID_Y
    let minCol = Math.ceil((anchor.x - BOARD_PAD) / GRID_X) + 1
    let maxCol = Math.floor((boardGridWidth - width + anchor.x - BOARD_PAD) / GRID_X) + 1
    let minRow = Math.ceil((anchor.y - BOARD_PAD) / GRID_Y) + 1
    let maxRow = Math.floor((boardGridHeight - height + anchor.y - BOARD_PAD) / GRID_Y) + 1

    offsets.forEach(offset => {
      minCol = Math.max(minCol, Math.ceil((anchor.x - offset.x) / GRID_X) + 1)
      maxCol = Math.min(maxCol, Math.floor((lastHoleX + anchor.x - offset.x - BOARD_PAD) / GRID_X) + 1)
      minRow = Math.max(minRow, Math.ceil((anchor.y - offset.y) / GRID_Y) + 1)
      maxRow = Math.min(maxRow, Math.floor((lastHoleY + anchor.y - offset.y - BOARD_PAD) / GRID_Y) + 1)
    })

    const row = Number(position.row)
    const col = Number(position.col)
    return {
      row: clamp(Math.round(Number.isFinite(row) ? row : 1), Math.min(minRow, maxRow), Math.max(minRow, maxRow)),
      col: clamp(Math.round(Number.isFinite(col) ? col : 1), Math.min(minCol, maxCol), Math.max(minCol, maxCol)),
    }
  }

  function componentPoint(component) {
    const position = clampComponentPosition(component.position ?? { row: 1, col: 1 }, component)
    const anchor = componentAnchorOffset(component)
    return {
      x: BOARD_PAD + (position.col - 1) * GRID_X - anchor.x,
      y: BOARD_PAD + (position.row - 1) * GRID_Y - anchor.y,
    }
  }

  function boardPoint(event) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (event.clientX - rect.left) / boardScale,
      y: (event.clientY - rect.top) / boardScale,
    }
  }

  function handleBoardWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setBoardScale(prev => clampBoardScale(prev + (event.deltaY < 0 ? BOARD_SCALE_STEP : -BOARD_SCALE_STEP)))
  }

  function positionFromPoint(point, offset = { x: PART_W / 2, y: PART_H / 2 }, component = null) {
    const anchor = component ? componentAnchorOffset(component) : { x: offset.x, y: offset.y }
    const position = {
      col: Math.round((point.x - offset.x + anchor.x - BOARD_PAD) / GRID_X) + 1,
      row: Math.round((point.y - offset.y + anchor.y - BOARD_PAD) / GRID_Y) + 1,
    }
    return component ? clampComponentPosition(position, component) : clampPosition(position)
  }

  function addComponent(type, position) {
    if (!paletteTypes.includes(type)) return
    const count = circuit.components.filter(c => c.type === type).length + 1
    const next = cloneCircuit(circuit)
    const fallback = { row: 2 + (count % Math.max(1, boardRows - 2)), col: 3 + (count % Math.max(1, boardCols - 4)) }
    const component = makeComponent(type, count, position ?? fallback)
    component.position = clampComponentPosition(component.position, component)
    next.components.push(component)
    selectComponent(component.id)
    update(next)
  }

  function moveComponent(id, position) {
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === id
      ? { ...component, position: clampComponentPosition(position, component) }
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
      if (selectedWire.locked && !setupMode) return
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
    if (!selectedWire || (selectedWire.locked && !setupMode)) return
    const next = cloneCircuit(circuit)
    next.wires = next.wires.map(wire => wire.id === selectedWire.id ? { ...wire, color } : wire)
    update(next)
  }

  function updateSelectedWireLocked(locked) {
    if (!selectedWire) return
    const next = cloneCircuit(circuit)
    next.wires = next.wires.map(wire => wire.id === selectedWire.id ? { ...wire, locked } : wire)
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

  function updateMicrocontrollerCode(nextCode) {
    if (!activeMicrocontroller) {
      onCodeChange?.(nextCode)
      return
    }
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === activeMicrocontroller.id
      ? { ...component, props: { ...(component.props ?? {}), code: nextCode } }
      : component)
    next.microcontroller = { ...(next.microcontroller ?? {}), enabled: true, code: nextCode }
    update(next)
  }

  function addGpioPin() {
    const target = selected?.type === 'microcontroller' ? selected : activeMicrocontroller
    if (!target) return
    const nextPin = makeNextGpioPinName(target.pins)
    const next = cloneCircuit(circuit)
    const pins = normalizeMicrocontrollerPins([...(target.pins ?? []), nextPin])
    next.components = next.components.map(component => component.id === target.id
      ? { ...component, pins }
      : component)
    const control = next.controls?.[target.id] ?? {}
    next.controls = {
      ...(next.controls ?? {}),
      [target.id]: {
        ...control,
        gpio: {
          ...(control.gpio ?? {}),
          [nextPin]: 0,
        },
      },
    }
    setSelectedId(target.id)
    update(next)
  }

  function renameGpioPin(oldPin, rawPin) {
    if (!selected || selected.type !== 'microcontroller') return
    const nextPin = normalizeGpioPinName(rawPin)
    if (!nextPin || nextPin === oldPin) return
    const pins = normalizeMicrocontrollerPins(selected.pins, [])
    if (pins.includes(nextPin)) return
    const oldRef = pinRef(selected.id, oldPin)
    const nextRef = pinRef(selected.id, nextPin)
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === selected.id
      ? { ...component, pins: pins.map(pin => pin === oldPin ? nextPin : pin) }
      : component)
    next.wires = next.wires.map(wire => ({
      ...wire,
      from: wire.from === oldRef ? nextRef : wire.from,
      to: wire.to === oldRef ? nextRef : wire.to,
    }))
    const control = next.controls?.[selected.id]
    if (control?.gpio) {
      const gpio = { ...control.gpio }
      if (Object.prototype.hasOwnProperty.call(gpio, oldPin)) {
        gpio[nextPin] = gpio[oldPin]
        delete gpio[oldPin]
      }
      next.controls = { ...(next.controls ?? {}), [selected.id]: { ...control, gpio } }
    }
    update(next)
  }

  function removeGpioPin(pin) {
    if (!selected || selected.type !== 'microcontroller') return
    const pins = normalizeMicrocontrollerPins(selected.pins, [])
    const signalPins = pins.filter(isMicrocontrollerSignalPin)
    if (signalPins.length <= 1 || !signalPins.includes(pin)) return
    const ref = pinRef(selected.id, pin)
    const next = cloneCircuit(circuit)
    next.components = next.components.map(component => component.id === selected.id
      ? { ...component, pins: pins.filter(item => item !== pin) }
      : component)
    next.wires = next.wires.filter(wire => wire.from !== ref && wire.to !== ref)
    const control = next.controls?.[selected.id]
    if (control?.gpio) {
      const gpio = { ...control.gpio }
      delete gpio[pin]
      next.controls = { ...(next.controls ?? {}), [selected.id]: { ...control, gpio } }
    }
    update(next)
  }

  function rotateSelectedComponent() {
    if (!selected || (selected.locked && !setupMode)) return
    const rotation = normalizeRotation((Number(selected.rotation ?? 0) + 90) % 360)
    const rotated = { ...selected, rotation }
    updateSelectedComponent({ rotation, position: clampComponentPosition(rotated.position ?? { row: 1, col: 1 }, rotated) })
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
    return getWireState(circuit, wire).energized
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

  // Drags a component's on-canvas slider handle (currently the potentiometer)
  // using the same board-level pointer-capture machinery as component/wire
  // drags. The value change is relative to the pointer's horizontal movement
  // since pointer-down, so it stays correct regardless of the component's
  // on-board position or rotation.
  function startControlSlide(event, component) {
    if (readOnly || (component.locked && !setupMode) || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    selectComponent(component.id)
    const startValue = Number(circuit.controls[component.id]?.value ?? component.props?.value ?? 50)
    setDrag({ type: 'control', id: component.id, startPoint: boardPoint(event), startValue })
    boardRef.current?.setPointerCapture?.(event.pointerId)
  }

  function handleBoardPointerMove(event) {
    if (!drag) return
    const point = boardPoint(event)
    if (drag.type === 'component') {
      const component = circuit.components.find(item => item.id === drag.id)
      if (component) moveComponent(drag.id, positionFromPoint(point, drag.offset, component))
    } else if (drag.type === 'wire') {
      const snap = nearestPin(point, drag.from)
      setDrag(current => current?.type === 'wire' ? { ...current, current: snap?.point ?? point, to: snap?.ref ?? null } : current)
    } else if (drag.type === 'control') {
      const deltaX = point.x - drag.startPoint.x
      const nextValue = Math.round(Math.min(100, Math.max(0, drag.startValue + (deltaX / CONTROL_SLIDE_RANGE_PX) * 100)))
      updateControlFor(drag.id, 'value', nextValue)
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

  function interactivePanTarget(target) {
    return target?.closest?.('[data-component], [data-pin-ref], [data-wire-hit], [data-control-action], button, input, select, textarea, a')
  }

  function startBoardPan(event) {
    if (event.defaultPrevented || event.button !== 0 || drag || interactivePanTarget(event.target)) return
    const wrap = boardWrapRef.current
    if (!wrap) return
    event.preventDefault()
    boardRef.current?.focus?.()
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
    }
    setIsPanning(true)
    wrap.setPointerCapture?.(event.pointerId)
  }

  function moveBoardPan(event) {
    const pan = panRef.current
    const wrap = boardWrapRef.current
    if (!pan || !wrap || pan.pointerId !== event.pointerId) return
    event.preventDefault()
    wrap.scrollLeft = pan.scrollLeft - (event.clientX - pan.x)
    wrap.scrollTop = pan.scrollTop - (event.clientY - pan.y)
  }

  function stopBoardPan(event) {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return
    boardWrapRef.current?.releasePointerCapture?.(event.pointerId)
    panRef.current = null
    setIsPanning(false)
  }

  const componentRects = circuit.components.map(component => {
    const point = componentPoint(component)
    return {
      id: component.id,
      type: component.type,
      ...rotatedComponentRect(point, component),
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
          <button className={selectedTab === 'breadboard' ? 'ui-tab is-active' : 'ui-tab'} onClick={() => selectTab('breadboard')}>Breadboard</button>
          {hasCodeTab && <button className={selectedTab === 'code' ? 'ui-tab is-active' : 'ui-tab'} onClick={() => selectTab('code')}>MicroPython</button>}
        </div>
        <div style={s.actions}>
          {selectedTab === 'breadboard' && (
            <div style={s.zoomControls}>
              <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={() => setBoardScale(prev => clampBoardScale(prev - BOARD_SCALE_STEP))} aria-label="Zoom out">−</button>
              <span style={s.zoomLabel}>{Math.round(boardScale * 100)}%</span>
              <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={() => setBoardScale(prev => clampBoardScale(prev + BOARD_SCALE_STEP))} aria-label="Zoom in">+</button>
              {boardScale !== 1 && (
                <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={() => setBoardScale(1)}>Reset</button>
              )}
            </div>
          )}
          {setupMode && activeMicrocontroller && (
            <button type="button" className="btn-primary" style={s.actionBtn} onClick={addGpioPin}>
              Add GPIO
            </button>
          )}
          {hasCodeTab && onRunMicroPython && (
            <button
              className={running ? 'btn-danger' : 'btn-primary'}
              style={s.actionBtn}
              disabled={running && !onStopMicroPython}
              onClick={running ? onStopMicroPython : onRunMicroPython}
            >
              {running ? 'Stop MicroPython' : 'Run MicroPython'}
            </button>
          )}
          {onCheck && <button className="btn-primary" style={s.actionBtn} onClick={onCheck}>Check Circuit</button>}
          {onReset && <button className="btn-ghost-outline" style={s.actionBtn} onClick={onReset}>Reset</button>}
        </div>
      </div>
      {selectedTab === 'code' && hasCodeTab ? (
        <div style={s.codePane}>
          <PythonEditor
            code={microPythonCode ?? DEFAULT_MICROPYTHON_CODE}
            onChange={updateMicrocontrollerCode}
            onActivity={onActivity}
            readOnly={readOnly}
            pyodideStatus={running ? 'ready' : null}
            onRunShortcut={readOnly || !onRunMicroPython ? undefined : (running ? onStopMicroPython : onRunMicroPython)}
            editorStyle={s.codeEditor}
          />
        </div>
      ) : (
        <div style={s.workspace}>
          <div style={s.palette}>
            <p style={s.paletteHint}>Drag a part onto the board, then drag from one pin to another to wire them together.</p>
            {PALETTE.filter(([type]) => paletteTypes.includes(type)).map(([type, label]) => (
              <button key={type} type="button" disabled={readOnly} draggable={!readOnly} title={COMPONENT_DESCRIPTIONS[type] ?? label} style={s.paletteBtn} onClick={() => addComponent(type)} onDragStart={event => handlePaletteDragStart(event, type)}>
                <span style={s.paletteIcon}><PaletteGlyph type={type} /></span>
                <span style={s.paletteLabel}>{label}</span>
              </button>
            ))}
            <label style={s.wireColorField}>
              <span style={s.wireColorLabel}>Wire colour</span>
              <select disabled={readOnly} value={wireColor} onChange={event => setWireColor(event.target.value)} style={s.wireColorSelect}>
                {WIRE_COLORS.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
              </select>
            </label>
          </div>
          <div
            ref={boardWrapRef}
            style={{ ...s.boardWrap, ...(isPanning ? s.boardWrapPanning : null) }}
            onPointerDown={startBoardPan}
            onPointerMove={moveBoardPan}
            onPointerUp={stopBoardPan}
            onPointerCancel={stopBoardPan}
            onWheel={handleBoardWheel}
          >
            <div style={{ ...s.boardScaleSizer, width: boardWidth * boardScale, height: boardHeight * boardScale }}>
            <div
              ref={boardRef}
              style={{ ...s.board, width: boardWidth, height: boardHeight, minWidth: boardWidth, minHeight: boardHeight, transform: `scale(${boardScale})` }}
              tabIndex={readOnly ? undefined : 0}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerCancel={handleBoardPointerUp}
              onKeyDown={handleWorkspaceKeyDown}
              onDragOver={event => event.preventDefault()}
              onDrop={handleBoardDrop}
            >
              <div style={{ ...s.boardSurface, width: boardGridWidth, height: boardGridHeight }} />
              {Array.from({ length: boardRows }).map((_, row) => (
                row < HIDDEN_EDGE_HOLE_ROWS || row >= boardRows - HIDDEN_EDGE_HOLE_ROWS ? null : Array.from({ length: boardCols }).map((__, col) => (
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
                        data-wire-hit
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
                      <path d={path} stroke={isSelected ? '#7c3aed' : '#1f2937'} strokeWidth={isSelected ? '9' : '7'} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={isSelected ? '0.34' : '0.22'} style={{ pointerEvents: 'none' }} />
                      <path d={path} stroke={wire.color ?? '#ef4444'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ pointerEvents: 'none' }} />
                      {energized && (
                        <path d={currentPath} stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 12" fill="none" style={{ pointerEvents: 'none' }}>
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
                    data-component
                    key={component.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      ...s.component,
                      ...componentDimensions(component),
                      left: point.x,
                      top: point.y,
                      borderColor: selectedId === component.id ? '#7c3aed' : state.on || state.powered || state.switched || state.conducting ? '#16a34a' : '#94a3b8',
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
                      onSlideStart={event => startControlSlide(event, component)}
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
            </div>
            <div style={s.status}>
              <span>{circuit.components.length} parts</span>
              <span>{circuit.wires.length} wires</span>
              <span>{formatVoltage(circuitMetrics.supplyVoltage)} supply</span>
              <span>{formatCurrent(circuitMetrics.totalCurrentMa)} total</span>
              <span>{stats.ledsOn} LEDs on</span>
              <span>{stats.rgbLedsOn} RGB LEDs on</span>
              <span>{stats.motorsOn} motors on</span>
              <span>{stats.servosOn} servos on</span>
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
                {selectedWireState && (
                  <dl style={s.stateList}>
                    <dt style={s.stateTerm}>Voltage</dt>
                    <dd style={s.stateValue}>{formatVoltage(selectedWireState.voltage)}</dd>
                    <dt style={s.stateTerm}>Current</dt>
                    <dd style={s.stateValue}>{formatCurrent(selectedWireState.currentMa)}</dd>
                    <dt style={s.stateTerm}>Drop</dt>
                    <dd style={s.stateValue}>{formatVoltage(selectedWireState.voltageDrop)}</dd>
                    <dt style={s.stateTerm}>Direction</dt>
                    <dd style={s.stateValue}>{selectedWireState.direction === 'reverse' ? 'reverse' : 'forward'}</dd>
                  </dl>
                )}
                {setupMode && (
                  <label style={s.toggle}>
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={selectedWire.locked === true}
                      onChange={event => updateSelectedWireLocked(event.target.checked)}
                    />
                    Fixed for students
                  </label>
                )}
                <label style={s.wireColorField}>
                  <span style={s.wireColorLabel}>Wire colour</span>
                  <select disabled={readOnly || (selectedWire.locked && !setupMode)} value={selectedWire.color ?? '#ef4444'} onChange={event => updateSelectedWireColor(event.target.value)} style={s.wireColorSelect}>
                    {WIRE_COLORS.filter(color => color.value !== 'auto').map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
                  </select>
                </label>
                <button disabled={readOnly || (selectedWire.locked && !setupMode)} className="btn-danger" style={s.removeBtn} onClick={removeSelected}>Delete wire</button>
              </>
            ) : selected ? (
              <>
                <h3 style={s.inspectorTitle}>{selected.label}</h3>
                {COMPONENT_DESCRIPTIONS[selected.type] && <p style={s.componentDescription}>{COMPONENT_DESCRIPTIONS[selected.type]}</p>}
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
                {selected.type === 'battery' && (
                  <label style={s.field}>
                    <span style={s.fieldLabel}>Voltage</span>
                    <select
                      disabled={readOnly || (selected.locked && !setupMode)}
                      value={Number(selected.props?.voltage ?? 5)}
                      onChange={event => updateSelectedComponentProps({ voltage: Number(event.target.value) })}
                      style={s.wireColorSelect}
                    >
                      {BATTERY_VOLTAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                {selected.type === 'transistor' && (
                  <label style={s.toggle}><input type="checkbox" disabled={readOnly || (selected.locked && !setupMode)} checked={circuit.controls[selected.id]?.baseHigh === true} onChange={e => updateControlFor(selected.id, 'baseHigh', e.target.checked)} /> Base signal high</label>
                )}
                {selected.type === 'servo_motor' && (
                  <label style={s.range}>Angle <input type="range" disabled={readOnly || (selected.locked && !setupMode)} min="0" max="180" value={circuit.controls[selected.id]?.angle ?? selected.props?.angle ?? 90} onChange={e => updateControlFor(selected.id, 'angle', Number(e.target.value))} /></label>
                )}
                {selected.type === 'sensor' && (
                  <>
                    {setupMode && (
                      <label style={s.field}>
                        <span style={s.fieldLabel}>Sensor type</span>
                        <select
                          disabled={readOnly || (selected.locked && !setupMode)}
                          value={selected.props?.kind ?? 'light'}
                          onChange={event => updateSelectedComponentProps({ kind: event.target.value })}
                          style={s.wireColorSelect}
                        >
                          {SENSOR_KIND_OPTIONS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                        </select>
                      </label>
                    )}
                    <label style={s.range}>Reading <input type="range" disabled={readOnly || (selected.locked && !setupMode)} min="0" max="100" value={circuit.controls[selected.id]?.value ?? selected.props?.value ?? 50} onChange={e => updateControlFor(selected.id, 'value', Number(e.target.value))} /></label>
                  </>
                )}
                {selected.type === 'microcontroller' && (
                  <div style={s.gpioEditor}>
                    <div style={s.gpioPowerPins}>
                      {selectedSupplyPins.map(pin => (
                        <span key={pin} style={s.gpioPowerPin}>{pin}</span>
                      ))}
                    </div>
                    <div style={s.gpioHeader}>
                      <span style={s.fieldLabel}>Signal pins</span>
                      {setupMode && (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={s.smallInspectorBtn}
                          disabled={readOnly || (selected.locked && !setupMode)}
                          onClick={addGpioPin}
                        >
                          Add pin
                        </button>
                      )}
                    </div>
                    <div style={s.gpioList}>
                      {selectedGpioPins.map(pin => (
                        <div key={pin} style={s.gpioRow}>
                          <input
                            disabled={readOnly || !setupMode || (selected.locked && !setupMode)}
                            defaultValue={pin}
                            onBlur={event => renameGpioPin(pin, event.target.value)}
                            style={s.gpioInput}
                          />
                          {setupMode && (
                            <button
                              type="button"
                              style={s.gpioRemove}
                              disabled={readOnly || selectedGpioPins.length <= 1}
                              onClick={() => removeGpioPin(pin)}
                              title={`Remove ${pin}`}
                              aria-label={`Remove ${pin}`}
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button disabled={readOnly || (selected.locked && !setupMode)} className="btn-danger" style={s.removeBtn} onClick={removeSelected}>Delete part</button>
              </>
            ) : <p style={s.emptySelection}>No selection</p>}
          </div>
        </div>
      )}
    </div>
  )

  if (!hasCodeTab) return breadboard

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

function componentDimensions(component) {
  return component?.type === 'lcd1602'
    ? { width: LCD_PART_W, height: LCD_PART_H }
    : { width: PART_W, height: PART_H }
}

function pinOffset(component, pin, pinIndex) {
  return rotateOffset(basePinOffset(component, pin, pinIndex), component.rotation, component)
}

function componentAnchorOffset(component) {
  const firstPin = component.pins?.[0] ?? 'a'
  return pinOffset(component, firstPin, 0)
}

function basePinOffset(component, pin, pinIndex) {
  if (component.type === 'microcontroller') {
    const pins = normalizeMicrocontrollerPins(component.pins)
    const leftCount = Math.ceil(pins.length / 2)
    if (pinIndex < leftCount) {
      const y = 12 + pinIndex * ((PART_H - 24) / Math.max(1, leftCount - 1))
      return { x: 4, y }
    }
    const rightIndex = pinIndex - leftCount
    const rightCount = pins.length - leftCount
    const y = 12 + rightIndex * ((PART_H - 24) / Math.max(1, rightCount - 1))
    return { x: PART_W - 4, y }
  }
  if (component.type === 'potentiometer') {
    const xs = [28, PART_W / 2, PART_W - 28]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (component.type === 'transistor' || component.type === 'sensor' || component.type === 'servo_motor') {
    const xs = [28, PART_W / 2, PART_W - 28]
    return { x: xs[pinIndex] ?? PART_W / 2, y: PART_H - 4 }
  }
  if (component.type === 'lcd1602') {
    const { width, height } = componentDimensions(component)
    const xs = [Math.round(width * 0.14), Math.round(width * 0.39), Math.round(width * 0.61), Math.round(width * 0.86)]
    return { x: xs[pinIndex] ?? width / 2, y: height - 6 }
  }
  if (component.type === 'rgb_led') {
    const xs = [14, 42, 70, 98]
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

function rotatedComponentRect(point, component) {
  const { width, height } = componentDimensions(component)
  const normalized = normalizeRotation(component.rotation)
  if (normalized === 90 || normalized === 270) {
    const centerX = point.x + width / 2
    const centerY = point.y + height / 2
    return {
      left: centerX - height / 2,
      top: centerY - width / 2,
      right: centerX + height / 2,
      bottom: centerY + width / 2,
    }
  }
  return {
    left: point.x,
    top: point.y,
    right: point.x + width,
    bottom: point.y + height,
  }
}

function rotateOffset(offset, rotation = 0, component = null) {
  const { width, height } = componentDimensions(component)
  const normalized = normalizeRotation(rotation)
  if (normalized === 0) return offset
  const centerX = width / 2
  const centerY = height / 2
  const x = offset.x - centerX
  const y = offset.y - centerY
  if (normalized === 90) return { x: centerX - y, y: centerY + x }
  if (normalized === 180) return { x: centerX - x, y: centerY - y }
  if (normalized === 270) return { x: centerX + y, y: centerY - x }
  return offset
}

function pinHandleStyle(pin) {
  const normalizedPin = String(pin).toLowerCase()
  if (pin === 'positive' || pin === 'anode' || pin === 'red' || normalizedPin === '3v3' || normalizedPin === 'vcc') return { background: '#ef4444', borderColor: '#fecaca' }
  if (pin === 'green') return { background: '#16a34a', borderColor: '#bbf7d0' }
  if (pin === 'negative' || pin === 'cathode' || pin === 'emitter' || normalizedPin === 'gnd') return { background: '#111827', borderColor: '#94a3b8' }
  if (pin === 'blue' || pin === 'signal' || pin === 'base' || normalizedPin === 'sda' || normalizedPin === 'scl' || normalizedPin.startsWith('gp')) return { background: '#2563eb', borderColor: '#bfdbfe' }
  return { background: '#f59e0b', borderColor: '#fde68a' }
}

function formatResistance(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  if (numeric >= 1000) return `${numeric / 1000}k ohm`
  return `${numeric} ohm`
}

function formatVoltage(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0V'
  return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2).replace(/\.?0+$/, '')}V`
}

function formatCurrent(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0mA'
  return `${numeric.toFixed(Math.abs(numeric) >= 10 ? 1 : 2).replace(/\.?0+$/, '')}mA`
}

function ComponentStateSummary({ component, state }) {
  const rows = []
  if (component.type === 'battery') rows.push(['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.totalCurrentMa)])
  if (component.type === 'resistor') rows.push(['Value', formatResistance(state.resistanceOhms)], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'led') rows.push(['Brightness', `${state.brightness ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'lcd1602') rows.push(['Power', state.powered ? 'on' : 'off'], ['Backlight', state.backlight ? 'on' : 'off'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'rgb_led') rows.push(['Channels', state.channels?.join(', ') || 'off'], ['Brightness', `${state.brightness ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'motor') rows.push(['Speed', `${state.speed ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'servo_motor') rows.push(['Angle', `${state.angle ?? 90} deg`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'buzzer') rows.push(['Volume', `${state.volume ?? 0}%`], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'diode') rows.push(['Conducting', state.conducting ? 'yes' : 'no'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'transistor') rows.push(['Base signal', state.baseHigh ? 'high' : 'low'], ['Switched', state.switched ? 'on' : 'off'])
  if (component.type === 'sensor') rows.push(['Type', state.kind], ['Reading', `${state.value ?? 0}%`], ['Powered', state.powered ? 'yes' : 'no'], ['Voltage', formatVoltage(state.voltage)], ['Current', formatCurrent(state.currentMa)])
  if (component.type === 'microcontroller') rows.push(['Runtime', 'MicroPython'], ['GPIO pins', normalizeMicrocontrollerPins(component.pins).length])
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
      {type === 'servo_motor' && <><rect x="6" y="8" width="18" height="10" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" /><path d="M16 8V3M16 3l7 4" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'buzzer' && <><path d="M7 15h5l6 5V4l-6 5H7z" fill="#a78bfa" /><path d="M22 8c3 2 3 6 0 8" fill="none" stroke="#6d28d9" strokeWidth="2" /></>}
      {type === 'rgb_led' && <><circle cx="16" cy="10" r="7" fill="#f8fafc" stroke="#475569" strokeWidth="2" /><circle cx="12" cy="10" r="2.5" fill="#ef4444" /><circle cx="16" cy="10" r="2.5" fill="#16a34a" /><circle cx="20" cy="10" r="2.5" fill="#2563eb" /><path d="M9 19h14" stroke="#334155" strokeWidth="2" /></>}
      {type === 'lcd1602' && <><rect x="3" y="4" width="26" height="17" rx="2" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" /><rect x="6" y="7" width="20" height="8" rx="1" fill="#d9f99d" /><path d="M8 18v4M14 18v4M20 18v4M26 18v4" stroke="#334155" strokeWidth="1.5" /></>}
      {type === 'microcontroller' && <><rect x="6" y="4" width="20" height="16" rx="3" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" /><path d="M10 8h12M10 12h12M10 16h12" stroke="#0369a1" strokeWidth="1.5" /><path d="M3 7h5M3 17h5M24 7h5M24 17h5" stroke="#334155" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'transistor' && <><circle cx="16" cy="12" r="9" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" /><path d="M7 12h8M16 4v16M16 16l7 5" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" /></>}
      {type === 'diode' && <><path d="M3 12h8M21 12h8" stroke="#334155" strokeWidth="2" /><path d="M11 6l10 6-10 6z" fill="#fbbf24" stroke="#92400e" strokeWidth="2" /><path d="M22 6v12" stroke="#92400e" strokeWidth="2" /></>}
      {type === 'sensor' && <><rect x="6" y="6" width="20" height="14" rx="4" fill="#dcfce7" stroke="#15803d" strokeWidth="2" /><path d="M11 15c2-5 4-5 6 0s4 5 6 0" fill="none" stroke="#15803d" strokeWidth="2" /></>}
      {type === 'terminal' && <><circle cx="16" cy="12" r="8" fill="#f8fafc" stroke="#64748b" strokeWidth="2" /><path d="M11 12h10" stroke="#64748b" strokeWidth="2" /></>}
    </svg>
  )
}

function ComponentBody({ component, state, controls, readOnly, rotation = 0, onControl, onSlideStart }) {
  const pressed = controls.pressed === true
  const closed = controls.closed === true
  const value = Number(controls.value ?? component.props?.value ?? 50)
  const servoAngle = Number(controls.angle ?? component.props?.angle ?? 90)
  const outputLevel = Math.max(0.15, Math.min(1, state.level ?? 1))
  const motorDuration = `${Math.max(0.22, 1.1 - outputLevel * 0.75).toFixed(2)}s`
  const ledColor = LED_COLOR_OPTIONS.find(option => option.value === component.props?.color) ?? LED_COLOR_OPTIONS[0]
  const rgbColor = state.on ? state.color : '#e5e7eb'
  return (
    <svg style={{ ...s.componentDrawing, transform: `rotate(${normalizeRotation(rotation)}deg)` }} viewBox="0 0 112 70" aria-hidden="true">
      {component.type === 'battery' && (
        <>
          <path d="M0 35h20M98 35h14" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="20" y="18" width="72" height="34" rx="6" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
          <rect x="92" y="28" width="6" height="14" rx="2" fill="#64748b" />
          <text x="35" y="40" fontSize="18" fontWeight="700" fill="#111827">-</text>
          <text x="70" y="40" fontSize="16" fontWeight="700" fill="#ef4444">+</text>
          <text x="56" y="61" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{formatVoltage(component.props?.voltage ?? 5)}</text>
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
      {component.type === 'rgb_led' && (
        <>
          <path d="M20 62v-9M44 62v-9M68 62v-9M92 62v-9" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {state.on && <circle cx="56" cy="31" r="30" fill={rgbColor} opacity={0.12 + outputLevel * 0.2} />}
          <circle cx="56" cy="31" r="22" fill={rgbColor} stroke="#475569" strokeWidth="3" />
          <circle cx="48" cy="28" r="4" fill="#ef4444" opacity={state.channels?.includes('red') ? 1 : 0.25} />
          <circle cx="56" cy="28" r="4" fill="#16a34a" opacity={state.channels?.includes('green') ? 1 : 0.25} />
          <circle cx="64" cy="28" r="4" fill="#2563eb" opacity={state.channels?.includes('blue') ? 1 : 0.25} />
          <text x="56" y="47" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">RGB</text>
        </>
      )}
      {component.type === 'lcd1602' && (
        <>
          <path d="M16 62v-9M44 62v-9M68 62v-9M96 62v-9" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="8" y="8" width="96" height="48" rx="6" fill="#2563eb" stroke="#1e3a8a" strokeWidth="3" />
          <rect x="16" y="16" width="80" height="26" rx="2" fill={state.powered && state.backlight ? '#d9f99d' : '#334155'} stroke="#0f172a" strokeWidth="2" />
          {state.powered && state.backlight && (
            <>
              <text x="20" y="27" fontFamily="monospace" fontSize="8" fill="#1a2e05">{state.lines?.[0] ?? ''}</text>
              <text x="20" y="36" fontFamily="monospace" fontSize="8" fill="#1a2e05">{state.lines?.[1] ?? ''}</text>
            </>
          )}
          <text x="56" y="52" textAnchor="middle" fontSize="7" fontWeight="700" fill="#dbeafe">I²C 16×2</text>
        </>
      )}
      {component.type === 'microcontroller' && (
        <>
          <rect x="12" y="8" width="88" height="54" rx="8" fill="#e0f2fe" stroke="#0369a1" strokeWidth="3" />
          <rect x="38" y="20" width="36" height="24" rx="4" fill="#0f172a" />
          <path d="M46 28h20M46 35h20" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="82" cy="23" r="4" fill="#22c55e" opacity="0.9" />
          <text x="56" y="55" textAnchor="middle" fontSize="10" fontWeight="700" fill="#075985">{normalizeMicrocontrollerPins(component.pins).length} GPIO</text>
          <path d="M8 14h8M8 26h8M8 38h8M8 50h8M96 14h8M96 26h8M96 38h8M96 50h8" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
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
          <rect
            data-control-action
            x="20"
            y="25"
            width="72"
            height="10"
            rx="5"
            fill="#fde68a"
            stroke="#92400e"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'ew-resize' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onSlideStart?.(event) } }}
          />
          <rect x="21" y="26" width={Math.max(2, 70 * (Math.min(100, Math.max(0, value)) / 100))} height="8" rx="4" fill="#f59e0b" style={{ pointerEvents: 'none' }} />
          <circle
            data-control-action
            cx={20 + 72 * (Math.min(100, Math.max(0, value)) / 100)}
            cy="30"
            r="9"
            fill="#7c2d12"
            stroke="#fde68a"
            strokeWidth="2"
            style={{ cursor: readOnly ? 'default' : 'ew-resize' }}
            onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onSlideStart?.(event) } }}
          />
          <text x="56" y="50" textAnchor="middle" fontSize="9" fontWeight="700" fill="#7c2d12" style={{ pointerEvents: 'none' }}>{Math.round(value)}%</text>
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
      {component.type === 'servo_motor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="24" y="25" width="64" height="30" rx="7" fill={state.on ? '#bfdbfe' : '#e2e8f0'} stroke="#2563eb" strokeWidth="3" />
          <circle cx="56" cy="40" r="9" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="3" />
          <path d="M56 40h27" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" transform={`rotate(${servoAngle - 90} 56 40)`} />
          <text x="56" y="20" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e3a8a">{servoAngle} deg</text>
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
      {component.type === 'transistor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <circle cx="56" cy="32" r="25" fill={state.switched ? '#dcfce7' : '#e0f2fe'} stroke="#0369a1" strokeWidth="3" />
          <path d="M32 32h18M56 14v36M56 46l21 14" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 49l7 11-12-5" fill="#0369a1" />
          {state.switched && <path d="M74 16c9 8 9 23 0 31" fill="none" stroke="#16a34a" strokeWidth="3" opacity="0.8" />}
          <text x="56" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#075985">B</text>
        </>
      )}
      {component.type === 'diode' && (
        <>
          <path d="M0 35h29M83 35h29" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M34 17l35 18-35 18z" fill={state.conducting ? '#fde68a' : '#fef3c7'} stroke="#92400e" strokeWidth="3" />
          <path d="M73 17v36" stroke="#92400e" strokeWidth="5" strokeLinecap="round" />
          {state.conducting && <path d="M42 35h22" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round"><animate attributeName="opacity" values="0.25;1;0.25" dur="0.65s" repeatCount="indefinite" /></path>}
        </>
      )}
      {component.type === 'sensor' && (
        <>
          <path d="M26 58v8M56 58v8M86 58v8" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <rect x="24" y="15" width="64" height="42" rx="9" fill={state.powered ? '#dcfce7' : '#f1f5f9'} stroke="#15803d" strokeWidth="3" />
          <path d="M36 42c7-24 13-24 20 0s13 24 20 0" fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
          <text x="56" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill="#166534">{state.kind ?? 'sensor'}</text>
          <text x="56" y="52" textAnchor="middle" fontSize="10" fontWeight="700" fill="#166534">{state.value ?? 0}%</text>
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
  zoomControls: { display: 'flex', alignItems: 'center', gap: 4 },
  zoomBtn: { fontSize: 13, padding: '5px 10px', lineHeight: 1 },
  zoomLabel: { minWidth: 38, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: '#475569' },
  workspace: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '216px minmax(0, 1fr) 230px', overflow: 'hidden' },
  palette: { minWidth: 0, padding: 10, borderRight: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8, overflowX: 'hidden', overflowY: 'auto' },
  paletteHint: { margin: 0, fontSize: 11.5, lineHeight: 1.4, color: '#64748b', fontFamily: 'var(--font-body)' },
  paletteBtn: { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', background: '#fff', borderRadius: 7, padding: '8px 9px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 650 },
  paletteIcon: { flexShrink: 0, width: 30, height: 26, borderRadius: 5, background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', fontSize: 11 },
  paletteLabel: { minWidth: 0, whiteSpace: 'nowrap' },
  wireColorField: { display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 2, fontFamily: 'var(--font-body)' },
  wireColorLabel: { fontSize: 12, fontWeight: 700, color: '#475569' },
  wireColorSelect: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', fontSize: 12, padding: '6px 7px' },
  boardWrap: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#e2e8f0', cursor: 'grab' },
  boardWrapPanning: { cursor: 'grabbing', userSelect: 'none' },
  boardScaleSizer: { position: 'relative', flexShrink: 0, margin: 16 },
  board: { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', touchAction: 'none', outline: 'none' },
  boardSurface: { position: 'absolute', left: 0, top: 0, borderRadius: 8, background: '#fff7ed', boxShadow: 'inset 0 0 0 2px #fed7aa', pointerEvents: 'none', zIndex: 0 },
  wires: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 3 },
  hole: { position: 'absolute', zIndex: 1, width: 7, height: 7, borderRadius: '50%', background: '#334155', opacity: 0.45, transform: 'translate(-50%, -50%)' },
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
  componentDescription: { margin: '0 0 10px', fontSize: 12, lineHeight: 1.35, color: '#475569' },
  wireDetails: { display: 'grid', gap: 6, margin: '10px 0', fontSize: 12, color: '#334155' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#475569' },
  textInput: { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', fontSize: 13, padding: '7px 8px' },
  stateList: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 10px', margin: '10px 0', padding: 8, border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', fontSize: 12, color: '#334155' },
  stateTerm: { margin: 0, color: '#64748b' },
  stateValue: { margin: 0, fontWeight: 700, color: '#0f172a' },
  toggle: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  range: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  gpioEditor: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, padding: 8, border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' },
  gpioPowerPins: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  gpioPowerPin: { display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 5, background: '#fff', color: '#334155', fontFamily: 'var(--font-code)', fontSize: 11, fontWeight: 700, padding: '3px 6px' },
  gpioHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gpioList: { display: 'flex', flexDirection: 'column', gap: 6 },
  gpioRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 28px', gap: 6, alignItems: 'center' },
  gpioInput: { minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', fontSize: 12, padding: '6px 7px', fontFamily: 'var(--font-code)' },
  gpioRemove: { width: 28, height: 28, border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: 13, fontWeight: 800, lineHeight: 1 },
  smallInspectorBtn: { padding: '4px 7px', fontSize: 11 },
  rotateBtn: { width: '100%', padding: '7px 10px', fontSize: 13, marginBottom: 10 },
  removeBtn: { width: '100%', padding: '7px 10px', fontSize: 13 },
  emptySelection: { margin: 0, color: '#64748b', fontSize: 13 },
  codePane: { flex: 1, minHeight: 0, display: 'flex', padding: 12, background: '#f8fafc' },
  codeEditor: { minHeight: 0, borderColor: '#cbd5e1', background: '#fff' },
  outputRail: { writingMode: 'vertical-rl', height: '100%', border: 0, background: '#f8fafc', color: '#7c3aed', fontWeight: 700, cursor: 'pointer' },
  collapseOutput: { border: '1px solid #fff', background: '#fff', borderRadius: 5, color: '#7c3aed', fontSize: 12 },
}
