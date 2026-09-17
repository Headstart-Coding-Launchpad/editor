// Teacher-facing "how many items has this student filled in / got right"
// summary for multi-item tasks: Match and Fill in the Gaps quizzes (from the
// mirrored currentAnswer) and Code Arrange (from currentCodeArrangeSlots).
// Code Arrange is marked by running the assembled program, not per slot, so
// it only reports a filled count. Never shown to students.
import { buildQuizSubmission } from './studentQuizContent'
import { parseQuizAnswerState } from '../shared/quizAnswers'
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

  const quizType = task.taskType === 'quiz' ? task.quizType : null
  if (quizType !== 'match' && quizType !== 'fill_blank') return null

  const items = quizType === 'match' ? (task.pairs ?? []) : (task.blanks ?? [])
  if (items.length === 0) return null
  const state = parseQuizAnswerState(student?.currentAnswer)
  const submission = buildQuizSubmission(task, student?.currentAnswer)
  let filled = 0
  let correct = 0
  for (const item of items) {
    if (!isFilled(state[item.id])) continue
    filled += 1
    if (submission?.[item.id]?.correct) correct += 1
  }
  return { kind: quizType, filled, total: items.length, correct }
}

export function formatTaskItemProgress(progress) {
  if (!progress) return ''
  const filled = `${progress.filled}/${progress.total} ${progress.kind === 'code_arrange' ? 'slots ' : ''}filled`
  return progress.correct == null ? filled : `${filled} · ${progress.correct} correct`
}
