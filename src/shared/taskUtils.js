export function isLegacyDraftTask(task) {
  return task?.taskType === 'draft'
}

// Returns the task tree without legacy draft placeholders. These records are
// retained in stored lessons for backwards compatibility, but are not part of
// the active lesson flow.
export function filterLegacyDraftTasks(tasks) {
  if (!Array.isArray(tasks)) return []
  const hasLegacyDrafts = tasks.some(item =>
    item?.type === 'group'
      ? (Array.isArray(item.subtasks) ? item.subtasks : []).some(isLegacyDraftTask)
      : isLegacyDraftTask(item)
  )
  if (!hasLegacyDrafts) return tasks

  return tasks.flatMap(item => {
    if (item?.type === 'group') {
      const subtasks = (Array.isArray(item.subtasks) ? item.subtasks : []).filter(task => !isLegacyDraftTask(task))
      return subtasks.length > 0 ? [{ ...item, subtasks }] : []
    }
    return isLegacyDraftTask(item) ? [] : [item]
  })
}

// Returns a flat array of active tasks, expanding groups to their subtasks.
export function flattenTasks(tasks) {
  return filterLegacyDraftTasks(tasks).flatMap(item =>
    item?.type === 'group' ? (Array.isArray(item.subtasks) ? item.subtasks : []) : [item]
  )
}

