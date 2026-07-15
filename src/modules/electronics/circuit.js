export const ELECTRONICS_CHECK_TYPES = [
  'circuit_no_short',
  'circuit_has_component',
  'circuit_component_powered',
  'circuit_component_unpowered',
  'circuit_control_affects_power',
  'circuit_path_exists',
  'circuit_path_includes',
]

export const COMPONENT_TYPES = [
  'battery',
  'resistor',
  'led',
  'push_button',
  'slide_switch',
  'potentiometer',
  'motor',
  'buzzer',
  'terminal',
]

export const COMPONENT_LABELS = {
  battery: 'Battery',
  resistor: 'Resistor',
  led: 'LED',
  push_button: 'Button',
  slide_switch: 'Switch',
  potentiometer: 'Pot',
  motor: 'Motor',
  buzzer: 'Buzzer',
  terminal: 'Junction',
}

export const DEFAULT_AVAILABLE_COMPONENTS = [...COMPONENT_TYPES]

export const RESISTOR_OPTIONS = [
  { value: 100, label: '100 ohm' },
  { value: 220, label: '220 ohm' },
  { value: 330, label: '330 ohm' },
  { value: 1000, label: '1k ohm' },
  { value: 4700, label: '4.7k ohm' },
  { value: 10000, label: '10k ohm' },
]

export const LED_COLOR_OPTIONS = [
  { value: 'red', label: 'Red', fill: '#fb7185', offFill: '#fecdd3', stroke: '#be123c', glow: '#fb7185' },
  { value: 'green', label: 'Green', fill: '#4ade80', offFill: '#bbf7d0', stroke: '#15803d', glow: '#22c55e' },
  { value: 'blue', label: 'Blue', fill: '#60a5fa', offFill: '#bfdbfe', stroke: '#1d4ed8', glow: '#3b82f6' },
]

const DEFAULT_RESISTANCE_OHMS = 330
const POTENTIOMETER_RESISTANCE_OHMS = 10000
const LOAD_RESISTANCE_OHMS = {
  led: 330,
  motor: 120,
  buzzer: 220,
}

export const WIRE_COLORS = [
  { value: 'auto', label: 'Auto' },
  { value: '#ef4444', label: 'Positive red' },
  { value: '#111827', label: 'Negative black' },
  { value: '#f59e0b', label: 'Signal amber' },
  { value: '#2563eb', label: 'Signal blue' },
  { value: '#16a34a', label: 'Signal green' },
  { value: '#7c3aed', label: 'Signal purple' },
]

export const DEFAULT_CIRCUIT = {
  version: 1,
  board: { type: 'half-breadboard', rows: 14, cols: 20 },
  components: [],
  wires: [],
  controls: {},
  microcontroller: { enabled: false, boardType: null, code: '' },
}

export function cloneCircuit(circuit = DEFAULT_CIRCUIT) {
  return JSON.parse(JSON.stringify(normalizeCircuit(circuit)))
}

export function parseCircuit(raw, fallback = DEFAULT_CIRCUIT) {
  if (!raw) return cloneCircuit(fallback)
  if (typeof raw === 'object') return cloneCircuit(raw)
  try {
    return cloneCircuit(JSON.parse(raw))
  } catch {
    return cloneCircuit(fallback)
  }
}

export function serializeCircuit(circuit) {
  return JSON.stringify(normalizeCircuit(circuit))
}

export function normalizeCircuit(circuit = DEFAULT_CIRCUIT) {
  return {
    version: 1,
    board: { type: 'half-breadboard', rows: 14, cols: 20, ...(circuit.board ?? {}) },
    components: Array.isArray(circuit.components) ? circuit.components : [],
    wires: Array.isArray(circuit.wires) ? circuit.wires : [],
    controls: circuit.controls && typeof circuit.controls === 'object' ? circuit.controls : {},
    microcontroller: {
      enabled: false,
      boardType: null,
      code: '',
      ...(circuit.microcontroller ?? {}),
    },
  }
}

export function pinRef(componentId, pin = '') {
  return pin ? `${componentId}.${pin}` : componentId
}

