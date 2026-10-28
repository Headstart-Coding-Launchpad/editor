import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkPlaygroundStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Network Playground StudentView with local state. requestAnimationFrame is
// driven by hand (one call = one frame) and the canvas is a stub. Smoothness on a real
// Chromebook can't be proven in jsdom: check it in a real browser.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'network_playground',
  dataset: 'two_blobs',
  layers: [3],
  maxNeurons: 4,
  target: 0.9,
}

let frames = []
let fills = 0

beforeEach(() => {
  frames = []
  fills = 0
  vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    new Proxy(
      {},
      { get: (_, key) => (key === 'fillRect' ? () => (fills += 1) : () => {}), set: () => true }
    )
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function runFrames(count) {
  for (let i = 0; i < count; i += 1) {
    const next = frames.shift()
    if (!next) return
    act(() => next(performance.now()))
  }
}

function renderView(options = {}) {
  return renderActivityUi(NetworkPlaygroundStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

describe('Network Playground StudentView', () => {
  it('shows the dots, the network, the layer count and a Train button', () => {
    renderView()
    expect(screen.getByTestId('network-field')).toBeInTheDocument()
    expect(screen.getByTestId('network-diagram')).toBeInTheDocument()
    expect(screen.getByTestId('network-stats')).toHaveTextContent('0% right')
    expect(screen.getByTestId('network-stats')).toHaveTextContent('1 hidden layer')
    expect(screen.getByRole('button', { name: /Train/ })).toBeInTheDocument()
    expect(fills).toBeGreaterThan(0)
  })

  it('trains frame by frame on two_blobs, stops itself at the target and passes', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    expect(state().training).toBe(true)
    runFrames(200)
    expect(state().training).toBe(false)
    expect(state().acc).toBeGreaterThanOrEqual(0.9)
    expect(state().w).toHaveLength(13)
    expect(definition.grade(TASK, state()).passed).toBe(true)
    expect(frames).toHaveLength(0)
    expect(screen.getByText('Your network reached 90%')).toBeInTheDocument()
  })

  it('does only one pass over the dots a frame', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(1)
    expect(frames).toHaveLength(1)
    runFrames(5)
    expect(state().epochs).toBe(0) // not saved yet: saves are throttled to every 2 seconds
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(state().epochs).toBe(6)
    expect(state().training).toBe(false)
  })

  it('Pause stops the loop and keeps what it learned; Train more carries on', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(3)
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(state().epochs).toBe(3)
    expect(screen.getByRole('button', { name: /Train more/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Train more/ }))
    runFrames(2)
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(state().epochs).toBe(5)
  })

  it('saves while training no more than every 2 seconds', () => {
    let clock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(5)
    clock = 2500
    runFrames(5)
    expect(state().epochs).toBe(0) // under 2 seconds since the last save
    clock = 3100
    runFrames(1)
    expect(state().epochs).toBe(11)
    expect(state().training).toBe(true)
  })

  it('stops at the step cap with a kind message', () => {
    const hard = { ...TASK, dataset: 'spiral', layers: [1], target: 1 }
    const { state } = renderActivityUi(NetworkPlaygroundStudentView, {
      task: hard,
      initialState: definition.initialState(hard),
    })
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(2100)
    expect(state().training).toBe(false)
    expect(state().epochs).toBe(2000)
    expect(screen.getByText(/It got stuck/)).toBeInTheDocument()
  })

  it('+ and - change the neurons, within 1 and maxNeurons, and start the network again', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(3)
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    fireEvent.click(screen.getByRole('button', { name: 'More neurons in layer 1' }))
    expect(state().layers).toEqual([4])
    expect(state().epochs).toBe(0)
    expect(screen.getByRole('button', { name: 'More neurons in layer 1' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Fewer neurons in layer 1' }))
    expect(state().layers).toEqual([3])
    expect(state().best).toBeGreaterThanOrEqual(0)
  })

  it('Add a layer goes to 2 layers and no further; Remove a layer comes back', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Add a layer/ }))
    expect(state().layers).toEqual([3, 3])
    expect(state().maxLayers).toBe(2)
    expect(screen.queryByRole('button', { name: /Add a layer/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('network-stats')).toHaveTextContent('2 hidden layers')
    fireEvent.click(screen.getByRole('button', { name: /Remove a layer/ }))
    expect(state().layers).toEqual([3])
    expect(state().maxLayers).toBe(2)
  })

  it('allowAddLayer false hides the layer buttons but keeps the neurons', () => {
    renderActivityUi(NetworkPlaygroundStudentView, {
      task: { ...TASK, allowAddLayer: false },
      initialState: definition.initialState(TASK),
    })
    expect(screen.queryByRole('button', { name: /Add a layer/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More neurons in layer 1' })).toBeInTheDocument()
  })

  it('readOnly (the tutor) sees the student network and accuracy with no controls', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: /Train/ }))
    runFrames(10)
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    const saved = state()
    frames.length = 0
    document.body.innerHTML = ''
    renderActivityUi(NetworkPlaygroundStudentView, {
      task: TASK,
      initialState: { ...saved, training: true },
      readOnly: true,
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('network-stats')).toHaveTextContent('training now')
    expect(screen.getByTestId('network-stats')).toHaveTextContent(
      `${Math.round(saved.acc * 100)}% right`
    )
    expect(document.querySelectorAll('line').length).toBe(2 * 3 + 3)
    expect(frames).toHaveLength(0)
  })
})
