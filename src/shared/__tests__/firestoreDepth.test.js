import { describe, expect, it } from 'vitest'
import {
  FIRESTORE_MAX_DEPTH,
  formatFirestorePath,
  measureFirestoreDepth,
} from '../firestoreDepth.js'
import { validateLessonCore } from '../lessonValidation.js'

// A map nested `levels` deep: { child: { child: ... {} } }.
function nestedMaps(levels) {
  const top = {}
  let node = top
  for (let i = 1; i < levels; i++) {
    node.child = {}
    node = node.child
  }
  return top
}

function blockChain(length) {
  let block = { type: 'motion_movesteps', fields: { STEPS: 10 } }
  for (let i = 1; i < length; i++) block = { type: 'motion_turnright', next: { block } }
  return block
}

const depthErrors = (lesson) =>
  validateLessonCore(lesson).errors.filter((e) => e.includes('nested'))

describe('measureFirestoreDepth', () => {
  it('counts each map/array by its field-path segments from the document root', () => {
    expect(measureFirestoreDepth({ a: 1, b: 'x' })).toEqual({ depth: 0, path: [] })
    expect(measureFirestoreDepth({ a: { b: 1 } })).toEqual({ depth: 1, path: ['a'] })
    expect(measureFirestoreDepth({ a: [{ b: {} }] })).toEqual({ depth: 3, path: ['a', 0, 'b'] })
  })

  it('finds the deepest path among siblings', () => {
    const doc = { shallow: { x: {} }, deep: { y: { z: [] } } }
    expect(measureFirestoreDepth(doc)).toEqual({ depth: 3, path: ['deep', 'y', 'z'] })
  })

  it('treats strings (encoded block trees) as leaves', () => {
    expect(measureFirestoreDepth({ a: JSON.stringify(nestedMaps(50)) }).depth).toBe(0)
  })

  it('sits right at the limit for a map 20 segments down, and over it at 21', () => {
    expect(measureFirestoreDepth({ root: nestedMaps(FIRESTORE_MAX_DEPTH) }).depth).toBe(20)
    expect(measureFirestoreDepth({ root: nestedMaps(FIRESTORE_MAX_DEPTH + 1) }).depth).toBe(21)
  })
})

describe('formatFirestorePath', () => {
  it('writes array indices in brackets and shortens long next.block runs', () => {
    const path = ['tasks', 14, 'sprites', 0]
    expect(formatFirestorePath(path)).toBe('tasks[14].sprites[0]')
    const chain = ['tasks', 0, 'x', ...Array(5).fill(['next', 'block']).flat()]
    expect(formatFirestorePath(chain)).toBe('tasks[0].x(.next.block ×5)')
    expect(formatFirestorePath(['tasks', 0, 'a b'])).toBe('tasks[0]["a b"]')
  })
})

describe('validateLessonCore: Firestore depth', () => {
  const baseLesson = (task) => ({
    id: 'depth-demo',
    type: 'scratch',
    title: 'Depth demo',
    tasks: [{ id: 1, title: 'First', instructions: 'Hi' }, task],
  })

  it('accepts a long prebuilt stack, which is stored as JSON text', () => {
    const lesson = baseLesson({
      id: 2,
      title: 'Stacks',
      prebuiltStacks: [{ id: 's1', stack: blockChain(30) }],
      codeStages: [
        {
          label: 'Starter',
          role: 'starter',
          prebuiltStacks: [{ id: 's2', stack: blockChain(30) }],
        },
      ],
    })
    expect(depthErrors(lesson)).toEqual([])
  })

  it('reports a field nested past the limit with its task number, title and path', () => {
    const lesson = baseLesson({
      id: 2,
      title: 'Too deep',
      sprites: [{ id: 'sprite1', name: 'Cat', extra: nestedMaps(20) }],
    })
    const errors = depthErrors(lesson)
    expect(errors).toHaveLength(1)
    // tasks, 1, sprites, 0, extra + 19 more `child` maps = 24 segments.
    expect(errors[0]).toContain(
      'Task 2 ("Too deep") is nested 24 levels deep at tasks[1].sprites[0].extra.child'
    )
    expect(errors[0]).toContain('deeper than 20 levels')
  })

  it('names a subtask inside a group by its flat task number', () => {
    const lesson = {
      id: 'depth-demo',
      type: 'scratch',
      title: 'Depth demo',
      tasks: [
        { id: 1, title: 'First', instructions: 'Hi' },
        {
          type: 'group',
          title: 'G',
          subtasks: [
            { id: 2, title: 'Inner', sprites: [{ id: 's', name: 'S', deep: nestedMaps(20) }] },
          ],
        },
      ],
    }
    expect(depthErrors(lesson)[0]).toMatch(
      /^Task 2 \("Inner"\) is nested \d+ levels deep at tasks\[1\]\.subtasks\[0\]/
    )
  })

  it('names the lesson when the deep field is outside the tasks', () => {
    const lesson = { ...baseLesson({ id: 2, title: 'Fine' }), extra: nestedMaps(25) }
    expect(depthErrors(lesson)[0]).toMatch(/^The lesson is nested 25 levels deep at extra/)
  })
})
