// Map a stored task to its activity id. Stored lesson formats never change: legacy quiz and
// code_arrange tasks keep their taskType/quizType, and new activities use
// `taskType: 'activity'` + `activityType`. Pure.

export const LEGACY_QUIZ_TYPES = [
  'multiple_choice',
  'match',
  'fill_blank',
  'short_answer',
  'confidence',
  'poll',
]

export const UNKNOWN_ACTIVITY_ID = 'unknown'

// The stored taskType of a legacy quiz (its sub-type is `quizType`).
export const LEGACY_QUIZ_TASK_TYPE = 'quiz'

export function getActivityId(task) {
  if (!task) return null
  switch (task.taskType) {
    case LEGACY_QUIZ_TASK_TYPE:
      return `quiz_${task.quizType ?? 'multiple_choice'}`
    case 'code_arrange':
      return 'code_arrange'
    case 'activity':
      return typeof task.activityType === 'string' && task.activityType
        ? task.activityType
        : UNKNOWN_ACTIVITY_ID
    default:
      return null
  }
}

// Whether a task is stored in the legacy quiz format (`taskType: 'quiz'`), whatever its
// quizType — including a quizType this bundle doesn't know (which resolves to the unknown
// fallback, so isLegacyQuizTask in ./registry.pure.js is false for it). The Builder's export
// normalisation uses this for every stored quiz.
export function isLegacyQuizRecord(task) {
  return task?.taskType === LEGACY_QUIZ_TASK_TYPE
}

export function isActivityTask(task) {
  return getActivityId(task) !== null
}
