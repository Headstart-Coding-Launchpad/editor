import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { parseYamlLesson } from '../../../cli/yaml-converter.mjs'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  INVALID_LEGACY_ACTIVITY_TASKS,
  legacyActivityLesson,
} from '../../test/fixtures/legacyActivityTasks.js'
import * as codeStateLessons from '../../test/fixtures/studentCodeStateLessons.js'
import { getActivityDefinition } from '../../activities/registry.pure.js'

// Plan step 1.4 (docs/architecture/modular-activities-plan.md): the Builder and the CLI share
// one set of rules with one wording (src/shared/lessonValidation.js + each module's
// validateTask + the activity registry). Only the environment-specific extras below may differ
// (ADR 0008); every other message must come out of both validators identically.

const CLI_ONLY_ERRORS = ['description is required']
const BUILDER_ONLY_ERRORS = [/ has invalid toolbox XML$/]
const BUILDER_ONLY_WARNINGS = [
  / has a completion check that hasn't been tested — run the task to verify it$/,
  /^Task ID .* - renumber task IDs before publishing$/,
]

const matchesAny = (patterns, message) =>
  patterns.some((pattern) =>
    typeof pattern === 'string' ? pattern === message : pattern.test(message)
  )

function sharedResults(lesson) {
  const builder = validateLesson(structuredClone(lesson))
  const cli = validateLessonForMcp(structuredClone(lesson))
  return {
    builder: {
      errors: builder.errors.filter((m) => !matchesAny(BUILDER_ONLY_ERRORS, m)),
      warnings: builder.warnings.filter((m) => !matchesAny(BUILDER_ONLY_WARNINGS, m)),
    },
    cli: {
      errors: cli.errors.filter((m) => !matchesAny(CLI_ONLY_ERRORS, m)),
      warnings: cli.warnings,
    },
  }
}

// Every YAML/JSON block in docs/authoring that looks like a whole lesson, including templates
// and deliberately broken examples.
function docLessons() {
  const dir = resolve(process.cwd(), 'docs/authoring')
  const lessons = []
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(resolve(dir, file), 'utf8').replace(/\r\n/g, '\n')
    const pattern = /```(yaml|json)\n([\s\S]*?)```/g
    let match
    while ((match = pattern.exec(text))) {
      const [, lang, body] = match
      const looksLikeLesson =
        lang === 'yaml'
          ? /^id:/m.test(body) && /^tasks:/m.test(body)
          : body.trim().startsWith('{') && /"id"\s*:/.test(body) && /"tasks"\s*:/.test(body)
      if (!looksLikeLesson) continue
      let lesson
      try {
        lesson = lang === 'yaml' ? parseYamlLesson(body) : JSON.parse(body)
      } catch {
        continue
      }
      const line = text.slice(0, match.index).split('\n').length + 1
      lessons.push([`${file}:${line}`, lesson])
    }
  }
  return lessons
}

function fixtureLessons() {
  const lessons = [
    ['legacy activity fixtures', legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS))],
    ...Object.entries(INVALID_LEGACY_ACTIVITY_TASKS).map(([name, task]) => [
      `invalid legacy: ${name}`,
      legacyActivityLesson([task]),
    ]),
  ]
  for (const [name, build] of Object.entries(codeStateLessons)) {
    if (typeof build === 'function' && name.endsWith('Lesson')) {
      lessons.push([`studentCodeStateLessons.${name}`, build()])
    }
  }
  return lessons
}

const lesson = (type, tasks, extra = {}) => ({
  id: 'parity',
  type,
  title: 'Parity',
  description: 'Shared validation parity',
  tasks,
  ...extra,
})

describe('Builder and CLI validation parity', () => {
  const docs = docLessons()
  const fixtures = fixtureLessons()

  it('finds the doc examples and fixtures', () => {
    expect(docs.length).toBeGreaterThanOrEqual(10)
    expect(fixtures.length).toBeGreaterThanOrEqual(20)
  })

  it.each([...docs, ...fixtures])('%s: identical shared errors and warnings', (_, input) => {
    const { builder, cli } = sharedResults(input)
    expect(builder.errors).toEqual(cli.errors)
    expect(builder.warnings).toEqual(cli.warnings)
  })

  it('keeps only the environment-specific extras apart', () => {
    const input = lesson(
      'scratch',
      [
        { id: 1, title: 'A', starterBlocks: {}, toolbox: '<xml><broken', check: { type: 'x' } },
        { id: 1, title: 'B', starterBlocks: {} },
      ],
      { description: '' }
    )
    const builder = validateLesson(input)
    const cli = validateLessonForMcp(input)
    expect(cli.errors).toContain('description is required')
    expect(builder.errors).not.toContain('description is required')
    expect(builder.errors).toContain('Task 1 has invalid toolbox XML')
    expect(cli.errors).not.toContain('Task 1 has invalid toolbox XML')
    expect(builder.warnings).toContain(
      'Task ID 1 is used by task 1 "A" and task 2 "B" - renumber task IDs before publishing'
    )
    expect(builder.warnings).toContain(
      "Task 1 has a completion check that hasn't been tested — run the task to verify it"
    )
    expect(cli.warnings).toEqual([])
  })

  it('uses each task’s own module in a composed lesson, never lesson.type', () => {
    const input = lesson('composed', [
      { id: 1, title: 'Blocks', moduleType: 'scratch', check: { type: 'block_used' } },
      { id: 2, title: 'Files', moduleType: 'filesystem', check: { type: 'fs_file_exists' } },
      {
        id: 3,
        title: 'Code',
        moduleType: 'python',
        starterCode: 'x = 1',
        check: { type: 'variable_equals', value: '1' },
      },
    ])
    for (const result of [validateLesson(input), validateLessonForMcp(input)]) {
      expect(result.errors).toEqual([
        'Task 1 has a Scratch check but no block opcode',
        'Task 2 has a filesystem check but no path',
        'Task 3 has a variable check but no variable name',
      ])
    }
  })

  it('validates activity tasks through the activity registry', () => {
    const binary = getActivityDefinition('binary').defaultTask({ id: 1, title: 'Bits' })
    const valid = lesson('composed', [binary])
    expect(validateLesson(valid).errors).toEqual([])
    expect(validateLessonForMcp(valid).errors).toEqual([])

    const unknown = lesson('composed', [
      { id: 1, title: 'Future', taskType: 'activity', activityType: 'hologram' },
      { ...binary, id: 2, title: 'Bad bits', bits: 99 },
    ])
    const { builder, cli } = sharedResults(unknown)
    expect(builder.errors).toEqual(cli.errors)
    expect(cli.errors).toHaveLength(2)
    expect(cli.errors[0]).toBe(
      'Task 1: unknown activityType "hologram". Run `lessons capabilities` to list activities.'
    )
    expect(cli.errors[1]).toMatch(/^Task 2: binary bits must be a whole number/)
  })
})
