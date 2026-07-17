import React from 'react'
import ConfidenceQuiz from './quiz/ConfidenceQuiz'
import FillBlankQuiz from './quiz/FillBlankQuiz'
import MatchQuiz from './quiz/MatchQuiz'
import MultipleChoiceQuiz from './quiz/MultipleChoiceQuiz'
import ShortAnswerQuiz from './quiz/ShortAnswerQuiz'

export { CONFIDENCE_COLOURS, getQuizOptionText } from './quiz/quizUtils'

export default function QuizTask({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted = false,
  checkPassed = false,
  disabled = false,
  showQuestion = false,
  showResult = true,
  showCorrectAnswer = false,
}) {
  const quizType = task?.quizType ?? 'multiple_choice'
  const props = { task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }

  if (quizType === 'match') return <MatchQuiz {...props} />
  if (quizType === 'fill_blank') return <FillBlankQuiz {...props} />
  if (quizType === 'short_answer') return <ShortAnswerQuiz {...props} />
  if (quizType === 'confidence') return <ConfidenceQuiz {...props} />
  return <MultipleChoiceQuiz {...props} />
}
