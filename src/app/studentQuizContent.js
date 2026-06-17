import { getFirstFailedCheckHint } from '../modules/checks'

export function getQuizSuggestion(task, answer) {
  if (!task) return ''
  if ((task.quizType ?? 'multiple_choice') === 'multiple_choice') {
    const option = task.options?.find(o => o.id === answer)
    return String(option?.feedback ?? option?.hint ?? task.feedback ?? task.check?.hint ?? '').trim()
  }
  if (task.quizType === 'short_answer' && task.check) {
    return getFirstFailedCheckHint(task.check, answer, { answer: typeof answer === 'string' ? answer : '' })
  }
  return String(task.feedback ?? task.check?.hint ?? '').trim()
}
