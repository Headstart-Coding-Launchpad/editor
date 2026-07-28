import { describe, expect, it } from 'vitest'
import { BOARD_SIZE_OPTIONS, COMPONENT_DESCRIPTIONS, COMPONENT_GROUPS, COMPONENT_LABELS, COMPONENT_TYPES, DEFAULT_CIRCUIT, DEFAULT_MICROPYTHON_CODE, MICROCONTROLLER_DEFAULT_PINS, applyI2cLcdEvent, applyMicrocontrollerGpioValues, arePinsConnected, circuitHasShort, evaluateElectronicsCheck, getCircuitMetrics, getComponentResistanceOhms, getComponentState, getI2cLcdTargets, getMicrocontrollerCode, getMicrocontrollerGpioValues, getMicrocontrollerInputValues, getWireColorForPins, getWireCurrentDirection, getWireState, makeComponent, makeNextGpioPinName, normalizeAvailableComponents, normalizeGpioPinName, normalizeMicrocontrollerPins, parseCircuit, pinRef } from '../circuit'

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

  it('defaults new boards to the standard larger breadboard size', () => {
    expect(BOARD_SIZE_OPTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'standard', rows: 18, cols: 30 }),
    ]))
    expect(DEFAULT_CIRCUIT.board).toMatchObject({ rows: 18, cols: 30 })
    expect(parseCircuit({ components: [], wires: [], controls: {} }).board).toMatchObject({ rows: 18, cols: 30 })
  })

  it('groups available components into palette categories', () => {
    const groupedTypes = new Set(COMPONENT_GROUPS.flatMap(group => group.types))
    expect(COMPONENT_GROUPS.map(group => group.id)).toEqual(['power', 'basics', 'outputs', 'control'])
    expect([...groupedTypes].sort()).toEqual([...COMPONENT_TYPES].sort())
  })

  it('includes the expanded electronics parts in the component registry', () => {
    expect(COMPONENT_TYPES).toEqual(expect.arrayContaining(['transistor', 'diode', 'sensor', 'servo_motor', 'rgb_led', 'microcontroller']))
    expect(COMPONENT_LABELS.rgb_led).toBe('RGB LED')
    expect(COMPONENT_LABELS.microcontroller).toBe('Micro Controller')
    expect(COMPONENT_DESCRIPTIONS.transistor).toContain('electronic switch')
    expect(COMPONENT_DESCRIPTIONS.microcontroller).toContain('MicroPython')
    expect(normalizeAvailableComponents(['transistor', 'diode', 'sensor', 'servo_motor', 'rgb_led', 'microcontroller'])).toEqual(['transistor', 'diode', 'sensor', 'servo_motor', 'rgb_led', 'microcontroller'])
  })

  it('chooses semantic automatic wire colors from pin names', () => {
    expect(getWireColorForPins('battery1.positive', 'led1.anode')).toBe('#ef4444')
    expect(getWireColorForPins('battery1.negative', 'led1.cathode')).toBe('#111827')
    expect(getWireColorForPins('potentiometer1.wiper', 'terminal1.pin')).toBe('#2563eb')
    expect(getWireColorForPins('sensor1.signal', 'servo_motor1.signal')).toBe('#2563eb')
    expect(getWireColorForPins('microcontroller1.GP0', 'servo_motor1.signal')).toBe('#2563eb')
    expect(getWireColorForPins('battery1.positive', 'rgb_led1.green')).toBe('#16a34a')
    expect(getWireColorForPins('switch1.a', 'motor1.positive', '#16a34a')).toBe('#16a34a')
  })

  it('gives new resistors a default selectable resistance value', () => {
    expect(getComponentResistanceOhms(makeComponent('resistor', 1))).toBe(330)
    expect(getComponentState({ ...DEFAULT_CIRCUIT, components: [makeComponent('resistor', 1)] }, 'resistor1').resistanceOhms).toBe(330)
  })

  it('gives new LEDs a selectable red default color', () => {
    expect(makeComponent('led', 1).props.color).toBe('red')
  })

  it('gives new expanded components useful pins and default props', () => {
    expect(makeComponent('transistor', 1).pins).toEqual(['collector', 'base', 'emitter'])
    expect(makeComponent('diode', 1).pins).toEqual(['anode', 'cathode'])
    expect(makeComponent('sensor', 1).props).toEqual({ kind: 'light', value: 50 })
    expect(makeComponent('servo_motor', 1).props.angle).toBe(90)
    expect(makeComponent('rgb_led', 1).pins).toEqual(['red', 'green', 'blue', 'cathode'])
    expect(makeComponent('microcontroller', 1).pins).toEqual(MICROCONTROLLER_DEFAULT_PINS)
    expect(makeComponent('microcontroller', 1).props.code).toBe(DEFAULT_MICROPYTHON_CODE)
  })

  it('normalizes Micro Controller GPIO pins and code', () => {
    expect(normalizeGpioPinName(' GP 0.1 ')).toBe('GP_0_1')
    expect(normalizeMicrocontrollerPins(['GP0', 'GP0', 'A.1', '', 'GND'])).toEqual(['GP0', 'A_1', 'GND'])
    expect(makeNextGpioPinName(['GP0', 'GP1', 'GND'])).toBe('GP2')

    const legacyCircuit = parseCircuit({
      ...DEFAULT_CIRCUIT,
      microcontroller: { enabled: true, code: 'print("legacy")' },
      components: [{ ...makeComponent('microcontroller', 1), pins: ['GP0', 'GP0', 'A.1'], props: {} }],
    })

    expect(legacyCircuit.components[0].pins).toEqual(['GP0', 'A_1'])
    expect(getMicrocontrollerCode(legacyCircuit)).toBe('print("legacy")')
    expect(evaluateElectronicsCheck({ type: 'circuit_has_component', component: { type: 'microcontroller' } }, legacyCircuit)).toBe(true)
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

  it('uses configured battery voltage for output voltage and current', () => {
    const battery = { ...BATTERY, props: { voltage: 9 } }
    const motor = makeComponent('motor', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [battery, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'motor1.positive' },
        { id: 'w2', from: 'battery1.negative', to: 'motor1.negative' },
      ],
    }

    expect(getComponentState(circuit, 'battery1')).toMatchObject({ voltage: 9, totalCurrentMa: 75 })
    expect(getComponentState(circuit, 'motor1')).toMatchObject({ voltage: 9, currentMa: 75, speed: 100 })
    expect(getCircuitMetrics(circuit)).toMatchObject({ supplyVoltage: 9, totalCurrentMa: 75 })
  })

  it('increases total current for parallel branches while keeping branch voltage', () => {
    const motor1 = makeComponent('motor', 1, { row: 2, col: 8 })
    const motor2 = makeComponent('motor', 2, { row: 4, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, motor1, motor2],
      wires: [
        { id: 'supply1', from: 'battery1.positive', to: 'motor1.positive' },
        { id: 'return1', from: 'battery1.negative', to: 'motor1.negative' },
        { id: 'supply2', from: 'battery1.positive', to: 'motor2.positive' },
        { id: 'return2', from: 'battery1.negative', to: 'motor2.negative' },
      ],
    }

    expect(getComponentState(circuit, 'motor1')).toMatchObject({ voltage: 5, currentMa: 41.67 })
    expect(getComponentState(circuit, 'motor2')).toMatchObject({ voltage: 5, currentMa: 41.67 })
    expect(getCircuitMetrics(circuit).totalCurrentMa).toBe(83.33)
    expect(getWireState(circuit, 'supply1')).toMatchObject({ voltage: 5, currentMa: 41.67 })
  })

  it('divides voltage and lowers current through series devices', () => {
    const motor1 = makeComponent('motor', 1, { row: 2, col: 8 })
    const motor2 = makeComponent('motor', 2, { row: 2, col: 11 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, motor1, motor2],
      wires: [
        { id: 'supply', from: 'battery1.positive', to: 'motor1.positive' },
        { id: 'middle', from: 'motor1.negative', to: 'motor2.positive' },
        { id: 'return', from: 'motor2.negative', to: 'battery1.negative' },
      ],
    }

    expect(getComponentState(circuit, 'motor1')).toMatchObject({ voltage: 2.5, currentMa: 20.83, speed: 50 })
    expect(getComponentState(circuit, 'motor2')).toMatchObject({ voltage: 2.5, currentMa: 20.83, speed: 50 })
    expect(getCircuitMetrics(circuit).totalCurrentMa).toBe(20.83)
    expect(getWireState(circuit, 'middle')).toMatchObject({ currentMa: 20.83 })
  })

  it('uses a transistor base signal to switch a motor return path', () => {
    const transistor = makeComponent('transistor', 1, { row: 2, col: 5 })
    const motor = makeComponent('motor', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, transistor, motor],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'motor1.positive' },
        { id: 'w2', from: 'motor1.negative', to: 'transistor1.collector' },
        { id: 'w3', from: 'transistor1.emitter', to: 'battery1.negative' },
      ],
    }

    expect(getComponentState(circuit, 'transistor1').switched).toBe(false)
    expect(getComponentState(circuit, 'motor1').on).toBe(false)

    const baseDrivenCircuit = {
      ...circuit,
      wires: [...circuit.wires, { id: 'w4', from: 'battery1.positive', to: 'transistor1.base' }],
    }
    expect(getComponentState(baseDrivenCircuit, 'transistor1').switched).toBe(true)
    expect(getComponentState(baseDrivenCircuit, 'motor1').on).toBe(true)
  })

  it('reports diode, sensor, servo, and RGB LED classroom states', () => {
    const diode = makeComponent('diode', 1, { row: 2, col: 4 })
    const sensor = makeComponent('sensor', 1, { row: 2, col: 6 })
    const servo = makeComponent('servo_motor', 1, { row: 2, col: 8 })
    const rgbLed = makeComponent('rgb_led', 1, { row: 2, col: 10 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [BATTERY, diode, sensor, servo, rgbLed],
      wires: [
        { id: 'w1', from: 'battery1.positive', to: 'diode1.anode' },
        { id: 'w2', from: 'battery1.negative', to: 'diode1.cathode' },
        { id: 'w3', from: 'battery1.positive', to: 'sensor1.positive' },
        { id: 'w4', from: 'battery1.negative', to: 'sensor1.negative' },
        { id: 'w5', from: 'battery1.positive', to: 'servo_motor1.positive' },
        { id: 'w6', from: 'battery1.negative', to: 'servo_motor1.negative' },
        { id: 'w7', from: 'battery1.positive', to: 'rgb_led1.red' },
        { id: 'w8', from: 'battery1.positive', to: 'rgb_led1.blue' },
        { id: 'w9', from: 'battery1.negative', to: 'rgb_led1.cathode' },
      ],
      controls: {
        sensor1: { value: 72 },
        servo_motor1: { angle: 45 },
      },
    }

    expect(getComponentState(circuit, 'diode1').conducting).toBe(true)
    expect(getComponentState(circuit, 'sensor1')).toMatchObject({ powered: true, kind: 'light', value: 72 })
    expect(getComponentState(circuit, 'servo_motor1')).toMatchObject({ on: true, angle: 45 })
    expect(getComponentState(circuit, 'rgb_led1')).toMatchObject({ on: true, channels: ['red', 'blue'] })
    expect(evaluateElectronicsCheck({ type: 'circuit_component_powered', component: { type: 'rgb_led' } }, circuit)).toBe(true)
  })

  it('powers breadboard components from microcontroller 3V3 and GND pins', () => {
    const microcontroller = makeComponent('microcontroller', 1, { row: 2, col: 2 })
    const led = makeComponent('led', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, led],
      wires: [
        { id: 'supply', from: 'microcontroller1.3V3', to: 'led1.anode' },
        { id: 'return', from: 'microcontroller1.GND', to: 'led1.cathode' },
      ],
    }

    expect(getCircuitMetrics(circuit)).toMatchObject({ supplyVoltage: 3.3, hasPowerSource: true })
    expect(getComponentState(circuit, 'led1')).toMatchObject({ on: true, voltage: 3.3, currentMa: 10 })
    expect(getComponentState(circuit, 'microcontroller1').totalCurrentMa).toBe(10)
  })

  it('models a wired I²C LCD and applies its text commands to its two display rows', () => {
    const microcontroller = { ...makeComponent('microcontroller', 1, { row: 2, col: 2 }), pins: ['3V3', 'GND', 'GP0', 'GP1'] }
    const lcd = makeComponent('lcd1602', 1, { row: 2, col: 9 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, lcd],
      wires: [
        { id: 'power', from: 'microcontroller1.3V3', to: 'lcd16021.VCC' },
        { id: 'ground', from: 'microcontroller1.GND', to: 'lcd16021.GND' },
        { id: 'sda', from: 'microcontroller1.GP0', to: 'lcd16021.SDA' },
        { id: 'scl', from: 'microcontroller1.GP1', to: 'lcd16021.SCL' },
      ],
    }

    expect(getComponentState(circuit, 'lcd16021')).toMatchObject({ powered: true, backlight: true })
    expect(getI2cLcdTargets(circuit, 'GP0', 'GP1')).toHaveLength(1)

    const initialized = applyI2cLcdEvent(circuit, { sda: 'GP0', scl: 'GP1', action: 'init' })
    const firstRow = applyI2cLcdEvent(initialized, { sda: 'GP0', scl: 'GP1', action: 'print', text: 'Hello' })
    const secondRow = applyI2cLcdEvent(firstRow, { sda: 'GP0', scl: 'GP1', action: 'cursor', col: 0, row: 1 })
    const displayed = applyI2cLcdEvent(secondRow, { sda: 'GP0', scl: 'GP1', action: 'print', text: 'World' })

    expect(getComponentState(displayed, 'lcd16021').lines).toEqual(['Hello           ', 'World           '])
  })

  it('uses MicroPython GPIO output values to drive breadboard components', () => {
    const microcontroller = makeComponent('microcontroller', 1, { row: 2, col: 2 })
    const led = makeComponent('led', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, led],
      wires: [
        { id: 'supply', from: 'microcontroller1.GP0', to: 'led1.anode' },
        { id: 'return', from: 'microcontroller1.GND', to: 'led1.cathode' },
      ],
    }

    expect(getComponentState(circuit, 'led1').on).toBe(false)

    const gpioHigh = applyMicrocontrollerGpioValues(circuit, { GP0: 1 })
    expect(getMicrocontrollerGpioValues(gpioHigh)).toMatchObject({ GP0: 1 })
    expect(getComponentState(gpioHigh, 'led1')).toMatchObject({ on: true, voltage: 3.3, currentMa: 10 })

    const gpioLow = applyMicrocontrollerGpioValues(gpioHigh, { GP0: 0 })
    expect(getMicrocontrollerGpioValues(gpioLow)).toMatchObject({ GP0: 0 })
    expect(getComponentState(gpioLow, 'led1').on).toBe(false)
  })

  it('reads GPIO input values from connected breadboard controls', () => {
    const microcontroller = { ...makeComponent('microcontroller', 1, { row: 2, col: 2 }), pins: ['3V3', 'GND', 'GP14'] }
    const button = makeComponent('push_button', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, button],
      wires: [
        { id: 'power', from: 'microcontroller1.3V3', to: 'push_button1.a' },
        { id: 'signal', from: 'push_button1.b', to: 'microcontroller1.GP14' },
      ],
      controls: { push_button1: { pressed: false } },
    }

    expect(getMicrocontrollerInputValues(circuit).GP14).toBeNull()
    expect(getMicrocontrollerInputValues({ ...circuit, controls: { push_button1: { pressed: true } } }).GP14).toBe(1)
    expect(getMicrocontrollerInputValues({
      ...circuit,
      wires: [{ id: 'ground', from: 'microcontroller1.GND', to: 'microcontroller1.GP14' }],
    }).GP14).toBe(0)
  })

  it('lets a GPIO high signal switch a transistor base', () => {
    const microcontroller = makeComponent('microcontroller', 1, { row: 2, col: 2 })
    const transistor = makeComponent('transistor', 1, { row: 2, col: 5 })
    const motor = makeComponent('motor', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, transistor, motor],
      wires: [
        { id: 'power', from: 'microcontroller1.3V3', to: 'motor1.positive' },
        { id: 'motor-return', from: 'motor1.negative', to: 'transistor1.collector' },
        { id: 'ground', from: 'transistor1.emitter', to: 'microcontroller1.GND' },
        { id: 'base', from: 'microcontroller1.GP0', to: 'transistor1.base' },
      ],
    }

    expect(getComponentState(circuit, 'motor1').on).toBe(false)
    const drivenCircuit = applyMicrocontrollerGpioValues(circuit, { GP0: 1 })
    expect(getComponentState(drivenCircuit, 'transistor1').switched).toBe(true)
    expect(getComponentState(drivenCircuit, 'motor1').on).toBe(true)
  })
})
