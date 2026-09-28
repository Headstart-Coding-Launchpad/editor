import { QuizActivityStudentView, makeItemsCardSummary } from '../quiz/QuizActivityViews.jsx'
import definition from './definition.js'

// The existing match component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: makeItemsCardSummary(definition),
  ownsLayout: true,
}