export function normalizeAvailableComponents(value) {
  if (!Array.isArray(value)) return [...DEFAULT_AVAILABLE_COMPONENTS]
  const seen = new Set()
  return value.filter(type => {
    if (!COMPONENT_TYPES.includes(type) || seen.has(type)) return false
    seen.add(type)
    return true
  })
}

export function getWireColorForPins(from, to, selected = 'auto') {
  if (selected && selected !== 'auto') return selected
  const refs = `${from ?? ''}.${to ?? ''}`.toLowerCase()
  if (refs.includes('positive') || refs.includes('anode')) return '#ef4444'
  if (refs.includes('negative') || refs.includes('cathode')) return '#111827'
  if (refs.includes('wiper')) return '#2563eb'
  return '#f59e0b'
}

export function findComponent(circuit, query) {
  return findComponents(circuit, query)[0] ?? null
}

export function findComponents(circuit, selector = {}) {
  const normalized = normalizeCircuit(circuit)
  return normalized.components.filter(component => componentMatchesSelector(component, selector))
}

function componentMatchesSelector(component, selector = {}) {
  const type = selector.type ?? selector.componentType ?? selector.typeName
  if (selector.id && component.id !== selector.id) return false
  if (type && component.type !== type) return false
  if (selector.label && String(component.label ?? '').toLowerCase() !== String(selector.label).toLowerCase()) return false
  return true
}

function internalConnections(component, controls, mode = 'signal') {
  const control = controls[component.id] ?? {}
  if (component.type === 'push_button') return control.pressed === true ? [['a', 'b']] : []
  if (component.type === 'slide_switch') return control.closed === true ? [['a', 'b']] : []
  if (component.type === 'terminal') return component.pins.length > 1 ? [component.pins] : []
  if (mode === 'short') return []
  if (component.type === 'resistor') return [['a', 'b']]
  if (component.type === 'potentiometer') return [['left', 'wiper'], ['wiper', 'right']]
  return []
}

function buildGraph(circuit, mode = 'signal', options = {}) {
  const normalized = normalizeCircuit(circuit)
  const graph = new Map()
  function addEdge(x, y) {
    if (!x || !y) return
    if (!graph.has(x)) graph.set(x, new Set())
    if (!graph.has(y)) graph.set(y, new Set())
    graph.get(x).add(y)
    graph.get(y).add(x)
  }
  normalized.wires.forEach(wire => addEdge(wire.from, wire.to))
  normalized.components.forEach(component => {
    if (options.excludeComponents?.has(component.id)) return
    internalConnections(component, normalized.controls, mode).forEach(([a, b]) => {
      addEdge(pinRef(component.id, a), pinRef(component.id, b))
    })
  })
  return graph
}

function graphConnects(graph, a, b) {
  if (!a || !b) return false
  const queue = [a]
  const visited = new Set()
  while (queue.length) {
    const current = queue.shift()
    if (current === b) return true
    if (visited.has(current)) continue
    visited.add(current)
    graph.get(current)?.forEach(next => queue.push(next))
  }
  return false
}

function graphDistance(graph, starts, target) {
  if (!target) return Infinity
  const queue = starts.filter(Boolean)
  const distances = new Map(queue.map(start => [start, 0]))
  while (queue.length) {
    const current = queue.shift()
    const distance = distances.get(current) ?? 0
    if (current === target) return distance
    graph.get(current)?.forEach(next => {
      if (distances.has(next)) return
      distances.set(next, distance + 1)
      queue.push(next)
    })
  }
  return Infinity
}

export function arePinsConnected(circuit, a, b) {
  return graphConnects(buildGraph(circuit), a, b)
}

