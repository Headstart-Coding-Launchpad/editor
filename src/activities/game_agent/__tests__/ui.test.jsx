import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAgentStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { solutionFor } from '../game_agent.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { countControls } from '../../../test/countControls.js'

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
    expect(screen.getByText('What does it get points for?')).toBeInTheDocument()
    expect(screen.getByTestId('ga-reward-treasure')).toHaveTextContent(/Find the treasure.*\+10/)
    expect(screen.getByTestId('ga-reward-step')).toHaveTextContent(/Each step.*-1/)
    expect(screen.getByTestId('ga-reward-wall')).toHaveTextContent(/Bump a wall.*-5/)
    expect(screen.queryByTestId('ga-reward-pit')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Train$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Watch it try/ })).not.toBeInTheDocument()
    // No tries count, situations or "ways" on the child's screen, and no Start again.
    expect(screen.queryByText(/50 tries|situation|ways/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start again/ })).not.toBeInTheDocument()
  })

  it('keeps the default screen to 5 controls and 7 after training', async () => {
    const { container } = renderView()
    // 3 reward steppers, Train, Slow/Fast switch.
    expect(countControls(container)).toBeLessThanOrEqual(5)
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    await advance(30000)
    // Adds the view switch and Train more; the main button is now Watch it try.
    expect(screen.getByRole('button', { name: /Watch it try/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Train more/ })).toBeInTheDocument()
    expect(countControls(container)).toBeLessThanOrEqual(7)
  })

  it('steps a reward up and down within -20..20 and forgets the learning', async () => {
    const { state } = renderView({ initialState: { ...solutionFor(TASK) } })
    fireEvent.click(screen.getByRole('button', { name: 'More: Find the treasure' }))
    expect(state().rewards.treasure).toBe(11)
    expect(state()).toMatchObject({ trained: 0, reached: false, bestScore: null })
    for (let i = 0; i < 30; i++)
      fireEvent.click(screen.getByRole('button', { name: 'More: Each step' }))
    expect(state().rewards.step).toBe(20)
    expect(screen.getByRole('button', { name: 'More: Each step' })).toBeDisabled()
    for (let i = 0; i < 45; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Less: Each step' }))
    expect(state().rewards.step).toBe(-20)
  })

  it('trains the set number of tries, then Go! finds the treasure and passes', async () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    expect(state().training).toBe(true)
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
    await advance(30000)
    expect(state()).toMatchObject({ trained: 50, training: false })
    expect(state().scores).toHaveLength(40)
    expect(screen.getByTestId('ga-curve')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Watch it try/ }))
    expect(state().goes).toBe(0) // the robot is still walking
    await advance(3000)
    expect(state()).toMatchObject({
      goes: 1,
      reached: true,
      moves: 'RRD',
      bestScore: 8,
      bestSteps: 3,
    })
    expect(screen.getByTestId('ga-result')).toHaveTextContent('Found it in 3 steps')
    expect(definition.grade(TASK, state()).passed).toBe(true)
    // The pass is stated once, by the host banner, not by a second line in the screen.
    expect(screen.queryByText('Your robot found the treasure')).not.toBeInTheDocument()
  })

  it('Fast trains in a few frames and Stop keeps what has been learned', async () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Fast' }))
    expect(screen.getByRole('radio', { name: 'Fast' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    await advance(100)
    expect(state().trained).toBe(50)

    // Slow: pause after a moment.
    fireEvent.click(screen.getByRole('radio', { name: 'Slow' }))
    fireEvent.click(screen.getByRole('button', { name: /Train more/ }))
    await advance(200)
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    await advance(40000)
    fireEvent.click(screen.getByRole('button', { name: /Watch it try/ }))
    await advance(10000)
    expect(state()).toMatchObject({ goes: 1, reached: false })
    expect(screen.getByTestId('ga-result')).toHaveTextContent('Lost!')
    expect(document.body).toHaveTextContent('worth nothing')
    expect(definition.grade(TASK, state()).passed).toBe(false)
  })

  it('a lost robot makes Train more the main button and Watch it try the outline one', async () => {
    renderView({
      initialState: {
        ...definition.initialState(TASK),
        rewards: { treasure: 0, step: 5, wall: -5, pit: -10 },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    await advance(40000)
    fireEvent.click(screen.getByRole('button', { name: /Watch it try/ }))
    await advance(10000)
    expect(screen.getByTestId('ga-train-more')).toHaveClass('act-btn--main')
    expect(screen.getByTestId('ga-watch')).toHaveClass('act-btn--secondary')
  })

  it('offers Try a new course after a lost Watch it try when the lesson has random courses (#340)', async () => {
    const task = { ...TASK, randomCourses: { size: 5, walls: 0.15, pits: 0, seed: 'class' } }
    renderView({
      task,
      initialState: {
        ...definition.initialState(task),
        rewards: { treasure: 0, step: 5, wall: -5, pit: -10 },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    await advance(40000)
    for (let i = 0; i < 20 && screen.queryByTestId('ga-pause'); i++) await advance(40000)
    fireEvent.click(screen.getByRole('button', { name: /Watch it try/ }))
    await advance(10000)
    expect(screen.getByTestId('ga-train-more')).toHaveClass('act-btn--main')
    expect(screen.getByTestId('ga-go-new')).toHaveClass('act-btn--secondary')
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
    expect(screen.getByTestId('ga-reward-pit')).toHaveTextContent(/Fall in a pit.*-10/)
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
    expect(within(screen.getByTestId('ga-reward-treasure')).getByRole('status')).toBeTruthy()
    expect(screen.getByTestId('ga-stats')).toHaveTextContent('(training now)')
    expect(screen.getByTestId('ga-stats')).toHaveTextContent('Best score: 8 (3 steps)')
    expect(screen.getByTestId('ga-result')).toHaveTextContent('Found it in')
  })

  it('keeps the treasure visible when the robot stands on it', () => {
    // A finished Go! leaves the robot on the treasure (cell 13 in TASK's 5-wide map).
    renderView({ initialState: solutionFor(TASK) })
    const cell = screen.getByTestId('ga-grid').querySelector('[data-cell="13"]')
    expect(cell).toHaveTextContent('🤖')
    expect(screen.getByTestId('ga-gem')).toBeInTheDocument()
    expect(cell).toContainElement(screen.getByTestId('ga-gem'))
  })

  it('What it learned draws best-move arrows in open squares only', () => {
    renderView({ initialState: solutionFor(TASK) })
    expect(screen.queryByRole('img', { name: /best move/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'What it learned' }))
    const arrows = screen.getAllByRole('img', { name: /^best move: (up|right|down|left)$/ })
    expect(arrows.length).toBeGreaterThan(0)
    const grid = screen.getByTestId('ga-grid')
    expect(grid.querySelector('[data-cell="0"] .act-ga-cell__best')).toBeNull() // wall
    expect(grid.querySelector('[data-cell="13"] .act-ga-cell__best')).toBeNull() // treasure
  })

  it('offers senses in a closed fold with one compass', () => {
    const task = {
      ...TASK,
      senses: ['walls'],
      maxSenses: 2,
      testMaps: [['#####', '#R.T#', '#####']],
    }
    const { state, container } = renderView({ task, initialState: definition.initialState(task) })
    // The fold is closed: its chips are not on the screen yet.
    expect(screen.queryByTestId('ga-sense-walls')).not.toBeInTheDocument()
    expect(screen.getByTestId('act-fold-senses')).toHaveTextContent('Walls next to me')
    expect(countControls(container)).toBeLessThanOrEqual(6) // 5 plus the fold header
    fireEvent.click(screen.getByRole('button', { name: /What can it sense/ }))
    expect(screen.getByTestId('ga-sense-walls')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('ga-sense-treasure_direction')).toHaveTextContent('Treasure compass')
    expect(screen.queryByTestId('ga-sense-pit_near')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ga-sense-treasure_direction'))
    expect(state().senses).toEqual(['walls', 'treasure_direction'])
    expect(screen.getByTestId('ga-sense-position')).toBeDisabled()
  })

  it('What it senses shows on the map, and Try a new map swaps the map in place', () => {
    const task = {
      ...TASK,
      senses: ['walls', 'treasure_direction'],
      testMaps: [['#####', '#R.T#', '#####']],
    }
    const { state } = renderView({ task, initialState: { ...solutionFor(task) } })
    fireEvent.click(screen.getByRole('radio', { name: 'What it senses' }))
    expect(screen.getByTestId('ga-eye')).toBeInTheDocument()
    const before = state().tests ?? 0
    fireEvent.click(screen.getByTestId('ga-go-new'))
    expect(state().tests).toBe(before + 1)
    expect(screen.getByTestId('ga-mystery')).toBeInTheDocument()
    expect(screen.getByTestId('ga-test-result')).toBeInTheDocument()
    expect(screen.getByTestId('ga-grid').children).toHaveLength(15)
    fireEvent.click(screen.getByRole('button', { name: 'Back to my map' }))
    expect(screen.getByTestId('ga-grid').children).toHaveLength(20)
  })
})
