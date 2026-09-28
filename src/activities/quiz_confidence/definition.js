// Confidence check (legacy `taskType: 'quiz'`, `quizType: 'confidence'`). State: "1".."5".
// A rating is never right or wrong (`completion: 'none'`, ungraded): choosing one records it
// as a response (logged with passed: true) so the session report can show the distribution.
import { defineQuizActivity, normalizeConfidenceRating } from '../quiz/quizActivity.js'

const RATING = /^[1-5]$/

export default defineQuizActivity('confidence', {
  description: 'Students rate how confident they feel, from 1 to 5.',
  completion: 'none',

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    taskType: 'quiz',
    quizType: 'confidence',
    explainer: prev.explainer ?? 'How confident do you feel?',
    check: null,
  }),

  initialState: () => '',
  serialize: (state) => (typeof state === 'string' ? state : ''),
  deserialize: (raw) => (typeof raw === 'string' && RATING.test(raw) ? raw : ''),

  isGraded: () => false,
  grade: () => ({ passed: true, suggestion: '' }),

  summarize: (task, state) => ({ text: `${parseInt(state)}/5`, tone: 'neutral' }),

  report: {
    typeFields: () => ({ taskType: 'quiz', quizType: 'confidence' }),
    normalizeSubmission: (task, submission) => normalizeConfidenceRating(submission),
    // The latest rating per student.
    summaryFields: (task, perStudent) => {
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const t of perStudent) {
        const latest = t.distinctAttempts[t.distinctAttempts.length - 1]
        const rating = Number(latest?.submission)
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
          ratingDistribution[rating] += 1
        }
      }
      return { ratingDistribution }
    },
  },
})
