import { describe, expect, it } from 'vitest'
import { LESSON_MODULE_TYPES, PLAYGROUND_LESSON_TYPES } from '../../shared/composedLesson'
import { getLessonModules } from '../registry'
import { getModuleDefinition } from '../definitions.js'
import { resolveRemoteResetTarget } from '../../app/studentTaskContent'
import {
  TEACHER_LIVE_REFERENCE_TYPES,
  teacherLiveReferenceDisplayState,
} from '../../app/studentLiveDisplay'
import { buildStageOptions, deriveTaskContext } from '../../shared/taskUtils'
import { getCodeBlockOptions, getInlineCodeOptions } from '../../shared/markdown/editorOptions'
import { validateLesson } from '../../builder/lessonUtils'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import {
  arrayLiteralStrings,
  comparedLiterals,
  objectLiteralKeys,
  readRepoFile,
  repoFileExists,
} from './helpers/sourceLiterals'

// Every registered module type must be understood by the hand-maintained type lists
// scattered across the app. Turtle shipped missing from several of them (CLI type list,
// remote reset, stage options), so these tests loop over the registry instead of
// naming types, and a new module fails here until each list knows about it.

const CODE_TYPES = LESSON_MODULE_TYPES
const MODULES = getLessonModules()

// ─── Known gaps ───────────────────────────────────────────────────────────────
//
// type → parity list → why that type is (for now) missing from it.
//
// "Drift:" entries are real bugs — the type should be in the list and simply isn't (the
// modular-activities plan, phase 1.2/1.5, derives or fixes these). "Intentional:" entries
// are deliberate exclusions that still live in a hand-written list rather than a module
// capability. Either way the entry must be removed as soon as the type is covered: the
// "stale gap" assertion below fails for any entry that is no longer a gap, so this object
// can only shrink.
const KNOWN_GAPS = {
  arcade: {
    'SupportStagePanel getLanguageLabel':
      'Drift: arcade stage references are labelled "Code reference" instead of Python/Arcade.',
    'editorOptions getCodeBlockOptions':
      'Drift: explainer code-block menu offers only a generic block, not Python.',
  },
  turtle: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: no /playground/turtle route exists yet.',
    teacherLiveReferenceDisplayState:
      'Drift: turtle is in TEACHER_LIVE_REFERENCE_TYPES but the adapter returns null for it.',
    'InformationTask singleTypeLabel':
      'Drift: information tasks label a turtle lesson with the raw type "turtle".',
    'LessonMetaPanel singleModuleLabel':
      'Drift: the Builder labels a turtle lesson "Web" (the fallback).',
    'SupportStagePanel getLanguageLabel': 'Drift: turtle stage references are labelled "Code".',
    'SupportStagePanel stageToText':
      'Drift: turtle stages render no text, so the support reference never shows.',
    'editorOptions getCodeBlockOptions':
      'Drift: explainer code-block menu offers only a generic block, not Python.',
  },
  html: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: HTML has no playground (see composedLesson.js).',
    'TeacherView sandbox state':
      'Implicit: handled by the final `else` (files) branch rather than an explicit one — any unknown type falls into it too.',
    'LessonMetaPanel singleModuleLabel':
      'Implicit: "Web" is the fallback return, so html is only labelled by accident.',
  },
  scratch: {
    MODULE_PANES_TYPES: 'Intentional: Scratch reports panes through its own dedicated plumbing.',
    TEACHER_LIVE_REFERENCE_TYPES:
      'Intentional: Scratch live state is a Blockly project, not text (classroom-behaviours.md).',
    teacherLiveReferenceDisplayState: 'Intentional: see TEACHER_LIVE_REFERENCE_TYPES.',
    CopyCodePanel: 'Intentional: block-based module, no copy-code panel.',
  },
  filesystem: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: Filesystem has no playground (see composedLesson.js).',
    SIDE_EXPLAINER_TYPES: 'Intentional: explainer renders as an accordion above the workspace.',
    MODULE_PANES_TYPES: 'Intentional: the workspace has no togglable panes to report.',
    CopyCodePanel: 'Intentional: no code to copy.',
    'editorOptions getCodeBlockOptions': 'Intentional: no module language for code blocks.',
  },
  desktop: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: no /playground/desktop route exists yet.',
    SIDE_EXPLAINER_TYPES:
      'Drift: desktop was added after the list; explainer falls back to the accordion layout.',
    MODULE_PANES_TYPES: 'Drift: desktop windows are not reported as panes to the teacher.',
    TEACHER_LIVE_REFERENCE_TYPES:
      'Drift: a teacher-live desktop snapshot cannot be shown as a support reference.',
    teacherLiveReferenceDisplayState: 'Drift: see TEACHER_LIVE_REFERENCE_TYPES.',
    'InformationTask singleTypeLabel':
      'Drift: information tasks label a desktop lesson with the raw type "desktop".',
    'printLesson TYPE_LABELS': 'Drift: printed desktop lessons show the raw type "desktop".',
    'SupportStagePanel getLanguageLabel': 'Drift: desktop stage references are labelled "Code".',
    'SupportStagePanel stageToText':
      'Drift: desktop stages render no text, so the support reference never shows.',
    CopyCodePanel: 'Intentional: no code to copy.',
    'editorOptions getCodeBlockOptions': 'Intentional: no module language for code blocks.',
    deriveTaskContext: 'Drift: deriveTaskContext has no isDesktop flag.',
    'docs/MODULE_FEATURE_MATRIX.md': 'Drift: the feature matrix has no Desktop row.',
    'docs/authoring/task-types.md': 'Drift: the code-task module list omits Desktop.',
  },
  electronics: {
    CopyCodePanel: 'Drift: electronics does not declare or render a copy-code panel.',
    'editorOptions getCodeBlockOptions':
      'Drift: explainer code-block menu offers only a generic block, not MicroPython.',
  },
}

