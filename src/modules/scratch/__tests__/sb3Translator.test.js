import { describe, expect, it } from 'vitest'
import {
  PRIMITIVE,
  SB3_BLOCK_SPECS,
  buildSb3Project,
  createSb3Context,
  describeAsset,
  translateWorkspaceBlocks,
  uniqueSpriteNames,
} from '../export/sb3Translator.js'
import { SCRATCH_BLOCK_DEFINITIONS } from '../scratch.js'
import { md5 } from '../../../shared/md5.js'

const ws = (...blocks) => ({ blocks: { languageVersion: 0, blocks } })
const num = (value) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })
const txt = (value) => ({ shadow: { type: 'text', fields: { TEXT: value } } })

function byOpcode(blocks, opcode) {
  return Object.entries(blocks).filter(([, b]) => b.opcode === opcode)
}
function one(blocks, opcode) {
  const found = byOpcode(blocks, opcode)
  expect(found).toHaveLength(1)
  return found[0]
}

describe('sb3 translator: coverage', () => {
  it('has a mapping for every block LaunchPad defines', () => {
    const missing = Object.keys(SCRATCH_BLOCK_DEFINITIONS).filter((op) => !SB3_BLOCK_SPECS[op])
    expect(missing).toEqual([])
  })
})

describe('sb3 translator: stacks and primitives', () => {
  it('chains next/parent, marks the hat top-level and keeps its position', () => {
    const ctx = createSb3Context()
    const blocks = translateWorkspaceBlocks(
      ws({
        type: 'event_whenflagclicked',
        x: 12.4,
        y: 30,
        next: { block: { type: 'motion_movesteps', inputs: { STEPS: num(25) } } },
      }),
      ctx
    )
    const [hatId, hat] = one(blocks, 'event_whenflagclicked')
    const [moveId, move] = one(blocks, 'motion_movesteps')
    expect(hat).toMatchObject({ topLevel: true, x: 12, y: 30, parent: null, next: moveId })
    expect(move).toMatchObject({ topLevel: false, parent: hatId, next: null, shadow: false })
    expect(move.inputs.STEPS).toEqual([1, [PRIMITIVE.number, '25']])
  })

  it('uses the right primitive kinds (angle, positive, whole, text)', () => {
    const blocks = translateWorkspaceBlocks(
      ws(
        { type: 'motion_pointindirection', inputs: { DIRECTION: num(45) } },
        { type: 'control_wait', inputs: { DURATION: num(0.5) } },
        { type: 'looks_say', inputs: { MESSAGE: txt('Hi!') } }
      ),
      createSb3Context()
    )
    expect(one(blocks, 'motion_pointindirection')[1].inputs.DIRECTION).toEqual([1, [8, '45']])
    expect(one(blocks, 'control_wait')[1].inputs.DURATION).toEqual([1, [5, '0.5']])
    expect(one(blocks, 'looks_say')[1].inputs.MESSAGE).toEqual([1, [10, 'Hi!']])
  })

  it('fills a slot with the block default when the shadow is missing', () => {
    const blocks = translateWorkspaceBlocks(ws({ type: 'control_repeat' }), createSb3Context())
    expect(one(blocks, 'control_repeat')[1].inputs.TIMES).toEqual([1, [6, '10']])
  })

  it('keeps an obscured shadow under a reporter in a slot', () => {
    const blocks = translateWorkspaceBlocks(
      ws({
        type: 'motion_movesteps',
        inputs: {
          STEPS: {
            shadow: { type: 'math_number', fields: { NUM: 10 } },
            block: { type: 'operator_random', inputs: { FROM: num(1), TO: num(6) } },
          },
        },
      }),
      createSb3Context()
    )
    const [randomId, random] = one(blocks, 'operator_random')
    const [moveId, move] = one(blocks, 'motion_movesteps')
    expect(move.inputs.STEPS).toEqual([3, randomId, [4, '10']])
    expect(random.parent).toBe(moveId)
  })

  it('nests C-block substacks and Boolean conditions without shadows', () => {
    const blocks = translateWorkspaceBlocks(
      ws({
        type: 'control_if_else',
        inputs: {
          CONDITION: { block: { type: 'sensing_mousedown' } },
          SUBSTACK: { block: { type: 'looks_show' } },
          SUBSTACK2: { block: { type: 'looks_hide' } },
        },
      }),
      createSb3Context()
    )
    const [ifId, ifBlock] = one(blocks, 'control_if_else')
    const [mouseId] = one(blocks, 'sensing_mousedown')
    const [showId, show] = one(blocks, 'looks_show')
    const [hideId] = one(blocks, 'looks_hide')
    expect(ifBlock.inputs).toEqual({
      CONDITION: [2, mouseId],
      SUBSTACK: [2, showId],
      SUBSTACK2: [2, hideId],
    })
    expect(show.parent).toBe(ifId)
  })
})

