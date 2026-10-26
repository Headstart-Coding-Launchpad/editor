import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'keyboard_ace',
  emoji: '🔤',
  title: 'Keyboard Ace',
  blurb: 'Typed a whole round with every key spot on.',
  ruleText:
    'A real pass on a Keyboard skills task in a typing mode (type text, type code, falling words) where every item in the round was typed at 100% accuracy (and no falling word got past). Speed is never counted, and there is no first-in-class: anyone can earn it.',
  rule: activityRoundPass(['keyboard'], {
    qualifies: (result) => result.accuracy >= 1 && !(result.missed > 0),
  }),
  reasonText: ({ taskTitle }) => `100% accuracy through “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'a round typed at 100%',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('k1', { core: 2, tries: 2, accuracy: 1, missed: 0 }, 10)],
        sam: [round('k1', { core: 2, tries: 2, accuracy: 1, missed: 0 }, 50)],
      },
      expect: [
        ['alex', 'k1'],
        ['sam', 'k1'],
      ],
    },
    {
      name: 'a slip in the round is not 100%',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('k1', { core: 2, tries: 2, accuracy: 0.96, missed: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'falling words that got past are not spot on',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('k1', { core: 1, tries: 1, accuracy: 1, missed: 2 }, 10)] },
      expect: [],
    },
    {
      name: 'a mode with no accuracy (find the key) is not this pattern',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('k1', { core: 2, tries: 2, accuracy: null, missed: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('k1', { core: 2, tries: 2, accuracy: 1, missed: 0 }, 10, { assisted: true })],
      },
      expect: [],
    },
  ],
})
