import { defineBadge } from '../defineBadge.js'
import { realPassOnPattern } from '../rules.js'
import { attemptEvent as attempt, completeShownEvent, overrideEvent } from '../timeline.js'

export default defineBadge({
  id: 'bug_hunter',
  emoji: '🐛',
  title: 'Bug Hunter',
  blurb: 'Found and fixed a bug.',
  ruleText:
    'Made a real pass on a Debug Code Task (no teacher help, override, complete code or large paste before the pass).',
  rule: realPassOnPattern('debug_code_task'),
  reasonText: ({ taskTitle }) => `Fixed the bug in “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'every student with a real pass earns it',
      timelines: {
        alex: [attempt({ taskId: 't3', passed: true, at: 200 })],
        sam: [attempt({ taskId: 't3', passed: true, at: 100 })],
      },
      expect: [
        ['sam', 't3'],
        ['alex', 't3'],
      ],
    },
    {
      name: 'assisted pass ignored',
      timelines: {
        alex: [attempt({ taskId: 't3', passed: true, assisted: true, at: 100 })],
      },
      expect: [],
    },
    {
      name: 'a pass that is not real does not earn it',
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
