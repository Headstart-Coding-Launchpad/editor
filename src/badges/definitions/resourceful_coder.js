import { defineBadge } from '../defineBadge.js'
import { anySignal } from '../rules.js'
import { topicOpenEvent } from '../timeline.js'

export default defineBadge({
  id: 'resourceful_coder',
  emoji: '📚',
  title: 'Resourceful Coder',
  blurb: 'Looked something up in the Topic Library.',
  ruleText:
    'Opened a Topic Library topic themselves (library button, topic link or topic card), in a task or a sandbox. Topics the tutor sends don’t count.',
  rule: anySignal('topic_open', {
    filter: (event) => event.source === 'student',
    values: (event) => ({ topicTitle: event.topicTitle ?? event.topicId }),
  }),
  reasonText: ({ topicTitle }) => `Opened “${topicTitle}” in the Topic Library`,
  examples: [
    {
      name: 'the student opens a topic',
      timelines: {
        alex: [topicOpenEvent({ topicId: 'loops', topicTitle: 'Loops', taskId: 't4', at: 10 })],
      },
      expect: [['alex', 't4']],
    },
    {
      name: 'a topic the tutor sent does not count',
      timelines: {
        alex: [topicOpenEvent({ topicId: 'loops', taskId: 't4', source: 'teacher', at: 10 })],
      },
      expect: [],
    },
    {
      name: 'counts in the sandbox',
      timelines: {
        alex: [topicOpenEvent({ context: 'sandbox', topicId: 'loops', at: 10 })],
      },
      expect: [['alex', null]],
    },
  ],
})
