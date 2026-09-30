import { defineBadge } from '../defineBadge.js'
import { firstInClassOnPattern } from '../rules.js'
import { attemptEvent as attempt, pasteEvent } from '../timeline.js'

// Complete Example tasks are excluded: their starter is already the complete code.
export default defineBadge({
  id: 'code_builder',
  emoji: '📋',
  title: 'Code Builder',
  blurb: 'Built working code from an example.',
  ruleText:
    'First in class to make a real pass on a Copy the Code task (Complete Example tasks don’t count: there is nothing to type).',
  rule: firstInClassOnPattern('copy_the_code'),
  reasonText: ({ taskTitle }) => `First to build “${taskTitle}” from the example`,
  autoAwardable: true,
  examples: [
    {
      name: 'earliest real pass on Copy the Code wins',
      timelines: {
        alex: [attempt({ taskId: 't2', passed: true, at: 100 })],
        sam: [attempt({ taskId: 't2', passed: true, at: 120 })],
      },
      expect: [['alex', 't2']],
    },
    {
      name: 'a large paste before the pass is not a real pass',
      timelines: {
        alex: [
          pasteEvent({ taskId: 't2', firstAt: 90 }),
          attempt({ taskId: 't2', passed: true, at: 100 }),
        ],
      },
      expect: [],
    },
    {
      name: 'a Complete Example pass does not count',
      timelines: { alex: [attempt({ taskId: 't1', passed: true, at: 100 })] },
      expect: [],
    },
  ],
})
