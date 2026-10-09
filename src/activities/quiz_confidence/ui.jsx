import React from 'react'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { ConfidenceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'

// Builder editor: a confidence check has nothing to configure (moved from TaskEditor, unchanged).
export function ConfidenceBuilderNote() {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        fontFamily: 'var(--font-body)',
        fontSize: '0.86rem',
        color: '#6b7280',
      }}
    >
      Students rate their confidence 1–10 (red to green). No options or check needed — any rating
      counts as complete.
    </div>
  )
}

// The existing confidence component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: ConfidenceCardSummary,
  ownsLayout: true,
  BuilderEditor: ConfidenceBuilderNote,
  BuilderIcon: () => <QuizTypeIcon type="confidence" />,
  builderHint: 'Rate 1–10',
  builderConvert: (task) => switchQuizType(task, 'confidence'),
}
