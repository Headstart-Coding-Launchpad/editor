import { defineBadge } from '../defineBadge.js'
import { firstInClassOnActivity } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'ai_trainer',
  emoji: '🏋️',
  title: 'AI Trainer',
  blurb: 'Got their AI trained and ready first.',
  ruleText:
    'First in class to get a Classifier pad ready (every thing has its drawings), among students who then made a real pass on the task. Ranked by when the pad became ready, which is recorded on the student’s own device; a task whose given examples make the pad ready from the start counts from the student’s first change.',
  rule: firstInClassOnActivity(['classifier'], {
    qualifies: (result) => Number.isFinite(result.readyAt),
    timeOf: (result) => result.readyAt,
  }),
  reasonText: ({ taskTitle }) => `First to get the pad ready in “${taskTitle}”`,
  autoAwardable: false,
  examples: [
    {
      name: 'ranked by when the pad was ready, not by when the round ended',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('c1', { core: 3, tries: 3, readyAt: 100 }, 500)],
        sam: [round('c1', { core: 3, tries: 3, readyAt: 300 }, 400)],
      },
      expect: [['alex', 'c1']],
    },
    {
      name: 'a pass with no ready time (an old save) cannot be ranked',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [round('c1', { core: 3, tries: 3, readyAt: null }, 10)] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real, so the next student wins',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('c1', { core: 3, tries: 3, readyAt: 100 }, 500, { assisted: true })],
        sam: [round('c1', { core: 3, tries: 3, readyAt: 300 }, 400)],
      },
      expect: [['sam', 'c1']],
    },
  ],
})
