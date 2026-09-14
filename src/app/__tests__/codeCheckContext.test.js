import { describe, expect, it } from 'vitest'
import { buildCodeCheckContext } from '../codeCheckContext'
import { evaluateCheck } from '../../modules/checks'
import { DEFAULT_CIRCUIT, makeComponent, serializeCircuit } from '../../modules/electronics/circuit'

describe('buildCodeCheckContext', () => {
  it('passes code and extras through for code modules', () => {
    expect(buildCodeCheckContext('turtle', 'turtle.forward(10)', { status: 'success' })).toEqual({
      status: 'success',
      code: 'turtle.forward(10)',
    })
  })

  it('also exposes the serialized circuit for electronics', () => {
    expect(buildCodeCheckContext('electronics', '{"components":[]}')).toEqual({
      code: '{"components":[]}',
      circuit: '{"components":[]}',
    })
  })

  // Regression: the Micro Controller Run path built its context without `circuit`, so
  // generic code checks matched the raw circuit JSON (where quotes are escaped) instead of
  // the MicroPython source — `print("hi")` never matched after running.
  it('makes electronics code checks match the MicroPython source, not the circuit JSON', () => {
    const microcontroller = makeComponent('microcontroller', 1, { row: 2, col: 2 })
    microcontroller.props.code = 'print("hi")'
    const code = serializeCircuit({ ...DEFAULT_CIRCUIT, components: [microcontroller] })
    const check = { type: 'code', operator: 'contains', value: 'print("hi")' }

    expect(evaluateCheck(check, '', { status: 'success', code })).toBe(false)
    expect(
      evaluateCheck(check, '', buildCodeCheckContext('electronics', code, { status: 'success' }))
    ).toBe(true)
  })

  it('lets turtle tasks combine code checks with turtle checks', () => {
    const context = buildCodeCheckContext('turtle', 'for i in range(4):\n    turtle.forward(50)', {
      status: 'success',
      turtle: {
        state: { x: 0, y: 0, heading: 0 },
        commands: [{ type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 }],
        calls: [],
      },
    })
    const checks = [
      { type: 'code', operator: 'contains', value: 'for ' },
      { type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1' },
    ]
    expect(evaluateCheck(checks, '', context)).toBe(true)
    expect(
      evaluateCheck(
        [...checks, { type: 'code', operator: 'contains', value: 'while' }],
        '',
        context
      )
    ).toBe(false)
  })
})