export function getEstimatedMinutes(task) {
  const minutes = Number(task?.estimatedMinutes)
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null
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

export const STAGE_ROLES = ['support', 'core', 'extension', 'solution']

export function isValidStageRole(role) {
  return STAGE_ROLES.includes(role)
}

export function getStageRole(stage) {
  return isValidStageRole(stage?.role) ? stage.role : 'support'
}

export function isRevealableStage(stage) {
  return !!stage?.revealable
}

export function getRevealableStages(task) {
  return (task?.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => isRevealableStage(stage))
}

// Returns the revealable stage after the latest stage already shown. This keeps
// support references progressing in authored stage order, even when
// non-revealable stages appear between them.
export function getNextRevealableStage(task, revealedStageIndexes = []) {
  const revealed = revealedStageIndexes.map(Number).filter(Number.isInteger)
  const latestRevealedIndex = revealed.length ? Math.max(...revealed) : -1
  return getRevealableStages(task).find(({ index }) => index > latestRevealedIndex) ?? null
}

export function getTaskPriorityCounts(tasks) {
  return flattenTasks(tasks).reduce((counts, task) => {
    counts[getTaskPriority(task)] += 1
    return counts
  }, { core: 0, optional: 0 })
}

export function formatEstimatedMinutes(minutes) {
  if (!minutes) return 'No estimate'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder} min`
  if (!remainder) return `${hours} hr`
  return `${hours} hr ${remainder} min`
}

// Find a task by ID, searching inside groups.
export function findTaskById(tasks, id) {
  return flattenTasks(tasks).find(t => t.id === id) ?? null
}

// Find the group containing a given task ID. Returns null for standalone tasks.
export function findGroupForTask(tasks, taskId) {
  if (!tasks) return null
  return tasks.find(
    item => item.type === 'group' && (item.subtasks ?? []).some(t => t.id === taskId)
  ) ?? null
}

// Returns display items for the progress indicator.
// Each item is { type, id, title, taskIds }.
export function getProgressItems(tasks) {
  return filterLegacyDraftTasks(tasks).map(item =>
    item.type === 'group'
      ? { type: 'group', id: item.id, title: item.title, taskIds: (item.subtasks ?? []).map(t => t.id) }
      : { type: 'task', id: item.id, title: item.title, taskIds: [item.id] }
  )
}

// Derive boolean task-type flags from lesson and task objects.
// Pass the optional session to include isSessionSandbox in the result.
export function deriveTaskContext(lesson, task, session) {
  const isPython     = lesson?.type === 'python'
  const isScratch    = lesson?.type === 'scratch'
  const isFilesystem = lesson?.type === 'filesystem'
  const isElectronics = lesson?.type === 'electronics'
  const isHtml       = lesson?.type === 'html'
  const isQuiz        = task?.taskType === 'quiz'
  const isInformation = task?.taskType === 'information'
  const isSessionSandbox = session?.state === 'sandbox'
  return { isPython, isScratch, isFilesystem, isElectronics, isHtml, isQuiz, isInformation, isSessionSandbox }
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
    hasComplete: task => task?.completeFiles?.length > 0,
    stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  },
}

// Build the ordered list of remote-reset stage options for a task.
// lessonType: lesson module type, e.g. 'python' | 'html' | 'scratch' | 'filesystem' | 'electronics'
export function buildStageOptions(task, lessonType) {
  const metadata = STAGE_OPTION_METADATA[lessonType]
  const isQuiz       = task?.taskType === 'quiz'

  const hasComplete = isQuiz
    ? false
    : metadata?.hasComplete
    ? metadata.hasComplete(task)
    : metadata?.completeField
    ? !!task?.[metadata.completeField]
    : false

  const codeStages = isQuiz ? [] : (task?.codeStages ?? [])
  const starterLabel  = metadata?.stageLabels?.starterLabel ?? 'Starter'
  const completeLabel = metadata?.stageLabels?.completeLabel ?? 'Complete'

  const opts = [{ value: 'starter', label: starterLabel }]
  codeStages.forEach((stage, i) => {
    const role = getStageRole(stage)
    const rolePrefix = role === 'support' ? '' : `${role}: `
    const revealSuffix = isRevealableStage(stage) ? ' (revealable)' : ''
    opts.push({ value: `stage_${i}`, label: `${rolePrefix}${stage.label || `Stage ${i + 1}`}${revealSuffix}` })
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
  const allowed = t => !t.taskMode || t.taskMode === 'both' || t.taskMode === mode
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
  return tasks.map(item => {
    if (item.type === 'group') {
      if ((item.subtasks ?? []).some(t => t.id === updatedTask.id)) {
        return { ...item, subtasks: item.subtasks.map(t => t.id === updatedTask.id ? updatedTask : t) }
      }
      return item
    }
    return item.id === updatedTask.id ? updatedTask : item
  })
}

// Merge an updated task into the tasks array, tracking whether a subtask's
// title was manually overridden (vs. left to the group's auto-title pattern).
// selectedTaskGroup/selectedTask are null for standalone (non-subtask) tasks.
export function applyTaskUpdate(tasks, selectedTaskGroup, selectedTask, updatedTask) {
  let finalUpdated = updatedTask
  if (selectedTaskGroup) {
    if ('_customTitle' in updatedTask && !updatedTask._customTitle) {
      const { _customTitle, ...withoutFlag } = finalUpdated
      finalUpdated = withoutFlag
    } else if (updatedTask.title !== selectedTask.title) {
      finalUpdated = { ...updatedTask, _customTitle: true }
    }
  }
  return updateTaskInTasks(tasks, finalUpdated)
}

// Ensure the titles of all subtasks in all groups match their group's title and index.
// Subtasks with _customTitle:true are skipped — their title was manually set.
// The "N" counter only increments for non-custom subtasks, so:
//   "Group - 1" / "My Custom Name" / "Group - 2"
export function updateSubtaskTitles(tasks) {
  if (!tasks) return []
  return tasks.map(item => {
    if (item.type === 'group') {
      let defaultCount = 0
      const subtasks = (item.subtasks ?? []).map(subtask => {
        if (subtask._customTitle) return subtask
        defaultCount++
        const expectedTitle = item.title ? `${item.title} - ${defaultCount}` : subtask.title
        if (subtask.title !== expectedTitle) {
          return { ...subtask, title: expectedTitle }
        }
        return subtask
      })

      const subtasksChanged = subtasks.some((s, idx) => s !== (item.subtasks?.[idx]))
      if (subtasksChanged) {
        return { ...item, subtasks }
      }
      return item
    }
    return item
  })
}

