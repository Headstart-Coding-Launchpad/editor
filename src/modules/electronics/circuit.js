import { evaluateCodeCheck } from '../../shared/checkHelpers.js'

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
  'servo_motor',
  'buzzer',
  'rgb_led',
  'lcd1602',
  'microcontroller',
  'transistor',
  'diode',
  'sensor',
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
  servo_motor: 'Servo',
  buzzer: 'Buzzer',
  rgb_led: 'RGB LED',
  lcd1602: '16×2 LCD (I²C)',
  microcontroller: 'Micro Controller',
  transistor: 'Transistor',
  diode: 'Diode',
  sensor: 'Sensor',
  terminal: 'Junction',
}

export const COMPONENT_GROUPS = [
  { id: 'power', label: 'Power', types: ['battery', 'terminal'] },
  {
    id: 'basics',
    label: 'Basics',
    types: ['resistor', 'led', 'push_button', 'slide_switch', 'potentiometer'],
  },
  {
    id: 'outputs',
    label: 'Outputs',
    types: ['motor', 'servo_motor', 'buzzer', 'rgb_led', 'lcd1602'],
  },
  { id: 'control', label: 'Control', types: ['microcontroller', 'transistor', 'diode', 'sensor'] },
]

export const COMPONENT_DESCRIPTIONS = {
  microcontroller:
    'A Micro Controller runs MicroPython and exposes configurable GPIO pins that can connect code to the breadboard circuit.',
  transistor:
    'A transistor is an electronic switch that uses a tiny electrical signal from your code to safely control much larger amounts of power for components like motors.',
  diode:
    'A diode is a one-way street for electricity that protects your delicate circuit board by blocking current from flowing in the wrong direction.',
  sensor:
    'Sensors act as the "eyes and ears" of your circuit, measuring physical things in the real world (like light, temperature, or distance) and turning them into data your code can read.',
  servo_motor:
    'A servo is a smart motor that you can program to rotate to a precise angle (like exactly 90 degrees) and hold its position, making it perfect for robotic arms or steering.',
  rgb_led:
    'An RGB LED combines red, green, and blue lights into a single bulb, allowing your code to mix them together to create almost any color imaginable.',
  lcd1602:
    'A 16 by 2 character display. Connect VCC and GND for power, then wire SDA and SCL to two Micro Controller GPIO pins for I²C text output.',
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

export const BATTERY_VOLTAGE_OPTIONS = [
  { value: 1.5, label: '1.5V cell' },
  { value: 3, label: '3V coin cell' },
  { value: 5, label: '5V USB' },
  { value: 9, label: '9V battery' },
  { value: 12, label: '12V supply' },
]

export const LED_COLOR_OPTIONS = [
  {
    value: 'red',
    label: 'Red',
    fill: '#fb7185',
    offFill: '#fecdd3',
    stroke: '#be123c',
    glow: '#fb7185',
  },
  {
    value: 'green',
    label: 'Green',
    fill: '#4ade80',
    offFill: '#bbf7d0',
    stroke: '#15803d',
    glow: '#22c55e',
  },
  {
    value: 'blue',
    label: 'Blue',
    fill: '#60a5fa',
    offFill: '#bfdbfe',
    stroke: '#1d4ed8',
    glow: '#3b82f6',
  },
]

const DEFAULT_RESISTANCE_OHMS = 330
const POTENTIOMETER_RESISTANCE_OHMS = 10000
const LOAD_RESISTANCE_OHMS = {
  led: 330,
  rgb_led: 330,
  motor: 120,
  servo_motor: 180,
  buzzer: 220,
  lcd1602: 1000,
  diode: 60,
  sensor: 1000,
}

const RGB_LED_PINS = ['red', 'green', 'blue']
export const MICROCONTROLLER_DEFAULT_PINS = ['3V3', 'GND', 'GP0', 'GP1', 'GP2', 'GP3']
const MICROCONTROLLER_SUPPLY_VOLTAGE = 3.3
const MICROCONTROLLER_POWER_PIN_NAMES = new Set(['3V3', '3V', 'VCC', 'POWER'])
const MICROCONTROLLER_GROUND_PIN_NAMES = new Set(['GND', 'GROUND'])
export const DEFAULT_MICROPYTHON_CODE = [
  'from machine import Pin',
  '',
  'led = Pin("GP0", Pin.OUT)',
  'led.on()',
  'print("Micro Controller running")',
].join('\n')

export const WIRE_COLORS = [
  { value: 'auto', label: 'Auto' },
  { value: '#ef4444', label: 'Positive red' },
  { value: '#111827', label: 'Negative black' },
  { value: '#f59e0b', label: 'Signal amber' },
  { value: '#2563eb', label: 'Signal blue' },
  { value: '#16a34a', label: 'Signal green' },
  { value: '#7c3aed', label: 'Signal purple' },
]

export const BOARD_SIZE_OPTIONS = [
  { id: 'compact', label: 'Compact', rows: 14, cols: 20 },
  { id: 'standard', label: 'Standard', rows: 18, cols: 30 },
  { id: 'large', label: 'Large', rows: 22, cols: 36 },
]

const DEFAULT_BOARD_SIZE = BOARD_SIZE_OPTIONS[1]

export const DEFAULT_BOARD = {
  type: 'half-breadboard',
  rows: DEFAULT_BOARD_SIZE.rows,
  cols: DEFAULT_BOARD_SIZE.cols,
}

export const DEFAULT_CIRCUIT = {
  version: 1,
  board: DEFAULT_BOARD,
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
  const components = Array.isArray(circuit.components)
    ? circuit.components.map((component) => normalizeComponent(component, circuit))
    : []
  return {
    version: 1,
    board: { ...DEFAULT_BOARD, ...(circuit.board ?? {}) },
    components,
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

function normalizeComponent(component = {}, circuit = DEFAULT_CIRCUIT) {
  if (component.type !== 'microcontroller') return component
  const legacyCode = circuit.microcontroller?.starterCode ?? circuit.microcontroller?.code
  return {
    ...component,
    pins: normalizeMicrocontrollerPins(component.pins),
    props: {
      boardType: 'MicroPython',
      code: legacyCode ?? DEFAULT_MICROPYTHON_CODE,
      ...(component.props ?? {}),
    },
  }
}

export function pinRef(componentId, pin = '') {
  return pin ? `${componentId}.${pin}` : componentId
}

export function normalizeGpioPinName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
}

export function normalizeMicrocontrollerPins(value, fallback = MICROCONTROLLER_DEFAULT_PINS) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback
  const seen = new Set()
  const pins = []
  source.forEach((raw) => {
    const pin = normalizeGpioPinName(raw)
    if (!pin || seen.has(pin)) return
    seen.add(pin)
    pins.push(pin)
  })
  return pins.length > 0 ? pins : [...MICROCONTROLLER_DEFAULT_PINS]
}

export function isMicrocontrollerPowerPin(pin) {
  return MICROCONTROLLER_POWER_PIN_NAMES.has(normalizeGpioPinName(pin).toUpperCase())
}

export function isMicrocontrollerGroundPin(pin) {
  return MICROCONTROLLER_GROUND_PIN_NAMES.has(normalizeGpioPinName(pin).toUpperCase())
}

export function isMicrocontrollerSignalPin(pin) {
  return !isMicrocontrollerPowerPin(pin) && !isMicrocontrollerGroundPin(pin)
}

export function makeNextGpioPinName(existingPins = []) {
  const existing = new Set(normalizeMicrocontrollerPins(existingPins, []))
  for (let index = 0; index < 64; index += 1) {
    const pin = `GP${index}`
    if (!existing.has(pin)) return pin
  }
  return `GP${existing.size}`
}

export function getMicrocontrollerComponent(circuit) {
  const normalized = normalizeCircuit(circuit)
  return normalized.components.find((component) => component.type === 'microcontroller') ?? null
}

export function getMicrocontrollerCode(circuit) {
  const microcontroller = getMicrocontrollerComponent(circuit)
  return microcontroller?.props?.code ?? normalizeCircuit(circuit).microcontroller.code ?? ''
}

function normalizeGpioValues(value = {}, pins = []) {
  const allowedPins = new Set(
    normalizeMicrocontrollerPins(pins, []).filter(isMicrocontrollerSignalPin)
  )
  return Object.fromEntries(
    Object.entries(value ?? {})
      .map(([pin, nextValue]) => [normalizeGpioPinName(pin), nextValue ? 1 : 0])
      .filter(([pin]) => pin && allowedPins.has(pin))
  )
}

export function getMicrocontrollerGpioValues(circuit, componentLike = null) {
  const normalized = normalizeCircuit(circuit)
  const microcontroller = componentLike ?? getMicrocontrollerComponent(normalized)
  if (!microcontroller) return {}
  return normalizeGpioValues(normalized.controls?.[microcontroller.id]?.gpio, microcontroller.pins)
}

export function applyMicrocontrollerGpioValues(circuit, values = {}) {
  const next = cloneCircuit(circuit)
  const microcontroller = getMicrocontrollerComponent(next)
  if (!microcontroller) return next
  const signalPins = normalizeMicrocontrollerPins(microcontroller.pins, []).filter(
    isMicrocontrollerSignalPin
  )
  const nextValues = {
    ...normalizeGpioValues(next.controls?.[microcontroller.id]?.gpio, microcontroller.pins),
  }
  Object.entries(values ?? {}).forEach(([rawPin, value]) => {
    const pin = normalizeGpioPinName(rawPin)
    if (signalPins.includes(pin)) nextValues[pin] = value ? 1 : 0
  })
  next.controls = {
    ...(next.controls ?? {}),
    [microcontroller.id]: {
      ...(next.controls?.[microcontroller.id] ?? {}),
      gpio: nextValues,
    },
  }
  return next
}

export function getMicrocontrollerInputValues(circuit, componentLike = null) {
  const normalized = normalizeCircuit(circuit)
  const microcontroller = componentLike ?? getMicrocontrollerComponent(normalized)
  if (!microcontroller) return {}
  const analysis = analyzeCircuit(normalized)
  const signalPins = normalizeMicrocontrollerPins(microcontroller.pins, []).filter(
    isMicrocontrollerSignalPin
  )
  return Object.fromEntries(
    signalPins.map((pin) => {
      const ref = pinRef(microcontroller.id, pin)
      const node = analysis.nodeForRef(ref)
      if (analysis.voltageSources.some((source) => source.positiveNode === node)) return [pin, 1]
      if (analysis.voltageSources.some((source) => source.negativeNode === node)) return [pin, 0]
      const participatesInSolvedCircuit = analysis.solvedEdges.some(
        (edge) => edge.fromNode === node || edge.toNode === node
      )
      if (!participatesInSolvedCircuit) return [pin, null]
      const voltage = analysis.voltageForRef(ref)
      if (voltage >= MICROCONTROLLER_SUPPLY_VOLTAGE * 0.6) return [pin, 1]
      if (voltage <= MICROCONTROLLER_SUPPLY_VOLTAGE * 0.3) return [pin, 0]
      return [pin, null]
    })
  )
}

export function hasCircuitPath(circuitLike, fromRef, toRef) {
  if (!fromRef || !toRef) return false
  const graph = buildGraph(parseCircuit(circuitLike), 'signal')
  const queue = [fromRef]
  const visited = new Set()
  while (queue.length) {
    const current = queue.shift()
    if (current === toRef) return true
    if (!current || visited.has(current)) continue
    visited.add(current)
    graph.get(current)?.forEach((next) => queue.push(next))
  }
  return false
}

export function getI2cLcdTargets(circuitLike, sdaPin, sclPin) {
  const circuit = parseCircuit(circuitLike)
  const microcontroller = getMicrocontrollerComponent(circuit)
  if (!microcontroller) return []
  const sdaRef = pinRef(microcontroller.id, normalizeGpioPinName(sdaPin))
  const sclRef = pinRef(microcontroller.id, normalizeGpioPinName(sclPin))
  return circuit.components.filter(
    (component) =>
      component.type === 'lcd1602' &&
      getComponentState(circuit, component.id).powered &&
      hasCircuitPath(circuit, sdaRef, pinRef(component.id, 'SDA')) &&
      hasCircuitPath(circuit, sclRef, pinRef(component.id, 'SCL'))
  )
}

function lcdControlState(control = {}) {
  return {
    lines: [0, 1].map((row) =>
      String(control.lines?.[row] ?? '')
        .slice(0, 16)
        .padEnd(16, ' ')
    ),
    cursor: {
      col: Math.max(0, Math.min(15, Number(control.cursor?.col ?? 0) || 0)),
      row: Math.max(0, Math.min(1, Number(control.cursor?.row ?? 0) || 0)),
    },
    backlight: control.backlight !== false,
  }
}

function writeLcdText(state, text) {
  const lines = [...state.lines]
  let { col, row } = state.cursor
  for (const character of String(text ?? '')) {
    if (character === '\n') {
      col = 0
      row += 1
      continue
    }
    if (row > 1) continue
    lines[row] = `${lines[row].slice(0, col)}${character}${lines[row].slice(col + 1)}`
    col += 1
    if (col >= 16) {
      col = 0
      row += 1
    }
  }
  return { ...state, lines, cursor: { col: Math.min(15, col), row: Math.min(1, row) } }
}

export function applyI2cLcdEvent(circuitLike, event = {}) {
  const circuit = cloneCircuit(parseCircuit(circuitLike))
  const targets = getI2cLcdTargets(circuit, event.sda, event.scl)
  targets.forEach((component) => {
    let state = lcdControlState(circuit.controls?.[component.id])
    if (event.action === 'init' || event.action === 'clear') {
      state = { ...state, lines: [' '.repeat(16), ' '.repeat(16)], cursor: { col: 0, row: 0 } }
    } else if (event.action === 'cursor') {
      state = {
        ...state,
        cursor: {
          col: Math.max(0, Math.min(15, Number(event.col) || 0)),
          row: Math.max(0, Math.min(1, Number(event.row) || 0)),
        },
      }
    } else if (event.action === 'print') {
      state = writeLcdText(state, event.text)
    } else if (event.action === 'backlight') {
      state = { ...state, backlight: event.value !== false }
    }
    circuit.controls = {
      ...(circuit.controls ?? {}),
      [component.id]: { ...(circuit.controls?.[component.id] ?? {}), ...state },
    }
  })
  return circuit
}

export function normalizeAvailableComponents(value) {
  if (!Array.isArray(value)) return [...DEFAULT_AVAILABLE_COMPONENTS]
  const seen = new Set()
  return value.filter((type) => {
    if (!COMPONENT_TYPES.includes(type) || seen.has(type)) return false
    seen.add(type)
    return true
  })
}

export function getWireColorForPins(from, to, selected = 'auto') {
  if (selected && selected !== 'auto') return selected
  const refs = `${from ?? ''}.${to ?? ''}`.toLowerCase()
  if (refs.includes('.green')) return '#16a34a'
  if (
    refs.includes('.blue') ||
    refs.includes('wiper') ||
    refs.includes('signal') ||
    refs.includes('base') ||
    refs.includes('.gp')
  )
    return '#2563eb'
  if (refs.includes('positive') || refs.includes('anode') || refs.includes('.red')) return '#ef4444'
  if (refs.includes('negative') || refs.includes('cathode') || refs.includes('emitter'))
    return '#111827'
  return '#f59e0b'
}

export function findComponent(circuit, query) {
  return findComponents(circuit, query)[0] ?? null
}

export function findComponents(circuit, selector = {}) {
  const normalized = normalizeCircuit(circuit)
  return normalized.components.filter((component) => componentMatchesSelector(component, selector))
}

function componentMatchesSelector(component, selector = {}) {
  const type = selector.type ?? selector.componentType ?? selector.typeName
  if (selector.id && component.id !== selector.id) return false
  if (type && component.type !== type) return false
  if (
    selector.label &&
    String(component.label ?? '').toLowerCase() !== String(selector.label).toLowerCase()
  )
    return false
  return true
}

function internalConnections(component, controls, mode = 'signal') {
  const control = controls[component.id] ?? {}
  if (component.type === 'push_button') return control.pressed === true ? [['a', 'b']] : []
  if (component.type === 'slide_switch') return control.closed === true ? [['a', 'b']] : []
  if (component.type === 'terminal') return component.pins.length > 1 ? [component.pins] : []
  if (mode === 'short') return []
  if (component.type === 'resistor') return [['a', 'b']]
  if (component.type === 'diode') return [['anode', 'cathode']]
  if (component.type === 'potentiometer')
    return [
      ['left', 'wiper'],
      ['wiper', 'right'],
    ]
  return []
}

function transistorBaseIsHigh(circuit, component) {
  const normalized = normalizeCircuit(circuit)
  const control = normalized.controls[component.id] ?? {}
  if (control.baseHigh === true) return true
  const sourceRefs = getVoltageSources(normalized)
    .filter((source) => source.voltage > 0)
    .map((source) => source.positiveRef)
    .filter(Boolean)
  if (sourceRefs.length === 0) return false
  const graph = buildGraph(normalized, 'signal', {
    excludeComponents: new Set([component.id]),
    transistorsOpen: true,
  })
  return sourceRefs.some((sourceRef) =>
    graphConnects(graph, sourceRef, pinRef(component.id, 'base'))
  )
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
  normalized.wires.forEach((wire) => addEdge(wire.from, wire.to))
  normalized.components.forEach((component) => {
    if (options.excludeComponents?.has(component.id)) return
    if (component.type === 'transistor') {
      if (!options.transistorsOpen && transistorBaseIsHigh(normalized, component)) {
        addEdge(pinRef(component.id, 'collector'), pinRef(component.id, 'emitter'))
      }
      return
    }
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
    graph.get(current)?.forEach((next) => queue.push(next))
  }
  return false
}

function graphDistance(graph, starts, target) {
  if (!target) return Infinity
  const queue = starts.filter(Boolean)
  const distances = new Map(queue.map((start) => [start, 0]))
  while (queue.length) {
    const current = queue.shift()
    const distance = distances.get(current) ?? 0
    if (current === target) return distance
    graph.get(current)?.forEach((next) => {
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
  const batteries = normalized.components.filter((component) => component.type === 'battery')
  if (!wire || batteries.length === 0) return 'forward'

  const graph = buildGraph(normalized)
  const positiveRefs = batteries.map((component) => pinRef(component.id, 'positive'))
  const negativeRefs = batteries.map((component) => pinRef(component.id, 'negative'))
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
  if (component.type === 'led' || component.type === 'diode')
    return role === 'negative' ? 'cathode' : 'anode'
  if (component.type === 'rgb_led') return role === 'negative' ? 'cathode' : 'red'
  if (
    component.type === 'motor' ||
    component.type === 'servo_motor' ||
    component.type === 'buzzer' ||
    component.type === 'sensor'
  )
    return role === 'negative' ? 'negative' : 'positive'
  if (component.type === 'lcd1602') return role === 'negative' ? 'GND' : 'VCC'
  if (component.type === 'potentiometer') return role === 'negative' ? 'right' : 'left'
  if (component.type === 'transistor') return role === 'negative' ? 'emitter' : 'collector'
  if (component.type === 'terminal') return 'pin'
  return role === 'negative' ? 'b' : 'a'
}

function resolveEndpointRefs(circuit, endpoint = {}, role = 'positive') {
  const normalized = normalizeCircuit(circuit)
  const selector = endpoint.component ?? endpoint
  return findComponents(normalized, selector).map((component) => {
    const pin = endpoint.pin || selector.pin || defaultPinFor(component, role)
    return pinRef(component.id, pin)
  })
}

function hasPathBetweenEndpoints(circuit, from, to) {
  const graph = buildGraph(circuit)
  const fromRefs = resolveEndpointRefs(circuit, from, 'positive')
  const toRefs = resolveEndpointRefs(circuit, to, 'positive')
  return fromRefs.some((fromRef) => toRefs.some((toRef) => graphConnects(graph, fromRef, toRef)))
}

function pathIncludesComponent(circuit, from, to, selector) {
  const graph = buildGraph(circuit)
  const fromRefs = resolveEndpointRefs(circuit, from, 'positive')
  const toRefs = resolveEndpointRefs(circuit, to, 'positive')
  const includedIds = new Set(findComponents(circuit, selector).map((component) => component.id))
  if (includedIds.size === 0) return false
  return [...includedIds].some((componentId) => {
    const graphWithoutComponent = buildGraph(circuit, 'signal', {
      excludeComponents: new Set([componentId]),
    })
    return fromRefs.some((fromRef) =>
      toRefs.some(
        (toRef) =>
          graphConnects(graph, fromRef, toRef) &&
          !graphConnects(graphWithoutComponent, fromRef, toRef)
      )
    )
  })
}

export function circuitHasShort(circuit) {
  const normalized = normalizeCircuit(circuit)
  const graph = buildGraph(normalized, 'short')
  return getVoltageSources(normalized).some((source) =>
    graphConnects(graph, source.positiveRef, source.negativeRef)
  )
}

// Which wires and parts actually form the short, so the board can colour them rather
// than only reporting that a short exists somewhere. `circuitHasShort` stays the cheap
// boolean for checks; this walks the shortest offending loop per supply and maps each
// step back to the wire or the internal component link that carries it.
export function getShortCircuitPath(circuit) {
  const normalized = normalizeCircuit(circuit)
  const graph = buildGraph(normalized, 'short')
  const wireIds = new Set()
  const componentIds = new Set()

  getVoltageSources(normalized).forEach((source) => {
    const path = graphPath(graph, source.positiveRef, source.negativeRef)
    if (!path) return
    componentIds.add(source.componentId)
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index]
      const to = path[index + 1]
      const wire = normalized.wires.find(
        (candidate) =>
          (candidate.from === from && candidate.to === to) ||
          (candidate.from === to && candidate.to === from)
      )
      if (wire) {
        wireIds.add(wire.id)
        continue
      }
      // Not a wire, so the step is a component's own internal connection (a closed
      // switch, a junction) - both refs belong to the same part.
      const owner = componentIdForRef(normalized, from)
      if (owner && owner === componentIdForRef(normalized, to)) componentIds.add(owner)
    }
  })

  return { wireIds: [...wireIds], componentIds: [...componentIds] }
}

function componentIdForRef(circuit, ref) {
  if (!ref) return null
  const match = circuit.components.find(
    (component) => ref === component.id || ref.startsWith(`${component.id}.`)
  )
  return match?.id ?? null
}

// BFS shortest path between two pin refs, or null when they are not connected.
function graphPath(graph, a, b) {
  if (!a || !b) return null
  if (a === b) return [a]
  const queue = [a]
  const cameFrom = new Map([[a, null]])
  while (queue.length) {
    const current = queue.shift()
    if (current === b) {
      const path = []
      let step = current
      while (step != null) {
        path.unshift(step)
        step = cameFrom.get(step)
      }
      return path
    }
    graph.get(current)?.forEach((next) => {
      if (cameFrom.has(next)) return
      cameFrom.set(next, current)
      queue.push(next)
    })
  }
  return null
}

function roundMetric(value, places = 2) {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(places))
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function getBatteryVoltage(component) {
  const value = Number(component?.props?.voltage ?? 5)
  return Number.isFinite(value) && value > 0 ? value : 5
}

function getMicrocontrollerSupplyPins(component) {
  const pins = normalizeMicrocontrollerPins(component.pins, [])
  return {
    powerPins: pins.filter(isMicrocontrollerPowerPin),
    groundPins: pins.filter(isMicrocontrollerGroundPin),
  }
}

function getVoltageSources(circuit) {
  const normalized = normalizeCircuit(circuit)
  const sources = []
  normalized.components.forEach((component) => {
    if (component.type === 'battery') {
      sources.push({
        id: component.id,
        componentId: component.id,
        type: 'battery',
        positiveRef: pinRef(component.id, 'positive'),
        negativeRef: pinRef(component.id, 'negative'),
        voltage: getBatteryVoltage(component),
      })
      return
    }
    if (component.type !== 'microcontroller') return
    const { powerPins, groundPins } = getMicrocontrollerSupplyPins(component)
    const groundPin = groundPins[0]
    if (!groundPin) return
    powerPins.forEach((powerPin) => {
      sources.push({
        id: `${component.id}.${powerPin}`,
        componentId: component.id,
        type: 'microcontroller',
        positiveRef: pinRef(component.id, powerPin),
        negativeRef: pinRef(component.id, groundPin),
        voltage: MICROCONTROLLER_SUPPLY_VOLTAGE,
      })
    })
    const gpioValues = getMicrocontrollerGpioValues(normalized, component)
    Object.entries(gpioValues).forEach(([pin, value]) => {
      if (value !== 1) return
      sources.push({
        id: `${component.id}.${pin}`,
        componentId: component.id,
        type: 'microcontroller_gpio',
        positiveRef: pinRef(component.id, pin),
        negativeRef: pinRef(component.id, groundPin),
        voltage: MICROCONTROLLER_SUPPLY_VOLTAGE,
      })
    })
  })
  return sources.filter((source) => source.positiveRef && source.negativeRef && source.voltage > 0)
}

export function getComponentResistanceOhms(component) {
  const value = Number(
    component?.props?.resistanceOhms ?? component?.props?.resistance ?? DEFAULT_RESISTANCE_OHMS
  )
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
  normalized.wires.forEach((wire) => addWeightedEdge(graph, wire.from, wire.to, 0))
  normalized.components.forEach((component) => {
    if (component.type === 'resistor') {
      addWeightedEdge(
        graph,
        pinRef(component.id, 'a'),
        pinRef(component.id, 'b'),
        getComponentResistanceOhms(component)
      )
      return
    }
    if (component.type === 'potentiometer') {
      const rawValue = Number(
        normalized.controls[component.id]?.value ?? component.props?.value ?? 50
      )
      const value = Math.min(100, Math.max(0, Number.isFinite(rawValue) ? rawValue : 50)) / 100
      addWeightedEdge(
        graph,
        pinRef(component.id, 'left'),
        pinRef(component.id, 'wiper'),
        Math.round(POTENTIOMETER_RESISTANCE_OHMS * value)
      )
      addWeightedEdge(
        graph,
        pinRef(component.id, 'wiper'),
        pinRef(component.id, 'right'),
        Math.round(POTENTIOMETER_RESISTANCE_OHMS * (1 - value))
      )
      return
    }
    if (component.type === 'transistor') {
      if (transistorBaseIsHigh(normalized, component)) {
        addWeightedEdge(
          graph,
          pinRef(component.id, 'collector'),
          pinRef(component.id, 'emitter'),
          0
        )
      }
      return
    }
    internalConnections(component, normalized.controls, 'signal').forEach(([a, b]) => {
      addWeightedEdge(graph, pinRef(component.id, a), pinRef(component.id, b), 0)
    })
  })
  return graph
}

class UnionFind {
  constructor(values = []) {
    this.parent = new Map()
    values.forEach((value) => this.add(value))
  }

  add(value) {
    if (value && !this.parent.has(value)) this.parent.set(value, value)
  }

  find(value) {
    this.add(value)
    const parent = this.parent.get(value)
    if (parent === value) return value
    const root = this.find(parent)
    this.parent.set(value, root)
    return root
  }

  union(a, b) {
    if (!a || !b) return
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootB, rootA)
  }
}

function idealConnectionsFor(component, circuit) {
  if (
    component.type === 'push_button' ||
    component.type === 'slide_switch' ||
    component.type === 'terminal'
  ) {
    return internalConnections(component, circuit.controls, 'signal')
  }
  if (component.type === 'transistor' && transistorBaseIsHigh(circuit, component)) {
    return [['collector', 'emitter']]
  }
  if (component.type === 'microcontroller') {
    const { groundPins } = getMicrocontrollerSupplyPins(component)
    const groundPin = groundPins[0]
    if (!groundPin) return []
    const gpioValues = getMicrocontrollerGpioValues(circuit, component)
    return Object.entries(gpioValues)
      .filter(([, value]) => value === 0)
      .map(([pin]) => [pin, groundPin])
  }
  return []
}

function addIdealEdge(graph, a, b) {
  if (!a || !b) return
  if (!graph.has(a)) graph.set(a, new Set())
  if (!graph.has(b)) graph.set(b, new Set())
  graph.get(a).add(b)
  graph.get(b).add(a)
}

function buildIdealGraph(circuit, excludedWireId = null) {
  const normalized = normalizeCircuit(circuit)
  const graph = new Map()
  normalized.wires.forEach((wire) => {
    if (wire.id !== excludedWireId) addIdealEdge(graph, wire.from, wire.to)
  })
  normalized.components.forEach((component) => {
    idealConnectionsFor(component, normalized).forEach(([a, b]) => {
      addIdealEdge(graph, pinRef(component.id, a), pinRef(component.id, b))
    })
  })
  return graph
}

function reachableIdealRefs(circuit, startRef, excludedWireId = null) {
  const graph = buildIdealGraph(circuit, excludedWireId)
  const queue = [startRef]
  const visited = new Set()
  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    graph.get(current)?.forEach((next) => queue.push(next))
  }
  return visited
}

function addResistiveEdge(edges, component, fromPin, toPin, resistanceOhms) {
  const resistance = Number(resistanceOhms)
  if (!Number.isFinite(resistance) || resistance <= 0) return
  edges.push({
    componentId: component.id,
    componentType: component.type,
    fromPin,
    toPin,
    fromRef: pinRef(component.id, fromPin),
    toRef: pinRef(component.id, toPin),
    resistanceOhms: resistance,
  })
}

function buildResistiveEdges(circuit) {
  const normalized = normalizeCircuit(circuit)
  const edges = []
  normalized.components.forEach((component) => {
    if (component.type === 'resistor') {
      addResistiveEdge(edges, component, 'a', 'b', getComponentResistanceOhms(component))
    } else if (component.type === 'potentiometer') {
      const rawValue = Number(
        normalized.controls[component.id]?.value ?? component.props?.value ?? 50
      )
      const value = Math.min(100, Math.max(0, Number.isFinite(rawValue) ? rawValue : 50)) / 100
      addResistiveEdge(
        edges,
        component,
        'left',
        'wiper',
        Math.max(1, Math.round(POTENTIOMETER_RESISTANCE_OHMS * value))
      )
      addResistiveEdge(
        edges,
        component,
        'wiper',
        'right',
        Math.max(1, Math.round(POTENTIOMETER_RESISTANCE_OHMS * (1 - value)))
      )
    } else if (component.type === 'led') {
      addResistiveEdge(edges, component, 'anode', 'cathode', LOAD_RESISTANCE_OHMS.led)
    } else if (component.type === 'rgb_led') {
      RGB_LED_PINS.forEach((pin) =>
        addResistiveEdge(edges, component, pin, 'cathode', LOAD_RESISTANCE_OHMS.rgb_led)
      )
    } else if (
      component.type === 'motor' ||
      component.type === 'servo_motor' ||
      component.type === 'buzzer' ||
      component.type === 'sensor'
    ) {
      addResistiveEdge(
        edges,
        component,
        'positive',
        'negative',
        LOAD_RESISTANCE_OHMS[component.type]
      )
    } else if (component.type === 'lcd1602') {
      addResistiveEdge(edges, component, 'VCC', 'GND', LOAD_RESISTANCE_OHMS.lcd1602)
    } else if (component.type === 'diode') {
      addResistiveEdge(edges, component, 'anode', 'cathode', LOAD_RESISTANCE_OHMS.diode)
    }
  })
  return edges
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < size; col += 1) {
    let pivot = col
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) continue
    if (pivot !== col) [a[pivot], a[col]] = [a[col], a[pivot]]
    const divisor = a[col][col]
    for (let item = col; item <= size; item += 1) a[col][item] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue
      const factor = a[row][col]
      if (Math.abs(factor) < 1e-12) continue
      for (let item = col; item <= size; item += 1) a[row][item] -= factor * a[col][item]
    }
  }
  return a.map((row) => (Number.isFinite(row[size]) ? row[size] : 0))
}

