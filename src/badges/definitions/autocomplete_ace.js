import { defineBadge } from '../defineBadge.js'
import { anySignal } from '../rules.js'
import { autocompleteEvent, shortcutEvent } from '../timeline.js'

export default defineBadge({
  id: 'autocomplete_ace',
  emoji: '✨',
  title: 'Autocomplete Ace',
  blurb: 'Used autocomplete to code faster.',
  ruleText:
    'Accepted a code-editor autocomplete suggestion (Enter, Tab or a click on the suggestion list) in a task or a sandbox. Code editors only: not Scratch blocks or the Desktop.',
  rule: anySignal('autocomplete'),
  reasonText: ({ taskTitle }) =>
    taskTitle ? `Used autocomplete in “${taskTitle}”` : 'Used autocomplete',
  examples: [
    {
      name: 'an accepted suggestion on a task',
      timelines: { alex: [autocompleteEvent({ taskId: 't4', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'counts in a personal sandbox',
      timelines: { alex: [autocompleteEvent({ context: 'personal', at: 10 })] },
      expect: [['alex', null]],
    },
    {
      name: 'a keyboard shortcut is not autocomplete',
      timelines: { alex: [shortcutEvent({ shortcutId: 'run', taskId: 't4', at: 10 })] },
      expect: [],
    },
  ],
})
