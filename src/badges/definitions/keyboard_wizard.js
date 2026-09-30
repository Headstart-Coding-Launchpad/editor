import { defineBadge } from '../defineBadge.js'
import { keyboardWizardSignal } from '../rules.js'
import { shortcutEvent } from '../timeline.js'

export default defineBadge({
  id: 'keyboard_wizard',
  emoji: '⌨️',
  title: 'Keyboard Wizard',
  blurb: 'Used a keyboard shortcut like a pro.',
  ruleText:
    'Used a shortcut from the Keyboard Wizard list (Run, undo/redo, toggle comment, indent/outdent, Delete, Find, Save, or a Desktop app shortcut) in a task or a sandbox.',
  rule: keyboardWizardSignal(),
  reasonText: ({ shortcutLabel }) => `Used ${shortcutLabel}`,
  examples: [
    {
      name: 'a listed shortcut counts',
      timelines: { alex: [shortcutEvent({ shortcutId: 'run', taskId: 't4', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'an unlisted shortcut does not',
      timelines: { alex: [shortcutEvent({ shortcutId: 'paste', taskId: 't4', at: 10 })] },
      expect: [],
    },
    {
      name: 'counts in a personal sandbox',
      timelines: {
        alex: [shortcutEvent({ context: 'personal', shortcutId: 'toggle_comment', at: 10 })],
      },
      expect: [['alex', null]],
    },
  ],
})
