export function isLegacyDraftTask(task) {
  return task?.taskType === 'draft'
}

// Returns the task tree without legacy draft placeholders. These records are
// retained in stored lessons for backwards compatibility, but are not part of
// the active lesson flow.
export function filterLegacyDraftTasks(tasks) {
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

// Returns a flat array of active tasks, expanding groups to their subtasks.
export function flattenTasks(tasks) {
  return filterLegacyDraftTasks(tasks).flatMap((item) =>
    item?.type === 'group' ? (Array.isArray(item.subtasks) ? item.subtasks : []) : [item]
  )
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

// Code stages now have one purpose each. `core`, `extension`, and `solution`
// remain understood so existing lessons keep loading, but the builder only
// creates the three roles below.
export const STAGE_ROLES = ['starter', 'support', 'complete']
const LEGACY_STAGE_ROLE_ALIASES = {
  core: 'support',
  extension: 'support',
  solution: 'complete',
}

export function isValidStageRole(role) {
  return (
    STAGE_ROLES.includes(role) ||
    Object.prototype.hasOwnProperty.call(LEGACY_STAGE_ROLE_ALIASES, role)
  )
}

export function getStageRole(stage) {
  if (LEGACY_STAGE_ROLE_ALIASES[stage?.role]) return LEGACY_STAGE_ROLE_ALIASES[stage.role]
  return isValidStageRole(stage?.role) ? stage.role : 'support'
}

export function isRevealableStage(stage) {
  return getStageRole(stage) === 'support'
}

export function getRevealableStages(task) {
  return (task?.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => isRevealableStage(stage))
}

export function getStagesByRole(task, role) {
  return (task?.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => getStageRole(stage) === role)
}

export function getStarterStages(task) {
  return getStagesByRole(task, 'starter')
}

export function getStarterStage(task) {
  return getStarterStages(task)[0] ?? null
}

export function getCompleteStage(task) {
  return getStagesByRole(task, 'complete')[0] ?? null
}

// Returns the next Support stage after the latest stage already shown. This
// keeps support references progressing in authored stage order.
export function getNextRevealableStage(task, revealedStageIndexes = []) {
  const revealed = revealedStageIndexes.map(Number).filter(Number.isInteger)
  const latestRevealedIndex = revealed.length ? Math.max(...revealed) : -1
  return getRevealableStages(task).find(({ index }) => index > latestRevealedIndex) ?? null
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
export const EXPLAINER_PSEUDO_PREFIX = '__explainer_slide__'

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
  const isPython = lesson?.type === 'python'
  const isScratch = lesson?.type === 'scratch'
  const isFilesystem = lesson?.type === 'filesystem'
  const isElectronics = lesson?.type === 'electronics'
  const isArcade = lesson?.type === 'arcade'
  const isHtml = lesson?.type === 'html'
  const isQuiz = task?.taskType === 'quiz'
  const isInformation = task?.taskType === 'information'
  const isSessionSandbox = session?.state === 'sandbox'
  return {
    isPython,
    isScratch,
    isFilesystem,
    isElectronics,
    isArcade,
    isHtml,
    isQuiz,
    isInformation,
    isSessionSandbox,
  }
}

const STAGE_OPTION_METADATA = {
  python: {
    completeField: 'completeCode',
    stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  },
  scratch: {
    completeField: 'completeBlocks',
    stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  },
  filesystem: {
    completeField: 'completeFs',
    stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  },
  electronics: {
    completeField: 'completeCircuit',
    stageLabels: { starterLabel: 'Starter board', completeLabel: 'Complete board' },
  },
  html: {
    hasComplete: (task) => task?.completeFiles?.length > 0,
    stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  },
}

// Build the ordered list of remote-reset stage options for a task.
// lessonType: lesson module type, e.g. 'python' | 'html' | 'scratch' | 'filesystem' | 'electronics'
export function buildStageOptions(task, lessonType) {
  // Python and HTML use the unified stage selector. Only Starter stages can
  // replace student work; Support and Complete are revealed read-only.
  const isUnified = (task?.codeStages ?? []).some((stage) =>
    ['starter', 'complete'].includes(stage?.role)
  )
  if (
    ['python', 'html', 'arcade', 'electronics', 'scratch'].includes(lessonType) &&
    task?.taskType !== 'quiz' &&
    isUnified
  ) {
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

  const metadata = STAGE_OPTION_METADATA[lessonType]
  const isQuiz = task?.taskType === 'quiz'

  const hasComplete = isQuiz
    ? false
    : metadata?.hasComplete
      ? metadata.hasComplete(task)
      : metadata?.completeField
        ? !!task?.[metadata.completeField]
        : false

  const codeStages = isQuiz ? [] : (task?.codeStages ?? [])
  const starterLabel = metadata?.stageLabels?.starterLabel ?? 'Starter'
  const completeLabel = metadata?.stageLabels?.completeLabel ?? 'Complete'

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
