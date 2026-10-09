import React from 'react'
import ConfidenceQuiz from './quiz/ConfidenceQuiz'
import FillBlankQuiz from './quiz/FillBlankQuiz'
import MatchQuiz from './quiz/MatchQuiz'
import MultipleChoiceQuiz from './quiz/MultipleChoiceQuiz'
import PollQuiz from './quiz/PollQuiz'
import ShortAnswerQuiz from './quiz/ShortAnswerQuiz'

export { CONFIDENCE_COLOURS, getQuizOptionText } from './quiz/quizUtils'

export default function QuizTask({
  task,
  selectedAnswer,
  onSelectAnswer,
  // (text) => void: the unsubmitted text typed so far (short answer, typed gaps), for the tutor.
  onDraftChange,
  submitted = false,
  checkPassed = false,
  disabled = false,
  showQuestion = false,
  showResult = true,
  showCorrectAnswer = false,
}) {
  const quizType = task?.quizType ?? 'multiple_choice'
  const props = {
    task,
    selectedAnswer,
    onSelectAnswer,
    onDraftChange,
    submitted,
    checkPassed,
    disabled,
    showQuestion,
    showResult,
    showCorrectAnswer,
  }

  if (quizType === 'match') return <MatchQuiz {...props} />
  if (quizType === 'fill_blank') return <FillBlankQuiz {...props} />
  if (quizType === 'short_answer') return <ShortAnswerQuiz {...props} />
  if (quizType === 'confidence') return <ConfidenceQuiz {...props} />
  if (quizType === 'poll') return <PollQuiz {...props} />
  return <MultipleChoiceQuiz {...props} />
}
