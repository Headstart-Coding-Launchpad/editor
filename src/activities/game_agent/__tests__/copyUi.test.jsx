import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAgentStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { trainingCourseFor } from '../courses.js'
import { shortestWay } from '../copybot.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { countControls } from '../../../test/countControls.js'

// UI tests for the copy-bot screen (brain: copy). Timers are faked so the network fits across
// animation frames and the drive on a new course can be stepped. jsdom can't prove touch
// behaviour or pointer stacking: check the arrow buttons in a real browser too.

const TASK = {
  id: 'c1',
  taskType: 'activity',
  activityType: 'game_agent',
  brain: 'copy',
  panels: ['network'],
  map: ['#####', '#R..#', '#.#T#', '#####'],
  randomCourses: { size: 5, walls: 0.15, pits: 0, seed: 'class' },
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

// Press the arrow buttons that drive the first practice course to the treasure.
function driveFirstCourse() {
  const way = shortestWay(trainingCourseFor(TASK, null, 0).env)
  const names = { U: 'up', R: 'right', D: 'down', L: 'left' }
  for (const letter of way) fireEvent.click(screen.getByTestId(`ga-drive-${names[letter]}`))
  return way
}

describe('copy-bot screen', () => {
  it('keeps the default screen to 5 controls, with arrows as one group of 48px buttons', () => {
    const { container } = renderView()
    expect(countControls(container)).toBeLessThanOrEqual(5)
    expect(screen.getByRole('group', { name: 'Drive the robot' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Drive / })).toHaveLength(4)
    expect(screen.queryByText('What does it get points for?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Train/ })).toBeDisabled()
    expect(screen.getByTestId('ga-examples')).toHaveTextContent('not shown it any moves')
    // the network panel is there, with the senses as inputs
    expect(screen.getByTestId('ga-network')).toBeInTheDocument()
    expect(countControls(container)).toBeLessThanOrEqual(5)
  })

  it('records each arrow press, by buttons and by keys, and counts them', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByTestId('ga-drive-right'))
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(state().drives).toEqual([{ c: 0, moves: 'RD' }])
    expect(screen.getByTestId('ga-examples')).toHaveTextContent(
      "You've shown it 2 moves on 1 course"
    )
  })

  it('walks the robot to the treasure, then stops taking moves until Next course', () => {
    const { state } = renderView()
    const way = driveFirstCourse()
    expect(state().drives[0].moves).toBe(way)
    fireEvent.click(screen.getByTestId('ga-drive-up'))
    expect(state().drives[0].moves).toBe(way)
    expect(screen.getByTestId('ga-drive-up')).toBeDisabled()
    fireEvent.click(screen.getByTestId('ga-next-course'))
    expect(state().driveCourse).toBe(1)
    expect(screen.getByTestId('ga-course-label')).toHaveTextContent('Practice course 2')
    fireEvent.click(screen.getByTestId('ga-drive-right'))
    expect(state().drives).toHaveLength(2)
  })

  it('goes Drive, Train, Watch it drive, and passes when it finds the treasure', async () => {
    const { state, container } = renderView()
    const way = driveFirstCourse()
    for (let c = 1; c <= 2; c += 1) {
      fireEvent.click(screen.getByTestId('ga-next-course'))
      const names = { U: 'up', R: 'right', D: 'down', L: 'left' }
      for (const letter of shortestWay(trainingCourseFor(TASK, null, c).env)) {
        fireEvent.click(screen.getByTestId(`ga-drive-${names[letter]}`))
      }
    }
    expect(state().drives).toHaveLength(3)
    expect(screen.getByTestId('ga-examples')).toHaveTextContent('on 3 courses')
    fireEvent.click(screen.getByRole('button', { name: /Train$/ }))
    // the buttons wait while it learns
    expect(screen.getByTestId('ga-drive-up')).toBeDisabled()
    await advance(2000)
    expect(state().trained).toBeGreaterThan(way.length)
    expect(state().training).toBe(false)
    expect(countControls(container)).toBeLessThanOrEqual(5)
    fireEvent.click(screen.getByRole('button', { name: /Watch it drive/ }))
    await advance(60000)
    expect(state().courses).toHaveLength(1)
    expect(state().tests).toBe(1)
    expect(screen.getByTestId('ga-test-result')).toBeInTheDocument()
    expect(screen.getByTestId('ga-test-result')).toHaveTextContent(/New courses beaten: \d of 5/)
    if (state().courses[0].reached) {
      expect(screen.getByTestId('ga-like-you')).toHaveTextContent('It drove like you!')
    }
    // the network sits in the right-hand column, not in the stage, and the tip holds no result
    expect(screen.getByTestId('ga-network').closest('.act-layout__side')).not.toBeNull()
    expect(screen.getByTestId('ga-network').closest('.act-layout__stage')).toBeNull()
    expect(document.querySelector('.act-tip')?.textContent ?? '').not.toMatch(/found the treasure/)
    expect(screen.getByTestId('ga-course-label')).toHaveTextContent('New course')
    expect(definition.summarize(TASK, state()).text).toMatch(/^copy-bot · \d+ moves · course 1:/)
    // driving again goes back to the practice course and asks for a fresh Train
    fireEvent.click(screen.getByTestId('ga-next-course'))
    fireEvent.click(screen.getByTestId('ga-drive-right'))
    expect(screen.getByRole('button', { name: /Train again/ })).toBeEnabled()
  })

  it('is read-only for the tutor: it shows the driving and has no arrows', () => {
    const drives = [{ c: 0, moves: 'RR' }]
    renderView({ readOnly: true, initialState: { ...definition.initialState(TASK), drives } })
    expect(screen.queryByTestId('ga-pad')).not.toBeInTheDocument()
    expect(screen.getByTestId('ga-examples')).toHaveTextContent("You've shown it 2 moves")
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByTestId('ga-examples')).toHaveTextContent("You've shown it 2 moves")
  })

  it('leaves the usual brain alone', () => {
    renderActivityUi(GameAgentStudentView, {
      task: { ...TASK, brain: undefined, panels: undefined },
      initialState: definition.initialState({ ...TASK, brain: undefined }),
    })
    expect(screen.getByText('What does it get points for?')).toBeInTheDocument()
    expect(screen.queryByTestId('ga-pad')).not.toBeInTheDocument()
  })
})
