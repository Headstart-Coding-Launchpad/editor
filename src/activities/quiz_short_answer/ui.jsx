import { QuizActivityStudentView, TextCardSummary } from '../quiz/QuizActivityViews.jsx'

// The existing short-answer component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: TextCardSummary,
  ownsLayout: true,
}
