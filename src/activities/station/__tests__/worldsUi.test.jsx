import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StationStudentView } from '../ui.jsx'
import station from '../definition.js'
import { spotById } from '../station.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// The zoo and toy shop worlds on screen: the glow while an animal is held, a wrong drop blinking
// and going back, a right drop snapping, and the toy catalogue in its order.

const zoo = (items, extra = {}) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'station',
  world: 'zoo',
  items,
  ...extra,
})
const toy = (items) => ({ ...zoo(items), world: 'toyshop' })

function renderStation(t) {
  return renderActivityUi(StationStudentView, { task: t, initialState: station.initialState(t) })
}

function sizeScene() {
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
}

// The pointer position (1000 x 625 scene) of a spot's centre.
const at = (spotId) => {
  const s = spotById(spotId)
  return { clientX: (s.x + s.w / 2) * 1000, clientY: (s.y + s.h / 2) * 625 }
}

function drag(el, to, from = { clientX: 20, clientY: 20 }) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, ...from })
  fireEvent.pointerMove(el, { pointerId: 1, ...to })
  fireEvent.pointerUp(el, { pointerId: 1, ...to })
}

describe('Station UI - zoo world', () => {
  const t = zoo([{ id: 'sort', goal: 'sort' }])

  it('shows the zoo, the animal tray and the sort card', () => {
    renderStation(t)
    expect(screen.getByRole('group', { name: 'Your zoo' })).toBeInTheDocument()
    expect(screen.getByTestId('station-tray')).toHaveTextContent('Animals')
    expect(within(screen.getByTestId('station-tray')).getAllByRole('button')).toHaveLength(9)
    expect(screen.getByTestId('sorted-sort')).toHaveTextContent('0 of 9 at home')
    expect(screen.getByTestId('goal-sort')).toHaveTextContent('Drag each animal')
    expect(screen.queryByTestId('section-left')).not.toBeInTheDocument()
  })

  it('says how many are in the wrong home, so the count matches the tray', () => {
    renderStation(
      zoo(
        [
          { id: 'keeper', goal: 'undo_mistakes' },
          { id: 'sort', goal: 'sort' },
        ],
        { mistakes: [{ part: 'grass-lion', spot: 'ice-2' }] }
      )
    )
    expect(within(screen.getByTestId('station-tray')).getAllByRole('button')).toHaveLength(8)
    expect(screen.getByTestId('sorted-sort')).toHaveTextContent('0 of 9 at home')
    expect(screen.getByTestId('sorted-wrong-sort')).toHaveTextContent('1 in the wrong home')
  })

  it('shows no wrong-home line when nothing is misplaced', () => {
    renderStation(t)
    expect(screen.queryByTestId('sorted-wrong-sort')).not.toBeInTheDocument()
  })

  it("lights the animal's own enclosure while it is held", () => {
    renderStation(t)
    sizeScene()
    const lion = screen.getByTestId('tray-grass-lion')
    fireEvent.pointerDown(lion, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(lion, { pointerId: 1, clientX: 400, clientY: 300 })
    expect(screen.getByTestId('enclosure-grass')).toHaveClass('is-home')
    expect(screen.queryByTestId('enclosure-ice')).not.toBeInTheDocument()
    fireEvent.pointerCancel(lion, { pointerId: 1 })
    expect(screen.queryByTestId('enclosure-grass')).not.toBeInTheDocument()
  })

  it('a drag into its own enclosure snaps and records drag', () => {
    const { state } = renderStation(t)
    sizeScene()
    drag(screen.getByTestId('tray-grass-lion'), at('grass-2'))
    expect(state().scene.placed['grass-2']).toBe('grass-lion')
    expect(screen.getByTestId('part-grass-lion')).toBeInTheDocument()
    expect(screen.getByTestId('sorted-sort')).toHaveTextContent('1 of 9 at home')
  })

  it('a drag into the wrong enclosure blinks it, goes back and is counted', () => {
    const { state } = renderStation(t)
    sizeScene()
    drag(screen.getByTestId('tray-grass-lion'), at('ice-2'))
    expect(state().scene.placed).toEqual({})
    expect(screen.getByTestId('tray-grass-lion')).toBeInTheDocument()
    expect(screen.getByTestId('enclosure-ice')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('tray-grass-lion')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('station-hint')).toHaveTextContent("doesn't live there")
    expect(state().wrongDrops).toBe(1)
  })

  it('click to pick up and click to drop works too', () => {
    const { state } = renderStation(t)
    sizeScene()
    fireEvent.click(screen.getByTestId('tray-ice-penguin'), { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByTestId('spot-ice-2'))
    expect(state().scene.placed['ice-2']).toBe('ice-penguin')
    expect(state().done.sort).toBeUndefined()
  })
})

describe('Station UI - toy shop world', () => {
  it('lists the toys in catalogue order, the rainbow castle last', () => {
    renderStation(toy([{ id: 'o', goal: 'order_part', card: 'toy-kite' }]))
    const rows = within(screen.getByTestId('station-catalogue')).getAllByRole('listitem')
    expect(rows).toHaveLength(8)
    expect(rows[0]).toHaveTextContent('Teddy bear')
    expect(rows[7]).toHaveTextContent('Rainbow castle')
    expect(screen.getByRole('group', { name: 'The toy shop window' })).toBeInTheDocument()
  })

  it('orders a toy and drags it into the window', () => {
    const t = toy([
      { id: 'o', goal: 'order_part', target: 'toy-robot' },
      { id: 'p', goal: 'place_part', target: 'toy-robot' },
    ])
    const { state } = renderStation(t)
    sizeScene()
    fireEvent.click(screen.getByTestId('order-toy-robot'))
    expect(state().done.o).toBeDefined()
    drag(screen.getByTestId('tray-toy-robot'), at('shelf-2'))
    expect(state().scene.placed['shelf-2']).toBe('toy-robot')
    expect(state().done.p.method).toBe('drag')
  })
})
