// Fallback for a task whose activityType this bundle doesn't know (a lesson authored against a
// newer version, or a typo). It renders a "not available" notice and is never graded, so an
// old cached tab degrades safely instead of treating the task as a broken code task.
import { defineActivity } from '../defineActivity.js'

export default defineActivity({
  id: 'unknown',
  label: 'Unavailable activity',
  category: 'computing',
  description: 'Shown when a lesson uses an activity this version of the app does not know.',
  completion: 'none',
  defaultTask: (prev = {}) => ({ ...prev }),
  validateTask: (task, { n } = {}) => ({
    errors: [
      `Task ${n}: unknown activityType "${task?.activityType ?? ''}". Run \`lessons capabilities\` to list activities.`,
    ],
    warnings: [],
  }),
  initialState: () => null,
  grade: () => ({ passed: false, suggestion: null }),
  isGraded: () => false,
  teacherEditable: false,
  storage: { persist: false, filename: null },
  // Reports name the activityType the lesson asked for, not the fallback's id.
  report: {
    typeFields: (task) => ({ taskType: 'activity', activityType: task?.activityType ?? 'unknown' }),
    normalizeSubmission: (task, submission) => submission ?? null,
    summaryFields: () => ({}),
  },
})
