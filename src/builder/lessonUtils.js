import { CARRY_THROUGH_FIELDS, getModuleAuthoring } from '../modules/definitions'
import { isLegacyQuizRecord } from '../activities/resolve.js'
import { validateLessonCore, taskHasCheckValue } from '../shared/lessonValidation'

// Quiz helpers now live with the shared legacy-activity validation; re-exported for existing
// Builder imports.
export { quizHasCheckValue, quizHasStarter } from '../activities/legacyValidation'

const SCRATCH_STARTER_SPRITE_STATE_FIELDS = [
  'x',
  'y',
  'size',
  'direction',
  'visible',
  'rotationStyle',
  'costume',
]

function describeTaskForWarning(task, index) {
  return `task ${index + 1}${task.title ? ` "${task.title}"` : ''}`
}

function warnDuplicateTaskIds(flat, warnings) {
  const firstById = new Map()
  flat.forEach((task, index) => {
    if (
      !task ||
      typeof task !== 'object' ||
      Array.isArray(task) ||
      task.id == null ||
      task.id === ''
    )
      return
    const key = String(task.id)
    const first = firstById.get(key)
    if (first) {
      warnings.push(
        `Task ID ${key} is used by ${describeTaskForWarning(first.task, first.index)} and ${describeTaskForWarning(task, index)} - renumber task IDs before publishing`
      )
    } else {
      firstById.set(key, { task, index })
    }
  })
}

export function copyScratchSpriteStateToStarters(sprites, spriteStates) {
  return sprites.map((sprite) => {
    const state = spriteStates?.[sprite.id]
    if (!state) return { ...sprite }

    const next = { ...sprite }
    for (const field of SCRATCH_STARTER_SPRITE_STATE_FIELDS) {
      if (state[field] !== undefined) next[field] = state[field]
    }
    return next
  })
}

// "Reset to starter code": the module's authoring hook (nothing for an unregistered type).
export function copyStarterToComplete(task, lessonType) {
  return getModuleAuthoring(lessonType)?.copyStarterToComplete(task) ?? {}
}

// Builder lesson validation: the shared core (src/shared/lessonValidation.js — the same rules
// and wording as the CLI) plus the Builder's own extras (ADR 0008):
// - duplicate task id warnings (the Builder renumbers ids on export);
// - module rules that need browser APIs (validateTaskInBrowser, e.g. Scratch toolbox XML);
// - the untested-check reminder (`_checkTested` is Builder editing state).
export function validateLesson(lesson) {
  return validateLessonCore(lesson, {
    beforeTasks: ({ flat, warnings }) => warnDuplicateTaskIds(flat, warnings),
    afterTask: (task, context) => {
      const { n, usesModule, definition, errors, warnings } = context
      if (usesModule) definition?.validateTaskInBrowser?.(task, { n, errors, warnings })
      if (taskHasCheckValue(task, context) && !task._checkTested) {
        warnings.push(
          `Task ${n} has a completion check that hasn't been tested — run the task to verify it`
        )
      }
    },
  })
}

export function renumberTasks(tasks) {
  const idMap = new Map()
  let nextId = 1

  function assignIds(items) {
    return (items ?? []).map((item) => {
      if (item.type === 'group') {
        return { ...item, subtasks: assignIds(item.subtasks ?? []) }
      }
      const oldKey = String(item.id)
      const newId = nextId++
      if (!idMap.has(oldKey)) idMap.set(oldKey, newId)
      return { ...item, id: newId }
    })
  }

  function updateCarryReferences(items) {
    return items.map((item) => {
      if (item.type === 'group') {
        return { ...item, subtasks: updateCarryReferences(item.subtasks ?? []) }
      }
      const next = { ...item }
      for (const field of CARRY_THROUGH_FIELDS) {
        if (next[field] == null) continue
        const mapped = idMap.get(String(next[field]))
        if (mapped != null) next[field] = mapped
      }
      return next
    })
  }

  return updateCarryReferences(assignIds(tasks))
}