export function getWireCurrentDirection(circuit, wire) {
  const normalized = normalizeCircuit(circuit)
  const batteries = normalized.components.filter(component => component.type === 'battery')
  if (!wire || batteries.length === 0) return 'forward'

  const graph = buildGraph(normalized)
  const positiveRefs = batteries.map(component => pinRef(component.id, 'positive'))
  const negativeRefs = batteries.map(component => pinRef(component.id, 'negative'))
  const fromPositiveDistance = graphDistance(graph, positiveRefs, wire.from)
  const toPositiveDistance = graphDistance(graph, positiveRefs, wire.to)
  const fromNegativeDistance = graphDistance(graph, negativeRefs, wire.from)
  const toNegativeDistance = graphDistance(graph, negativeRefs, wire.to)
  const fromPositive = Number.isFinite(fromPositiveDistance)
  const toPositive = Number.isFinite(toPositiveDistance)
  const fromNegative = Number.isFinite(fromNegativeDistance)
  const toNegative = Number.isFinite(toNegativeDistance)

  if (fromPositive && toPositive && fromPositiveDistance !== toPositiveDistance) {
    return fromPositiveDistance < toPositiveDistance ? 'forward' : 'reverse'
  }
  if (fromNegative && toNegative && fromNegativeDistance !== toNegativeDistance) {
    return fromNegativeDistance > toNegativeDistance ? 'forward' : 'reverse'
  }
  if (fromPositive && toNegative) return 'forward'
  if (toPositive && fromNegative) return 'reverse'
  return 'forward'
}

function defaultPinFor(component, role = 'positive') {
  if (!component) return ''
  if (component.type === 'battery') return role === 'negative' ? 'negative' : 'positive'
  if (component.type === 'led') return role === 'negative' ? 'cathode' : 'anode'
  if (component.type === 'motor' || component.type === 'buzzer') return role === 'negative' ? 'negative' : 'positive'
  if (component.type === 'potentiometer') return role === 'negative' ? 'right' : 'left'
  if (component.type === 'terminal') return 'pin'
  return role === 'negative' ? 'b' : 'a'
}

function resolveEndpointRefs(circuit, endpoint = {}, role = 'positive') {
  const normalized = normalizeCircuit(circuit)
  const selector = endpoint.component ?? endpoint
  return findComponents(normalized, selector).map(component => {
    const pin = endpoint.pin || selector.pin || defaultPinFor(component, role)
    return pinRef(component.id, pin)
  })
}

function hasPathBetweenEndpoints(circuit, from, to) {
  const graph = buildGraph(circuit)
  const fromRefs = resolveEndpointRefs(circuit, from, 'positive')
  const toRefs = resolveEndpointRefs(circuit, to, 'positive')
  return fromRefs.some(fromRef => toRefs.some(toRef => graphConnects(graph, fromRef, toRef)))
}

function pathIncludesComponent(circuit, from, to, selector) {
  const graph = buildGraph(circuit)
  const fromRefs = resolveEndpointRefs(circuit, from, 'positive')
  const toRefs = resolveEndpointRefs(circuit, to, 'positive')
  const includedIds = new Set(findComponents(circuit, selector).map(component => component.id))
  if (includedIds.size === 0) return false
  return [...includedIds].some(componentId => {
    const graphWithoutComponent = buildGraph(circuit, 'signal', { excludeComponents: new Set([componentId]) })
    return fromRefs.some(fromRef => toRefs.some(toRef => (
      graphConnects(graph, fromRef, toRef) && !graphConnects(graphWithoutComponent, fromRef, toRef)
    )))
  })
}

export function circuitHasShort(circuit) {
  const normalized = normalizeCircuit(circuit)
  const graph = buildGraph(normalized, 'short')
  return normalized.components
    .filter(component => component.type === 'battery')
    .some(component => graphConnects(graph, pinRef(component.id, 'positive'), pinRef(component.id, 'negative')))
}

