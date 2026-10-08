// The lesson validation core shared by the Builder (src/builder/lessonUtils.js validateLesson)
// and the CLI (cli/validate.mjs validateLessonForMcp). Pure and Node-safe.
//
// Every rule that doesn't depend on the environment lives here, with one wording, and the
// type-specific rules are delegated:
// - workspace-module tasks (and code_arrange's host module) → the module definition's
//   `validateTask` (src/modules/<type>/definition.js), looked up by the task's *effective*
//   module type, so composed lessons use each task's own module, never the raw lesson.type;
// - `taskType: 'activity'` → the activity registry's `validateTask` (unknown activityType →
//   the fallback definition's error);
// - legacy quiz / code_arrange → src/activities/legacyValidation.js until they become
//   activities (plan steps 2.2 / 4.9).
//
// Each validator adds only its environment-specific extras through the hooks on
// validateLessonCore (see ADR 0008). Messages are documented in
// docs/authoring/validation-errors.md (validationErrorsDoc.test.js scans this file).
import { validateTopicProposals } from './topicAudit.js'
import { makeForkLessonId } from './lessonForks.js'
import { isValidRecordingUrl } from './youtube.js'
import { isValidLessonNumber } from './lessonOrder.js'
import {
  BADGE_SUMMARY_INFORMATION_TYPE,
  canTaskAllowSharing,
  flattenTasks,
  isValidStageRole,
  isValidTaskPriority,
  STAGE_ROLES,
  TASK_PRIORITIES,
} from './taskUtils.js'
import { isPlainObject } from './textUtils.js'
import { validateDraftLessonStructure } from './draftLesson.js'
import {
  getModuleCarrySourceIds,
  getTaskModuleType,
  LESSON_MODULE_TYPES,
  validateComposedStructure,
} from './composedLesson.js'
import { CARRY_THROUGH_FIELDS, getModuleDefinition } from '../modules/definitions.js'
import {
  codeCheckHasValue,
  collectFeedbackChecks,
  filesStarterPresent,
  validateRegisteredChecks,
} from '../modules/moduleTaskValidation.js'
import { getTaskActivity } from '../activities/registry.pure.js'
import { getLegacyTaskValidation } from '../activities/legacyValidation.js'
import { parseTaskActivity } from './taskActivity.js'
import { validateBadgeHints, validateBadgeOptions } from '../badges/validation.js'
import { encodeLessonForFirestore } from './lessonBlocksCodec.js'
import {
  FIRESTORE_MAX_DEPTH,
  formatFirestorePath,
  measureFirestoreDepth,
} from './firestoreDepth.js'

export const VALID_LESSON_TYPES = Object.freeze([...LESSON_MODULE_TYPES, 'composed'])

// What kind of task this is for validation purposes: 'information', 'activity' (the activity
// registry), 'legacy' (quiz / code_arrange, see getLegacyTaskValidation) or 'module' (a code
// task validated by its workspace module).
export function getTaskValidationKind(task) {
  if (task?.taskType === 'information') return 'information'
  if (task?.taskType === 'activity') return 'activity'
  if (getLegacyTaskValidation(task)) return 'legacy'
  return 'module'
}

function validateLessonFork(lesson, errors) {
  const fork = lesson.fork
  if (!fork || typeof fork !== 'object' || Array.isArray(fork)) {
    errors.push('fork must be an object when provided')
    return
  }
  if (!fork.sourceLessonId || !String(fork.sourceLessonId).trim()) {
    errors.push('fork.sourceLessonId is required')
  }
  if (!fork.classId || !String(fork.classId).trim()) {
    errors.push('fork.classId is required')
  }
  if (fork.sourceLessonId && fork.classId) {
    const expectedId = makeForkLessonId(fork.sourceLessonId, fork.classId)
    if (lesson.id !== expectedId) errors.push(`forked lesson id must be '${expectedId}'`)
  }
  if (fork.taskLinks != null && !Array.isArray(fork.taskLinks)) {
    errors.push('fork.taskLinks must be an array when provided')
  }
}

