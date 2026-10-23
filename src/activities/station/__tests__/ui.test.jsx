import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StationCardSummary, StationStudentView } from '../ui.jsx'
import ui from '../ui.jsx'
import station from '../definition.js'
import { initialStationState, promptFor, stationAction } from '../station.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

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

// jsdom has no layout: give the scene a 1000 x 625 box (the art is 1.6:1) at the page origin so
// pointer positions map onto fractions of the scene. top-module-1's centre is (278, 153),
// top-module-2's (642, 153), top-part-1's (398, 193).
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
  return el
}

const SPOT_1 = { clientX: 278, clientY: 153 }
const SPOT_2 = { clientX: 642, clientY: 153 }
const PART_SPOT = { clientX: 398, clientY: 193 }
const NOWHERE = { clientX: 500, clientY: 620 }

function drag(el, to, from = { clientX: 20, clientY: 20 }) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, ...from })
  fireEvent.pointerMove(el, { pointerId: 1, ...to })
  fireEvent.pointerUp(el, { pointerId: 1, ...to })
}

const L1 = task(1, [
  { id: 'core', goal: 'power_on', target: 'core' },
  { id: 'hull', goal: 'pick_colour', target: 'hull' },
  { id: 'lights', goal: 'pick_colour', target: 'lights' },
])
const L2 = task(2, [
  { id: 'sel', goal: 'select' },
  { id: 'open', goal: 'open_crate' },
  { id: 'cap', goal: 'choose_captain' },
])
const L3 = task(3, [
  { id: 'place', goal: 'place_part' },
  { id: 'undo', goal: 'undo' },
])
const L4 = task(4, [
  { id: 'o1', goal: 'order_part', target: 'telescope' },
  { id: 'o2', goal: 'order_part', target: 'dish' },
  { id: 'pl', goal: 'place_part' },
])

describe('Station UI contract', () => {
  it('owns its layout and offers a card summary', () => {
    expect(ui.ownsLayout).toBe(true)
    expect(ui.StudentView).toBe(StationStudentView)
    expect(ui.CardSummary).toBe(StationCardSummary)
  })
})