export function getComponentResistanceOhms(component) {
  const value = Number(component?.props?.resistanceOhms ?? component?.props?.resistance ?? DEFAULT_RESISTANCE_OHMS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RESISTANCE_OHMS
}

function addWeightedEdge(graph, from, to, resistanceOhms = 0) {
  if (!from || !to) return
  if (!graph.has(from)) graph.set(from, [])
  if (!graph.has(to)) graph.set(to, [])
  graph.get(from).push({ to, resistanceOhms })
  graph.get(to).push({ to: from, resistanceOhms })
}

function buildResistanceGraph(circuit) {
  const normalized = normalizeCircuit(circuit)
  const graph = new Map()
  normalized.wires.forEach(wire => addWeightedEdge(graph, wire.from, wire.to, 0))
  normalized.components.forEach(component => {
    if (component.type === 'resistor') {
      addWeightedEdge(graph, pinRef(component.id, 'a'), pinRef(component.id, 'b'), getComponentResistanceOhms(component))
      return
    }
    if (component.type === 'potentiometer') {
      const rawValue = Number(normalized.controls[component.id]?.value ?? component.props?.value ?? 50)
      const value = Math.min(100, Math.max(0, Number.isFinite(rawValue) ? rawValue : 50)) / 100
      addWeightedEdge(graph, pinRef(component.id, 'left'), pinRef(component.id, 'wiper'), Math.round(POTENTIOMETER_RESISTANCE_OHMS * value))
      addWeightedEdge(graph, pinRef(component.id, 'wiper'), pinRef(component.id, 'right'), Math.round(POTENTIOMETER_RESISTANCE_OHMS * (1 - value)))
      return
    }
    internalConnections(component, normalized.controls, 'signal').forEach(([a, b]) => {
      addWeightedEdge(graph, pinRef(component.id, a), pinRef(component.id, b), 0)
    })
  })
  return graph
}

function estimateSeriesResistance(circuit, fromRef, toRef) {
  const graph = buildResistanceGraph(circuit)
  const distances = new Map([[fromRef, 0]])
  const queue = [fromRef]
  while (queue.length) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))
    const current = queue.shift()
    const currentDistance = distances.get(current) ?? Infinity
    if (current === toRef) return currentDistance
    graph.get(current)?.forEach(edge => {
      const nextDistance = currentDistance + edge.resistanceOhms
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance)
        queue.push(edge.to)
      }
    })
  }
  return 0
}

function estimateOutputLevel(circuit, battery, component, positivePin, negativePin) {
  if (!battery) return { voltage: 0, level: 0, seriesResistanceOhms: 0 }
  const supplyResistance = estimateSeriesResistance(circuit, pinRef(battery.id, 'positive'), pinRef(component.id, positivePin))
  const returnResistance = estimateSeriesResistance(circuit, pinRef(component.id, negativePin), pinRef(battery.id, 'negative'))
  const seriesResistanceOhms = supplyResistance + returnResistance
  const loadResistance = LOAD_RESISTANCE_OHMS[component.type] ?? 220
  const batteryVoltage = Number(battery.props?.voltage ?? 5) || 5
  const level = loadResistance / (loadResistance + seriesResistanceOhms)
  return {
    voltage: Number((batteryVoltage * level).toFixed(2)),
    level: Number(level.toFixed(3)),
    seriesResistanceOhms,
  }
}

export function getComponentState(circuit, componentId) {
  const normalized = normalizeCircuit(circuit)
  const component = normalized.components.find(c => c.id === componentId)
  if (!component) return {}
  const control = normalized.controls[componentId] ?? {}
  const battery = normalized.components.find(c => c.type === 'battery')
  const positivePin = component.type === 'led' ? 'anode' : 'positive'
  const negativePin = component.type === 'led' ? 'cathode' : 'negative'
  const hasPositive = battery ? arePinsConnected(normalized, pinRef(battery.id, 'positive'), pinRef(component.id, positivePin)) : false
  const hasReturn = battery ? arePinsConnected(normalized, pinRef(battery.id, 'negative'), pinRef(component.id, negativePin)) : false
  const powered = hasPositive && hasReturn
  const outputLevel = powered ? estimateOutputLevel(normalized, battery, component, positivePin, negativePin) : { voltage: 0, level: 0, seriesResistanceOhms: 0 }
  const active = powered && !circuitHasShort(normalized) && outputLevel.level > 0.03
  if (component.type === 'led') return { on: active, powered, hasPositive, hasReturn, brightness: Math.round(outputLevel.level * 100), ...outputLevel }
  if (component.type === 'motor') return { on: active, powered, hasPositive, hasReturn, speed: Math.round(outputLevel.level * 100), ...outputLevel }
  if (component.type === 'buzzer') return { on: active, powered, hasPositive, hasReturn, volume: Math.round(outputLevel.level * 100), ...outputLevel }
  if (component.type === 'push_button') return { pressed: control.pressed === true, closed: control.pressed === true }
  if (component.type === 'slide_switch') return { closed: control.closed === true }
  if (component.type === 'potentiometer') return { value: Number(control.value ?? component.props?.value ?? 50) }
  if (component.type === 'resistor') return { resistanceOhms: getComponentResistanceOhms(component), powered }
  return { powered }
}

