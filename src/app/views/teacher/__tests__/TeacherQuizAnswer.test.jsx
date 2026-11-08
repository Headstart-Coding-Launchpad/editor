import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TeacherQuizAnswer from '../TeacherQuizAnswer'

const MC = {
  id: 6,
  title: 'What does a loop do?',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  explainer: 'What does a loop do?',
  options: [
    { id: 'a', text: 'Repeats code' },
    { id: 'b', text: 'Stops the program' },
    { id: 'c', text: 'Prints text' },
    { id: 'd', text: 'Makes a variable' },
  ],
  check: { type: 'answer_equals', value: 'a' },
}

const students = [
  { anonymousId: '1', displayName: 'Ava', currentAnswer: 'a' },
  { anonymousId: '2', displayName: 'Ben', currentAnswer: 'b' },
  { anonymousId: '3', displayName: 'Cai', currentAnswer: 'a' },
  { anonymousId: '4', displayName: 'Omar', currentAnswer: null },
]

describe('TeacherQuizAnswer — multiple choice', () => {
  it('shows the real option text, ticks the correct one and counts each option', () => {
    render(<TeacherQuizAnswer task={MC} students={students} classIsHere />)
    const a = screen.getByTestId('quiz-answer-option-a')
    expect(a).toHaveTextContent('Repeats code')
    expect(a).toHaveTextContent('Correct answer')
    expect(a).toHaveTextContent('2 students')
    expect(screen.getByTestId('quiz-answer-option-b')).toHaveTextContent('Stops the program')
    expect(screen.getByTestId('quiz-answer-option-b')).toHaveTextContent('1 student')
    expect(screen.getByTestId('quiz-answer-option-b')).not.toHaveTextContent('Correct answer')
    expect(screen.getByTestId('quiz-answer-option-d')).toHaveTextContent('0 students')
    const notYet = screen.getByTestId('quiz-answer-not-answered')
    expect(notYet).toHaveTextContent('Not answered yet (1)')
    expect(within(notYet).getByText('Omar')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-answer-summary')).toHaveTextContent('3 of 4 answered, 2 right')
  })

  it('shows options and the tick but no counts while previewing a task the class is not on', () => {
    render(<TeacherQuizAnswer task={MC} students={students} classIsHere={false} />)
    expect(screen.getByTestId('quiz-answer-option-a')).toHaveTextContent('Correct answer')
    expect(screen.getByTestId('quiz-answer-option-a')).not.toHaveTextContent('students')
    expect(screen.queryByTestId('quiz-answer-not-answered')).not.toBeInTheDocument()
  })
})

describe('TeacherQuizAnswer — short answer', () => {
  const SHORT = {
    id: 7,
    title: 'Explain a loop',
    taskType: 'quiz',
    quizType: 'short_answer',
    check: { type: 'answer_contains', value: 'repeat' },
  }

  it('shows the model answer and the class’s responses, not an empty answer box', () => {
    render(
      <TeacherQuizAnswer
        task={SHORT}
        classIsHere
        students={[
          {
            anonymousId: '1',
            displayName: 'Ava',
            currentAnswer: 'It repeats code',
            lastRunStatus: 'submitted',
            checkPassed: true,
          },
          { anonymousId: '2', displayName: 'Ben', currentAnswer: '', lastRunStatus: null },
        ]}
      />
    )
    expect(screen.getByTestId('short-answer-model')).toHaveTextContent('Must contain')
    expect(screen.getByTestId('short-answer-model')).toHaveTextContent('repeat')
    expect(screen.getByTestId('short-answer-responses')).toHaveTextContent('Ava')
    expect(screen.getByTestId('short-answer-responses')).toHaveTextContent('It repeats code')
    expect(screen.getByTestId('quiz-answer-not-answered')).toHaveTextContent('Ben')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