// Lesson-level fields. `extraRules(lesson, errors)` lets a validator add its own envelope rules
// (the CLI requires a description) in a stable position.
function validateLessonEnvelope(lesson, errors, extraRules) {
  const { id, type, title } = lesson
  errors.push(...validateTopicProposals(lesson.topicProposals))

  if (!id || !String(id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9-]+$/.test(id))
    errors.push('id must be a lowercase slug (letters, digits, hyphens only)')

  if (!type) errors.push('type is required')
  else if (!VALID_LESSON_TYPES.includes(type))
    errors.push(`type must be one of: ${VALID_LESSON_TYPES.join(', ')}`)

  if (!title || !String(title).trim()) errors.push('title is required')
  extraRules?.(lesson, errors)
  if (lesson.fork != null) validateLessonFork(lesson, errors)
  if (lesson.recordingUrl != null && !isValidRecordingUrl(lesson.recordingUrl)) {
    errors.push('recordingUrl must be a YouTube link (youtube.com or youtu.be)')
  }
  // Optional; null means "no number" (the Builder clears the field to null).
  if (lesson.lessonNumber != null && !isValidLessonNumber(lesson.lessonNumber)) {
    errors.push('lessonNumber must be a positive whole number (1, 2, 3 …) when provided')
  }
}

// Firestore rejects a document whose maps/arrays nest more than 20 levels deep. Measure the
// lesson as it will be stored (after lessonBlocksCodec's block encoding and answer sealing, which
// turn the deepest Scratch block trees into strings) and name the deepest path and its task.
function describeDepthLocation(lesson, flat, path) {
  if (path[0] !== 'tasks' || typeof path[1] !== 'number') return 'The lesson'
  const item = lesson.tasks[path[1]]
  const task =
    item?.type === 'group' && path[2] === 'subtasks' && typeof path[3] === 'number'
      ? item.subtasks?.[path[3]]
      : item
  const n = flat.indexOf(task) + 1
  if (n > 0) return task.title ? `Task ${n} ("${task.title}")` : `Task ${n}`
  if (item?.type === 'group') return `Group "${item.title || path[1] + 1}"`
  return `tasks[${path[1]}]`
}

function validateFirestoreDepth(lesson, flat, errors) {
  let stored
  try {
    stored = encodeLessonForFirestore(lesson)
  } catch {
    return
  }
  const { depth, path } = measureFirestoreDepth(stored)
  if (depth <= FIRESTORE_MAX_DEPTH) return
  const location = describeDepthLocation(lesson, flat, path)
  const where = formatFirestorePath(path)
  errors.push(
    `${location} is nested ${depth} levels deep at ${where} — Firestore rejects documents nested deeper than ${FIRESTORE_MAX_DEPTH} levels, so the lesson can't be saved. Flatten or shorten that part of the lesson`
  )
}

function validateGroups(tasks, errors) {
  tasks.forEach((item, i) => {
    if (item?.type !== 'group') return
    if (!item.subtasks || item.subtasks.length === 0) {
      errors.push(`Group "${item.title || i + 1}" has no subtasks — add at least one subtask`)
    }
  })
}

function validateStageMetadata(task, n, errors) {
  if (!Array.isArray(task.codeStages)) return
  task.codeStages.forEach((stage, si) => {
    if (stage?.role != null && !isValidStageRole(stage.role)) {
      errors.push(`Task ${n} stage ${si + 1} role must be one of: ${STAGE_ROLES.join(', ')}`)
    }
  })
}

function validateFeedbackBasics(task, n, errors, warnings) {
  const feedbackChecks = collectFeedbackChecks(task)
  if (feedbackChecks.length === 0) return
  if (!task.check) errors.push(`Task ${n} has feedback checks but no completion check`)
  if (
    feedbackChecks.some(
      (check) => (check.mode ?? 'blocking') === 'blocking' && !String(check.hint ?? '').trim()
    )
  ) {
    warnings.push(`Task ${n} has a blocking feedback check with no hint`)
  }
  feedbackChecks.forEach((check, index) => {
    if (
      check.priority != null &&
      (!Number.isInteger(Number(check.priority)) || Number(check.priority) <= 0)
    ) {
      errors.push(`Task ${n} feedback check ${index + 1} priority must be a positive whole number`)
    }
    if (check.stageOffer == null) return
    const stageIndex = Number(check.stageOffer.stageIndex)
    if (
      !Number.isInteger(stageIndex) ||
      stageIndex < 0 ||
      stageIndex >= (task.codeStages?.length ?? 0)
    ) {
      errors.push(
        `Task ${n} feedback check ${index + 1} references a code stage that does not exist`
      )
    }
    if (!['preview', 'replace'].includes(check.stageOffer.action)) {
      errors.push(
        `Task ${n} feedback check ${index + 1} stage offer action must be preview or replace`
      )
    }
    if (
      check.stageOffer.afterMatches != null &&
      (!Number.isInteger(Number(check.stageOffer.afterMatches)) ||
        Number(check.stageOffer.afterMatches) <= 0)
    ) {
      errors.push(
        `Task ${n} feedback check ${index + 1} stage offer threshold must be a positive whole number`
      )
    }
  })
}

