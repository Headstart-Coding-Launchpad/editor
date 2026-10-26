import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'ai_fooler',
  emoji: '🎭',
  title: 'AI Fooler',
  blurb: 'Tricked the AI, then taught it to do better.',
  ruleText:
    'A real pass on a Classifier task where the pad got at least one try wrong and the student then taught it that drawing (“Teach it this one”). Teaching a try after the round ends is not seen.',
  rule: activityRoundPass(['classifier'], {
    qualifies: (result) => result.misses > 0 && result.taught > 0,
    values: (result) => ({ taught: result.taught }),
  }),
  reasonText: ({ taskTitle, taught }) =>
    `Fooled the pad, then taught it ${taught === 1 ? 'the miss' : `${taught} misses`} in “${taskTitle}”`,
  autoAwardable: false,
  examples: [
    {
      name: 'a miss that was taught',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, right: 2, misses: 1, taught: 1 }, 10)] },
      expect: [['alex', 'c1']],
    },
    {
      name: 'a miss that was never taught',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, right: 2, misses: 1, taught: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'no misses means nothing to teach',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, right: 3, misses: 0, taught: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [
          round('c1', { core: 3, tries: 3, right: 2, misses: 1, taught: 1 }, 10, {
            assisted: true,
          }),
        ],
      },
      expect: [],
    },
  ],
})
