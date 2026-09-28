// Builder task-format conversions shared by TaskEditor (plan step 2.4). Switching a task's
// format keeps what every task has (title, description, explainer, authoring metadata...) and
// lets the target activity's definition decide the rest, so no activity needs Builder code.
import { getActivityUi } from '../activities/registry.js'

// Fields every task format keeps across a format switch.
export const COMMON_TASK_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'explainer',
  'priority',
  'taskMode',
  'estimatedMinutes',
  'intent',
  'taskActivity',
  'intentLastChangedAt',
  'taskLastChangedAt',
])

export function commonTaskFields(task) {
  const out = {}
  for (const field of COMMON_TASK_FIELDS) {
    if (task?.[field] !== undefined) out[field] = task[field]
  }
  return out
}

/**
 * The task converted to `definition`'s activity. A UI with `builderConvert` (the legacy quiz
 * sub-types, which keep the fields they share) converts itself; otherwise the definition's
 * `defaultTask` supplies a valid starting task and only the common fields are kept, so fields
 * from the previous format (code, options, items of another activity) are stripped.
 */
export function convertTaskToActivity(task, definition) {
  const ui = getActivityUi(definition.id)
  if (ui?.builderConvert) return ui.builderConvert(task)
  const next = { ...commonTaskFields(task), ...definition.defaultTask(task) }
  if (next.description === '' && task?.description === undefined) delete next.description
  return next
}
