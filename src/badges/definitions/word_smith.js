import { defineBadge } from '../defineBadge.js'
import { firstTryOnEveryPatternTask } from '../rules.js'
import { attemptEvent, overrideEvent } from '../timeline.js'

// Vocab tasks are any quiz tagged `taskActivity: Quiz: Vocabulary Check` or `Quiz: Vocabulary
// Match` (src/shared/taskActivity.js), whatever its quizType, as long as it is graded (not a
// confidence check, poll, or short answer without a check). Suggested only: the tutor decides.
const VOCAB_PATTERNS = ['quiz_vocabulary_check', 'quiz_vocabulary_match']

// The examples' own lesson: three vocab tasks of different quiz types, a vocab confidence check
// (not graded, so never counted) and a quiz that isn't vocab.
const VOCAB_LESSON = {
  id: 'word-smith-examples',
  type: 'python',
  title: 'Word Smith examples',
  tasks: [
    {
      id: 'v1',
      title: 'Match the words',
      taskType: 'quiz',
      quizType: 'match',
      taskActivity: 'Quiz: Vocabulary Match',
    },
    {
      id: 'v2',
      title: 'What is a variable?',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      taskActivity: 'Quiz: Vocabulary Check',
      check: { type: 'answer_equals', value: 'a' },
    },
    {
      id: 'v3',
      title: 'Fill in the word',
      taskType: 'quiz',
      quizType: 'fill_blank',
      taskActivity: 'Quiz: Vocabulary Check',
    },
    {
      id: 'v4',
      title: 'How sure are you?',
      taskType: 'quiz',
      quizType: 'confidence',
      taskActivity: 'Quiz: Vocabulary Check',
    },
    {
      id: 'q1',
      title: 'Spot the error',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      taskActivity: 'Quiz: What Is the Error?',
      check: { type: 'answer_equals', value: 'a' },
    },
  ],
}

const right = (taskId, at) => attemptEvent({ taskId, passed: true, firstTry: true, at })
const wrong = (taskId, at) => attemptEvent({ taskId, passed: false, firstTry: true, at })
const retry = (taskId, at) => attemptEvent({ taskId, passed: true, at })

export default defineBadge({
  id: 'word_smith',
  emoji: '📖',
  title: 'Word Smith',
  blurb: 'Got every vocab question right first time.',
  ruleText:
    'Right first time on every vocab task (taskActivity Quiz: Vocabulary Check or Vocabulary Match, any graded quiz type) they have tried, and at least wordSmithMinTasks (default 2) of them. One vocab task not right first time rules them out for the session; tasks they have not tried yet do not.',
  rule: firstTryOnEveryPatternTask(VOCAB_PATTERNS, { gradedOnly: true }),
  reasonText: ({ count, total }) =>
    count >= total
      ? `Right first time on all ${count} vocab tasks`
      : `Right first time on every vocab task so far (${count} of ${total})`,
  autoAwardable: false,
  examples: [
    {
      name: 'two vocab tasks right first time',
      lesson: VOCAB_LESSON,
      timelines: { alex: [right('v1', 10), right('v2', 20)] },
      expect: [['alex', 'v2']],
    },
    {
      name: 'one vocab task is not enough',
      lesson: VOCAB_LESSON,
      timelines: { alex: [right('v1', 10), right('q1', 20)] },
      expect: [],
    },
    {
      name: 'a vocab task wrong first time rules them out, even when fixed later',
      lesson: VOCAB_LESSON,
      timelines: {
        alex: [right('v1', 10), right('v2', 20), wrong('v3', 30), retry('v3', 40)],
      },
      expect: [],
    },
    {
      name: 'a pass the teacher gave does not count',
      lesson: VOCAB_LESSON,
      timelines: {
        alex: [right('v1', 10), right('v2', 20), overrideEvent({ taskId: 'v2', at: 15 })],
      },
      expect: [],
    },
    {
      name: 'a lesson can ask for all three',
      lesson: VOCAB_LESSON,
      options: { wordSmithMinTasks: 3 },
      timelines: {
        alex: [right('v1', 10), right('v2', 20)],
        sam: [right('v1', 10), right('v2', 20), right('v3', 30)],
      },
      expect: [['sam', 'v3']],
    },
    {
      name: 'an ungraded vocab task counts neither way',
      lesson: VOCAB_LESSON,
      timelines: { alex: [wrong('v4', 5), right('v1', 10), right('v2', 20)] },
      expect: [['alex', 'v2']],
    },
    {
      name: 'quizzes that are not vocab do not count',
      timelines: { alex: [right('q1', 10), right('q2', 20)] },
      expect: [],
    },
  ],
})
