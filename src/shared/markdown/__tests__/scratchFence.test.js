import { describe, it, expect } from 'vitest'
import {
  blockTextParts,
  inlineScratchCode,
  looksLikeScratchBlocks,
  parseScratchStack,
} from '../scratchFence.js'
import { SCRATCH_BLOCK_CATALOG, findScratchBlock } from '../../scratchBlockCatalog'

const slots = (text) =>
  blockTextParts(text, 0, findScratchBlock(text)).filter((p) => p.type === 'slot')
const shape = (nodes) =>
  nodes.map((n) => ({
    op: n.info.opcode,
    ...(n.children.length ? { children: shape(n.children) } : {}),
    ...(n.hasElse ? { else: shape(n.elseChildren) } : {}),
  }))

describe('scratch fence parser', () => {
  it('nests blocks in C mouths by indent, with else and end', () => {
    const roots = parseScratchStack(
      [
        'when green flag clicked',
        'forever',
        '  if <touching [edge]?> then',
        '    move (10) steps',
        '  else',
        '    repeat (3)',
        '      turn right (15) degrees',
        '    end',
        '  end',
        'end',
        'say [done]',
      ].join('\n')
    )
    expect(shape(roots)).toEqual([
      { op: 'event_whenflagclicked' },
      {
        op: 'control_forever',
        children: [
          {
            op: 'control_if',
            children: [{ op: 'motion_movesteps' }],
            else: [{ op: 'control_repeat', children: [{ op: 'motion_turnright' }] }],
          },
        ],
      },
      { op: 'looks_say' },
    ])
  })

  it('keeps the long stack with "until done" and "seconds" lines as written', () => {
    const roots = parseScratchStack(
      'when this sprite clicked\nplay sound [Meow] until done\nsay [Hello!] for (2) seconds\nwait (1) seconds'
    )
    expect(roots.map((n) => n.info.opcode)).toEqual([
      'event_whenthisspriteclicked',
      'sound_playuntildone',
      'looks_sayforsecs',
      'control_wait',
    ])
  })

  it('reads say / think [..] as typed text and [.. v] as a menu without the v', () => {
    expect(slots('say [Hello!] for (2) seconds').map((s) => [s.kind, s.content])).toEqual([
      ['value', 'Hello!'],
      ['value', '2'],
    ])
    expect(slots('when [space v] key pressed').map((s) => [s.kind, s.content])).toEqual([
      ['dropdown', 'space'],
    ])
    expect(slots('set [score] to (0)')[0]).toMatchObject({ kind: 'dropdown', content: 'score' })
  })

  it('reads a nested condition and reporter as slots', () => {
    expect(slots('repeat until <(score) > (10)>').map((s) => [s.kind, s.content])).toEqual([
      ['condition', '(score) > (10)'],
    ])
  })

  it('marks unknown lines and skips bare words', () => {
    expect(parseScratchStack('fly to the moon (3)')[0].info.opcode).toBe('unknown')
    expect(parseScratchStack('score')).toEqual([])
    expect(looksLikeScratchBlocks('fly to the moon')).toBe(false)
    expect(looksLikeScratchBlocks('move (10) steps\nend')).toBe(true)
  })

  it('draws an inline if/else as the one-mouth text with an else line', () => {
    expect(inlineScratchCode('if <> then else')).toBe('if <> then\nelse')
    expect(inlineScratchCode(' repeat (10) ')).toBe('repeat (10)')
  })

  it('reads a menu written in round brackets as the same block, with no sample mistaken', () => {
    expect(findScratchBlock('switch backdrop to (City Street)')?.opcode).toBe(
      'looks_switchbackdropto'
    )
    expect(findScratchBlock('glide (2) secs to (Balloon)')?.opcode).toBe('motion_glideto')
    expect(findScratchBlock('play sound (pop) until done')?.opcode).toBe('sound_playuntildone')
    for (const block of SCRATCH_BLOCK_CATALOG) {
      expect(findScratchBlock(block.sample)?.opcode, block.sample).toBe(block.opcode)
      const round = block.sample.replace(/\[([^\]]+)\]/g, '($1)')
      expect(findScratchBlock(round)?.opcode, round).toBe(block.opcode)
    }
  })
})
