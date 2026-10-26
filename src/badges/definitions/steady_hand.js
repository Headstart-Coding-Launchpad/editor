import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'steady_hand',
  emoji: '🖱️',
  title: 'Steady Hand',
  blurb: 'Went through the mouse round without a single slip.',
  ruleText:
    'A real pass on a Mouse skills task with no misses. A miss is a click, drag or other gesture that was not the answer: the wrong target, a drop on the wrong target, or the wrong kind of gesture on the right target. The first click of a double-click and clicks on empty stage do not count. Anyone can earn it.',
  rule: activityRoundPass(['mouse'], {
    qualifies: (result) => result.misses === 0 && result.tries >= result.core,
  }),
  reasonText: ({ taskTitle }) => `No slips in “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'a round with no misses',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('m1', { core: 3, tries: 3, misses: 0 }, 10)] },
      expect: [['alex', 'm1']],
    },
    {
      name: 'one miss is a slip',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('m1', { core: 3, tries: 3, misses: 1 }, 10)] },
      expect: [],
    },
    {
      name: 'a Station task is not a Mouse task',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('s1', { core: 3, tries: 3, misses: 0 }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('m1', { core: 3, tries: 3, misses: 0 }, 10, { assisted: true })],
      },
      expect: [],
    },
  ],
})
