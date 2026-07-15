import { describe, expect, it } from 'vitest'
import { DEFAULT_CIRCUIT, arePinsConnected, circuitHasShort, evaluateElectronicsCheck, getComponentResistanceOhms, getComponentState, getWireColorForPins, getWireCurrentDirection, makeComponent, normalizeAvailableComponents, pinRef } from '../circuit'

const BATTERY = makeComponent('battery', 1, { row: 1, col: 1 })

describe('electronics circuit helpers', () => {
  it('starts new electronics boards without a default battery', () => {
    expect(DEFAULT_CIRCUIT.components).toEqual([])
  })

  it('evaluates semantic path checks between parts', () => {
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [
        BATTERY,
        { id: 'led1', type: 'led', label: 'LED', position: { row: 2, col: 4 }, pins: ['anode', 'cathode'], props: {} },
      ],
      wires: [{ id: 'w1', from: pinRef('battery1', 'positive'), to: pinRef('led1', 'anode') }],
    }
    expect(arePinsConnected(circuit, 'battery1.positive', 'led1.anode')).toBe(true)
    expect(evaluateElectronicsCheck({
      type: 'circuit_path_exists',
      from: { type: 'battery', pin: 'positive' },
      to: { type: 'led', pin: 'anode' },
    }, circuit)).toBe(true)
  })

  it('detects battery shorts', () => {
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY],
      wires: [{ id: 'w1', from: 'battery1.positive', to: 'battery1.negative' }],
    }
    expect(circuitHasShort(circuit)).toBe(true)
    expect(evaluateElectronicsCheck({ type: 'circuit_no_short' }, circuit)).toBe(false)
  })

  it('powers an output only when supply and return are connected', () => {
    const led = { id: 'led1', type: 'led', label: 'LED', position: { row: 2, col: 4 }, pins: ['anode', 'cathode'], props: {} }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, led],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'led1.anode' },
      ],
    }

    expect(getComponentState(circuit, 'led1').on).toBe(false)

    const completeCircuit = {
      ...circuit,
      wires: [...circuit.wires, { id: 'w2', from: 'battery1.negative', to: 'led1.cathode' }],
    }
    expect(getComponentState(completeCircuit, 'led1').on).toBe(true)
  })

  it('uses a pressed push button as a conductor', () => {
    const button = { id: 'push_button1', type: 'push_button', label: 'Button', position: { row: 2, col: 4 }, pins: ['a', 'b'], props: {} }
    const motor = { id: 'motor1', type: 'motor', label: 'Motor', position: { row: 2, col: 8 }, pins: ['positive', 'negative'], props: {} }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, button, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'push_button1.a' },
        { id: 'w2', from: 'push_button1.b', to: 'motor1.positive' },
        { id: 'w3', from: 'battery1.negative', to: 'motor1.negative' },
      ],
      controls: { push_button1: { pressed: false } },
    }

    expect(getComponentState(circuit, 'motor1').on).toBe(false)
    expect(arePinsConnected(circuit, 'battery1.positive', 'motor1.positive')).toBe(false)

    const pressedCircuit = { ...circuit, controls: { push_button1: { pressed: true } } }
    expect(arePinsConnected(pressedCircuit, 'battery1.positive', 'motor1.positive')).toBe(true)
    expect(getComponentState(pressedCircuit, 'motor1').on).toBe(true)
  })

  it('checks that a control affects power to a target part', () => {
    const switchPart = { id: 'slide_switch1', type: 'slide_switch', label: 'Switch', position: { row: 2, col: 4 }, pins: ['a', 'b'], props: {} }
    const motor = { id: 'motor1', type: 'motor', label: 'Motor', position: { row: 2, col: 8 }, pins: ['positive', 'negative'], props: {} }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, switchPart, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'slide_switch1.a' },
        { id: 'w2', from: 'slide_switch1.b', to: 'motor1.positive' },
        { id: 'w3', from: 'battery1.negative', to: 'motor1.negative' },
      ],
      controls: { slide_switch1: { closed: false } },
    }

    expect(evaluateElectronicsCheck({
      type: 'circuit_control_affects_power',
      control: { type: 'slide_switch' },
      component: { type: 'motor' },
    }, circuit)).toBe(true)
    expect(evaluateElectronicsCheck({
      type: 'circuit_path_includes',
      from: { type: 'battery', pin: 'positive' },
      to: { type: 'motor', pin: 'positive' },
      includes: { type: 'slide_switch' },
    }, { ...circuit, controls: { slide_switch1: { closed: true } } })).toBe(true)
  })

  it('rejects control checks when the target is powered through a bypass', () => {
    const switchPart = { id: 'slide_switch1', type: 'slide_switch', label: 'Switch', position: { row: 2, col: 4 }, pins: ['a', 'b'], props: {} }
    const motor = { id: 'motor1', type: 'motor', label: 'Motor', position: { row: 2, col: 8 }, pins: ['positive', 'negative'], props: {} }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, switchPart, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'slide_switch1.a' },
        { id: 'w2', from: 'slide_switch1.b', to: 'motor1.positive' },
        { id: 'w3', from: 'battery1.negative', to: 'motor1.negative' },
        { id: 'w4', from: 'battery1.positive', to: 'motor1.positive' },
      ],
      controls: { slide_switch1: { closed: false } },
    }

    expect(evaluateElectronicsCheck({
      type: 'circuit_component_powered',
      component: { type: 'motor' },
    }, circuit)).toBe(true)
    expect(evaluateElectronicsCheck({
      type: 'circuit_control_affects_power',
      control: { type: 'slide_switch' },
      component: { type: 'motor' },
    }, circuit)).toBe(false)
    expect(evaluateElectronicsCheck({
      type: 'circuit_path_includes',
      from: { type: 'battery', pin: 'positive' },
      to: { type: 'motor', pin: 'positive' },
      includes: { type: 'slide_switch' },
    }, { ...circuit, controls: { slide_switch1: { closed: true } } })).toBe(false)
  })

  it('normalizes available component lists without duplicates or unknown parts', () => {
    expect(normalizeAvailableComponents(null)).toContain('battery')
    expect(normalizeAvailableComponents(['led', 'unknown', 'battery', 'led'])).toEqual(['led', 'battery'])
    expect(normalizeAvailableComponents([])).toEqual([])
  })

  it('chooses semantic automatic wire colors from pin names', () => {
    expect(getWireColorForPins('battery1.positive', 'led1.anode')).toBe('#ef4444')
    expect(getWireColorForPins('battery1.negative', 'led1.cathode')).toBe('#111827')
    expect(getWireColorForPins('potentiometer1.wiper', 'terminal1.pin')).toBe('#2563eb')
    expect(getWireColorForPins('switch1.a', 'motor1.positive', '#16a34a')).toBe('#16a34a')
  })

  it('gives new resistors a default selectable resistance value', () => {
    expect(getComponentResistanceOhms(makeComponent('resistor', 1))).toBe(330)
    expect(getComponentState({ ...DEFAULT_CIRCUIT, components: [makeComponent('resistor', 1)] }, 'resistor1').resistanceOhms).toBe(330)
  })

  it('gives new LEDs a selectable red default color', () => {
    expect(makeComponent('led', 1).props.color).toBe('red')
  })

  it('reports current direction from polarity rather than wire creation direction', () => {
    const led = { id: 'led1', type: 'led', label: 'LED', position: { row: 2, col: 4 }, pins: ['anode', 'cathode'], props: {} }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, led],
      wires: [
        { id: 'supply', from: 'battery1.positive', to: 'led1.anode' },
        { id: 'return', from: 'battery1.negative', to: 'led1.cathode' },
      ],
    }

    expect(getWireCurrentDirection(circuit, circuit.wires[0])).toBe('forward')
    expect(getWireCurrentDirection(circuit, circuit.wires[1])).toBe('reverse')
  })

  it('reduces output voltage and speed when a resistor is in series', () => {
    const motor = { id: 'motor1', type: 'motor', label: 'Motor', position: { row: 2, col: 8 }, pins: ['positive', 'negative'], props: {} }
    const resistor = { id: 'resistor1', type: 'resistor', label: 'Resistor', position: { row: 2, col: 5 }, pins: ['a', 'b'], props: { resistanceOhms: 1000 } }
    const directCircuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'motor1.positive' },
        { id: 'w2', from: 'battery1.negative', to: 'motor1.negative' },
      ],
    }
    const resistedCircuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, resistor, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'resistor1.a' },
        { id: 'w2', from: 'resistor1.b', to: 'motor1.positive' },
        { id: 'w3', from: 'battery1.negative', to: 'motor1.negative' },
      ],
    }

    const directState = getComponentState(directCircuit, 'motor1')
    const resistedState = getComponentState(resistedCircuit, 'motor1')
    expect(directState.on).toBe(true)
    expect(directState.speed).toBe(100)
    expect(resistedState.on).toBe(true)
    expect(resistedState.seriesResistanceOhms).toBe(1000)
    expect(resistedState.voltage).toBeLessThan(directState.voltage)
    expect(resistedState.speed).toBeLessThan(directState.speed)
  })

  it('adds multiple resistor values on a series path', () => {
    const led = { id: 'led1', type: 'led', label: 'LED', position: { row: 2, col: 10 }, pins: ['anode', 'cathode'], props: {} }
    const resistor1 = { id: 'resistor1', type: 'resistor', label: 'Resistor', position: { row: 2, col: 5 }, pins: ['a', 'b'], props: { resistanceOhms: 220 } }
    const resistor2 = { id: 'resistor2', type: 'resistor', label: 'Resistor', position: { row: 2, col: 7 }, pins: ['a', 'b'], props: { resistanceOhms: 330 } }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, resistor1, resistor2, led],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'resistor1.a' },
        { id: 'w2', from: 'resistor1.b', to: 'resistor2.a' },
        { id: 'w3', from: 'resistor2.b', to: 'led1.anode' },
        { id: 'w4', from: 'battery1.negative', to: 'led1.cathode' },
      ],
    }

    expect(getComponentState(circuit, 'led1').seriesResistanceOhms).toBe(550)
  })
})