function validateActivityTask(task, n, lesson, errors, warnings) {
  const activity = getTaskActivity(task)
  const result = activity?.validateTask(task, { n, lesson }) ?? {}
  errors.push(...(result.errors ?? []))
  warnings.push(...(result.warnings ?? []))
}

function taskHasStarter(task, { kind, legacy, definition }) {
  if (kind === 'information' || kind === 'activity') return true
  if (legacy) return !!legacy.hasStarter(task)
  if (!definition) return filesStarterPresent(task)
  return definition.hasStarterContent ? !!definition.hasStarterContent(task) : true
}

/**
 * Validates one (flattened) task. Returns the validation context `{ kind, legacy, usesModule,
 * moduleType, definition }` for the validator's own extras, or null when the task was skipped
 * (not an object, or the lesson is a draft). `usesModule` is true when the task runs in a
 * workspace module (code tasks and code_arrange), so the module's own rules apply to it.
 */
export function validateLessonTask(task, { n, lesson, flat, errors, warnings }) {
  if (!isPlainObject(task)) return null
  const kind = getTaskValidationKind(task)
  const legacy = getLegacyTaskValidation(task)
  const usesModule = kind === 'module' || !!legacy?.hostModule
  const moduleType = getTaskModuleType(lesson, task) ?? lesson.type
  const definition = getModuleDefinition(moduleType)

  const allowedCarrySources = getModuleCarrySourceIds(lesson, task)
  for (const field of CARRY_THROUGH_FIELDS) {
    if (task[field] != null && allowedCarrySources && !allowedCarrySources.includes(task[field])) {
      errors.push(`Task ${n} ${field} must reference an earlier task in the same lesson module`)
    }
  }

  // Missing titles are reported once, by validateDraftLessonStructure (it runs for every lesson).
  if (
    task.estimatedMinutes != null &&
    (!Number.isFinite(Number(task.estimatedMinutes)) || Number(task.estimatedMinutes) <= 0)
  ) {
    errors.push(`Task ${n} estimated time must be a positive number of minutes`)
  }
  if (task.priority != null && !isValidTaskPriority(task.priority)) {
    errors.push(`Task ${n} priority must be one of: ${TASK_PRIORITIES.join(', ')}`)
  }
  if (task.allowSharing != null) {
    if (typeof task.allowSharing !== 'boolean') {
      errors.push(`Task ${n} allowSharing must be true or false`)
    } else if (task.allowSharing && !canTaskAllowSharing(task)) {
      errors.push(`Task ${n} allowSharing is not supported on quiz or information tasks`)
    }
  }
  // showBlocks: false hides the Python editor's block brackets (src/shared/blockGuides.js).
  if (task.showBlocks != null && typeof task.showBlocks !== 'boolean') {
    errors.push(`Task ${n} showBlocks must be true or false`)
  }

  // peerHints: extra preset hints for peer help (src/shared/peerHelp.js). They reach a student
  // without the teacher checking each one, so they are authored text only, short, and few.
  if (task.peerHints != null) {
    if (
      !Array.isArray(task.peerHints) ||
      task.peerHints.some((hint) => typeof hint !== 'string' || !hint.trim())
    ) {
      errors.push(`Task ${n} peerHints must be a list of short hint texts`)
    } else if (task.peerHints.length > 6) {
      errors.push(`Task ${n} peerHints can have at most 6 hints`)
    } else if (task.peerHints.some((hint) => hint.trim().length > 60)) {
      errors.push(`Task ${n} peerHints must each be 60 characters or fewer`)
    } else if (!canTaskAllowSharing(task)) {
      errors.push(`Task ${n} peerHints is not supported on quiz or information tasks`)
    }
  }

  // taskActivity names a Lesson Format Glossary pattern (src/shared/taskActivity.js); badges read
  // it, so an unrecognised one is worth a warning (never an error: it's free text).
  if (typeof task.taskActivity === 'string' && !parseTaskActivity(task.taskActivity).known) {
    warnings.push(
      `Task ${n} taskActivity "${task.taskActivity.trim()}" is not a recognised Lesson Format Glossary pattern`
    )
  }
  validateBadgeHints(task, n, errors, warnings)

  // Drafts deliberately allow missing task-specific authoring fields; the schema/type checks
  // above (and validateDraftLessonStructure) still run so the Builder can load them safely.
  if (lesson.draft === true) return null

  validateFeedbackBasics(task, n, errors, warnings)
  if (usesModule) validateStageMetadata(task, n, errors)

  if (kind === 'information') {
    // An introduction shows the lesson's metadata and a Badge Summary the session's coding
    // moments, so neither needs an explainer.
    const explainerOptional = ['introduction', BADGE_SUMMARY_INFORMATION_TYPE].includes(
      task.informationType
    )
    if (!explainerOptional && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }
  } else if (kind === 'activity') {
    validateActivityTask(task, n, lesson, errors, warnings)
  }
  legacy?.validateTask(task, { n, moduleType, errors, warnings })
  if (usesModule) {
    definition?.validateTask(task, { n, lesson, errors, warnings })
    validateRegisteredChecks(task, n, errors, { moduleDefinition: definition, warnings })
  }

  if (kind === 'module') {
    const carryField = definition?.carryThroughField ?? 'carryCodeFrom'
    const carryFrom = task[carryField]
    if (carryFrom != null && !flat.some((candidate) => candidate?.id === carryFrom)) {
      errors.push(
        `Task ${n} references task ${carryFrom} for carry-through but that task does not exist`
      )
    }
  }

  // Modules whose students don't start in an editor (hasStarterContent: null) never warn.
  const moduleWarnsAboutStarter = !definition || definition.hasStarterContent !== null
  if (moduleWarnsAboutStarter && !taskHasStarter(task, { kind, legacy, definition })) {
    warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
  }

  return { kind, legacy, usesModule, moduleType, definition }
}

