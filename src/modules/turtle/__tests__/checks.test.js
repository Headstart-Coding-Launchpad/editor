import { describe, it, expect } from 'vitest'
import { evaluateTurtleCheck, TURTLE_CHECK_TYPES, TURTLE_COMMAND_NAMES } from '../checks.js'

function context({ state, commands = [], calls = [] } = {}) {
  return {
    turtle: {
      state: state ?? { x: 0, y: 0, heading: 0, penDown: true, color: 'black' },
      commands,
      calls,
    },
  }
}

describe('evaluateTurtleCheck', () => {
  it('lists the expected check types', () => {
    expect(TURTLE_CHECK_TYPES).toEqual([
      'turtle_position',
      'turtle_heading',
      'turtle_path_closed',
      'turtle_segment_count',
      'turtle_path_length',
      'turtle_command_used',
      'turtle_color_used',
      'turtle_stamp_count',
    ])
  })

  describe('turtle_position', () => {
    it('passes within tolerance', () => {
      const check = { type: 'turtle_position', x: 100, y: 0, tolerance: 2 }
      expect(evaluateTurtleCheck(check, context({ state: { x: 101, y: 0 } }))).toBe(true)
    })
    it('fails outside tolerance', () => {
      const check = { type: 'turtle_position', x: 100, y: 0, tolerance: 2 }
      expect(evaluateTurtleCheck(check, context({ state: { x: 110, y: 0 } }))).toBe(false)
    })
    it('fails with no state (no run yet)', () => {
      expect(evaluateTurtleCheck({ type: 'turtle_position', x: 0, y: 0 }, {})).toBe(false)
    })
  })

  describe('turtle_heading', () => {
    it('passes within tolerance', () => {
      const check = { type: 'turtle_heading', value: 90, tolerance: 2 }
      expect(evaluateTurtleCheck(check, context({ state: { heading: 91 } }))).toBe(true)
    })
    it('wraps correctly across 0/360', () => {
      const check = { type: 'turtle_heading', value: 0, tolerance: 5 }
      expect(evaluateTurtleCheck(check, context({ state: { heading: 358 } }))).toBe(true)
    })
    it('fails outside tolerance', () => {
      const check = { type: 'turtle_heading', value: 90, tolerance: 2 }
      expect(evaluateTurtleCheck(check, context({ state: { heading: 180 } }))).toBe(false)
    })
  })

  describe('turtle_path_closed', () => {
    const square = [
      { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' },
      { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100, color: 'black' },
      { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100, color: 'black' },
      { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0, color: 'black' },
    ]
    it('passes when the path returns to its start', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_path_closed', tolerance: 2 },
          context({ commands: square })
        )
      ).toBe(true)
    })
    it('fails when the path does not close', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_path_closed', tolerance: 2 },
          context({ commands: square.slice(0, 3) })
        )
      ).toBe(false)
    })
    it('fails with no drawn segments', () => {
      expect(evaluateTurtleCheck({ type: 'turtle_path_closed' }, context())).toBe(false)
    })
  })

  describe('turtle_segment_count', () => {
    const lines = [
      { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0, color: 'black' },
      { type: 'line', x1: 1, y1: 0, x2: 2, y2: 0, color: 'black' },
    ]
    it('defaults to "at least"', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_segment_count', value: 2 },
          context({ commands: lines })
        )
      ).toBe(true)
    })
    it('respects an explicit operator', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_segment_count', operator: 'equals', value: 3 },
          context({ commands: lines })
        )
      ).toBe(false)
    })
  })

  describe('turtle_path_length', () => {
    it('sums the length of all drawn segments', () => {
      const commands = [
        { type: 'line', x1: 0, y1: 0, x2: 3, y2: 4, color: 'black' }, // length 5
        { type: 'line', x1: 3, y1: 4, x2: 3, y2: 14, color: 'black' }, // length 10
      ]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_path_length', operator: 'equals', value: 15 },
          context({ commands })
        )
      ).toBe(true)
    })
  })

  describe('turtle_command_used', () => {
    it('lists the canonical bridge command names', () => {
      expect(TURTLE_COMMAND_NAMES).toContain('forward')
      expect(TURTLE_COMMAND_NAMES).toContain('turn')
      expect(TURTLE_COMMAND_NAMES).toContain('circle')
      expect(TURTLE_COMMAND_NAMES).toContain('fillcolor')
      expect(TURTLE_COMMAND_NAMES).toContain('bgcolor')
      expect(TURTLE_COMMAND_NAMES).toContain('beginfill')
      expect(TURTLE_COMMAND_NAMES).toContain('endfill')
      expect(TURTLE_COMMAND_NAMES).toContain('stamp')
      expect(TURTLE_COMMAND_NAMES).toContain('write')
    })
    it('passes for a circle() call recorded via the mark-command log entry', () => {
      const calls = [{ name: 'circle', args: [50, 360] }]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_command_used', command: 'circle', minCount: 1 },
          context({ calls })
        )
      ).toBe(true)
    })
    it('passes when the command was called at least minCount times', () => {
      const calls = [
        { name: 'forward', args: [10] },
        { name: 'forward', args: [10] },
      ]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_command_used', command: 'forward', minCount: 2 },
          context({ calls })
        )
      ).toBe(true)
    })
    it('fails when the command was not called enough times', () => {
      const calls = [{ name: 'forward', args: [10] }]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_command_used', command: 'forward', minCount: 2 },
          context({ calls })
        )
      ).toBe(false)
    })
    it('fails when a different command was called', () => {
      const calls = [{ name: 'turn', args: [90] }]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_command_used', command: 'forward', minCount: 1 },
          context({ calls })
        )
      ).toBe(false)
    })
  })

  describe('turtle_color_used', () => {
    it('passes when the final pen colour matches', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', color: 'Red' },
          context({ state: { color: 'red' } })
        )
      ).toBe(true)
    })
    it('passes when a pencolor call used the colour even if changed again later', () => {
      const calls = [{ name: 'pencolor', args: ['blue'] }]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', color: 'blue' },
          context({ state: { color: 'green' }, calls })
        )
      ).toBe(true)
    })
    it('fails when the colour was never used', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', color: 'purple' },
          context({ state: { color: 'black' } })
        )
      ).toBe(false)
    })
    it('checks fill colour instead of pen colour when kind is "fill"', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', kind: 'fill', color: 'yellow' },
          context({ state: { color: 'black', fillColor: 'yellow' } })
        )
      ).toBe(true)
    })
    it('does not match pen colour against a fill-kind check', () => {
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', kind: 'fill', color: 'red' },
          context({ state: { color: 'red', fillColor: 'black' } })
        )
      ).toBe(false)
    })
    it('passes when a fillcolor call used the colour even if changed again later', () => {
      const calls = [{ name: 'fillcolor', args: ['orange'] }]
      expect(
        evaluateTurtleCheck(
          { type: 'turtle_color_used', kind: 'fill', color: 'orange' },
          context({ state: { fillColor: 'black' }, calls })
        )
      ).toBe(true)
    })
  })

  describe('turtle_stamp_count', () => {
    const stamps = [
      { type: 'stamp', x: 0, y: 0, heading: 0, color: 'black' },
      { type: 'stamp', x: 10, y: 0, heading: 0, color: 'black' },
    ]
    it('defaults to "at least"', () => {
      expect(
        evaluateTurtleCheck({ type: 'turtle_stamp_count', value: 2 }, context({ commands: stamps }))
      ).toBe(true)
    })
    it('does not count line/fill commands as stamps', () => {
      const commands = [{ type: 'line', x1: 0, y1: 0, x2: 1, y2: 0, color: 'black' }]
      expect(
        evaluateTurtleCheck({ type: 'turtle_stamp_count', value: 1 }, context({ commands }))
      ).toBe(false)
    })
  })

  it('returns false for an unknown check type', () => {
    expect(evaluateTurtleCheck({ type: 'not_a_real_check' }, context())).toBe(false)
  })
})