function componentCountsAsPowered(circuit, component) {
  const state = getComponentState(circuit, component.id)
  if (typeof state.on === 'boolean') return state.on
  return state.powered === true && !circuitHasShort(circuit)
}

function setControlForCheck(circuit, component, active) {
  const normalized = cloneCircuit(circuit)
  const control = { ...(normalized.controls[component.id] ?? {}) }
  if (component.type === 'push_button') control.pressed = active
  else if (component.type === 'slide_switch') control.closed = active
  else return normalized
  normalized.controls = { ...normalized.controls, [component.id]: control }
  return normalized
}

function controlAffectsComponentPower(circuit, controlSelector, componentSelector) {
  const controls = findComponents(circuit, controlSelector)
    .filter(component => component.type === 'push_button' || component.type === 'slide_switch')
  const targets = findComponents(circuit, componentSelector)
  return controls.some(control => targets.some(target => {
    const offCircuit = setControlForCheck(circuit, control, false)
    const onCircuit = setControlForCheck(circuit, control, true)
    return !componentCountsAsPowered(offCircuit, target) && componentCountsAsPowered(onCircuit, target)
  }))
}

export function evaluateElectronicsCheck(check, circuitLike) {
  const circuit = parseCircuit(circuitLike)
  if (check.type === 'circuit_no_short') {
    return !circuitHasShort(circuit)
  }
  if (check.type === 'circuit_has_component') {
    const minCount = Math.max(1, Number(check.minCount ?? 1) || 1)
    return findComponents(circuit, check.component).length >= minCount
  }
  if (check.type === 'circuit_component_powered') {
    return findComponents(circuit, check.component).some(component => componentCountsAsPowered(circuit, component))
  }
  if (check.type === 'circuit_component_unpowered') {
    const components = findComponents(circuit, check.component)
    return components.length > 0 && components.every(component => !componentCountsAsPowered(circuit, component))
  }
  if (check.type === 'circuit_control_affects_power') {
    return controlAffectsComponentPower(circuit, check.control, check.component)
  }
  if (check.type === 'circuit_path_exists') {
    return hasPathBetweenEndpoints(circuit, check.from, check.to)
  }
  if (check.type === 'circuit_path_includes') {
    return pathIncludesComponent(circuit, check.from, check.to, check.includes)
  }
  return false
}

export function makeComponent(type, index, position = { row: 2, col: 2 }) {
  const pins = {
    battery: ['positive', 'negative'],
    resistor: ['a', 'b'],
    led: ['anode', 'cathode'],
    push_button: ['a', 'b'],
    slide_switch: ['a', 'b'],
    potentiometer: ['left', 'wiper', 'right'],
    motor: ['positive', 'negative'],
    buzzer: ['positive', 'negative'],
    terminal: ['pin'],
  }
  return {
    id: `${type}${index}`,
    type,
    label: COMPONENT_LABELS[type] ?? type,
    position,
    rotation: 0,
    pins: pins[type] ?? ['a', 'b'],
    props: type === 'potentiometer'
      ? { value: 50 }
      : type === 'resistor'
        ? { resistanceOhms: DEFAULT_RESISTANCE_OHMS }
        : type === 'led'
          ? { color: 'red' }
          : type === 'battery'
            ? { voltage: 5 }
            : {},
  }
}
