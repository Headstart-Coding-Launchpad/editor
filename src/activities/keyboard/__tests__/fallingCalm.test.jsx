import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import keyboard from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// The calm Falling code screen (sketch OK'd 21 Nov 2026): the play area is there before the
// round with one big Start inside it, no word list, only the timer; Score / Cleared / Missed
// appear once the round is playing.
const FALLING = {
  id: 2,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'falling_words',
  durationSeconds: 30,
  words: ['print(', '</p>'],
}

function renderFalling(options = {}) {
  return renderActivityUi(KeyboardStudentView, {
    task: FALLING,
    initialState: keyboard.initialState(FALLING),
    ...options,
  })
}

describe('Falling code calm layout', () => {
  it('before Start: the play area holds one Start, only the timer shows, no word list', () => {
    renderFalling()
    const area = screen.getByTestId('falling-area')
    expect(within(area).getByTestId('falling-start')).toHaveTextContent('Start (30 seconds)')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByTestId('falling-time')).toHaveTextContent('30s')
    expect(screen.queryByText(/^Score/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Cleared/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Missed/)).not.toBeInTheDocument()
    expect(screen.queryByText('print(')).not.toBeInTheDocument()
  })

  it('while playing: the stats show and the Start is gone', () => {
    renderFalling()
    fireEvent.click(screen.getByTestId('falling-start'))
    expect(screen.queryByTestId('falling-start')).not.toBeInTheDocument()
    expect(screen.getByText('Score 0')).toBeInTheDocument()
    expect(screen.getByText('Cleared 0')).toBeInTheDocument()
    expect(screen.getByText('Missed 0')).toBeInTheDocument()
  })

  it('the play area is a keyboard application only while playing', () => {
    renderFalling()
    expect(screen.queryByRole('application')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('falling-start'))
    expect(screen.getByRole('application')).toHaveAttribute('data-keyboard-practice', 'true')
  })

  it('a finished round reloaded shows no full timer beside Round complete', () => {
    const state = {
      v: 1,
      items: { round: { mode: 'falling_words', cleared: 7, missed: 2, score: 80, done: true } },
    }
    renderFalling({ initialState: state })
    expect(screen.getByText('Round complete!')).toBeInTheDocument()
    expect(screen.queryByTestId('falling-time')).not.toBeInTheDocument()
    expect(screen.getByTestId('falling-start')).toHaveTextContent('Play again')
  })

  it('the tutor still sees the word list and no Start', () => {
    renderFalling({ readOnly: true })
    expect(screen.getByText('print(')).toBeInTheDocument()
    expect(screen.queryByTestId('falling-start')).not.toBeInTheDocument()
  })
})
