import { beforeEach, describe, expect, it, vi } from 'vitest'
import electronicsModule, { buildMicroPythonProgram } from '../index.js'
import { DEFAULT_CIRCUIT, makeComponent, parseCircuit } from '../circuit'
import { runPython } from '../../python/pyodide'

vi.mock('../../python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  isPyodideReady: vi.fn(() => true),
  runPython: vi.fn(),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
}))

describe('electronics MicroPython runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('installs MicroPython shim helpers in Python globals', () => {
    expect(buildMicroPythonProgram('pass')).toContain('globals())')
  })

  it('streams private GPIO writes back to the circuit while keeping sentinels out of output', async () => {
    const microcontroller = { ...makeComponent('microcontroller', 1, { row: 2, col: 2 }), pins: ['3V3', 'GND', 'GP0', 'GP1'] }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller],
    }
    const onCodeUpdate = vi.fn()
    const onOutput = vi.fn()

    runPython.mockImplementation(async (_program, callbacks) => {
      callbacks.onGpioWrite('GP0', 1)
      callbacks.onOutput('[pin GP1] 1\n', 'stdout')
      callbacks.onOutput('still running\n', 'stdout')
      callbacks.onGpioWrite('GP0', 0)
      return { status: 'stopped' }
    })

    const result = await electronicsModule.runtime.run(circuit, {}, { onCodeUpdate, onOutput })

    expect(onOutput).toHaveBeenCalledTimes(1)
    expect(onOutput).toHaveBeenCalledWith('still running\n', 'stdout')
    expect(onCodeUpdate).toHaveBeenCalledTimes(3)
    expect(parseCircuit(onCodeUpdate.mock.calls[0][0]).controls.microcontroller1.gpio.GP0).toBe(1)
    expect(parseCircuit(onCodeUpdate.mock.calls[1][0]).controls.microcontroller1.gpio.GP1).toBe(1)
    expect(parseCircuit(onCodeUpdate.mock.calls[2][0]).controls.microcontroller1.gpio.GP0).toBe(0)
    expect(parseCircuit(result.updatedCode).controls.microcontroller1.gpio.GP0).toBe(0)
    expect(parseCircuit(result.updatedCode).controls.microcontroller1.gpio.GP1).toBe(1)
  })

  it('passes GPIO input readings into the MicroPython worker', async () => {
    const microcontroller = { ...makeComponent('microcontroller', 1, { row: 2, col: 2 }), pins: ['3V3', 'GND', 'GP14'] }
    const button = makeComponent('push_button', 1, { row: 2, col: 8 })
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller, button],
      wires: [
        { id: 'power', from: 'microcontroller1.3V3', to: 'push_button1.a' },
        { id: 'signal', from: 'push_button1.b', to: 'microcontroller1.GP14' },
      ],
      controls: { push_button1: { pressed: true } },
    }

    runPython.mockResolvedValue({ status: 'success' })

    await electronicsModule.runtime.run(circuit, {}, {})

    expect(runPython.mock.calls[0][1].gpioInputs.GP14).toBe(1)
    expect(runPython.mock.calls[0][1].asyncNames).toEqual(expect.arrayContaining(['sleep', 'sleep_ms']))
  })

  it('only drives pins configured as outputs', async () => {
    const microcontroller = { ...makeComponent('microcontroller', 1, { row: 2, col: 2 }), pins: ['3V3', 'GND', 'GP0', 'GP14'] }
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [microcontroller],
    }

    runPython.mockImplementation(async (_program, callbacks) => {
      callbacks.onGpioConfigure('GP14', 0)
      callbacks.onGpioConfigure('GP0', 1)
      return { status: 'success' }
    })

    const result = await electronicsModule.runtime.run(circuit, {}, {})
    const gpio = parseCircuit(result.updatedCode).controls.microcontroller1.gpio

    expect(gpio.GP0).toBe(0)
    expect(gpio.GP14).toBeUndefined()
  })
})