function analyzeCircuit(circuit) {
  const normalized = normalizeCircuit(circuit)
  const voltageSources = getVoltageSources(normalized)
  const sourceBattery =
    normalized.components.find((component) => component.type === 'battery') ?? null
  const primarySource =
    voltageSources.find((source) => source.type === 'battery') ?? voltageSources[0] ?? null
  const sourceVoltage = primarySource?.voltage ?? 0
  const shorted = circuitHasShort(normalized)
  const uf = new UnionFind()

  normalized.components.forEach((component) => {
    component.pins.forEach((pin) => uf.add(pinRef(component.id, pin)))
  })
  normalized.wires.forEach((wire) => {
    uf.union(wire.from, wire.to)
  })
  normalized.components.forEach((component) => {
    idealConnectionsFor(component, normalized).forEach(([a, b]) => {
      uf.union(pinRef(component.id, a), pinRef(component.id, b))
    })
  })

  const sources = voltageSources.map((source) => ({
    ...source,
    positiveNode: uf.find(source.positiveRef),
    negativeNode: uf.find(source.negativeRef),
  }))
  let conflictingSources = false
  const positiveRef = primarySource?.positiveRef ?? null
  const negativeRef = primarySource?.negativeRef ?? null
  const positiveNode = positiveRef ? uf.find(positiveRef) : null
  const negativeNode = negativeRef ? uf.find(negativeRef) : null
  const resistiveEdges = buildResistiveEdges(normalized)
    .map((edge) => ({
      ...edge,
      fromNode: uf.find(edge.fromRef),
      toNode: uf.find(edge.toRef),
    }))
    .filter((edge) => edge.fromNode !== edge.toNode)
  const fixedVoltages = new Map()
  function setFixedVoltage(node, voltage) {
    if (!node || conflictingSources) return
    const existing = fixedVoltages.get(node)
    if (existing !== undefined && Math.abs(existing - voltage) > 0.01) {
      conflictingSources = true
      return
    }
    fixedVoltages.set(node, voltage)
  }
  if (!shorted) {
    sources.forEach((source) => {
      if (source.positiveNode === source.negativeNode) {
        conflictingSources = true
        return
      }
      setFixedVoltage(source.negativeNode, 0)
      setFixedVoltage(source.positiveNode, source.voltage)
    })
  }

  const nodeSet = new Set(
    sources.flatMap((source) => [source.positiveNode, source.negativeNode]).filter(Boolean)
  )
  resistiveEdges.forEach((edge) => {
    nodeSet.add(edge.fromNode)
    nodeSet.add(edge.toNode)
  })
  const unknownNodes = [...nodeSet].filter((node) => node && !fixedVoltages.has(node))
  const indexByNode = new Map(unknownNodes.map((node, index) => [node, index]))
  const matrix = unknownNodes.map(() => unknownNodes.map(() => 0))
  const vector = unknownNodes.map(() => 0)

  if (sources.length > 0 && !shorted && !conflictingSources) {
    resistiveEdges.forEach((edge) => {
      const conductance = 1 / edge.resistanceOhms
      const fromIndex = indexByNode.get(edge.fromNode)
      const toIndex = indexByNode.get(edge.toNode)
      const fromFixed = fixedVoltages.get(edge.fromNode)
      const toFixed = fixedVoltages.get(edge.toNode)
      if (fromIndex !== undefined) {
        matrix[fromIndex][fromIndex] += conductance
        if (toIndex !== undefined) matrix[fromIndex][toIndex] -= conductance
        else vector[fromIndex] += conductance * (toFixed ?? 0)
      }
      if (toIndex !== undefined) {
        matrix[toIndex][toIndex] += conductance
        if (fromIndex !== undefined) matrix[toIndex][fromIndex] -= conductance
        else vector[toIndex] += conductance * (fromFixed ?? 0)
      }
    })
  }

  const voltages = new Map(fixedVoltages)
  solveLinearSystem(matrix, vector).forEach((voltage, index) => {
    voltages.set(unknownNodes[index], voltage)
  })
  nodeSet.forEach((node) => {
    if (node && !voltages.has(node)) voltages.set(node, 0)
  })

  const solvedEdges = resistiveEdges.map((edge) => {
    const fromVoltage = voltages.get(edge.fromNode) ?? 0
    const toVoltage = voltages.get(edge.toNode) ?? 0
    const voltage = fromVoltage - toVoltage
    const currentMa = (voltage / edge.resistanceOhms) * 1000
    return {
      ...edge,
      fromVoltage,
      toVoltage,
      voltage,
      currentMa,
    }
  })
  const sourceCurrentMa = new Map()
  sources.forEach((source) => {
    const currentMa =
      !shorted && !conflictingSources
        ? solvedEdges.reduce((sum, edge) => {
            if (edge.fromNode === source.positiveNode) return sum + Math.max(0, edge.currentMa)
            if (edge.toNode === source.positiveNode) return sum + Math.max(0, -edge.currentMa)
            return sum
          }, 0)
        : 0
    sourceCurrentMa.set(source.id, currentMa)
  })
  const totalCurrentMa = [...sourceCurrentMa.values()].reduce((sum, value) => sum + value, 0)

  return {
    circuit: normalized,
    voltageSources: sources,
    primarySource,
    sourceBattery,
    sourceVoltage,
    shorted:
      shorted ||
      conflictingSources ||
      sources.some((source) => source.positiveNode === source.negativeNode),
    positiveRef,
    negativeRef,
    positiveNode,
    negativeNode,
    voltages,
    solvedEdges,
    totalCurrentMa,
    sourceCurrentMa,
    nodeForRef: (ref) => uf.find(ref),
    voltageForRef: (ref) => voltages.get(uf.find(ref)) ?? 0,
  }
}

