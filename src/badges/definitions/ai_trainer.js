import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'ai_trainer',
  emoji: '🏋️',
  title: 'AI Trainer',
  blurb: 'Got their AI trained and ready.',
  ruleText:
    'Got a Classifier pad ready (every thing has its drawings) and then made a real pass on the task.',
  rule: activityRoundPass(['classifier'], {
    qualifies: (result) => Number.isFinite(result.readyAt),
  }),
  reasonText: ({ taskTitle }) => `Got the pad ready in “${taskTitle}”`,
  autoAwardable: false,
  examples: [
    {
      name: 'every student whose pad got ready earns it',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('c1', { core: 3, tries: 3, readyAt: 100 }, 500)],
        sam: [round('c1', { core: 3, tries: 3, readyAt: 300 }, 400)],
      },
      expect: [
        ['sam', 'c1'],
        ['alex', 'c1'],
      ],
    },
    {
      name: 'a pass with no ready time (an old save) does not count',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, readyAt: null }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('c1', { core: 3, tries: 3, readyAt: 100 }, 500, { assisted: true })],
        sam: [round('c1', { core: 3, tries: 3, readyAt: 300 }, 400)],
      },
      expect: [['sam', 'c1']],
    },
  ],
})