// ─── Parity lists ─────────────────────────────────────────────────────────────
//
// Each entry answers "does this hand-maintained list/map know about `mod`?". Private
// (non-exported) literals are read from source text with ./helpers/sourceLiterals so this
// test never needs production code to change; the helper throws a clear error if a
// literal stops being a literal (e.g. once it is derived from the registry — then swap the
// entry to import the value).

const src = (relPath) => ({ relPath, text: readRepoFile(relPath) })
const LESSON_TASK_CONTENT = src('src/app/components/LessonTaskContent.jsx')
const TEACHER_VIEW = src('src/app/views/TeacherView.jsx')
const TASK_UTILS = src('src/shared/taskUtils.js')
const LESSON_UTILS = src('src/builder/lessonUtils.js')
const INFORMATION_TASK = src('src/app/components/InformationTask.jsx')
const LESSON_META_PANEL = src('src/builder/components/LessonMetaPanel.jsx')
const PRINT_LESSON = src('src/builder/printLesson.js')
const SUPPORT_STAGE_PANEL = src('src/app/components/SupportStagePanel.jsx')

const arrayIn = (file, name) => arrayLiteralStrings(file.text, name, file.relPath)
const keysIn = (file, name) => objectLiteralKeys(file.text, name, file.relPath)
const comparedIn = (file, fn, identifier) =>
  comparedLiterals(file.text, fn, identifier, file.relPath)

const SIDE_EXPLAINER_TYPES = arrayIn(LESSON_TASK_CONTENT, 'SIDE_EXPLAINER_TYPES')
const MODULE_PANES_TYPES = arrayIn(LESSON_TASK_CONTENT, 'MODULE_PANES_TYPES')
const CODE_STRING_TYPES = arrayIn(TEACHER_VIEW, 'CODE_STRING_TYPES')
const TEACHER_SANDBOX_BRANCH_TYPES = [
  ...TEACHER_VIEW.text.matchAll(/activeSandboxLesson\.type\s*===\s*'([^']+)'/g),
].map((m) => m[1])
const STAGE_OPTION_METADATA_KEYS = keysIn(TASK_UTILS, 'STAGE_OPTION_METADATA')
const TASK_CARRY_FIELDS = arrayIn(LESSON_UTILS, 'TASK_CARRY_FIELDS')
const INFORMATION_TASK_LABELS = comparedIn(INFORMATION_TASK, 'singleTypeLabel', 'type')
const LESSON_META_LABELS = comparedIn(LESSON_META_PANEL, 'singleModuleLabel', 'type')
const PRINT_TYPE_LABELS = keysIn(PRINT_LESSON, 'TYPE_LABELS')
const SUPPORT_LANGUAGE_LABELS = comparedIn(SUPPORT_STAGE_PANEL, 'getLanguageLabel', 'language')
const SUPPORT_STAGE_TEXT_TYPES = comparedIn(SUPPORT_STAGE_PANEL, 'stageToText', 'lessonType')

