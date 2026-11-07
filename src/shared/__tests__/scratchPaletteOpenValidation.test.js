// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// scratchPaletteOpen is the calm Scratch screen's lesson-level opt-out (the block palette starts
// open), an optional lesson-envelope field shared by the Builder and `lessons validate`.
const MESSAGE = 'scratchPaletteOpen must be true or false when provided'

const baseLesson = {
  id: 'palette-open-demo',
  type: 'scratch',
  title: 'Move the cat',
  description: 'Cat',
  tasks: [{ id: 1, taskType: 'information', title: 'Intro', explainer: 'Hello' }],
}

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s scratchPaletteOpen validation', (_name, validate) => {
  it('accepts true, false, null or no field', () => {
    for (const value of [true, false, null, undefined]) {
      expect(validate({ ...baseLesson, scratchPaletteOpen: value }).errors).not.toContain(MESSAGE)
    }
  })

  it.each([['yes'], [1], [{}]])('rejects %j', (value) => {
    expect(validate({ ...baseLesson, scratchPaletteOpen: value }).errors).toContain(MESSAGE)
  })
})
