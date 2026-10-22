// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// mustSee is an optional boolean on any task (src/shared/lessonValidation.js).
const MESSAGE = 'Task 1 mustSee must be true or false'

function lessonWith(mustSee) {
  return {
    id: 'must-see-demo',
    type: 'python',
    title: 'Errors',
    description: 'See an error',
    tasks: [
      {
        id: 1,
        title: 'Break it',
        explainer: 'Run this to see the error.',
        starterCode: 'print(hello)\n',
        check: { type: 'run_attempted' },
        ...(mustSee === undefined ? {} : { mustSee }),
      },
    ],
  }
}

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s mustSee validation', (_name, validate) => {
  it.each([undefined, true, false])('accepts mustSee %s', (value) => {
    expect(validate(lessonWith(value)).errors).not.toContain(MESSAGE)
  })

  it.each(['yes', 1, 'true'])('rejects mustSee %s', (value) => {
    expect(validate(lessonWith(value)).errors).toContain(MESSAGE)
  })
})