const TEACHER_LIVE_SAMPLE = {
  active: true,
  code: '{}',
  files: { index_html: '<p>hi</p>' },
  activeFile: 'index.html',
}
const TASK_TYPE_FLAGS = new Set(['isQuiz', 'isInformation', 'isSessionSandbox'])

const docText = (relPath) => (repoFileExists(relPath) ? readRepoFile(relPath) : '')
const mentions = (text, mod) =>
  [mod.type, mod.label].some((word) =>
    new RegExp(`\\b${word.replace(/[^\w\s]/g, '\\$&')}\\b`, 'i').test(text)
  )
const FEATURE_MATRIX_ROW_NAMES = docText('docs/MODULE_FEATURE_MATRIX.md')
  .split('\n')
  .filter((line) => line.startsWith('| '))
  .map((line) => line.split('|')[1].trim())
const LESSON_SCHEMA_MODULE_TYPE_ROW =
  docText('docs/authoring/lesson-schema.md')
    .split('\n')
    .find((line) => line.startsWith('| `moduleType` | Required for composed code')) ?? ''

const PARITY_LISTS = {
  LESSON_MODULE_TYPES: (mod) => LESSON_MODULE_TYPES.includes(mod.type),
  PLAYGROUND_LESSON_TYPES: (mod) => PLAYGROUND_LESSON_TYPES.includes(mod.type),
  SIDE_EXPLAINER_TYPES: (mod) => SIDE_EXPLAINER_TYPES.includes(mod.type),
  MODULE_PANES_TYPES: (mod) => MODULE_PANES_TYPES.includes(mod.type),
  TEACHER_LIVE_REFERENCE_TYPES: (mod) => TEACHER_LIVE_REFERENCE_TYPES.includes(mod.type),
  teacherLiveReferenceDisplayState: (mod) =>
    teacherLiveReferenceDisplayState(TEACHER_LIVE_SAMPLE, mod.type) != null,
  // TeacherView keeps sandbox work either as a code string (CODE_STRING_TYPES) or in an
  // explicit per-type branch; a type in neither silently falls into the last `else`.
  'TeacherView sandbox state': (mod) =>
    CODE_STRING_TYPES.includes(mod.type) || TEACHER_SANDBOX_BRANCH_TYPES.includes(mod.type),
  STAGE_OPTION_METADATA: (mod) => STAGE_OPTION_METADATA_KEYS.includes(mod.type),
  TASK_CARRY_FIELDS: (mod) => TASK_CARRY_FIELDS.includes(mod.carryThroughField),
  // Labels live on each module's definition (meta.label) since plan 1.1.
  'definition meta.label': (mod) => typeof getModuleDefinition(mod.type)?.meta?.label === 'string',
  'InformationTask singleTypeLabel': (mod) => INFORMATION_TASK_LABELS.includes(mod.type),
  'LessonMetaPanel singleModuleLabel': (mod) => LESSON_META_LABELS.includes(mod.type),
  'printLesson TYPE_LABELS': (mod) => PRINT_TYPE_LABELS.includes(mod.type),
  'SupportStagePanel getLanguageLabel': (mod) => SUPPORT_LANGUAGE_LABELS.includes(mod.type),
  'SupportStagePanel stageToText': (mod) => SUPPORT_STAGE_TEXT_TYPES.includes(mod.type),
  // CopyCodePanel is keyed by language, so parity here is "the module opts in and its
  // StudentWorkspace actually renders the panel".
  CopyCodePanel: (mod) =>
    mod.supportsCopyCode === true &&
    readRepoFile(`src/modules/${mod.type}/StudentWorkspace.jsx`).includes('<CopyCodePanel'),
  'editorOptions getCodeBlockOptions': (mod) =>
    getCodeBlockOptions(mod.type).some((option) => option.action !== 'code-block:'),
  'editorOptions getInlineCodeOptions': (mod) => {
    const languages = new Set(
      mod.explainerInlineCodeLanguages.map((lang) => (lang === 'js' ? 'javascript' : lang))
    )
    return getInlineCodeOptions(mod.type, [...languages]).length === languages.size
  },
  deriveTaskContext: (mod) =>
    Object.entries(deriveTaskContext({ type: mod.type }, { id: 1 }, null)).some(
      ([flag, value]) => value === true && !TASK_TYPE_FLAGS.has(flag)
    ),
  'docs/authoring/<type>.md': (mod) => repoFileExists(`docs/authoring/${mod.type}.md`),
  'docs/MODULE_FEATURE_MATRIX.md': (mod) =>
    FEATURE_MATRIX_ROW_NAMES.some((name) => mentions(name, mod)),
  'docs/authoring/task-types.md': (mod) => mentions(docText('docs/authoring/task-types.md'), mod),
  'docs/authoring/lesson-schema.md': (mod) =>
    LESSON_SCHEMA_MODULE_TYPE_ROW.includes(`\`${mod.type}\``),
  'docs/README.md': (mod) => mentions(docText('docs/README.md'), mod),
  'AGENTS.md': (mod) => mentions(docText('AGENTS.md'), mod),
}

