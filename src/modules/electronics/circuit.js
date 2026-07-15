export const ELECTRONICS_CHECK_TYPES = [
  'circuit_component_exists',
  'circuit_connected',
  'circuit_not_connected',
  'circuit_no_short',
  'circuit_component_state',
  'circuit_pin_value',
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

export const DEFAULT_CIRCUIT = {
  version: 1,
  board: { type: 'half-breadboard', rows: 14, cols: 20 },
  components: [
    { id: 'battery1', type: 'battery', label: 'Battery', position: { row: 1, col: 1 }, rotation: 0, pins: ['positive', 'negative'], props: { voltage: 5 } },
  ],
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

export function findComponent(circuit, query) {
  const normalized = normalizeCircuit(circuit)
  return normalized.components.find(component => {
    if (query.id && component.id !== query.id) return false
    if (query.type && component.type !== query.type) return false
    if (query.label && String(component.label ?? '').toLowerCase() !== String(query.label).toLowerCase()) return false
    return true
  }) ?? null
}

export function arePinsConnected(circuit, a, b) {
  if (!a || !b) return false
  const normalized = normalizeCircuit(circuit)
  const graph = new Map()
  function addEdge(x, y) {
    if (!graph.has(x)) graph.set(x, new Set())
    if (!graph.has(y)) graph.set(y, new Set())
    graph.get(x).add(y)
    graph.get(y).add(x)
  }
  normalized.wires.forEach(wire => addEdge(wire.from, wire.to))
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

export function circuitHasShort(circuit) {
  const normalized = normalizeCircuit(circuit)
  return normalized.components
    .filter(component => component.type === 'battery')
    .some(component => arePinsConnected(normalized, pinRef(component.id, 'positive'), pinRef(component.id, 'negative')))
}

export function getComponentState(circuit, componentId) {
  const normalized = normalizeCircuit(circuit)
  const component = normalized.components.find(c => c.id === componentId)
  if (!component) return {}
  const control = normalized.controls[componentId] ?? {}
  const battery = normalized.components.find(c => c.type === 'battery')
  const powered = battery
    ? arePinsConnected(normalized, pinRef(battery.id, 'positive'), pinRef(component.id, 'anode'))
      || arePinsConnected(normalized, pinRef(battery.id, 'positive'), pinRef(component.id, 'positive'))
    : false
  if (component.type === 'led') return { on: powered && !circuitHasShort(normalized), powered }
  if (component.type === 'motor' || component.type === 'buzzer') return { on: powered && !circuitHasShort(normalized), powered }
  if (component.type === 'push_button') return { pressed: control.pressed === true, closed: control.pressed === true }
  if (component.type === 'slide_switch') return { closed: control.closed === true }
  if (component.type === 'potentiometer') return { value: Number(control.value ?? component.props?.value ?? 50) }
  return { powered }
}

export function evaluateElectronicsCheck(check, circuitLike) {
  const circuit = parseCircuit(circuitLike)
  if (check.type === 'circuit_component_exists') {
    return !!findComponent(circuit, { id: check.id, type: check.componentType ?? check.typeName, label: check.label })
  }
  if (check.type === 'circuit_connected') {
    return arePinsConnected(circuit, check.from, check.to)
  }
  if (check.type === 'circuit_not_connected') {
    return !arePinsConnected(circuit, check.from, check.to)
  }
  if (check.type === 'circuit_no_short') {
    return !circuitHasShort(circuit)
  }
  if (check.type === 'circuit_component_state') {
    const state = getComponentState(circuit, check.componentId ?? check.id)
    return String(state[check.property] ?? '') === String(check.value)
  }
  if (check.type === 'circuit_pin_value') {
    const value = circuit.controls?.[check.componentId]?.[check.pin] ?? circuit.controls?.[check.componentId]?.value
    return String(value ?? '') === String(check.value)
  }
  return false
}

export function makeComponent(type, index, position = { row: 2, col: 2 }) {
  const labels = {
    battery: 'Battery',
    resistor: 'Resistor',
    led: 'LED',
    push_button: 'Button',
    slide_switch: 'Switch',
    potentiometer: 'Pot',
    motor: 'Motor',
    buzzer: 'Buzzer',
    terminal: 'Terminal',
  }
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
    label: labels[type] ?? type,
    position,
    rotation: 0,
    pins: pins[type] ?? ['a', 'b'],
    props: type === 'potentiometer' ? { value: 50 } : {},
  }
}
