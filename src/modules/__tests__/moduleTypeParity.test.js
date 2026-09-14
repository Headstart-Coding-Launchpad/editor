import { describe, expect, it } from 'vitest'
import { LESSON_MODULE_TYPES } from '../../shared/composedLesson'
import { getLessonModules } from '../registry'
import { resolveRemoteResetTarget } from '../../app/studentTaskContent'
import { buildStageOptions } from '../../shared/taskUtils'
import { validateLesson } from '../../builder/lessonUtils'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

// Every registered module type must be understood by the hand-maintained type lists
// scattered across the app. Turtle shipped missing from several of them (CLI type list,
// remote reset, stage options), so these tests loop over the registry instead of
// naming types, and a new module fails here until each list knows about it.

const CODE_TYPES = LESSON_MODULE_TYPES

function starterTaskFor(type) {
  return {
    id: 1,
    title: 'Task',
    starterCode: 'print(1)',
    starterFiles: [{ name: 'index.html', type: 'html', content: '<p>hi</p>' }],
    starterBlocks: { blocks: {} },
    starterFs: { type: 'dir', name: '/', children: [] },
    starterCircuit: { components: [], wires: [] },
    codeStages: [{ label: 'Starter', role: 'starter', code: 'print(1)' }],
    moduleType: type,
  }
}

describe('module type parity', () => {
  it('keeps LESSON_MODULE_TYPES in sync with the module registry', () => {
    const registered = getLessonModules().map((mod) => mod.type)
    expect([...CODE_TYPES].sort()).toEqual([...registered].sort())
  })

  it.each(CODE_TYPES)('the CLI accepts a %s lesson type', (type) => {
    const result = validateLessonForMcp({
      id: `${type}-lesson`,
      type,
      title: 'Lesson',
      description: 'Lesson',
      tasks: [starterTaskFor(type)],
    })
    expect(result.errors.filter((error) => error.startsWith('type must be'))).toEqual([])
  })

  it.each(CODE_TYPES)('remote reset resolves a starter target for %s', (type) => {
    expect(resolveRemoteResetTarget(starterTaskFor(type), 'starter', type, {})).not.toBeNull()
  })

  it.each(CODE_TYPES)('stage options include a starter option for %s', (type) => {
    const options = buildStageOptions(starterTaskFor(type), type)
    expect(options.length).toBeGreaterThan(0)
  })
})

describe('turtle validation', () => {
  const turtleLesson = (check) => ({
    id: 'turtle-lesson',
    type: 'composed',
    title: 'Turtle',
    description: 'Draw',
    tasks: [
      {
        id: 1,
        moduleType: 'turtle',
        title: 'Square',
        starterCode: 'import turtle',
        codeStages: [{ label: 'Starter', role: 'starter', code: 'import turtle' }],
        check,
      },
    ],
  })

  const validChecks = [
    { type: 'turtle_position', x: '0', y: '0', tolerance: '2' },
    { type: 'turtle_heading', value: '90', tolerance: '2' },
    { type: 'turtle_path_closed', tolerance: '2' },
    { type: 'turtle_segment_count', operator: 'equals', value: '4' },
    { type: 'turtle_path_length', operator: 'greater_than_or_equal', value: '100' },
    { type: 'turtle_command_used', command: 'backward', minCount: '1' },
    { type: 'turtle_color_used', kind: 'pen', color: 'red' },
    { type: 'turtle_stamp_count', operator: 'equals', value: '1' },
    { type: 'turtle_command_used', command: 'hideturtle', minCount: '1' },
    { type: 'code', operator: 'contains', value: 'for ' },
    { type: 'code', operator: 'matches_regex', value: 'range\\(4\\)' },
    { type: 'code_contains', value: 'turtle.left' },
  ]

  it.each(validChecks)('the Builder and CLI both accept $type checks', (check) => {
    expect(validateLesson(turtleLesson(check)).errors).toEqual([])
    expect(validateLessonForMcp(turtleLesson(check)).errors).toEqual([])
  })

  it.each([
    [{ type: 'turtle_position', x: '0' }, 'no x/y target'],
    [{ type: 'turtle_heading', tolerance: '2' }, 'no check value'],
    [{ type: 'turtle_command_used', command: 'fly' }, 'no valid command'],
    [{ type: 'turtle_color_used', kind: 'pen', color: ' ' }, 'no colour'],
    [{ type: 'turtle_spin' }, 'unknown type'],
    [{ type: 'code', operator: 'contains', value: '' }, 'has a code check but no check value'],
  ])('the Builder and CLI both reject %o', (check, message) => {
    const builderErrors = validateLesson(turtleLesson(check)).errors
    const cliErrors = validateLessonForMcp(turtleLesson(check)).errors
    expect(builderErrors.some((error) => error.includes(message))).toBe(true)
    expect(cliErrors.some((error) => error.includes(message))).toBe(true)
  })

  it('the Builder and CLI both warn about Arcade checks that are never evaluated', () => {
    const arcadeLesson = (check) => ({
      id: 'arcade-lesson',
      type: 'arcade',
      title: 'Arcade',
      description: 'Play',
      tasks: [{ id: 1, title: 'Game', starterCode: 'game.run()', check }],
    })
    const message = 'only code checks are evaluated when the game runs'
    const outputCheck = { type: 'output', operator: 'contains', value: 'hi' }
    const codeCheck = { type: 'code', operator: 'contains', value: 'game.run' }

    expect(validateLesson(arcadeLesson(outputCheck)).warnings.join('\n')).toContain(message)
    expect(validateLessonForMcp(arcadeLesson(outputCheck)).warnings.join('\n')).toContain(message)
    expect(validateLesson(arcadeLesson(codeCheck)).warnings.join('\n')).not.toContain(message)
    expect(validateLessonForMcp(arcadeLesson(codeCheck)).warnings.join('\n')).not.toContain(message)
  })

  it('does not warn about missing starter code when the starter lives in codeStages', () => {
    const lesson = turtleLesson(validChecks[0])
    delete lesson.tasks[0].starterCode
    expect(validateLesson(lesson).warnings.join('\n')).not.toContain('no starter code')
    expect(validateLessonForMcp(lesson).warnings.join('\n')).not.toContain('no starter code')
  })
})
