// Where "Next" takes the whole class: the presentation window's Next, the countdown's
// "Next task" (teacher view and presentation window). With the tutor's "Skip optional tasks"
// switch on (session.skipOptionalTasks), tasks whose priority is 'optional' are jumped over.
// Moving the class to a task the tutor picked themselves ("Move class here") never skips.
import { getTaskPriority } from './taskUtils.js'

function isOptional(task) {
  return getTaskPriority(task) === 'optional'
}

/**
 * The id of the task after `currentTaskId` in `flatTasks` (already flattened and filtered to
 * the live tasks), or null when there is none. `skipOptional` jumps over optional tasks.
 */
export function nextClassTaskId(flatTasks, currentTaskId, { skipOptional = false } = {}) {
  const tasks = Array.isArray(flatTasks) ? flatTasks : []
  const index = tasks.findIndex((task) => String(task.id) === String(currentTaskId))
  for (let i = index + 1; i < tasks.length; i += 1) {
    if (skipOptional && isOptional(tasks[i])) continue
    return tasks[i].id
  }
  return null
}

/** How many optional tasks lie ahead of `currentTaskId` (what Next will jump over). */
export function countOptionalAhead(flatTasks, currentTaskId) {
  const tasks = Array.isArray(flatTasks) ? flatTasks : []
  const index = tasks.findIndex((task) => String(task.id) === String(currentTaskId))
  return tasks.slice(index + 1).filter(isOptional).length
}

/** How many optional tasks the lesson has. */
export function countOptionalTasks(flatTasks) {
  return (Array.isArray(flatTasks) ? flatTasks : []).filter(isOptional).length
}

/**
 * "Task 3 of 6": the class's place counting only the tasks Next stops on (all tasks when
 * skipping is off). An optional task the class was moved to by hand still counts as its place.
 */
export function classTaskPosition(flatTasks, currentTaskId, { skipOptional = false } = {}) {
  const tasks = Array.isArray(flatTasks) ? flatTasks : []
  const counted = skipOptional
    ? tasks.filter((task) => !isOptional(task) || String(task.id) === String(currentTaskId))
    : tasks
  const index = counted.findIndex((task) => String(task.id) === String(currentTaskId))
  return { number: index + 1, total: counted.length }
}
