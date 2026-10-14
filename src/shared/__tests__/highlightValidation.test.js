// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// A task's `highlight` (src/shared/controlHighlight.js) is checked against the task's effective
// module, the same way in the Builder and `lessons validate`.
describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s lesson validation of highlight', (_name, validate) => {
  const composed = (highlight) => ({
    id: 'composed-demo',
    type: 'composed',
    title: 'Mixed',
    description: 'Two modules',
    tasks: [
      {
        id: 1,
        title: 'Python first',
        explainer: 'Run it.',
        moduleType: 'python',
        starterCode: 'print(1)\n',
      },
      {
        id: 2,
        title: 'Scratch next',
        explainer: 'Click the flag.',
        moduleType: 'scratch',
        starterBlocks: { blocks: { languageVersion: 0, blocks: [] } },
        highlight,
      },
    ],
  })

  it('uses the task’s own module in a composed lesson', () => {
    expect(validate(composed('green_flag')).errors.join('\n')).not.toMatch(/highlight/)
    expect(validate(composed('run')).errors.join('\n')).not.toMatch(/highlight/)
    expect(validate(composed('category:Nope')).errors.join('\n')).toMatch(
      /Task 2 highlight "category:Nope" is not a scratch control/
    )
  })
})
