// Teacher-facing "how many items has this student filled in / got right"
// summary for multi-item tasks: Match and Fill in the Gaps quizzes (from the
// mirrored currentAnswer) and Code Arrange (from currentCodeArrangeSlots), via
// each legacy activity's getProgress. Code Arrange is marked by running the
// assembled program, not per slot, so it only reports a filled count. Never
// shown to students.
import { getActivityDefinition, getTaskActivity } from '../activities/registry.pure.js'
import { readStudentActivityState } from '../activities/state.js'

export function getTaskItemProgress(task, student) {
  if (!task) return null
  // Only the legacy activities (quizzes, code_arrange) surface item progress here; hosted
  // activities summarise themselves on the card (summarize / CardSummary).
  const activity = getTaskActivity(task)
  if (!activity?.legacy) return null
  return activity.getProgress(task, readStudentActivityState(task, student)) ?? null
}

export function formatTaskItemProgress(progress) {
  if (!progress) return ''
  // An activity may name what it counts ("slots"); progress.kind is the activity id for those.
  const unit = getActivityDefinition(progress.kind)?.progressUnit
  const filled = `${progress.filled}/${progress.total} ${unit ? `${unit} ` : ''}filled`
  return progress.correct == null ? filled : `${filled} · ${progress.correct} correct`
}
