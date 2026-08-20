import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { validateLessonForMcp } from './validate.mjs'

describe('CLI lesson validation', () => {
  it('loads the validator through Node ESM resolution', () => {
    expect(() => execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', "import './cli/validate.mjs'"],
      { cwd: process.cwd(), stdio: 'pipe' },
    )).not.toThrow()
  })

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

  it('validates code_arrange tasks', () => {
    const valid = validateLessonForMcp({
      id: 'arrange-basics',
      type: 'python',
      title: 'Arrange basics',
      description: 'A short arrange lesson',
      tasks: [
        {
          title: 'Arrange a loop',
          taskType: 'code_arrange',
          moduleType: 'python',
          lines: [
            { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'for i in range(3):' }] },
            { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: '    print(i)' }] },
          ],
          distractors: [{ id: 'D1', code: '    print(i * 2)' }],
          check: { type: 'output_contains', value: '0' },
        },
      ],
    })
    expect(valid.valid).toBe(true)
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'arrange-invalid',
      type: 'scratch',
      title: 'Arrange invalid',
      description: 'An invalid arrange lesson',
      tasks: [
        {
          title: 'Arrange',
          taskType: 'code_arrange',
          moduleType: 'scratch',
          lines: [],
        },
      ],
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toEqual(expect.arrayContaining([
      'Task 1 is a code-arrange task but must use the Python or HTML module',
      'Task 1 is a code-arrange task but has no lines',
      'Task 1 is a code-arrange task but has no completion check',
    ]))

    const invalidInline = validateLessonForMcp({
      id: 'arrange-invalid-inline',
      type: 'python',
      title: 'Arrange invalid inline',
      description: 'An invalid inline arrange lesson',
      tasks: [
        {
          title: 'Arrange',
          taskType: 'code_arrange',
          moduleType: 'python',
          lines: [{ id: 'L1', parts: [{ type: 'slot', code: '' }] }],
          check: { type: 'output_contains', value: '0' },
        },
      ],
    })
    expect(invalidInline.valid).toBe(false)
    expect(invalidInline.errors).toEqual(expect.arrayContaining([
      'Task 1 line 1 blank 1 has no id',
      'Task 1 line 1 blank 1 has no correct value',
    ]))
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

  it('rejects an electronics task with no starter breadboard, matching the Builder', () => {
    const result = validateLessonForMcp({
      id: 'electronics-no-starter',
      type: 'electronics',
      title: 'Electronics no starter',
      description: 'A breadboard lesson missing its starter circuit',
      tasks: [{ title: 'Light an LED' }],
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(['Task 1 has no starter breadboard']))
  })

  it('rejects an electronics check with no target component, matching the Builder', () => {
    const result = validateLessonForMcp({
      id: 'electronics-bad-check',
      type: 'electronics',
      title: 'Electronics bad check',
      description: 'A breadboard lesson with an incomplete check',
      tasks: [
        {
          title: 'Light an LED',
          starterCircuit: { components: [], wires: [] },
          check: { type: 'circuit_has_component', component: {} },
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(['Task 1 has a part-exists check but no part type or label']))
  })

  it('recognizes canonical (non-legacy) filesystem check type names, matching the Builder', () => {
    const result = validateLessonForMcp({
      id: 'filesystem-canonical-check',
      type: 'filesystem',
      title: 'Filesystem canonical check',
      description: 'A filesystem lesson using the current-convention check names',
      tasks: [
        {
          title: 'Create a file',
          starterFs: { '/': { type: 'dir' } },
          check: { type: 'fs_file_content', path: '/notes.txt', value: '' },
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining(['Task 1 has a file-content check but no expected value']))
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
      'Task 1 stage 1 role must be one of: starter, support, complete',
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

  it('accepts incomplete real tasks while draft is enabled, but applies full validation after it is cleared', () => {
    const draft = {
      id: 'draft-python', type: 'python', title: 'Draft Python', description: 'In progress', draft: true,
      tasks: [{ id: 7, title: 'Variables', taskType: 'information', intent: 'Explain variables and ask learners to make one.' }],
    }
    expect(validateLessonForMcp(draft)).toMatchObject({ valid: true, errors: [] })
    expect(validateLessonForMcp({ ...draft, draft: false }).errors).toContain('Task 1 is an information task but has no explainer')
  })

  it('rejects malformed draft task structures while retaining code-task representation', () => {
    const result = validateLessonForMcp({
      id: 'bad-draft', type: 'python', title: 'Bad draft', description: 'In progress', draft: true,
      tasks: [{ id: 1, title: 'Broken', intent: 'Brief', taskType: 'draft', options: {} }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'Task 1 taskType must be information or quiz when provided',
      'Task 1 options must be an array of objects when provided',
    ]))
  })
})