function findSolvedEdge(analysis, componentId, fromPin, toPin) {
  return (
    analysis.solvedEdges.find(
      (edge) =>
        edge.componentId === componentId &&
        ((edge.fromPin === fromPin && edge.toPin === toPin) ||
          (edge.fromPin === toPin && edge.toPin === fromPin))
    ) ?? null
  )
}

function electricalOutputFor(analysis, component, positivePin, negativePin) {
  const edge = findSolvedEdge(analysis, component.id, positivePin, negativePin)
  const supplyVoltage = analysis.sourceVoltage || 0
  const rawVoltage = edge ? (edge.fromPin === positivePin ? edge.voltage : -edge.voltage) : 0
  const voltage = Math.max(0, rawVoltage)
  const currentMa = edge
    ? Math.max(0, edge.fromPin === positivePin ? edge.currentMa : -edge.currentMa)
    : 0
  const level = supplyVoltage > 0 ? clamp01(voltage / supplyVoltage) : 0
  return {
    voltage: roundMetric(voltage),
    currentMa: roundMetric(currentMa),
    level: roundMetric(level, 3),
  }
}

export function getCircuitMetrics(circuit) {
  const analysis = analyzeCircuit(circuit)
  return {
    supplyVoltage: roundMetric(analysis.primarySource ? analysis.sourceVoltage : 0),
    totalCurrentMa: roundMetric(analysis.totalCurrentMa),
    hasBattery: Boolean(analysis.sourceBattery),
    hasPowerSource: analysis.voltageSources.length > 0,
    hasShort: analysis.shorted,
  }
}

