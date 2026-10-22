// Must-see tasks: a task with `mustSee: true` is one the tutor shouldn't skip (e.g. the task where
// students run code to see an error on purpose). When the tutor moves the class forward past one
// the class has not been on yet, TeacherView asks first. "Been on it" is the session's
// `taskStartTimes/{taskId}`, which setTaskId (and startSession, for the first task) writes when a
// task becomes current, so being on a must-see task once clears the warning.

/**
 * The first must-see task the class would skip by moving from `fromTaskId` to `toTaskId`, or null.
 * Only forward moves are checked, and only tasks strictly between the two count (the target
 * itself becomes current; the task being left has been current).
 *
 * @param {object[]} flatTasks the lesson's tasks in order, groups flattened
 * @param {string|number} fromTaskId the class's current task
 * @param {string|number} toTaskId where the tutor is moving the class
 * @param {object} [taskStartTimes] session.taskStartTimes
 */
export function findSkippedMustSeeTask(flatTasks, fromTaskId, toTaskId, taskStartTimes) {
  const tasks = Array.isArray(flatTasks) ? flatTasks : []
  const from = tasks.findIndex((t) => String(t.id) === String(fromTaskId))
  const to = tasks.findIndex((t) => String(t.id) === String(toTaskId))
  if (from < 0 || to < 0 || to <= from) return null
  for (let i = from + 1; i < to; i++) {
    const task = tasks[i]
    if (task?.mustSee === true && !taskStartTimes?.[task.id]) return task
  }
  return null
}
