// What the badge rules need to know about a lesson's tasks, resolved once per evaluation through
// the shared task utilities (never `lesson.type`, so composed lessons use each task's own
// module). Pure and Node-safe.
import { flattenTasks, getProgressItems } from '../shared/taskUtils.js'
import { getTaskModuleType, isCodeTask } from '../shared/composedLesson.js'
import { getTaskActivityPatternId } from '../shared/taskActivity.js'
import { getQuizActivityDefinitions, getTaskActivity } from '../activities/registry.pure.js'

// Graded quizzes for 🎯 Quiz Master: the quiz activities' own `isGraded` (multiple choice, match,
// fill in the blanks, and short answer with a check; never a confidence check).
export function isGradedQuizTask(task) {
  const activity = getTaskActivity(task)
  const isQuiz = getQuizActivityDefinitions().some((quiz) => quiz.id === activity?.id)
  return isQuiz && !!activity.isGraded(task)
}

function hintList(task, key) {
  const list = task?.badgeHints?.[key]
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []
}

/**
 * @typedef {object} BadgeTaskInfo
 * @property {object} task the stored task
 * @property {string|number} id
 * @property {number} order position in the flattened lesson (0-based)
 * @property {string} title the task title, or "Task n"
 * @property {string|null} pattern the taskActivity pattern id (src/shared/taskActivity.js)
 * @property {string|null} moduleType the task's effective module type
 * @property {boolean} isCode a code or code_arrange task (not information, quiz or activity)
 * @property {boolean} isGradedQuiz
 * @property {string[]} suggest badgeHints.suggest
 * @property {string[]} suppress badgeHints.suppress
 */

/**
 * @returns {{ tasks: BadgeTaskInfo[], byId: Map<string, BadgeTaskInfo>,
 *   groups: { id, title, taskIds: string[] }[], get(taskId): BadgeTaskInfo|null }}
 */
export function buildBadgeLessonIndex(lesson) {
  const tasks = flattenTasks(lesson?.tasks ?? []).map((task, order) => ({
    task,
    id: task.id,
    order,
    title: String(task.title ?? '').trim() || `Task ${order + 1}`,
    pattern: getTaskActivityPatternId(task),
    moduleType: getTaskModuleType(lesson, task),
    isCode: isCodeTask(task),
    isGradedQuiz: isGradedQuizTask(task),
    suggest: hintList(task, 'suggest'),
    suppress: hintList(task, 'suppress'),
  }))
  const byId = new Map(tasks.map((info) => [String(info.id), info]))
  const groups = getProgressItems(lesson?.tasks ?? [])
    .filter((item) => item.type === 'group')
    .map((item) => ({
      id: item.id,
      title: String(item.title ?? '').trim() || 'Quiz',
      taskIds: item.taskIds.map(String),
    }))
  return {
    tasks,
    byId,
    groups,
    get: (taskId) => (taskId == null ? null : (byId.get(String(taskId)) ?? null)),
  }
}

// Whether `badgeId` may be suggested from this task (badgeHints.suppress).
export function taskAllowsBadge(info, badgeId) {
  return !!info && !info.suppress.includes(badgeId)
}

// Whether this task is one of the badge's trigger tasks: its pattern is one of `patterns`, or
// badgeHints.suggest names the badge, and badgeHints.suppress doesn't.
export function taskTriggersBadge(info, badgeId, patterns) {
  if (!taskAllowsBadge(info, badgeId)) return false
  return info.suggest.includes(badgeId) || (info.pattern != null && patterns.includes(info.pattern))
}
