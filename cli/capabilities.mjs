// `lessons capabilities`: machine-readable catalogue of what lessons can use, built from the
// real registries (module definitions, activity definitions, check-type registry) so lesson
// agents read ground truth instead of prose. No Firebase; reads the authoring-requests folder.
import { getModuleDefinitions } from '../src/modules/definitions.js'
import { getActivityDefinitions } from '../src/activities/registry.pure.js'
import { checkRegistry } from '../src/modules/checks.js'
import { authoredFieldPaths, describeFieldSpecs, fieldsForMode } from '../src/shared/fieldSpec.js'
import { COMMON_TASK_FIELDS, TASK_TYPE_FIELDS } from '../src/shared/taskFields.js'
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

export function buildCapabilities({ requests = readAuthoringRequests() } = {}) {
  return {
    modules: getModuleDefinitions().map(describeModule),
    activities: getActivityDefinitions().map(describeActivity),
    // Fields every task can carry, and the non-module task types (information, group).
    taskFields: describeTaskFields(),
    checkTypes: checkRegistry.list().map(describeCheck),
    // What is already asked for: { file, title, kind, status, requestedBy, lessonsBlocked }.
    requests,
    requestsHowTo:
      'Missing something? Check `requests` first, then add docs/authoring/authoring-requests/<yyyy-mm-dd>-<slug>.md (template in that folder).',
  }
}
