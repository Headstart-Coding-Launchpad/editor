import { defineBadge } from '../defineBadge.js'
import { errorThenPass } from '../rules.js'
import { attemptEvent as attempt, sandboxRunEvent as run } from '../timeline.js'

export default defineBadge({
  id: 'code_fixer',
  emoji: '🔧',
  title: 'Code Fixer',
  blurb: 'Read an error and fixed it.',
  ruleText:
    'Task: an attempt with a real console error, then a later real pass with different code, on a task that isn’t a Debug Code Task. Sandbox: a run with an error, then a later error-free run with different code.',
  rule: errorThenPass({ excludePatterns: ['debug_code_task'] }),
  reasonText: ({ errorName, where, taskTitle }) => {
    const error = errorName ? `a ${errorName}` : 'an error'
    if (where === 'sandbox') return `Fixed ${error} in the sandbox`
    if (where === 'personal') return `Fixed ${error} in their own sandbox`
    return `Fixed ${error} in “${taskTitle}”`
  },
  examples: [
    {
      name: 'an error, then a different passing submission',
      timelines: {
        alex: [
          attempt({ taskId: 't4', error: 'NameError', submissionHash: 'a', at: 10 }),
          attempt({ taskId: 't4', passed: true, submissionHash: 'b', at: 20 }),
        ],
      },
      expect: [['alex', 't4']],
    },
    {
      name: 'a Debug Code Task does not count',
      timelines: {
        alex: [
          attempt({ taskId: 't3', error: true, submissionHash: 'a', at: 10 }),
          attempt({ taskId: 't3', passed: true, submissionHash: 'b', at: 20 }),
        ],
      },
      expect: [],
    },
    {
      name: 'a sandbox fix is suggested with no task',
      timelines: {
        alex: [
          run({ error: true, submissionHash: 'a', at: 10 }),
          run({ error: false, submissionHash: 'b', at: 20 }),
        ],
      },
      expect: [['alex', null]],
    },
    {
      name: 'rerunning the same code in the sandbox is not a fix',
      timelines: {
        alex: [
          run({ context: 'personal', error: true, submissionHash: 'a', at: 10 }),
          run({ context: 'personal', error: false, submissionHash: 'a', at: 20 }),
        ],
      },
      expect: [],
    },
  ],
})
