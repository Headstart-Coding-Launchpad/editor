import { createContext } from 'react'

// The live class split for poll tasks (`quizType: poll`): StudentView provides
// `{ session, anonymousId, presentation }` during a live lesson and on the presentation window,
// and PollQuiz tallies the class's choices from it (tallyPollTask in src/shared/classPolls.js).
// ShortAnswerQuiz reads it too, for the answers the teacher shows on the presentation window
// (src/shared/shownResponses.js).
// Absent (null) everywhere else, such as the Builder preview, solo and the teacher's modals.
export const PollTaskClassContext = createContext(null)