describe('Station UI - Lesson 1 (click)', () => {
  it('shows three dark sections, power buttons and both colour rows', () => {
    renderStation(L1)
    for (const id of ['core', 'left', 'right']) {
      expect(screen.getByTestId(`section-${id}`)).toHaveAttribute('data-lit', 'false')
    }
    expect(screen.getAllByRole('button', { name: /power$/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Hull colour red' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Light colour pink' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check/i })).not.toBeInTheDocument()
  })

  it('a click on a power button lights the section and records the click', () => {
    const { state } = renderStation(L1)
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(state().scene.power.core).toBe(true)
    expect(state().done.core.method).toBe('click')
    expect(screen.getByTestId('section-core')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByTestId('section-left')).toHaveAttribute('data-lit', 'false')
    expect(screen.getByTestId('goal-core')).toHaveClass('is-done')
  })

  it('Enter on a power button counts as the keyboard method', () => {
    const { state } = renderStation(L1)
    const button = screen.getByRole('button', { name: 'Core power' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    expect(state().done.core.method).toBe('keyboard')
  })

  it('a swatch changes the hull and the lights', () => {
    const { state } = renderStation(L1)
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour red' }))
    expect(state().scene.hull).toBe('red')
    expect(state().done.hull.method).toBe('click')
    fireEvent.click(screen.getByRole('button', { name: 'Light colour green' }))
    expect(state().scene.lights).toBe('green')
    expect(state().done.lights).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hull colour red' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('shows the pass message once the goals are done, and the student can keep building', () => {
    renderStation(L1)
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour red' }))
    expect(screen.queryByText('Station upgraded!')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Light colour blue' }))
    expect(screen.getByText('Station upgraded!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left wing power' })).not.toBeDisabled()
  })

  it('shows the model hint when an attempt does not count', () => {
    const t = task(1, [{ id: 'hull', goal: 'pick_colour', target: 'hull' }])
    renderStation(t)
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    // Not the goal's action, so no hint yet.
    expect(screen.queryByTestId('station-hint')).not.toBeInTheDocument()
  })
})

describe('Station UI - Lesson 2 (select, double-click, captain)', () => {
  it('shows crates in the delivery bay and no crew yet', () => {
    renderStation(L2)
    expect(screen.getByTestId('station-bay')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Crate \d, closed$/ })).toHaveLength(3)
    expect(screen.queryByTestId('crew-crew-robot-1')).not.toBeInTheDocument()
  })

  it('a single click selects (outline) and never opens; clicking empty space clears', () => {
    const { state } = renderStation(L2)
    const crate = screen.getByTestId('crate-crate-1')
    fireEvent.click(crate)
    expect(state().selected).toBe('crate-1')
    expect(crate).toHaveClass('is-selected')
    expect(state().scene.crates['crate-1']).toBe('closed')
    expect(state().done.sel.method).toBe('click')
    expect(state().done.open).toBeUndefined()
    fireEvent.click(screen.getByTestId('station-scene'))
    expect(state().selected).toBeNull()
    expect(crate).not.toHaveClass('is-selected')
  })

  it('a native double-click opens the crate and the crew walk to their posts', () => {
    const { state } = renderStation(L2)
    fireEvent.doubleClick(screen.getByTestId('crate-crate-2'))
    expect(state().scene.crates['crate-2']).toBe('open')
    expect(state().done.open.method).toBe('double_click')
    expect(screen.getByTestId('crew-crew-robot-2')).toBeInTheDocument()
  })

  it('the delivery bay goes once every crate is open', () => {
    renderStation(L2)
    for (const id of ['crate-1', 'crate-2', 'crate-3'])
      fireEvent.doubleClick(screen.getByTestId(`crate-${id}`))
    expect(screen.queryByTestId('station-bay')).not.toBeInTheDocument()
  })

  it('Enter on a selected crate opens it by keyboard but the goal stays open with a hint', () => {
    const { state } = renderStation(L2)
    const crate = screen.getByTestId('crate-crate-1')
    fireEvent.click(crate)
    fireEvent.keyDown(crate, { key: 'Enter' })
    expect(state().scene.crates['crate-1']).toBe('open')
    expect(state().done.open).toBeUndefined()
    expect(screen.getByTestId('station-hint')).toHaveTextContent('Now try a double-click.')
    fireEvent.doubleClick(screen.getByTestId('crate-crate-3'))
    expect(state().done.open.method).toBe('double_click')
    expect(screen.queryByTestId('station-hint')).not.toBeInTheDocument()
  })

  it('clicking a crew member makes them captain and shows the badge', () => {
    const { state } = renderStation(L2)
    fireEvent.doubleClick(screen.getByTestId('crate-crate-1'))
    expect(screen.queryByTestId('captain-badge')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('crew-crew-robot-1'))
    expect(state().scene.captain).toBe('crew-robot-1')
    expect(state().done.cap.method).toBe('click')
    expect(screen.getByTestId('captain-badge')).toBeInTheDocument()
  })
})

