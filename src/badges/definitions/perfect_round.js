import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

// A round is perfect when every core try was right: the Classifier's pad never got one wrong
// (the live round only), every Next Word guess was the likeliest word, every Real or AI pick was
// right. The activities' `badgeResult` hooks give { core, tries, right }.
export const isPerfectRound = (result) =>
  result.core > 0 && result.tries >= result.core && result.right >= result.core

const round = (taskId, result, at) => attempt({ taskId, passed: true, firstTry: true, result, at })

export default defineBadge({
  id: 'perfect_round',
  emoji: '💯',
  title: 'Perfect Round',
  blurb: 'Every try in the round was a good one.',
  ruleText:
    'A real pass on a Classifier, Next Word or Real or AI task where every try in the round was right: the pad never got a Classifier try wrong, every Next Word guess was the likeliest word, every Real or AI pair was picked right. Bonus tries are not counted.',
  rule: activityRoundPass(['classifier', 'next_word', 'real_or_ai'], {
    qualifies: isPerfectRound,
    values: (result) => ({ tries: result.tries }),
  }),
  reasonText: ({ taskTitle, tries }) => `${tries} out of ${tries} right in “${taskTitle}”`,
  autoAwardable: false,
  examples: [
    {
      name: 'a Next Word round with every guess right',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('n1', { core: 5, tries: 5, right: 5 }, 10)] },
      expect: [['alex', 'n1']],
    },
    {
      name: 'a Classifier round where the pad never missed',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, right: 3, misses: 0 }, 10)] },
      expect: [['alex', 'c1']],
    },
    {
      name: 'one wrong pick is not a perfect round',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('r1', { core: 3, tries: 3, right: 2 }, 10)] },
      expect: [],
    },
    {
      name: 'a mouse round is not this pattern',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('m1', { core: 3, tries: 3, misses: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [
          attempt({
            taskId: 'r1',
            passed: true,
            firstTry: true,
            assisted: true,
            result: { core: 3, tries: 3, right: 3 },
            at: 10,
          }),
        ],
      },
      expect: [],
    },
  ],
})
