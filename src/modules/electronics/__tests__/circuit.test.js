import { describe, expect, it } from 'vitest'
import { DEFAULT_CIRCUIT, arePinsConnected, circuitHasShort, evaluateElectronicsCheck, pinRef } from '../circuit'

describe('electronics circuit helpers', () => {
  it('evaluates direct pin connections', () => {
    const circuit = {
      ...DEFAULT_CIRCUIT,
      components: [
        ...DEFAULT_CIRCUIT.components,
        { id: 'led1', type: 'led', label: 'LED', position: { row: 2, col: 4 }, pins: ['anode', 'cathode'], props: {} },
      ],
      wires: [{ id: 'w1', from: pinRef('battery1', 'positive'), to: pinRef('led1', 'anode') }],
    }
    expect(arePinsConnected(circuit, 'battery1.positive', 'led1.anode')).toBe(true)
    expect(evaluateElectronicsCheck({ type: 'circuit_connected', from: 'battery1.positive', to: 'led1.anode' }, circuit)).toBe(true)
  })

  it('detects battery shorts', () => {
    const circuit = {
      ...DEFAULT_CIRCUIT,
      wires: [{ id: 'w1', from: 'battery1.positive', to: 'battery1.negative' }],
    }
    expect(circuitHasShort(circuit)).toBe(true)
    expect(evaluateElectronicsCheck({ type: 'circuit_no_short' }, circuit)).toBe(false)
  })
})
