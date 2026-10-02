import { defineBadge } from '../defineBadge.js'
import { anySignal } from '../rules.js'
import { attemptEvent, peerHelpEvent } from '../timeline.js'

// Suggested from peer help (src/shared/peerHelp.js), never auto-awarded: the tutor decides, as
// for every badge about how a student treats a classmate.
export default defineBadge({
  id: 'helpful_coder',
  emoji: '🤝',
  title: 'Helpful Coder',
  blurb: 'Helped a classmate.',
  ruleText:
    'Helped a stuck classmate through peer help, and the classmate pressed 👍 Useful on something they sent or used a change they suggested. Suggested only; the tutor decides.',
  rule: anySignal('peer_help'),
  reasonText: ({ taskTitle }) =>
    taskTitle
      ? `A classmate found their help useful on “${taskTitle}”`
      : 'A classmate found their help useful',
  examples: [
    {
      name: 'the stuck classmate found a hint useful',
      timelines: { alex: [peerHelpEvent({ taskId: 't4', outcome: 'useful', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'the stuck classmate used their change',
      timelines: { alex: [peerHelpEvent({ taskId: 't4', outcome: 'accepted', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'passing the task yourself is not helping',
      timelines: { alex: [attemptEvent({ taskId: 't4', passed: true, firstTry: true, at: 10 })] },
      expect: [],
    },
  ],
})
