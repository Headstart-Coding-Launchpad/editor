import React, { useEffect, useMemo, useRef, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import OutputPanel from '../../app/components/OutputPanel'
import PythonEditor from '../python/PythonEditor.jsx'
import {
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  COMPONENT_TYPES,
  DEFAULT_MICROPYTHON_CODE,
  WIRE_COLORS,
  circuitHasShort,
  cloneCircuit,
  getComponentState,
  getMicrocontrollerCode,
  getShortCircuitPath,
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
import { ComponentBody, LockGlyph, PaletteGlyph } from './ComponentArt.jsx'
import {
  BOARD_PAD,
  GRID_X,
  GRID_Y,
  PART_H,
  PART_W,
  clamp,
  componentAnchorOffset,
  componentDimensions,
  pinHandleStyle,
  pinOffset,
  rotatedComponentRect,
} from './boardGeometry'
import Inspector from './Inspector.jsx'
import { pathFromPoints, directWirePath, segmentsFromPoints, wireRoutePoints } from './wireRouting'
import { PART_BORDER, PART_LIVE, SELECTION_COLOUR, SHORT_COLOUR, s } from './workspaceStyles'

const PALETTE = COMPONENT_TYPES.map(type => [type, COMPONENT_LABELS[type] ?? type])

const PIN_SNAP_RADIUS = 34
const CONTROL_SLIDE_RANGE_PX = 64
// Semantic colours from docs/UI_STYLE_GUIDE.md. Everything else in this file's chrome

const HIDDEN_EDGE_HOLE_ROWS = 1
const BOARD_SCALE_MIN = 0.5
const BOARD_SCALE_MAX = 1.5
const BOARD_SCALE_STEP = 0.1
// Breathing room kept around the board when auto-fitting it to the pane.
const BOARD_FIT_MARGIN = 40

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
  highlightedTabs,
  forcedTab,
  forcedTabToken,
  onActivity,
  isInSandbox,
}) {
  const boardRef = useRef(null)
  const boardWrapRef = useRef(null)
  const panRef = useRef(null)
  // Auto-fit follows the board until the student takes control of the zoom themselves.
  const userSetZoomRef = useRef(false)
  const [tab, setTab] = useState('breadboard')
  const [selectedId, setSelectedId] = useState(circuit.components[0]?.id ?? null)
  const [selectedWireId, setSelectedWireId] = useState(null)
  const [drag, setDrag] = useState(null)
  const [isPanning, setIsPanning] = useState(false)
  const [wireColor, setWireColor] = useState('auto')
  const [boardScale, setBoardScale] = useState(1)
  // Mirrors `hasCodeTab` below, not `showCodeTab`: a task whose Micro Controller comes
  // from the circuit rather than `task.microcontroller.enabled` still gets the MicroPython
  // tab, so it should get the output panel open alongside it.
  const [outputCollapsed, setOutputCollapsed] = useState(() => (
    !(showCodeTab || circuit.components.some(component => component.type === 'microcontroller'))
  ))
  const selectedTab = activeTab ?? tab
  const selected = circuit.components.find(c => c.id === selectedId) ?? null
  // "Fixed" locks a part's structure for students; setup mode still edits it freely.
  const selectedStructureLocked = Boolean(selected?.locked) && !setupMode
  const selectedWire = circuit.wires.find(wire => wire.id === selectedWireId) ?? null
  const selectedWireState = selectedWire ? getWireState(circuit, selectedWire) : null
  const activeMicrocontroller = circuit.components.find(component => component.type === 'microcontroller') ?? null
  const hasCodeTab = showCodeTab || Boolean(activeMicrocontroller)
  const microPythonCode = activeMicrocontroller ? getMicrocontrollerCode(circuit) : code
  const selectedMicrocontrollerPins = selected?.type === 'microcontroller' ? normalizeMicrocontrollerPins(selected.pins) : []
  const selectedSupplyPins = selectedMicrocontrollerPins.filter(pin => !isMicrocontrollerSignalPin(pin))
  const selectedGpioPins = selectedMicrocontrollerPins.filter(isMicrocontrollerSignalPin)
  const paletteTypes = useMemo(() => normalizeAvailableComponents(availableComponents), [availableComponents])
  const hasPalette = paletteTypes.length > 0
  // The inspector is the palette column's opposite number: it was holding 230px open on
  // every board to display the words "No selection".
  const hasInspector = !!(selected || selectedWire)
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
  // The other device counts existed only for the status strip; the buzzer tone is the one
  // thing still driven by a live count.
  const buzzersOn = useMemo(() => (
    circuit.components.filter(c => c.type === 'buzzer' && getComponentState(circuit, c.id).on).length
  ), [circuit])
  const hasShort = useMemo(() => circuitHasShort(circuit), [circuit])
  // Only walked when there is actually a short, so the common case stays a cheap boolean.
  const shortPath = useMemo(
    () => (hasShort ? getShortCircuitPath(circuit) : { wireIds: [], componentIds: [] }),
    [hasShort, circuit],
  )
  const shortedWireIds = useMemo(() => new Set(shortPath.wireIds), [shortPath])
  const shortedComponentIds = useMemo(() => new Set(shortPath.componentIds), [shortPath])

  function selectTab(nextTab) {
    if (activeTab == null) setTab(nextTab)
  }

  // Scale the board down until it fits the pane, never past 100%. A 20x14 board in a
  // squeezed classroom pane used to open at 100% with both scrollbars, so a student had
  // to scroll to see a circuit that would comfortably fit at 80%. Zooming in past natural
  // size is deliberately not done - parts would read larger here than in any other task.
  function computeFitScale() {
    const pane = boardWrapRef.current
    if (!pane) return null
    const availableWidth = pane.clientWidth - BOARD_FIT_MARGIN
    const availableHeight = pane.clientHeight - BOARD_FIT_MARGIN
    if (availableWidth <= 0 || availableHeight <= 0) return null
    return clampBoardScale(Math.min(1, availableWidth / boardWidth, availableHeight / boardHeight))
  }

  function fitBoardToPane() {
    const scale = computeFitScale()
    if (scale != null) setBoardScale(scale)
    userSetZoomRef.current = false
  }

  function setZoomManually(next) {
    userSetZoomRef.current = true
    setBoardScale(next)
  }

  // Reports the tab actually on screen, including its initial value and changes driven by
  // the controlled `activeTab` prop (teacher-live), not just local clicks.
  useEffect(() => {
    onTabChange?.(selectedTab)
  }, [selectedTab, onTabChange])

  // Fit the board to the pane on load, and keep it fitted as the pane resizes - the
  // explainer opening and closing changes the available width substantially. Stops as
  // soon as the student sets a zoom themselves, until they press Fit again.
  useEffect(() => {
    if (selectedTab !== 'breadboard') return undefined
    const pane = boardWrapRef.current
    if (!pane) return undefined

    function applyFit() {
      if (userSetZoomRef.current) return
      const availableWidth = pane.clientWidth - BOARD_FIT_MARGIN
      const availableHeight = pane.clientHeight - BOARD_FIT_MARGIN
      if (availableWidth <= 0 || availableHeight <= 0) return
      setBoardScale(clampBoardScale(Math.min(1, availableWidth / boardWidth, availableHeight / boardHeight)))
    }

    applyFit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(applyFit)
    observer.observe(pane)
    return () => observer.disconnect()
  }, [selectedTab, boardWidth, boardHeight])

  // Teacher "force switch tab" — a one-time jump to Breadboard or MicroPython, applied via
  // the same local `tab` state a manual click would use (not the persistent `activeTab`
  // controlled prop used for live-mirroring), so the student stays free to switch away
  // again right after. Guarded by forcedTabToken (the command's pushedAt) so the same
  // token never re-applies on an unrelated re-render, and skipped entirely while
  // `activeTab` is actively controlling the tab (teacher live view).
  const lastForcedTabTokenRef = useRef(null)
  useEffect(() => {
    if (activeTab != null || !forcedTab || forcedTabToken == null || lastForcedTabTokenRef.current === forcedTabToken) return
    lastForcedTabTokenRef.current = forcedTabToken
    setTab(forcedTab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, forcedTab, forcedTabToken])

  useEffect(() => {
    if (buzzersOn === 0 || typeof window === 'undefined') return undefined
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
  }, [buzzersOn])

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
    setZoomManually(prev => clampBoardScale(prev + (event.deltaY < 0 ? BOARD_SCALE_STEP : -BOARD_SCALE_STEP)))
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
    if (readOnly || event.button !== 0) return
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

  // Bundled so the inspector takes one handler prop instead of ten.
  const inspectorActions = {
    addGpioPin,
    removeGpioPin,
    renameGpioPin,
    removeSelected,
    rotateSelectedComponent,
    updateControlFor,
    updateSelectedComponent,
    updateSelectedComponentProps,
    updateSelectedWireColor,
    updateSelectedWireLocked,
  }

  const breadboard = (
    <div style={s.shell}>
      <div style={s.header} className="ui-tabs ui-tabs--editor">
        {/* A label, not a tab. Styled as a muted eyebrow with a divider so it stops
            reading as a third selectable tab beside Breadboard/MicroPython - the Builder
            relies on it to say which board is open ("Starter board"/"Complete board"). */}
        <span style={s.title}>{title}</span>
        <span style={s.titleDivider} aria-hidden="true" />
        <div style={s.tabs}>
          <button className={`ui-tab ${selectedTab === 'breadboard' ? 'is-active' : ''} ${highlightedTabs?.includes('breadboard') ? 'pane-highlight-pulse' : ''}`} onClick={() => selectTab('breadboard')}>Breadboard</button>
          {hasCodeTab && <button className={`ui-tab ${selectedTab === 'code' ? 'is-active' : ''} ${highlightedTabs?.includes('code') ? 'pane-highlight-pulse' : ''}`} onClick={() => selectTab('code')}>MicroPython</button>}
        </div>
        <div style={s.actions}>
          {selectedTab === 'breadboard' && (
            <>
            <div style={s.zoomControls}>
              <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={() => setZoomManually(prev => clampBoardScale(prev - BOARD_SCALE_STEP))} aria-label="Zoom out">−</button>
              <span style={s.zoomLabel}>{Math.round(boardScale * 100)}%</span>
              <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={() => setZoomManually(prev => clampBoardScale(prev + BOARD_SCALE_STEP))} aria-label="Zoom in">+</button>
              <button type="button" className="btn-ghost-outline" style={s.zoomBtn} onClick={fitBoardToPane}>Fit</button>
            </div>
            {/* The colour new wires are drawn in - a tool setting, so it belongs with the
                other board tools rather than at the foot of a palette that can be empty
                while wiring is still allowed. */}
            <label style={s.wireColorToolbarField}>
              <span style={s.wireColorToolbarLabel}>Wire colour</span>
              <select disabled={readOnly} value={wireColor} onChange={event => setWireColor(event.target.value)} style={s.wireColorToolbarSelect}>
                {WIRE_COLORS.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}
              </select>
            </label>
            </>
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
          {onCheck && <button className="btn-secondary" style={s.actionBtn} onClick={onCheck}>Check Circuit</button>}
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
        <div style={{ ...s.workspace, gridTemplateColumns: [hasPalette && '216px', 'minmax(0, 1fr)', hasInspector && '230px'].filter(Boolean).join(' ') }}>
          {/* A task that supplies a pre-built board and no available components used to
              hold a 216px column open for a hint telling students to drag parts on. */}
          {hasPalette && (
            <div style={s.palette}>
              <p style={s.paletteHint}>Drag a part onto the board, then drag from one pin to another to wire them together.</p>
              {PALETTE.filter(([type]) => paletteTypes.includes(type)).map(([type, label]) => (
                <button key={type} type="button" disabled={readOnly} draggable={!readOnly} title={COMPONENT_DESCRIPTIONS[type] ?? label} style={s.paletteBtn} onClick={() => addComponent(type)} onDragStart={event => handlePaletteDragStart(event, type)}>
                  <span style={s.paletteIcon}><PaletteGlyph type={type} /></span>
                  <span style={s.paletteLabel}>{label}</span>
                </button>
              ))}
            </div>
          )}
          <div
            ref={boardWrapRef}
            style={{ ...s.boardWrap, ...(isPanning ? s.boardWrapPanning : null) }}
            onPointerDown={startBoardPan}
            onPointerMove={moveBoardPan}
            onPointerUp={stopBoardPan}
            onPointerCancel={stopBoardPan}
            onWheel={handleBoardWheel}
          >
            {hasShort && (
              <p style={s.shortWarning} role="status">
                <span aria-hidden="true" style={s.shortWarningMark}>!</span>
                Short circuit - the highlighted wires connect the supply straight back to
                itself, with no part in between.
              </p>
            )}
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
                  const isShorted = shortedWireIds.has(wire.id)
                  const currentPath = getWireCurrentDirection(circuit, wire) === 'reverse'
                    ? pathFromPoints([...points].reverse())
                    : path
                  return (
                    <g key={wire.id}>
                      {isShorted && (
                        <path
                          d={path}
                          stroke={SHORT_COLOUR}
                          strokeWidth="14"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity="0.3"
                          style={{ pointerEvents: 'none' }}
                        >
                          <animate attributeName="opacity" values="0.14;0.42;0.14" dur="1.1s" repeatCount="indefinite" />
                        </path>
                      )}
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
                      <path d={path} stroke={isSelected ? SELECTION_COLOUR : '#1f2937'} strokeWidth={isSelected ? '9' : '7'} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={isSelected ? '0.34' : '0.22'} style={{ pointerEvents: 'none' }} />
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
                // "Fixed" locks a part's *structure* for students - it cannot be dragged,
                // rotated, reconfigured or deleted. It stays operable: pressing a fixed
                // push button, flipping a fixed switch or turning a fixed potentiometer
                // only writes runtime control state, so a pre-built demo board is still
                // something the student can work rather than only look at.
                const structureLocked = component.locked && !setupMode
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
                      borderColor: shortedComponentIds.has(component.id)
                        ? SHORT_COLOUR
                        : selectedId === component.id ? 'var(--colour-primary)' : state.on || state.powered || state.switched || state.conducting ? PART_LIVE : PART_BORDER,
                      zIndex: selectedId === component.id ? 5 : 4,
                      cursor: readOnly || structureLocked ? 'default' : drag?.type === 'component' && drag.id === component.id ? 'grabbing' : 'grab',
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
                      readOnly={readOnly}
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
                              ? '0 0 0 5px rgba(98,34,204,0.24)'
                              : drag?.type === 'wire' && drag.to === ref
                                ? '0 0 0 6px rgba(22,163,74,0.28)'
                                : s.pinHandle.boxShadow,
                          }}
                          onPointerDown={event => startWireDrag(event, ref)}
                        />
                      )
                    })}
                    {/* Name only. The part is already drawn as what it is, so a type
                        caption underneath was redundant, and spelling out "Fixed" beside
                        the name collided with it on narrower parts - a lock mark carries
                        the same meaning in the corner without competing for the width. */}
                    <strong style={s.componentLabel}>{component.label}</strong>
                    {component.locked && (
                      <span
                        style={s.fixedBadge}
                        title={setupMode ? 'Fixed for students' : 'Fixed in place - you can still use its controls'}
                        aria-label={setupMode ? 'Fixed for students' : 'Fixed in place'}
                      >
                        <LockGlyph />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            </div>
          </div>
          {hasInspector && <Inspector
            circuit={circuit}
            selected={selected}
            selectedWire={selectedWire}
            selectedWireState={selectedWireState}
            selectedStructureLocked={selectedStructureLocked}
            setupMode={setupMode}
            readOnly={readOnly}
            actions={inspectorActions}
          />}
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
