import { defineBadge } from '../defineBadge.js'
import { realPassOnPattern } from '../rules.js'
import { attemptEvent as attempt, revealEvent } from '../timeline.js'

export default defineBadge({
  id: 'challenge_solver',
  emoji: '🔓',
  title: 'Challenge Solver',
  blurb: 'Solved a challenge on their own.',
  ruleText:
    'A real pass on a Challenge (Open-Ended) task with no support stage revealed on it before the pass (checked tasks only).',
  rule: realPassOnPattern('challenge_open_ended', { noSupportReveal: true }),
  reasonText: ({ taskTitle }) => `Solved “${taskTitle}” without references`,
  autoAwardable: true,
  examples: [
    {
      name: 'every student with a real pass is suggested',
      timelines: {
        alex: [attempt({ taskId: 't5', passed: true, at: 100 })],
        sam: [attempt({ taskId: 't5', passed: true, at: 200 })],
      },
      expect: [
        ['alex', 't5'],
        ['sam', 't5'],
      ],
    },
    {
      name: 'a support stage revealed before the pass rules it out',
      timelines: {
        alex: [
          revealEvent({ taskId: 't5', stage: 1, complete: false, at: 50 }),
          attempt({ taskId: 't5', passed: true, at: 100 }),
        ],
      },
      expect: [],
    },
    {
      name: 'a support stage revealed after the pass is fine',
      timelines: {
        alex: [
          attempt({ taskId: 't5', passed: true, at: 100 }),
          revealEvent({ taskId: 't5', stage: 1, complete: false, at: 150 }),
        ],
      },
      expect: [['alex', 't5']],
    },
  ],
})
