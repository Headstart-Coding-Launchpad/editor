import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { validateLessonForMcp } from './validate.mjs'
import { validateLesson } from '../src/builder/lessonUtils.js'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  INVALID_LEGACY_ACTIVITY_TASKS,
  legacyActivityLesson,
} from '../src/test/fixtures/legacyActivityTasks.js'

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3), updated
// for step 1.4: the Builder (validateLesson) and CLI (validateLessonForMcp) validators now
// share one set of quiz/code_arrange rules with one wording (src/shared/lessonValidation.js),
// so every shared rule must give both validators the SAME list. Environment-specific extras
// (the Builder's untested-check reminder) are asserted separately.
describe('characterisation: quiz + code_arrange validation messages', () => {
  it('accepts every valid legacy fixture; only the Builder adds untested-check reminders', () => {
    const lesson = legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS))
    const builder = validateLesson(lesson)
    const cli = validateLessonForMcp(lesson)
    expect(builder.errors).toEqual([])
    expect(cli.errors).toEqual([])
    const untested = (warning) => warning.includes("hasn't been tested")
    // Shared warnings: identical in both validators.
    expect(builder.warnings.filter((warning) => !untested(warning))).toEqual(cli.warnings)
    expect(cli.warnings).toEqual([])
    // Builder-only extra: quiz tasks count too (every sub-type except an open short answer).
    expect(builder.warnings.filter(untested)).toMatchInlineSnapshot(`
      [
        "Task 1 has a completion check that hasn't been tested — run the task to verify it",
        "Task 2 has a completion check that hasn't been tested — run the task to verify it",
        "Task 3 has a completion check that hasn't been tested — run the task to verify it",
        "Task 4 has a completion check that hasn't been tested — run the task to verify it",
        "Task 5 has a completion check that hasn't been tested — run the task to verify it",
        "Task 7 has a completion check that hasn't been tested — run the task to verify it",
        "Task 8 has a completion check that hasn't been tested — run the task to verify it",
      ]
    `)
  })

  // Known quirks pinned as-is: a missing title is reported twice (once by
  // validateDraftLessonStructure, once by the per-task loop), and a short answer
  // with a non-answer_* check reports "no check value" even when it has one.
  it('reports each invalid variant with the same exact messages from both validators', () => {
    const results = Object.fromEntries(
      Object.entries(INVALID_LEGACY_ACTIVITY_TASKS).map(([name, task]) => {
        const lesson = legacyActivityLesson([task])
        const builder = validateLesson(lesson).errors
        const cli = validateLessonForMcp(lesson).errors
        expect(builder, name).toEqual(cli)
        return [name, cli]
      })
    )
    expect(results).toMatchInlineSnapshot(`
      {
        "code_arrange_bad_distractors": [
          "Task 1 distractor 1 has no id",
          "Task 1 distractor 2 has no code",
        ],
        "code_arrange_bad_parts": [
          "Task 1 line 1 has no id",
          "Task 1 line 1 blank 1 has no id",
          "Task 1 line 1 blank 1 has no correct value",
          "Task 1 line 1 part 2 has an invalid type",
          "Task 1 line 2 has no parts",
        ],
        "code_arrange_duplicate_ids": [
          "Task 1 is a code-arrange task but has duplicate line ids",
          "Task 1 is a code-arrange task but has duplicate blank/distractor ids",
        ],
        "code_arrange_html_no_entry": [
          "Task 1 has duplicate filenames",
          "Task 1 has no HTML file to use as entry point",
        ],
        "code_arrange_html_no_files": [
          "Task 1 has no files",
        ],
        "code_arrange_no_blanks": [
          "Task 1 is a code-arrange task but has no blanks",
        ],
        "code_arrange_wrong_module": [
          "Task 1 is a code-arrange task but must use the Python or HTML module",
          "Task 1 is a code-arrange task but has no lines",
          "Task 1 is a code-arrange task but has no completion check",
        ],
        "fill_blank_empty_answer": [
          "Task 1 is a fill-in-the-blank quiz but has an empty answer",
        ],
        "fill_blank_no_blanks": [
          "Task 1 is a fill-in-the-blank quiz but has no blank answers",
        ],
        "fill_blank_no_marker": [
          "Task 1 is a fill-in-the-blank quiz but has no blanks in the text",
        ],
        "match_empty_answer": [
          "Task 1 is a match quiz but has an empty prompt or answer",
        ],
        "match_one_pair": [
          "Task 1 is a match quiz but has fewer than 2 pairs",
        ],
        "mc_default_quiz_type_no_options": [
          "Task 1 is a quiz but has fewer than 2 options",
          "Task 1 is a quiz but no correct answer has been selected",
        ],
        "mc_empty_option_text": [
          "Task 1 is a quiz but has an empty option text",
        ],
        "mc_one_option_no_answer": [
          "Task 1 is a quiz but has fewer than 2 options",
          "Task 1 is a quiz but no correct answer has been selected",
        ],
        "mc_wrong_check_type": [
          "Task 1 is a quiz but no correct answer has been selected",
        ],
        "quiz_missing_title": [
          "Task 1 is missing a title",
          "Task 1 is missing a title",
        ],
        "short_answer_empty_check_value": [
          "Task 1 is a short-answer quiz with a check enabled but no check value",
        ],
        "short_answer_non_answer_check": [
          "Task 1 is a short-answer quiz with a check enabled but no check value",
        ],
      }
    `)
  })
})

