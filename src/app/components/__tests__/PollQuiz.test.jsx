import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import QuizTask from '../QuizTask'
import { PollTaskClassContext } from '../quiz/PollTaskClassContext'

const task = {
  id: 4,
  taskType: 'quiz',
  quizType: 'poll',
  explainer: 'What next?',
  options: [
    { id: 'a', text: 'Games' },
    { id: 'b', text: 'Art' },
  ],
}

const session = {
  attemptLog: {
    s2: { 4: { x: { submission: 'a', loggedAt: 1 } } },
  },
}

function renderPoll({ value, selectedAnswer = '', taskOverrides = {} } = {}) {
  return render(
    <PollTaskClassContext.Provider value={value}>
      <QuizTask
        task={{ ...task, ...taskOverrides }}
        showQuestion
        selectedAnswer={selectedAnswer}
        onSelectAnswer={() => {}}
      />
    </PollTaskClassContext.Provider>
  )
}

describe('PollQuiz class split', () => {
  it('shows nothing before the student chooses', () => {
    renderPoll({ value: { session, anonymousId: 's1', presentation: false } })
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
  })

  it("shows the class split, including the student's own pick, once they choose", () => {
    renderPoll({ value: { session, anonymousId: 's1', presentation: false }, selectedAnswer: 'b' })
    expect(screen.getByLabelText('Poll results')).toBeInTheDocument()
    expect(screen.getByText(/2 answered/)).toBeInTheDocument()
    expect(screen.getAllByText(/1 · 50%/)).toHaveLength(2)
  })

  it('shows the presentation the split live without a pick', () => {
    renderPoll({ value: { session, anonymousId: null, presentation: true } })
    expect(screen.getByText(/1 · 100%/)).toBeInTheDocument()
  })

  it('keeps it private with showResults: false, and outside a live lesson', () => {
    renderPoll({
      value: { session, anonymousId: 's1', presentation: true },
      selectedAnswer: 'b',
      taskOverrides: { showResults: false },
    })
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
  })

  it('shows no split without a live session (Builder preview, solo)', () => {
    renderPoll({ value: null, selectedAnswer: 'b' })
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
  })
})