// Whether the task has a completion check worth testing (the Builder's untested-check
// reminder). Information and activity tasks never do.
export function taskHasCheckValue(task, { kind, legacy, definition }) {
  if (kind === 'information' || kind === 'activity') return false
  if (legacy?.hasCheckValue) return legacy.hasCheckValue(task)
  if (definition?.hasCheckValue) return !!definition.hasCheckValue(task)
  return codeCheckHasValue(task)
}

/**
 * Runs the shared rules over a whole lesson. Hooks add environment-specific extras:
 * - envelope(lesson, errors): extra lesson-level rules (after title, before fork);
 * - beforeTasks({ lesson, flat, errors, warnings }): once, before the per-task rules;
 * - afterTask(task, { n, kind, legacy, usesModule, moduleType, definition, lesson, flat,
 *   errors, warnings }):
 *   after each non-draft task's shared rules.
 */
export function validateLessonCore(lesson, { envelope, beforeTasks, afterTask } = {}) {
  const errors = []
  const warnings = []
  if (!isPlainObject(lesson)) {
    return { errors: ['lesson must be a JSON object'], warnings }
  }

  validateLessonEnvelope(lesson, errors, envelope)
  validateBadgeOptions(lesson, errors, warnings)
  const { tasks } = lesson
  if (!Array.isArray(tasks)) {
    errors.push('tasks is required and must be an array')
    return { errors, warnings }
  }
  validateDraftLessonStructure(lesson, errors)
  errors.push(...validateComposedStructure(lesson))
  if (tasks.length === 0) errors.push('tasks must contain at least one task or group')
  validateGroups(tasks, errors)

  const flat = flattenTasks(tasks)
  validateFirestoreDepth(lesson, flat, errors)
  beforeTasks?.({ lesson, flat, errors, warnings })
  flat.forEach((task, i) => {
    const n = i + 1
    const context = validateLessonTask(task, { n, lesson, flat, errors, warnings })
    if (context) afterTask?.(task, { ...context, n, lesson, flat, errors, warnings })
  })
  return { errors, warnings }
}
