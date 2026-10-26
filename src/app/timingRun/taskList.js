import { flattenTasks, getEstimatedMinutes } from '../../shared/taskUtils.js'
import { getTaskModuleType } from '../../shared/composedLesson.js'

/** The lesson's tasks in order, as the timing run records them. */
export function buildTimingTaskList(lesson) {
  return flattenTasks(lesson?.tasks ?? []).map((task) => ({
    taskId: task.id,
    title: task.title ?? '',
    type:
      task.taskType === 'activity'
        ? `activity:${task.activityType ?? 'unknown'}`
        : (task.taskType ?? getTaskModuleType(lesson, task) ?? lesson?.type ?? null),
    estimatedMinutes: getEstimatedMinutes(task),
  }))
}
