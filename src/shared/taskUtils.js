// Returns a flat array of all tasks, expanding groups to their subtasks.
export function flattenTasks(tasks) {
  if (!tasks) return []
  return tasks.flatMap(item =>
    item.type === 'group' ? (item.subtasks ?? []) : [item]
  )
}

export function getEstimatedMinutes(task) {
  const minutes = Number(task?.estimatedMinutes)
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null
}

export function getTotalEstimatedMinutes(tasks) {
  return flattenTasks(tasks).reduce((total, task) => total + (getEstimatedMinutes(task) ?? 0), 0)
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
  if (!tasks) return []
  return tasks.map(item =>
    item.type === 'group'
      ? { type: 'group', id: item.id, title: item.title, taskIds: (item.subtasks ?? []).map(t => t.id) }
      : { type: 'task', id: item.id, title: item.title, taskIds: [item.id] }
  )
}

// Derive boolean task-type flags from lesson and task objects.
export function deriveTaskContext(lesson, task) {
  const isPython     = lesson?.type === 'python'
  const isScratch    = lesson?.type === 'scratch'
  const isFilesystem = lesson?.type === 'filesystem'
  const isHtml       = !isPython && !isScratch && !isFilesystem
  const isQuiz        = task?.taskType === 'quiz'
  const isInformation = task?.taskType === 'information'
  return { isPython, isScratch, isFilesystem, isHtml, isQuiz, isInformation }
}

// Build the ordered list of remote-reset stage options for a task.
// lessonType: 'python' | 'html' | 'scratch' | 'filesystem'
export function buildStageOptions(task, lessonType) {
  const isScratch    = lessonType === 'scratch'
  const isFilesystem = lessonType === 'filesystem'
  const isQuiz       = task?.taskType === 'quiz'

  const hasComplete = isQuiz
    ? false
    : lessonType === 'python'
    ? !!task?.completeCode
    : isScratch
    ? !!task?.completeBlocks
    : isFilesystem
    ? !!task?.completeFs
    : (task?.completeFiles?.length > 0)

  const codeStages = isQuiz ? [] : (task?.codeStages ?? [])
  const starterLabel  = isScratch ? 'Starter blocks'  : isFilesystem ? 'Starter folders'  : 'Starter code'
  const completeLabel = isScratch ? 'Complete blocks' : isFilesystem ? 'Complete folders' : 'Complete code'

  const opts = [{ value: 'starter', label: starterLabel }]
  codeStages.forEach((stage, i) => {
    opts.push({ value: `stage_${i}`, label: stage.label || `Stage ${i + 1}` })
  })
  if (hasComplete) opts.push({ value: 'complete', label: completeLabel })
  return opts
}

// Filter tasks (including groups) to only those visible in a given mode.
// mode: 'live' | 'solo' | null (null = no filtering, return all)
// A task is included when taskMode is absent, 'both', or matches the current mode.
export function filterTasksByMode(tasks, mode) {
  if (!tasks || !mode) return tasks ?? []
  const allowed = t => !t.taskMode || t.taskMode === 'both' || t.taskMode === mode
  const result = []
  for (const item of tasks) {
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

