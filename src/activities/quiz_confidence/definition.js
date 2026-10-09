// Confidence check (legacy `taskType: 'quiz'`, `quizType: 'confidence'`). State: "1".."10".
// A rating is never right or wrong (`completion: 'none'`, ungraded): choosing one records it
// as a response (logged with passed: true) so the session report can show the distribution.
// Every confidence check is rated 1 to 10 (1 to 5 before 2026-10-09); the session report
// records `ratingScale` so old reports, which have none, are read as 1 to 5
// (src/shared/confidenceScale.js).
import {
  CONFIDENCE_SCALE,
  emptyConfidenceDistribution,
  formatConfidence,
  parseConfidenceRating,
} from '../../shared/confidenceScale.js'
import { defineQuizActivity } from '../quiz/quizActivity.js'

const RATING = /^\d{1,2}$/

export default defineQuizActivity('confidence', {
  description: `Students rate how confident they feel, from 1 to ${CONFIDENCE_SCALE}.`,

  // The question is the task's explainer; there are no other fields.
  fields: { task: [] },
  completion: 'none',
  // The rating scale. A capability: the teacher's class spread above the student grid shows
  // for activities that have one.
  ratingScale: CONFIDENCE_SCALE,

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
  deserialize: (raw) =>
    typeof raw === 'string' && RATING.test(raw) && parseConfidenceRating(raw) !== null ? raw : '',

  isGraded: () => false,
  grade: () => ({ passed: true, suggestion: '' }),

  summarize: (task, state) => ({ text: formatConfidence(state), tone: 'neutral' }),

  report: {
    // `ratingScale` says which scale the ratings were given on (absent in older reports: 5).
    typeFields: () => ({
      taskType: 'quiz',
      quizType: 'confidence',
      ratingScale: CONFIDENCE_SCALE,
    }),
    normalizeSubmission: (task, submission) => parseConfidenceRating(submission) ?? submission,
    // The latest rating per student.
    summaryFields: (task, perStudent) => {
      const ratingDistribution = emptyConfidenceDistribution()
      for (const t of perStudent) {
        const latest = t.distinctAttempts[t.distinctAttempts.length - 1]
        const rating = parseConfidenceRating(latest?.submission)
        if (rating !== null) ratingDistribution[rating] += 1
      }
      return { ratingDistribution }
    },
  },
})