describe('sb3 translator: menus become shadow blocks', () => {
  it('turns sprite-id menus into shadow menu blocks with sprite names', () => {
    const ctx = createSb3Context({ spriteNames: { sprite2: 'Dog' } })
    const blocks = translateWorkspaceBlocks(
      ws(
        { type: 'motion_goto', fields: { TO: 'sprite2' } },
        { type: 'sensing_touchingobject', fields: { TOUCHINGOBJECTMENU: '_edge_' } },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'jump' } }
      ),
      ctx
    )
    const [gotoId, goto] = one(blocks, 'motion_goto')
    const menuId = goto.inputs.TO[1]
    expect(goto.inputs.TO[0]).toBe(1)
    expect(blocks[menuId]).toMatchObject({
      opcode: 'motion_goto_menu',
      shadow: true,
      parent: gotoId,
      fields: { TO: ['Dog', null] },
    })
    const touching = one(blocks, 'sensing_touchingobject')[1]
    expect(blocks[touching.inputs.TOUCHINGOBJECTMENU[1]].fields).toEqual({
      TOUCHINGOBJECTMENU: ['_edge_', null],
    })
    const costume = one(blocks, 'looks_switchcostumeto')[1]
    expect(blocks[costume.inputs.COSTUME[1]]).toMatchObject({
      opcode: 'looks_costume',
      fields: { COSTUME: ['jump', null] },
    })
  })

  it('renames the blocks Scratch 3 spells differently', () => {
    const blocks = translateWorkspaceBlocks(
      ws(
        { type: 'sensing_touchingedge' },
        { type: 'looks_costumenumber' },
        {
          type: 'looks_changeeffectby',
          fields: { EFFECT: 'ghost' },
          inputs: { VALUE: num(25) },
        },
        { type: 'control_stop' }
      ),
      createSb3Context()
    )
    const touching = one(blocks, 'sensing_touchingobject')[1]
    expect(blocks[touching.inputs.TOUCHINGOBJECTMENU[1]].fields.TOUCHINGOBJECTMENU[0]).toBe(
      '_edge_'
    )
    expect(one(blocks, 'looks_costumenumbername')[1].fields).toEqual({
      NUMBER_NAME: ['number', null],
    })
    const effect = one(blocks, 'looks_changeeffectby')[1]
    expect(effect.fields.EFFECT).toEqual(['GHOST', null])
    expect(effect.inputs.CHANGE).toEqual([1, [4, '25']])
    const stop = one(blocks, 'control_stop')[1]
    expect(stop.fields.STOP_OPTION).toEqual(['all', null])
    expect(stop.mutation).toMatchObject({ tagName: 'mutation', hasnext: 'false' })
  })
})

describe('sb3 translator: variables and broadcasts', () => {
  it('gives variables Stage ids and compresses a variable reporter in a slot', () => {
    const ctx = createSb3Context()
    const blocks = translateWorkspaceBlocks(
      ws(
        { type: 'data_setvariableto', fields: { VARIABLE: 'score' }, inputs: { VALUE: txt('0') } },
        {
          type: 'looks_say',
          inputs: {
            MESSAGE: {
              ...txt('Hello'),
              block: { type: 'data_variable', fields: { VARIABLE: 'score' } },
            },
          },
        }
      ),
      ctx
    )
    const varId = ctx.variables.get('score').id
    expect(one(blocks, 'data_setvariableto')[1].fields.VARIABLE).toEqual(['score', varId])
    expect(one(blocks, 'looks_say')[1].inputs.MESSAGE).toEqual([
      3,
      [PRIMITIVE.variable, 'score', varId],
      [10, 'Hello'],
    ])
    expect(byOpcode(blocks, 'data_variable')).toHaveLength(0)
  })

  it('migrates the old { id, name } variable field', () => {
    const ctx = createSb3Context()
    const blocks = translateWorkspaceBlocks(
      {
        variables: [{ id: 'v1', name: 'lives' }],
        blocks: {
          blocks: [{ type: 'data_changevariableby', fields: { VARIABLE: { id: 'v1' } } }],
        },
      },
      ctx
    )
    expect(one(blocks, 'data_changevariableby')[1].fields.VARIABLE[0]).toBe('lives')
  })

  it('shares one broadcast id between sending and receiving', () => {
    const ctx = createSb3Context()
    const blocks = translateWorkspaceBlocks(
      ws(
        { type: 'event_broadcast', fields: { BROADCAST_INPUT: 'go' } },
        { type: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: 'go' } }
      ),
      ctx
    )
    const id = ctx.broadcasts.get('go')
    expect(one(blocks, 'event_broadcast')[1].inputs.BROADCAST_INPUT).toEqual([1, [11, 'go', id]])
    expect(one(blocks, 'event_whenbroadcastreceived')[1].fields.BROADCAST_OPTION).toEqual([
      'go',
      id,
    ])
  })
})

