// Short-answer quiz (legacy `taskType: 'quiz'`, `quizType: 'short_answer'`). State: the typed
// answer. Submit marks it against the task's answer_* check; without a check any non-blank
// answer is accepted and the task is ungraded (reports show "not applicable").
import { defineQuizActivity, gradeAnswerCheck, gradeResult } from '../quiz/quizActivity.js'

// `showResponses` values: the teacher picks answers to show on the presentation window.
export const SHOW_RESPONSES_MODES = Object.freeze(['teacher_picks'])

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
      {
        name: 'showResponses',
        type: 'string',
        values: SHOW_RESPONSES_MODES,
        authored: true,
        description:
          'teacher_picks (open answers only, no check): in a live lesson the teacher picks answers to show on the presentation window. Omit to keep answers teacher-only.',
      },
      {
        name: 'anonymiseResponses',
        type: 'boolean',
        authored: true,
        description:
          'Default true: answers shown with showResponses have no name; the teacher can turn a name on per answer. false shows names by default.',
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
  showsResponses: (task) => task?.check == null && task?.showResponses === 'teacher_picks',
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
