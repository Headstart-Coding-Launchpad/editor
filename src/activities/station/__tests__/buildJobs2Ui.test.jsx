import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StationStudentView } from '../ui.jsx'
import station from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// Review #190 on the screen: switching a power button off, the light pattern card, the second
// start-up card, the clumsy robot's drops and the parts tray under the scene.

const task = (lesson, items, extra = {}) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'station',
  lesson,
  items,
  ...extra,
})

function renderStation(t, options = {}) {
  return renderActivityUi(StationStudentView, {
    task: t,
    initialState: station.initialState(t),
    ...options,
  })
}

const power = (name) => screen.getByRole('button', { name: `${name} power` })

describe('Lesson 1 power buttons toggle', () => {
  const t = task(1, [{ id: 'all', goal: 'power_on' }])
  it('a second click switches the section off again', () => {
    const { state } = renderStation(t)
    fireEvent.click(power('Left wing'))
    expect(state().scene.power.left).toBe(true)
    fireEvent.click(power('Left wing'))
    expect(state().scene.power.left).toBe(false)
  })
})

describe('Lesson 1 light pattern and a second start-up card', () => {
  const t = task(1, [
    { id: 'a', goal: 'power_on', order: ['left', 'core', 'right'] },
    { id: 'b', goal: 'power_on', order: ['right', 'core', 'left'] },
    { id: 'p', goal: 'light_pattern', pattern: { left: 'on', core: 'off', right: 'on' } },
  ])
  it('shows the pattern card and the second card waits its turn', () => {
    renderStation(t)
    expect(screen.getByTestId('card-pattern-p-left')).toHaveAttribute('data-on', 'true')
    expect(screen.getByTestId('card-pattern-p-core')).toHaveAttribute('data-on', 'false')
    expect(screen.getByTestId('card-step-a-left')).toHaveClass('is-next')
    expect(screen.getByTestId('card-step-b-right')).not.toHaveClass('is-next')
  })
  it('plays through all three jobs', () => {
    const { state } = renderStation(t)
    for (const n of ['Left wing', 'Core', 'Right wing']) fireEvent.click(power(n))
    expect(state().done.a).toBeTruthy()
    expect(state().scene.power.left).toBe(false)
    expect(screen.getByTestId('card-step-b-right')).toHaveClass('is-next')
    for (const n of ['Right wing', 'Core', 'Left wing']) fireEvent.click(power(n))
    expect(state().done.b).toBeTruthy()
    for (const n of ['Left wing', 'Core', 'Right wing']) fireEvent.click(power(n))
    fireEvent.click(power('Core'))
    expect(state().done.p.method).toBe('click')
  })
})

describe('Lesson 3 layout and the clumsy robot', () => {
  const mistakes = [{ part: 'greenhouse', spot: 'top-module-2' }]
  const t = task(
    3,
    [
      { id: 'undo', goal: 'undo_mistakes' },
      { id: 'dome', goal: 'place_part', target: 'dome' },
    ],
    { mistakes }
  )
  it('puts the parts tray in the column under the scene, not the goals column', () => {
    renderStation(t)
    const tray = screen.getByTestId('station-tray')
    expect(tray.closest('.act-station__main')).not.toBeNull()
    expect(tray.closest('.act-station__side')).toBeNull()
    const scene = screen.getByTestId('station-scene')
    expect(scene.compareDocumentPosition(tray) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('Lesson 4 keeps the catalogue aside but the tray under the scene', () => {
    renderStation(task(4, [{ id: 'o', goal: 'order_part', target: 'telescope' }]))
    expect(screen.getByTestId('station-tray').closest('.act-station__main')).not.toBeNull()
    expect(screen.getByTestId('station-catalogue').closest('.act-station__side')).not.toBeNull()
  })
  it('marks the drop, and Ctrl+Z puts it back and ticks the job', () => {
    const { state } = renderStation(t)
    expect(screen.getByTestId('part-greenhouse')).toHaveClass('is-mistake')
    expect(screen.getByTestId('mistakes-left-undo')).toHaveTextContent('1 to put back')
    expect(screen.queryByTestId('tray-greenhouse')).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('station-activity'), { key: 'z', ctrlKey: true })
    expect(screen.queryByTestId('part-greenhouse')).not.toBeInTheDocument()
    expect(screen.getByTestId('tray-greenhouse')).toBeInTheDocument()
    expect(state().done.undo.method).toBe('ctrl_z')
    expect(screen.getByTestId('mistakes-left-undo')).toHaveTextContent('All put back')
  })
  it('dragging a drop blinks the card and changes nothing', () => {
    const { state } = renderStation(t)
    screen.getByTestId('station-scene').getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 625,
      width: 1000,
      height: 625,
      x: 0,
      y: 0,
    })
    const part = screen.getByTestId('part-greenhouse')
    fireEvent.pointerDown(part, { pointerId: 1, button: 0, clientX: 600, clientY: 100 })
    fireEvent.pointerMove(part, { pointerId: 1, clientX: 250, clientY: 100 })
    fireEvent.pointerUp(part, { pointerId: 1, clientX: 250, clientY: 100 })
    expect(state().scene.placed['top-module-2']).toBe('greenhouse')
    expect(screen.getByTestId('card-undo')).toHaveAttribute('data-blink')
  })
})
