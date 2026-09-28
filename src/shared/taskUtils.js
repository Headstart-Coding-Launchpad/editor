import { getStageRole, getStarterStages, getCompleteStage } from './taskStages.js'
import { getModuleDefinition } from '../modules/definitions.js'
import { getTaskActivity, isHostedActivityTask } from '../activities/registry.pure.js'

export {
  STAGE_ROLES,
  isValidStageRole,
  getStageRole,
  isRevealableStage,
  getRevealableStages,
  getStarterStages,
  getStarterStage,
  getCompleteStage,
  getNextRevealableStage,
} from './taskStages.js'

export function isLegacyDraftTask(task) {
  return task?.taskType === 'draft'
}

// Returns the task tree without legacy draft placeholders. These records are
// retained in stored lessons for backwards compatibility, but are not part of
// the active lesson flow.
function filterLegacyDraftTasks(tasks) {
  if (!Array.isArray(tasks)) return []
  const hasLegacyDrafts = tasks.some((item) =>
    item?.type === 'group'
      ? (Array.isArray(item.subtasks) ? item.subtasks : []).some(isLegacyDraftTask)
      : isLegacyDraftTask(item)
  )
  if (!hasLegacyDrafts) return tasks

  return tasks.flatMap((item) => {
    if (item?.type === 'group') {
      const subtasks = (Array.isArray(item.subtasks) ? item.subtasks : []).filter(
        (task) => !isLegacyDraftTask(task)
      )
      return subtasks.length > 0 ? [{ ...item, subtasks }] : []
    }
    return isLegacyDraftTask(item) ? [] : [item]
  })
}

// Expands groups to their subtasks, leaving everything else as authored. Callers that
// want the tasks a student actually sees want flattenTasks; this raw form is for code
// that must see the lesson exactly as stored (e.g. the audit trail).
export function flattenTaskTree(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).flatMap((item) =>
    item?.type === 'group' ? (Array.isArray(item.subtasks) ? item.subtasks : []) : [item]
  )
}

// Returns a flat array of active tasks, expanding groups to their subtasks.
export function flattenTasks(tasks) {
  return flattenTaskTree(filterLegacyDraftTasks(tasks))
}

