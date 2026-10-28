import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAgentStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { solutionFor } from '../game_agent.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Game agent StudentView with local state (src/test/activityUiHarness.jsx).
// Timers are faked so the paced Train and Go! animations can be stepped. jsdom can't prove
// touch behaviour: check that in a real browser too.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'game_agent',
  map: ['#####', '#R..#', '#.#T#', '#####'],
  episodes: 50,
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'Date',
    ],
  })
})
afterEach(() => vi.useRealTimers())

const advance = (ms) => act(async () => void vi.advanceTimersByTime(ms))

function renderView(options = {}) {
  return renderActivityUi(GameAgentStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

describe('Game agent UI', () => {
  it('shows the grid, the three rewards (no pit) and has no Check button', () => {
    renderView()
    expect(screen.getByTestId('ga-grid').children).toHaveLength(20)
    expect(screen.getByLabelText('Treasure reward')).toHaveTextContent('+10')
    expect(screen.getByLabelText('Each step reward')).toHaveTextContent('-1')
    expect(screen.getByLabelText('Hit a wall reward')).toHaveTextContent('-5')
    expect(screen.queryByLabelText('Fall in a pit reward')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go!' })).toBeDisabled()
  })

  it('steps a reward up and down within -20..20 and forgets the learning', async () => {
    const { state } = renderView({ initialState: { ...solutionFor(TASK) } })
    fireEvent.click(screen.getByRole('button', { name: 'More Treasure' }))
    expect(state().rewards.treasure).toBe(11)
    expect(state()).toMatchObject({ trained: 0, reached: false, bestScore: null })
    for (let i = 0; i < 30; i++)
      fireEvent.click(screen.getByRole('button', { name: 'More Each step' }))
    expect(state().rewards.step).toBe(20)
    expect(screen.getByRole('button', { name: 'More Each step' })).toBeDisabled()
    for (let i = 0; i < 45; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Less Each step' }))
    expect(state().rewards.step).toBe(-20)
  })

  it('trains the set number of tries, then Go! finds the treasure and passes', async () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Train (50 tries)' }))
    expect(state().training).toBe(true)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    await advance(30000)
    expect(state()).toMatchObject({ trained: 50, training: false })
    expect(state().scores).toHaveLength(40)
    expect(screen.getByTestId('ga-curve')).toBeInTheDocument()
    expect(screen.getByTestId('ga-stats')).toHaveTextContent('Tries: 50')

    fireEvent.click(screen.getByRole('button', { name: 'Go!' }))
    expect(state().goes).toBe(0) // the robot is still walking
    await advance(3000)
    expect(state()).toMatchObject({
      goes: 1,
      reached: true,
      moves: 'RRD',
      bestScore: 8,
      bestSteps: 3,
    })
    expect(screen.getByTestId('ga-result')).toHaveTextContent('found the treasure in 3 steps')
    expect(definition.grade(TASK, state()).passed).toBe(true)
    expect(screen.getByText('Your robot found the treasure')).toBeInTheDocument()
  })

  it('Fast trains in a few frames and Stop keeps what has been learned', async () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Fast: off' }))
    expect(screen.getByRole('button', { name: 'Fast: on' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Train (50 tries)' }))
    await advance(100)
    expect(state().trained).toBe(50)

    // Slow: stop after a moment.
    fireEvent.click(screen.getByRole('button', { name: 'Fast: on' }))
    fireEvent.click(screen.getByRole('button', { name: 'Train (50 tries)' }))
    await advance(200)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await advance(100)
    expect(state().training).toBe(false)
    expect(state().trained).toBeGreaterThan(50)
    expect(state().trained).toBeLessThan(100)
  })

  it('shows daft behaviour and a hint with silly rewards', async () => {
    const { state } = renderView({
      initialState: {
        ...definition.initialState(TASK),
        rewards: { treasure: 0, step: 5, wall: -5, pit: -10 },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fast: off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Train (50 tries)' }))
    await advance(40000)
    fireEvent.click(screen.getByRole('button', { name: 'Go!' }))
    await advance(10000)
    expect(state()).toMatchObject({ goes: 1, reached: false })
    expect(screen.getByTestId('ga-result')).toHaveTextContent('missed the treasure')
    expect(screen.getByTestId('ga-result')).toHaveTextContent('worth nothing')
    expect(definition.grade(TASK, state()).passed).toBe(false)
  })

  it('Start again forgets the learning but keeps the rewards', () => {
    const { state } = renderView({ initialState: solutionFor(TASK) })
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(state()).toMatchObject({ trained: 0, reached: false })
    expect(state().rewards).toEqual({ treasure: 10, step: -1, wall: -5, pit: -10 })
  })

  it('clears a stale training flag left by a reload', () => {
    const { state } = renderView({
      initialState: { ...definition.initialState(TASK), training: true },
    })
    expect(state().training).toBe(false)
  })

  it('shows a pit reward when the map has a pit', () => {
    renderView({
      task: { ...TASK, map: ['#####', '#R.X#', '#.#T#', '#...#'] },
    })
    expect(screen.getByLabelText('Fall in a pit reward')).toHaveTextContent('-10')
  })

  it('hides the learning curve when showLearning is false', () => {
    renderView({
      task: { ...TASK, showLearning: false },
      initialState: { ...solutionFor(TASK) },
    })
    expect(screen.queryByTestId('ga-curve')).not.toBeInTheDocument()
  })

  it('readOnly is the tutor view: no buttons, the numbers and the route', () => {
    renderView({
      readOnly: true,
      initialState: { ...solutionFor(TASK), training: true },
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('ga-stats')).toHaveTextContent('(training now)')
    expect(screen.getByTestId('ga-stats')).toHaveTextContent('Best score: 8 (3 steps)')
    expect(screen.getByTestId('ga-result')).toHaveTextContent('found the treasure')
  })
})
