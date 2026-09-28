// Map a stored task to its activity id. Stored lesson formats never change: legacy quiz and
// code_arrange tasks keep their taskType/quizType, and new activities use
// `taskType: 'activity'` + `activityType`. Pure.

export const LEGACY_QUIZ_TYPES = [
  'multiple_choice',
  'match',
  'fill_blank',
  'short_answer',
  'confidence',
]

export const UNKNOWN_ACTIVITY_ID = 'unknown'

export function getActivityId(task) {
  if (!task) return null
  switch (task.taskType) {
    case 'quiz':
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

export function isActivityTask(task) {
  return getActivityId(task) !== null
}
