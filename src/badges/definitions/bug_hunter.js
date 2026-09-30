import { defineBadge } from '../defineBadge.js'
import { firstInClassOnPattern } from '../rules.js'
import { attemptEvent as attempt, completeShownEvent, overrideEvent } from '../timeline.js'

export default defineBadge({
  id: 'bug_hunter',
  emoji: '🐛',
  title: 'Bug Hunter',
  blurb: 'Found and fixed a bug.',
  ruleText:
    'First in class to make a real pass on a Debug Code Task (no teacher help, override, complete code or large paste before the pass).',
  rule: firstInClassOnPattern('debug_code_task'),
  reasonText: ({ taskTitle }) => `First to fix the bug in “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'earliest real pass wins',
      timelines: {
        alex: [attempt({ taskId: 't3', passed: true, at: 200 })],
        sam: [attempt({ taskId: 't3', passed: true, at: 100 })],
      },
      expect: [['sam', 't3']],
    },
    {
      name: 'assisted pass ignored',
      timelines: {
        alex: [attempt({ taskId: 't3', passed: true, assisted: true, at: 100 })],
      },
      expect: [],
    },
    {
      name: 'a pass that is not real hands the task to the next student',
      timelines: {
        alex: [
          completeShownEvent({ taskId: 't3', at: 50 }),
          attempt({ taskId: 't3', passed: true, at: 100 }),
        ],
        sam: [overrideEvent({ taskId: 't3' }), attempt({ taskId: 't3', passed: true, at: 150 })],
        kit: [attempt({ taskId: 't3', passed: true, at: 300 })],
      },
      expect: [['kit', 't3']],
    },
    {
      name: 'a pass on another pattern does not count',
      timelines: { alex: [attempt({ taskId: 't4', passed: true, at: 100 })] },
      expect: [],
    },
  ],
})
