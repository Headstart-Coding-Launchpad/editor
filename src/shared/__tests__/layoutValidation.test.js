// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// `layout: { firstPane }` picks the first result tab of a Python or Turtle task on smaller
// screens (src/shared/resultPane/resultPane.js), checked by the Builder and `lessons validate`.
function lessonWith(type, layout) {
  return {
    id: 'layout-demo',
    type,
    title: 'Layout',
    description: 'Result tabs',
    tasks: [
      {
        id: 1,
        title: 'Draw it',
        explainer: 'Draw a square.',
        starterCode: type === 'html' ? '<p>Hi</p>' : 'print(1)\n',
        check:
          type === 'html'
            ? { type: 'code_contains', value: 'p' }
            : { type: 'output_contains', value: '1' },
        ...(layout === undefined ? {} : { layout }),
      },
    ],
  }
}

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s layout validation', (_name, validate) => {
  it.each(['python', 'turtle'])('accepts layout.firstPane on a %s task', (type) => {
    const result = validate(lessonWith(type, { firstPane: 'console' }))
    expect(result.errors.join('\n')).not.toMatch(/layout/)
    expect(result.warnings.join('\n')).not.toMatch(/layout/)
  })

  it('rejects an unknown pane', () => {
    expect(validate(lessonWith('python', { firstPane: 'stage' })).errors).toContain(
      'Task 1 layout.firstPane must be one of: picture, tags, console'
    )
  })

  it('warns that layout is ignored on other modules', () => {
    expect(validate(lessonWith('html', { firstPane: 'console' })).warnings).toContain(
      'Task 1 has layout, but it only works in Python and Turtle tasks — it is ignored'
    )
  })
})
