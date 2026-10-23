import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StationStudentView } from '../ui.jsx'
import station from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// Build jobs on the screen (Hub #101): the target cards, a refused step blinking, decoy crates,
// the sticker reader, exact counts and the undo count.

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

function sizeScene() {
  const el = screen.getByTestId('station-scene')
  el.getBoundingClientRect = () => ({
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

function drag(el, to, from = { clientX: 20, clientY: 20 }) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, ...from })
  fireEvent.pointerMove(el, { pointerId: 1, ...to })
  fireEvent.pointerUp(el, { pointerId: 1, ...to })
}

describe('Station build jobs - Lesson 1', () => {
  const t = task(1, [
    { id: 'order', goal: 'power_on', order: ['left', 'core', 'right'] },
    { id: 'match', goal: 'pick_colour', target: 'hull', match: 'red' },
  ])

  it('shows the order card, and a wrong next button blinks and changes nothing', () => {
    const { state } = renderStation(t)
    expect(screen.getByTestId('card-order')).toBeInTheDocument()
    expect(screen.getByTestId('card-step-order-left')).toHaveClass('is-next')
    expect(screen.getByTestId('card-step-order-core')).not.toHaveClass('is-next')
    const before = state()
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(state().scene.power.core).toBe(false)
    expect(state().undo).toEqual(before.undo)
    expect(screen.getByTestId('section-core')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('card-order')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('station-hint')).toHaveTextContent('switch them on in that order')
  })

  it('a second wrong press restarts the blink, and the right order finishes the goal', () => {
    const { state } = renderStation(t)
    fireEvent.click(screen.getByRole('button', { name: 'Right wing power' }))
    const first = screen.getByTestId('section-right').getAttribute('data-blink')
    fireEvent.click(screen.getByRole('button', { name: 'Right wing power' }))
    expect(screen.getByTestId('section-right').getAttribute('data-blink')).not.toBe(first)
    for (const name of ['Left wing power', 'Core power', 'Right wing power']) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    expect(state().done.order.method).toBe('click')
    expect(screen.getByTestId('card-step-order-left')).toHaveClass('is-done')
  })

  it('shows the colour card; only the matching swatch completes it', () => {
    const { state } = renderStation(t)
    expect(screen.getByTestId('card-colour-match')).toHaveTextContent('Red')
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour green' }))
    expect(state().scene.hull).toBe('green')
    expect(state().done.match).toBeUndefined()
    expect(screen.getByTestId('station-hint')).toHaveTextContent('matches it')
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour red' }))
    expect(state().done.match).toBeTruthy()
  })

  it('the round dots follow the first goals, not just any', () => {
    const first = task(
      1,
      [
        { id: 'a', goal: 'power_on', target: 'core' },
        { id: 'b', goal: 'pick_colour', target: 'hull' },
      ],
      { coreItems: 1 }
    )
    const { state } = renderStation(first)
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour red' }))
    expect(state().done.b).toBeTruthy()
    expect(screen.queryByText('Station upgraded!')).not.toBeInTheDocument()
    expect(screen.getByTestId('round-progress')).toHaveTextContent('0 of 1 done')
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(screen.getByText('Station upgraded!')).toBeInTheDocument()
    expect(screen.getByTestId('round-progress')).toHaveTextContent('1 of 1 done · +1 bonus')
  })
})

describe('Station build jobs - Lesson 2 (stickers and decoys)', () => {
  const t = task(2, [{ id: 'note', goal: 'open_crate', onlyNoted: true }], {
    crates: [
      { id: 'crate-1', sticker: 'red-star' },
      { id: 'crate-2', sticker: 'blue-circle' },
      { id: 'crate-3', sticker: 'green-triangle' },
      { id: 'crate-4', sticker: 'red-star' },
      { id: 'crate-5' },
    ],
    note: ['red-star', 'green-triangle'],
  })

  it('shows five crates, a sticker on each, and the delivery note card', () => {
    renderStation(t)
    for (const n of [1, 2, 3, 4, 5])
      expect(screen.getByTestId(`crate-crate-${n}`)).toBeInTheDocument()
    expect(
      screen.getByTestId('crate-crate-1').querySelector('[data-sticker="red-star"]')
    ).toBeTruthy()
    expect(screen.getByTestId('crate-crate-5').querySelector('[data-sticker]')).toBeNull()
    expect(screen.getByTestId('note-red-star')).toBeInTheDocument()
    expect(screen.getByTestId('note-green-triangle')).toBeInTheDocument()
    expect(screen.queryByTestId('note-blue-circle')).not.toBeInTheDocument()
  })

  it('one click selects a crate and reads its sticker larger', () => {
    const { state } = renderStation(t)
    expect(screen.queryByTestId('sticker-reader')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('crate-crate-2'))
    expect(state().selected).toBe('crate-2')
    expect(screen.getByTestId('sticker-reader')).toHaveTextContent('Crate 2 has a blue circle')
    expect(screen.getByTestId('crate-crate-2')).toHaveAccessibleName(/sticker blue circle/)
  })

  it('opening a decoy blinks, stays shut and costs nothing', () => {
    const { state } = renderStation(t)
    fireEvent.doubleClick(screen.getByTestId('crate-crate-2'))
    expect(state().scene.crates['crate-2']).toBe('closed')
    expect(state().undo).toEqual([])
    expect(screen.getByTestId('crate-crate-2')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('station-hint')).toHaveTextContent('stays shut')
    fireEvent.doubleClick(screen.getByTestId('crate-crate-5'))
    expect(state().scene.crates['crate-5']).toBe('closed')
  })

  it('opening just the noted crates finishes the goal; crate 4 brings robot 3', () => {
    const { state } = renderStation(t)
    for (const n of [1, 3, 4]) fireEvent.doubleClick(screen.getByTestId(`crate-crate-${n}`))
    expect(state().done.note.method).toBe('double_click')
    expect(screen.getByTestId('crew-crew-robot-3')).toBeInTheDocument()
    expect(screen.getByText('Station upgraded!')).toBeInTheDocument()
  })

  it('Enter on a selected decoy blinks too', () => {
    const { state } = renderStation(t)
    const crate = screen.getByTestId('crate-crate-2')
    fireEvent.click(crate)
    fireEvent.keyDown(crate, { key: 'Enter' })
    expect(state().scene.crates['crate-2']).toBe('closed')
    expect(crate).toHaveAttribute('data-blink')
  })

  it('an ordered crate goal blinks the card on a wrong crate', () => {
    const ordered = task(2, [{ id: 'o', goal: 'open_crate', order: ['crate-2', 'crate-1'] }])
    const { state } = renderStation(ordered)
    fireEvent.doubleClick(screen.getByTestId('crate-crate-1'))
    expect(state().scene.crates['crate-1']).toBe('closed')
    expect(screen.getByTestId('card-o')).toHaveAttribute('data-blink')
    fireEvent.doubleClick(screen.getByTestId('crate-crate-2'))
    fireEvent.doubleClick(screen.getByTestId('crate-crate-1'))
    expect(state().done.o).toBeTruthy()
  })
})

