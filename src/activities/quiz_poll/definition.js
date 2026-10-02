// Poll (legacy `taskType: 'quiz'`, `quizType: 'poll'`). State: the chosen option id, '' before
// answering. An opinion is never right or wrong (`completion: 'none'`, ungraded): choosing an
// option records it as a response (logged with passed: true) and the student can change it. The
// session report gives the option distribution (`optionDistribution`). In a live lesson a
// student sees the class split (percentages, never who chose what) once they have chosen, and the
// presentation window shows it live, unless `showResults: false`; changed answers keep logging
// (logAttempt `changeable`). The live class poll (src/shared/classPolls.js) is the teacher's
// ad-hoc version of this.
import { defineQuizActivity, printTable } from '../quiz/quizActivity.js'

function optionIds(task) {
  return (task?.options ?? []).map((option) => option.id)
}

export default defineQuizActivity('poll', {
  description: 'Students pick the option they prefer. Never marked; the report counts each option.',

  // The question is the task's explainer.
  fields: {
    task: [
      {
        name: 'options',
        type: 'array',
        required: true,
        authored: true,
        description: '2 to 6. No correct answer, feedback or check.',
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'text', type: 'string', required: true, authored: true },
        ],
      },
      {
        name: 'showResults',
        type: 'boolean',
        authored: true,
        description:
          'Default true: in a live lesson students see the class split after choosing and the presentation shows it live. false keeps it teacher-only.',
      },
    ],
  },
  completion: 'none',

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'poll',
    explainer: prev.explainer ?? 'What would you like to do next?',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ],
    check: null,
  }),

  initialState: () => '',
  serialize: (state) => (typeof state === 'string' ? state : ''),
  // Only an id the task still offers is an answer (an option removed since is dropped).
  deserialize: (raw, task) => (typeof raw === 'string' && optionIds(task).includes(raw) ? raw : ''),

  isGraded: () => false,
  grade: () => ({ passed: true, suggestion: '' }),

  summarize: (task, state) => {
    const option = (task?.options ?? []).find((candidate) => candidate.id === state)
    return { text: `${state} ${option?.text || 'Selected option'}`, tone: 'neutral' }
  },

  printHtml: (task, { esc }) =>
    task.options?.length
      ? printTable(
          'Options',
          ['ID', 'Text'],
          task.options.map((opt) => [opt.id, opt.text]),
          esc
        )
      : '',

  report: {
    typeFields: () => ({ taskType: 'quiz', quizType: 'poll' }),
    normalizeSubmission: (task, submission) => (submission == null ? null : String(submission)),
    // Each student's latest choice, counted per option in the task's option order.
    summaryFields: (task, perStudent) => {
      const optionDistribution = (task?.options ?? []).map((option) => ({
        id: option.id,
        text: option.text ?? '',
        count: 0,
      }))
      for (const t of perStudent) {
        const latest = t.distinctAttempts[t.distinctAttempts.length - 1]
        const entry = optionDistribution.find((option) => option.id === latest?.submission)
        if (entry) entry.count += 1
      }
      return { optionDistribution }
    },
  },
})