export function getWireState(circuit, wireLike) {
  const normalized = normalizeCircuit(circuit)
  const wire =
    typeof wireLike === 'string' ? normalized.wires.find((item) => item.id === wireLike) : wireLike
  if (!wire)
    return {
      energized: false,
      voltage: 0,
      currentMa: 0,
      fromVoltage: 0,
      toVoltage: 0,
      direction: 'forward',
    }

  const analysis = analyzeCircuit(normalized)
  const fromVoltage = analysis.voltageForRef(wire.from)
  const toVoltage = analysis.voltageForRef(wire.to)
  function crossingCurrentFrom(ref, otherRef) {
    const side = reachableIdealRefs(normalized, ref, wire.id)
    if (side.has(otherRef)) return 0
    const crossingCurrents = []
    analysis.solvedEdges.forEach((edge) => {
      if (side.has(edge.fromRef) !== side.has(edge.toRef))
        crossingCurrents.push(Math.abs(edge.currentMa))
    })
    if (
      analysis.positiveRef &&
      analysis.negativeRef &&
      side.has(analysis.positiveRef) !== side.has(analysis.negativeRef)
    ) {
      crossingCurrents.push(Math.abs(analysis.totalCurrentMa))
    }
    return Math.max(0, ...crossingCurrents)
  }
  const fromSideCurrent = crossingCurrentFrom(wire.from, wire.to)
  const toSideCurrent = crossingCurrentFrom(wire.to, wire.from)
  const possibleCurrents = [fromSideCurrent, toSideCurrent].filter((value) => value > 0)
  const currentMa =
    analysis.shorted || possibleCurrents.length === 0 ? 0 : Math.min(...possibleCurrents)
  const voltage = Math.max(Math.abs(fromVoltage), Math.abs(toVoltage))
  return {
    energized: !analysis.shorted && currentMa > 0.01,
    voltage: roundMetric(voltage),
    voltageDrop: roundMetric(Math.abs(fromVoltage - toVoltage)),
    currentMa: roundMetric(currentMa),
    fromVoltage: roundMetric(fromVoltage),
    toVoltage: roundMetric(toVoltage),
    direction: getWireCurrentDirection(normalized, wire),
  }
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
    graph.get(current)?.forEach((edge) => {
      const nextDistance = currentDistance + edge.resistanceOhms
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance)
        queue.push(edge.to)
      }
    })
  }
  return 0
}

