import { defineBadge } from '../defineBadge.js'
import { quizGroupFirstTry } from '../rules.js'
import { attemptEvent as attempt } from '../timeline.js'

const right = (taskId, at) => attempt({ taskId, passed: true, firstTry: true, at })
const wrong = (taskId, at) => attempt({ taskId, passed: false, firstTry: true, at })

// The example lesson's End Quiz group has three graded quizzes (q1–q3) and a confidence check.
export default defineBadge({
  id: 'quiz_master',
  emoji: '🎯',
  title: 'Quiz Master',
  blurb: 'Knew their stuff in the quiz.',
  ruleText:
    'In a quiz group (a task group with at least quizMasterMinQuizzes graded quizzes, default 3), at least quizMasterThreshold (default 80%) right first time. Evaluated once the student has attempted them all or the class has moved past the group; unattempted questions count as not right.',
  rule: quizGroupFirstTry(),
  reasonText: ({ groupTitle, right, total }) =>
    `${groupTitle}: ${right} of ${total} right first time`,
  autoAwardable: true,
  examples: [
    {
      name: 'all right first time',
      timelines: { alex: [right('q1', 10), right('q2', 20), right('q3', 30)] },
      expect: [['alex', 'q3']],
    },
    {
      name: 'two of three is below 80%',
      timelines: { alex: [right('q1', 10), wrong('q2', 20), right('q3', 30)] },
      expect: [],
    },
    {
      name: 'not evaluated until every quiz is attempted',
      timelines: { alex: [right('q1', 10), right('q2', 20)] },
      expect: [],
    },
    {
      name: 'moving past the group counts unattempted quizzes as not right',
      timelines: { alex: [right('q1', 10), right('q2', 20)] },
      options: { currentTaskId: 'i1', quizMasterThreshold: 0.6 },
      expect: [['alex', 'q3']],
    },
  ],
})