describe('registry-driven module parity', () => {
  it('reads every private list from source (guards the source-text parser)', () => {
    for (const list of [
      SIDE_EXPLAINER_TYPES,
      MODULE_PANES_TYPES,
      CODE_STRING_TYPES,
      TEACHER_SANDBOX_BRANCH_TYPES,
      STAGE_OPTION_METADATA_KEYS,
      TASK_CARRY_FIELDS,
      INFORMATION_TASK_LABELS,
      LESSON_META_LABELS,
      PRINT_TYPE_LABELS,
      SUPPORT_LANGUAGE_LABELS,
      SUPPORT_STAGE_TEXT_TYPES,
      FEATURE_MATRIX_ROW_NAMES,
    ]) {
      expect(list.length).toBeGreaterThan(0)
    }
    expect(STAGE_OPTION_METADATA_KEYS).not.toContain('completeField')
    expect(LESSON_SCHEMA_MODULE_TYPE_ROW).not.toBe('')
  })

  it('KNOWN_GAPS only names registered types and known parity lists', () => {
    const types = MODULES.map((mod) => mod.type)
    for (const [type, gaps] of Object.entries(KNOWN_GAPS)) {
      expect(types, `KNOWN_GAPS type "${type}"`).toContain(type)
      for (const [listName, reason] of Object.entries(gaps)) {
        expect(Object.keys(PARITY_LISTS), `KNOWN_GAPS.${type} list`).toContain(listName)
        expect(reason, `KNOWN_GAPS.${type}["${listName}"] reason`).toMatch(
          /^(Drift|Intentional|Implicit): \S/
        )
      }
    }
  })

  describe.each(Object.keys(PARITY_LISTS))('%s', (listName) => {
    it.each(MODULES.map((mod) => [mod.type, mod]))(
      'covers %s or lists a known gap',
      (type, mod) => {
        const covered = PARITY_LISTS[listName](mod)
        const knownGap = KNOWN_GAPS[type]?.[listName]
        if (covered) {
          expect(
            knownGap,
            `${type} is now covered by ${listName} — delete KNOWN_GAPS.${type}["${listName}"]`
          ).toBeUndefined()
        } else {
          expect(
            knownGap,
            `${type} is missing from ${listName} — add it there (or record a KNOWN_GAPS reason)`
          ).toBeDefined()
        }
      }
    )
  })
})

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
