import { ConfidenceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'

// The existing confidence component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: ConfidenceCardSummary,
  ownsLayout: true,
}
