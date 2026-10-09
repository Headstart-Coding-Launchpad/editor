import { defineBadge } from '../defineBadge.js'
import { anySignal } from '../rules.js'
import { autocompleteEvent, emojiRunEvent } from '../timeline.js'

// The student's client records the first Run of code with an emoji in a Python string, or in
// HTML text or an attribute (src/shared/emojiInCode.js; comments never count), as
// `studentSignals.emojiRun`. Typed, pasted or picked from the emoji picker all count.
export default defineBadge({
  id: 'emoji_artist',
  emoji: '🤩',
  title: 'Emoji Artist',
  blurb: 'Brought their code to life with an emoji.',
  ruleText:
    'Ran Python or HTML code with an emoji in a string, or in HTML text or an attribute (comments do not count), in a task or a sandbox. Typed, pasted or picked from the emoji picker all count.',
  rule: anySignal('emoji_run'),
  reasonText: () => 'Ran code with an emoji in it',
  autoAwardable: false,
  examples: [
    {
      name: 'a run with an emoji on a task',
      timelines: { alex: [emojiRunEvent({ taskId: 't4', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'a run with an emoji in the sandbox',
      timelines: { alex: [emojiRunEvent({ context: 'sandbox', at: 10 })] },
      expect: [['alex', null]],
    },
    {
      name: 'a run on a task that has gone does not count',
      timelines: { alex: [emojiRunEvent({ taskId: 'gone', at: 10 })] },
      expect: [],
    },
    {
      name: 'other signals do not count',
      timelines: { alex: [autocompleteEvent({ taskId: 't4', at: 10 })] },
      expect: [],
    },
  ],
})
