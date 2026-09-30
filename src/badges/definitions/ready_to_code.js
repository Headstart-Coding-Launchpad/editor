import { defineBadge } from '../defineBadge.js'
import { firstEditWithin } from '../rules.js'
import { firstEditEvent } from '../timeline.js'

export default defineBadge({
  id: 'ready_to_code',
  emoji: '🚀',
  title: 'Ready to Code',
  blurb: 'Got stuck in straight away.',
  ruleText:
    'On a code task (any module), a real edit within readyToCodeSeconds (default 10) of the task opening, timed on the student’s own device. Loaded, carried or pushed code doesn’t count.',
  rule: firstEditWithin(),
  reasonText: ({ seconds, taskTitle }) => `Started ${seconds} s into “${taskTitle}”`,
  examples: [
    {
      name: 'an edit within ten seconds',
      timelines: { alex: [firstEditEvent({ taskId: 't2', elapsedMs: 6000 })] },
      expect: [['alex', 't2']],
    },
    {
      name: 'too slow',
      timelines: { alex: [firstEditEvent({ taskId: 't2', elapsedMs: 10001 })] },
      expect: [],
    },
    {
      name: 'a quiz is not a code task',
      timelines: { alex: [firstEditEvent({ taskId: 'q1', elapsedMs: 1000 })] },
      expect: [],
    },
  ],
})
