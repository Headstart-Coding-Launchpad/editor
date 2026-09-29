import { describe, expect, it } from 'vitest'
import { stageToText } from '../../app/components/SupportStagePanel.jsx'
import { LESSON_MODULE_TYPES, PLAYGROUND_LESSON_TYPES } from '../../shared/composedLesson'
import { getLessonModules } from '../registry'
import {
  CARRY_THROUGH_FIELDS,
  getModuleDefinition,
  getModuleLabel,
  getModuleTypesWithCapability,
} from '../definitions.js'
import { resolveRemoteResetTarget } from '../../app/studentTaskContent'
import {
  TEACHER_LIVE_REFERENCE_TYPES,
  teacherLiveReferenceDisplayState,
} from '../../app/studentLiveDisplay'
import {
  initialSandboxWorkByKind,
  onSandboxFilesChannel,
  readSessionSandboxWork,
  sandboxStarterWork,
  sandboxWireFields,
  sandboxWorkKind,
} from '../../app/teacherSandboxWork'
import { encodeFileKey } from '../../shared/fileKeys'
import { buildStageOptions, deriveTaskContext } from '../../shared/taskUtils'
import { getCodeBlockOptions, getInlineCodeOptions } from '../../shared/markdown/editorOptions'
import { validateLesson } from '../../builder/lessonUtils'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { readRepoFile, repoFileExists } from './helpers/sourceLiterals'

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
  turtle: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: no /playground/turtle route exists yet.',
  },
  html: {
    PLAYGROUND_LESSON_TYPES: 'Intentional: HTML has no playground (see composedLesson.js).',
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
    // capabilities.sideExplainer is a one-line flip, but the windowed shell's drag/resize
    // bounds inside a split pane need a real-browser check first (jsdom can't catch it).
    SIDE_EXPLAINER_TYPES:
      'Drift: desktop was added after the list; explainer falls back to the accordion layout.',
    MODULE_PANES_TYPES:
      'Drift: desktop windows are not reported as panes to the teacher (StudentWorkspace would need to call onVisiblePanesChange).',
    TEACHER_LIVE_REFERENCE_TYPES:
      'Drift: capabilities.teacherLiveReference is off for desktop; the adapter and stageToText handle its state, but the support reference needs a real-browser check before switching it on.',
    teacherLiveReferenceDisplayState: 'Drift: see TEACHER_LIVE_REFERENCE_TYPES.',
    CopyCodePanel: 'Intentional: no code to copy.',
    'editorOptions getCodeBlockOptions': 'Intentional: no module language for code blocks.',
  },
  electronics: {
    CopyCodePanel: 'Drift: electronics does not declare or render a copy-code panel.',
  },
}

// ─── Parity lists ─────────────────────────────────────────────────────────────
//
// Each entry answers "does this hand-maintained list/map know about `mod`?". Private
// (non-exported) literals are read from source text with ./helpers/sourceLiterals so this
// test never needs production code to change; the helper throws a clear error if a
// literal stops being a literal (e.g. once it is derived from the registry — then swap the
// entry to import the value). Since plan step 4.6 every entry reads the registry or runs the
// behaviour, so no private literal is read any more.

// Lists derived from module definitions since plan 1.2 (each consumer's use of the
// derivation is pinned in derivedTypeLists.test.js).
const SIDE_EXPLAINER_TYPES = getModuleTypesWithCapability('sideExplainer')
const MODULE_PANES_TYPES = getModuleTypesWithCapability('modulePanes')
// The teacher sandbox's work as it travels: a filename → content map on the files channel,
// else the `sandboxCode` string.
function sandboxWireSnapshot(definition, work) {
  const fields = sandboxWireFields(definition, work)
  return onSandboxFilesChannel(definition)
    ? JSON.stringify(Object.fromEntries(fields.files.map((file) => [file.name, file.content])))
    : fields.code
}
// Plan step 4.6: TeacherView keeps and sends sandbox work through the module's definition
// (src/app/teacherSandboxWork.js). A type is covered when its sandbox kind has a slot and its
// starter survives the trip to the session (enter / push) and back (reload / module switch).
function teacherSandboxRoundTrips(type) {
  const definition = getModuleDefinition(type)
  if (!Object.hasOwn(initialSandboxWorkByKind(), sandboxWorkKind(definition))) return false
  const work = sandboxStarterWork(definition, { type }, starterTaskFor(type))
  const fields = sandboxWireFields(definition, work)
  const session = onSandboxFilesChannel(definition)
    ? {
        state: 'sandbox',
        sandboxFiles: Object.fromEntries(
          fields.files.map((file) => [encodeFileKey(file.name), file.content])
        ),
      }
    : { state: 'sandbox', sandboxCode: fields.code }
  const readBack = readSessionSandboxWork(definition, session)
  return (
    readBack != null &&
    sandboxWireSnapshot(definition, readBack) === sandboxWireSnapshot(definition, work)
  )
}
// A stage carrying every module's state shape; a type is covered if stageToText finds text.
const SAMPLE_STAGE = {
  code: 'x = 1',
  fs: { '/': { type: 'dir' } },
  desktop: { windows: [] },
  markdown: 'blocks',
}

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
  'TeacherView sandbox state': (mod) => teacherSandboxRoundTrips(mod.type),
  // Stage labels and the legacy complete field come from the definition since plan 1.2.
  STAGE_OPTION_METADATA: (mod) =>
    typeof getModuleDefinition(mod.type)?.completeField === 'string' &&
    buildStageOptions({ id: 1 }, mod.type)[0]?.label ===
      getModuleDefinition(mod.type).stageLabels.starterLabel,
  TASK_CARRY_FIELDS: (mod) => CARRY_THROUGH_FIELDS.includes(mod.carryThroughField),
  // Labels live on each module's definition (meta) since plans 1.1/1.2; the surfaces below
  // read them through getModuleLabel(type, surface).
  'definition meta.label': (mod) => typeof getModuleDefinition(mod.type)?.meta?.label === 'string',
  'InformationTask singleTypeLabel': (mod) => !!getModuleLabel(mod.type, 'lessonIntro'),
  'LessonMetaPanel singleModuleLabel': (mod) => !!getModuleLabel(mod.type, 'builderMeta'),
  'printLesson TYPE_LABELS': (mod) => !!getModuleLabel(mod.type, 'print'),
  'SupportStagePanel getLanguageLabel': (mod) => !!getModuleLabel(mod.type, 'stageReference'),
  'SupportStagePanel stageToText': (mod) => stageToText(SAMPLE_STAGE, mod.type) !== '',
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
    for (const list of [FEATURE_MATRIX_ROW_NAMES]) {
      expect(list.length).toBeGreaterThan(0)
    }
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
