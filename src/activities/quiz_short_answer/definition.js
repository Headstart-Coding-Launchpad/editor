// Short-answer quiz (legacy `taskType: 'quiz'`, `quizType: 'short_answer'`). State: the typed
// answer. Submit marks it against the task's answer_* check; without a check any non-blank
// answer is accepted and the task is ungraded (reports show "not applicable").
import { defineQuizActivity, gradeAnswerCheck, gradeResult } from '../quiz/quizActivity.js'

export default defineQuizActivity('short_answer', {
  description: 'Type a short written answer, optionally marked by an answer check.',

  fields: {
    task: [
      {
        name: 'check',
        type: 'object',
        authored: true,
        description: 'Optional answer_* check with a value; without it any answer is accepted.',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'short_answer',
    explainer: prev.explainer ?? 'What did you learn today?',
    check: null,
  }),

  initialState: () => '',
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Free text: any string is a valid answer.
  deserialize: (raw) => (typeof raw === 'string' ? raw : ''),

  isGraded: (task) => task?.check != null,
  grade: (task, answer) =>
    gradeResult(
      task,
      answer,
      task?.check
        ? gradeAnswerCheck(task, answer)
        : !!(typeof answer === 'string' ? answer.trim() : false)
    ),

  summarize: (task, state) => ({ text: state, tone: 'neutral' }),
})
