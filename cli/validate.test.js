import { describe, expect, it } from 'vitest'
import { validateLessonForMcp } from './validate.mjs'

describe('CLI lesson validation', () => {
  it('loads the shared check dispatcher and validates a basic lesson', () => {
    const result = validateLessonForMcp({
      id: 'python-basics',
      type: 'python',
      title: 'Python basics',
      description: 'A short Python lesson',
      tasks: [
        {
          title: 'Print hello',
          starterCode: 'print("hello")',
          check: { type: 'output_contains', value: 'hello' },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('warns when a complete solution fails a static code check', () => {
    const result = validateLessonForMcp({
      id: 'python-static-check',
      type: 'python',
      title: 'Python static check',
      description: 'A lesson with a static code check',
      tasks: [
        {
          title: 'Use a variable',
          starterCode: '',
          completeCode: 'print("hello")',
          check: { type: 'code_contains', value: 'answer =' },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('complete solution fails a code check'))).toBe(true)
  })

  it('accepts electronics lessons supported by the app module registry', () => {
    const result = validateLessonForMcp({
      id: 'electronics-basics',
      type: 'electronics',
      title: 'Electronics basics',
      description: 'A short breadboard lesson',
      tasks: [
        {
          title: 'Light an LED',
          starterCircuit: {
            components: [],
            wires: [],
          },
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('validates optional task priority values', () => {
    const valid = validateLessonForMcp({
      id: 'priority-demo',
      type: 'python',
      title: 'Priority demo',
      description: 'A lesson with priorities',
      tasks: [
        { title: 'Core by omission', starterCode: 'print("core")' },
        { title: 'Core explicit', priority: 'core', starterCode: 'print("core")' },
        { title: 'Optional', priority: 'optional', starterCode: 'print("optional")' },
      ],
    })
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'priority-demo',
      type: 'python',
      title: 'Priority demo',
      description: 'A lesson with priorities',
      tasks: [{ title: 'Stretch', priority: 'stretch', starterCode: 'print("stretch")' }],
    })
    expect(invalid.errors).toContain('Task 1 priority must be one of: core, optional')
  })

  it('validates code stage roles and accepts revealable stages across roles', () => {
    const valid = validateLessonForMcp({
      id: 'stage-role-demo',
      type: 'python',
      title: 'Stage roles',
      description: 'A lesson with revealable stages',
      tasks: [{
        title: 'Use a variable',
        starterCode: 'name = ""',
        codeStages: [
          { label: 'With name started', revealable: true, code: 'name = "Ada"' },
          { label: 'Extension', role: 'extension', revealable: true, code: 'first = "Ada"' },
        ],
      }],
    })
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'stage-role-demo',
      type: 'python',
      title: 'Stage roles',
      description: 'A lesson with bad stages',
      tasks: [{
        title: 'Use a variable',
        starterCode: 'name = ""',
        codeStages: [
          { label: 'Wrong role', role: 'stretch', code: '' },
        ],
      }],
    })
    expect(invalid.errors).toEqual(expect.arrayContaining([
      'Task 1 stage 1 role must be one of: support, core, extension, solution',
    ]))
  })

  it('validates class fork metadata and deterministic ids', () => {
    const valid = validateLessonForMcp({
      id: 'python-basics-maple',
      type: 'python',
      title: 'Python basics - Maple',
      description: 'A forked lesson',
      fork: { sourceLessonId: 'python-basics', classId: 'maple', taskLinks: [] },
      tasks: [{ id: 1, title: 'Print hello', starterCode: 'print("hello")' }],
    })
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'wrong-id',
      type: 'python',
      title: 'Python basics - Maple',
      description: 'A forked lesson',
      fork: { sourceLessonId: 'python-basics', classId: 'maple', taskLinks: {} },
      tasks: [{ id: 1, title: 'Print hello', starterCode: 'print("hello")' }],
    })
    expect(invalid.errors).toEqual(expect.arrayContaining([
      "forked lesson id must be 'python-basics-maple'",
      'fork.taskLinks must be an array when provided',
    ]))
  })
})
