import { defineBadge } from '../defineBadge.js'
import { realPassOnPattern } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

export default defineBadge({
  id: 'prediction_pro',
  emoji: '🔭',
  title: 'Prediction Pro',
  blurb: 'Predicted exactly what the code would do, first go.',
  ruleText:
    'Made a real pass on the first attempt at a “Quiz: What Do You Expect the Code to Do” task.',
  rule: realPassOnPattern(['quiz_what_do_you_expect'], { firstTryOnly: true }),
  reasonText: ({ taskTitle }) => `Predicted “${taskTitle}”, first try`,
  autoAwardable: true,
  examples: [
    {
      name: 'only a first-try pass earns it',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [
          attempt({ taskId: 'w1', passed: false, firstTry: true, at: 50 }),
          attempt({ taskId: 'w1', passed: true, at: 60 }),
        ],
        sam: [attempt({ taskId: 'w1', passed: true, firstTry: true, at: 90 })],
      },
      expect: [['sam', 'w1']],
    },
    {
      name: 'another quiz pattern is not a prediction',
      timelines: { alex: [attempt({ taskId: 'q1', passed: true, firstTry: true, at: 10 })] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [attempt({ taskId: 'w1', passed: true, firstTry: true, assisted: true, at: 10 })],
      },
      expect: [],
    },
  ],
})