describe('Station UI - Lesson 3 (drag and Ctrl+Z)', () => {
  it('shows the parts tray with the lesson parts', () => {
    renderStation(L3)
    for (const id of ['solar', 'dome', 'greenhouse', 'docking-arm']) {
      expect(screen.getByTestId(`tray-${id}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('station-catalogue')).not.toBeInTheDocument()
  })

  it('drag from the tray snaps into the nearest spot and records drag', () => {
    const { state } = renderStation(L3)
    sizeScene()
    const part = screen.getByTestId('tray-dome')
    fireEvent.pointerDown(part, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(part, { pointerId: 1, ...SPOT_1 })
    expect(screen.getByTestId('station-ghost')).toBeInTheDocument()
    expect(screen.getByTestId('spot-top-module-1')).toHaveClass('is-near')
    fireEvent.pointerUp(part, { pointerId: 1, ...SPOT_1 })
    expect(state().scene.placed['top-module-1']).toBe('dome')
    expect(state().done.place.method).toBe('drag')
    expect(screen.queryByTestId('tray-dome')).not.toBeInTheDocument()
    expect(screen.queryByTestId('station-ghost')).not.toBeInTheDocument()
  })

  it('a drop with no spot near goes back to the tray', () => {
    const { state } = renderStation(L3)
    sizeScene()
    drag(screen.getByTestId('tray-dome'), NOWHERE)
    expect(state().scene.placed).toEqual({})
    expect(screen.getByTestId('tray-dome')).toBeInTheDocument()
  })

  it('pointercancel puts the part back', () => {
    const { state } = renderStation(L3)
    sizeScene()
    const part = screen.getByTestId('tray-dome')
    fireEvent.pointerDown(part, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(part, { pointerId: 1, ...SPOT_1 })
    fireEvent.pointerCancel(part, { pointerId: 1 })
    expect(screen.queryByTestId('station-ghost')).not.toBeInTheDocument()
    fireEvent.pointerUp(part, { pointerId: 1, ...SPOT_1 })
    expect(state().scene.placed).toEqual({})
  })

  it('a placed part can be dragged to another spot', () => {
    const { state } = renderStation(L3)
    sizeScene()
    drag(screen.getByTestId('tray-solar'), SPOT_1)
    drag(screen.getByTestId('part-solar'), SPOT_2, SPOT_1)
    expect(state().scene.placed).toEqual({ 'top-module-2': 'solar' })
  })

  it('a press without movement is a click: it picks the part up, nothing is dropped', () => {
    const { state } = renderStation(L3)
    sizeScene()
    const part = screen.getByTestId('tray-dome')
    fireEvent.pointerDown(part, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerUp(part, { pointerId: 1, clientX: 20, clientY: 20 })
    fireEvent.click(part, { clientX: 20, clientY: 20 })
    expect(state().scene.placed).toEqual({})
    expect(screen.getByTestId('spot-top-module-1')).toBeInTheDocument()
    expect(screen.getByTestId('station-ghost')).toBeInTheDocument()
  })

  it('click to pick up then click a spot drops it with pick_drop', () => {
    const { state } = renderStation(L3)
    fireEvent.click(screen.getByTestId('tray-greenhouse'), { clientX: 30, clientY: 30 })
    expect(screen.getByTestId('spot-top-module-2')).toHaveAttribute(
      'aria-label',
      'Empty spot, top module 2'
    )
    fireEvent.click(screen.getByTestId('spot-top-module-2'))
    expect(state().scene.placed['top-module-2']).toBe('greenhouse')
    expect(state().done.place.method).toBe('pick_drop')
    expect(screen.queryByTestId('spot-top-module-1')).not.toBeInTheDocument()
  })

  it('empty docking pads are always on the hull in Lesson 3', () => {
    renderStation(L3)
    expect(screen.getByTestId('pad-top-module-1')).toBeInTheDocument()
    expect(screen.queryByTestId('spot-top-module-1')).not.toBeInTheDocument()
  })

  it('Escape or clicking elsewhere puts a picked-up part back', () => {
    const { state } = renderStation(L3)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    expect(screen.getByTestId('spot-top-module-1')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('station-activity'), { key: 'Escape' })
    expect(screen.queryByTestId('spot-top-module-1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('station-scene'))
    expect(screen.queryByTestId('spot-top-module-1')).not.toBeInTheDocument()
    expect(state().scene.placed).toEqual({})
    expect(screen.getByTestId('tray-dome')).toBeInTheDocument()
  })

  it('Ctrl+Z undoes the last change and records ctrl_z', () => {
    const { state } = renderStation(L3)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-top-module-1'))
    expect(state().scene.placed['top-module-1']).toBe('dome')
    const notPrevented = fireEvent.keyDown(screen.getByTestId('station-activity'), {
      key: 'z',
      ctrlKey: true,
    })
    expect(notPrevented).toBe(false)
    expect(state().scene.placed).toEqual({})
    expect(state().done.undo.method).toBe('ctrl_z')
  })

  it('Cmd+Z undoes the last change and records cmd_z', () => {
    const { state } = renderStation(L3)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-top-module-1'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Core power' }), {
      key: 'z',
      metaKey: true,
    })
    expect(state().scene.placed).toEqual({})
    expect(state().done.undo.method).toBe('cmd_z')
  })
})

describe('Station UI - Lesson 4 (catalogue)', () => {
  it('shows a scrolling catalogue, best part last, and an empty tray', () => {
    renderStation(L4)
    const list = screen.getByTestId('station-catalogue')
    const rows = list.querySelectorAll('li')
    expect(rows).toHaveLength(8)
    expect(rows[7]).toHaveTextContent('Rainbow ring')
    expect(screen.getByTestId('station-tray')).toHaveTextContent('Order a part')
  })

  it('Order records scrolled only when the list was scrolled', () => {
    const { state } = renderStation(L4)
    fireEvent.click(screen.getByRole('button', { name: 'Order Telescope' }))
    expect(state().scene.ordered).toEqual(['telescope'])
    expect(state().done.o1).toMatchObject({ method: 'click', scrolled: false })
    fireEvent.scroll(screen.getByTestId('station-catalogue'))
    fireEvent.click(screen.getByRole('button', { name: 'Order Radio dish' }))
    expect(state().done.o2).toMatchObject({ scrolled: true })
    expect(screen.getByRole('button', { name: 'Order Telescope' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Order Telescope' })).toHaveTextContent('Ordered')
  })

  it('an ordered part appears in the tray and can be dragged in', () => {
    const { state } = renderStation(L4)
    sizeScene()
    fireEvent.click(screen.getByRole('button', { name: 'Order Flag' }))
    // The Lesson 4 start scene has no parts placed; top-part-1 takes a flag.
    drag(screen.getByTestId('tray-flag'), PART_SPOT)
    expect(state().scene.placed['top-part-1']).toBe('flag')
    expect(Object.values(state().scene.placed)).toContain('flag')
    expect(state().done.pl.method).toBe('drag')
  })
})

describe('Station UI - the art scene', () => {
  it('shows the colour swatches in Lesson 1 only', () => {
    const { unmount } = renderStation(L1)
    expect(screen.getByRole('group', { name: 'Hull colour' })).toBeInTheDocument()
    unmount()
    for (const t of [L2, L3, L4]) {
      const view = renderStation(t)
      expect(screen.queryByRole('group', { name: 'Hull colour' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Light colour' })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('draws the dark hull until power is on and shows no art path outside art.js', () => {
    renderStation(L1)
    const scene = screen.getByTestId('station-scene')
    expect(scene.style.getPropertyValue('--act-station-lit')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(Number(scene.style.getPropertyValue('--act-station-lit'))).toBeCloseTo(1 / 3)
    expect(scene.querySelector('img[src$="hull-dark.png"]')).toBeInTheDocument()
    expect(scene.querySelector('img[src$="hull-lit.png"]')).toBeInTheDocument()
  })

  it('draws a closed or open crate and hangs a part under the hull flipped', () => {
    renderStation(L2)
    const crate = screen.getByTestId('crate-crate-1')
    expect(crate.querySelector('img').getAttribute('src')).toMatch(/crate-1x1-closed\.png$/)
    fireEvent.doubleClick(crate)
    expect(crate.querySelector('img').getAttribute('src')).toMatch(/crate-1x1-open\.png$/)
  })

  it('a hanging spot flips the part; a held part lights only the spots it fits', () => {
    renderStation(L3)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    // The dome never hangs, so the two spots under the hull are not offered.
    expect(screen.getByTestId('spot-top-module-1')).toBeInTheDocument()
    expect(screen.queryByTestId('spot-bottom-module-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spot-end-left')).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('station-activity'), { key: 'Escape' })
    fireEvent.click(screen.getByTestId('tray-solar'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-bottom-module-1'))
    expect(screen.getByTestId('part-solar').querySelector('img.is-flip-y')).toBeInTheDocument()
  })

  it('puts a small picture beside each goal', () => {
    renderStation(L2)
    const goals = screen.getByTestId('station-goals').querySelectorAll('.act-station-goal__icon')
    expect(goals).toHaveLength(3)
    expect(goals[0].querySelector('img')).toBeInTheDocument()
  })

  it('says Select a crate in Lesson 2 and plays the upgrade moment once the goals finish', () => {
    expect(promptFor({ id: 'a', goal: 'select' }, 2)).toBe('Select a crate.')
    renderStation(L1)
    const scene = screen.getByTestId('station-scene')
    expect(scene).toHaveAttribute('data-upgraded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour red' }))
    fireEvent.click(screen.getByRole('button', { name: 'Light colour blue' }))
    expect(scene).toHaveAttribute('data-upgraded', 'true')
    expect(screen.getByTestId('station-upgrade-fx')).toBeInTheDocument()
    expect(screen.getByText('Station upgraded!')).toBeInTheDocument()
  })

  it('the newest placed part pops when the round finishes, and a finished station opens calm', () => {
    const t = task(3, [{ id: 'p', goal: 'place_part' }])
    renderStation(t)
    fireEvent.click(screen.getByTestId('tray-dome'), { clientX: 30, clientY: 30 })
    fireEvent.click(screen.getByTestId('spot-top-module-1'))
    expect(screen.getByTestId('part-dome')).toHaveClass('is-newest')
    const done = stationAction(
      initialStationState(t),
      { type: 'place', part: 'dome', spot: 'top-module-1', method: 'drag' },
      t
    )
    render(<StationStudentView task={t} state={done} onChange={vi.fn()} readOnly />)
    expect(screen.getAllByTestId('station-scene')[1]).toHaveAttribute('data-upgraded', 'false')
  })
})

describe('Station UI - tutor views', () => {
  function stateWith(t, actions) {
    return actions.reduce((s, a) => stationAction(s, a, t), initialStationState(t))
  }

  it('readOnly shows the same station with no interaction and each goal in words', () => {
    const s = stateWith(L2, [
      { type: 'open', crate: 'crate-1', method: 'double_click' },
      { type: 'captain', crew: 'crew-robot-1', method: 'click' },
    ])
    const onChange = vi.fn()
    render(<StationStudentView task={L2} state={s} onChange={onChange} readOnly />)
    expect(screen.getByTestId('method-open')).toHaveTextContent('double-click')
    expect(screen.getByTestId('method-cap')).toHaveTextContent('click')
    expect(screen.getByTestId('crew-crew-robot-1')).toBeDisabled()
    expect(screen.getByTestId('crate-crate-2')).toBeDisabled()
    expect(screen.getByTestId('captain-badge')).toBeInTheDocument()
    fireEvent.doubleClick(screen.getByTestId('crate-crate-2'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('station-tutor-undo')).not.toBeInTheDocument()
  })

  it('a student does not see the goal methods while playing', () => {
    renderStation(L1)
    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(screen.queryByTestId('method-core')).not.toBeInTheDocument()
  })

  it('the tutor can undo the last change while editing answers (tutor method never counts)', () => {
    const s = stateWith(L3, [{ type: 'place', part: 'dome', spot: 'top-module-1', method: 'drag' }])
    const onChange = vi.fn()
    render(<StationStudentView task={L3} state={s} onChange={onChange} teacher />)
    fireEvent.click(screen.getByTestId('station-tutor-undo'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0](s)
    expect(next.scene.placed).toEqual({})
    expect(next.done.undo).toBeUndefined()
    expect(next.done.place.method).toBe('drag')
  })

  it('the tutor undo is disabled when there is nothing to undo', () => {
    render(
      <StationStudentView task={L3} state={initialStationState(L3)} onChange={vi.fn()} teacher />
    )
    expect(screen.getByTestId('station-tutor-undo')).toBeDisabled()
  })
})

describe('Station CardSummary', () => {
  it('shows a mini-station and the goal count', () => {
    const s = stationAction(
      stationAction(
        initialStationState(L1),
        { type: 'power', section: 'core', method: 'click' },
        L1
      ),
      { type: 'colour', target: 'hull', colour: 'red', method: 'click' },
      L1
    )
    render(<StationCardSummary task={L1} state={s} />)
    expect(screen.getByTestId('station-card')).toHaveTextContent('2/3 goals')
    expect(screen.getByTestId('mini-section-core')).toHaveAttribute('data-lit', 'true')
    expect(screen.getByTestId('mini-section-left')).toHaveAttribute('data-lit', 'false')
  })

  it('shows filled spots as dots and reads a serialised answer', () => {
    const t = task(3, [{ id: 'p', goal: 'place_part' }])
    const s = stationAction(
      initialStationState(t),
      { type: 'place', part: 'solar', spot: 'bottom-module-1', method: 'drag' },
      t
    )
    render(<StationCardSummary task={t} raw={JSON.stringify(s)} />)
    expect(screen.getByTestId('mini-spot-bottom-module-1')).toHaveAttribute('data-filled', 'true')
    expect(screen.getByTestId('mini-spot-top-module-1')).toHaveAttribute('data-filled', 'false')
    expect(screen.getByTestId('station-card')).toHaveTextContent('1/1 goals')
  })
})
