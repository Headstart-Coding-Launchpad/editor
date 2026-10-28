import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpsMindReaderStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { countControls } from '../../../test/countControls.js'

// UI tests for the Mind Reader StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom cannot prove pointer or touch behaviour: check those in a real browser too.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'rps_mind_reader',
  rounds: 10,
  lookBack: 3,
  passAt: 4,
  panels: ['network', 'history'],
}

function renderView(options = {}) {
  return renderActivityUi(RpsMindReaderStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

afterEach(() => vi.useRealTimers())

describe('Mind Reader UI', () => {
  it('shows a face-down card before the tap, then reveals it', () => {
    vi.useFakeTimers()
    const { state } = renderView()
    expect(screen.getByTestId('mr-card')).toHaveAttribute('data-face', 'down')
    expect(screen.getByText('It has chosen')).toBeInTheDocument()
    // the network's answer is secret too
    expect(screen.getByTestId('mr-out-0')).toHaveAttribute('data-lit', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Paper' }))
    expect(state().moves).toBe('1')
    expect(state().picks).toHaveLength(1)
    expect(screen.getByTestId('mr-card')).toHaveAttribute('data-face', 'up')
    expect(screen.getByText('It had chosen')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^mr-out-/).filter((e) => e.dataset.lit === 'true')).toHaveLength(
      1
    )
    expect(screen.getByTestId('mr-last')).toHaveTextContent(
      /It guessed .* → played .* · you played ✋/
    )
    // taps are held while the card flips
    expect(screen.getByRole('button', { name: 'Rock' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByTestId('mr-card')).toHaveAttribute('data-face', 'down')
    expect(screen.getByRole('button', { name: 'Rock' })).toBeEnabled()
  })

  it('lights the input circles for the last moves', () => {
    renderView({ initialState: { v: 1, lb: 3, moves: '12', picks: '00' } })
    expect(screen.getByTestId('mr-in-0-2')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByTestId('mr-in-1-1')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByTestId('mr-in-0-0')).toHaveAttribute('data-lit', 'false')
  })

  it('shows the score, the read count and the read-rate chart', () => {
    renderView({ initialState: { v: 1, lb: 3, moves: '111', picks: '012' } })
    expect(screen.getByTestId('mr-score')).toHaveTextContent('You 1 – 1 It')
    expect(screen.getByTestId('mr-score')).toHaveTextContent('It read you 1 of last 3')
    expect(screen.getByTestId('mr-history')).toBeInTheDocument()
  })

  it('has at most five visible controls, with the Remembers dial only when asked for', () => {
    const plain = renderView()
    expect(countControls(plain.container)).toBe(3)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    plain.unmount()
    const task = { ...TASK, panels: ['network', 'history', 'lookback'] }
    const view = renderActivityUi(RpsMindReaderStudentView, {
      task,
      initialState: definition.initialState(task),
    })
    expect(countControls(view.container)).toBe(4)
    expect(screen.getByRole('radiogroup', { name: /Remembers/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Remembers 5 moves' }))
    expect(view.state().lb).toBe(5)
    expect(screen.getByTestId('mr-in-4-0')).toBeInTheDocument()
  })

  it('hides the diagram and chart when panels leave them out', () => {
    const task = { ...TASK, panels: [] }
    renderActivityUi(RpsMindReaderStudentView, {
      task,
      initialState: definition.initialState(task),
    })
    expect(screen.queryByTestId('mr-brain')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mr-history')).not.toBeInTheDocument()
  })

  it('offers the random tip after a losing streak', () => {
    // the child plays paper twice against scissors: it wins twice
    renderView({ initialState: { v: 1, lb: 3, moves: '11', picks: '22' } })
    expect(screen.getByText(/Try playing randomly/)).toBeInTheDocument()
  })

  it('finishes after the last round with a Play again that restarts', () => {
    const { state } = renderView({
      initialState: { v: 1, lb: 3, moves: '0000000000', picks: '1111111111' },
    })
    expect(screen.getByTestId('round-finished')).toHaveTextContent('All 10 rounds played!')
    expect(screen.queryByRole('button', { name: 'Rock' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(state()).toEqual({ v: 1, lb: 3, moves: '', picks: '' })
  })

  it('is read-only for a teacher: buttons off, the locked-in pick shown', () => {
    renderView({ readOnly: true, initialState: definition.solutionState(TASK) })
    expect(screen.getByRole('button', { name: 'Rock' })).toBeDisabled()
    expect(screen.getByTestId('mr-card')).toHaveAttribute('data-face', 'up')
    expect(screen.getByText(/hidden from the student/)).toBeInTheDocument()
    expect(screen.queryByText(/Try playing randomly/)).not.toBeInTheDocument()
  })

  it('plays a whole game by clicking', () => {
    vi.useFakeTimers()
    const { state } = renderView()
    for (let r = 0; r < 10; r += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Rock' }))
      act(() => vi.advanceTimersByTime(1200))
    }
    expect(state().moves).toBe('0000000000')
    expect(screen.getByTestId('round-finished')).toBeInTheDocument()
    expect(definition.grade(TASK, state()).passed).toBe(true)
  })
})
