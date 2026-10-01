// `lessons capabilities`: machine-readable catalogue of what lessons can use, built from the
// real registries (module definitions, activity definitions, check-type registry) so lesson
// agents read ground truth instead of prose. No Firebase; reads the authoring-requests folder.
import { getModuleDefinitions } from '../src/modules/definitions.js'
import { getActivityDefinitions } from '../src/activities/registry.pure.js'
import { checkRegistry } from '../src/modules/checks.js'
import { authoredFieldPaths, describeFieldSpecs, fieldsForMode } from '../src/shared/fieldSpec.js'
import { COMMON_TASK_FIELDS, TASK_TYPE_FIELDS } from '../src/shared/taskFields.js'
import { TASK_ACTIVITY_FORMATS, TASK_ACTIVITY_PATTERNS } from '../src/shared/taskActivity.js'
import { getBadgeDefinitions } from '../src/badges/registry.pure.js'
import { BADGE_OPTION_SPECS } from '../src/badges/badgeOptions.js'
import { readAuthoringRequests } from './authoring-requests.mjs'

const MODULE_FLAGS = [
  'supportsInteractionMode',
  'supportsIncorrectChecks',
  'supportsTests',
  'supportsVariableChecks',
  'supportsDomChecks',
  'supportsCopyCode',
]

function describeModule(def) {
  return {
    type: def.type,
    label: def.meta.label,
    carryThroughField: def.carryThroughField,
    stageLabels: def.stageLabels,
    flags: Object.fromEntries(
      MODULE_FLAGS.filter((flag) => typeof def[flag] === 'boolean').map((flag) => [flag, def[flag]])
    ),
    ...(def.capabilities ? { capabilities: def.capabilities } : {}),
    // The module's own task fields (the common ones are under taskFields.common).
    fields: describeFieldSpecs(def.taskFields),
    authoredFields: authoredFieldPaths(def.taskFields),
    checkTypes: checkRegistry
      .list()
      .filter(
        (check) =>
          check.owner === `module:${def.type}` || def.inheritsCheckTypes?.includes(check.type)
      )
      .map((check) => check.type),
  }
}

function describeActivity(def) {
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    description: def.description,
    yamlType: def.yaml?.type ?? def.id,
    taskShape: def.legacy ?? { taskType: 'activity', activityType: def.id },
    // Activities that run inside a workspace module (code_arrange: python / html, composed
    // lessons only) name their host modules.
    ...(def.hostModules ? { hostModules: [...def.hostModules] } : {}),
    completion: def.completion,
    requires: def.requires,
    teacherEditable: def.teacherEditable,
    checkTypes: (def.checks ?? []).map((check) => check.type),
    ...describeActivityFields(def.fields),
  }
}

// Modes, task fields (with required / authored flags and per-item fields), the fields of each
// mode, and the authored-content paths, from the definition's `fields` declaration.
function describeActivityFields(fields) {
  if (!fields) return {}
  return {
    ...(fields.modeField ? { modeField: fields.modeField } : {}),
    modes: [...fields.modes],
    fields: describeFieldSpecs(fields.task),
    ...(fields.modes.length
      ? {
          fieldsByMode: Object.fromEntries(
            fields.modes.map((mode) => [mode, describeFieldSpecs(fieldsForMode(fields.task, mode))])
          ),
        }
      : {}),
    authoredFields: authoredFieldPaths(fields.task),
  }
}

function describeTaskFields() {
  const describe = (specs) => ({
    fields: describeFieldSpecs(specs),
    authoredFields: authoredFieldPaths(specs),
  })
  return {
    common: describe(COMMON_TASK_FIELDS),
    ...Object.fromEntries(
      Object.entries(TASK_TYPE_FIELDS).map(([type, specs]) => [type, describe(specs)])
    ),
  }
}

function describeCheck(def) {
  return {
    type: def.type,
    owner: def.owner,
    timing: def.timing,
    requiresRun: !!def.requiresRun,
    submitAllowed: !!def.submitAllowed,
    ...(def.aliases?.length ? { aliases: def.aliases } : {}),
    ...(def.subject ? { subject: def.subject } : {}),
    ...(def.operators ? { operators: def.operators } : {}),
    ...(def.fields ? { fields: def.fields } : {}),
  }
}

// The `taskActivity` vocabulary (src/shared/taskActivity.js): write `<Format>, <Pattern>` or
// `Quiz: <Pattern>`; `id` is what badgeHints, badges and reports use.
function describeTaskActivity() {
  return {
    formats: TASK_ACTIVITY_FORMATS.map((format) => ({ id: format.id, name: format.name })),
    patterns: TASK_ACTIVITY_PATTERNS.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      formats: [...pattern.formats],
      ...(pattern.aliases.length ? { aliases: [...pattern.aliases] } : {}),
    })),
  }
}

// Built-in badges (src/badges), what a lesson can tune (badgeOptions) and which badges a task's
// badgeHints can name. Lessons never define badges.
function describeBadges() {
  return {
    badges: getBadgeDefinitions().map((badge) => ({
      id: badge.id,
      emoji: badge.emoji,
      title: badge.title,
      tutorOnly: badge.tutorOnly,
      autoAwardable: badge.autoAwardable,
      rule: badge.ruleText,
      ...(badge.rule?.patterns ? { patterns: [...badge.rule.patterns] } : {}),
      ...(badge.rule?.formats?.length ? { formats: [...badge.rule.formats] } : {}),
      badgeHints: badge.rule?.hintable ? ['suggest', 'suppress'] : badge.rule ? ['suppress'] : [],
    })),
    badgeOptions: Object.fromEntries(
      Object.entries(BADGE_OPTION_SPECS).map(([key, spec]) => [
        key,
        { kind: spec.kind, default: spec.default, description: spec.description },
      ])
    ),
    docs: 'docs/authoring/badges.md',
  }
}

export function buildCapabilities({ requests = readAuthoringRequests() } = {}) {
  return {
    modules: getModuleDefinitions().map(describeModule),
    activities: getActivityDefinitions().map(describeActivity),
    // Fields every task can carry, and the non-module task types (information, group).
    taskFields: describeTaskFields(),
    checkTypes: checkRegistry.list().map(describeCheck),
    taskActivity: describeTaskActivity(),
    badges: describeBadges(),
    // What is already asked for: { file, title, kind, status, requestedBy, lessonsBlocked }.
    requests,
    requestsHowTo:
      'Missing something? Check `requests` first, then add docs/authoring/authoring-requests/<yyyy-mm-dd>-<slug>.md (template in that folder).',
  }
}
