import { describe, expect, it } from 'vitest'
import { compactStageForSync, MAX_SYNCED_STAGE_COMMANDS, readStageResult } from '../sync.js'
import { stageToSvg } from '../svg.js'

describe('compactStageForSync', () => {
  it('is null when nothing was drawn', () => {
    expect(compactStageForSync(null)).toBeNull()
    expect(compactStageForSync({ commands: [] })).toBeNull()
  })

  it('drops what a clear() or background() hides and rounds coordinates', () => {
    const result = compactStageForSync({
      commands: [
        { type: 'rect', x: 1, y: 1, w: 1, h: 1, colour: '#ff0000' },
        { type: 'background', colour: '#000080' },
        { type: 'circle', x: 10.04, y: 20.06, r: 5.56, colour: '#ffffff' },
      ],
    })
    expect(result).toEqual({
      commands: [
        { type: 'background', colour: '#000080' },
        { type: 'circle', x: 10, y: 20.1, r: 5.6, colour: '#ffffff' },
      ],
      count: 3,
    })
    expect(
      compactStageForSync([
        { type: 'rect', x: 0, y: 0, w: 1, h: 1, colour: '#ff0000' },
        { type: 'clear' },
      ])
    ).toEqual({ commands: [], count: 2 })
  })

  it('keeps the newest commands when the drawing is too big', () => {
    const commands = Array.from({ length: MAX_SYNCED_STAGE_COMMANDS + 5 }, (_, i) => ({
      type: 'circle',
      x: i,
      y: 0,
      r: 1,
      colour: '#000000',
    }))
    const result = compactStageForSync({ commands })
    expect(result.truncated).toBe(true)
    expect(result.commands).toHaveLength(MAX_SYNCED_STAGE_COMMANDS)
    expect(result.commands[0].x).toBe(5)
    expect(result.count).toBe(MAX_SYNCED_STAGE_COMMANDS + 5)
  })
})

describe('readStageResult', () => {
  it('reads Firebase objects back into lists', () => {
    const raw = {
      commands: {
        0: {
          type: 'grid',
          x: 0,
          y: 0,
          cell: 10,
          colours: { 0: '#ff0000' },
          cells: { 0: { 0: 0, 1: -1 } },
        },
      },
      count: 1,
    }
    expect(readStageResult(raw)).toEqual({
      commands: [{ type: 'grid', x: 0, y: 0, cell: 10, colours: ['#ff0000'], cells: [[0, -1]] }],
      count: 1,
      truncated: false,
    })
  })

  it('is null for nothing drawn', () => {
    expect(readStageResult(null)).toBeNull()
    expect(readStageResult({ commands: [] })).toBeNull()
  })
})

describe('stageToSvg', () => {
  it('draws a standalone 400 × 400 picture and escapes text', () => {
    const svg = stageToSvg([
      { type: 'rect', x: 1, y: 2, w: 3, h: 4, colour: '#ff0000' },
      { type: 'text', x: 0, y: 0, text: '<b>&', colour: '#000000', size: 16 },
    ])
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"')).toBe(
      true
    )
    expect(svg).toContain('<rect x="1" y="2" width="3" height="4" fill="#ff0000"/>')
    expect(svg).toContain('&#60;b&#62;&#38;')
  })
})