describe('Station build jobs - Lesson 3 (plan order, count, step back)', () => {
  it('the plan card shows the build order and a wrong part returns to the tray', () => {
    const t = task(3, [{ id: 'plan', goal: 'place_part', order: ['dome', 'solar'] }])
    const { state } = renderStation(t)
    sizeScene()
    expect(screen.getByTestId('card-plan')).toHaveTextContent('Plan card')
    drag(screen.getByTestId('tray-solar'), { clientX: 278, clientY: 153 })
    expect(state().scene.placed).toEqual({})
    expect(screen.getByTestId('tray-solar')).toBeInTheDocument()
    expect(screen.getByTestId('tray-solar')).toHaveAttribute('data-blink')
    expect(screen.getByTestId('card-plan')).toHaveAttribute('data-blink')
    drag(screen.getByTestId('tray-dome'), { clientX: 278, clientY: 153 })
    expect(state().scene.placed['top-module-1']).toBe('dome')
  })

  it('exact count: the tray keeps the part and the card counts up', () => {
    const t = task(3, [{ id: 'sol', goal: 'place_part', target: 'solar', count: 2 }])
    const { state } = renderStation(t)
    sizeScene()
    expect(screen.getByTestId('count-sol')).toHaveTextContent('0 of 2')
    drag(screen.getByTestId('tray-solar'), { clientX: 278, clientY: 153 })
    expect(screen.getByTestId('count-sol')).toHaveTextContent('1 of 2')
    expect(screen.getByTestId('tray-solar')).toBeInTheDocument()
    drag(screen.getByTestId('tray-solar'), { clientX: 642, clientY: 153 })
    expect(state().done.sol.method).toBe('drag')
    expect(Object.values(state().scene.placed)).toEqual(['solar', 'solar'])
    // Dragging a placed copy to a free spot moves it; it does not add a third.
    drag(screen.getByTestId('station-scene').querySelector('[data-spot="top-module-1"]'), {
      clientX: 278,
      clientY: 400,
    })
    expect(Object.values(state().scene.placed)).toHaveLength(2)
  })

  it('step back: only Ctrl+Z presses that really undo count', () => {
    const t = task(3, [{ id: 'back', goal: 'undo', count: 2 }])
    const { state } = renderStation(t)
    const root = screen.getByTestId('station-activity')
    const press = () => fireEvent.keyDown(root, { key: 'z', ctrlKey: true })
    press()
    expect(state().undos).toBe(0)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-top-module-1'))
    fireEvent.click(screen.getByTestId('tray-solar'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-bottom-module-1'))
    press()
    expect(screen.getByTestId('count-back')).toHaveTextContent('1 of 2')
    press()
    expect(state().done.back.method).toBe('ctrl_z')
  })
})

describe('Station build jobs - Lesson 4 (find the one in the picture)', () => {
  it('shows the part on a card without its name, and only that part counts', () => {
    const t = task(4, [{ id: 'find', goal: 'order_part', card: 'dish' }])
    const { state } = renderStation(t)
    const card = screen.getByTestId('card-find')
    expect(card).toHaveTextContent('Find this one')
    expect(card).not.toHaveTextContent(/dish/i)
    expect(card.querySelector('img')).toBeTruthy()
    fireEvent.click(screen.getByTestId('order-telescope'))
    expect(state().done.find).toBeUndefined()
    expect(screen.getByTestId('station-hint')).toHaveTextContent('Look at the picture')
    fireEvent.click(screen.getByTestId('order-dish'))
    expect(state().done.find).toBeTruthy()
  })
})
