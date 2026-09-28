// Thin re-export kept for older imports. Each quiz sub-type's editor now lives in its activity's
// ui.jsx (`BuilderEditor`), and the quiz-type picker is driven by the activity registry
// (ActivityPickers.jsx). See docs/architecture/activities.md.
export { QuizTypePicker } from './ActivityPickers'
export { MatchPairsBuilder } from '../../../activities/quiz_match/ui.jsx'
export { FillBlankBuilder } from '../../../activities/quiz_fill_blank/ui.jsx'
export { ShortAnswerBuilder } from '../../../activities/quiz_short_answer/ui.jsx'
export { QuizOptionsBuilder } from '../../../activities/quiz_multiple_choice/ui.jsx'
