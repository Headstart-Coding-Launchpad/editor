// The lesson badge `examples` run against unless they bring their own (see defineBadge.js). One
// task per pattern the v1 badges care about, plus a quiz group. Pure data.
export const EXAMPLE_LESSON = Object.freeze({
  id: 'badge-examples',
  type: 'python',
  title: 'Badge examples',
  tasks: [
    { id: 't1', title: 'Say hello', taskActivity: 'Code Task, Complete Example' },
    { id: 't2', title: 'Type it out', taskActivity: 'Code Task, Copy the Code' },
    { id: 't3', title: 'Fix the loop', taskActivity: 'Code Task, Debug Code Task' },
    { id: 't4', title: 'Count up', taskActivity: 'Code Task' },
    { id: 't5', title: 'Your own greeting', taskActivity: 'Code Task, Challenge (Open-Ended)' },
    {
      id: 'g-end-quiz',
      type: 'group',
      title: 'End Quiz',
      subtasks: [
        {
          id: 'q1',
          title: 'Spot the error',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          taskActivity: 'Quiz: What Is the Error?',
          check: { type: 'answer_equals', value: 'a' },
        },
        {
          id: 'q2',
          title: 'Fix the bug',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          taskActivity: 'Quiz: Fix a Common Bug',
          check: { type: 'answer_equals', value: 'b' },
        },
        {
          id: 'q3',
          title: 'Match the words',
          taskType: 'quiz',
          quizType: 'match',
          taskActivity: 'Quiz: Vocabulary Match',
        },
        {
          id: 'q4',
          title: 'How do you feel?',
          taskType: 'quiz',
          quizType: 'confidence',
          taskActivity: 'Quiz: Confidence Check',
        },
      ],
    },
    { id: 'i1', title: 'Coming up next', taskType: 'information', explainer: 'Next time…' },
  ],
})
