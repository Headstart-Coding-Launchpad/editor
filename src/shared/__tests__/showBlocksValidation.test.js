// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// showBlocks is an optional task flag (src/shared/lessonValidation.js) that hides the Python
// editor's block brackets (src/shared/blockGuides.js), shared by the Builder and `lessons validate`.
const MESSAGE = 'Task 1 showBlocks must be true or false'

function lessonWith(showBlocks) {
  return {
    id: 'show-blocks-demo',
    type: 'python',
    title: 'Nested If',
    description: 'Blocks',
    tasks: [
      {
        id: 1,
        title: 'Nest it',
        explainer: 'Indent the inner print.',
        starterCode: 'if a:\n    print(1)\n',
        check: { type: 'output_contains', value: '1' },
        ...(showBlocks === undefined ? {} : { showBlocks }),
      },
    ],
  }
}

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s showBlocks validation', (_name, validate) => {
  it.each([undefined, true, false])('accepts showBlocks %s', (value) => {
    expect(validate(lessonWith(value)).errors).not.toContain(MESSAGE)
  })

  it.each(['no', 0, 'false'])('rejects showBlocks %s', (value) => {
    expect(validate(lessonWith(value)).errors).toContain(MESSAGE)
  })
})
