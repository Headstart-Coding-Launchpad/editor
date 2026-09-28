// Teacher-facing "how many items has this student filled in / got right"
// summary for multi-item tasks: Match and Fill in the Gaps quizzes (from the
// mirrored currentAnswer, via the quiz activity's getProgress) and Code Arrange
// (from currentCodeArrangeSlots). Code Arrange is marked by running the
// assembled program, not per slot, so it only reports a filled count. Never
// shown to students.
import { getTaskActivity } from '../activities/registry.pure.js'
import { readActivityAnswer } from '../activities/state.js'
import { getSlotIds } from '../shared/codeArrange'

function isFilled(value) {
  return value != null && String(value).trim() !== ''
}

export function getTaskItemProgress(task, student) {
  if (!task) return null

  if (task.taskType === 'code_arrange') {
    const slotIds = getSlotIds(task)
    if (slotIds.length === 0) return null
    const slots = student?.currentCodeArrangeSlots ?? {}
    const filled = slotIds.filter((id) => isFilled(slots[id])).length
    return { kind: 'code_arrange', filled, total: slotIds.length, correct: null }
  }

  // Only the legacy quizzes surface item progress here; hosted activities summarise
  // themselves on the card (summarize / CardSummary).
  const activity = getTaskActivity(task)
  if (!activity?.legacy) return null
  return activity.getProgress(task, readActivityAnswer(task, student?.currentAnswer)) ?? null
}

export function formatTaskItemProgress(progress) {
  if (!progress) return ''
  const filled = `${progress.filled}/${progress.total} ${progress.kind === 'code_arrange' ? 'slots ' : ''}filled`
  return progress.correct == null ? filled : `${filled} · ${progress.correct} correct`
}
