import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

export default defineBadge({
  id: 'station_builder',
  emoji: '🏗️',
  title: 'Station Builder',
  blurb: 'Finished upgrading their space station.',
  ruleText: 'Made a real pass on a Space station activity task.',
  rule: activityRoundPass(['station']),
  reasonText: ({ taskTitle }) => `Finished “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'every pass on a station task earns it',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 90 })],
        sam: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 40 })],
      },
      expect: [
        ['sam', 's1'],
        ['alex', 's1'],
      ],
    },
    {
      name: 'a pass on another activity does not count',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [attempt({ taskId: 'm1', passed: true, firstTry: true, at: 10 })] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [attempt({ taskId: 's1', passed: true, firstTry: true, assisted: true, at: 10 })],
        sam: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 40 })],
      },
      expect: [['sam', 's1']],
    },
  ],
})