describe('sb3 translator: unmapped blocks', () => {
  it('leaves an unknown block out, closes the stack up and reports it', () => {
    const ctx = createSb3Context()
    const blocks = translateWorkspaceBlocks(
      ws({
        type: 'event_whenflagclicked',
        next: {
          block: {
            type: 'pen_clear',
            next: { block: { type: 'looks_show' } },
          },
        },
      }),
      ctx
    )
    const [, hat] = one(blocks, 'event_whenflagclicked')
    const [showId, show] = one(blocks, 'looks_show')
    expect(hat.next).toBe(showId)
    expect(show.parent).not.toBeNull()
    expect([...ctx.unmapped.entries()]).toEqual([['pen_clear', 1]])
  })
})

describe('sb3 project', () => {
  const costume = describeAsset(md5('png-bytes'), 'png', {
    name: 'costume1',
    bitmapResolution: 2,
    rotationCenterX: 48,
    rotationCenterY: 48,
  })

  it('builds a Stage plus sprites with unique names, Stage variables and monitors', () => {
    const { project, unmapped } = buildSb3Project({
      sprites: [
        {
          id: 'sprite1',
          name: 'Stage',
          blocksState: ws({ type: 'data_showvariable', fields: { VARIABLE: 'score' } }),
          costumes: [costume],
          x: 10.6,
          y: -5,
          size: 120,
          direction: 45,
          rotationStyle: 'left-right',
        },
        { id: 'sprite2', name: 'Cat', blocksState: null, costumes: [costume], currentCostume: 9 },
        { id: 'sprite3', name: 'Cat', blocksState: null, costumes: [costume] },
      ],
      stage: { blocksState: null, costumes: [costume] },
      variables: [{ name: 'score', value: 3, showOnStage: true }],
    })
    const [stage, ...sprites] = project.targets
    expect(stage).toMatchObject({ isStage: true, name: 'Stage', layerOrder: 0 })
    expect(sprites.map((t) => t.name)).toEqual(['Stage2', 'Cat', 'Cat2'])
    expect(sprites[0]).toMatchObject({ x: 11, y: -5, size: 120, direction: 45 })
    expect(sprites[0].rotationStyle).toBe('left-right')
    expect(sprites[1].currentCostume).toBe(0)
    const [[varId, value]] = Object.entries(stage.variables)
    expect(value).toEqual(['score', 3])
    expect(project.monitors).toEqual([
      expect.objectContaining({
        id: varId,
        opcode: 'data_variable',
        params: { VARIABLE: 'score' },
      }),
    ])
    expect(project.meta.semver).toBe('3.0.0')
    expect(unmapped).toEqual([])
  })

  it('names sprites safely', () => {
    expect(
      uniqueSpriteNames([
        { id: 'a', name: '_mouse_' },
        { id: 'b', name: '' },
      ])
    ).toEqual({
      a: '_mouse_2',
      b: 'Sprite',
    })
  })

  it('describes assets by md5', () => {
    const hash = md5('abc')
    expect(describeAsset(hash, 'wav', { name: 'pop' })).toEqual({
      assetId: '900150983cd24fb0d6963f7d28e17f72',
      md5ext: '900150983cd24fb0d6963f7d28e17f72.wav',
      dataFormat: 'wav',
      name: 'pop',
    })
  })
})
