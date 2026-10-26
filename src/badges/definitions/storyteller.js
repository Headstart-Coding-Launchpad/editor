import { defineBadge } from '../defineBadge.js'
import { activityRoundPass } from '../rules.js'
import { ACTIVITY_EXAMPLE_LESSON } from '../exampleLesson.js'
import { attemptEvent as attempt } from '../timeline.js'

// A passage: the AI added at least this many words from the student's own writing.
export const STORYTELLER_MIN_WORDS = 5

const round = (taskId, result, at, extra = {}) =>
  attempt({ taskId, passed: true, firstTry: true, result, at, ...extra })

export default defineBadge({
  id: 'storyteller',
  emoji: '📜',
  title: 'Storyteller',
  blurb: 'Taught the AI their own words and let it tell a story.',
  ruleText: `A real pass on a Next Word task where the student wrote words of their own and the AI then added at least ${STORYTELLER_MIN_WORDS} words to their sentences, learning from that writing (words made from the lesson’s texts do not count).`,
  rule: activityRoundPass(['next_word'], {
    qualifies: (result) => result.ownWords > 0 && result.generated >= STORYTELLER_MIN_WORDS,
    values: (result) => ({ words: result.ownWords }),
  }),
  reasonText: ({ taskTitle, words }) =>
    `Wrote ${words} ${words === 1 ? 'word' : 'words'} for the AI to learn from in “${taskTitle}”`,
  autoAwardable: false,
  examples: [
    {
      name: 'own words and a generated passage',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('n1', { core: 5, tries: 5, right: 3, ownWords: 12, generated: 6 }, 10)],
      },
      expect: [['alex', 'n1']],
    },
    {
      name: 'the AI only used the lesson texts',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('n1', { core: 5, tries: 5, right: 5, ownWords: 12, generated: 0 }, 10)],
      },
      expect: [],
    },
    {
      name: 'no words of their own',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [round('n1', { core: 5, tries: 5, right: 5, ownWords: 0, generated: 6 }, 10)],
      },
      expect: [],
    },
    {
      name: 'a pass the teacher helped with is not real',
      lesson: ACTIVITY_EXAMPLE_LESSON,
      timelines: {
        alex: [
          round('n1', { core: 5, tries: 5, right: 5, ownWords: 12, generated: 6 }, 10, {
            assisted: true,
          }),
        ],
      },
      expect: [],
    },
  ],
})