function mixRgbChannels(channels) {
  const values = {
    red: [239, 68, 68],
    green: [34, 197, 94],
    blue: [59, 130, 246],
  }
  const mixed = channels.reduce(
    (acc, channel) => {
      const value = values[channel] ?? [0, 0, 0]
      return acc.map((part, index) => Math.min(255, part + value[index]))
    },
    [0, 0, 0]
  )
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function getComponentState(circuit, componentId) {
  const normalized = normalizeCircuit(circuit)
  const component = normalized.components.find((c) => c.id === componentId)
  if (!component) return {}
  const control = normalized.controls[componentId] ?? {}
  const analysis = analyzeCircuit(normalized)
  const refHasSourceRole = (ref, role) => {
    const node = analysis.nodeForRef(ref)
    return analysis.voltageSources.some(
      (source) => node === (role === 'negative' ? source.negativeNode : source.positiveNode)
    )
  }
  if (component.type === 'battery') {
    const source = analysis.voltageSources.find(
      (item) => item.componentId === component.id && item.type === 'battery'
    )
    return {
      powered: false,
      voltage: getBatteryVoltage(component),
      totalCurrentMa: source ? roundMetric(analysis.sourceCurrentMa.get(source.id) ?? 0) : 0,
    }
  }
  if (component.type === 'microcontroller') {
    const sourceCurrentMa = analysis.voltageSources
      .filter((source) => source.componentId === component.id)
      .reduce((sum, source) => sum + (analysis.sourceCurrentMa.get(source.id) ?? 0), 0)
    return {
      powered: true,
      voltage: MICROCONTROLLER_SUPPLY_VOLTAGE,
      totalCurrentMa: roundMetric(sourceCurrentMa),
      gpio: getMicrocontrollerGpioValues(normalized, component),
    }
  }
  if (component.type === 'transistor') {
    const baseHigh = transistorBaseIsHigh(normalized, component)
    return { powered: baseHigh, baseHigh, switched: baseHigh }
  }
  if (component.type === 'rgb_led') {
    const hasReturn = refHasSourceRole(pinRef(component.id, 'cathode'), 'negative')
    const channelStates = RGB_LED_PINS.map((pin) => ({
      pin,
      output: electricalOutputFor(analysis, component, pin, 'cathode'),
    }))
    const channels = channelStates
      .filter((channel) => channel.output.voltage > 0.01)
      .map((channel) => channel.pin)
    const powered = channels.length > 0
    const brightest = channelStates.reduce(
      (best, channel) => (channel.output.level > best.level ? channel.output : best),
      { voltage: 0, currentMa: 0, level: 0 }
    )
    const outputLevel = powered
      ? {
          ...brightest,
          seriesResistanceOhms:
            analysis.positiveRef && analysis.negativeRef
              ? estimateSeriesResistance(
                  normalized,
                  analysis.positiveRef,
                  pinRef(component.id, channels[0] ?? 'red')
                ) +
                estimateSeriesResistance(
                  normalized,
                  pinRef(component.id, 'cathode'),
                  analysis.negativeRef
                )
              : 0,
        }
      : { voltage: 0, currentMa: 0, level: 0, seriesResistanceOhms: 0 }
    const active = powered && !circuitHasShort(normalized) && outputLevel.level > 0.03
    return {
      on: active,
      powered,
      hasReturn,
      channels,
      color: mixRgbChannels(channels),
      brightness: Math.round(outputLevel.level * 100),
      ...outputLevel,
    }
  }
  if (component.type === 'lcd1602') {
    const hasPositive = refHasSourceRole(pinRef(component.id, 'VCC'), 'positive')
    const hasReturn = refHasSourceRole(pinRef(component.id, 'GND'), 'negative')
    const measuredOutput = electricalOutputFor(analysis, component, 'VCC', 'GND')
    const powered = (hasPositive && hasReturn) || measuredOutput.currentMa > 0.01
    const controlLines = Array.isArray(control.lines) ? control.lines : []
    const lines = [0, 1].map((row) =>
      String(controlLines[row] ?? '')
        .slice(0, 16)
        .padEnd(16, ' ')
    )
    return {
      powered: powered && !circuitHasShort(normalized),
      hasPositive,
      hasReturn,
      backlight: control.backlight !== false,
      lines,
      cursor: {
        col: Math.max(0, Math.min(15, Number(control.cursor?.col ?? 0) || 0)),
        row: Math.max(0, Math.min(1, Number(control.cursor?.row ?? 0) || 0)),
      },
      ...measuredOutput,
    }
  }
  const positivePin = component.type === 'led' || component.type === 'diode' ? 'anode' : 'positive'
  const negativePin =
    component.type === 'led' || component.type === 'diode' ? 'cathode' : 'negative'
  const hasPositive = refHasSourceRole(pinRef(component.id, positivePin), 'positive')
  const hasReturn = refHasSourceRole(pinRef(component.id, negativePin), 'negative')
  const measuredOutput = electricalOutputFor(analysis, component, positivePin, negativePin)
  const powered = (hasPositive && hasReturn) || measuredOutput.currentMa > 0.01
  const outputLevel = powered
    ? {
        ...measuredOutput,
        seriesResistanceOhms:
          analysis.positiveRef && analysis.negativeRef
            ? estimateSeriesResistance(
                normalized,
                analysis.positiveRef,
                pinRef(component.id, positivePin)
              ) +
              estimateSeriesResistance(
                normalized,
                pinRef(component.id, negativePin),
                analysis.negativeRef
              )
            : 0,
      }
    : { voltage: 0, currentMa: 0, level: 0, seriesResistanceOhms: 0 }
  const active = powered && !circuitHasShort(normalized) && outputLevel.level > 0.03
  if (component.type === 'led')
    return {
      on: active,
      powered,
      hasPositive,
      hasReturn,
      brightness: Math.round(outputLevel.level * 100),
      ...outputLevel,
    }
  if (component.type === 'diode')
    return { powered: active, conducting: active, hasPositive, hasReturn, ...outputLevel }
  if (component.type === 'motor')
    return {
      on: active,
      powered,
      hasPositive,
      hasReturn,
      speed: Math.round(outputLevel.level * 100),
      ...outputLevel,
    }
  if (component.type === 'servo_motor')
    return {
      on: active,
      powered,
      hasPositive,
      hasReturn,
      angle: Number(control.angle ?? component.props?.angle ?? 90),
      ...outputLevel,
    }
  if (component.type === 'buzzer')
    return {
      on: active,
      powered,
      hasPositive,
      hasReturn,
      volume: Math.round(outputLevel.level * 100),
      ...outputLevel,
    }
  if (component.type === 'push_button')
    return { pressed: control.pressed === true, closed: control.pressed === true }
  if (component.type === 'slide_switch') return { closed: control.closed === true }
  if (component.type === 'potentiometer')
    return { value: Number(control.value ?? component.props?.value ?? 50) }
  if (component.type === 'sensor')
    return {
      powered: active,
      hasPositive,
      hasReturn,
      kind: component.props?.kind ?? 'light',
      value: Number(control.value ?? component.props?.value ?? 50),
      ...outputLevel,
    }
  if (component.type === 'resistor') {
    const edge = findSolvedEdge(analysis, component.id, 'a', 'b')
    return {
      resistanceOhms: getComponentResistanceOhms(component),
      powered,
      voltage: roundMetric(Math.abs(edge?.voltage ?? 0)),
      currentMa: roundMetric(Math.abs(edge?.currentMa ?? 0)),
    }
  }
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
  else if (component.type === 'transistor') control.baseHigh = active
  else return normalized
  normalized.controls = { ...normalized.controls, [component.id]: control }
  return normalized
}

function controlAffectsComponentPower(circuit, controlSelector, componentSelector) {
  const controls = findComponents(circuit, controlSelector).filter(
    (component) =>
      component.type === 'push_button' ||
      component.type === 'slide_switch' ||
      component.type === 'transistor'
  )
  const targets = findComponents(circuit, componentSelector)
  return controls.some((control) =>
    targets.some((target) => {
      const offCircuit = setControlForCheck(circuit, control, false)
      const onCircuit = setControlForCheck(circuit, control, true)
      return (
        !componentCountsAsPowered(offCircuit, target) && componentCountsAsPowered(onCircuit, target)
      )
    })
  )
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
    return findComponents(circuit, check.component).some((component) =>
      componentCountsAsPowered(circuit, component)
    )
  }
  if (check.type === 'circuit_component_unpowered') {
    const components = findComponents(circuit, check.component)
    return (
      components.length > 0 &&
      components.every((component) => !componentCountsAsPowered(circuit, component))
    )
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
  // Any other check type is treated as a generic code check (`code`,
  // `code_contains`, `code_equals`, `code_matches_regex`, and their negated
  // variants — the same shared check types Python/HTML/Arcade lessons use)
  // evaluated against the circuit's Micro Controller MicroPython source.
  return evaluateCodeCheck(check, getMicrocontrollerCode(circuit))
}

// Real pin names per component type — the single source of truth for both the simulator
// (makeComponent, below) and the Builder's Check Editor (CheckEditor.jsx's PIN_OPTIONS),
// so a new component type's pins can't be added here without the check-authoring UI
// picking them up too.
export const COMPONENT_PINS = {
  battery: ['positive', 'negative'],
  resistor: ['a', 'b'],
  led: ['anode', 'cathode'],
  rgb_led: ['red', 'green', 'blue', 'cathode'],
  lcd1602: ['VCC', 'GND', 'SDA', 'SCL'],
  push_button: ['a', 'b'],
  slide_switch: ['a', 'b'],
  potentiometer: ['left', 'wiper', 'right'],
  motor: ['positive', 'negative'],
  servo_motor: ['positive', 'signal', 'negative'],
  buzzer: ['positive', 'negative'],
  microcontroller: MICROCONTROLLER_DEFAULT_PINS,
  transistor: ['collector', 'base', 'emitter'],
  diode: ['anode', 'cathode'],
  sensor: ['positive', 'signal', 'negative'],
  terminal: ['pin'],
}

export function makeComponent(type, index, position = { row: 2, col: 2 }) {
  return {
    id: `${type}${index}`,
    type,
    label: COMPONENT_LABELS[type] ?? type,
    position,
    rotation: 0,
    pins: COMPONENT_PINS[type] ?? ['a', 'b'],
    props:
      type === 'potentiometer'
        ? { value: 50 }
        : type === 'resistor'
          ? { resistanceOhms: DEFAULT_RESISTANCE_OHMS }
          : type === 'led'
            ? { color: 'red' }
            : type === 'sensor'
              ? { kind: 'light', value: 50 }
              : type === 'servo_motor'
                ? { angle: 90 }
                : type === 'microcontroller'
                  ? { boardType: 'MicroPython', code: DEFAULT_MICROPYTHON_CODE }
                  : type === 'lcd1602'
                    ? { address: '0x27' }
                    : type === 'battery'
                      ? { voltage: 5 }
                      : {},
  }
}
