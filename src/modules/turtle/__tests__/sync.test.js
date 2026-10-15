// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { compactTurtleResultForSync } from '../sync.js'

describe('compactTurtleResultForSync', () => {
  it('keeps the runId so Go Live screens can play a new run', () => {
    const synced = compactTurtleResultForSync({ state: null, commands: [], runId: 'abc-1' })
    expect(synced.runId).toBe('abc-1')
    expect(compactTurtleResultForSync({ state: null, commands: [] })).not.toHaveProperty('runId')
  })

  it('rounds motion records and dots, and drops the call log', () => {
    const synced = compactTurtleResultForSync({
      state: { x: 1.234, y: 0 },
      commands: [
        { type: 'move', x1: 0.04, y1: 0, x2: 10.06, y2: 0, heading: 12.345 },
        { type: 'turn', from: 12.345, delta: 90.04 },
        { type: 'dot', x: 1.26, y: 0, size: 20, color: 'red' },
        { type: 'speed', speed: 3 },
      ],
      calls: [{ name: 'forward' }],
    })
    expect(synced.commands).toEqual([
      { type: 'move', x1: 0, y1: 0, x2: 10.1, y2: 0, heading: 12.3 },
      { type: 'turn', from: 12.3, delta: 90 },
      { type: 'dot', x: 1.3, y: 0, size: 20, color: 'red' },
      { type: 'speed', speed: 3 },
    ])
    expect(synced).not.toHaveProperty('calls')
  })

  it("shifts a fill's closedAt when the start of a long log is cut", () => {
    const turns = (count) =>
      Array.from({ length: count }, () => ({ type: 'turn', from: 0, delta: 1 }))
    const fill = {
      type: 'fill',
      color: 'green',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      closedAt: 4005,
    }
    // 4,005 records: the fill at index 4000, closed at the end. The first 5 are cut.
    const commands = [...turns(4000), fill, ...turns(4)]
    const synced = compactTurtleResultForSync({ state: null, commands })
    expect(synced.commands).toHaveLength(4000)
    expect(synced.commands[3995].type).toBe('fill')
    expect(synced.commands[3995].closedAt).toBe(4000)
    // Nothing cut: closedAt is unchanged.
    const short = compactTurtleResultForSync({ state: null, commands: [{ ...fill, closedAt: 3 }] })
    expect(short.commands[0].closedAt).toBe(3)
  })
})
