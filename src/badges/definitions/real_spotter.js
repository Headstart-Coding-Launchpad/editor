import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'real_spotter',
  emoji: '🧐',
  title: 'Real Spotter',
  blurb: 'Could tell the real from the AI-made, every time.',
  ruleText:
    'Finished a Real or AI round with every pair picked right, on their first attempt at the task (a real pass; bonus pairs are not counted).',
  rule: activityRoundPass(['real_or_ai'], {
    firstTryOnly: true,
    qualifies: (result) =>
      result.core > 0 && result.tries >= result.core && result.right >= result.core,
  }),
  reasonText: ({ taskTitle }) => `Got every pair right in “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'every perfect round earns it',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('r1', { core: 3, tries: 3, right: 3 }, 90)],
        sam: [round('r1', { core: 3, tries: 3, right: 3 }, 40)],
      },
      expect: [
        ['sam', 'r1'],
        ['alex', 'r1'],
      ],
    },
    {
      name: 'a round with a wrong pick does not count',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('r1', { core: 3, tries: 3, right: 3 }, 90)],
        sam: [round('r1', { core: 3, tries: 3, right: 2 }, 40)],
      },
      expect: [['alex', 'r1']],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('r1', { core: 3, tries: 3, right: 3 }, 10, { assisted: true })],
      },
      expect: [],
    },
    {
      name: 'a perfect Next Word round is not Real or AI',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('n1', { core: 5, tries: 5, right: 5 }, 10)] },
      expect: [],
    },
  ],
})
