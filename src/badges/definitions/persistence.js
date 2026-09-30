import { defineBadge } from '../defineBadge.js'
import { uniqueFailsThenPass } from '../rules.js'
import { attemptEvent as attempt } from '../timeline.js'

const fail = (submissionHash, at) => attempt({ taskId: 't4', submissionHash, at })

export default defineBadge({
  id: 'persistence',
  emoji: '🔨',
  title: 'Persistence',
  blurb: 'Kept trying different ideas until it worked.',
  ruleText:
    'On a code or Code Arrange task (not a quiz), at least persistenceMinFails (default 2) different failed submissions, then a real pass.',
  rule: uniqueFailsThenPass(),
  reasonText: ({ tries, taskTitle }) => `${tries} different tries, then passed “${taskTitle}”`,
  examples: [
    {
      name: 'A → B → A is two unique fails',
      timelines: {
        alex: [
          fail('a', 10),
          fail('b', 20),
          fail('a', 30),
          attempt({ taskId: 't4', passed: true, submissionHash: 'c', at: 40 }),
        ],
      },
      expect: [['alex', 't4']],
    },
    {
      name: 'the same code rerun is one fail',
      timelines: {
        alex: [
          fail('a', 10),
          fail('a', 20),
          attempt({ taskId: 't4', passed: true, submissionHash: 'c', at: 40 }),
        ],
      },
      expect: [],
    },
    {
      name: 'no real pass, no badge',
      timelines: {
        alex: [
          fail('a', 10),
          fail('b', 20),
          attempt({ taskId: 't4', passed: true, assisted: true, submissionHash: 'c', at: 40 }),
        ],
      },
      expect: [],
    },
  ],
})