export function normalizeTasksForExport(tasks, { preserveIds = false } = {}) {
  let counter = 0
  const idMap = {}
  function assignIds(items) {
    for (const item of items) {
      if (item.type === 'group') assignIds(item.subtasks ?? [])
      else idMap[item.id] = preserveIds ? item.id : ++counter
    }
  }
  assignIds(tasks)

  function normalizeCheckForExport(check) {
    const next = { ...check }
    if (next.hint != null) {
      const hint = String(next.hint).trim()
      if (hint) next.hint = hint
      else delete next.hint
    }
    return next
  }

  function normalizeTask(task) {
    if (task.taskType === 'information') {
      const exported = {
        id: idMap[task.id],
        taskType: 'information',
        title: task.title,
        explainer: task.explainer ?? '',
      }
      if (task.estimatedMinutes != null) exported.estimatedMinutes = task.estimatedMinutes
      if (task.priority != null) exported.priority = task.priority
      if ((task.informationType ?? 'standard') !== 'standard')
        exported.informationType = task.informationType
      if (task.leftContent) exported.leftContent = task.leftContent
      if (task.taskMode && task.taskMode !== 'both') exported.taskMode = task.taskMode
      // Authoring metadata is intentionally retained for all task formats.
      if (task.intent != null) exported.intent = task.intent
      if (task.taskActivity != null) exported.taskActivity = task.taskActivity
      if (task.intentLastChangedAt != null) exported.intentLastChangedAt = task.intentLastChangedAt
      if (task.taskLastChangedAt != null) exported.taskLastChangedAt = task.taskLastChangedAt
      return exported
    }

    const { _checkTested, _customTitle, ...rest } = task
    const exported = { ...rest, id: idMap[task.id] }
    if (exported.copyCode != null && !String(exported.copyCode).trim()) delete exported.copyCode
    if (isLegacyQuizRecord(exported)) delete exported.copyCode
    if (exported.taskMode === 'both') delete exported.taskMode
    if (exported.carryCodeFrom != null)
      exported.carryCodeFrom = idMap[exported.carryCodeFrom] ?? exported.carryCodeFrom
    if (exported.carryBlocksFrom != null)
      exported.carryBlocksFrom = idMap[exported.carryBlocksFrom] ?? exported.carryBlocksFrom
    if (exported.carryFsFrom != null)
      exported.carryFsFrom = idMap[exported.carryFsFrom] ?? exported.carryFsFrom
    if (exported.carryCircuitFrom != null)
      exported.carryCircuitFrom = idMap[exported.carryCircuitFrom] ?? exported.carryCircuitFrom
    if (Array.isArray(exported.check)) exported.check = exported.check.map(normalizeCheckForExport)
    else if (exported.check) exported.check = normalizeCheckForExport(exported.check)
    if (Array.isArray(exported.feedbackChecks))
      exported.feedbackChecks = exported.feedbackChecks.map(normalizeCheckForExport)
    else if (exported.feedbackChecks)
      exported.feedbackChecks = normalizeCheckForExport(exported.feedbackChecks)
    delete exported.incorrectChecks
    if (Array.isArray(exported.options)) {
      exported.options = exported.options.map((option) => {
        const next = { ...option }
        if (next.feedback != null) {
          const feedback = String(next.feedback).trim()
          if (feedback) next.feedback = feedback
          else delete next.feedback
        }
        return next
      })
    }
    return exported
  }

  return tasks.map((item) =>
    item.type === 'group'
      ? {
          id: item.id,
          type: 'group',
          title: item.title,
          ...(item.moduleId ? { moduleId: item.moduleId } : {}),
          ...(item.moduleType ? { moduleType: item.moduleType } : {}),
          ...(item.sandbox ? { sandbox: item.sandbox } : {}),
          subtasks: (item.subtasks ?? []).map(normalizeTask),
        }
      : normalizeTask(item)
  )
}
