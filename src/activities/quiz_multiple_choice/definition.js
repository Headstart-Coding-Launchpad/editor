// Multiple-choice quiz (legacy `taskType: 'quiz'`, `quizType: 'multiple_choice'` or no
// quizType). State: the chosen option id, '' before answering. Choosing an option submits it.
import {
  defineQuizActivity,
  gradeAnswerCheck,
  gradeResult,
  printTable,
} from '../quiz/quizActivity.js'

function optionIds(task) {
  return (task?.options ?? []).map((option) => option.id)
}

export default defineQuizActivity('multiple_choice', {
  description: 'Pick one answer from a list of options.',

  fields: {
    task: [
      {
        name: 'options',
        type: 'array',
        required: true,
        authored: true,
        description: 'At least 2.',
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'text', type: 'string', required: true, authored: true },
          { name: 'feedback', type: 'string', authored: true },
          { name: 'hint', type: 'string', authored: true },
        ],
      },
      {
        name: 'check',
        type: 'object',
        required: true,
        authored: true,
        description: '{ type: answer_equals, value: <option id> }; YAML shorthand `answer`.',
      },
      { name: 'feedback', type: 'string', authored: true, description: 'Fallback feedback.' },
    ],
  },
  // `answer: <option-id>` in YAML is this quiz's `check: { type: answer_equals }`.
  yaml: Object.freeze({ type: 'quiz', quizType: 'multiple_choice', answerShorthand: true }),

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    explainer: prev.explainer ?? '',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ],
    check: { type: 'answer_equals', value: 'a' },
  }),

  initialState: () => '',
  solutionState: (task) => (task?.check?.type === 'answer_equals' ? (task.check.value ?? '') : ''),
  // The answer is in `check`; per-option `feedback` often gives it away too.
  sealedFields: ['options'],
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Only an id the task still offers is an answer (an option removed since is dropped).
  deserialize: (raw, task) => (typeof raw === 'string' && optionIds(task).includes(raw) ? raw : ''),

  grade: (task, answer) => gradeResult(task, answer, gradeAnswerCheck(task, answer)),

  summarize: (task, state) => {
    const option = (task?.options ?? []).find((candidate) => candidate.id === state)
    return { text: `${state} ${option?.text || 'Selected answer'}`, tone: 'neutral' }
  },

  // Printed only for tasks that name their quizType (unchanged print output).
  printHtml: (task, { esc }) =>
    task.quizType === 'multiple_choice' && task.options?.length
      ? printTable(
          'Options',
          ['ID', 'Text', 'Feedback'],
          task.options.map((opt) => [opt.id, opt.text, opt.feedback || '']),
          esc
        )
      : '',
})
