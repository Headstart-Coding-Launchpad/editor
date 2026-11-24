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

const tiles = () => screen.getAllByRole('radio')
const tileResults = () => screen.queryAllByTestId('poll-tile-result')

describe('PollQuiz class split', () => {
  it('shows nothing before the student chooses', () => {
    renderPoll({ value: { session, anonymousId: 's1', presentation: false } })
    expect(tileResults()).toHaveLength(0)
    expect(screen.queryByText(/answered/)).not.toBeInTheDocument()
  })

  it("shows the class split on the tiles, including the student's own pick, once they choose", () => {
    renderPoll({ value: { session, anonymousId: 's1', presentation: false }, selectedAnswer: 'b' })
    expect(screen.getByText(/2 answered/)).toBeInTheDocument()
    expect(tiles()[0]).toHaveTextContent('1 · 50%')
    expect(tiles()[1]).toHaveTextContent('1 · 50%')
    // The chosen tile is filled with its colour, so its bar turns white.
    expect(tileResults()[1]).toHaveClass('poll-tile-result--on-dark')
    expect(tileResults()[0]).not.toHaveClass('poll-tile-result--on-dark')
  })

  it('shows the presentation the split live without a pick', () => {
    renderPoll({ value: { session, anonymousId: null, presentation: true } })
    expect(tiles()[0]).toHaveTextContent('1 · 100%')
  })

  it('keeps it private with showResults: false, and outside a live lesson', () => {
    renderPoll({
      value: { session, anonymousId: 's1', presentation: true },
      selectedAnswer: 'b',
      taskOverrides: { showResults: false },
    })
    expect(tileResults()).toHaveLength(0)
    expect(screen.queryByText(/answered/)).not.toBeInTheDocument()
  })

  it('shows no split without a live session (Builder preview, solo)', () => {
    renderPoll({ value: null, selectedAnswer: 'b' })
    expect(tileResults()).toHaveLength(0)
  })
})

// The Fun moment (sketch OK'd 24 Nov 2026): the projected poll fits on one screen. Each tile
// carries its own count, percentage and thin bar; the repeated results list is gone.
describe('poll results on the tiles', () => {
  it('puts each count and percentage on its own tile and drops the repeated list', () => {
    renderPoll({ value: { session, anonymousId: null, presentation: true } })
    expect(tiles()[0]).toHaveTextContent('1 · 100%')
    expect(tiles()[1]).toHaveTextContent('0 · 0%')
    expect(tileResults()).toHaveLength(2)
    expect(screen.queryByLabelText('Poll results')).not.toBeInTheDocument()
    expect(screen.getAllByText(/answered/)).toHaveLength(1)
    expect(screen.getByText(/1 answered/)).toBeInTheDocument()
  })

  it('shows empty bars and 0 answered before anyone votes', () => {
    renderPoll({ value: { session: {}, anonymousId: null, presentation: true } })
    expect(screen.getByText(/0 answered/)).toBeInTheDocument()
    for (const tile of tiles()) expect(tile).toHaveTextContent('0 · 0%')
    for (const fill of screen.getAllByTestId('poll-tile-fill')) expect(fill.style.width).toBe('0%')
  })

  it("fills each tile's bar to its share", () => {
    renderPoll({ value: { session, anonymousId: null, presentation: true } })
    const fills = screen.getAllByTestId('poll-tile-fill')
    expect(fills.map((fill) => fill.style.width)).toEqual(['100%', '0%'])
  })

  it('a multiple-answer poll says how many picked each tile', () => {
    renderPoll({
      value: { session, anonymousId: null, presentation: true },
      taskOverrides: { multiple: true },
    })
    expect(screen.getAllByRole('checkbox')[0]).toHaveTextContent('1 of 1 picked this')
  })
})
