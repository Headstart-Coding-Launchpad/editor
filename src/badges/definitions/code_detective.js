import { defineBadge } from '../defineBadge.js'
import { firstInClassOnPattern } from '../rules.js'
import { attemptEvent as attempt } from '../timeline.js'

export default defineBadge({
  id: 'code_detective',
  emoji: '🔍',
  title: 'Code Detective',
  blurb: 'Spotted the error straight away.',
  ruleText:
    'First in class among students whose first attempt was a real pass on a “Quiz: What Is the Error?” or “Quiz: Fix a Common Bug” task.',
  rule: firstInClassOnPattern(['quiz_what_is_the_error', 'quiz_fix_a_common_bug'], {
    firstTryOnly: true,
  }),
  reasonText: ({ taskTitle }) => `First to spot the error in “${taskTitle}”, first try`,
  autoAwardable: true,
  examples: [
    {
      name: 'a first-try pass beats an earlier second-try pass',
      timelines: {
        alex: [
          attempt({ taskId: 'q1', passed: false, firstTry: true, at: 50 }),
          attempt({ taskId: 'q1', passed: true, at: 60 }),
        ],
        sam: [attempt({ taskId: 'q1', passed: true, firstTry: true, at: 90 })],
      },
      expect: [['sam', 'q1']],
    },
    {
      name: 'nobody right first time',
      timelines: {
        alex: [
          attempt({ taskId: 'q2', passed: false, at: 50 }),
          attempt({ taskId: 'q2', passed: true, at: 60 }),
        ],
      },
      expect: [],
    },
  ],
})