export function getEstimatedMinutes(task) {
  const minutes = Number(task?.estimatedMinutes)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

export function getTotalEstimatedMinutes(tasks) {
  return flattenTasks(tasks).reduce((total, task) => total + (getEstimatedMinutes(task) ?? 0), 0)
}

export const TASK_PRIORITIES = ['core', 'optional']

export function isValidTaskPriority(priority) {
  return TASK_PRIORITIES.includes(priority)
}

export function getTaskPriority(task) {
  return isValidTaskPriority(task?.priority) ? task.priority : 'core'
}

// Workspace sharing is opt-in per task. Quiz and information tasks have no
// workspace to share, so the flag is meaningless (and rejected) on them.
export function canTaskAllowSharing(task) {
  if (!task || typeof task !== 'object') return false
  if (task.type === 'group') return false
  return (
    task.taskType !== 'quiz' && task.taskType !== 'information' && !isHostedActivityTask(task)
  )
}

export function isSharingAllowed(task) {
  return task?.allowSharing === true && canTaskAllowSharing(task)
}

export function getTaskPriorityCounts(tasks) {
  return flattenTasks(tasks).reduce(
    (counts, task) => {
      counts[getTaskPriority(task)] += 1
      return counts
    },
    { core: 0, optional: 0 }
  )
}

export function formatEstimatedMinutes(minutes) {
  if (!minutes) return 'No estimate'
  const hours = Math.floor(minutes / 60)
  const remainder = Math.round((minutes - hours * 60) * 100) / 100
  if (!hours) return `${remainder} min`
  if (!remainder) return `${hours} hr`
  return `${hours} hr ${remainder} min`
}

// Find a task by ID, searching inside groups.
export function findTaskById(tasks, id) {
  return flattenTasks(tasks).find((t) => t.id === id) ?? null
}

// Synthetic "explainer slide" pseudo-task, shown in solo-mode nav (Scratch only, for
// now) immediately before a task whose explainer is currently shrunk/hidden. It's a
// live UI reflection, never persisted, so its id only needs to be unique and
// recognisable, not stable across sessions.
const EXPLAINER_PSEUDO_PREFIX = '__explainer_slide__'

export function makeExplainerPseudoTask(task) {
  return {
    id: `${EXPLAINER_PSEUDO_PREFIX}${task.id}`,
    title: task.title,
    forTaskId: task.id,
    isExplainerPseudo: true,
  }
}

export function isExplainerPseudoTaskId(id) {
  return typeof id === 'string' && id.startsWith(EXPLAINER_PSEUDO_PREFIX)
}

// Splice a pseudo-task into a flat task array immediately before the task with id
// `beforeTaskId`. No-op (returns the original array) if that task isn't found.
export function insertPseudoTaskBefore(flatTasks, beforeTaskId, pseudoTask) {
  const index = flatTasks.findIndex((t) => t.id === beforeTaskId)
  if (index === -1) return flatTasks
  return [...flatTasks.slice(0, index), pseudoTask, ...flatTasks.slice(index)]
}

// Synthetic "lesson complete" pseudo-task, appended after the last task in solo-mode
// nav. Like the explainer pseudo-task, it's a live UI reflection only — never
// persisted — so its id only needs to be a stable, recognisable constant.
const COMPLETION_PSEUDO_ID = '__lesson_complete__'

export function makeCompletionPseudoTask() {
  return { id: COMPLETION_PSEUDO_ID, title: 'Lesson Complete', isCompletionPseudo: true }
}

export function isCompletionPseudoTaskId(id) {
  return id === COMPLETION_PSEUDO_ID
}

// Find the group containing a given task ID. Returns null for standalone tasks.
export function findGroupForTask(tasks, taskId) {
  if (!tasks) return null
  return (
    tasks.find(
      (item) => item.type === 'group' && (item.subtasks ?? []).some((t) => t.id === taskId)
    ) ?? null
  )
}

// Returns display items for the progress indicator.
// Each item is { type, id, title, taskIds }.
export function getProgressItems(tasks) {
  return filterLegacyDraftTasks(tasks).map((item) =>
    item.type === 'group'
      ? {
          type: 'group',
          id: item.id,
          title: item.title,
          taskIds: (item.subtasks ?? []).map((t) => t.id),
        }
      : { type: 'task', id: item.id, title: item.title, taskIds: [item.id] }
  )
}

// Derive boolean task-type flags from lesson and task objects.
// Pass the optional session to include isSessionSandbox in the result.
export function deriveTaskContext(lesson, task, session) {
  // moduleType is the registered module type of the (effective, per-task) lesson, or null for
  // anything else (e.g. an unresolved 'composed' lesson). The is<Type> flags are kept for
  // existing callers; prefer moduleType + the module definition for new code.
  const moduleType = getModuleDefinition(lesson?.type) ? lesson.type : null
  const isModule = (type) => moduleType === type
  const isQuiz = task?.taskType === 'quiz'
  const isInformation = task?.taskType === 'information'
  const isSessionSandbox = session?.state === 'sandbox'
  // Hosted activities (taskType 'activity') have no workspace: module flags describe the
  // surrounding lesson, not the task, so callers check isActivity before any module flag.
  const isActivity = isHostedActivityTask(task)
  return {
    moduleType,
    isPython: isModule('python'),
    isScratch: isModule('scratch'),
    isFilesystem: isModule('filesystem'),
    isElectronics: isModule('electronics'),
    isArcade: isModule('arcade'),
    isHtml: isModule('html'),
    isTurtle: isModule('turtle'),
    isDesktop: isModule('desktop'),
    isQuiz,
    isInformation,
    isActivity,
    activity: isActivity ? getTaskActivity(task) : null,
    isSessionSandbox,
  }
}

// A task has a legacy (non-stage) Complete to reset to when the module's `completeField`
// holds a value — for array fields (HTML's completeFiles), a non-empty array.
function hasLegacyComplete(task, completeField) {
  const value = completeField ? task?.[completeField] : null
  return Array.isArray(value) ? value.length > 0 : !!value
}

// Build the ordered list of remote-reset stage options for a task.
// lessonType: lesson module type, e.g. 'python' | 'html' | 'scratch' | 'filesystem' | 'electronics'
export function buildStageOptions(task, lessonType) {
  // Activities reset to their initial setup or jump to the answer (remoteResetAction
  // 'starter' / 'complete'); they have no code stages.
  if (isHostedActivityTask(task)) {
    const activity = getTaskActivity(task)
    if (!activity?.teacherEditable) return []
    return [
      { value: 'starter', label: 'Start again' },
      ...(activity.solutionState ? [{ value: 'complete', label: 'Complete (show answers)' }] : []),
    ]
  }
  // Python and HTML use the unified stage selector. Only Starter stages can
  // replace student work; Support and Complete are revealed read-only.
  const isUnified = (task?.codeStages ?? []).some((stage) =>
    ['starter', 'complete'].includes(stage?.role)
  )
  const definition = getModuleDefinition(lessonType)
  if (definition?.capabilities.unifiedStages && task?.taskType !== 'quiz' && isUnified) {
    const starters = getStarterStages(task)
    const starterOptions =
      starters.length > 0
        ? starters.map(({ stage, index }) => ({
            value: `stage_${index}`,
            label: stage.label || `Starter ${index + 1}`,
          }))
        : [{ value: 'starter', label: 'Starter' }]
    const complete = getCompleteStage(task)
    return complete
      ? [
          ...starterOptions,
          {
            value: `stage_${complete.index}`,
            label: `Complete: ${complete.stage.label || 'Solution'}`,
          },
        ]
      : starterOptions
  }

  const isQuiz = task?.taskType === 'quiz'
  const hasComplete = isQuiz ? false : hasLegacyComplete(task, definition?.completeField)

  const codeStages = isQuiz ? [] : (task?.codeStages ?? [])
  const starterLabel = definition?.stageLabels.starterLabel ?? 'Starter'
  const completeLabel = definition?.stageLabels.completeLabel ?? 'Complete'

  const opts = [{ value: 'starter', label: starterLabel }]
  codeStages.forEach((stage, i) => {
    const role = getStageRole(stage)
    const displayRole = ['core', 'extension'].includes(stage?.role) ? stage.role : role
    const rolePrefix = displayRole === 'support' ? '' : `${displayRole}: `
    opts.push({ value: `stage_${i}`, label: `${rolePrefix}${stage.label || `Stage ${i + 1}`}` })
  })
  if (hasComplete) opts.push({ value: 'complete', label: completeLabel })
  return opts
}

// Filter tasks (including groups) to only those visible in a given mode.
// mode: 'live' | 'solo' | null (null = no filtering, return all)
// A task is included when taskMode is absent, 'both', or matches the current mode.
export function filterTasksByMode(tasks, mode) {
  const activeTasks = filterLegacyDraftTasks(tasks)
  if (!mode) return activeTasks
  const allowed = (t) => !t.taskMode || t.taskMode === 'both' || t.taskMode === mode
  const result = []
  for (const item of activeTasks) {
    if (item.type === 'group') {
      const subtasks = (item.subtasks ?? []).filter(allowed)
      if (subtasks.length > 0) result.push({ ...item, subtasks })
    } else if (allowed(item)) {
      result.push(item)
    }
  }
  return result
}

// Update a task anywhere in the lesson tasks array (including inside groups).
export function updateTaskInTasks(tasks, updatedTask) {
  return tasks.map((item) => {
    if (item.type === 'group') {
      if ((item.subtasks ?? []).some((t) => t.id === updatedTask.id)) {
        return {
          ...item,
          subtasks: item.subtasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        }
      }
      return item
    }
    return item.id === updatedTask.id ? updatedTask : item
  })
}

// Merge an updated task into the tasks array. `_customTitle` is legacy metadata
// from when grouped subtasks were auto-named from their parent group.
// selectedTaskGroup/selectedTask are null for standalone (non-subtask) tasks.
export function applyTaskUpdate(tasks, selectedTaskGroup, selectedTask, updatedTask) {
  const finalUpdated = selectedTaskGroup ? stripLegacyCustomTitle(updatedTask) : updatedTask
  return updateTaskInTasks(tasks, finalUpdated)
}

function stripLegacyCustomTitle(task) {
  if (!task || !Object.prototype.hasOwnProperty.call(task, '_customTitle')) return task
  const { _customTitle, ...rest } = task
  return rest
}

// Backwards-compatible group normalizer. Grouped subtask titles are now
// independent, so this only removes obsolete `_customTitle` metadata.
export function updateSubtaskTitles(tasks) {
  if (!tasks) return []
  return tasks.map((item) => {
    if (item.type === 'group') {
      const subtasks = (item.subtasks ?? []).map((subtask) => {
        return stripLegacyCustomTitle(subtask)
      })

      const subtasksChanged = subtasks.some((s, idx) => s !== item.subtasks?.[idx])
      if (subtasksChanged) {
        return { ...item, subtasks }
      }
      return item
    }
    return item
  })
}
