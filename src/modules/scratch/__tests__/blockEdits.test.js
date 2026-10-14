import { describe, expect, it } from 'vitest'
import { applyScratchBlockEdits } from '../blockEdits.js'

const sprites = [
  { id: 'sprite1', name: 'Cat' },
  { id: 'sprite2', name: 'Dog' },
]

const stack = (...blocks) =>
  blocks.reduceRight((next, block) => {
    const out = typeof block === 'string' ? { type: block } : { ...block }
    if (next) out.next = { block: next }
    return out
  }, null)

const states = (...scripts) => ({ sprite1: { blocks: { blocks: scripts } } })

// Each top-level script's opcodes down its stack.
function opcodes(result, spriteId = 'sprite1') {
  return (result[spriteId]?.blocks?.blocks ?? []).map((top) => {
    const out = []
    for (let block = top; block; block = block.next?.block) out.push(block.type)
    return out
  })
}

const base = states(stack('event_whenflagclicked', 'motion_movesteps', 'looks_say'))

describe('applyScratchBlockEdits', () => {
  it('returns a copy and leaves the input untouched', () => {
    const before = JSON.stringify(base)
    const result = applyScratchBlockEdits(base, [{ op: 'appendBlock', opcode: 'sound_play' }])
    expect(JSON.stringify(base)).toBe(before)
    expect(opcodes(result)).toEqual([
      ['event_whenflagclicked', 'motion_movesteps', 'looks_say', 'sound_play'],
    ])
  })

  describe('appendBlock', () => {
    it('builds fields and number / text input shadows', () => {
      const result = applyScratchBlockEdits(base, [
        {
          op: 'appendBlock',
          opcode: 'motion_glidesecstoxy',
          inputs: { SECS: 1, X: '20' },
          fields: { FOO: 'bar' },
        },
      ])
      const added = result.sprite1.blocks.blocks[0].next.block.next.block.next.block
      expect(added.fields).toEqual({ FOO: 'bar' })
      expect(added.inputs.SECS).toEqual({
        shadow: { type: 'math_number', fields: { NUM: '1' } },
      })
      expect(added.inputs.X).toEqual({ shadow: { type: 'text', fields: { TEXT: '20' } } })
    })

    it('inserts after a block, keeping the blocks below it', () => {
      const result = applyScratchBlockEdits(base, [
        { op: 'appendBlock', opcode: 'sound_play', after: 'event_whenflagclicked' },
      ])
      expect(opcodes(result)).toEqual([
        ['event_whenflagclicked', 'sound_play', 'motion_movesteps', 'looks_say'],
      ])
    })

    it('appends inside a C block and as a new loose script', () => {
      const withLoop = states(stack('event_whenflagclicked', 'control_forever'))
      const result = applyScratchBlockEdits(withLoop, [
        { op: 'appendBlock', opcode: 'motion_movesteps', inside: 'control_forever' },
        { op: 'appendBlock', opcode: 'motion_turnright', inside: 'control_forever' },
        { op: 'appendBlock', opcode: 'looks_say', newScript: true },
      ])
      const loop = result.sprite1.blocks.blocks[0].next.block
      expect(loop.inputs.SUBSTACK.block.type).toBe('motion_movesteps')
      expect(loop.inputs.SUBSTACK.block.next.block.type).toBe('motion_turnright')
      expect(opcodes(result)[1]).toEqual(['looks_say'])
    })

    it('takes a whole block and targets another sprite by name', () => {
      const result = applyScratchBlockEdits(
        base,
        [
          {
            op: 'appendBlock',
            sprite: 'Dog',
            block: { type: 'event_whenflagclicked', next: { block: { type: 'looks_show' } } },
          },
        ],
        { sprites }
      )
      expect(opcodes(result, 'sprite2')).toEqual([['event_whenflagclicked', 'looks_show']])
    })
  })

  it('replaceOpcode keeps fields and inputs', () => {
    const withSound = states(
      stack('event_whenflagclicked', {
        type: 'sound_playuntildone',
        inputs: {
          SOUND_MENU: { shadow: { type: 'sound_sounds_menu', fields: { SOUND_MENU: 'Meow' } } },
        },
      })
    )
    const result = applyScratchBlockEdits(withSound, [
      { op: 'replaceOpcode', target: 'sound_playuntildone', opcode: 'sound_play' },
    ])
    const block = result.sprite1.blocks.blocks[0].next.block
    expect(block.type).toBe('sound_play')
    expect(block.inputs.SOUND_MENU.shadow.fields.SOUND_MENU).toBe('Meow')
  })

  describe('setField', () => {
    it('sets a block field, or the field of the shadow in an input', () => {
      const script = states(
        stack(
          'event_whenflagclicked',
          { type: 'motion_goto', fields: { TO: '_random_' } },
          {
            type: 'motion_movesteps',
            inputs: { STEPS: { shadow: { type: 'math_number', fields: { NUM: '10' } } } },
          }
        )
      )
      const result = applyScratchBlockEdits(script, [
        { op: 'setField', target: 'motion_goto', field: 'TO', value: '_mouse_' },
        { op: 'setField', target: { opcode: 'motion_movesteps' }, field: 'STEPS', value: '20' },
      ])
      const goto = result.sprite1.blocks.blocks[0].next.block
      expect(goto.fields.TO).toBe('_mouse_')
      expect(goto.next.block.inputs.STEPS.shadow.fields.NUM).toBe('20')
    })

    it('names the fields a block has when the field is missing', () => {
      expect(() =>
        applyScratchBlockEdits(base, [
          { op: 'setField', target: 'looks_say', field: 'MESSAGE', value: 'Hi' },
        ])
      ).toThrow('edit 1 (setField): the looks_say block has no field or input "MESSAGE"')
    })
  })

  describe('removeBlock', () => {
    it('moves the blocks below up, or removes them with withBelow', () => {
      const moved = applyScratchBlockEdits(base, [
        { op: 'removeBlock', target: 'motion_movesteps' },
      ])
      expect(opcodes(moved)).toEqual([['event_whenflagclicked', 'looks_say']])
      const cut = applyScratchBlockEdits(base, [
        { op: 'removeBlock', target: 'motion_movesteps', withBelow: true },
      ])
      expect(opcodes(cut)).toEqual([['event_whenflagclicked']])
    })

    it('removes by path, leaving the rest of the stack as its own script', () => {
      const result = applyScratchBlockEdits(base, [{ op: 'removeBlock', target: { path: [1, 1] } }])
      expect(opcodes(result)).toEqual([['motion_movesteps', 'looks_say']])
    })

    it('picks the nth block with an opcode', () => {
      const twice = states(
        stack('event_whenflagclicked', 'looks_say', 'motion_movesteps', 'looks_say')
      )
      const result = applyScratchBlockEdits(twice, [
        { op: 'removeBlock', target: { opcode: 'looks_say', nth: 2 } },
      ])
      expect(opcodes(result)).toEqual([['event_whenflagclicked', 'looks_say', 'motion_movesteps']])
    })
  })

  it('throws clear errors naming the edit', () => {
    expect(() => applyScratchBlockEdits(base, [{ op: 'nope' }])).toThrow(
      'edit 1 (nope): op must be one of: appendBlock, replaceOpcode, setField, removeBlock'
    )
    expect(() =>
      applyScratchBlockEdits(base, [
        { op: 'appendBlock', opcode: 'looks_show' },
        { op: 'removeBlock', target: 'sound_play' },
      ])
    ).toThrow('edit 2 (removeBlock): no sound_play block')
    expect(() =>
      applyScratchBlockEdits(base, [{ op: 'removeBlock', target: { opcode: 'looks_say', nth: 3 } }])
    ).toThrow('only 1 looks_say block(s), not 3')
    expect(() => applyScratchBlockEdits(base, [{ op: 'replaceOpcode', opcode: 'x' }])).toThrow(
      'needs a `target`'
    )
    expect(() =>
      applyScratchBlockEdits(base, [{ op: 'appendBlock', opcode: 'x', sprite: 'Owl' }], { sprites })
    ).toThrow('no sprite is named "Owl"')
    expect(() => applyScratchBlockEdits(base, { op: 'appendBlock' })).toThrow(
      '`edits` must be a list'
    )
  })
})
