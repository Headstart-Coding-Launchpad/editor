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
    { id: 'a1', title: 'Order the lines', taskType: 'code_arrange' },
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

// The lesson the activity badges' `examples` run against: one task per activity the badges read,
// a second Classifier and Real or AI task for first-in-class ordering, and two "What do you
// expect" quizzes. The activity tasks carry only the fields the rules need.
const activity = (id, title, activityType, extra = {}) => ({
  id,
  title,
  taskType: 'activity',
  activityType,
  ...extra,
})

export const ACTIVITY_EXAMPLE_LESSON = Object.freeze({
  id: 'badge-activity-examples',
  type: 'python',
  title: 'Activity badge examples',
  tasks: [
    activity('c1', 'Teach the pad', 'classifier', { testSet: 'live', liveTestSize: 3 }),
    activity('c2', 'Teach the pad again', 'classifier', { testSet: 'live', liveTestSize: 3 }),
    activity('n1', 'Next word', 'next_word', { guesses: 5 }),
    activity('r1', 'Real or AI', 'real_or_ai'),
    activity('r2', 'Real or AI again', 'real_or_ai'),
    activity('k1', 'Type it', 'keyboard', { mode: 'type_text' }),
    activity('m1', 'Mouse skills', 'mouse'),
    activity('s1', 'Upgrade the station', 'station'),
    activity('s2', 'Upgrade the station again', 'station'),
    {
      id: 'w1',
      title: 'What will it print?',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      taskActivity: 'Quiz: What Do You Expect the Code to Do',
      check: { type: 'answer_equals', value: 'a' },
    },
    {
      id: 'w2',
      title: 'What will it print next?',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      taskActivity: 'Quiz: What Do You Expect the Code to Do',
      check: { type: 'answer_equals', value: 'b' },
    },
    { id: 't4', title: 'Count up', taskActivity: 'Code Task' },
  ],
})
