// `lessons capabilities`: machine-readable catalogue of what lessons can use, built from the
// real registries (module definitions, activity definitions, check-type registry) so lesson
// agents read ground truth instead of prose. Pure: no Firebase.
import { getModuleDefinitions } from '../src/modules/definitions.js'
import { getActivityDefinitions } from '../src/activities/registry.pure.js'
import { checkRegistry } from '../src/modules/checks.js'

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
    checkTypes: checkRegistry
      .list()
      .filter((check) => check.owner === `module:${def.type}`)
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
    completion: def.completion,
    requires: def.requires,
    teacherEditable: def.teacherEditable,
    checkTypes: (def.checks ?? []).map((check) => check.type),
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

export function buildCapabilities() {
  return {
    modules: getModuleDefinitions().map(describeModule),
    activities: getActivityDefinitions().map(describeActivity),
    checkTypes: checkRegistry.list().map(describeCheck),
    requests:
      'Missing something? Add docs/authoring/authoring-requests/<yyyy-mm-dd>-<slug>.md (template in that folder).',
  }
}
