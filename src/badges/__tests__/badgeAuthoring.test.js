import { describe, expect, it } from 'vitest'
import { validateLessonCore } from '../../shared/lessonValidation.js'
import { resolveBadgeOptions, DEFAULT_BADGE_OPTIONS } from '../badgeOptions.js'
import { matchKeyboardWizardShortcut, KEYBOARD_WIZARD_SHORTCUT_IDS } from '../shortcuts.js'
import { lessonToYamlText, parseYamlLesson } from '../../../cli/yaml-converter.mjs'

const lesson = (extra = {}, task = {}) => ({
  id: 'badges',
  type: 'python',
  title: 'Badges',
  tasks: [
    {
      id: 1,
      title: 'One',
      starterCode: 'x = 1',
      check: { type: 'code_contains', value: 'x' },
      ...task,
    },
  ],
  ...extra,
})

describe('badgeOptions validation', () => {
  it('accepts valid options', () => {
    const { errors, warnings } = validateLessonCore(
      lesson({
        badgeOptions: {
          quizMasterThreshold: 1,
          quizMasterMinQuizzes: 4,
          persistenceMinFails: 1,
          readyToCodeSeconds: 7.5,
          earlyBirdMinutes: 2,
        },
      })
    )
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('rejects out-of-range values', () => {
    const { errors } = validateLessonCore(
      lesson({
        badgeOptions: {
          quizMasterThreshold: 1.2,
          quizMasterMinQuizzes: 0,
          persistenceMinFails: 1.5,
          readyToCodeSeconds: 0,
          earlyBirdMinutes: -1,
        },
      })
    )
    expect(errors).toEqual([
      'badgeOptions.quizMasterThreshold must be a number from 0 to 1',
      'badgeOptions.quizMasterMinQuizzes must be a whole number of at least 1',
      'badgeOptions.persistenceMinFails must be a whole number of at least 1',
      'badgeOptions.readyToCodeSeconds must be a positive number of seconds',
      'badgeOptions.earlyBirdMinutes must be a positive number of minutes',
    ])
  })

  it('rejects a non-object and warns about unknown keys', () => {
    expect(validateLessonCore(lesson({ badgeOptions: [] })).errors).toContain(
      'badgeOptions must be an object when provided'
    )
    expect(validateLessonCore(lesson({ badgeOptions: { speed: 1 } })).warnings).toContain(
      'badgeOptions.speed is not a badge option and is ignored'
    )
  })

  it('resolves options over the defaults, ignoring invalid values', () => {
    expect(resolveBadgeOptions({})).toEqual(DEFAULT_BADGE_OPTIONS)
    expect(
      resolveBadgeOptions(
        { badgeOptions: { persistenceMinFails: 3, quizMasterThreshold: 2 } },
        { readyToCodeSeconds: 5 }
      )
    ).toEqual({ ...DEFAULT_BADGE_OPTIONS, persistenceMinFails: 3, readyToCodeSeconds: 5 })
  })
})

describe('badgeHints validation', () => {
  const errorsFor = (badgeHints) => validateLessonCore(lesson({}, { badgeHints }))

  it('accepts known badges', () => {
    const { errors, warnings } = errorsFor({
      suggest: ['bug_hunter'],
      suppress: ['code_fixer', 'persistence'],
    })
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('rejects unknown badges, keys and shapes', () => {
    expect(errorsFor({ suggest: ['bug_hunterr'] }).errors).toContain(
      'Task 1 badgeHints.suggest names an unknown badge "bug_hunterr"'
    )
    expect(errorsFor({ suppress: 'code_fixer' }).errors).toContain(
      'Task 1 badgeHints.suppress must be a list of badge ids'
    )
    expect(errorsFor({ add: [] }).errors).toContain(
      'Task 1 badgeHints only takes suggest and suppress (found "add")'
    )
    expect(errorsFor(['bug_hunter']).errors).toContain(
      'Task 1 badgeHints must be an object with suggest and/or suppress lists'
    )
  })

  it('rejects suggesting a badge a task pattern cannot trigger', () => {
    expect(errorsFor({ suggest: ['persistence'] }).errors).toContain(
      'Task 1 badgeHints.suggest names "persistence", which a task\'s pattern can\'t trigger'
    )
    expect(errorsFor({ suggest: ['helpful_coder'] }).errors).toHaveLength(1)
  })

  it('warns when suppressing a tutor-only badge', () => {
    expect(errorsFor({ suppress: ['great_question'] }).warnings).toContain(
      'Task 1 badgeHints.suppress names "great_question", a tutor-only badge that is never suggested'
    )
  })

  it('validates hints in draft lessons too', () => {
    const draft = lesson({ draft: true }, { intent: 'x', badgeHints: { suggest: ['nope'] } })
    expect(validateLessonCore(draft).errors).toContain(
      'Task 1 badgeHints.suggest names an unknown badge "nope"'
    )
  })
})

describe('taskActivity warning', () => {
  it('warns about an unrecognised pattern only', () => {
    const warn = (taskActivity) => validateLessonCore(lesson({}, { taskActivity })).warnings
    expect(warn('Code Task, Debug Code Task')).toEqual([])
    expect(warn('')).toEqual([])
    expect(warn('Code Task, Speed Run')).toEqual([
      'Task 1 taskActivity "Code Task, Speed Run" is not a recognised Lesson Format Glossary pattern',
    ])
  })
})

describe('badge fields in YAML', () => {
  it('round-trip unchanged', () => {
    const yaml = `id: badges
type: python
title: Badges
badgeOptions:
  quizMasterThreshold: 0.75
  readyToCodeSeconds: 8
tasks:
  - title: One
    type: python
    taskActivity: Code Task
    badgeHints:
      suggest: [bug_hunter]
      suppress: [code_fixer]
`
    const parsed = parseYamlLesson(yaml)
    expect(parsed.badgeOptions).toEqual({ quizMasterThreshold: 0.75, readyToCodeSeconds: 8 })
    expect(parsed.tasks[0].badgeHints).toEqual({
      suggest: ['bug_hunter'],
      suppress: ['code_fixer'],
    })
    expect(parseYamlLesson(lessonToYamlText(parsed))).toEqual(parsed)
  })
})

describe('Keyboard Wizard shortcuts', () => {
  const key = (k, extra = {}) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...extra,
  })

  it('matches listed shortcuts with Ctrl or Cmd', () => {
    expect(matchKeyboardWizardShortcut(key('Enter', { ctrlKey: true }))?.id).toBe('run')
    expect(matchKeyboardWizardShortcut(key('Enter', { metaKey: true }))?.id).toBe('run')
    expect(matchKeyboardWizardShortcut(key('Z', { ctrlKey: true, shiftKey: true }))?.id).toBe(
      'redo'
    )
    expect(matchKeyboardWizardShortcut(key('Delete'))?.id).toBe('delete')
  })

  it('ignores AltGr, copy/paste and Tab outside the editor', () => {
    expect(matchKeyboardWizardShortcut(key('z', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(
      matchKeyboardWizardShortcut({
        ...key('/', { ctrlKey: true }),
        getModifierState: (m) => m === 'AltGraph',
      })
    ).toBeNull()
    expect(matchKeyboardWizardShortcut(key('v', { ctrlKey: true }))).toBeNull()
    expect(matchKeyboardWizardShortcut(key('Tab'))).toBeNull()
    expect(matchKeyboardWizardShortcut(key('Tab'), { inEditor: true })?.id).toBe('indent')
    expect(matchKeyboardWizardShortcut(key('Enter'))).toBeNull()
  })

  it('lists the plan’s shortcuts', () => {
    expect(KEYBOARD_WIZARD_SHORTCUT_IDS).toEqual([
      'run',
      'undo',
      'redo',
      'toggle_comment',
      'indent',
      'outdent',
      'delete',
      'find',
      'save',
      'desktop_shortcut',
    ])
  })
})
