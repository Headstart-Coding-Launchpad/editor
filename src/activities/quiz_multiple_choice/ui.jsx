import { ChoiceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'

// The existing multiple-choice component (via QuizTask), hosted as an activity. `ownsLayout`:
// the quiz renders its own question panel and full-height layout, so the host adds no header
// or act-host frame.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: ChoiceCardSummary,
  ownsLayout: true,
}
