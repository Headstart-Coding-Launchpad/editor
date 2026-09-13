import { describe, expect, it } from 'vitest'
import {
  encodeLessonBlocksForFirestore,
  decodeLessonBlocksFromFirestore,
} from '../lessonBlocksCodec'

function deepBlockChain(length) {
  let block = { type: 'motion_movesteps', id: 'leaf', fields: { STEPS: '10' } }
  for (let i = 0; i < length; i++) {
    block = { type: 'motion_movesteps', id: `b${i}`, fields: { STEPS: '10' }, next: { block } }
  }
  return block
}

function maxDepth(value, d = 0) {
  if (value === null || typeof value !== 'object') return d
  let m = d
  for (const key of Object.keys(value)) m = Math.max(m, maxDepth(value[key], d + 1))
  return m
}

function hasNestedArray(value, insideArray = false) {
  if (Array.isArray(value)) {
    if (insideArray) return true
    return value.some((item) => hasNestedArray(item, true))
  }
  if (value === null || typeof value !== 'object') return false
  return Object.values(value).some((item) => hasNestedArray(item, false))
}

describe('encodeLessonBlocksForFirestore / decodeLessonBlocksFromFirestore', () => {
  it('round-trips starterBlocks, completeBlocks, and codeStages block trees', () => {
    const lesson = {
      id: 'l1',
      tasks: [
        {
          id: 1,
          starterBlocks: { sprite1: { blocks: { blocks: [{ type: 'a' }] } } },
          completeBlocks: { sprite1: { blocks: { blocks: [{ type: 'b' }] } } },
          codeStages: [
            { label: 'Stage 1', blocks: { sprite1: { blocks: { blocks: [{ type: 'c' }] } } } },
          ],
        },
      ],
    }

    const encoded = encodeLessonBlocksForFirestore(lesson)
    expect(typeof encoded.tasks[0].starterBlocks).toBe('string')
    expect(typeof encoded.tasks[0].completeBlocks).toBe('string')
    expect(typeof encoded.tasks[0].codeStages[0].blocks).toBe('string')

    const decoded = decodeLessonBlocksFromFirestore(encoded)
    expect(decoded).toEqual(lesson)
  })

  it('flattens a deeply nested block chain below the Firestore 20-level cap', () => {
    const lesson = {
      id: 'l1',
      tasks: [{ id: 1, completeBlocks: { sprite1: { blocks: { blocks: [deepBlockChain(30)] } } } }],
    }

    expect(maxDepth(lesson)).toBeGreaterThan(20)

    const encoded = encodeLessonBlocksForFirestore(lesson)
    expect(maxDepth(encoded)).toBeLessThan(20)

    const decoded = decodeLessonBlocksFromFirestore(encoded)
    expect(decoded).toEqual(lesson)
  })

  it('recurses into group subtasks', () => {
    const lesson = {
      id: 'l1',
      tasks: [
        {
          id: 'g1',
          type: 'group',
          subtasks: [{ id: 1, starterBlocks: { sprite1: { blocks: { blocks: [] } } } }],
        },
      ],
    }

    const encoded = encodeLessonBlocksForFirestore(lesson)
    expect(typeof encoded.tasks[0].subtasks[0].starterBlocks).toBe('string')
    expect(decodeLessonBlocksFromFirestore(encoded)).toEqual(lesson)
  })

  it('round-trips Arcade Kit designs without leaving Firestore-invalid nested arrays', () => {
    const frameA = [null, '#ff004d', null, '#29adff']
    const frameB = ['#00e436', null, '#ffec27', null]
    const lesson = {
      id: 'l1',
      tasks: [
        {
          id: 1,
          moduleType: 'arcade',
          arcadeDesign: {
            version: 1,
            sprites: [
              { id: 'hero', name: 'hero.png', width: 2, height: 2, frames: [frameA, frameB] },
            ],
            maps: [],
          },
          completeArcadeDesign: {
            version: 1,
            sprites: [{ id: 'goal', name: 'goal.png', width: 2, height: 2, frames: [frameB] }],
            maps: [],
          },
          codeStages: [
            {
              label: 'Starter',
              role: 'starter',
              arcadeDesign: {
                version: 1,
                sprites: [
                  { id: 'stage', name: 'stage.png', width: 2, height: 2, frames: [frameA] },
                ],
                maps: [],
              },
            },
          ],
        },
      ],
    }

    expect(hasNestedArray(lesson)).toBe(true)

    const encoded = encodeLessonBlocksForFirestore(lesson)
    expect(typeof encoded.tasks[0].arcadeDesign).toBe('string')
    expect(typeof encoded.tasks[0].completeArcadeDesign).toBe('string')
    expect(typeof encoded.tasks[0].codeStages[0].arcadeDesign).toBe('string')
    expect(hasNestedArray(encoded)).toBe(false)

    expect(decodeLessonBlocksFromFirestore(encoded)).toEqual(lesson)
  })

  it('leaves legacy Firestore documents (block trees already plain objects) untouched on decode', () => {
    const lesson = {
      id: 'l1',
      tasks: [{ id: 1, starterBlocks: { sprite1: { blocks: { blocks: [{ type: 'a' }] } } } }],
    }
    expect(decodeLessonBlocksFromFirestore(lesson)).toEqual(lesson)
  })

  it('passes through lessons/fragments with no tasks unchanged', () => {
    expect(encodeLessonBlocksForFirestore(null)).toBeNull()
    expect(encodeLessonBlocksForFirestore({ title: 'x' })).toEqual({ title: 'x' })
    expect(decodeLessonBlocksFromFirestore(undefined)).toBeUndefined()
  })
})
