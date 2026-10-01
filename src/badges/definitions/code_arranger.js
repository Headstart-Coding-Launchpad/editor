import { defineBadge } from '../defineBadge.js'
import { firstInClassOnPattern } from '../rules.js'
import { attemptEvent as attempt, overrideEvent } from '../timeline.js'

// Any Arrange task (taskType code_arrange), whatever its taskActivity pattern.
export default defineBadge({
  id: 'code_arranger',
  emoji: '🧩',
  title: 'Code Arranger',
  blurb: 'Put the code in the right order.',
  ruleText:
    'First in class among students whose first attempt at an Arrange task (code_arrange) was a real pass.',
  rule: firstInClassOnPattern([], { formats: 'code_arrange', firstTryOnly: true }),
  reasonText: ({ taskTitle }) => `First to arrange “${taskTitle}”, first try`,
  autoAwardable: true,
  examples: [
    {
      name: 'a first-try pass beats an earlier second-try pass',
      timelines: {
        alex: [
          attempt({ taskId: 'a1', passed: false, at: 50 }),
          attempt({ taskId: 'a1', passed: true, at: 60 }),
        ],
        sam: [attempt({ taskId: 'a1', passed: true, at: 90 })],
      },
      expect: [['sam', 'a1']],
    },
    {
      name: 'an override pass is not a real pass',
      timelines: {
        alex: [
          overrideEvent({ taskId: 'a1', at: 40 }),
          attempt({ taskId: 'a1', passed: true, at: 50 }),
        ],
      },
      expect: [],
    },
    {
      name: 'a first-try pass on an ordinary code task does not count',
      timelines: { alex: [attempt({ taskId: 't4', passed: true, at: 50 })] },
      expect: [],
    },
  ],
})
