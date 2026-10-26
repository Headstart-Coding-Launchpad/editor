import { defineBadge } from '../defineBadge.js'
import { firstInClassOnActivity } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

export default defineBadge({
  id: 'station_builder',
  emoji: '🏗️',
  title: 'Station Builder',
  blurb: 'First to finish upgrading their space station.',
  ruleText: 'First in class to make a real pass on a Space station activity task.',
  rule: firstInClassOnActivity(['station']),
  reasonText: ({ taskTitle }) => `First to finish “${taskTitle}”`,
  autoAwardable: true,
  examples: [
    {
      name: 'the earliest pass on a station task',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 90 })],
        sam: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 40 })],
      },
      expect: [['sam', 's1']],
    },
    {
      name: 'a pass on another activity does not count',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: { alex: [attempt({ taskId: 'm1', passed: true, firstTry: true, at: 10 })] },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real, so the next student wins',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [attempt({ taskId: 's1', passed: true, firstTry: true, assisted: true, at: 10 })],
        sam: [attempt({ taskId: 's1', passed: true, firstTry: true, at: 40 })],
      },
      expect: [['sam', 's1']],
    },
  ],
})
