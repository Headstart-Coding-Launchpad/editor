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
})