describe('CLI lesson validation', () => {
  it('loads the validator through Node ESM resolution', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['--input-type=module', '--eval', "import './cli/validate.mjs'"],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).not.toThrow()
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
    expect(result.warnings.some((w) => w.includes('complete solution fails a code check'))).toBe(
      true
    )
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
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        'Task 1 is a code-arrange task but must use the Python or HTML module',
        'Task 1 is a code-arrange task but has no lines',
        'Task 1 is a code-arrange task but has no completion check',
      ])
    )

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
    expect(invalidInline.errors).toEqual(
      expect.arrayContaining([
        'Task 1 line 1 blank 1 has no id',
        'Task 1 line 1 blank 1 has no correct value',
      ])
    )
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
    expect(result.errors).toEqual(
      expect.arrayContaining(['Task 1 has a part-exists check but no part type or label'])
    )
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
    expect(result.errors).toEqual(
      expect.arrayContaining(['Task 1 has a file-content check but no expected value'])
    )
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

  it('accepts allowSharing on code tasks and rejects it elsewhere', () => {
    const valid = validateLessonForMcp({
      id: 'sharing-demo',
      type: 'python',
      title: 'Sharing demo',
      description: 'A lesson with workspace sharing',
      tasks: [
        { title: 'Not shareable by omission', starterCode: 'print("hi")' },
        { title: 'Sharing off', allowSharing: false, starterCode: 'print("hi")' },
        { title: 'Sharing on', allowSharing: true, starterCode: 'print("hi")' },
      ],
    })
    expect(valid.errors).toEqual([])

    const wrongType = validateLessonForMcp({
      id: 'sharing-demo',
      type: 'python',
      title: 'Sharing demo',
      description: 'A lesson with workspace sharing',
      tasks: [{ title: 'Bad flag', allowSharing: 'yes', starterCode: 'print("hi")' }],
    })
    expect(wrongType.errors).toContain('Task 1 allowSharing must be true or false')

    const onInformation = validateLessonForMcp({
      id: 'sharing-demo',
      type: 'python',
      title: 'Sharing demo',
      description: 'A lesson with workspace sharing',
      tasks: [
        {
          title: 'Reading',
          taskType: 'information',
          explainer: 'Some reading',
          allowSharing: true,
        },
      ],
    })
    expect(onInformation.errors).toContain(
      'Task 1 allowSharing is not supported on quiz or information tasks'
    )
  })

  it('validates code stage roles and accepts revealable stages across roles', () => {
    const valid = validateLessonForMcp({
      id: 'stage-role-demo',
      type: 'python',
      title: 'Stage roles',
      description: 'A lesson with revealable stages',
      tasks: [
        {
          title: 'Use a variable',
          starterCode: 'name = ""',
          codeStages: [
            { label: 'With name started', revealable: true, code: 'name = "Ada"' },
            { label: 'Extension', role: 'extension', revealable: true, code: 'first = "Ada"' },
          ],
        },
      ],
    })
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'stage-role-demo',
      type: 'python',
      title: 'Stage roles',
      description: 'A lesson with bad stages',
      tasks: [
        {
          title: 'Use a variable',
          starterCode: 'name = ""',
          codeStages: [{ label: 'Wrong role', role: 'stretch', code: '' }],
        },
      ],
    })
    expect(invalid.errors).toEqual(
      expect.arrayContaining(['Task 1 stage 1 role must be one of: starter, support, complete'])
    )
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
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        "forked lesson id must be 'python-basics-maple'",
        'fork.taskLinks must be an array when provided',
      ])
    )
  })

  it('validates recordingUrl as a YouTube link', () => {
    const valid = validateLessonForMcp({
      id: 'python-basics-maple',
      type: 'python',
      title: 'Python basics - Maple',
      description: 'A forked lesson',
      recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
      tasks: [{ id: 1, title: 'Print hello', starterCode: 'print("hello")' }],
    })
    expect(valid.errors).toEqual([])

    const invalid = validateLessonForMcp({
      id: 'python-basics-maple',
      type: 'python',
      title: 'Python basics - Maple',
      description: 'A forked lesson',
      recordingUrl: 'https://drive.google.com/file/d/abc123/view',
      tasks: [{ id: 1, title: 'Print hello', starterCode: 'print("hello")' }],
    })
    expect(invalid.errors).toEqual(
      expect.arrayContaining(['recordingUrl must be a YouTube link (youtube.com or youtu.be)'])
    )
  })

  it('accepts incomplete real tasks while draft is enabled, but applies full validation after it is cleared', () => {
    const draft = {
      id: 'draft-python',
      type: 'python',
      title: 'Draft Python',
      description: 'In progress',
      draft: true,
      tasks: [
        {
          id: 7,
          title: 'Variables',
          taskType: 'information',
          intent: 'Explain variables and ask learners to make one.',
        },
      ],
    }
    expect(validateLessonForMcp(draft)).toMatchObject({ valid: true, errors: [] })
    expect(validateLessonForMcp({ ...draft, draft: false }).errors).toContain(
      'Task 1 is an information task but has no explainer'
    )
  })

  it('rejects malformed draft task structures while retaining code-task representation', () => {
    const result = validateLessonForMcp({
      id: 'bad-draft',
      type: 'python',
      title: 'Bad draft',
      description: 'In progress',
      draft: true,
      tasks: [{ id: 1, title: 'Broken', intent: 'Brief', taskType: 'draft', options: {} }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Task 1 taskType must be information, quiz, code_arrange or activity when provided',
        'Task 1 options must be an array of objects when provided',
      ])
    )
  })
})

