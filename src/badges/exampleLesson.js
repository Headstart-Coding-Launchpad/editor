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
