// Electronics module section of the Builder's printable lesson (authoring.printTask). Node-safe.
import { formatSummary, parseObjectLike, printCarryFrom } from '../printHelpers.js'

// The printed part names (the print has always used its own wording, e.g. 'Junction' for a
// terminal, rather than circuit.js's COMPONENT_LABELS).
const PRINT_COMPONENT_LABELS = {
  battery: 'Battery',
  resistor: 'Resistor',
  led: 'LED',
  push_button: 'Button',
  slide_switch: 'Switch',
  potentiometer: 'Potentiometer',
  motor: 'Motor',
  servo_motor: 'Servo',
  buzzer: 'Buzzer',
  rgb_led: 'RGB LED',
  microcontroller: 'Micro Controller',
  transistor: 'Transistor',
  diode: 'Diode',
  sensor: 'Sensor',
  terminal: 'Junction',
}

const MICROCONTROLLER_COMPONENT = 'microcontroller'

function componentTypeLabel(type) {
  return PRINT_COMPONENT_LABELS[type] ?? String(type ?? '')
}

function renderAvailableParts(parts, esc) {
  if (!Array.isArray(parts) || parts.length === 0) return ''
  const rows = [...parts]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map(
      (type) =>
        `<tr><td><code>${esc(type)}</code></td><td>${esc(componentTypeLabel(type))}</td></tr>`
    )
    .join('')
  return `<div class="field"><div class="field-label">Available Parts</div><table class="data-table parts-table"><tr><th>Type</th><th>Label</th></tr>${rows}</table></div>`
}

function renderComponentTable(components, esc) {
  if (!Array.isArray(components) || components.length === 0) {
    return `<div class="field-value muted">No components.</div>`
  }
  const rows = [...components]
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .map((component) => {
      const position = component.position
        ? `row ${component.position.row ?? ''}, col ${component.position.col ?? ''}`
        : ''
      const props =
        component.props && typeof component.props === 'object'
          ? Object.fromEntries(
              Object.entries(component.props).filter(
                ([key]) => key !== 'code' && key !== 'starterCode'
              )
            )
          : component.props
      return `<tr><td><code>${esc(component.id ?? '')}</code></td><td>${esc(componentTypeLabel(component.type))}</td><td>${esc(component.label ?? '')}</td><td>${esc((component.pins ?? []).join(', '))}</td><td>${esc(position)}</td><td>${esc(formatSummary(props))}</td></tr>`
    })
    .join('')
  return `<table class="data-table circuit-table"><tr><th>ID</th><th>Type</th><th>Label</th><th>Pins</th><th>Position</th><th>Properties</th></tr>${rows}</table>`
}

function renderWireTable(wires, esc) {
  if (!Array.isArray(wires) || wires.length === 0) {
    return `<div class="field-value muted">No wires.</div>`
  }
  const rows = [...wires]
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
    .map(
      (wire) =>
        `<tr><td><code>${esc(wire.id ?? '')}</code></td><td><code>${esc(wire.from ?? '')}</code></td><td><code>${esc(wire.to ?? '')}</code></td><td>${esc(wire.color ?? '')}</td></tr>`
    )
    .join('')
  return `<table class="data-table circuit-table"><tr><th>ID</th><th>From</th><th>To</th><th>Colour</th></tr>${rows}</table>`
}

function renderMicroPythonBlocks(label, circuit, esc) {
  const blocks = []
  const components = Array.isArray(circuit.components) ? circuit.components : []
  for (const component of components
    .filter((item) => item?.type === MICROCONTROLLER_COMPONENT)
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))) {
    const code = component.props?.code ?? component.props?.starterCode
    if (code) {
      blocks.push(
        `<div class="file-block"><div class="file-name">${esc(label)} - ${esc(component.id ?? 'microcontroller')}</div><pre class="code-block">${esc(code)}</pre></div>`
      )
    }
  }
  const legacyCode = circuit.microcontroller?.starterCode ?? circuit.microcontroller?.code
  if (legacyCode) {
    blocks.push(
      `<div class="file-block"><div class="file-name">${esc(label)} - microcontroller</div><pre class="code-block">${esc(legacyCode)}</pre></div>`
    )
  }
  return blocks.join('')
}

function renderCircuitField(label, circuitValue, esc) {
  if (circuitValue == null) return ''
  const circuit = parseObjectLike(circuitValue, { components: [], wires: [] })
  const board = circuit.board && typeof circuit.board === 'object' ? circuit.board : {}
  const boardSummary = [
    board.type,
    board.rows && board.cols ? `${board.rows} rows x ${board.cols} cols` : '',
  ]
    .filter(Boolean)
    .join(', ')
  const microPython = renderMicroPythonBlocks(label, circuit, esc)

  return [
    `<div class="field circuit-field"><div class="field-label">${esc(label)}</div>`,
    boardSummary ? `<div class="field-value circuit-board">Board: ${esc(boardSummary)}</div>` : '',
    `<div class="subfield-label">Components</div>`,
    renderComponentTable(circuit.components, esc),
    `<div class="subfield-label">Wires</div>`,
    renderWireTable(circuit.wires, esc),
    microPython ? `<div class="subfield-label">MicroPython Code</div>${microPython}` : '',
    `</div>`,
  ].join('')
}

export function printElectronicsTask(task, { esc }) {
  const parts = []
  parts.push(printCarryFrom('Carry Circuit From', task.carryCircuitFrom, esc))
  parts.push(renderAvailableParts(task.availableComponents, esc))
  if (
    task.microcontroller?.enabled ||
    task.microcontroller?.boardType ||
    task.microcontroller?.starterCode
  ) {
    parts.push(
      `<div class="field"><div class="field-label">Microcontroller</div><div class="field-value">${esc(task.microcontroller.boardType || 'Enabled')}</div></div>`
    )
    if (task.microcontroller.starterCode) {
      parts.push(
        `<div class="field"><div class="field-label">MicroPython Starter Code</div><pre class="code-block">${esc(task.microcontroller.starterCode)}</pre></div>`
      )
    }
  }
  parts.push(renderCircuitField('Starter Circuit', task.starterCircuit, esc))
  parts.push(renderCircuitField('Complete Circuit', task.completeCircuit, esc))
  if (task.codeStages?.length) {
    parts.push(
      `<div class="field"><div class="field-label">Circuit Stages (${task.codeStages.length})</div>`
    )
    for (const stage of task.codeStages) {
      parts.push(
        `<div class="stage"><div class="stage-label">${esc(stage.label || '')}</div>${renderCircuitField('Stage Circuit', stage.circuit ?? {}, esc)}</div>`
      )
    }
    parts.push(`</div>`)
  }
  return parts.join('')
}