describe('input_* checks (Desktop records input)', () => {
  const desktopLesson = (check, extra = {}) => ({
    id: 'desktop-input',
    type: 'desktop',
    title: 'Desktop input',
    description: 'How it was done.',
    tasks: [
      {
        id: 1,
        title: 'Open by double-clicking',
        starterDesktop: { fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] },
        check,
        ...extra,
      },
    ],
  })

  it('accepts input checks on Desktop tasks in both the Builder and the CLI', () => {
    const lesson = desktopLesson(
      [
        { type: 'input_gesture', gesture: 'drag', targetKind: 'file', dropTargetKind: 'folder' },
        { type: 'input_shortcut', combo: 'ctrl+c', via: 'keyboard' },
        { type: 'input_modifier', modifier: 'shift', notCapsLock: true },
      ],
      { feedbackChecks: [{ type: 'input_shortcut', combo: 'ctrl+c', via: 'menu', hint: 'Keys!' }] }
    )
    expect(validateLessonForMcp(lesson).errors).toEqual([])
    expect(validateLesson(lesson).errors).toEqual([])
  })

  it('rejects them on modules that do not record input, and a reserved combo', () => {
    const python = {
      id: 'py-input',
      type: 'python',
      title: 'Python input',
      description: 'Nope.',
      tasks: [
        {
          id: 1,
          title: 'Say hi',
          starterCode: 'print("hi")',
          check: { type: 'input_gesture', gesture: 'click' },
        },
      ],
    }
    const message =
      "Task 1 has an input_gesture check, but Python tasks don't record input — input checks work in Desktop tasks"
    expect(validateLessonForMcp(python).errors).toContain(message)
    expect(validateLesson(python).errors).toContain(message)

    const reserved = desktopLesson({ type: 'input_shortcut', combo: 'ctrl+w' })
    const cli = validateLessonForMcp(reserved).errors
    expect(cli).toEqual([
      'Task 1 has an input_shortcut check for "ctrl+w", which the browser keeps for itself — students can\'t perform it in a lesson (teach it with a quiz instead)',
    ])
    expect(validateLesson(reserved).errors).toEqual(cli)
  })
})
