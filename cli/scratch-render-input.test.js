// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assignStableIds,
  buildRenderJob,
  chooseSprite,
  collectContextValues,
  findLessonTask,
  pickTaskBlocks,
  splitSpriteStates,
} from './scratch-render-input.mjs'

const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: String(n) } } })

const script = {
  blocks: {
    blocks: [
      {
        type: 'event_whenflagclicked',
        id: 'a1',
        next: {
          block: {
            type: 'control_repeat',
            inputs: {
              TIMES: num(10),
              SUBSTACK: {
                block: {
                  type: 'motion_movesteps',
                  inputs: { STEPS: num(5) },
                  next: { block: { type: 'motion_goto', fields: { TO: 'sprite2' } } },
                },
              },
            },
          },
        },
      },
      {
        type: 'looks_say',
        inputs: {
          MESSAGE: {
            shadow: { type: 'text', fields: { TEXT: 'hi' } },
            block: { type: 'data_variable', fields: { VARIABLE: 'score' } },
          },
        },
      },
    ],
  },
}

describe('assignStableIds', () => {
  it('names blocks by their place in the script', () => {
    const { state, blocks } = assignStableIds(script)
    expect(blocks.map((b) => b.id)).toEqual([
      's1',
      's1.2',
      's1.2/TIMES',
      's1.2/SUBSTACK.1',
      's1.2/SUBSTACK.1/STEPS',
      's1.2/SUBSTACK.2',
      's2',
      's2/MESSAGE',
      's2/MESSAGE~shadow',
    ])
    expect(blocks[0]).toMatchObject({ opcode: 'event_whenflagclicked', sourceId: 'a1' })
    expect(state.blocks.blocks[0].id).toBe('s1')
    expect(script.blocks.blocks[0].id).toBe('a1')
  })
})

describe('collectContextValues', () => {
  it('collects dropdown values the script uses, skipping special ones', () => {
    const values = collectContextValues({
      blocks: {
        blocks: [{ type: 'motion_goto', fields: { TO: '_random_' } }, ...script.blocks.blocks],
      },
    })
    expect(values.sprites).toEqual(['sprite2'])
    expect(values.variables).toEqual(['score'])
  })
})

describe('splitSpriteStates / chooseSprite', () => {
  const sprites = [
    { id: 'cat', name: 'Cat' },
    { id: 'dog', name: 'Dog' },
  ]

  it('gives a bare one-sprite state or a single block to the first sprite', () => {
    expect(Object.keys(splitSpriteStates(script, sprites))).toEqual(['cat'])
    expect(splitSpriteStates({ type: 'looks_say' }, sprites).cat.blocks.blocks).toHaveLength(1)
    expect(Object.keys(splitSpriteStates(JSON.stringify({ dog: script }), sprites))).toEqual([
      'dog',
    ])
  })

  it('picks the first sprite with blocks, or the one asked for by id or name', () => {
    const states = { cat: { blocks: { blocks: [] } }, dog: script, __stage__: script }
    expect(chooseSprite(states, sprites)).toBe('dog')
    expect(chooseSprite(states, sprites, 'Dog')).toBe('dog')
    expect(chooseSprite(states, sprites, 'stage')).toBe('__stage__')
    expect(() => chooseSprite(states, sprites, 'bird')).toThrow(/No blocks for sprite 'bird'/)
  })
})

describe('pickTaskBlocks', () => {
  const task = {
    id: 't1',
    codeStages: [
      { role: 'starter', blocks: { s: 1 } },
      { label: 'hint', blocks: { s: 2 } },
      { role: 'solution', blocks: { s: 3 } },
    ],
    prebuiltStacks: [{ id: 'walk', stack: { type: 'motion_movesteps' } }],
  }

  it('defaults to the complete stage, and reads starter, stage and stack fields', () => {
    expect(pickTaskBlocks(task)).toEqual({ raw: { s: 3 }, label: 'codeStages[2]' })
    expect(pickTaskBlocks(task, 'starter').raw).toEqual({ s: 1 })
    expect(pickTaskBlocks(task, 'stage:1').raw).toEqual({ s: 2 })
    expect(pickTaskBlocks(task, 'stack:walk').raw.blocks.blocks[0].type).toBe('motion_movesteps')
    expect(pickTaskBlocks({ ...task, completeBlocks: { s: 4 } }, 'complete').label).toBe(
      'completeBlocks'
    )
    expect(() => pickTaskBlocks(task, 'nope')).toThrow(/Unknown --field/)
  })
})

describe('findLessonTask / buildRenderJob', () => {
  const lesson = {
    id: 'l1',
    tasks: [
      { id: 'info', taskType: 'information' },
      {
        id: 'g',
        type: 'group',
        subtasks: [
          {
            id: 'code',
            sprites: [{ id: 'cat', name: 'Cat', costumes: [{ name: 'happy' }] }],
            variables: [{ name: 'score' }],
            completeBlocks: { cat: script },
          },
        ],
      },
    ],
  }

  it('finds the first task with blocks, or one by id', () => {
    expect(findLessonTask(lesson).id).toBe('code')
    expect(findLessonTask(lesson, 'code').id).toBe('code')
    expect(() => findLessonTask(lesson, 'missing')).toThrow(/No task with id/)
  })

  it('builds the job the render page draws', () => {
    const job = buildRenderJob({ data: lesson })
    expect(job.source).toEqual({ taskId: 'code', field: 'completeBlocks', spriteId: 'cat' })
    expect(job.blocks[0].id).toBe('s1')
    expect(job.task.variables).toEqual([{ name: 'score' }])
    expect(job.extraOptions.sprites).toEqual(['sprite2'])
  })

  it('takes a bare block file but refuses --task without a lesson', () => {
    expect(buildRenderJob({ data: script }).source.spriteId).toBe('sprite1')
    expect(() => buildRenderJob({ data: script, task: '1' })).toThrow(/need a lesson/)
  })
})
